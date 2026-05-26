-- supabase/migrations/20260526_plans.sql
-- Add subscription / plan columns to profiles table.
-- Run in Supabase Dashboard: SQL Editor -> New query -> paste & run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan                   text        NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_ends_at          timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status    text        DEFAULT 'trialing';

-- Index: Stripe webhook needs fast lookup by stripe_customer_id.
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Constraint: plan must be a known value.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS chk_plan_values;

ALTER TABLE profiles
  ADD CONSTRAINT chk_plan_values
  CHECK (plan IN ('free', 'standard', 'premium'));

-- Documentation
COMMENT ON COLUMN profiles.plan IS 'free | standard | premium';
COMMENT ON COLUMN profiles.trial_ends_at IS 'UTC timestamp when 14-day trial ends (null = derive from created_at)';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID (cus_...)';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe subscription ID (sub_...)';
COMMENT ON COLUMN profiles.subscription_status IS 'trialing | active | past_due | canceled | paused';
