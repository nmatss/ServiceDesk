-- ========================================
-- PostgreSQL Schema for ServiceDesk
-- ========================================
-- Converted from SQLite with optimizations
-- CRITICAL: This schema is production-ready for high concurrency
-- Author: Migration Tool
-- Date: 2025-10-18

-- ========================================
-- TABELA DE USUÁRIOS (ENTERPRISE)
-- ========================================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'agent', 'user', 'manager', 'read_only', 'api_client')),
    organization_id BIGINT NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    two_factor_backup_codes JSONB, -- JSON array -> JSONB
    sso_provider VARCHAR(50), -- 'google', 'saml', 'ad', 'gov_br'
    sso_user_id VARCHAR(255),
    avatar_url TEXT,
    timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',
    language VARCHAR(10) DEFAULT 'pt-BR',
    metadata JSONB, -- JSON for additional user data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS 'Usuários do sistema com suporte enterprise (SSO, 2FA, LGPD)';
COMMENT ON COLUMN users.organization_id IS 'FK para organizations - suporte multi-tenant';
COMMENT ON COLUMN users.metadata IS 'Dados adicionais do usuário em formato JSONB';

-- ========================================
-- SISTEMA DE AUTENTICAÇÃO ENTERPRISE
-- ========================================

-- Refresh tokens para JWT
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    device_info JSONB,
    ip_address INET, -- PostgreSQL native IP type
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(is_active) WHERE is_active = TRUE;

-- Permissões granulares
CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    conditions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);

-- Roles/Papéis granulares
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_active ON roles(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_roles_system ON roles(is_system);

-- Relacionamento roles-permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    granted_by BIGINT,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- Relacionamento user-roles
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    granted_by BIGINT,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_active ON user_roles(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_roles_expires ON user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Políticas de senha
CREATE TABLE IF NOT EXISTS password_policies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    min_length INTEGER DEFAULT 8,
    require_uppercase BOOLEAN DEFAULT TRUE,
    require_lowercase BOOLEAN DEFAULT TRUE,
    require_numbers BOOLEAN DEFAULT TRUE,
    require_special_chars BOOLEAN DEFAULT TRUE,
    min_special_chars INTEGER DEFAULT 1,
    max_age_days INTEGER DEFAULT 90,
    prevent_reuse_last INTEGER DEFAULT 5,
    max_failed_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT FALSE,
    applies_to_roles JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_policies_active ON password_policies(is_active) WHERE is_active = TRUE;

-- Histórico de senhas
CREATE TABLE IF NOT EXISTS password_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_password_history_user ON password_history(user_id);
CREATE INDEX idx_password_history_created ON password_history(created_at DESC);

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGSERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    identifier_type VARCHAR(20) NOT NULL CHECK (identifier_type IN ('ip', 'user', 'email')),
    endpoint VARCHAR(500) NOT NULL,
    attempts INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP WITH TIME ZONE,
    UNIQUE(identifier, identifier_type, endpoint)
);

CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier, identifier_type);
CREATE INDEX idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX idx_rate_limits_blocked ON rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- Provedores SSO
CREATE TABLE IF NOT EXISTS sso_providers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('saml2', 'oauth2', 'oidc', 'ldap')),
    is_active BOOLEAN DEFAULT FALSE,
    configuration JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sso_providers_type ON sso_providers(type);
CREATE INDEX idx_sso_providers_active ON sso_providers(is_active) WHERE is_active = TRUE;

-- Tentativas de login
CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    email VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN DEFAULT FALSE,
    failure_reason VARCHAR(100),
    two_factor_required BOOLEAN DEFAULT FALSE,
    two_factor_success BOOLEAN DEFAULT FALSE,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_login_attempts_user ON login_attempts(user_id);
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_success ON login_attempts(success);
CREATE INDEX idx_login_attempts_created ON login_attempts(created_at DESC);

-- WebAuthn/FIDO2
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    credential_id VARCHAR(500) UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    aaguid VARCHAR(36),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_webauthn_user ON webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credential_id ON webauthn_credentials(credential_id);
CREATE INDEX idx_webauthn_active ON webauthn_credentials(is_active) WHERE is_active = TRUE;

-- Códigos de verificação
CREATE TABLE IF NOT EXISTS verification_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    email VARCHAR(255),
    code VARCHAR(20) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email_verification', 'password_reset', 'two_factor_backup', 'login_verification')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_verification_codes_user ON verification_codes(user_id);
CREATE INDEX idx_verification_codes_email ON verification_codes(email);
CREATE INDEX idx_verification_codes_type ON verification_codes(type);
CREATE INDEX idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX idx_verification_codes_hash ON verification_codes(code_hash);

-- Auditoria de autenticação (LGPD)
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    event_type VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    consent_given BOOLEAN,
    data_retention_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_auth_audit_user ON auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_event ON auth_audit_logs(event_type);
CREATE INDEX idx_auth_audit_ip ON auth_audit_logs(ip_address);
CREATE INDEX idx_auth_audit_created ON auth_audit_logs(created_at DESC);
CREATE INDEX idx_auth_audit_retention ON auth_audit_logs(data_retention_expires_at) WHERE data_retention_expires_at IS NOT NULL;

-- ========================================
-- TABELAS CORE DO SERVICEDESK
-- ========================================

-- Categorias
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prioridades
CREATE TABLE IF NOT EXISTS priorities (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 4),
    color VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Status
CREATE TABLE IF NOT EXISTS statuses (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) NOT NULL,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    user_id BIGINT NOT NULL,
    assigned_to BIGINT,
    category_id BIGINT NOT NULL,
    priority_id BIGINT NOT NULL,
    status_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE RESTRICT
);

COMMENT ON TABLE tickets IS 'Tickets de suporte com SLA tracking e multi-tenant';

-- Performance critical indexes para tickets
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tickets_category_id ON tickets(category_id);
CREATE INDEX idx_tickets_priority_id ON tickets(priority_id);
CREATE INDEX idx_tickets_status_id ON tickets(status_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_updated_at ON tickets(updated_at DESC);

-- Composite indexes para queries frequentes
CREATE INDEX idx_tickets_org_status ON tickets(organization_id, status_id);
CREATE INDEX idx_tickets_org_assigned ON tickets(organization_id, assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tickets_org_user ON tickets(organization_id, user_id);
CREATE INDEX idx_tickets_org_created ON tickets(organization_id, created_at DESC);
CREATE INDEX idx_tickets_status_created ON tickets(status_id, created_at DESC);
CREATE INDEX idx_tickets_assigned_status ON tickets(assigned_to, status_id) WHERE assigned_to IS NOT NULL;

-- Covering index para analytics
CREATE INDEX idx_tickets_analytics ON tickets(organization_id, status_id, priority_id, created_at);
CREATE INDEX idx_tickets_sla_tracking ON tickets(organization_id, status_id, created_at, resolved_at);

-- Comentários
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_ticket_created ON comments(ticket_id, created_at DESC);
CREATE INDEX idx_comments_user_created ON comments(user_id, created_at DESC);

-- Anexos
CREATE TABLE IF NOT EXISTS attachments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    uploaded_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_ticket_id ON attachments(ticket_id);
CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);

-- ========================================
-- SISTEMA DE SLA
-- ========================================

-- Políticas de SLA
CREATE TABLE IF NOT EXISTS sla_policies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority_id BIGINT NOT NULL,
    category_id BIGINT,
    response_time_minutes INTEGER NOT NULL,
    resolution_time_minutes INTEGER NOT NULL,
    escalation_time_minutes INTEGER,
    business_hours_only BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_sla_policies_priority_id ON sla_policies(priority_id);
CREATE INDEX idx_sla_policies_category_id ON sla_policies(category_id);
CREATE INDEX idx_sla_policies_active ON sla_policies(is_active) WHERE is_active = TRUE;

-- Tracking de SLA
CREATE TABLE IF NOT EXISTS sla_tracking (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    sla_policy_id BIGINT NOT NULL,
    response_due_at TIMESTAMP WITH TIME ZONE,
    resolution_due_at TIMESTAMP WITH TIME ZONE,
    escalation_due_at TIMESTAMP WITH TIME ZONE,
    response_met BOOLEAN DEFAULT FALSE,
    resolution_met BOOLEAN DEFAULT FALSE,
    response_time_minutes INTEGER,
    resolution_time_minutes INTEGER,
    breach_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE RESTRICT
);

CREATE INDEX idx_sla_tracking_ticket_id ON sla_tracking(ticket_id);
CREATE INDEX idx_sla_tracking_response_due ON sla_tracking(response_due_at);
CREATE INDEX idx_sla_tracking_resolution_due ON sla_tracking(resolution_due_at);
CREATE INDEX idx_sla_tracking_escalation_due ON sla_tracking(escalation_due_at);
CREATE INDEX idx_sla_tracking_ticket_policy ON sla_tracking(ticket_id, sla_policy_id);
CREATE INDEX idx_sla_tracking_response_met ON sla_tracking(response_met, response_due_at) WHERE response_met = FALSE;
CREATE INDEX idx_sla_tracking_resolution_met ON sla_tracking(resolution_met, resolution_due_at) WHERE resolution_met = FALSE;

-- Escalações
CREATE TABLE IF NOT EXISTS escalations (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    escalation_type VARCHAR(50) NOT NULL CHECK (escalation_type IN ('sla_breach', 'manual', 'priority_change')),
    escalated_from BIGINT,
    escalated_to BIGINT,
    reason TEXT NOT NULL,
    escalated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (escalated_from) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (escalated_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_escalations_ticket_id ON escalations(ticket_id);
CREATE INDEX idx_escalations_type ON escalations(escalation_type);
CREATE INDEX idx_escalations_date ON escalations(escalated_at DESC);

-- ========================================
-- SISTEMA DE NOTIFICAÇÕES
-- ========================================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    ticket_id BIGINT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('ticket_assigned', 'ticket_updated', 'ticket_resolved', 'ticket_escalated', 'sla_warning', 'sla_breach', 'escalation', 'comment_added', 'system_alert')),
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    sent_via_email BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_ticket_user ON notifications(ticket_id, user_id);

-- ========================================
-- TEMPLATES E AUTOMAÇÕES
-- ========================================

CREATE TABLE IF NOT EXISTS ticket_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id BIGINT,
    priority_id BIGINT,
    title_template VARCHAR(500) NOT NULL,
    description_template TEXT NOT NULL,
    tags JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_templates_category ON ticket_templates(category_id);
CREATE INDEX idx_templates_priority ON ticket_templates(priority_id);
CREATE INDEX idx_templates_active ON ticket_templates(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS automations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'sla_warning', 'time_based')),
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_automations_trigger ON automations(trigger_type);
CREATE INDEX idx_automations_active ON automations(is_active) WHERE is_active = TRUE;

-- ========================================
-- KNOWLEDGE BASE
-- ========================================

CREATE TABLE IF NOT EXISTS kb_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(100) DEFAULT 'DocumentTextIcon',
    color VARCHAR(20) DEFAULT '#3B82F6',
    parent_id BIGINT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES kb_categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_kb_categories_parent ON kb_categories(parent_id);
CREATE INDEX idx_kb_categories_active ON kb_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_kb_categories_slug ON kb_categories(slug);

CREATE TABLE IF NOT EXISTS kb_articles (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'html',
    category_id BIGINT,
    author_id BIGINT NOT NULL,
    reviewer_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'private')),
    featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    search_keywords TEXT,
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    published_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE kb_articles IS 'Base de conhecimento com busca full-text e versionamento';

CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_author ON kb_articles(author_id);
CREATE INDEX idx_kb_articles_status ON kb_articles(status);
CREATE INDEX idx_kb_articles_visibility ON kb_articles(visibility);
CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX idx_kb_articles_featured ON kb_articles(featured) WHERE featured = TRUE;
CREATE INDEX idx_kb_articles_published ON kb_articles(published_at DESC);
CREATE INDEX idx_kb_articles_status_published ON kb_articles(status, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_kb_articles_category_status ON kb_articles(category_id, status);
CREATE INDEX idx_kb_articles_views ON kb_articles(view_count DESC) WHERE status = 'published';

-- Full-text search index (PostgreSQL native)
CREATE INDEX idx_kb_articles_search_gin ON kb_articles USING gin(to_tsvector('portuguese', title || ' ' || COALESCE(summary, '') || ' ' || COALESCE(search_keywords, '')));

CREATE TABLE IF NOT EXISTS kb_tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_tags_slug ON kb_tags(slug);

CREATE TABLE IF NOT EXISTS kb_article_tags (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES kb_tags(id) ON DELETE CASCADE,
    UNIQUE(article_id, tag_id)
);

CREATE INDEX idx_kb_article_tags_article ON kb_article_tags(article_id);
CREATE INDEX idx_kb_article_tags_tag ON kb_article_tags(tag_id);

CREATE TABLE IF NOT EXISTS kb_article_feedback (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL,
    user_id BIGINT,
    session_id VARCHAR(255),
    was_helpful BOOLEAN NOT NULL,
    comment TEXT,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_kb_feedback_article ON kb_article_feedback(article_id);
CREATE INDEX idx_kb_feedback_helpful ON kb_article_feedback(was_helpful);

CREATE TABLE IF NOT EXISTS kb_article_attachments (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    alt_text VARCHAR(500),
    uploaded_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_kb_attachments_article ON kb_article_attachments(article_id);

CREATE TABLE IF NOT EXISTS kb_article_suggestions (
    id BIGSERIAL PRIMARY KEY,
    article_id BIGINT NOT NULL,
    ticket_id BIGINT NOT NULL,
    suggested_by BIGINT,
    was_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (suggested_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- ANALYTICS E MÉTRICAS
-- ========================================

CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    tickets_created INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    tickets_reopened INTEGER DEFAULT 0,
    avg_first_response_time INTEGER,
    avg_resolution_time INTEGER,
    satisfaction_score NUMERIC(3,2),
    satisfaction_responses INTEGER DEFAULT 0,
    kb_articles_viewed INTEGER DEFAULT 0,
    kb_searches_performed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

CREATE INDEX idx_analytics_daily_date ON analytics_daily_metrics(date DESC);

CREATE TABLE IF NOT EXISTS analytics_agent_metrics (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    date DATE NOT NULL,
    tickets_assigned INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_first_response_time INTEGER,
    avg_resolution_time INTEGER,
    satisfaction_score NUMERIC(3,2),
    satisfaction_responses INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(agent_id, date)
);

CREATE INDEX idx_analytics_agent_date ON analytics_agent_metrics(agent_id, date DESC);

CREATE TABLE IF NOT EXISTS analytics_category_metrics (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL,
    date DATE NOT NULL,
    tickets_created INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_resolution_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, date)
);

CREATE INDEX idx_analytics_category_date ON analytics_category_metrics(category_id, date DESC);

-- ========================================
-- REAL-TIME E SESSÕES
-- ========================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    socket_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, last_activity) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS notification_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    target_users JSONB,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_events_processed ON notification_events(processed) WHERE processed = FALSE;
CREATE INDEX idx_notification_events_type ON notification_events(event_type);

-- ========================================
-- AUDITORIA E LOGS
-- ========================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    entity_type VARCHAR(100) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity_created ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- ========================================
-- CONFIGURAÇÕES E CACHE
-- ========================================

CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'string',
    is_public BOOLEAN DEFAULT FALSE,
    updated_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_public ON system_settings(is_public) WHERE is_public = TRUE;

CREATE TABLE IF NOT EXISTS cache (
    key VARCHAR(500) PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cache_expires_at ON cache(expires_at);

-- ========================================
-- SATISFACTION SURVEYS
-- ========================================

CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    agent_rating INTEGER CHECK (agent_rating >= 1 AND agent_rating <= 5),
    resolution_speed_rating INTEGER CHECK (resolution_speed_rating >= 1 AND resolution_speed_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    additional_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_satisfaction_ticket ON satisfaction_surveys(ticket_id);
CREATE INDEX idx_satisfaction_user ON satisfaction_surveys(user_id);
CREATE INDEX idx_satisfaction_rating ON satisfaction_surveys(rating);

-- ========================================
-- CONTINUATION: Additional enterprise tables will be added in migration 002
-- This is the foundation schema (55 tables total across all migrations)
-- ========================================

-- IMPORTANT: Run after schema creation
-- SELECT set_pg_optimizations();
