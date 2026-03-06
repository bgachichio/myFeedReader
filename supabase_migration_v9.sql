-- myFeedReader Migration v9: Plan / Paywall
-- Run in: Supabase Dashboard → SQL Editor

-- Add plan columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan                       text NOT NULL DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_source                text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at            timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_started_at            timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_customer_code     text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_subscription_code text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_email_token       text;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free','pro'));

CREATE INDEX IF NOT EXISTS idx_profiles_paystack_customer ON profiles (paystack_customer_code) WHERE paystack_customer_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires ON profiles (plan_expires_at) WHERE plan_expires_at IS NOT NULL;

UPDATE profiles SET plan = 'free' WHERE plan IS NULL OR plan = '';
