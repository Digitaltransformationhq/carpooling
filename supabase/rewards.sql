-- ============================================================
-- RideShare — reward points (replaces the old money/price idea).
--   * Publish a ride           -> +2 points to the driver.
--   * Get a seat confirmed     -> +1 point  to the rider.
-- Points live on public.profiles.points.
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

-- ---------- points column ----------
alter table public.profiles add column if not exists points int not null default 0;

-- ---------- +2 to the driver when a ride is published ----------
create or replace function public.rides_award_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    update public.profiles set points = points + 2 where id = new.user_id;
  end if;
  return new;
end; $$;

drop trigger if exists trg_rides_award_points on public.rides;
create trigger trg_rides_award_points after insert on public.rides
  for each row execute function public.rides_award_points();

-- ---------- +1 to the rider when their request is accepted ----------
-- Re-defines accept_booking (from booking_requests.sql) to also award the point.
create or replace function public.accept_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ride uuid; v_seats int; v_status text; v_cap int; v_taken int; v_user uuid;
begin
  select ride_id, seats, status, user_id into v_ride, v_seats, v_status, v_user
    from public.bookings where id = p_booking_id;
  if v_ride is null then raise exception 'Request not found'; end if;
  if not exists (select 1 from public.rides where id = v_ride and user_id = auth.uid()) then
    raise exception 'Only the ride''s driver can accept requests';
  end if;
  if v_status = 'accepted' then return; end if;

  select seats, coalesce(booked_seats, 0) into v_cap, v_taken
    from public.rides where id = v_ride;
  if v_seats > (v_cap - v_taken) then
    raise exception 'Not enough seats left to accept this request';
  end if;

  update public.bookings set status = 'accepted' where id = p_booking_id;

  -- reward the rider for getting a confirmed seat
  if v_user is not null then
    update public.profiles set points = points + 1 where id = v_user;
  end if;
end; $$;

grant execute on function public.accept_booking(uuid) to authenticated;

-- ---------- backfill points from existing data ----------
-- 2 per published ride + 1 per accepted booking, per user.
update public.profiles p set points = coalesce(r.pts, 0) + coalesce(b.pts, 0)
from (select id from public.profiles) ids
left join (
  select user_id, count(*) * 2 as pts from public.rides
  where user_id is not null group by user_id
) r on r.user_id = ids.id
left join (
  select user_id, count(*) * 1 as pts from public.bookings
  where user_id is not null and status = 'accepted' group by user_id
) b on b.user_id = ids.id
where p.id = ids.id;
