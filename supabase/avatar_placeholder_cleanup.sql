-- ============================================================
-- CACommute — clear stock placeholder avatars.
--
-- Rides published before this fix stored a hardcoded Unsplash portrait in
-- driver_avatar whenever the driver had no photo of their own, so a stranger's
-- face appeared above their name. Real uploads live in the Supabase `avatars`
-- bucket, so any avatar still pointing at Unsplash is that old placeholder.
--
-- Blanking the column is all that's needed: driver_avatar is `not null
-- default ''`, and the app renders a neutral silhouette for an empty value.
--
-- Safe to re-run.
-- ============================================================

-- Rides: the denormalized copy of the driver's photo.
update public.rides
   set driver_avatar = ''
 where driver_avatar ilike '%images.unsplash.com%';

-- Profiles: in case a placeholder was ever persisted as a real avatar.
update public.profiles
   set avatar_url = null
 where avatar_url ilike '%images.unsplash.com%';

-- Verify — both should return 0.
-- select count(*) from public.rides    where driver_avatar ilike '%unsplash%';
-- select count(*) from public.profiles where avatar_url    ilike '%unsplash%';
