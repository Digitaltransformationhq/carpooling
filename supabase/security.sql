-- ============================================================
-- RideShare — security hardening.
-- Closes real, exploitable holes WITHOUT changing app behaviour:
--   1. Privilege escalation: any logged-in user could set is_admin=true
--      on their own profile (RLS "update own" allowed it). FIXED.
--   2. Reward fraud: a user could set their own points to any value. FIXED.
--   3. PII exposure: ALL profiles (incl. email + phone) were world-readable
--      by anonymous clients via the public anon key. Now members-only.
--   4. Ride forgery: anyone could insert rides for any/!no user. Now you
--      can only create rides as yourself.
--   5. Avatar tampering: any user could overwrite ANY user's avatar object.
--      Now you can only write files under your own folder.
-- Run ONCE in Supabase → SQL Editor (after the other migrations). Idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 1 + 2 + 3 : profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

-- Read: members only (was world-readable). Driver names shown on rides come
-- from the rides table, so anonymous browsing of rides still works.
drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles read authenticated" on public.profiles;
create policy "profiles read authenticated" on public.profiles
  for select using (auth.uid() is not null);

-- Keep "own row" write policies (from profiles.sql), but ALSO restrict WHICH
-- columns a client may write — so is_admin / points / email can never be set
-- from the browser. The reward triggers + admin allowlist run as SECURITY
-- DEFINER (table owner) and are unaffected, so all real features keep working.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, full_name, phone, bio, avatar_url, membership_id)
  on public.profiles to authenticated;
grant update (full_name, phone, bio, avatar_url, membership_id)
  on public.profiles to authenticated;

-- ------------------------------------------------------------
-- 4 : rides — you may only publish rides as yourself
-- ------------------------------------------------------------
alter table public.rides enable row level security;

-- read stays public (home / search browse rides without logging in)
drop policy if exists "rides public read" on public.rides;
create policy "rides public read" on public.rides for select using (true);

-- insert was "with check (true)" (anyone, any user_id). Lock to the author.
drop policy if exists "rides public insert" on public.rides;
drop policy if exists "rides insert own" on public.rides;
create policy "rides insert own" on public.rides
  for insert with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- bookings : drop any leftover wide-open policies from schema.sql.
-- (The secure policies live in bookings.sql / booking_requests.sql:
--  read own-or-driver, insert pending-as-self, delete own-or-driver.)
-- ------------------------------------------------------------
drop policy if exists "bookings public read"   on public.bookings;
drop policy if exists "bookings public insert" on public.bookings;

-- ------------------------------------------------------------
-- 5 : storage — avatars may only be written inside your own folder
--     (the app uploads to "<user_id>/avatar").
-- ------------------------------------------------------------
drop policy if exists "avatars auth insert" on storage.objects;
create policy "avatars auth insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars auth update" on storage.objects;
create policy "avatars auth update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- let users delete their own avatar file too
drop policy if exists "avatars auth delete" on storage.objects;
create policy "avatars auth delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- only allow real images, capped at 5 MB (stops arbitrary-file/abuse uploads)
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png','image/jpeg','image/jpg','image/webp','image/gif']
 where id = 'avatars';
