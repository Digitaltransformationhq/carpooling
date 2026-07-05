-- ============================================================
-- CACommute — remove all dummy/seed/test data.
-- Run ONCE in Supabase → SQL Editor.
-- Deletes every ride that has NO owner (the seeded demo rides and
-- any anonymous test rides). Rides you published while logged in
-- have a user_id and are KEPT. Bookings cascade automatically.
-- ============================================================

delete from public.rides where user_id is null;

-- (optional) also clear any orphaned bookings, just in case
delete from public.bookings
where ride_id not in (select id from public.rides);
