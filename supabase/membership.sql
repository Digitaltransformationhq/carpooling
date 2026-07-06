-- ============================================================
-- CACommute — CA membership ID on profiles.
-- Collected by the "complete your profile" form shown after a
-- member's first sign-in (esp. Google login).
-- Run ONCE in Supabase → SQL Editor. Idempotent.
-- ============================================================

-- Ensure every client-writable column exists BEFORE granting on it —
-- a GRANT that names a missing column errors and aborts the script,
-- which is how writes ended up fully revoked in the first place.
alter table public.profiles add column if not exists full_name     text;
alter table public.profiles add column if not exists phone         text;
alter table public.profiles add column if not exists bio           text;
alter table public.profiles add column if not exists avatar_url    text;
alter table public.profiles add column if not exists membership_id text;

-- A membership ID identifies one CA — keep it unique (nulls allowed).
create unique index if not exists profiles_membership_id_key
  on public.profiles (membership_id)
  where membership_id is not null;

-- ------------------------------------------------------------
-- IMPORTANT — this is the fix for "Could not save profile".
--
-- security.sql locks profile writes to a column allow-list: it
-- REVOKES blanket insert/update, then GRANTs only specific columns.
-- But granting a column that doesn't exist yet raises an error and
-- aborts the rest of that script — so if security.sql ran BEFORE the
-- membership_id column existed, the revoke landed but the grants did
-- NOT, leaving the browser role unable to write ANY profile column.
--
-- Re-granting the full profile-write column set here (idempotent)
-- makes this file a complete, standalone fix: run it once and profile
-- saving works regardless of what state security.sql left behind.
-- The reward/points columns stay ungranted on purpose (server-only).
-- ------------------------------------------------------------
grant insert (id, full_name, phone, bio, avatar_url, membership_id)
  on public.profiles to authenticated;
grant update (full_name, phone, bio, avatar_url, membership_id)
  on public.profiles to authenticated;

-- Nudge PostgREST to refresh its schema cache immediately (otherwise a
-- freshly added column can 404 for up to a minute).
notify pgrst, 'reload schema';
