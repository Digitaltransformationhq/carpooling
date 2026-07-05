-- ============================================================
-- CACommute — Storage bucket for profile photos.
-- Run ONCE in Supabase SQL Editor. Idempotent.
-- ============================================================

-- public bucket so avatar URLs are viewable
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- anyone can view avatars
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- signed-in users can upload / replace their avatar
drop policy if exists "avatars auth insert" on storage.objects;
create policy "avatars auth insert" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid() is not null);

drop policy if exists "avatars auth update" on storage.objects;
create policy "avatars auth update" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid() is not null);
