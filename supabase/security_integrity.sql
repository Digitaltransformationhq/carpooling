-- ============================================================
-- RideShare — integrity & abuse hardening (run LAST, after all other
-- migrations incl. security.sql). Idempotent. Fixes:
--   #1 Reward farming  — points are now symmetric (granted AND revoked),
--      and you can't book/accept your own ride.
--   #2 Ride field tampering — driver_name/avatar are pinned from the
--      profile; booked_seats/rating can't be written by the browser.
--   #3 Unbounded requests — a rider can't request more seats than a ride
--      offers, enforced server-side.
--   #4 Abuse — light per-user hourly rate limits on publishing/requesting.
--   #5 Directory over-share — handled in the app (searchProfiles columns).
--   #7 Realtime — RLS asserted ON so realtime stays gated.
-- ============================================================

alter table public.rides    enable row level security;  -- (#7 assert)
alter table public.bookings enable row level security;

-- ------------------------------------------------------------
-- #1  Reward points: symmetric grant/revoke (no more farming)
-- ------------------------------------------------------------
-- Deduct the +2 when a ride is deleted (publish→delete loop now nets 0).
create or replace function public.rides_revoke_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.user_id is not null then
    update public.profiles set points = greatest(0, points - 2) where id = old.user_id;
  end if;
  return old;
end; $$;
drop trigger if exists trg_rides_revoke_points on public.rides;
create trigger trg_rides_revoke_points after delete on public.rides
  for each row execute function public.rides_revoke_points();

-- The rider's +1 is now managed ENTIRELY by this trigger (granted when a
-- booking becomes accepted, revoked when it's un-accepted / cancelled /
-- deleted) — so accept_booking no longer awards points directly.
create or replace function public.bookings_award_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'accepted' then
      update public.profiles set points = points + 1 where id = new.user_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status = 'accepted' and old.status is distinct from 'accepted' then
      update public.profiles set points = points + 1 where id = new.user_id;
    elsif old.status = 'accepted' and new.status is distinct from 'accepted' then
      update public.profiles set points = greatest(0, points - 1) where id = old.user_id;
    end if;
    return new;
  else -- DELETE
    if old.status = 'accepted' then
      update public.profiles set points = greatest(0, points - 1) where id = old.user_id;
    end if;
    return old;
  end if;
end; $$;
drop trigger if exists trg_bookings_award_points on public.bookings;
create trigger trg_bookings_award_points
  after insert or update or delete on public.bookings
  for each row execute function public.bookings_award_points();

-- Redefine accept_booking: keep all authz checks, block self-accept, and
-- DROP the inline point award (the trigger above handles it — no double count).
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
-- #1 + #3 + #4  Booking guard: no self-booking, no over-request, rate limit
-- ------------------------------------------------------------
create or replace function public.bookings_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_seats int; v_mine int; v_recent int;
begin
  if new.seats is null or new.seats < 1 then
    raise exception 'Invalid seat count';
  end if;

  select user_id, seats into v_owner, v_seats from public.rides where id = new.ride_id;
  if v_owner is null then raise exception 'Ride not found'; end if;

  -- #1 can't book your own ride
  if v_owner = new.user_id then
    raise exception 'You cannot book your own ride.';
  end if;

  -- #3 your total seats on this ride can't exceed what the ride offers
  select coalesce(sum(seats), 0) into v_mine
    from public.bookings where ride_id = new.ride_id and user_id = new.user_id;
  if v_mine + new.seats > v_seats then
    raise exception 'You cannot request more seats than this ride offers.';
  end if;

  -- #4 light anti-abuse: max 60 booking requests per user per hour
  select count(*) into v_recent
    from public.bookings where user_id = new.user_id and created_at > now() - interval '1 hour';
  if v_recent >= 60 then
    raise exception 'Too many booking requests in a short time. Please try again later.';
  end if;

  return new;
end; $$;
drop trigger if exists trg_bookings_guard on public.bookings;
create trigger trg_bookings_guard before insert on public.bookings
  for each row execute function public.bookings_guard();

-- ------------------------------------------------------------
-- #2  Rides: pin trusted driver fields + lock non-editable columns
-- ------------------------------------------------------------
-- driver_name/avatar are forced from the author's profile (kills the
-- listing-impersonation spoof while keeping the profile→rides sync working);
-- rating is neutralised; booked_seats starts at 0 on insert.
create or replace function public.rides_pin_driver()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_avatar text;
begin
  if new.user_id is not null then
    select full_name, avatar_url into v_name, v_avatar from public.profiles where id = new.user_id;
  end if;

  if v_name is not null and btrim(v_name) <> '' then
    new.driver_name := v_name;
  elsif tg_op = 'UPDATE' then
    new.driver_name := old.driver_name;
  end if;

  if v_avatar is not null then
    new.driver_avatar := v_avatar;
  elsif tg_op = 'UPDATE' then
    new.driver_avatar := old.driver_avatar;
  end if;

  -- no real rating system exists; keep neutral values
  new.driver_rating := 5.0;
  new.driver_review_count := 0;
  if tg_op = 'INSERT' then
    new.booked_seats := 0;
  end if;

  return new;
end; $$;
drop trigger if exists trg_rides_pin_driver on public.rides;
create trigger trg_rides_pin_driver before insert or update on public.rides
  for each row execute function public.rides_pin_driver();

-- #4 light anti-abuse: max 30 rides published per user per hour
create or replace function public.rides_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_recent int;
begin
  if new.user_id is not null then
    select count(*) into v_recent
      from public.rides where user_id = new.user_id and created_at > now() - interval '1 hour';
    if v_recent >= 30 then
      raise exception 'Too many rides published in a short time. Please try again later.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_rides_rate_limit on public.rides;
create trigger trg_rides_rate_limit before insert on public.rides
  for each row execute function public.rides_rate_limit();

-- Lock which ride columns the browser role may UPDATE. The reward/booking
-- triggers run as the table owner and are unaffected, so booked_seats still
-- stays correct; clients just can't tamper with it (or price/seats/route text).
revoke update on public.rides from anon, authenticated;
grant update (driver_name, driver_avatar, started, completed, route_geom)
  on public.rides to authenticated;

-- ------------------------------------------------------------
-- Corrective backfill: reset everyone's points to the clean invariant
-- (2 per ride published + 1 per accepted seat on someone else's ride),
-- wiping any points farmed before this migration.
-- ------------------------------------------------------------
update public.profiles p set points = coalesce(r.pts, 0) + coalesce(b.pts, 0)
from (select id from public.profiles) ids
left join (
  select user_id, count(*) * 2 as pts
  from public.rides where user_id is not null group by user_id
) r on r.user_id = ids.id
left join (
  select bk.user_id, count(*) * 1 as pts
  from public.bookings bk
  join public.rides rd on rd.id = bk.ride_id
  where bk.status = 'accepted' and bk.user_id <> rd.user_id
  group by bk.user_id
) b on b.user_id = ids.id
where p.id = ids.id;
