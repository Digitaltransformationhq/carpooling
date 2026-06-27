-- ============================================================
-- RideShare — forthcoming CA events (shown on the calendar).
-- Members can carpool to an event from its calendar entry.
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  date not null,
  event_time  text,
  location    text,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.events enable row level security;

-- ---------- RLS ----------
-- Anyone can read events; any signed-in member can add/edit/remove them
-- (tighten to an admin role later if needed).
drop policy if exists "events public read" on public.events;
drop policy if exists "events write authenticated" on public.events;
create policy "events public read" on public.events for select using (true);
create policy "events write authenticated" on public.events
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------- sample events (only seeds when the table is empty) ----------
insert into public.events (title, event_date, event_time, location, description)
select * from (values
  ('ICAI Vadodara CPE Seminar', (current_date + 7)::date, '10:00 AM', 'ICAI Bhawan, Vadodara',
    'Continuing Professional Education seminar on recent tax amendments.'),
  ('GST Practitioners Meetup',   (current_date + 14)::date, '04:00 PM', 'Sayajigunj, Vadodara',
    'Networking and knowledge-sharing for GST practitioners.'),
  ('Audit & Assurance Workshop', (current_date + 21)::date, '09:30 AM', 'Alkapuri, Vadodara',
    'Hands-on workshop covering the latest auditing standards.')
) as t(title, event_date, event_time, location, description)
where not exists (select 1 from public.events);
