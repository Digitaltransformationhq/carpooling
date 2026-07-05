-- ============================================================
-- CACommute — secure, zero-touch admin setup.
-- Admin rights are granted ONLY by this database allowlist — the app
-- (client code) can never make anyone an admin. Only the email(s) listed
-- in is_admin_email() can ever be admin; everyone else is a normal user.
--
-- The admin signs in with "Continue with Google" using the allowlisted
-- Gmail (only the owner of that Google account can do this), and the
-- profile is automatically granted is_admin = true.
-- No manual user creation. Run ONCE in Supabase → SQL Editor.
-- (Run after profiles.sql and events.sql.) Idempotent.
--
-- To add/change admins: edit the email list in is_admin_email() below.
-- ============================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- ---------- the admin allowlist (edit emails here) ----------
create or replace function public.is_admin_email(p_email text)
returns boolean language sql immutable as $$
  select lower(coalesce(p_email, '')) in (
    'digitaltransformationhq@gmail.com'
  );
$$;

-- (No auto-confirm trigger on purpose: confirming the admin email
--  automatically would let someone activate a password signup of that
--  email. Google sign-in proves ownership of the Gmail instead.)
drop trigger if exists trg_auth_autoconfirm_admin on auth.users;
drop function if exists public.auth_autoconfirm_admin();

-- ---------- auto-grant is_admin on the profile ----------
create or replace function public.profiles_grant_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin_email(new.email) then
    new.is_admin := true;
  end if;
  return new;
end; $$;

drop trigger if exists trg_profiles_grant_admin on public.profiles;
create trigger trg_profiles_grant_admin
  before insert or update of email on public.profiles
  for each row execute function public.profiles_grant_admin();

-- ---------- backfill: grant admin to allowlisted profiles, revoke from others ----------
update public.profiles set is_admin = true
  where public.is_admin_email(email) and is_admin = false;
update public.profiles set is_admin = false
  where not public.is_admin_email(email) and is_admin = true;

-- ---------- events: only admins may write (if events table exists) ----------
do $$ begin
  if to_regclass('public.events') is not null then
    drop policy if exists "events write authenticated" on public.events;
    drop policy if exists "events write admin" on public.events;
    create policy "events write admin" on public.events for all
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
  end if;
end $$;
