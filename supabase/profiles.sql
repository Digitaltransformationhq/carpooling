-- ============================================================
-- CACommute — public.profiles table synced from Supabase Auth
-- Run this ONCE in Supabase: SQL Editor → paste → Run.
-- (Safe/idempotent — re-running won't duplicate data and will
--  add any new columns/policies.)
--
-- Why: Supabase Auth keeps accounts in `auth.users` (schema "auth"),
-- which the Table Editor hides by default. This creates a visible,
-- editable `public.profiles` row for every user, kept in sync.
-- ============================================================

-- ---------- profiles table ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  bio         text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- add columns if the table already existed from an earlier run
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists bio        text;
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles enable row level security;

-- ---------- RLS policies ----------
drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles insert own"  on public.profiles for insert
  with check (auth.uid() = id);
create policy "profiles update own"  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- auto-create a profile when a user signs up ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Email/password signups send 'full_name'; Google OAuth sends 'name' +
  -- 'picture'. coalesce() picks whichever the provider supplied.
  insert into public.profiles (id, full_name, email, phone, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- backfill any users who signed up before this ran ----------
insert into public.profiles (id, full_name, email)
select id, raw_user_meta_data->>'full_name', email
from auth.users
on conflict (id) do nothing;
