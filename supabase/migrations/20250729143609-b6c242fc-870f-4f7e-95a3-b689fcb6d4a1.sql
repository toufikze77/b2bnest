-- Add image_url column to social_posts table for photo uploads
ALTER TABLE public.social_posts 
ADD COLUMN image_url TEXT;