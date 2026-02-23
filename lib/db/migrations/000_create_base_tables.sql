-- ========================================
-- Migration 000: Create Base Tables
-- ========================================
-- Description: Creates foundational tables that other migrations depend on
-- Author: Migration System
-- Date: 2025-12-13
-- Priority: CRITICAL - Must run FIRST
-- ========================================

-- This migration creates tables that are referenced by later migrations
-- but were previously only defined in schema.sql

BEGIN TRANSACTION;

-- ========================================
-- ORGANIZATIONS TABLE
-- ========================================
-- Required by: 002-005, 008, 012-013
-- Multi-tenant organization management

CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT, -- Primary domain for this org
    settings TEXT, -- JSON org-specific settings
    subscription_plan TEXT DEFAULT 'basic', -- 'basic', 'professional', 'enterprise'
    subscription_status TEXT DEFAULT 'active', -- 'active', 'cancelled', 'suspended'
    subscription_expires_at DATETIME,
    max_users INTEGER DEFAULT 50,
    max_tickets_per_month INTEGER DEFAULT 1000,
    features TEXT, -- JSON array of enabled features
    billing_email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default organization for existing data
INSERT OR IGNORE INTO organizations (id, name, slug, domain, subscription_plan, max_users, max_tickets_per_month)
VALUES (1, 'Default Organization', 'default', NULL, 'enterprise', 999999, 999999);

-- Indexes for organizations
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active) WHERE is_active = TRUE;

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_organizations_timestamp
AFTER UPDATE ON organizations
FOR EACH ROW
BEGIN
    UPDATE organizations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ========================================
-- WORKFLOWS TABLE (Base)
-- ========================================
-- Required by: 012_add_organization_id.sql, 015_workflow_persistence_columns.sql

CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- 'ticket_created', 'ticket_updated', 'manual', 'scheduled'
    trigger_conditions TEXT, -- JSON conditions
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- WORKFLOW_DEFINITIONS TABLE
-- ========================================
-- Advanced workflow definitions with full configuration

CREATE TABLE IF NOT EXISTS workflow_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_event TEXT NOT NULL, -- 'ticket.created', 'ticket.updated', 'sla.warning', etc.
    trigger_conditions TEXT NOT NULL, -- JSON
    steps TEXT NOT NULL, -- JSON array of workflow steps
    error_handling TEXT, -- JSON error handling config
    timeout_minutes INTEGER DEFAULT 60,
    max_retries INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- WORKFLOW_EXECUTIONS TABLE
-- ========================================
-- Tracks individual workflow runs
-- Required by: 015_workflow_persistence_columns.sql

CREATE TABLE IF NOT EXISTS workflow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    trigger_entity_type TEXT NOT NULL, -- 'ticket', 'user', 'system'
    trigger_entity_id INTEGER,
    trigger_user_id INTEGER,
    trigger_data TEXT, -- JSON data that triggered the workflow
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
    current_step_id INTEGER,
    progress_percentage INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT,
    execution_log TEXT, -- JSON log of all steps
    retry_count INTEGER DEFAULT 0,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (trigger_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- WORKFLOW_STEP_EXECUTIONS TABLE
-- ========================================
-- Tracks individual step executions within a workflow
-- Required by: 015_workflow_persistence_columns.sql

CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    step_type TEXT NOT NULL, -- 'action', 'condition', 'delay', 'approval'
    step_config TEXT, -- JSON configuration
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    input_data TEXT, -- JSON input
    output_data TEXT, -- JSON output
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    duration_ms INTEGER,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

-- ========================================
-- WORKFLOW INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active ON workflow_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_trigger ON workflow_definitions(trigger_event);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_by ON workflow_definitions(created_by);

-- These will be enhanced by 015_workflow_persistence_columns.sql
-- CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
-- CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- ========================================
-- WORKFLOW TRIGGERS
-- ========================================

CREATE TRIGGER IF NOT EXISTS update_workflows_timestamp
AFTER UPDATE ON workflows
FOR EACH ROW
BEGIN
    UPDATE workflows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_workflow_definitions_timestamp
AFTER UPDATE ON workflow_definitions
FOR EACH ROW
BEGIN
    UPDATE workflow_definitions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ========================================
-- KB_ARTICLES TABLE (if not exists)
-- ========================================
-- Knowledge base articles foundation
-- Required by: 004_add_organization_id_kb.sql, 010_kb_collaboration.sql

CREATE TABLE IF NOT EXISTS kb_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category_id INTEGER,
    author_id INTEGER NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    featured BOOLEAN DEFAULT FALSE,
    search_keywords TEXT, -- Space-separated for FTS
    published_at DATETIME,
    last_reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_author ON kb_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON kb_articles(published_at);

CREATE TRIGGER IF NOT EXISTS update_kb_articles_timestamp
AFTER UPDATE ON kb_articles
FOR EACH ROW
BEGIN
    UPDATE kb_articles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ========================================
-- TEMPLATES TABLE
-- ========================================
-- Required by: 012_add_organization_id.sql

CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ticket', 'email', 'sms', 'notification')),
    subject TEXT,
    content TEXT NOT NULL,
    variables TEXT, -- JSON array of variable names
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);

CREATE TRIGGER IF NOT EXISTS update_templates_timestamp
AFTER UPDATE ON templates
FOR EACH ROW
BEGIN
    UPDATE templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ========================================
-- USER_SESSIONS TABLE
-- ========================================
-- Required by: 012_add_organization_id.sql

CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);

-- ========================================
-- NOTIFICATION_EVENTS TABLE
-- ========================================
-- Required by: 012_add_organization_id.sql

CREATE TABLE IF NOT EXISTS notification_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    user_id INTEGER,
    data TEXT, -- JSON event data
    processed BOOLEAN DEFAULT FALSE,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_entity ON notification_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_processed ON notification_events(processed);

-- ========================================
-- ANALYTICS TABLES
-- ========================================
-- Required by: 012_add_organization_id.sql

CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    tickets_created INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    tickets_closed INTEGER DEFAULT 0,
    avg_response_time_minutes DECIMAL(10,2),
    avg_resolution_time_minutes DECIMAL(10,2),
    sla_met_count INTEGER DEFAULT 0,
    sla_breached_count INTEGER DEFAULT 0,
    satisfaction_avg DECIMAL(3,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_agent_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    date DATE NOT NULL,
    tickets_assigned INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_response_time_minutes DECIMAL(10,2),
    avg_resolution_time_minutes DECIMAL(10,2),
    satisfaction_avg DECIMAL(3,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(agent_id, date)
);

CREATE TABLE IF NOT EXISTS analytics_category_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    date DATE NOT NULL,
    ticket_count INTEGER DEFAULT 0,
    avg_resolution_time_minutes DECIMAL(10,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_agent_date ON analytics_agent_metrics(agent_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_category_date ON analytics_category_metrics(category_id, date DESC);

-- ========================================
-- SYSTEM SETTINGS TABLE (required for migration metadata)
-- ========================================

CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'string',
    is_public BOOLEAN DEFAULT FALSE,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

COMMIT;

-- Insert metadata
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_public)
VALUES
    ('base_tables_migrated', 'true', 'Base tables migration completed', 'boolean', FALSE),
    ('base_migration_version', '000', 'Base migration version', 'string', FALSE),
    ('base_migration_date', datetime('now'), 'Base migration date', 'string', FALSE);

-- Verification query (commented out)
-- SELECT 'Base tables created successfully' as status;
-- SELECT name FROM sqlite_master WHERE type='table' AND name IN ('organizations', 'workflows', 'workflow_executions', 'kb_articles');
