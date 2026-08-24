-- Fix: naya product add karte samay 23502 error
-- "null value in column \"image_path\" of relation \"product_list\" violates not-null constraint"
-- MariaDB restore ke baad image_path NOT NULL ban gaya tha; design me ye nullable hai
-- (product-image API remove par image_path = null set karta hai).
--
-- Supabase Dashboard -> SQL Editor me ye run karein:

ALTER TABLE public.product_list ALTER COLUMN image_path DROP NOT NULL;
