-- ============================================================
-- CACommute — link rides & bookings to the user who created them
-- (powers "My Rides" and the profile stats). Run ONCE in Supabase
-- SQL Editor. Idempotent.
-- ============================================================

alter table public.rides
  add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.bookings
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- mark rides complete
alter table public.rides
  add column if not exists completed boolean not null default false;

-- let a user keep their own rides' driver name/photo in sync + mark complete
drop policy if exists "rides update own" on public.rides;
create policy "rides update own" on public.rides for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- let a user delete their own published rides
drop policy if exists "rides delete own" on public.rides;
create policy "rides delete own" on public.rides for delete
  using (auth.uid() = user_id);

-- The review system was removed — drop the table if it exists.
drop table if exists public.reviews;
