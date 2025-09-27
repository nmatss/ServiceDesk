-- ========================================
-- MULTI-TENANT SERVICEDESK DATABASE SCHEMA
-- ========================================
-- Schema para suporte completo a multi-tenancy com:
-- - Separação por empresas/organizações (tenants)
-- - Gestão de equipes/departamentos
-- - Separação de incidentes vs requisições
-- - Isolamento completo de dados por tenant

-- ========================================
-- CORE TENANT TABLES
-- ========================================

-- Tabela de inquilinos/empresas
CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier (ex: empresa-abc)
    domain TEXT UNIQUE, -- Custom domain (ex: abc.servicedesk.com)
    subdomain TEXT UNIQUE, -- Subdomain (ex: abc.exemplo.com)
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

-- Tabela de tipos de ticket (Incident vs Request)
CREATE TABLE IF NOT EXISTS ticket_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- 'Incident', 'Service Request', 'Change Request', etc.
    slug TEXT NOT NULL, -- 'incident', 'service-request', 'change-request'
    description TEXT,
    icon TEXT DEFAULT 'ExclamationTriangleIcon',
    color TEXT DEFAULT '#EF4444',
    workflow_type TEXT NOT NULL CHECK (workflow_type IN ('incident', 'request', 'change', 'problem')),
    sla_required BOOLEAN DEFAULT TRUE,
    approval_required BOOLEAN DEFAULT FALSE,
    escalation_enabled BOOLEAN DEFAULT TRUE,
    auto_assignment_enabled BOOLEAN DEFAULT FALSE,
    customer_visible BOOLEAN DEFAULT TRUE, -- Se aparece na landing page do cliente
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, slug)
);

-- Tabela de equipes/departamentos
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL, -- 'infrastructure', 'development', 'support'
    description TEXT,
    team_type TEXT NOT NULL CHECK (team_type IN ('technical', 'business', 'support', 'management')),
    specializations TEXT, -- JSON array ['networking', 'servers', 'databases']
    capabilities TEXT, -- JSON array ['incident_response', 'change_management', 'monitoring']
    icon TEXT DEFAULT 'UsersIcon',
    color TEXT DEFAULT '#3B82F6',
    manager_id INTEGER, -- Team manager/lead
    parent_team_id INTEGER, -- Para hierarquia de equipes
    escalation_team_id INTEGER, -- Equipe para escalação
    business_hours TEXT, -- JSON object with schedule
    contact_email TEXT,
    contact_phone TEXT,
    sla_response_time INTEGER, -- Response time in minutes for this team
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

-- ========================================
-- UPDATED CORE TABLES WITH TENANT SUPPORT
-- ========================================

-- Tabela de usuários (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL, -- Email único apenas dentro do tenant
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'tenant_admin', 'team_manager', 'agent', 'user')),
    employee_id TEXT, -- ID do funcionário na empresa
    department TEXT,
    job_title TEXT,
    phone TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'pt-BR',
    notification_preferences TEXT, -- JSON object
    skills TEXT, -- JSON array of skills
    certifications TEXT, -- JSON array of certifications
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at DATETIME,
    must_change_password BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, email)
);

-- Tabela de relacionamento usuários-equipes (many-to-many)
CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'lead', 'senior', 'member', 'trainee')),
    specializations TEXT, -- JSON array of user specializations within team
    availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'away', 'off_duty')),
    workload_percentage INTEGER DEFAULT 100, -- % de capacidade de trabalho
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

-- Tabela de categorias (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'FolderIcon',
    color TEXT NOT NULL DEFAULT '#3B82F6',
    parent_id INTEGER,
    ticket_types TEXT, -- JSON array of allowed ticket types
    default_team_id INTEGER, -- Team padrão para esta categoria
    requires_approval BOOLEAN DEFAULT FALSE,
    escalation_rules TEXT, -- JSON object with escalation rules
    sla_policies TEXT, -- JSON object with SLA rules per ticket type
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (default_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, slug)
);

-- Tabela de prioridades (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
    color TEXT NOT NULL,
    description TEXT,
    sla_multiplier DECIMAL(3,2) DEFAULT 1.0, -- Multiplicador para SLA
    auto_escalation_minutes INTEGER, -- Auto escalation time
    icon TEXT DEFAULT 'ExclamationTriangleIcon',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, slug)
);

-- Tabela de status (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    status_type TEXT NOT NULL CHECK (status_type IN ('open', 'in_progress', 'waiting', 'resolved', 'closed', 'cancelled')),
    is_initial BOOLEAN DEFAULT FALSE, -- Status inicial
    is_final BOOLEAN DEFAULT FALSE, -- Status final
    is_customer_visible BOOLEAN DEFAULT TRUE,
    requires_comment BOOLEAN DEFAULT FALSE,
    next_statuses TEXT, -- JSON array of allowed next statuses
    automated_actions TEXT, -- JSON array of automated actions
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, slug)
);

-- Tabela de tickets (atualizada para multi-tenant e separação incident/request)
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_number TEXT NOT NULL, -- Human-readable ticket number (e.g., INC-2024-001, REQ-2024-001)
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    ticket_type_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL, -- Solicitante
    assigned_to INTEGER, -- Agente atribuído
    assigned_team_id INTEGER, -- Equipe atribuída
    category_id INTEGER NOT NULL,
    priority_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    impact INTEGER DEFAULT 3 CHECK (impact >= 1 AND impact <= 5), -- 1=Critical, 5=Low
    urgency INTEGER DEFAULT 3 CHECK (urgency >= 1 AND urgency <= 5), -- 1=Critical, 5=Low
    source TEXT DEFAULT 'web' CHECK (source IN ('web', 'email', 'phone', 'chat', 'api', 'mobile')),
    location TEXT, -- Localização física se aplicável
    affected_users_count INTEGER DEFAULT 1,
    business_service TEXT, -- Serviço de negócio afetado
    configuration_item TEXT, -- Item de configuração relacionado
    change_request_id INTEGER, -- Se relacionado a uma mudança
    problem_id INTEGER, -- Se relacionado a um problema conhecido
    resolution_notes TEXT,
    workaround TEXT,
    customer_satisfaction INTEGER CHECK (customer_satisfaction >= 1 AND customer_satisfaction <= 5),
    estimated_effort_hours DECIMAL(5,2),
    actual_effort_hours DECIMAL(5,2),
    tags TEXT, -- JSON array of tags
    metadata TEXT, -- JSON object for additional metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    closed_at DATETIME,
    due_at DATETIME,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE RESTRICT,
    FOREIGN KEY (change_request_id) REFERENCES tickets(id) ON DELETE SET NULL,
    FOREIGN KEY (problem_id) REFERENCES tickets(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, ticket_number)
);

-- Tabela de comentários (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    comment_type TEXT DEFAULT 'comment' CHECK (comment_type IN ('comment', 'work_note', 'system', 'escalation', 'approval')),
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    time_spent_minutes INTEGER,
    visibility TEXT DEFAULT 'all' CHECK (visibility IN ('all', 'team', 'agents', 'internal')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de anexos (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    comment_id INTEGER, -- Se anexo for de um comentário específico
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- SLA AND ESCALATION TABLES (UPDATED)
-- ========================================

-- Tabela de políticas SLA (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS sla_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    ticket_type_id INTEGER,
    priority_id INTEGER,
    category_id INTEGER,
    team_id INTEGER, -- SLA específico para uma equipe
    response_time_minutes INTEGER NOT NULL,
    resolution_time_minutes INTEGER NOT NULL,
    escalation_time_minutes INTEGER,
    business_hours_only BOOLEAN DEFAULT FALSE,
    escalation_chain TEXT, -- JSON array of escalation steps
    breach_actions TEXT, -- JSON array of actions on SLA breach
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE SET NULL,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

-- Tabela de tracking de SLA (atualizada)
CREATE TABLE IF NOT EXISTS sla_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    sla_policy_id INTEGER NOT NULL,
    response_due_at DATETIME,
    resolution_due_at DATETIME,
    escalation_due_at DATETIME,
    response_met BOOLEAN DEFAULT FALSE,
    resolution_met BOOLEAN DEFAULT FALSE,
    response_time_minutes INTEGER,
    resolution_time_minutes INTEGER,
    breach_reason TEXT,
    pause_start_time DATETIME, -- Para pausar SLA
    total_paused_minutes INTEGER DEFAULT 0,
    is_paused BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE RESTRICT
);

-- ========================================
-- WORKFLOW AND APPROVAL TABLES
-- ========================================

-- Tabela de workflows de aprovação
CREATE TABLE IF NOT EXISTS approval_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    ticket_type_id INTEGER,
    category_id INTEGER,
    conditions TEXT, -- JSON object with conditions
    approval_steps TEXT NOT NULL, -- JSON array of approval steps
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Tabela de solicitações de aprovação
CREATE TABLE IF NOT EXISTS approval_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    workflow_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
    comments TEXT,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- NOTIFICATIONS AND COMMUNICATIONS
-- ========================================

-- Tabela de notificações (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    ticket_id INTEGER,
    type TEXT NOT NULL CHECK (type IN ('ticket_assigned', 'ticket_updated', 'ticket_resolved', 'ticket_escalated', 'sla_warning', 'sla_breach', 'escalation', 'comment_added', 'approval_required', 'approval_completed', 'system_alert')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT, -- JSON data for additional notification context
    channels TEXT, -- JSON array of notification channels ['email', 'sms', 'push', 'slack']
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    is_read BOOLEAN DEFAULT FALSE,
    sent_via_email BOOLEAN DEFAULT FALSE,
    email_sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Tabela de configurações de notificação por usuário
CREATE TABLE IF NOT EXISTS user_notification_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    slack_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, notification_type)
);

-- ========================================
-- KNOWLEDGE BASE (UPDATED FOR MULTI-TENANT)
-- ========================================

-- Tabela de categorias KB (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS kb_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER, -- NULL = global category
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'DocumentTextIcon',
    color TEXT DEFAULT '#3B82F6',
    parent_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'team_specific')),
    team_access TEXT, -- JSON array of team IDs if team_specific
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES kb_categories(id) ON DELETE SET NULL
);

-- Tabela de artigos KB (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS kb_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER, -- NULL = global article
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'html',
    category_id INTEGER,
    author_id INTEGER NOT NULL,
    reviewer_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'team_specific')),
    team_access TEXT, -- JSON array of team IDs if team_specific
    featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    search_keywords TEXT,
    meta_title TEXT,
    meta_description TEXT,
    published_at DATETIME,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- ANALYTICS AND REPORTING (UPDATED)
-- ========================================

-- Tabela de métricas diárias (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    date DATE NOT NULL,
    ticket_type_id INTEGER,
    team_id INTEGER,
    tickets_created INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    tickets_reopened INTEGER DEFAULT 0,
    avg_first_response_time INTEGER,
    avg_resolution_time INTEGER,
    satisfaction_score DECIMAL(3,2),
    satisfaction_responses INTEGER DEFAULT 0,
    sla_breaches INTEGER DEFAULT 0,
    escalations INTEGER DEFAULT 0,
    kb_articles_viewed INTEGER DEFAULT 0,
    kb_searches_performed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE SET NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, date, ticket_type_id, team_id)
);

-- Tabela de métricas por agente (atualizada)
CREATE TABLE IF NOT EXISTS analytics_agent_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    team_id INTEGER,
    date DATE NOT NULL,
    tickets_assigned INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_first_response_time INTEGER,
    avg_resolution_time INTEGER,
    satisfaction_score DECIMAL(3,2),
    satisfaction_responses INTEGER DEFAULT 0,
    workload_percentage INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, agent_id, team_id, date)
);

-- ========================================
-- TENANT SETTINGS AND CONFIGURATION
-- ========================================

-- Tabela de configurações específicas por tenant
CREATE TABLE IF NOT EXISTS tenant_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    category TEXT NOT NULL, -- 'general', 'branding', 'notifications', 'security', etc.
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Se pode ser acessado pelo frontend
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, category, key)
);

-- Tabela de sessões de usuários (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    socket_id TEXT,
    user_agent TEXT,
    ip_address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- AUDIT AND SECURITY
-- ========================================

-- Tabela de logs de auditoria (atualizada para multi-tenant)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Tenant-related indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

-- Ticket Types
CREATE INDEX IF NOT EXISTS idx_ticket_types_tenant ON ticket_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_workflow ON ticket_types(workflow_type);

-- Teams
CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teams_manager ON teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_teams_parent ON teams(parent_team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- Users (updated indexes)
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Categories, Priorities, Statuses
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_priorities_tenant ON priorities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statuses_tenant ON statuses(tenant_id);

-- Tickets (updated indexes)
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_number ON tickets(tenant_id, ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_user ON tickets(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_assigned ON tickets(tenant_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_team ON tickets(tenant_id, assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_type ON tickets(tenant_id, ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON tickets(tenant_id, status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_created ON tickets(tenant_id, created_at);

-- Comments, Attachments
CREATE INDEX IF NOT EXISTS idx_comments_tenant ON comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attachments_tenant ON attachments(tenant_id);

-- SLA
CREATE INDEX IF NOT EXISTS idx_sla_policies_tenant ON sla_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_tenant ON sla_tracking(tenant_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications(tenant_id, user_id);

-- Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_daily_tenant ON analytics_daily_metrics(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_agent_tenant ON analytics_agent_metrics(tenant_id, agent_id, date);

-- Knowledge Base
CREATE INDEX IF NOT EXISTS idx_kb_categories_tenant ON kb_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant ON kb_articles(tenant_id);

-- Settings and Sessions
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant ON user_sessions(tenant_id);

-- Audit
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity ON audit_logs(tenant_id, entity_type, entity_id);

-- ========================================
-- TRIGGERS FOR AUTOMATION
-- ========================================

-- Trigger para updated_at em todas as tabelas
CREATE TRIGGER IF NOT EXISTS update_tenants_updated_at
    AFTER UPDATE ON tenants
    BEGIN
        UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_ticket_types_updated_at
    AFTER UPDATE ON ticket_types
    BEGIN
        UPDATE ticket_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_teams_updated_at
    AFTER UPDATE ON teams
    BEGIN
        UPDATE teams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para gerar número do ticket automaticamente
CREATE TRIGGER IF NOT EXISTS generate_ticket_number
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
                strftime('%Y', 'now') || '-' ||
                printf('%06d', NEW.id)
            FROM ticket_types tt
            WHERE tt.id = NEW.ticket_type_id
        )
        WHERE id = NEW.id;
    END;

-- Trigger para criar SLA tracking automaticamente
CREATE TRIGGER IF NOT EXISTS create_sla_tracking_on_ticket_insert_mt
    AFTER INSERT ON tickets
    BEGIN
        INSERT INTO sla_tracking (tenant_id, ticket_id, sla_policy_id, response_due_at, resolution_due_at, escalation_due_at)
        SELECT
            NEW.tenant_id,
            NEW.id,
            sp.id,
            DATETIME(NEW.created_at, '+' || sp.response_time_minutes || ' minutes'),
            DATETIME(NEW.created_at, '+' || sp.resolution_time_minutes || ' minutes'),
            CASE WHEN sp.escalation_time_minutes IS NOT NULL
                 THEN DATETIME(NEW.created_at, '+' || sp.escalation_time_minutes || ' minutes')
                 ELSE NULL END
        FROM sla_policies sp
        WHERE sp.tenant_id = NEW.tenant_id
          AND sp.is_active = 1
          AND (sp.ticket_type_id IS NULL OR sp.ticket_type_id = NEW.ticket_type_id)
          AND (sp.priority_id IS NULL OR sp.priority_id = NEW.priority_id)
          AND (sp.category_id IS NULL OR sp.category_id = NEW.category_id)
          AND (sp.team_id IS NULL OR sp.team_id = NEW.assigned_team_id)
        ORDER BY
            CASE WHEN sp.team_id = NEW.assigned_team_id THEN 1 ELSE 2 END,
            CASE WHEN sp.category_id = NEW.category_id THEN 1 ELSE 2 END,
            CASE WHEN sp.ticket_type_id = NEW.ticket_type_id THEN 1 ELSE 2 END,
            sp.id
        LIMIT 1;
    END;