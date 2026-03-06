-- Migration v11: Add font_size preference to profiles
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS font_size text DEFAULT 'md';

-- Backfill existing rows
UPDATE profiles SET font_size = 'md' WHERE font_size IS NULL;

NOTIFY pgrst, 'reload schema';
