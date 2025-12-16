-- Migration 018: Fix all missing columns causing runtime errors
-- This migration adds all missing columns referenced in queries
-- Created: 2025-12-14
--
-- Fixes the following errors:
-- 1. Missing tenant_id columns on various tables
-- 2. Missing updated_at column on rate_limits table
-- 3. Missing first_response_at, is_violated, resolved_at on sla_tracking
-- 4. Missing is_final column on statuses

-- ========================================
-- STEP 1: FIX RATE_LIMITS TABLE
-- ========================================
-- The rate_limits table has conflicting schemas between schema.sql and lib/rate-limit/index.ts
-- We'll add all columns needed by both

-- First, check if rate_limits exists and add missing columns
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle errors gracefully

-- Add updated_at column if missing
ALTER TABLE rate_limits ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Add key column if missing (used by lib/rate-limit/index.ts)
ALTER TABLE rate_limits ADD COLUMN key TEXT;

-- Add count column if missing
ALTER TABLE rate_limits ADD COLUMN count INTEGER DEFAULT 1;

-- Add reset_time column if missing
ALTER TABLE rate_limits ADD COLUMN reset_time DATETIME;

-- Add created_at column if missing
ALTER TABLE rate_limits ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- ========================================
-- STEP 2: FIX SLA_TRACKING TABLE
-- ========================================
-- Add columns used in queries but missing from schema

-- first_response_at - When first response was made
ALTER TABLE sla_tracking ADD COLUMN first_response_at DATETIME;

-- resolved_at - When ticket was resolved (for SLA calculation)
ALTER TABLE sla_tracking ADD COLUMN resolved_at DATETIME;

-- is_violated - Whether SLA was violated (alternative to response_met/resolution_met)
ALTER TABLE sla_tracking ADD COLUMN is_violated BOOLEAN DEFAULT 0;

-- response_breached - Whether response time was breached
ALTER TABLE sla_tracking ADD COLUMN response_breached BOOLEAN DEFAULT 0;

-- resolution_breached - Whether resolution time was breached
ALTER TABLE sla_tracking ADD COLUMN resolution_breached BOOLEAN DEFAULT 0;

-- ========================================
-- STEP 3: FIX STATUSES TABLE
-- ========================================
-- Add is_final column if missing (used in many queries)
ALTER TABLE statuses ADD COLUMN is_final BOOLEAN DEFAULT 0;

-- Update is_final for closed/resolved statuses
UPDATE statuses SET is_final = 1 WHERE name IN ('resolved', 'closed', 'cancelled', 'Resolvido', 'Fechado');

-- ========================================
-- STEP 4: ADD TENANT_ID TO ALL TABLES
-- ========================================
-- These are needed for multi-tenant queries

-- Users table
ALTER TABLE users ADD COLUMN tenant_id INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1;

-- Categories table
ALTER TABLE categories ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- Priorities table
ALTER TABLE priorities ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- Statuses table
ALTER TABLE statuses ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- Tickets table
ALTER TABLE tickets ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- Comments table
ALTER TABLE comments ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- Attachments table
ALTER TABLE attachments ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- SLA policies table
ALTER TABLE sla_policies ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- SLA tracking table
ALTER TABLE sla_tracking ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- Notifications table
ALTER TABLE notifications ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- KB articles table
ALTER TABLE kb_articles ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- KB categories table
ALTER TABLE kb_categories ADD COLUMN tenant_id INTEGER DEFAULT 1;

-- ========================================
-- STEP 5: CREATE TENANTS TABLE IF NOT EXISTS
-- ========================================
CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT UNIQUE,
    subdomain TEXT UNIQUE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3B82F6',
    secondary_color TEXT DEFAULT '#1F2937',
    subscription_plan TEXT NOT NULL DEFAULT 'basic',
    max_users INTEGER DEFAULT 50,
    max_tickets_per_month INTEGER DEFAULT 1000,
    features TEXT,
    settings TEXT,
    billing_email TEXT,
    technical_contact_email TEXT,
    is_active BOOLEAN DEFAULT 1,
    trial_ends_at DATETIME,
    subscription_ends_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default tenant if not exists
INSERT OR IGNORE INTO tenants (id, name, slug, subscription_plan, is_active)
VALUES (1, 'Default Organization', 'default', 'enterprise', 1);

-- ========================================
-- STEP 6: CREATE SATISFACTION_SURVEYS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- STEP 7: CREATE INDEXES FOR NEW COLUMNS
-- ========================================
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_priorities_tenant_id ON priorities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statuses_tenant_id ON statuses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_first_response ON sla_tracking(first_response_at);
CREATE INDEX IF NOT EXISTS idx_statuses_is_final ON statuses(is_final);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_time);

-- ========================================
-- STEP 8: UPDATE EXISTING DATA
-- ========================================
-- Set tenant_id = 1 for all existing records that have NULL
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE tickets SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE categories SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE priorities SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE statuses SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE comments SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE attachments SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE sla_policies SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE sla_tracking SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE notifications SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE kb_articles SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE kb_categories SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Update is_violated based on response_met and resolution_met
UPDATE sla_tracking
SET is_violated = CASE WHEN response_met = 0 OR resolution_met = 0 THEN 1 ELSE 0 END
WHERE is_violated IS NULL;

-- Set first_response_at from comments if not set
UPDATE sla_tracking
SET first_response_at = (
    SELECT MIN(c.created_at)
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = sla_tracking.ticket_id
    AND u.role IN ('admin', 'agent')
)
WHERE first_response_at IS NULL;

-- Set resolved_at from tickets if not set
UPDATE sla_tracking
SET resolved_at = (
    SELECT t.resolved_at
    FROM tickets t
    WHERE t.id = sla_tracking.ticket_id
)
WHERE resolved_at IS NULL;
