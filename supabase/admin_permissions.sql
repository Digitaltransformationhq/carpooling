-- ============================================================
-- CACommute — admin operational permissions.
--
-- Grants the admin (the allowlist in admin_auto.sql → is_admin_email) the
-- three support powers the /admin page needs:
--
--   1. edit an event     — already permitted by "events write admin"; this
--                          file only restates that rule via the new helper
--   2. remove ANY ride   — spam, duplicates, abandoned trips
--   3. read ANY booking  — answering "who is on this trip?"
--
-- Deliberately NOT granted (see NOTES at the bottom):
--   • adjusting reward points
--   • promoting another admin
--
-- Every policy here is ADDED ALONGSIDE the existing owner-scoped ones.
-- Postgres OR's permissive policies, so members' own rights are unchanged:
-- a normal user still sees and touches exactly what they did before.
--
-- Run in Supabase → SQL Editor, AFTER admin_auto.sql. Idempotent.
-- ============================================================


-- ------------------------------------------------------------
-- 1. The admin test, as a reusable function
-- ------------------------------------------------------------
-- Existing policies inline `exists (select 1 from profiles p where ...)`.
-- That is fine on other tables, but the same clause in a policy ON profiles
-- recurses — evaluating the policy re-queries the table the policy protects,
-- and Postgres raises:
--     infinite recursion detected in policy for relation "profiles"
-- SECURITY DEFINER runs the lookup as the function owner, bypassing RLS and
-- breaking the loop. Every future admin policy should use this.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Callable by anyone signed in or not: it only ever reports the CALLER's own
-- status (false when logged out), so it leaks nothing. It must stay callable
-- by anon, because an anonymous read of a table whose policy calls it would
-- otherwise fail with "permission denied for function" instead of simply
-- matching no rows.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;


-- ------------------------------------------------------------
-- 2. Events — create / edit / delete  (permission #1)
-- ------------------------------------------------------------
-- Unchanged in effect; restated through is_admin(). "events public read"
-- still gives everyone SELECT, since permissive policies are OR'd.
drop policy if exists "events write authenticated" on public.events;
drop policy if exists "events write admin" on public.events;
create policy "events write admin" on public.events for all
  using (public.is_admin())
  with check (public.is_admin());


-- ------------------------------------------------------------
-- 3. Rides — an admin may remove any ride  (permission #2)
-- ------------------------------------------------------------
-- Sits next to "rides delete own"; drivers keep deleting their own rides.
--
-- Safe with respect to rewards: trg_rides_delete_points already fires on
-- DELETE, keeping the points for a ride that genuinely happened and setting
-- the txn-local flag that lets the ride's bookings cascade past the
-- completed-ride freeze (rewards_completion.sql). Nothing extra is needed.
--
-- Note this grants DELETE only. Admins deliberately cannot rewrite someone
-- else's route or departure time: security_integrity.sql revokes UPDATE on
-- rides and grants back only (driver_name, driver_avatar, started, completed,
-- route_geom) at the column level, and trg_rides_pin_driver re-pins the
-- driver identity from the author's profile on every write.
drop policy if exists "rides delete admin" on public.rides;
create policy "rides delete admin" on public.rides for delete
  using (public.is_admin());


-- ------------------------------------------------------------
-- 4. Bookings — an admin may read any booking  (permission #3)
-- ------------------------------------------------------------
-- Sits next to "bookings read own or driver".
-- This exposes passenger_name / passenger_phone to the admin, which is the
-- point (support), but it IS personal data — grant it knowingly.
drop policy if exists "bookings read admin" on public.bookings;
create policy "bookings read admin" on public.bookings for select
  using (public.is_admin());


-- ------------------------------------------------------------
-- 5. Verify
-- ------------------------------------------------------------
-- Run while signed in as the admin — expect true:
--     select public.is_admin();
--
-- Expect the admin policies to be listed:
--     select tablename, policyname, cmd
--       from pg_policies
--      where schemaname = 'public'
--        and policyname in ('events write admin', 'rides delete admin',
--                           'bookings read admin')
--      order by tablename;
--
-- Expect a row count greater than your own bookings (admin sees all):
--     select count(*) from public.bookings;


-- ============================================================
-- NOTES — what is intentionally still off-limits
--
-- • Reward points. `points` is not in the column-level grant list in
--   security.sql, and is settled only by ride_settle_points() through the
--   completion triggers. Opening it to hand-editing would desynchronise the
--   award/revoke arithmetic and re-open point farming. If you need manual
--   correction, add a SECURITY DEFINER RPC that goes through
--   ride_settle_points rather than writing the column.
--
-- • Promoting admins. is_admin is granted ONLY by is_admin_email() in
--   admin_auto.sql and is absent from the client's writable columns, so a
--   stolen session cannot mint another admin. Keeping that in SQL is what
--   makes escalation impossible — add new admins by editing the allowlist
--   and re-running admin_auto.sql.
--
-- • Removing a rider from someone else's ride. Not granted; if you want it,
--   add a matching "bookings delete admin" policy for DELETE. Be aware the
--   completed-ride freeze will (correctly) still block it on a completed
--   ride.
-- ============================================================
