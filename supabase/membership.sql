-- ============================================================
-- RideShare — CA membership ID on profiles.
-- Collected by the "complete your profile" form shown after a
-- member's first sign-in (esp. Google login).
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.profiles add column if not exists membership_id text;

-- A membership ID identifies one CA — keep it unique (nulls allowed).
create unique index if not exists profiles_membership_id_key
  on public.profiles (membership_id)
  where membership_id is not null;
