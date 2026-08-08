-- Client Portal: storage buckets for client photos + job images
-- Buckets are created idempotently (INSERT ... ON CONFLICT DO NOTHING).
-- Uploads/deletes go through API routes using the service-role key (bypasses RLS),
-- public=true gives public read access for <img> tags.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('client-photos', 'client-photos', true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('job-images',    'job-images',    true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
