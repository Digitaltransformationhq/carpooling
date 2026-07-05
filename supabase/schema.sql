-- ============================================================
-- CACommute — Supabase schema + seed
-- Run this in your Supabase project: SQL Editor → paste → Run
-- ============================================================

-- ---------- rides ----------
create table if not exists public.rides (
  id                  uuid primary key default gen_random_uuid(),
  driver_name         text not null,
  driver_avatar       text not null default '',
  driver_rating       numeric(2,1) not null default 5.0,
  driver_review_count int  not null default 0,
  from_location       text not null,
  to_location         text not null,
  travel_date         date not null,
  departure_time      text not null,
  price               int  not null,
  seats               int  not null default 1,
  distance            text not null default '',
  duration            text not null default '',
  car_model           text not null default '',
  preferences         text[] not null default '{}',
  created_at          timestamptz not null default now()
);

-- ---------- bookings ----------
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  ride_id        uuid not null references public.rides(id) on delete cascade,
  passenger_name text not null default 'Guest',
  seats          int  not null default 1,
  created_at     timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- NOTE: these policies are OPEN (anon can read/insert) so the demo works
-- without authentication. Tighten them once you add Supabase Auth.
alter table public.rides    enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "rides public read"   on public.rides;
drop policy if exists "rides public insert" on public.rides;
create policy "rides public read"   on public.rides   for select using (true);
create policy "rides public insert" on public.rides   for insert with check (true);

drop policy if exists "bookings public read"   on public.bookings;
drop policy if exists "bookings public insert" on public.bookings;
create policy "bookings public read"   on public.bookings for select using (true);
create policy "bookings public insert" on public.bookings for insert with check (true);

-- ---------- Seed data ----------
-- (no seed/demo rides — the app starts empty and fills from real
--  rides published by signed-in users)
