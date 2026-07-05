-- ============================================================
-- CACommute — request-to-join flow.
-- A rider REQUESTS a seat (status 'pending'); the driver ACCEPTS
-- it (status 'accepted') or declines (the row is deleted).
-- Only ACCEPTED seats count toward rides.booked_seats / availability.
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

-- ---------- booking status ----------
alter table public.bookings add column if not exists status text;
-- existing bookings predate the request flow → treat them as confirmed
update public.bookings set status = 'accepted' where status is null;
alter table public.bookings alter column status set default 'pending';
alter table public.bookings alter column status set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_status_check') then
    alter table public.bookings
      add constraint bookings_status_check check (status in ('pending', 'accepted'));
  end if;
end $$;

-- ---------- keep rides.booked_seats = SUM of ACCEPTED seats ----------
create or replace function public.bookings_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' then
    update public.rides set booked_seats = booked_seats + new.seats where id = new.ride_id;
  end if;
  return new;
end; $$;

create or replace function public.bookings_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'accepted' then
    update public.rides set booked_seats = greatest(0, booked_seats - old.seats) where id = old.ride_id;
  end if;
  return old;
end; $$;

create or replace function public.bookings_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- request just got accepted
  if new.status = 'accepted' and old.status <> 'accepted' then
    update public.rides set booked_seats = booked_seats + new.seats where id = new.ride_id;
  -- an accepted booking got un-accepted (rare)
  elsif old.status = 'accepted' and new.status <> 'accepted' then
    update public.rides set booked_seats = greatest(0, booked_seats - old.seats) where id = old.ride_id;
  -- accepted booking changed seat count (partial cancel)
  elsif new.status = 'accepted' and old.status = 'accepted' and new.seats <> old.seats then
    update public.rides
       set booked_seats = greatest(0, booked_seats - old.seats + new.seats)
     where id = old.ride_id;
  end if;
  return new;
end; $$;

drop trigger if exists trg_bookings_update on public.bookings;
create trigger trg_bookings_update after update on public.bookings
  for each row execute function public.bookings_after_update();

-- recompute counts from accepted bookings only
update public.rides r set booked_seats = coalesce(
  (select sum(b.seats) from public.bookings b where b.ride_id = r.id and b.status = 'accepted'), 0
);

-- ---------- RLS ----------
-- insert: a rider may only create a PENDING request for themselves
-- (you can't self-confirm — only the driver can accept, via the RPC below)
drop policy if exists "bookings public insert" on public.bookings;
drop policy if exists "bookings insert pending" on public.bookings;
create policy "bookings insert pending" on public.bookings for insert
  with check (auth.uid() = user_id and status = 'pending');

-- ---------- accept a request (driver only) ----------
-- SECURITY DEFINER so it can flip status past RLS, but it re-checks that the
-- caller owns the ride and that there are enough seats left.
create or replace function public.accept_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ride uuid; v_seats int; v_status text; v_cap int; v_taken int;
begin
  select ride_id, seats, status into v_ride, v_seats, v_status
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
end; $$;

-- ---------- rider cancels/withdraws their own seats ----------
-- p_status null = any; or limit to 'pending' (withdraw) / 'accepted' (cancel).
create or replace function public.cancel_my_seats(p_ride_id uuid, p_seats int, p_status text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; remaining int := p_seats;
begin
  for r in
    select id, seats from public.bookings
     where ride_id = p_ride_id
       and user_id = auth.uid()
       and (p_status is null or status = p_status)
     order by created_at
  loop
    exit when remaining <= 0;
    if r.seats <= remaining then
      delete from public.bookings where id = r.id;
      remaining := remaining - r.seats;
    else
      update public.bookings set seats = seats - remaining where id = r.id;
      remaining := 0;
    end if;
  end loop;
end; $$;

grant execute on function public.accept_booking(uuid) to authenticated;
grant execute on function public.cancel_my_seats(uuid, int, text) to authenticated;
