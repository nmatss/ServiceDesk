-- Migration: 022_billing_stripe_columns
-- Description: Add Stripe billing columns to organizations table
-- Date: 2026-03-15

-- Add Stripe customer ID for linking organizations to Stripe customers
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Add Stripe subscription ID for tracking active subscriptions
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

-- Index for quick lookups by Stripe IDs
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription ON organizations(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
