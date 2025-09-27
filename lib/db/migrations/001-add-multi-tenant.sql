-- ========================================
-- MIGRATION: Add Multi-Tenant Support
-- ========================================
-- This migration adds multi-tenant capabilities to the existing ServiceDesk system
-- Including tenant isolation, team management, and incident/request separation

-- Start transaction to ensure atomicity
BEGIN TRANSACTION;

-- ========================================
-- STEP 1: CREATE CORE TENANT TABLES
-- ========================================

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT UNIQUE,
    subdomain TEXT UNIQUE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3B82F6',
    secondary_color TEXT DEFAULT '#1F2937',
    subscription_plan TEXT NOT NULL DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'professional', 'enterprise')),
    max_users INTEGER DEFAULT 50,
    max_tickets_per_month INTEGER DEFAULT 1000,
    features TEXT, -- JSON array of enabled features
    settings TEXT, -- JSON object with tenant-specific settings
    billing_email TEXT,
    technical_contact_email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    trial_ends_at DATETIME,
    subscription_ends_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create ticket types table
CREATE TABLE IF NOT EXISTS ticket_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'ExclamationTriangleIcon',
    color TEXT DEFAULT '#EF4444',
    workflow_type TEXT NOT NULL CHECK (workflow_type IN ('incident', 'request', 'change', 'problem')),
    sla_required BOOLEAN DEFAULT TRUE,
    approval_required BOOLEAN DEFAULT FALSE,
    escalation_enabled BOOLEAN DEFAULT TRUE,
    auto_assignment_enabled BOOLEAN DEFAULT FALSE,
    customer_visible BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, slug)
);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    team_type TEXT NOT NULL CHECK (team_type IN ('technical', 'business', 'support', 'management')),
    specializations TEXT, -- JSON array
    capabilities TEXT, -- JSON array
    icon TEXT DEFAULT 'UsersIcon',
    color TEXT DEFAULT '#3B82F6',
    manager_id INTEGER,
    parent_team_id INTEGER,
    escalation_team_id INTEGER,
    business_hours TEXT, -- JSON object
    contact_email TEXT,
    contact_phone TEXT,
    sla_response_time INTEGER,
    max_concurrent_tickets INTEGER DEFAULT 50,
    auto_assignment_enabled BOOLEAN DEFAULT FALSE,
    assignment_algorithm TEXT DEFAULT 'round_robin' CHECK (assignment_algorithm IN ('round_robin', 'least_loaded', 'skill_based')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (escalation_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, slug)
);

-- Create team members table
CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'lead', 'senior', 'member', 'trainee')),
    specializations TEXT, -- JSON array
    availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'away', 'off_duty')),
    workload_percentage INTEGER DEFAULT 100,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

-- ========================================
-- STEP 2: ADD TENANT_ID TO EXISTING TABLES
-- ========================================

-- Add tenant_id to users table
ALTER TABLE users ADD COLUMN tenant_id INTEGER;
ALTER TABLE users ADD COLUMN employee_id TEXT;
ALTER TABLE users ADD COLUMN department TEXT;
ALTER TABLE users ADD COLUMN job_title TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'pt-BR';
ALTER TABLE users ADD COLUMN notification_preferences TEXT;
ALTER TABLE users ADD COLUMN skills TEXT;
ALTER TABLE users ADD COLUMN certifications TEXT;
ALTER TABLE users ADD COLUMN is_active_new BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN last_login_at DATETIME;
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Add tenant_id to other core tables
ALTER TABLE categories ADD COLUMN tenant_id INTEGER;
ALTER TABLE categories ADD COLUMN slug TEXT;
ALTER TABLE categories ADD COLUMN icon TEXT DEFAULT 'FolderIcon';
ALTER TABLE categories ADD COLUMN parent_id INTEGER;
ALTER TABLE categories ADD COLUMN ticket_types TEXT;
ALTER TABLE categories ADD COLUMN default_team_id INTEGER;
ALTER TABLE categories ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE categories ADD COLUMN escalation_rules TEXT;
ALTER TABLE categories ADD COLUMN sla_policies TEXT;
ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN is_active_new BOOLEAN DEFAULT TRUE;

ALTER TABLE priorities ADD COLUMN tenant_id INTEGER;
ALTER TABLE priorities ADD COLUMN slug TEXT;
ALTER TABLE priorities ADD COLUMN description TEXT;
ALTER TABLE priorities ADD COLUMN sla_multiplier DECIMAL(3,2) DEFAULT 1.0;
ALTER TABLE priorities ADD COLUMN auto_escalation_minutes INTEGER;
ALTER TABLE priorities ADD COLUMN icon TEXT DEFAULT 'ExclamationTriangleIcon';
ALTER TABLE priorities ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE priorities ADD COLUMN is_active_new BOOLEAN DEFAULT TRUE;

ALTER TABLE statuses ADD COLUMN tenant_id INTEGER;
ALTER TABLE statuses ADD COLUMN slug TEXT;
ALTER TABLE statuses ADD COLUMN status_type TEXT;
ALTER TABLE statuses ADD COLUMN is_initial BOOLEAN DEFAULT FALSE;
ALTER TABLE statuses ADD COLUMN is_customer_visible BOOLEAN DEFAULT TRUE;
ALTER TABLE statuses ADD COLUMN requires_comment BOOLEAN DEFAULT FALSE;
ALTER TABLE statuses ADD COLUMN next_statuses TEXT;
ALTER TABLE statuses ADD COLUMN automated_actions TEXT;
ALTER TABLE statuses ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE statuses ADD COLUMN is_active_new BOOLEAN DEFAULT TRUE;

-- Add columns to tickets table
ALTER TABLE tickets ADD COLUMN tenant_id INTEGER;
ALTER TABLE tickets ADD COLUMN ticket_number TEXT;
ALTER TABLE tickets ADD COLUMN ticket_type_id INTEGER;
ALTER TABLE tickets ADD COLUMN assigned_team_id INTEGER;
ALTER TABLE tickets ADD COLUMN impact INTEGER DEFAULT 3;
ALTER TABLE tickets ADD COLUMN urgency INTEGER DEFAULT 3;
ALTER TABLE tickets ADD COLUMN source TEXT DEFAULT 'web';
ALTER TABLE tickets ADD COLUMN location TEXT;
ALTER TABLE tickets ADD COLUMN affected_users_count INTEGER DEFAULT 1;
ALTER TABLE tickets ADD COLUMN business_service TEXT;
ALTER TABLE tickets ADD COLUMN configuration_item TEXT;
ALTER TABLE tickets ADD COLUMN change_request_id INTEGER;
ALTER TABLE tickets ADD COLUMN problem_id INTEGER;
ALTER TABLE tickets ADD COLUMN resolution_notes TEXT;
ALTER TABLE tickets ADD COLUMN workaround TEXT;
ALTER TABLE tickets ADD COLUMN customer_satisfaction INTEGER;
ALTER TABLE tickets ADD COLUMN estimated_effort_hours DECIMAL(5,2);
ALTER TABLE tickets ADD COLUMN actual_effort_hours DECIMAL(5,2);
ALTER TABLE tickets ADD COLUMN tags TEXT;
ALTER TABLE tickets ADD COLUMN metadata TEXT;
ALTER TABLE tickets ADD COLUMN closed_at DATETIME;
ALTER TABLE tickets ADD COLUMN due_at DATETIME;

-- Add tenant_id to other tables
ALTER TABLE comments ADD COLUMN tenant_id INTEGER;
ALTER TABLE comments ADD COLUMN comment_type TEXT DEFAULT 'comment';
ALTER TABLE comments ADD COLUMN time_spent_minutes INTEGER;
ALTER TABLE comments ADD COLUMN visibility TEXT DEFAULT 'all';

ALTER TABLE attachments ADD COLUMN tenant_id INTEGER;
ALTER TABLE attachments ADD COLUMN comment_id INTEGER;
ALTER TABLE attachments ADD COLUMN file_path TEXT;
ALTER TABLE attachments ADD COLUMN is_public BOOLEAN DEFAULT FALSE;

ALTER TABLE sla_policies ADD COLUMN tenant_id INTEGER;
ALTER TABLE sla_policies ADD COLUMN ticket_type_id INTEGER;
ALTER TABLE sla_policies ADD COLUMN team_id INTEGER;
ALTER TABLE sla_policies ADD COLUMN escalation_chain TEXT;
ALTER TABLE sla_policies ADD COLUMN breach_actions TEXT;

ALTER TABLE sla_tracking ADD COLUMN tenant_id INTEGER;
ALTER TABLE sla_tracking ADD COLUMN pause_start_time DATETIME;
ALTER TABLE sla_tracking ADD COLUMN total_paused_minutes INTEGER DEFAULT 0;
ALTER TABLE sla_tracking ADD COLUMN is_paused BOOLEAN DEFAULT FALSE;

ALTER TABLE notifications ADD COLUMN tenant_id INTEGER;
ALTER TABLE notifications ADD COLUMN channels TEXT;
ALTER TABLE notifications ADD COLUMN priority TEXT DEFAULT 'medium';

-- ========================================
-- STEP 3: CREATE TENANT SETTINGS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS tenant_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, category, key)
);

-- ========================================
-- STEP 4: UPDATE EXISTING TABLES FOR MULTI-TENANT
-- ========================================

-- Update user_sessions for multi-tenant
ALTER TABLE user_sessions ADD COLUMN tenant_id INTEGER;

-- Update analytics tables
ALTER TABLE analytics_daily_metrics ADD COLUMN tenant_id INTEGER;
ALTER TABLE analytics_daily_metrics ADD COLUMN ticket_type_id INTEGER;
ALTER TABLE analytics_daily_metrics ADD COLUMN team_id INTEGER;
ALTER TABLE analytics_daily_metrics ADD COLUMN sla_breaches INTEGER DEFAULT 0;
ALTER TABLE analytics_daily_metrics ADD COLUMN escalations INTEGER DEFAULT 0;

ALTER TABLE analytics_agent_metrics ADD COLUMN tenant_id INTEGER;
ALTER TABLE analytics_agent_metrics ADD COLUMN team_id INTEGER;
ALTER TABLE analytics_agent_metrics ADD COLUMN workload_percentage INTEGER DEFAULT 100;

-- Update KB tables
ALTER TABLE kb_categories ADD COLUMN tenant_id INTEGER;
ALTER TABLE kb_categories ADD COLUMN visibility TEXT DEFAULT 'public';
ALTER TABLE kb_categories ADD COLUMN team_access TEXT;

ALTER TABLE kb_articles ADD COLUMN tenant_id INTEGER;
ALTER TABLE kb_articles ADD COLUMN team_access TEXT;

-- Update audit logs
ALTER TABLE audit_logs ADD COLUMN tenant_id INTEGER;
ALTER TABLE audit_logs ADD COLUMN session_id TEXT;
ALTER TABLE audit_logs ADD COLUMN risk_level TEXT DEFAULT 'low';

-- ========================================
-- STEP 5: CREATE DEFAULT TENANT AND SEED DATA
-- ========================================

-- Insert default tenant
INSERT INTO tenants (
    name, slug, subdomain, subscription_plan, max_users, max_tickets_per_month,
    features, billing_email, technical_contact_email, is_active
) VALUES (
    'Empresa Demo',
    'empresa-demo',
    'demo',
    'enterprise',
    500,
    10000,
    '["incidents", "requests", "knowledge_base", "analytics", "automations", "teams", "sla", "approvals"]',
    'admin@empresa-demo.com',
    'suporte@empresa-demo.com',
    1
);

-- Get the default tenant ID
-- We'll use 1 since it's the first insert

-- Create default ticket types for the default tenant
INSERT INTO ticket_types (tenant_id, name, slug, description, icon, color, workflow_type, sla_required, customer_visible, sort_order) VALUES
(1, 'Incidente', 'incident', 'Problemas que afetam serviços em produção', 'ExclamationTriangleIcon', '#EF4444', 'incident', 1, 1, 1),
(1, 'Requisição de Serviço', 'service-request', 'Solicitações de novos serviços ou recursos', 'PlusCircleIcon', '#10B981', 'request', 1, 1, 2),
(1, 'Requisição de Mudança', 'change-request', 'Solicitações de mudanças em sistemas', 'ArrowPathIcon', '#F59E0B', 'change', 1, 0, 3),
(1, 'Problema', 'problem', 'Investigação de causa raiz de incidentes recorrentes', 'MagnifyingGlassIcon', '#8B5CF6', 'problem', 0, 0, 4);

-- Create default teams for the default tenant
INSERT INTO teams (tenant_id, name, slug, description, team_type, specializations, capabilities, icon, color, sla_response_time) VALUES
(1, 'Infraestrutura', 'infrastructure', 'Equipe responsável por servidores, redes e infraestrutura', 'technical',
 '["servers", "networking", "storage", "virtualization", "cloud"]',
 '["incident_response", "monitoring", "capacity_planning", "disaster_recovery"]',
 'ServerIcon', '#3B82F6', 30),

(1, 'Desenvolvimento', 'development', 'Equipe de desenvolvimento de software', 'technical',
 '["web_development", "mobile_development", "apis", "databases", "devops"]',
 '["bug_fixes", "feature_development", "code_review", "deployment"]',
 'CodeBracketIcon', '#10B981', 60),

(1, 'Suporte Técnico', 'technical-support', 'Equipe de suporte técnico aos usuários', 'support',
 '["user_support", "troubleshooting", "training", "documentation"]',
 '["incident_resolution", "user_assistance", "knowledge_base", "training"]',
 'UserGroupIcon', '#F59E0B', 15),

(1, 'Segurança', 'security', 'Equipe de segurança da informação', 'technical',
 '["cybersecurity", "compliance", "risk_assessment", "incident_response"]',
 '["security_monitoring", "threat_analysis", "policy_enforcement", "audit"]',
 'ShieldCheckIcon', '#EF4444', 15);

-- Update existing data to assign to default tenant
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE categories SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE priorities SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE statuses SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE tickets SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE comments SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE attachments SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE sla_policies SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE sla_tracking SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE notifications SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE analytics_daily_metrics SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE analytics_agent_metrics SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE kb_categories SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE kb_articles SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE audit_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE user_sessions SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Update slugs for existing categories
UPDATE categories SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
UPDATE priorities SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
UPDATE statuses SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;

-- Set default ticket type for existing tickets
UPDATE tickets SET ticket_type_id = 1 WHERE ticket_type_id IS NULL; -- Default to incident

-- Generate ticket numbers for existing tickets
UPDATE tickets SET ticket_number = 'INC-' || strftime('%Y', created_at) || '-' || printf('%06d', id)
WHERE ticket_number IS NULL;

-- Assign existing users to teams (example assignments)
INSERT OR IGNORE INTO team_members (team_id, user_id, role)
SELECT
    CASE
        WHEN u.role = 'admin' THEN 1 -- Infrastructure team
        WHEN u.role = 'agent' THEN 3 -- Technical Support team
        ELSE 3 -- Default to Technical Support
    END as team_id,
    u.id as user_id,
    CASE
        WHEN u.role = 'admin' THEN 'manager'
        WHEN u.role = 'agent' THEN 'member'
        ELSE 'member'
    END as role
FROM users u
WHERE u.tenant_id = 1;

-- ========================================
-- STEP 6: CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Tenant indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

-- Team indexes
CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- Ticket type indexes
CREATE INDEX IF NOT EXISTS idx_ticket_types_tenant ON ticket_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_workflow ON ticket_types(workflow_type);

-- Updated tenant-aware indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_priorities_tenant ON priorities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statuses_tenant ON statuses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_number ON tickets(tenant_id, ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_type ON tickets(tenant_id, ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_team ON tickets(tenant_id, assigned_team_id);

CREATE INDEX IF NOT EXISTS idx_comments_tenant ON comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attachments_tenant ON attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);

-- ========================================
-- STEP 7: CREATE UPDATED TRIGGERS
-- ========================================

-- Trigger for updated_at on new tables
CREATE TRIGGER IF NOT EXISTS update_tenants_updated_at
    AFTER UPDATE ON tenants
    BEGIN
        UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_teams_updated_at
    AFTER UPDATE ON teams
    BEGIN
        UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_ticket_types_updated_at
    AFTER UPDATE ON ticket_types
    BEGIN
        UPDATE ticket_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Updated trigger for ticket number generation
DROP TRIGGER IF EXISTS generate_ticket_number;
CREATE TRIGGER IF NOT EXISTS generate_ticket_number_mt
    AFTER INSERT ON tickets
    WHEN NEW.ticket_number IS NULL
    BEGIN
        UPDATE tickets
        SET ticket_number = (
            SELECT
                CASE
                    WHEN tt.workflow_type = 'incident' THEN 'INC-'
                    WHEN tt.workflow_type = 'request' THEN 'REQ-'
                    WHEN tt.workflow_type = 'change' THEN 'CHG-'
                    WHEN tt.workflow_type = 'problem' THEN 'PRB-'
                    ELSE 'TKT-'
                END ||
                strftime('%Y', NEW.created_at) || '-' ||
                printf('%06d', NEW.id)
            FROM ticket_types tt
            WHERE tt.id = NEW.ticket_type_id
        )
        WHERE id = NEW.id;
    END;

-- ========================================
-- STEP 8: ADD FOREIGN KEY CONSTRAINTS
-- ========================================

-- Note: SQLite doesn't support adding foreign key constraints to existing tables
-- These would need to be enforced at the application level or during table recreation

-- Commit transaction
COMMIT;