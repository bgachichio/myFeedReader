-- Run this in your Supabase SQL Editor
-- Go to: Dashboard → SQL Editor → New query → paste and run

-- Feeds table (user's RSS sources)
create table if not exists feeds (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  url text not null,
  title text not null,
  category text default 'General',
  feed_type text default 'rss',
  created_at timestamptz default now()
);

-- Articles table (cached feed items)
create table if not exists articles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  feed_id uuid references feeds(id) on delete cascade not null,
  guid text not null,
  title text not null,
  link text,
  description text,
  author text,
  pub_date timestamptz,
  category text default 'General',
  is_read boolean default false,
  is_bookmarked boolean default false,
  created_at timestamptz default now(),
  unique(user_id, guid)
);

-- Enable Row Level Security
alter table feeds enable row level security;
alter table articles enable row level security;

-- RLS Policies: users can only see/edit their own data
create policy "Users can manage their own feeds"
  on feeds for all
  using (auth.uid() = user_id);

create policy "Users can manage their own articles"
  on articles for all
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists articles_user_id_idx on articles(user_id);
create index if not exists articles_pub_date_idx on articles(pub_date desc);
create index if not exists articles_category_idx on articles(category);
create index if not exists feeds_user_id_idx on feeds(user_id);
