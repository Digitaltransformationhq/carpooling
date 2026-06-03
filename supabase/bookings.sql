-- ============================================================
-- RideShare — seat availability + driver rider management.
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

-- track how many seats are booked on each ride
alter table public.rides     add column if not exists booked_seats int not null default 0;
-- store the rider's phone so the driver can call them
alter table public.bookings  add column if not exists passenger_phone text;

-- ---------- keep rides.booked_seats in sync with bookings ----------
create or replace function public.bookings_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.rides set booked_seats = booked_seats + new.seats where id = new.ride_id;
  return new;
end; $$;

create or replace function public.bookings_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.rides set booked_seats = greatest(0, booked_seats - old.seats) where id = old.ride_id;
  return old;
end; $$;

drop trigger if exists trg_bookings_insert on public.bookings;
create trigger trg_bookings_insert after insert on public.bookings
  for each row execute function public.bookings_after_insert();

drop trigger if exists trg_bookings_delete on public.bookings;
create trigger trg_bookings_delete after delete on public.bookings
  for each row execute function public.bookings_after_delete();

-- backfill current counts
update public.rides r set booked_seats = coalesce(
  (select sum(b.seats) from public.bookings b where b.ride_id = r.id), 0
);

-- ---------- RLS ----------
-- read: only the booker or the ride's driver can see a booking
drop policy if exists "bookings public read" on public.bookings;
drop policy if exists "bookings read own or driver" on public.bookings;
create policy "bookings read own or driver" on public.bookings for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.rides r where r.id = bookings.ride_id and r.user_id = auth.uid())
  );

-- delete: the booker (cancel) OR the ride's driver (remove rider)
drop policy if exists "bookings delete own or driver" on public.bookings;
create policy "bookings delete own or driver" on public.bookings for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.rides r where r.id = bookings.ride_id and r.user_id = auth.uid())
  );
