-- ========================================
-- Migration 001: Initial Schema
-- Description: Creates core ServiceDesk tables (foundation)
-- Author: Migration System
-- Date: 2025-10-18
-- Database: PostgreSQL 14+
-- ========================================

-- This migration creates the foundational tables
-- Enterprise features are added in subsequent migrations

BEGIN;

-- Load the complete schema
-- In production, this would be split into multiple migrations
-- For initial setup, we load everything at once

\i lib/db/schema.postgres.sql

-- Migration metadata
INSERT INTO system_settings (key, value, description, type, is_public)
VALUES
    ('schema_version', '1', 'Current database schema version', 'number', FALSE),
    ('migration_date', CURRENT_TIMESTAMP::TEXT, 'Last migration date', 'string', FALSE),
    ('database_type', 'postgresql', 'Database engine type', 'string', FALSE)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- Migration complete
-- Next: Run seed data with npm run db:seed
