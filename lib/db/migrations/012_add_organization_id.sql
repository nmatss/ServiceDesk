-- Migration: Add organization_id to remaining tables for complete multi-tenant isolation
-- Version: 012
-- Description: Ensures all tables have organization_id for proper data isolation
-- Agent: 8 of 15
-- Date: 2025-12-13

-- ========================================
-- AUDIT AND LOGGING TABLES
-- ========================================

-- Add organization_id to audit_logs
ALTER TABLE audit_logs ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_org_entity ON audit_logs(organization_id, entity_type, entity_id);
CREATE INDEX idx_audit_logs_org_user ON audit_logs(organization_id, user_id);

-- Update existing audit_logs records to inherit organization_id from user
UPDATE audit_logs
SET organization_id = (
    SELECT organization_id
    FROM users
    WHERE users.id = audit_logs.user_id
)
WHERE user_id IS NOT NULL;

-- Set default organization for orphaned records
UPDATE audit_logs
SET organization_id = 1
WHERE organization_id IS NULL;

-- ========================================
-- ANALYTICS TABLES
-- ========================================

-- Add organization_id to analytics_daily_metrics
ALTER TABLE analytics_daily_metrics ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_analytics_daily_organization ON analytics_daily_metrics(organization_id);
CREATE INDEX idx_analytics_daily_org_date ON analytics_daily_metrics(organization_id, date DESC);

-- Set default organization for existing records
UPDATE analytics_daily_metrics
SET organization_id = 1
WHERE organization_id IS NULL;

-- Update unique constraint to include organization_id
DROP INDEX IF EXISTS analytics_daily_metrics_date_key;
CREATE UNIQUE INDEX idx_analytics_daily_org_date_unique ON analytics_daily_metrics(organization_id, date);

-- Add organization_id to analytics_agent_metrics
ALTER TABLE analytics_agent_metrics ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_analytics_agent_organization ON analytics_agent_metrics(organization_id);
CREATE INDEX idx_analytics_agent_org_date ON analytics_agent_metrics(organization_id, agent_id, date DESC);

-- Update existing records to inherit from agent's organization
UPDATE analytics_agent_metrics
SET organization_id = (
    SELECT organization_id
    FROM users
    WHERE users.id = analytics_agent_metrics.agent_id
)
WHERE agent_id IS NOT NULL;

-- Update unique constraint to include organization_id
DROP INDEX IF EXISTS analytics_agent_metrics_agent_id_date_key;
CREATE UNIQUE INDEX idx_analytics_agent_org_date_unique ON analytics_agent_metrics(organization_id, agent_id, date);

-- Add organization_id to analytics_category_metrics
ALTER TABLE analytics_category_metrics ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_analytics_category_organization ON analytics_category_metrics(organization_id);

-- Update existing records to inherit from category's organization
UPDATE analytics_category_metrics
SET organization_id = (
    SELECT organization_id
    FROM categories
    WHERE categories.id = analytics_category_metrics.category_id
)
WHERE category_id IS NOT NULL;

-- Update unique constraint
DROP INDEX IF EXISTS analytics_category_metrics_category_id_date_key;
CREATE UNIQUE INDEX idx_analytics_category_org_date_unique ON analytics_category_metrics(organization_id, category_id, date);

-- ========================================
-- NOTIFICATION TABLES
-- ========================================

-- Add organization_id to notification_events
ALTER TABLE notification_events ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_notification_events_organization ON notification_events(organization_id);
CREATE INDEX idx_notification_events_org_type ON notification_events(organization_id, event_type);
CREATE INDEX idx_notification_events_org_processed ON notification_events(organization_id, processed);

-- Set default organization for existing records
UPDATE notification_events
SET organization_id = 1
WHERE organization_id IS NULL;

-- Add organization_id to notification_preferences (if exists)
-- Note: This table might not exist in all schemas
-- CREATE TABLE IF NOT EXISTS notification_preferences (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     user_id INTEGER NOT NULL,
--     organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
--     notification_type TEXT NOT NULL,
--     enabled BOOLEAN DEFAULT TRUE,
--     channel_preferences TEXT, -- JSON
--     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );
-- CREATE INDEX idx_notification_prefs_organization ON notification_preferences(organization_id);

-- ========================================
-- WORKFLOW TABLES
-- ========================================

-- Add organization_id to workflow_definitions
ALTER TABLE workflow_definitions ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_workflow_definitions_organization ON workflow_definitions(organization_id);
CREATE INDEX idx_workflow_definitions_org_active ON workflow_definitions(organization_id, is_active);

-- Update existing records to inherit from creator's organization
UPDATE workflow_definitions
SET organization_id = (
    SELECT organization_id
    FROM users
    WHERE users.id = workflow_definitions.created_by
)
WHERE created_by IS NOT NULL;

-- Add organization_id to workflows (legacy table)
ALTER TABLE workflows ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_workflows_organization ON workflows(organization_id);
CREATE INDEX idx_workflows_org_active ON workflows(organization_id, is_active);

-- Update existing records
UPDATE workflows
SET organization_id = (
    SELECT organization_id
    FROM users
    WHERE users.id = workflows.created_by
)
WHERE created_by IS NOT NULL;

-- Add organization_id to workflow_executions
ALTER TABLE workflow_executions ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_workflow_executions_organization ON workflow_executions(organization_id);
CREATE INDEX idx_workflow_executions_org_status ON workflow_executions(organization_id, status);
CREATE INDEX idx_workflow_executions_org_date ON workflow_executions(organization_id, started_at DESC);

-- Update existing records to inherit from workflow's organization
UPDATE workflow_executions
SET organization_id = (
    SELECT organization_id
    FROM workflows
    WHERE workflows.id = workflow_executions.workflow_id
)
WHERE workflow_id IS NOT NULL;

-- Fallback to workflow_definitions if workflows lookup failed
UPDATE workflow_executions
SET organization_id = (
    SELECT organization_id
    FROM workflow_definitions
    WHERE workflow_definitions.id = workflow_executions.workflow_id
)
WHERE organization_id IS NULL AND workflow_id IS NOT NULL;

-- Add organization_id to workflow_step_executions
ALTER TABLE workflow_step_executions ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_workflow_step_executions_organization ON workflow_step_executions(organization_id);

-- Update existing records to inherit from execution's organization
UPDATE workflow_step_executions
SET organization_id = (
    SELECT organization_id
    FROM workflow_executions
    WHERE workflow_executions.id = workflow_step_executions.execution_id
)
WHERE execution_id IS NOT NULL;

-- ========================================
-- SESSION TABLES
-- ========================================

-- Add organization_id to user_sessions
ALTER TABLE user_sessions ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_user_sessions_organization ON user_sessions(organization_id);
CREATE INDEX idx_user_sessions_org_user ON user_sessions(organization_id, user_id);
CREATE INDEX idx_user_sessions_org_active ON user_sessions(organization_id, is_active);

-- Update existing records to inherit from user's organization
UPDATE user_sessions
SET organization_id = (
    SELECT organization_id
    FROM users
    WHERE users.id = user_sessions.user_id
)
WHERE user_id IS NOT NULL;

-- ========================================
-- OTHER SYSTEM TABLES
-- ========================================

-- Add organization_id to automations
ALTER TABLE automations ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_automations_organization ON automations(organization_id);
CREATE INDEX idx_automations_org_active ON automations(organization_id, is_active);

-- Update existing records
UPDATE automations
SET organization_id = (
    SELECT organization_id
    FROM users
    WHERE users.id = automations.created_by
)
WHERE created_by IS NOT NULL;

-- Add organization_id to templates
ALTER TABLE templates ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_templates_organization ON templates(organization_id);
CREATE INDEX idx_templates_org_active ON templates(organization_id, is_active);

-- Update existing records
UPDATE templates
SET organization_id = (
    SELECT organization_id
    FROM users
    WHERE users.id = templates.created_by
)
WHERE created_by IS NOT NULL;

-- Add organization_id to satisfaction_surveys
ALTER TABLE satisfaction_surveys ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_satisfaction_surveys_organization ON satisfaction_surveys(organization_id);

-- Update existing records
UPDATE satisfaction_surveys
SET organization_id = (
    SELECT organization_id
    FROM users
    WHERE users.id = satisfaction_surveys.user_id
)
WHERE user_id IS NOT NULL;

-- ========================================
-- FINAL CLEANUP
-- ========================================

-- Set organization_id to 1 for any remaining NULL values (default organization)
UPDATE audit_logs SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE analytics_daily_metrics SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE analytics_agent_metrics SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE analytics_category_metrics SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE notification_events SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE workflow_definitions SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE workflows SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE workflow_executions SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE workflow_step_executions SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE user_sessions SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE automations SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE templates SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE satisfaction_surveys SET organization_id = 1 WHERE organization_id IS NULL;

-- ========================================
-- VERIFICATION QUERIES (commented out)
-- ========================================

-- Uncomment these to verify the migration:
-- SELECT 'audit_logs' as table_name, COUNT(*) as total, COUNT(organization_id) as with_org_id FROM audit_logs
-- UNION ALL
-- SELECT 'analytics_daily_metrics', COUNT(*), COUNT(organization_id) FROM analytics_daily_metrics
-- UNION ALL
-- SELECT 'analytics_agent_metrics', COUNT(*), COUNT(organization_id) FROM analytics_agent_metrics
-- UNION ALL
-- SELECT 'notification_events', COUNT(*), COUNT(organization_id) FROM notification_events
-- UNION ALL
-- SELECT 'workflow_definitions', COUNT(*), COUNT(organization_id) FROM workflow_definitions
-- UNION ALL
-- SELECT 'workflow_executions', COUNT(*), COUNT(organization_id) FROM workflow_executions
-- UNION ALL
-- SELECT 'user_sessions', COUNT(*), COUNT(organization_id) FROM user_sessions;
