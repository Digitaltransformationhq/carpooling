-- ============================================================
-- CACommute — vehicle type (2-wheeler / 4-wheeler).
-- Replaces the free-text car model. The money/price concept was
-- removed from the app, so `price` stays at 0 for new rides.
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.rides
  add column if not exists vehicle_type text not null default '4-wheeler';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rides_vehicle_type_check') then
    alter table public.rides
      add constraint rides_vehicle_type_check check (vehicle_type in ('2-wheeler', '4-wheeler'));
  end if;
end $$;

-- price is no longer collected — default it so inserts don't need it
alter table public.rides alter column price set default 0;
