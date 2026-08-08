-- Mechanic + User (profile) photos
-- Adds image_path to mechanic_list, plus storage buckets for mechanic photos
-- and user avatars. Buckets created idempotently (ON CONFLICT DO NOTHING),
-- uploads/deletes go through API routes using service-role key, public=true
-- gives public read access for <img> tags.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mechanic_list' AND column_name = 'image_path'
  ) THEN
    ALTER TABLE mechanic_list ADD COLUMN image_path TEXT DEFAULT NULL;
  END IF;
END $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('mechanic-photos', 'mechanic-photos', true, 1048576, array['image/jpeg','image/png','image/webp']),
  ('user-avatars',    'user-avatars',    true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
