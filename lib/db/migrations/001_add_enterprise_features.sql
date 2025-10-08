-- Migration: Add Enterprise Features
-- Description: Adds AI/ML tables, advanced workflows, enterprise features, and Brasil integrations
-- Date: 2025-09-28
-- Version: 1.0

-- Start transaction
BEGIN TRANSACTION;

-- ========================================
-- AI & ML TABLES
-- ========================================

-- AI Classifications Table
CREATE TABLE IF NOT EXISTS ai_classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    suggested_category_id INTEGER,
    suggested_priority_id INTEGER,
    suggested_category TEXT,
    confidence_score DECIMAL(5,4),
    reasoning TEXT,
    model_name TEXT NOT NULL DEFAULT 'gpt-4o',
    model_version TEXT DEFAULT '2024-08-06',
    probability_distribution TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    processing_time_ms INTEGER,
    was_accepted BOOLEAN,
    corrected_category_id INTEGER,
    feedback_by INTEGER,
    feedback_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (suggested_category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (suggested_priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
    FOREIGN KEY (corrected_category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (feedback_by) REFERENCES users(id) ON DELETE SET NULL
);

-- AI Suggestions Table
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    suggestion_type TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence_score DECIMAL(5,4),
    model_name TEXT DEFAULT 'gpt-4o',
    source_type TEXT,
    source_references TEXT,
    reasoning TEXT,
    was_used BOOLEAN DEFAULT FALSE,
    was_helpful BOOLEAN,
    feedback_comment TEXT,
    used_by INTEGER,
    used_at DATETIME,
    feedback_by INTEGER,
    feedback_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (feedback_by) REFERENCES users(id) ON DELETE SET NULL
);

-- AI Training Data Table
CREATE TABLE IF NOT EXISTS ai_training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input TEXT NOT NULL,
    output TEXT NOT NULL,
    feedback TEXT,
    model_version TEXT DEFAULT '1.0',
    data_type TEXT NOT NULL,
    quality_score DECIMAL(3,2) DEFAULT 1.00,
    source_entity_type TEXT,
    source_entity_id INTEGER,
    created_by INTEGER,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    is_validated BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Vector Embeddings Table
CREATE TABLE IF NOT EXISTS vector_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    embedding_vector TEXT NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    model_version TEXT DEFAULT '1.0',
    vector_dimension INTEGER DEFAULT 1536,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, model_name)
);

-- ========================================
-- ADVANCED WORKFLOW TABLES
-- ========================================

-- Workflow Definitions Table
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_conditions TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Workflow Approvals Table
CREATE TABLE IF NOT EXISTS workflow_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    comments TEXT,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- ENTERPRISE TABLES
-- ========================================

-- Tenant Configurations Table
CREATE TABLE IF NOT EXISTS tenant_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    feature_flags TEXT NOT NULL,
    limits TEXT NOT NULL,
    customizations TEXT,
    api_settings TEXT,
    integrations_config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id)
);

-- Advanced Audit Table
CREATE TABLE IF NOT EXISTS audit_advanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    user_id INTEGER,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,
    api_endpoint TEXT,
    organization_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- API Usage Tracking Table
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    tenant_id INTEGER DEFAULT 1,
    user_id INTEGER,
    api_key_id INTEGER,
    response_time_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    error_message TEXT,
    rate_limit_hit BOOLEAN DEFAULT FALSE,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    date DATE DEFAULT (DATE('now')),
    hour INTEGER DEFAULT (strftime('%H', 'now')),
    FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- BRASIL INTEGRATION TABLES
-- ========================================

-- WhatsApp Sessions Table
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    session_data TEXT,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone_number)
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- AI & ML Indexes
CREATE INDEX IF NOT EXISTS idx_ai_classifications_ticket ON ai_classifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_model ON ai_classifications(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_confidence ON ai_classifications(confidence_score);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_ticket ON ai_suggestions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_used ON ai_suggestions(was_used);

CREATE INDEX IF NOT EXISTS idx_ai_training_data_type ON ai_training_data(data_type);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_validated ON ai_training_data(is_validated);

CREATE INDEX IF NOT EXISTS idx_vector_embeddings_entity ON vector_embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_model ON vector_embeddings(model_name);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_updated ON vector_embeddings(updated_at);

-- Workflow Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active ON workflow_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_by ON workflow_definitions(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_execution ON workflow_approvals(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver ON workflow_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON workflow_approvals(status);

-- Enterprise Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_configurations_org ON tenant_configurations(organization_id);

CREATE INDEX IF NOT EXISTS idx_audit_advanced_entity ON audit_advanced(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_user ON audit_advanced(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_organization ON audit_advanced(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_created ON audit_advanced(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_action ON audit_advanced(action);

CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage_tracking(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_tenant ON api_usage_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_tracking(date);
CREATE INDEX IF NOT EXISTS idx_api_usage_hour ON api_usage_tracking(hour);
CREATE INDEX IF NOT EXISTS idx_api_usage_status ON api_usage_tracking(status_code);

-- Brasil Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_active ON whatsapp_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_activity ON whatsapp_sessions(last_activity);

-- ========================================
-- TRIGGERS FOR AUTOMATION
-- ========================================

-- Vector Embeddings Updated At Trigger
CREATE TRIGGER IF NOT EXISTS update_vector_embeddings_updated_at
    AFTER UPDATE ON vector_embeddings
    BEGIN
        UPDATE vector_embeddings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Workflow Definitions Updated At Trigger
CREATE TRIGGER IF NOT EXISTS update_workflow_definitions_updated_at
    AFTER UPDATE ON workflow_definitions
    BEGIN
        UPDATE workflow_definitions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Tenant Configurations Updated At Trigger
CREATE TRIGGER IF NOT EXISTS update_tenant_configurations_updated_at
    AFTER UPDATE ON tenant_configurations
    BEGIN
        UPDATE tenant_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- WhatsApp Sessions Updated At Trigger
CREATE TRIGGER IF NOT EXISTS update_whatsapp_sessions_updated_at
    AFTER UPDATE ON whatsapp_sessions
    BEGIN
        UPDATE whatsapp_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Advanced Audit Trigger for Tickets
CREATE TRIGGER IF NOT EXISTS audit_ticket_changes_advanced
    AFTER UPDATE ON tickets
    BEGIN
        INSERT INTO audit_advanced (entity_type, entity_id, action, old_values, new_values, user_id, organization_id)
        VALUES (
            'ticket',
            NEW.id,
            'update',
            json_object(
                'title', OLD.title,
                'description', OLD.description,
                'assigned_to', OLD.assigned_to,
                'category_id', OLD.category_id,
                'priority_id', OLD.priority_id,
                'status_id', OLD.status_id
            ),
            json_object(
                'title', NEW.title,
                'description', NEW.description,
                'assigned_to', NEW.assigned_to,
                'category_id', NEW.category_id,
                'priority_id', NEW.priority_id,
                'status_id', NEW.status_id
            ),
            NEW.assigned_to,
            1
        );
    END;

-- Advanced Audit Trigger for Users
CREATE TRIGGER IF NOT EXISTS audit_user_changes_advanced
    AFTER UPDATE ON users
    WHEN OLD.role != NEW.role OR OLD.is_active != NEW.is_active
    BEGIN
        INSERT INTO audit_advanced (entity_type, entity_id, action, old_values, new_values, user_id, organization_id)
        VALUES (
            'user',
            NEW.id,
            'update',
            json_object('role', OLD.role, 'is_active', OLD.is_active),
            json_object('role', NEW.role, 'is_active', NEW.is_active),
            NEW.id,
            1
        );
    END;

-- ========================================
-- INSERT DEFAULT DATA
-- ========================================

-- Insert default tenant configuration for organization 1
INSERT OR IGNORE INTO tenant_configurations (organization_id, feature_flags, limits)
VALUES (
    1,
    json('{"ai_enabled": true, "whatsapp_enabled": true, "govbr_enabled": true, "advanced_workflows": true, "enterprise_analytics": true}'),
    json('{"max_users": 100, "max_tickets_per_month": 5000, "max_storage_gb": 10, "max_api_calls_per_hour": 1000}')
);

-- Commit transaction
COMMIT;

-- Log migration completion
INSERT INTO system_settings (key, value, description, type, is_public)
VALUES ('migration_001_completed', datetime('now'), 'Enterprise features migration completed', 'string', FALSE)
ON CONFLICT(key) DO UPDATE SET value = datetime('now');