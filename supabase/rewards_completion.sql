-- ============================================================
-- CACommute — completion-based reward points (anti-farming).
--
-- Points are earned ONLY when a ride actually COMPLETES:
--   * driver -> +2, but only if the ride had >=1 distinct accepted rider
--   * rider  -> +1, once per rider on that ride (not per booking)
--
-- This closes the farming loopholes in the old "instant" model:
--   * publishing a ride now earns nothing        (kills publish-spam)
--   * a ride can only be completed on/after its travel date
--   * bookings on a completed ride are frozen      (can't be added/removed
--     to re-trigger awards)
--   * un-completing a completed ride revokes the points; DELETING a completed
--     ride keeps them (the trip happened — cleanup shouldn't strip the reward)
--   * a rider earns once per ride, however many bookings they make
--
-- Run ONCE in Supabase -> SQL Editor, AFTER the other migrations
-- (rewards.sql, security_integrity.sql). Idempotent.
-- ============================================================

alter table public.profiles add column if not exists points int not null default 0;

-- ------------------------------------------------------------
-- 1) Remove the old instant award/revoke logic
-- ------------------------------------------------------------
drop trigger if exists trg_rides_award_points    on public.rides;     -- +2 on publish
drop trigger if exists trg_rides_revoke_points   on public.rides;     -- -2 on delete
drop trigger if exists trg_bookings_award_points on public.bookings;  -- +1 on accept
drop function if exists public.rides_award_points()    cascade;
drop function if exists public.rides_revoke_points()   cascade;
drop function if exists public.bookings_award_points() cascade;

-- accept_booking must NOT award points anymore (award happens at completion);
-- it keeps every authorization + capacity check.
create or replace function public.accept_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ride uuid; v_seats int; v_status text; v_cap int; v_taken int; v_user uuid; v_owner uuid;
begin
  select b.ride_id, b.seats, b.status, b.user_id
    into v_ride, v_seats, v_status, v_user
    from public.bookings b where b.id = p_booking_id;
  if v_ride is null then raise exception 'Request not found'; end if;

  select user_id, seats, coalesce(booked_seats, 0)
    into v_owner, v_cap, v_taken from public.rides where id = v_ride;
  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'Only the ride''s driver can accept requests';
  end if;
  if v_user = v_owner then raise exception 'You cannot accept your own booking.'; end if;
  if v_status = 'accepted' then return; end if;
  if v_seats > (v_cap - v_taken) then
    raise exception 'Not enough seats left to accept this request';
  end if;

  update public.bookings set status = 'accepted' where id = p_booking_id;
end; $$;
grant execute on function public.accept_booking(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2) Settle points for a ride. sign = +1 to award, -1 to revoke.
--    Driver gets 2, each DISTINCT accepted rider gets 1 (never the driver).
--    No riders -> nobody earns anything.
-- ------------------------------------------------------------
create or replace function public.ride_settle_points(p_ride uuid, p_driver uuid, p_sign int)
returns void language plpgsql security definer set search_path = public as $$
declare v_riders int;
begin
  select count(distinct user_id) into v_riders
    from public.bookings
   where ride_id = p_ride and status = 'accepted'
     and user_id is not null and user_id <> p_driver;

  if v_riders = 0 then return; end if;  -- solo/unfulfilled ride earns nothing

  if p_driver is not null then
    update public.profiles set points = greatest(0, points + p_sign * 2) where id = p_driver;
  end if;

  update public.profiles p set points = greatest(0, p.points + p_sign * 1)
    from (
      select distinct user_id from public.bookings
       where ride_id = p_ride and status = 'accepted'
         and user_id is not null and user_id <> p_driver
    ) r
   where p.id = r.user_id;
end; $$;

-- ------------------------------------------------------------
-- 3) Completion gate + award/revoke on the `completed` flag
-- ------------------------------------------------------------
-- A ride can't be completed before its travel date (stops instant-complete farming).
create or replace function public.rides_completion_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.completed and not coalesce(old.completed, false) then
    if new.travel_date > current_date then
      raise exception 'A ride can only be marked complete on or after its travel date.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_rides_completion_guard on public.rides;
create trigger trg_rides_completion_guard before update of completed on public.rides
  for each row execute function public.rides_completion_guard();

-- Award when completed goes false->true; revoke when true->false.
create or replace function public.rides_completion_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.completed and not coalesce(old.completed, false) then
    perform public.ride_settle_points(new.id, new.user_id, 1);
  elsif coalesce(old.completed, false) and not new.completed then
    perform public.ride_settle_points(new.id, new.user_id, -1);
  end if;
  return new;
end; $$;
drop trigger if exists trg_rides_completion_points on public.rides;
create trigger trg_rides_completion_points after update of completed on public.rides
  for each row execute function public.rides_completion_points();

-- Points for a COMPLETED ride are KEPT when the ride is later deleted — the
-- trip really happened, so removing the record must not strip the earned
-- reward. (Un-completing a ride still revokes, via the completion trigger.)
-- This function only flags the deletion so the ride's booking rows may cascade
-- past the freeze below.
create or replace function public.rides_delete_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('cacommute.deleting_ride', old.id::text, true); -- txn-local
  return old;
end; $$;
drop trigger if exists trg_rides_delete_points on public.rides;
create trigger trg_rides_delete_points before delete on public.rides
  for each row execute function public.rides_delete_points();

-- ------------------------------------------------------------
-- 4) Freeze a completed ride's bookings so the awarded set can't change
--    (otherwise the revoke math drifts and farming reopens).
-- ------------------------------------------------------------
create or replace function public.bookings_freeze_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ride uuid;
begin
  v_ride := coalesce(new.ride_id, old.ride_id);
  -- allow a completed ride's own bookings to be removed when the RIDE is being
  -- deleted (rides_delete_points sets this flag first); everything else on a
  -- completed ride is frozen.
  if tg_op = 'DELETE'
     and current_setting('cacommute.deleting_ride', true) is not distinct from v_ride::text then
    return old;
  end if;
  if exists (select 1 from public.rides where id = v_ride and completed) then
    raise exception 'This ride is completed; its bookings can no longer change.';
  end if;
  return coalesce(new, old);
end; $$;
drop trigger if exists trg_bookings_freeze_completed on public.bookings;
create trigger trg_bookings_freeze_completed before insert or update or delete on public.bookings
  for each row execute function public.bookings_freeze_completed();

-- ------------------------------------------------------------
-- 5) Recompute everyone's points from the clean invariant:
--    2 per completed ride that had >=1 distinct accepted rider (driver),
--    1 per completed ride you rode on (rider, distinct). Wipes farmed points.
-- ------------------------------------------------------------
with driver_pts as (
  select r.user_id as uid, count(*) * 2 as pts
  from public.rides r
  where r.completed and r.user_id is not null
    and exists (
      select 1 from public.bookings b
      where b.ride_id = r.id and b.status = 'accepted'
        and b.user_id is not null and b.user_id <> r.user_id
    )
  group by r.user_id
),
rider_pts as (
  select b.user_id as uid, count(distinct r.id) * 1 as pts
  from public.bookings b
  join public.rides r on r.id = b.ride_id
  where r.completed and b.status = 'accepted'
    and b.user_id is not null and b.user_id <> r.user_id
  group by b.user_id
)
update public.profiles p
   set points = coalesce((select pts from driver_pts d where d.uid = p.id), 0)
              + coalesce((select pts from rider_pts  x where x.uid = p.id), 0);
