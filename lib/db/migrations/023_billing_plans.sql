-- Migration 023: Normalize billing plans
-- Aligns plan names with new 4-tier structure (starter, essencial, professional, enterprise)

-- Map legacy 'basic' plan to 'starter'
UPDATE organizations SET subscription_plan = 'starter' WHERE subscription_plan = 'basic';
