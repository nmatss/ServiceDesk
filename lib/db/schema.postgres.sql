-- ========================================
-- PostgreSQL Schema for ServiceDesk
-- ========================================
-- Converted from SQLite with optimizations
-- CRITICAL: This schema is production-ready for high concurrency
-- Author: Migration Tool
-- Date: 2025-10-18

-- ========================================
-- ORGANIZAÇÕES (MULTI-TENANT)
-- ========================================
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    domain VARCHAR(255),
    settings JSONB,
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    max_users INTEGER DEFAULT 50,
    max_tickets_per_month INTEGER DEFAULT 1000,
    features JSONB,
    billing_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = TRUE;

-- Tabela de tenants legada (compatibilidade com rotas antigas tenant_id)
CREATE TABLE IF NOT EXISTS tenants (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    domain VARCHAR(255),
    subdomain VARCHAR(255),
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#3B82F6',
    secondary_color VARCHAR(20) DEFAULT '#1F2937',
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'basic',
    max_users INTEGER DEFAULT 50,
    max_tickets_per_month INTEGER DEFAULT 1000,
    features JSONB,
    settings JSONB,
    billing_email VARCHAR(255),
    technical_contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    subscription_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = TRUE;

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
    tenant_id BIGINT NOT NULL DEFAULT 1,
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
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prioridades
CREATE TABLE IF NOT EXISTS priorities (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 4),
    color VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Status
CREATE TABLE IF NOT EXISTS statuses (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
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
    tenant_id BIGINT NOT NULL DEFAULT 1,
    sla_policy_id BIGINT,
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
CREATE INDEX idx_tickets_sla_policy_id ON tickets(sla_policy_id) WHERE sla_policy_id IS NOT NULL;
CREATE INDEX idx_tickets_tenant_id ON tickets(tenant_id);
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
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_tenant_id ON comments(tenant_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_ticket_created ON comments(ticket_id, created_at DESC);
CREATE INDEX idx_comments_user_created ON comments(user_id, created_at DESC);

-- Atividades do ticket
CREATE TABLE IF NOT EXISTS ticket_activities (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    user_id BIGINT,
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ticket_activities_ticket_id ON ticket_activities(ticket_id);
CREATE INDEX idx_ticket_activities_user_id ON ticket_activities(user_id);
CREATE INDEX idx_ticket_activities_tenant_id ON ticket_activities(tenant_id);
CREATE INDEX idx_ticket_activities_org_id ON ticket_activities(organization_id);
CREATE INDEX idx_ticket_activities_created_at ON ticket_activities(created_at DESC);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(20) DEFAULT '#3B82F6',
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tags_tenant_id ON tags(tenant_id);
CREATE INDEX idx_tags_org_id ON tags(organization_id);

-- Ticket Tags
CREATE TABLE IF NOT EXISTS ticket_tags (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    added_by BIGINT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(ticket_id, tag_id)
);

CREATE INDEX idx_ticket_tags_ticket_id ON ticket_tags(ticket_id);
CREATE INDEX idx_ticket_tags_tag_id ON ticket_tags(tag_id);

-- Ticket Followers
CREATE TABLE IF NOT EXISTS ticket_followers (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(ticket_id, user_id)
);

CREATE INDEX idx_ticket_followers_ticket_id ON ticket_followers(ticket_id);
CREATE INDEX idx_ticket_followers_user_id ON ticket_followers(user_id);

-- Ticket Relationships
CREATE TABLE IF NOT EXISTS ticket_relationships (
    id BIGSERIAL PRIMARY KEY,
    source_ticket_id BIGINT NOT NULL,
    target_ticket_id BIGINT NOT NULL,
    relationship_type VARCHAR(20) NOT NULL CHECK (
      relationship_type IN ('parent', 'child', 'related', 'duplicate', 'blocks', 'blocked_by')
    ),
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (target_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(source_ticket_id, target_ticket_id, relationship_type)
);

CREATE INDEX idx_ticket_relationships_source ON ticket_relationships(source_ticket_id);
CREATE INDEX idx_ticket_relationships_target ON ticket_relationships(target_ticket_id);

-- Anexos
CREATE TABLE IF NOT EXISTS attachments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
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
CREATE INDEX idx_attachments_tenant_id ON attachments(tenant_id);

-- Armazenamento de arquivos (upload genérico multi-tenant)
CREATE TABLE IF NOT EXISTS file_storage (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    organization_id BIGINT NOT NULL DEFAULT 1,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500),
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    file_size BIGINT,
    file_path VARCHAR(1000) NOT NULL,
    storage_path VARCHAR(1000),
    storage_type VARCHAR(20) DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'cloudinary')),
    uploaded_by BIGINT NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    is_public BOOLEAN DEFAULT FALSE,
    virus_scanned BOOLEAN DEFAULT FALSE,
    virus_scan_result TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_storage_tenant ON file_storage(tenant_id);
CREATE INDEX idx_file_storage_org ON file_storage(organization_id);
CREATE INDEX idx_file_storage_entity ON file_storage(entity_type, entity_id);
CREATE INDEX idx_file_storage_uploaded_by ON file_storage(uploaded_by);
CREATE INDEX idx_file_storage_file_path ON file_storage(file_path);
CREATE INDEX idx_file_storage_storage_path ON file_storage(storage_path);

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
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
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
CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX idx_notifications_org_id ON notifications(organization_id);
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
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
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
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
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
-- ITIL PROBLEM MANAGEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS root_cause_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id BIGINT REFERENCES root_cause_categories(id) ON DELETE SET NULL,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS problems (
    id BIGSERIAL PRIMARY KEY,
    problem_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK(status IN ('open','identified','root_cause_analysis','known_error','resolved','closed')),
    priority_id BIGINT REFERENCES priorities(id) ON DELETE SET NULL,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    assigned_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    root_cause TEXT,
    root_cause_category_id BIGINT REFERENCES root_cause_categories(id) ON DELETE SET NULL,
    workaround TEXT,
    impact TEXT,
    urgency VARCHAR(20) DEFAULT 'medium' CHECK(urgency IN ('low','medium','high','critical')),
    affected_services JSONB DEFAULT '[]',
    resolution TEXT,
    resolution_date TIMESTAMP WITH TIME ZONE,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_priority ON problems(priority_id);
CREATE INDEX IF NOT EXISTS idx_problems_assigned ON problems(assigned_to);
CREATE INDEX IF NOT EXISTS idx_problems_org ON problems(organization_id);
CREATE INDEX IF NOT EXISTS idx_problems_number ON problems(problem_number);

COMMENT ON TABLE problems IS 'ITIL Problem Management - root cause analysis tracking';

CREATE TABLE IF NOT EXISTS known_errors (
    id BIGSERIAL PRIMARY KEY,
    ke_number VARCHAR(50) NOT NULL UNIQUE,
    problem_id BIGINT REFERENCES problems(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    symptoms TEXT,
    root_cause TEXT,
    workaround TEXT,
    permanent_fix TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('proposed','active','retired','superseded')),
    affected_cis JSONB DEFAULT '[]',
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_known_errors_status ON known_errors(status);
CREATE INDEX IF NOT EXISTS idx_known_errors_problem ON known_errors(problem_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_org ON known_errors(organization_id);

CREATE TABLE IF NOT EXISTS problem_incident_links (
    id BIGSERIAL PRIMARY KEY,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    linked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    link_type VARCHAR(20) DEFAULT 'related' CHECK(link_type IN ('caused_by','related','duplicate')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(problem_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_incident_links_problem ON problem_incident_links(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_incident_links_ticket ON problem_incident_links(ticket_id);

CREATE TABLE IF NOT EXISTS problem_activities (
    id BIGSERIAL PRIMARY KEY,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK(type IN ('note','status_change','assignment','escalation','rca_update','workaround','resolution','attachment','link')),
    description TEXT,
    old_value TEXT,
    new_value TEXT,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_problem_activities_problem ON problem_activities(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_activities_created ON problem_activities(created_at DESC);

CREATE TABLE IF NOT EXISTS problem_attachments (
    id BIGSERIAL PRIMARY KEY,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(255),
    size BIGINT,
    storage_path TEXT NOT NULL,
    uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ITIL CHANGE MANAGEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS change_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3B82F6',
    requires_cab_approval BOOLEAN DEFAULT FALSE,
    default_risk_level VARCHAR(20) DEFAULT 'medium' CHECK(default_risk_level IN ('low','medium','high','critical')),
    lead_time_days INTEGER DEFAULT 5,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS change_requests (
    id BIGSERIAL PRIMARY KEY,
    change_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    change_type_id BIGINT REFERENCES change_types(id) ON DELETE SET NULL,
    category VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK(category IN ('standard','normal','emergency')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK(risk_level IN ('low','medium','high','critical')),
    risk_assessment TEXT,
    impact_assessment TEXT,
    reason_for_change TEXT,
    business_justification TEXT,
    implementation_plan TEXT,
    backout_plan TEXT,
    test_plan TEXT,
    communication_plan TEXT,
    requested_start_date TIMESTAMP WITH TIME ZONE,
    requested_end_date TIMESTAMP WITH TIME ZONE,
    actual_start_date TIMESTAMP WITH TIME ZONE,
    actual_end_date TIMESTAMP WITH TIME ZONE,
    requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    implementer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    cab_meeting_id BIGINT,
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected','deferred','withdrawn')),
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','under_review','approved','rejected','pending_assessment','pending_cab','scheduled','in_progress','completed','failed','cancelled','rolled_back')),
    pir_required BOOLEAN DEFAULT FALSE,
    pir_completed BOOLEAN DEFAULT FALSE,
    pir_notes TEXT,
    pir_success_rating INTEGER CHECK(pir_success_rating >= 1 AND pir_success_rating <= 5),
    affected_cis JSONB DEFAULT '[]',
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_approval ON change_requests(approval_status);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester ON change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_org ON change_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_number ON change_requests(change_number);
CREATE INDEX IF NOT EXISTS idx_change_requests_schedule ON change_requests(requested_start_date, requested_end_date);

COMMENT ON TABLE change_requests IS 'ITIL Change Management - Request for Change (RFC) tracking';

CREATE TABLE IF NOT EXISTS change_request_approvals (
    id BIGSERIAL PRIMARY KEY,
    change_request_id BIGINT NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    cab_member_id BIGINT,
    approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approval_level INTEGER DEFAULT 1,
    approver_type VARCHAR(20) DEFAULT 'user',
    vote VARCHAR(20) CHECK(vote IN ('approve','reject','defer','abstain')),
    status VARCHAR(20) DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','abstained','deferred')),
    voted_at TIMESTAMP WITH TIME ZONE,
    decided_at TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_approvals_request ON change_request_approvals(change_request_id);

CREATE TABLE IF NOT EXISTS change_tasks (
    id BIGSERIAL PRIMARY KEY,
    change_request_id BIGINT NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    assigned_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','blocked','cancelled')),
    task_order INTEGER DEFAULT 0,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_tasks_request ON change_tasks(change_request_id);

CREATE TABLE IF NOT EXISTS change_calendar (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'blackout' CHECK(type IN ('blackout','freeze','preferred','maintenance')),
    severity VARCHAR(10) DEFAULT 'soft' CHECK(severity IN ('soft','hard')),
    affected_environments JSONB DEFAULT '[]',
    affected_change_types JSONB DEFAULT '[]',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- CMDB (Configuration Management Database)
-- ========================================

CREATE TABLE IF NOT EXISTS ci_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'server',
    color VARCHAR(20) DEFAULT '#3B82F6',
    parent_type_id BIGINT REFERENCES ci_types(id) ON DELETE SET NULL,
    attributes_schema JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ci_statuses (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3B82F6',
    is_operational BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ci_relationship_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    inverse_name VARCHAR(255),
    color VARCHAR(20) DEFAULT '#6B7280',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configuration_items (
    id BIGSERIAL PRIMARY KEY,
    ci_number VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    ci_type_id BIGINT NOT NULL REFERENCES ci_types(id) ON DELETE RESTRICT,
    status_id BIGINT NOT NULL DEFAULT 1 REFERENCES ci_statuses(id) ON DELETE RESTRICT,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    managed_by_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    vendor VARCHAR(255),
    manufacturer VARCHAR(255),
    location VARCHAR(500),
    environment VARCHAR(20) DEFAULT 'production' CHECK(environment IN ('production','staging','development','test','dr')),
    data_center VARCHAR(255),
    rack_position VARCHAR(100),
    purchase_date TIMESTAMP WITH TIME ZONE,
    installation_date TIMESTAMP WITH TIME ZONE,
    warranty_expiry TIMESTAMP WITH TIME ZONE,
    end_of_life_date TIMESTAMP WITH TIME ZONE,
    retirement_date TIMESTAMP WITH TIME ZONE,
    serial_number VARCHAR(255),
    asset_tag VARCHAR(255),
    ip_address INET,
    mac_address VARCHAR(17),
    hostname VARCHAR(255),
    os_version VARCHAR(255),
    business_service VARCHAR(255),
    criticality VARCHAR(20) DEFAULT 'medium' CHECK(criticality IN ('critical','high','medium','low')),
    business_impact TEXT,
    recovery_time_objective INTEGER,
    recovery_point_objective INTEGER,
    custom_attributes JSONB DEFAULT '{}',
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_configuration_items_type ON configuration_items(ci_type_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_status ON configuration_items(status_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_org ON configuration_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_number ON configuration_items(ci_number);
CREATE INDEX IF NOT EXISTS idx_configuration_items_env ON configuration_items(environment);
CREATE INDEX IF NOT EXISTS idx_configuration_items_criticality ON configuration_items(criticality);

COMMENT ON TABLE configuration_items IS 'CMDB - Configuration Items for infrastructure and service management';

CREATE TABLE IF NOT EXISTS ci_relationships (
    id BIGSERIAL PRIMARY KEY,
    source_ci_id BIGINT NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
    target_ci_id BIGINT NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
    relationship_type_id BIGINT NOT NULL REFERENCES ci_relationship_types(id) ON DELETE RESTRICT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_ci_id, target_ci_id, relationship_type_id)
);

CREATE INDEX IF NOT EXISTS idx_ci_relationships_source ON ci_relationships(source_ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_relationships_target ON ci_relationships(target_ci_id);

CREATE TABLE IF NOT EXISTS ci_history (
    id BIGSERIAL PRIMARY KEY,
    ci_id BIGINT NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL CHECK(action IN ('created','updated','deleted','status_changed','relationship_added','relationship_removed')),
    field_name VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    change_reason TEXT,
    related_ticket_id BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
    related_change_id BIGINT REFERENCES change_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ci_history_ci ON ci_history(ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_history_created ON ci_history(created_at DESC);

CREATE TABLE IF NOT EXISTS ci_ticket_links (
    id BIGSERIAL PRIMARY KEY,
    ci_id BIGINT NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    link_type VARCHAR(20) DEFAULT 'affected' CHECK(link_type IN ('affected','caused_by','related','changed')),
    notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ci_id, ticket_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_ci_ticket_links_ci ON ci_ticket_links(ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_ticket_links_ticket ON ci_ticket_links(ticket_id);

-- ========================================
-- SERVICE CATALOG
-- ========================================

CREATE TABLE IF NOT EXISTS service_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'folder',
    color VARCHAR(20) DEFAULT '#3B82F6',
    parent_category_id BIGINT REFERENCES service_categories(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_categories_org ON service_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_slug ON service_categories(slug);

CREATE TABLE IF NOT EXISTS service_catalog_items (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    short_description TEXT,
    description TEXT,
    category_id BIGINT NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    icon VARCHAR(50) DEFAULT 'document',
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    form_schema JSONB,
    default_priority_id BIGINT REFERENCES priorities(id) ON DELETE SET NULL,
    default_category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    sla_policy_id BIGINT REFERENCES sla_policies(id) ON DELETE SET NULL,
    fulfillment_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_levels INTEGER DEFAULT 1,
    estimated_time_minutes INTEGER,
    cost VARCHAR(100),
    is_published BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    request_count INTEGER DEFAULT 0,
    avg_fulfillment_time REAL,
    satisfaction_rating REAL,
    tags JSONB DEFAULT '[]',
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_items_category ON service_catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_org ON service_catalog_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_slug ON service_catalog_items(slug);

CREATE TABLE IF NOT EXISTS service_requests (
    id BIGSERIAL PRIMARY KEY,
    request_number VARCHAR(50) NOT NULL UNIQUE,
    catalog_item_id BIGINT NOT NULL REFERENCES service_catalog_items(id) ON DELETE RESTRICT,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
    requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requester_name VARCHAR(255),
    requester_email VARCHAR(255),
    requester_department VARCHAR(255),
    on_behalf_of_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    form_data JSONB NOT NULL DEFAULT '{}',
    justification TEXT,
    requested_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK(status IN ('draft','submitted','pending_approval','approved','rejected','in_progress','fulfilled','cancelled','failed')),
    approval_status VARCHAR(20) DEFAULT 'not_required' CHECK(approval_status IN ('pending','approved','rejected','not_required')),
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    fulfilled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    satisfaction_rating INTEGER CHECK(satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    satisfaction_comment TEXT,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_requests_catalog ON service_requests(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_requester ON service_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_org ON service_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_number ON service_requests(request_number);

CREATE TABLE IF NOT EXISTS service_request_approvals (
    id BIGSERIAL PRIMARY KEY,
    service_request_id BIGINT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    approval_level INTEGER DEFAULT 1,
    approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approver_role VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','delegated','expired')),
    decision_at TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    delegated_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    reminded_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_request_approvals_request ON service_request_approvals(service_request_id);

CREATE TABLE IF NOT EXISTS service_request_tasks (
    id BIGSERIAL PRIMARY KEY,
    service_request_id BIGINT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    task_order INTEGER DEFAULT 0,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    assigned_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','blocked','cancelled')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_request_tasks_request ON service_request_tasks(service_request_id);

-- ========================================
-- CAB (Change Advisory Board)
-- ========================================

CREATE TABLE IF NOT EXISTS cab_configurations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    meeting_day VARCHAR(20),
    meeting_time VARCHAR(10),
    meeting_duration INTEGER DEFAULT 60,
    meeting_location VARCHAR(500),
    meeting_url TEXT,
    chair_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    secretary_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    minimum_members INTEGER DEFAULT 3,
    quorum_percentage REAL DEFAULT 50.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cab_members (
    id BIGSERIAL PRIMARY KEY,
    cab_id BIGINT NOT NULL REFERENCES cab_configurations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK(role IN ('chair','secretary','member','advisor')),
    is_voting_member BOOLEAN DEFAULT TRUE,
    expertise_areas JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cab_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cab_members_cab ON cab_members(cab_id);
CREATE INDEX IF NOT EXISTS idx_cab_members_user ON cab_members(user_id);

CREATE TABLE IF NOT EXISTS cab_meetings (
    id BIGSERIAL PRIMARY KEY,
    cab_id BIGINT REFERENCES cab_configurations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT,
    duration_minutes INTEGER DEFAULT 60,
    location TEXT,
    meeting_url TEXT,
    meeting_type VARCHAR(20) NOT NULL DEFAULT 'regular' CHECK(meeting_type IN ('regular','emergency','virtual','ad_hoc')),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled')),
    attendees JSONB DEFAULT '[]',
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    agenda TEXT,
    minutes TEXT,
    notes TEXT,
    decisions JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    organizer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    organization_id BIGINT NOT NULL DEFAULT 1,
    tenant_id BIGINT NOT NULL DEFAULT 1,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cab_meetings_cab ON cab_meetings(cab_id);
CREATE INDEX IF NOT EXISTS idx_cab_meetings_date ON cab_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_cab_meetings_status ON cab_meetings(status);

-- Add foreign key to change_requests.cab_meeting_id now that cab_meetings exists
ALTER TABLE change_requests ADD CONSTRAINT fk_change_requests_cab_meeting
    FOREIGN KEY (cab_meeting_id) REFERENCES cab_meetings(id) ON DELETE SET NULL;

-- Add foreign key to change_request_approvals.cab_member_id now that cab_members exists
ALTER TABLE change_request_approvals ADD CONSTRAINT fk_change_approvals_cab_member
    FOREIGN KEY (cab_member_id) REFERENCES cab_members(id) ON DELETE CASCADE;

-- ========================================
-- MISSING TABLES FROM SQLITE SCHEMA
-- ========================================

-- Departments
CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
    manager_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_departments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, department_id)
);

-- Escalations
CREATE TABLE IF NOT EXISTS escalation_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_conditions JSONB DEFAULT '{}',
    escalation_levels JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS escalation_instances (
    id BIGSERIAL PRIMARY KEY,
    rule_id BIGINT NOT NULL REFERENCES escalation_rules(id) ON DELETE CASCADE,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    current_level INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Batch configurations
CREATE TABLE IF NOT EXISTS batch_configurations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    batch_type VARCHAR(50) NOT NULL,
    configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Filter rules
CREATE TABLE IF NOT EXISTS filter_rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}',
    actions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Communication channels
CREATE TABLE IF NOT EXISTS communication_channels (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_messages (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT NOT NULL REFERENCES communication_channels(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK(direction IN ('inbound','outbound')),
    from_address VARCHAR(500),
    to_address VARCHAR(500),
    subject VARCHAR(500),
    body TEXT,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'sent',
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification events & batches
CREATE TABLE IF NOT EXISTS notification_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS notification_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    payload JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics enhancements
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    properties JSONB DEFAULT '{}',
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timeseries ON analytics_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_realtime_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_value REAL NOT NULL,
    dimensions JSONB DEFAULT '{}',
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_agent_performance (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    tickets_resolved INTEGER DEFAULT 0,
    avg_resolution_time REAL,
    satisfaction_score REAL,
    first_response_time REAL,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI/ML tables
CREATE TABLE IF NOT EXISTS ai_classifications (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    classification_type VARCHAR(50) NOT NULL,
    predicted_value VARCHAR(255),
    confidence REAL,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(50) NOT NULL,
    content TEXT,
    confidence REAL,
    accepted BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_training_data (
    id BIGSERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    expected_output JSONB,
    is_validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vector_embeddings (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT NOT NULL,
    embedding_model VARCHAR(100),
    embedding JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp integration
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id BIGSERIAL PRIMARY KEY,
    phone_number VARCHAR(30) NOT NULL,
    session_status VARCHAR(20) DEFAULT 'active',
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ticket_id BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
    id BIGSERIAL PRIMARY KEY,
    phone_number VARCHAR(30) NOT NULL,
    name VARCHAR(255),
    profile_picture_url TEXT,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK(direction IN ('inbound','outbound')),
    message_type VARCHAR(20) DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    status VARCHAR(20) DEFAULT 'sent',
    external_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gov.br and LGPD
CREATE TABLE IF NOT EXISTS govbr_integrations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cpf VARCHAR(14),
    govbr_id VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    nivel_confianca INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lgpd_consents (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(100) NOT NULL,
    is_given BOOLEAN DEFAULT FALSE,
    purpose TEXT,
    legal_basis VARCHAR(100),
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lgpd_consents_user_type ON lgpd_consents(user_id, consent_type);

-- Integrations
CREATE TABLE IF NOT EXISTS integrations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integration_logs (
    id BIGSERIAL PRIMARY KEY,
    integration_id BIGINT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    action VARCHAR(100),
    status VARCHAR(20),
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events JSONB DEFAULT '[]',
    headers JSONB DEFAULT '{}',
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id BIGSERIAL PRIMARY KEY,
    webhook_id BIGINT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100),
    payload JSONB,
    response_status INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT FALSE
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL DEFAULT 1,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_usage_current ON api_usage_tracking(organization_id, endpoint, timestamp DESC);

-- Scheduled reports
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    filters JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '[]',
    recipients JSONB NOT NULL DEFAULT '[]',
    schedule_expression VARCHAR(100) NOT NULL,
    format VARCHAR(20) DEFAULT 'json',
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE
);

-- Audit advanced
CREATE TABLE IF NOT EXISTS audit_advanced (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_advanced_entity ON audit_advanced(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_user ON audit_advanced(user_id);

-- Gamification (existing in SQLite)
-- Knowledge articles extended
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(255),
    content TEXT,
    category_id BIGINT REFERENCES kb_categories(id) ON DELETE SET NULL,
    author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'draft',
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflow definitions & executions
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50),
    trigger_conditions JSONB DEFAULT '{}',
    steps JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    organization_id BIGINT NOT NULL DEFAULT 1,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id BIGSERIAL PRIMARY KEY,
    definition_id BIGINT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    trigger_entity_type VARCHAR(50),
    trigger_entity_id BIGINT,
    status VARCHAR(20) DEFAULT 'running',
    current_step INTEGER DEFAULT 0,
    context JSONB DEFAULT '{}',
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id BIGSERIAL PRIMARY KEY,
    execution_id BIGINT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    step_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS workflow_approvals (
    id BIGSERIAL PRIMARY KEY,
    execution_id BIGINT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    approver_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    comments TEXT,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tenant configurations
CREATE TABLE IF NOT EXISTS tenant_configurations (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    config_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, config_key)
);

-- ========================================
-- TICKET ACCESS TOKENS (PORTAL SECURITY)
-- ========================================

CREATE TABLE IF NOT EXISTS ticket_access_tokens (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    token TEXT NOT NULL UNIQUE, -- UUID v4
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT,
    metadata JSONB, -- JSON for additional info (IP, user-agent, etc.)
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ticket_access_tokens_token ON ticket_access_tokens(token);
CREATE INDEX idx_ticket_access_tokens_ticket_id ON ticket_access_tokens(ticket_id);
CREATE INDEX idx_ticket_access_tokens_expires ON ticket_access_tokens(expires_at);
CREATE INDEX idx_ticket_access_tokens_active ON ticket_access_tokens(is_active, expires_at) WHERE is_active = TRUE;

-- ========================================
-- WORKFLOWS (ITIL-COMPATIBLE)
-- ========================================

CREATE TABLE IF NOT EXISTS workflows (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'status_changed', 'sla_warning', 'time_based', 'manual', 'comment_added', 'assignment_changed')),
    trigger_conditions TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,
    category TEXT,
    priority INTEGER DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    created_by BIGINT NOT NULL,
    updated_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX idx_workflows_active ON workflows(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_workflows_category ON workflows(category) WHERE category IS NOT NULL;
CREATE INDEX idx_workflows_created_by ON workflows(created_by);

-- Workflow Steps
CREATE TABLE IF NOT EXISTS workflow_steps (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL,
    step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('action', 'condition', 'approval', 'delay', 'parallel', 'webhook', 'script', 'notification')),
    name TEXT NOT NULL,
    description TEXT,
    configuration TEXT NOT NULL,
    timeout_minutes INTEGER DEFAULT 60,
    retry_count INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 5,
    is_optional BOOLEAN DEFAULT FALSE,
    parent_step_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE,
    UNIQUE(workflow_id, step_order)
);

CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_order ON workflow_steps(step_order);
CREATE INDEX idx_workflow_steps_type ON workflow_steps(step_type);

-- ========================================
-- SISTEMA DE APROVACOES
-- ========================================

CREATE TABLE IF NOT EXISTS approvals (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id BIGINT NOT NULL,
    approval_type TEXT NOT NULL,
    requested_by BIGINT NOT NULL,
    assigned_to BIGINT,
    assigned_group TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'timeout')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    reason TEXT,
    approval_data TEXT,
    approved_by BIGINT,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    auto_approve_after TIMESTAMP WITH TIME ZONE,
    notification_sent BOOLEAN DEFAULT FALSE,
    escalation_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_approvals_entity ON approvals(entity_type, entity_id);
CREATE INDEX idx_approvals_requested_by ON approvals(requested_by);
CREATE INDEX idx_approvals_assigned_to ON approvals(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_due_date ON approvals(due_date) WHERE due_date IS NOT NULL;

-- Approval History
CREATE TABLE IF NOT EXISTS approval_history (
    id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    performed_by BIGINT,
    previous_status TEXT,
    new_status TEXT,
    comment TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_approval_history_approval ON approval_history(approval_id);
CREATE INDEX idx_approval_history_performed_by ON approval_history(performed_by) WHERE performed_by IS NOT NULL;

-- Approval Tokens (link-based approval without login)
CREATE TABLE IF NOT EXISTS approval_tokens (
    id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE
);

CREATE INDEX idx_approval_tokens_approval ON approval_tokens(approval_id);
CREATE INDEX idx_approval_tokens_token ON approval_tokens(token);
CREATE INDEX idx_approval_tokens_expires ON approval_tokens(expires_at);

-- ========================================
-- TRIGGERS: updated_at auto-update
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Organizations & Tenants
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auth & Users
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_password_policies_updated_at BEFORE UPDATE ON password_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sso_providers_updated_at BEFORE UPDATE ON sso_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Core ServiceDesk
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_priorities_updated_at BEFORE UPDATE ON priorities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_statuses_updated_at BEFORE UPDATE ON statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_file_storage_updated_at BEFORE UPDATE ON file_storage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SLA
CREATE TRIGGER update_sla_policies_updated_at BEFORE UPDATE ON sla_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sla_tracking_updated_at BEFORE UPDATE ON sla_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notifications
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Templates & Automations
CREATE TRIGGER update_ticket_templates_updated_at BEFORE UPDATE ON ticket_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Knowledge Base
CREATE TRIGGER update_kb_categories_updated_at BEFORE UPDATE ON kb_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kb_articles_updated_at BEFORE UPDATE ON kb_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- System Settings
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ITIL Problem Management
CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON problems FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_known_errors_updated_at BEFORE UPDATE ON known_errors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ITIL Change Management
CREATE TRIGGER update_change_requests_updated_at BEFORE UPDATE ON change_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_change_tasks_updated_at BEFORE UPDATE ON change_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_change_calendar_updated_at BEFORE UPDATE ON change_calendar FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CMDB
CREATE TRIGGER update_ci_types_updated_at BEFORE UPDATE ON ci_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_configuration_items_updated_at BEFORE UPDATE ON configuration_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ci_relationships_updated_at BEFORE UPDATE ON ci_relationships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Service Catalog
CREATE TRIGGER update_service_categories_updated_at BEFORE UPDATE ON service_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_catalog_items_updated_at BEFORE UPDATE ON service_catalog_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_request_approvals_updated_at BEFORE UPDATE ON service_request_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_request_tasks_updated_at BEFORE UPDATE ON service_request_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- CAB
CREATE TRIGGER update_cab_configurations_updated_at BEFORE UPDATE ON cab_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cab_meetings_updated_at BEFORE UPDATE ON cab_meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Departments & Misc
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escalation_rules_updated_at BEFORE UPDATE ON escalation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batch_configurations_updated_at BEFORE UPDATE ON batch_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_filter_rules_updated_at BEFORE UPDATE ON filter_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communication_channels_updated_at BEFORE UPDATE ON communication_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Integrations & Webhooks
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- WhatsApp & Gov.br
CREATE TRIGGER update_whatsapp_sessions_updated_at BEFORE UPDATE ON whatsapp_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_contacts_updated_at BEFORE UPDATE ON whatsapp_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_govbr_integrations_updated_at BEFORE UPDATE ON govbr_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lgpd_consents_updated_at BEFORE UPDATE ON lgpd_consents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Knowledge Articles (extended)
CREATE TRIGGER update_knowledge_articles_updated_at BEFORE UPDATE ON knowledge_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vector Embeddings
CREATE TRIGGER update_vector_embeddings_updated_at BEFORE UPDATE ON vector_embeddings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Workflow & Approvals (new tables)
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_steps_updated_at BEFORE UPDATE ON workflow_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_definitions_updated_at BEFORE UPDATE ON workflow_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_approvals_updated_at BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_configurations_updated_at BEFORE UPDATE ON tenant_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- SLA TRIGGERS (PostgreSQL equivalents)
-- ========================================

-- Auto-create SLA tracking when a ticket is inserted
CREATE OR REPLACE FUNCTION create_sla_tracking_on_ticket_insert()
RETURNS TRIGGER AS $$
DECLARE
    matched_policy RECORD;
BEGIN
    SELECT sp.* INTO matched_policy
    FROM sla_policies sp
    WHERE sp.is_active = TRUE
      AND sp.priority_id = NEW.priority_id
      AND (sp.category_id IS NULL OR sp.category_id = NEW.category_id)
    ORDER BY
        CASE WHEN sp.category_id = NEW.category_id THEN 1 ELSE 2 END,
        sp.id
    LIMIT 1;

    IF matched_policy.id IS NOT NULL THEN
        INSERT INTO sla_tracking (ticket_id, sla_policy_id, response_due_at, resolution_due_at, escalation_due_at)
        VALUES (
            NEW.id,
            matched_policy.id,
            NEW.created_at + (matched_policy.response_time_minutes || ' minutes')::INTERVAL,
            NEW.created_at + (matched_policy.resolution_time_minutes || ' minutes')::INTERVAL,
            CASE WHEN matched_policy.escalation_time_minutes IS NOT NULL
                 THEN NEW.created_at + (matched_policy.escalation_time_minutes || ' minutes')::INTERVAL
                 ELSE NULL END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_sla_tracking
    AFTER INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION create_sla_tracking_on_ticket_insert();

-- Update SLA tracking when first agent response (comment) is given
CREATE OR REPLACE FUNCTION update_sla_on_first_response()
RETURNS TRIGGER AS $$
DECLARE
    agent_count INTEGER;
BEGIN
    -- Check if commenter is an admin or agent
    IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND role IN ('admin', 'agent')) THEN
        -- Check if this is the first agent comment on this ticket
        SELECT COUNT(*) INTO agent_count
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = NEW.ticket_id
          AND u.role IN ('admin', 'agent')
          AND c.id != NEW.id;

        IF agent_count = 0 THEN
            UPDATE sla_tracking
            SET
                response_met = TRUE,
                response_time_minutes = EXTRACT(EPOCH FROM (NOW() - (SELECT created_at FROM tickets WHERE id = NEW.ticket_id)))::INTEGER / 60,
                updated_at = NOW()
            WHERE ticket_id = NEW.ticket_id
              AND response_met = FALSE;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sla_on_first_response
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_sla_on_first_response();

-- Update SLA tracking when ticket is resolved
CREATE OR REPLACE FUNCTION update_sla_on_resolution()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status_id != NEW.status_id THEN
        IF EXISTS (SELECT 1 FROM statuses WHERE id = NEW.status_id AND is_final = TRUE) THEN
            UPDATE sla_tracking
            SET
                resolution_met = TRUE,
                resolution_time_minutes = EXTRACT(EPOCH FROM (NOW() - OLD.created_at))::INTEGER / 60,
                updated_at = NOW()
            WHERE ticket_id = NEW.id AND resolution_met = FALSE;

            UPDATE tickets SET resolved_at = NOW() WHERE id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sla_on_resolution
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_sla_on_resolution();

-- ========================================
-- MISSING CHECK CONSTRAINTS (parity with SQLite)
-- ========================================

-- notification_batches: add status CHECK
ALTER TABLE notification_batches DROP CONSTRAINT IF EXISTS notification_batches_status_check;
ALTER TABLE notification_batches ADD CONSTRAINT notification_batches_status_check
    CHECK (status IN ('pending', 'ready', 'processed', 'failed'));

-- batch_configurations: add batch_type CHECK (mapped from group_by in SQLite)
-- Note: PostgreSQL batch_configurations uses batch_type, SQLite uses group_by

-- escalation_instances: add status CHECK
ALTER TABLE escalation_instances DROP CONSTRAINT IF EXISTS escalation_instances_status_check;
ALTER TABLE escalation_instances ADD CONSTRAINT escalation_instances_status_check
    CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled', 'active'));

-- workflow_definitions: add trigger_type CHECK
ALTER TABLE workflow_definitions DROP CONSTRAINT IF EXISTS workflow_definitions_trigger_type_check;
ALTER TABLE workflow_definitions ADD CONSTRAINT workflow_definitions_trigger_type_check
    CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'status_changed', 'sla_warning', 'time_based', 'manual', 'comment_added', 'assignment_changed'));

-- workflow_executions: add status CHECK
ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_status_check;
ALTER TABLE workflow_executions ADD CONSTRAINT workflow_executions_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout'));

-- workflow_step_executions: add status CHECK
ALTER TABLE workflow_step_executions DROP CONSTRAINT IF EXISTS workflow_step_executions_status_check;
ALTER TABLE workflow_step_executions ADD CONSTRAINT workflow_step_executions_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'timeout'));

-- workflow_approvals: add status CHECK
ALTER TABLE workflow_approvals DROP CONSTRAINT IF EXISTS workflow_approvals_status_check;
ALTER TABLE workflow_approvals ADD CONSTRAINT workflow_approvals_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- notifications: expand type CHECK to include 'ticket_created' and 'mention' (parity with SQLite)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('ticket_assigned', 'ticket_updated', 'ticket_resolved', 'ticket_escalated', 'sla_warning', 'sla_breach', 'escalation', 'comment_added', 'system_alert', 'ticket_created', 'mention'));

-- ========================================
-- MISSING INDEXES (parity with SQLite)
-- ========================================

-- Users: organization and tenant indexes
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_sso ON users(sso_provider, sso_user_id) WHERE sso_provider IS NOT NULL;

-- Categories, Priorities, Statuses: tenant/org indexes
CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_priorities_org ON priorities(organization_id);
CREATE INDEX IF NOT EXISTS idx_priorities_tenant ON priorities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statuses_org ON statuses(organization_id);
CREATE INDEX IF NOT EXISTS idx_statuses_tenant ON statuses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statuses_final ON statuses(is_final) WHERE is_final = TRUE;

-- Tickets: additional composite indexes
CREATE INDEX IF NOT EXISTS idx_tickets_org_priority ON tickets(organization_id, priority_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org_category ON tickets(organization_id, category_id);

-- Comments: organization index
CREATE INDEX IF NOT EXISTS idx_comments_org ON comments(organization_id);

-- Attachments: organization index
CREATE INDEX IF NOT EXISTS idx_attachments_org ON attachments(organization_id);

-- SLA tracking: composite performance indexes
CREATE INDEX IF NOT EXISTS idx_sla_tracking_sla_policy ON sla_tracking(sla_policy_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_breaches ON sla_tracking(response_met, resolution_met)
    WHERE response_met = FALSE OR resolution_met = FALSE;

-- Escalations: user indexes
CREATE INDEX IF NOT EXISTS idx_escalations_from ON escalations(escalated_from) WHERE escalated_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escalations_to ON escalations(escalated_to) WHERE escalated_to IS NOT NULL;

-- Workflow definitions: indexes
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_org ON workflow_definitions(organization_id);

-- Workflow executions: indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_definition ON workflow_executions(definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON workflow_executions(started_at DESC);

-- Workflow step executions: indexes
CREATE INDEX IF NOT EXISTS idx_workflow_step_execs_execution ON workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_execs_status ON workflow_step_executions(status);

-- Workflow approvals: indexes
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_execution ON workflow_approvals(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver ON workflow_approvals(approver_id) WHERE approver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON workflow_approvals(status);

-- Departments: indexes
CREATE INDEX IF NOT EXISTS idx_departments_org ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_id) WHERE manager_id IS NOT NULL;

-- User departments: indexes
CREATE INDEX IF NOT EXISTS idx_user_departments_user ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_dept ON user_departments(department_id);

-- Escalation rules: indexes
CREATE INDEX IF NOT EXISTS idx_escalation_rules_org ON escalation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON escalation_rules(is_active) WHERE is_active = TRUE;

-- Escalation instances: indexes
CREATE INDEX IF NOT EXISTS idx_escalation_instances_rule ON escalation_instances(rule_id);
CREATE INDEX IF NOT EXISTS idx_escalation_instances_ticket ON escalation_instances(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escalation_instances_status ON escalation_instances(status);

-- Batch configurations: indexes
CREATE INDEX IF NOT EXISTS idx_batch_configurations_org ON batch_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_batch_configurations_active ON batch_configurations(is_active) WHERE is_active = TRUE;

-- Filter rules: indexes
CREATE INDEX IF NOT EXISTS idx_filter_rules_org ON filter_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_filter_rules_user ON filter_rules(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_filter_rules_active ON filter_rules(is_active) WHERE is_active = TRUE;

-- Communication: indexes
CREATE INDEX IF NOT EXISTS idx_communication_channels_org ON communication_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_communication_channels_active ON communication_channels(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_communication_messages_channel ON communication_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_ticket ON communication_messages(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_messages_created ON communication_messages(created_at DESC);

-- Notification batches: indexes
CREATE INDEX IF NOT EXISTS idx_notification_batches_status ON notification_batches(status);
CREATE INDEX IF NOT EXISTS idx_notification_batches_type ON notification_batches(batch_type);

-- Analytics events: org index
CREATE INDEX IF NOT EXISTS idx_analytics_events_org ON analytics_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id) WHERE user_id IS NOT NULL;

-- Analytics realtime: indexes
CREATE INDEX IF NOT EXISTS idx_analytics_realtime_org ON analytics_realtime_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_realtime_name ON analytics_realtime_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_realtime_created ON analytics_realtime_metrics(created_at DESC);

-- Analytics agent performance: indexes
CREATE INDEX IF NOT EXISTS idx_analytics_agent_perf_agent ON analytics_agent_performance(agent_id);
CREATE INDEX IF NOT EXISTS idx_analytics_agent_perf_org ON analytics_agent_performance(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_agent_perf_period ON analytics_agent_performance(period_start, period_end);

-- AI: indexes
CREATE INDEX IF NOT EXISTS idx_ai_classifications_ticket ON ai_classifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_type ON ai_classifications(classification_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_ticket ON ai_suggestions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_type ON ai_training_data(data_type);

-- Vector embeddings: indexes
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_entity ON vector_embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_model ON vector_embeddings(embedding_model);

-- WhatsApp: indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user ON whatsapp_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_ticket ON whatsapp_sessions(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_org ON whatsapp_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user ON whatsapp_contacts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_org ON whatsapp_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session ON whatsapp_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_external ON whatsapp_messages(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- Gov.br: indexes
CREATE INDEX IF NOT EXISTS idx_govbr_user ON govbr_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_govbr_cpf ON govbr_integrations(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_govbr_govbr_id ON govbr_integrations(govbr_id) WHERE govbr_id IS NOT NULL;

-- Integration logs: indexes
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON integration_logs(status);

-- Webhooks: indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered ON webhook_deliveries(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success);

-- Scheduled reports: indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_created_by ON scheduled_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = TRUE;

-- Audit advanced: indexes
CREATE INDEX IF NOT EXISTS idx_audit_advanced_org ON audit_advanced(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_created ON audit_advanced(created_at DESC);

-- Knowledge articles (extended): indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_org ON knowledge_articles(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_slug ON knowledge_articles(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_author ON knowledge_articles(author_id) WHERE author_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON knowledge_articles(status);

-- Tenant configurations: indexes
CREATE INDEX IF NOT EXISTS idx_tenant_configurations_tenant ON tenant_configurations(tenant_id);

-- Change types: indexes
CREATE INDEX IF NOT EXISTS idx_change_types_org ON change_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_change_types_active ON change_types(is_active) WHERE is_active = TRUE;

-- Change request approvals: additional indexes
CREATE INDEX IF NOT EXISTS idx_change_approvals_approver ON change_request_approvals(approver_id) WHERE approver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_change_approvals_status ON change_request_approvals(status);

-- Change tasks: additional indexes
CREATE INDEX IF NOT EXISTS idx_change_tasks_assignee ON change_tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_change_tasks_team ON change_tasks(assigned_team_id) WHERE assigned_team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_change_tasks_status ON change_tasks(status);

-- Change calendar: indexes
CREATE INDEX IF NOT EXISTS idx_change_calendar_org ON change_calendar(organization_id);
CREATE INDEX IF NOT EXISTS idx_change_calendar_dates ON change_calendar(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_change_calendar_type ON change_calendar(type);

-- CMDB: additional indexes
CREATE INDEX IF NOT EXISTS idx_ci_types_org ON ci_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_ci_types_parent ON ci_types(parent_type_id) WHERE parent_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ci_types_active ON ci_types(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_configuration_items_owner ON configuration_items(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_configuration_items_team ON configuration_items(managed_by_team_id) WHERE managed_by_team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_configuration_items_hostname ON configuration_items(hostname) WHERE hostname IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_configuration_items_asset_tag ON configuration_items(asset_tag) WHERE asset_tag IS NOT NULL;

-- Service catalog: additional indexes
CREATE INDEX IF NOT EXISTS idx_service_categories_parent ON service_categories(parent_category_id) WHERE parent_category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_categories_active ON service_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_active ON service_catalog_items(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_published ON service_catalog_items(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_service_requests_ticket ON service_requests(ticket_id) WHERE ticket_id IS NOT NULL;

-- CAB: additional indexes
CREATE INDEX IF NOT EXISTS idx_cab_configurations_org ON cab_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_cab_configurations_active ON cab_configurations(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cab_meetings_org ON cab_meetings(organization_id);

-- Root cause categories: indexes
CREATE INDEX IF NOT EXISTS idx_root_cause_categories_org ON root_cause_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_root_cause_categories_parent ON root_cause_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_root_cause_categories_active ON root_cause_categories(is_active) WHERE is_active = TRUE;

-- Problem attachments: indexes
CREATE INDEX IF NOT EXISTS idx_problem_attachments_problem ON problem_attachments(problem_id);

-- ========================================
-- END OF SCHEMA
-- ========================================
