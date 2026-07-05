-- ============================================================
-- CACommute — CA membership ID on profiles.
-- Collected by the "complete your profile" form shown after a
-- member's first sign-in (esp. Google login).
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

alter table public.profiles add column if not exists membership_id text;

-- A membership ID identifies one CA — keep it unique (nulls allowed).
create unique index if not exists profiles_membership_id_key
  on public.profiles (membership_id)
  where membership_id is not null;

-- ------------------------------------------------------------
-- IMPORTANT: security.sql locks profile writes down to a column
-- allow-list (revokes blanket insert/update, then grants only
-- specific columns). A column that isn't granted is DENIED — so if
-- security.sql ran before this column existed, saving a Membership
-- ID fails with "permission denied for column membership_id".
-- Granting it here makes this file a complete, standalone fix.
-- ------------------------------------------------------------
grant insert (membership_id) on public.profiles to authenticated;
grant update (membership_id) on public.profiles to authenticated;
