-- ============================================================
-- CACommute — enable live updates (Supabase Realtime).
-- Lets the ride details page update itself when a ride or its
-- bookings change (driver accepts a request, a seat is cancelled,
-- ride started/completed) without anyone refreshing the page.
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rides'
  ) then
    alter publication supabase_realtime add table public.rides;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  -- profiles: so the reward-points badge updates live everywhere the moment
  -- points change (a ride completes, a request is accepted, etc.).
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
