-- ============================================================
-- CACommute — hide a member from the Peer Connect directory.
--
-- An admin can delist a member (duplicate account, spam signup, someone who
-- asked not to be listed). The member keeps everything else: their account,
-- rides, bookings and points are untouched and they can keep using the app.
-- Fully reversible — the same call restores them.
--
-- Run in Supabase → SQL Editor, AFTER admin_permissions.sql (it uses the
-- is_admin() helper defined there). Idempotent.
--
--
-- SCOPE — this is a LISTING filter, not a security boundary.
--
-- Hidden members are removed from the directory query in searchProfiles().
-- The RLS read policy is deliberately left alone, because "profiles read
-- authenticated" is also how a rider fetches their DRIVER's phone number for
-- the call button on a ride (fetchProfile in RideDetails). Hiding profiles at
-- the RLS layer would silently break that for a delisted member's rides,
-- which is not what delisting is meant to do.
--
-- Note also that every signed-in member can already read every profile by
-- design — that is the existing posture, unchanged here. So delisting curates
-- who appears in the directory; it does not make the row unreadable to
-- someone crafting their own query. If you ever want the stricter version,
-- add to the "profiles read authenticated" policy:
--
--     and (not directory_hidden or id = auth.uid() or public.is_admin())
--
-- ...and move the driver-phone lookup to a narrow SECURITY DEFINER RPC first,
-- or the call button breaks.
-- ============================================================


-- ------------------------------------------------------------
-- 1. The flag
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists directory_hidden boolean not null default false;

-- No grant is needed (or wanted) for this column. security.sql revokes
-- UPDATE on profiles from `authenticated` and grants back only
-- (full_name, phone, bio, avatar_url, membership_id), so directory_hidden is
-- unwritable from the browser by anyone — including an admin, who is still
-- just the `authenticated` role. It can only change through the RPC below.
-- That is what stops a delisted member from quietly restoring themselves.


-- ------------------------------------------------------------
-- 2. The admin action
-- ------------------------------------------------------------
-- SECURITY DEFINER so it can write a column the caller has no grant on, but
-- it re-checks is_admin() first — same shape as accept_booking().
create or replace function public.set_member_visibility(p_user_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change directory visibility';
  end if;

  if p_user_id is null then
    raise exception 'No member specified';
  end if;

  update public.profiles
     set directory_hidden = coalesce(p_hidden, false)
   where id = p_user_id;

  if not found then
    raise exception 'Member not found';
  end if;
end; $$;

revoke execute on function public.set_member_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_member_visibility(uuid, boolean) to authenticated;


-- ------------------------------------------------------------
-- 3. Verify
-- ------------------------------------------------------------
-- Who is currently delisted:
--     select id, full_name, email, directory_hidden
--       from public.profiles where directory_hidden;
--
-- A non-admin calling it must fail with
-- "Only an admin can change directory visibility":
--     select public.set_member_visibility('<some-uuid>', true);
--
-- Restore everyone (undo):
--     update public.profiles set directory_hidden = false where directory_hidden;
-- ============================================================
