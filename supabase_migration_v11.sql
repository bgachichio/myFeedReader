-- Migration v11: saved_articles table for Save-from-Anywhere
-- Run in: Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS saved_articles (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url              text NOT NULL,
  title            text,
  excerpt          text,
  full_text        text,
  author           text,
  cover_image_url  text,
  published_at     timestamptz,
  fetched_at       timestamptz,
  reading_time_min int,
  is_read          boolean DEFAULT false,
  is_archived      boolean DEFAULT false,
  source           text DEFAULT 'manual',
  created_at       timestamptz DEFAULT now(),
  UNIQUE(user_id, url)
);

ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved articles"
  ON saved_articles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS saved_articles_user_idx     ON saved_articles(user_id);
CREATE INDEX IF NOT EXISTS saved_articles_created_idx  ON saved_articles(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_articles_unread_idx   ON saved_articles(user_id, is_read) WHERE is_read = false;
