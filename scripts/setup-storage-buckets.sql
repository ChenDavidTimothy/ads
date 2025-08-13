-- Setup Storage Buckets and Policies
-- Run this script in your Supabase SQL editor

-- Create buckets if they don't exist
-- Note: Buckets must be created through the Supabase dashboard or API
-- This script only sets up the policies

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "images_select_own" ON storage.objects;
DROP POLICY IF EXISTS "images_write_own" ON storage.objects;
DROP POLICY IF EXISTS "images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "images_delete_own" ON storage.objects;

DROP POLICY IF EXISTS "videos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "videos_write_own" ON storage.objects;
DROP POLICY IF EXISTS "videos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "videos_delete_own" ON storage.objects;

-- Images Bucket Policies
create policy "images_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'images'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "images_write_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'images'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "images_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'images'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "images_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'images'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Videos Bucket Policies
create policy "videos_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'videos'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "videos_write_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'videos'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "videos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'videos'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "videos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'videos'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Optional: Create public read policies if you want images/videos to be publicly accessible
-- Uncomment the following if you need public access:

-- create policy "images_select_public"
-- on storage.objects for select to public
-- using (bucket_id = 'images');

-- create policy "videos_select_public"
-- on storage.objects for select to public
-- using (bucket_id = 'videos');
