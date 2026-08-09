-- Product images: storage bucket for product photos.
-- image_path column already exists on product_list.
-- Buckets are created idempotently (INSERT ... ON CONFLICT DO NOTHING).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
