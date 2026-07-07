-- ============================================================
-- CACommute — capture where a rider wants to be picked up / dropped.
-- For "hop in along the way" rides: the driver needs to know the
-- exact pickup point on their route, not just the seat count.
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.bookings add column if not exists pickup_label text;
alter table public.bookings add column if not exists pickup_lat   double precision;
alter table public.bookings add column if not exists pickup_lng   double precision;
alter table public.bookings add column if not exists drop_label   text;
alter table public.bookings add column if not exists drop_lat     double precision;
alter table public.bookings add column if not exists drop_lng     double precision;
