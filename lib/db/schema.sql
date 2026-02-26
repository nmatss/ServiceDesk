-- Schema do banco de dados ServiceDesk
-- SQLite Database Schema

-- Tabela de usuários expandida para enterprise
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'user', 'manager', 'read_only', 'api_client')),
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at DATETIME,
    last_login_at DATETIME,
    password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    two_factor_backup_codes TEXT, -- JSON array
    sso_provider TEXT, -- 'google', 'saml', 'ad', 'gov_br', etc.
    sso_user_id TEXT, -- External user ID
    avatar_url TEXT,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    language TEXT DEFAULT 'pt-BR',
    metadata TEXT, -- JSON for additional user data
    notification_preferences TEXT, -- JSON for user notification preferences
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- SISTEMA DE AUTENTICAÇÃO ENTERPRISE
-- ========================================

-- Tabela de refresh tokens para JWT
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    device_info TEXT, -- JSON com informações do dispositivo
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de permissões granulares
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    resource TEXT NOT NULL, -- 'tickets', 'users', 'reports', etc.
    action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'manage'
    conditions TEXT, -- JSON para condições especiais
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de papéis (roles) granulares
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE, -- roles do sistema que não podem ser deletados
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relacionamento roles-permissions (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted_by INTEGER, -- quem concedeu a permissão
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(role_id, permission_id)
);

-- Tabela de relacionamento user-roles (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_by INTEGER, -- quem concedeu o papel
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, -- para papéis temporários
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, role_id)
);

-- Tabela de políticas de senha
CREATE TABLE IF NOT EXISTS password_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    min_length INTEGER DEFAULT 8,
    require_uppercase BOOLEAN DEFAULT TRUE,
    require_lowercase BOOLEAN DEFAULT TRUE,
    require_numbers BOOLEAN DEFAULT TRUE,
    require_special_chars BOOLEAN DEFAULT TRUE,
    min_special_chars INTEGER DEFAULT 1,
    max_age_days INTEGER DEFAULT 90, -- senha expira em N dias
    prevent_reuse_last INTEGER DEFAULT 5, -- não reutilizar últimas N senhas
    max_failed_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT FALSE,
    applies_to_roles TEXT, -- JSON array de roles
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de senhas (para evitar reutilização)
CREATE TABLE IF NOT EXISTS password_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL, -- IP ou user_id
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('ip', 'user', 'email')),
    endpoint TEXT NOT NULL, -- '/api/auth/login', '/api/tickets', etc.
    attempts INTEGER DEFAULT 1,
    first_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    blocked_until DATETIME,
    UNIQUE(identifier, identifier_type, endpoint)
);

-- Tabela de configurações SSO
CREATE TABLE IF NOT EXISTS sso_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('saml2', 'oauth2', 'oidc', 'ldap')),
    is_active BOOLEAN DEFAULT FALSE,
    configuration TEXT NOT NULL, -- JSON com configurações específicas
    metadata TEXT, -- JSON com metadados adicionais
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de tentativas de login (para auditoria e segurança)
CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    success BOOLEAN DEFAULT FALSE,
    failure_reason TEXT, -- 'invalid_password', 'account_locked', 'user_not_found', etc.
    two_factor_required BOOLEAN DEFAULT FALSE,
    two_factor_success BOOLEAN DEFAULT FALSE,
    session_id TEXT,
    organization_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Tabela de dispositivos WebAuthn/FIDO2
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    device_name TEXT,
    device_type TEXT, -- 'security_key', 'platform', 'cross_platform'
    aaguid TEXT,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de códigos de verificação (email, 2FA backup, etc.)
CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    code TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset', 'two_factor_backup', 'login_verification')),
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de log de auditoria específico para autenticação (LGPD)
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL, -- 'login', 'logout', 'password_change', 'role_change', etc.
    ip_address TEXT,
    user_agent TEXT,
    details TEXT, -- JSON com detalhes específicos do evento
    consent_given BOOLEAN, -- para LGPD
    data_retention_expires_at DATETIME, -- quando os dados podem ser removidos
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- TICKET ACCESS TOKENS (PORTAL SECURITY)
-- ========================================

-- Tabela de tokens de acesso para portal público
-- Permite que usuários não autenticados acessem tickets específicos via token UUID
-- SECURITY: Implementa acesso seguro sem exigir autenticação completa
CREATE TABLE IF NOT EXISTS ticket_access_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE, -- UUID v4
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL, -- Tokens expiram após 30 dias por padrão
    used_at DATETIME, -- Timestamp do primeiro acesso
    usage_count INTEGER DEFAULT 0, -- Quantas vezes o token foi usado
    last_used_at DATETIME, -- Timestamp do último acesso
    revoked_at DATETIME, -- Se o token foi revogado manualmente
    is_active BOOLEAN DEFAULT TRUE, -- Flag de controle rápido
    created_by INTEGER, -- Usuário que gerou o token (se aplicável)
    metadata TEXT, -- JSON para informações adicionais (IP, user-agent, etc.)
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para performance e segurança
CREATE INDEX IF NOT EXISTS idx_ticket_access_tokens_token ON ticket_access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_ticket_access_tokens_ticket_id ON ticket_access_tokens(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_access_tokens_expires ON ticket_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_ticket_access_tokens_active ON ticket_access_tokens(is_active, expires_at);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de prioridades
CREATE TABLE IF NOT EXISTS priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 4),
    color TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de status
CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de tickets
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    assigned_to INTEGER,
    category_id INTEGER NOT NULL,
    priority_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    sla_policy_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE RESTRICT,
    FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL
);

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de atividades de tickets
CREATE TABLE IF NOT EXISTS ticket_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de relacionamento ticket-tags
CREATE TABLE IF NOT EXISTS ticket_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    added_by INTEGER,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(ticket_id, tag_id)
);

-- Seguidores de tickets
CREATE TABLE IF NOT EXISTS ticket_followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(ticket_id, user_id)
);

-- Relacionamentos entre tickets
CREATE TABLE IF NOT EXISTS ticket_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_ticket_id INTEGER NOT NULL,
    target_ticket_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL CHECK (
      relationship_type IN ('parent', 'child', 'related', 'duplicate', 'blocks', 'blocked_by')
    ),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (target_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(source_ticket_id, target_ticket_id, relationship_type)
);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de armazenamento de arquivos (upload genérico multi-tenant)
CREATE TABLE IF NOT EXISTS file_storage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    organization_id INTEGER NOT NULL DEFAULT 1,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    original_filename TEXT, -- compatibilidade legado
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    file_size INTEGER, -- compatibilidade legado
    file_path TEXT NOT NULL,
    storage_path TEXT, -- compatibilidade legado
    storage_type TEXT DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'cloudinary')),
    uploaded_by INTEGER NOT NULL,
    entity_type TEXT, -- 'ticket', 'comment', 'knowledge_article', 'user_avatar'
    entity_id INTEGER,
    is_public BOOLEAN DEFAULT FALSE,
    virus_scanned BOOLEAN DEFAULT FALSE,
    virus_scan_result TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP, -- compatibilidade legado
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de SLA (Service Level Agreements)
CREATE TABLE IF NOT EXISTS sla_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    priority_id INTEGER NOT NULL,
    category_id INTEGER,
    response_time_minutes INTEGER NOT NULL, -- Tempo para primeira resposta
    resolution_time_minutes INTEGER NOT NULL, -- Tempo para resolução
    escalation_time_minutes INTEGER, -- Tempo para escalação
    business_hours_only BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Tabela de tracking de SLA para tickets
CREATE TABLE IF NOT EXISTS sla_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE RESTRICT
);

-- Tabela de escalações automáticas
CREATE TABLE IF NOT EXISTS escalations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    escalation_type TEXT NOT NULL CHECK (escalation_type IN ('sla_breach', 'manual', 'priority_change')),
    escalated_from INTEGER, -- user_id de quem escalou
    escalated_to INTEGER, -- user_id para quem foi escalado
    reason TEXT NOT NULL,
    escalated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    notes TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (escalated_from) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (escalated_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    ticket_id INTEGER,
    type TEXT NOT NULL CHECK (type IN ('ticket_assigned', 'ticket_updated', 'ticket_resolved', 'ticket_escalated', 'sla_warning', 'sla_breach', 'escalation', 'comment_added', 'system_alert', 'ticket_created', 'mention')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT, -- JSON data for additional notification context
    is_read BOOLEAN DEFAULT FALSE,
    sent_via_email BOOLEAN DEFAULT FALSE,
    email_sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Tabela de templates para tickets
CREATE TABLE IF NOT EXISTS ticket_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    priority_id INTEGER,
    title_template TEXT NOT NULL,
    description_template TEXT NOT NULL,
    tags TEXT, -- JSON array de tags
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    organization_id INTEGER,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    entity_type TEXT NOT NULL, -- 'ticket', 'user', 'category', 'config', 'pii', etc.
    entity_id INTEGER,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'view', 'login_success', 'login_failed', 'access_denied', etc.
    old_values TEXT, -- JSON com valores antigos
    new_values TEXT, -- JSON com valores novos
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    is_public BOOLEAN DEFAULT FALSE, -- Se pode ser acessado pelo frontend
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de automações
CREATE TABLE IF NOT EXISTS automations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'sla_warning', 'time_based')),
    conditions TEXT NOT NULL, -- JSON com condições
    actions TEXT NOT NULL, -- JSON com ações
    is_active BOOLEAN DEFAULT TRUE,
    execution_count INTEGER DEFAULT 0,
    last_executed_at DATETIME,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de knowledge base
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category_id INTEGER,
    tags TEXT, -- JSON array de tags
    is_published BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    author_id INTEGER NOT NULL,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de avaliação de satisfação
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    agent_rating INTEGER CHECK (agent_rating >= 1 AND agent_rating <= 5),
    resolution_speed_rating INTEGER CHECK (resolution_speed_rating >= 1 AND resolution_speed_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    additional_comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority_id ON tickets(priority_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_organization_id ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at);

CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_tenant_id ON comments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_comments_organization_id ON comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket_id ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_user_id ON ticket_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_tenant_id ON ticket_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_org_id ON ticket_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_created_at ON ticket_activities(created_at);

CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_org_id ON tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket_id ON ticket_tags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag_id ON ticket_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_ticket_followers_ticket_id ON ticket_followers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_followers_user_id ON ticket_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relationships_source ON ticket_relationships(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relationships_target ON ticket_relationships(target_ticket_id);

CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_tenant_id ON attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attachments_organization_id ON attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_tenant ON file_storage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_org ON file_storage(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_entity ON file_storage(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_uploaded_by ON file_storage(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_storage_file_path ON file_storage(file_path);
CREATE INDEX IF NOT EXISTS idx_file_storage_storage_path ON file_storage(storage_path);

-- Índices para SLA e novas tabelas
CREATE INDEX IF NOT EXISTS idx_sla_policies_priority_id ON sla_policies(priority_id);
CREATE INDEX IF NOT EXISTS idx_sla_policies_category_id ON sla_policies(category_id);
CREATE INDEX IF NOT EXISTS idx_sla_policies_active ON sla_policies(is_active);

CREATE INDEX IF NOT EXISTS idx_sla_tracking_ticket_id ON sla_tracking(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_response_due ON sla_tracking(response_due_at);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_resolution_due ON sla_tracking(resolution_due_at);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_escalation_due ON sla_tracking(escalation_due_at);

CREATE INDEX IF NOT EXISTS idx_escalations_ticket_id ON escalations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_escalations_type ON escalations(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalations_date ON escalations(escalated_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_templates_category ON ticket_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_templates_priority ON ticket_templates(priority_id);
CREATE INDEX IF NOT EXISTS idx_templates_active ON ticket_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_public ON system_settings(is_public);

CREATE INDEX IF NOT EXISTS idx_automations_trigger ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_active ON automations(is_active);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_published ON knowledge_articles(is_published);
CREATE INDEX IF NOT EXISTS idx_knowledge_author ON knowledge_articles(author_id);

CREATE INDEX IF NOT EXISTS idx_satisfaction_ticket ON satisfaction_surveys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_user ON satisfaction_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_rating ON satisfaction_surveys(rating);

-- Triggers para atualizar updated_at automaticamente
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_categories_updated_at 
    AFTER UPDATE ON categories
    BEGIN
        UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_priorities_updated_at 
    AFTER UPDATE ON priorities
    BEGIN
        UPDATE priorities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_statuses_updated_at 
    AFTER UPDATE ON statuses
    BEGIN
        UPDATE statuses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_tickets_updated_at 
    AFTER UPDATE ON tickets
    BEGIN
        UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_comments_updated_at
    AFTER UPDATE ON comments
    BEGIN
        UPDATE comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Triggers para novas tabelas
CREATE TRIGGER IF NOT EXISTS update_sla_policies_updated_at
    AFTER UPDATE ON sla_policies
    BEGIN
        UPDATE sla_policies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_sla_tracking_updated_at
    AFTER UPDATE ON sla_tracking
    BEGIN
        UPDATE sla_tracking SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_templates_updated_at
    AFTER UPDATE ON ticket_templates
    BEGIN
        UPDATE ticket_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_settings_updated_at
    AFTER UPDATE ON system_settings
    BEGIN
        UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_automations_updated_at
    AFTER UPDATE ON automations
    BEGIN
        UPDATE automations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_knowledge_updated_at
    AFTER UPDATE ON knowledge_articles
    BEGIN
        UPDATE knowledge_articles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_notifications_updated_at
    AFTER UPDATE ON notifications
    BEGIN
        UPDATE notifications SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para criar SLA tracking automaticamente quando ticket é criado
CREATE TRIGGER IF NOT EXISTS create_sla_tracking_on_ticket_insert
    AFTER INSERT ON tickets
    BEGIN
        INSERT INTO sla_tracking (ticket_id, sla_policy_id, response_due_at, resolution_due_at, escalation_due_at)
        SELECT
            NEW.id,
            sp.id,
            DATETIME(NEW.created_at, '+' || sp.response_time_minutes || ' minutes'),
            DATETIME(NEW.created_at, '+' || sp.resolution_time_minutes || ' minutes'),
            CASE WHEN sp.escalation_time_minutes IS NOT NULL
                 THEN DATETIME(NEW.created_at, '+' || sp.escalation_time_minutes || ' minutes')
                 ELSE NULL END
        FROM sla_policies sp
        WHERE sp.is_active = 1
          AND sp.priority_id = NEW.priority_id
          AND (sp.category_id IS NULL OR sp.category_id = NEW.category_id)
        ORDER BY
            CASE WHEN sp.category_id = NEW.category_id THEN 1 ELSE 2 END,
            sp.id
        LIMIT 1;
    END;

-- Trigger para atualizar SLA tracking quando primeira resposta é dada
CREATE TRIGGER IF NOT EXISTS update_sla_on_first_response
    AFTER INSERT ON comments
    WHEN NEW.user_id IN (SELECT id FROM users WHERE role IN ('admin', 'agent'))
    BEGIN
        UPDATE sla_tracking
        SET
            response_met = 1,
            response_time_minutes = (
                SELECT CAST((julianday(CURRENT_TIMESTAMP) - julianday(t.created_at)) * 24 * 60 AS INTEGER)
                FROM tickets t WHERE t.id = NEW.ticket_id
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE ticket_id = NEW.ticket_id
          AND response_met = 0
          AND (SELECT COUNT(*) FROM comments WHERE ticket_id = NEW.ticket_id AND user_id IN (SELECT id FROM users WHERE role IN ('admin', 'agent'))) = 1;
    END;

-- Trigger para atualizar SLA tracking quando ticket é resolvido
CREATE TRIGGER IF NOT EXISTS update_sla_on_resolution
    AFTER UPDATE ON tickets
    WHEN OLD.status_id != NEW.status_id
     AND NEW.status_id IN (SELECT id FROM statuses WHERE is_final = 1)
    BEGIN
        UPDATE sla_tracking
        SET
            resolution_met = 1,
            resolution_time_minutes = (
                SELECT CAST((julianday(CURRENT_TIMESTAMP) - julianday(OLD.created_at)) * 24 * 60 AS INTEGER)
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE ticket_id = NEW.id AND resolution_met = 0;

        UPDATE tickets SET resolved_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Tabela de cache para otimização de performance
CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para cache
CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_created_at ON cache(created_at);

-- ========================================
-- ÍNDICES PARA SISTEMA DE AUTENTICAÇÃO
-- ========================================

-- Refresh tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(is_active);

-- Permissions e Roles
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_roles_system ON roles(is_system);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles(expires_at);

-- Password policies e history
CREATE INDEX IF NOT EXISTS idx_password_policies_active ON password_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created ON password_history(created_at);

-- Rate limiting
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, identifier_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits(blocked_until);

-- SSO providers
CREATE INDEX IF NOT EXISTS idx_sso_providers_type ON sso_providers(type);
CREATE INDEX IF NOT EXISTS idx_sso_providers_active ON sso_providers(is_active);

-- Login attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);

-- WebAuthn credentials
CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON webauthn_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_active ON webauthn_credentials(is_active);

-- Verification codes
CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_type ON verification_codes(type);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_hash ON verification_codes(code_hash);

-- Auth audit logs
CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_ip ON auth_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON auth_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_retention ON auth_audit_logs(data_retention_expires_at);

-- Users expandidos
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(is_email_verified);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_locked ON users(locked_until);
CREATE INDEX IF NOT EXISTS idx_users_sso_provider ON users(sso_provider);
CREATE INDEX IF NOT EXISTS idx_users_sso_user_id ON users(sso_user_id);

-- ========================================
-- SISTEMA DE BASE DE CONHECIMENTO
-- ========================================

-- Tabela de categorias para artigos da base de conhecimento
CREATE TABLE IF NOT EXISTS kb_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'DocumentTextIcon',
    color TEXT DEFAULT '#3B82F6',
    parent_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES kb_categories(id) ON DELETE SET NULL
);

-- Tabela de artigos da base de conhecimento
CREATE TABLE IF NOT EXISTS kb_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'html', -- 'html', 'markdown', 'json'
    category_id INTEGER,
    author_id INTEGER NOT NULL,
    reviewer_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'private')),
    featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    search_keywords TEXT, -- Palavras-chave para busca
    meta_title TEXT,
    meta_description TEXT,
    published_at DATETIME,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de tags para artigos
CREATE TABLE IF NOT EXISTS kb_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#6B7280',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relacionamento artigos-tags (many-to-many)
CREATE TABLE IF NOT EXISTS kb_article_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES kb_tags(id) ON DELETE CASCADE,
    UNIQUE(article_id, tag_id)
);

-- Tabela de feedback dos artigos
CREATE TABLE IF NOT EXISTS kb_article_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id INTEGER,
    session_id TEXT, -- Para usuários anônimos
    was_helpful BOOLEAN NOT NULL,
    comment TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de anexos para artigos
CREATE TABLE IF NOT EXISTS kb_article_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    alt_text TEXT,
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de relacionamento entre artigos e tickets (para sugestões)
CREATE TABLE IF NOT EXISTS kb_article_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    suggested_by INTEGER, -- usuário que sugeriu (pode ser sistema)
    was_used BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (suggested_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- SISTEMA DE ANALYTICS E MÉTRICAS
-- ========================================

-- Tabela para armazenar métricas diárias
CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    tickets_created INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    tickets_reopened INTEGER DEFAULT 0,
    avg_first_response_time INTEGER, -- em minutos
    avg_resolution_time INTEGER, -- em minutos
    satisfaction_score DECIMAL(3,2), -- 0.00 a 5.00
    satisfaction_responses INTEGER DEFAULT 0,
    kb_articles_viewed INTEGER DEFAULT 0,
    kb_searches_performed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- Tabela para métricas por agente
CREATE TABLE IF NOT EXISTS analytics_agent_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    date DATE NOT NULL,
    tickets_assigned INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_first_response_time INTEGER, -- em minutos
    avg_resolution_time INTEGER, -- em minutos
    satisfaction_score DECIMAL(3,2),
    satisfaction_responses INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(agent_id, date)
);

-- Tabela para métricas por categoria
CREATE TABLE IF NOT EXISTS analytics_category_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    date DATE NOT NULL,
    tickets_created INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_resolution_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, date)
);

-- ========================================
-- SISTEMA DE NOTIFICAÇÕES TEMPO REAL
-- ========================================

-- Tabela de sessões de usuários online
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY, -- session ID único
    user_id INTEGER NOT NULL,
    socket_id TEXT,
    user_agent TEXT,
    ip_address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de eventos de notificação
CREATE TABLE IF NOT EXISTS notification_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- 'ticket_created', 'ticket_assigned', etc.
    target_users TEXT, -- JSON array de user IDs que devem receber
    payload TEXT NOT NULL, -- JSON com dados do evento
    processed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de lotes de notificações (notification batching)
CREATE TABLE IF NOT EXISTS notification_batches (
    id TEXT PRIMARY KEY,
    batch_key TEXT NOT NULL, -- 'digest_email', 'ticket_updates', 'sla_warnings', etc.
    notifications TEXT NOT NULL, -- JSON array de notificações
    target_users TEXT NOT NULL, -- JSON array de user IDs
    created_at DATETIME NOT NULL,
    scheduled_at DATETIME NOT NULL, -- quando o lote deve ser enviado
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'processed', 'failed')),
    config TEXT, -- JSON com configuração do lote
    metadata TEXT, -- JSON com metadados adicionais (groupKey, batchKey, etc.)
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações de lotes
CREATE TABLE IF NOT EXISTS batch_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_key TEXT UNIQUE NOT NULL,
    max_batch_size INTEGER NOT NULL DEFAULT 10,
    max_wait_time INTEGER NOT NULL DEFAULT 300000, -- milliseconds
    group_by TEXT NOT NULL DEFAULT 'user' CHECK (group_by IN ('user', 'ticket', 'type', 'priority', 'custom')),
    custom_grouper TEXT, -- função JavaScript para agrupamento customizado
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de regras de filtragem inteligente
CREATE TABLE IF NOT EXISTS filter_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    conditions TEXT NOT NULL, -- JSON array de FilterCondition
    action TEXT NOT NULL CHECK (action IN ('block', 'allow', 'delay', 'modify', 'priority_change')),
    action_params TEXT, -- JSON com parâmetros da ação (delayMinutes, newPriority, etc.)
    priority INTEGER NOT NULL DEFAULT 50, -- prioridade da regra (maior = mais alta)
    is_active BOOLEAN DEFAULT TRUE,
    user_id INTEGER, -- NULL para regras globais, ou ID do usuário para regras específicas
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de regras de escalação de notificações
CREATE TABLE IF NOT EXISTS escalation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    conditions TEXT NOT NULL, -- JSON array de EscalationCondition
    actions TEXT NOT NULL, -- JSON array de EscalationAction
    priority INTEGER NOT NULL DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    cooldown_period INTEGER NOT NULL DEFAULT 30, -- minutos de cooldown entre escalações
    max_escalations INTEGER NOT NULL DEFAULT 3, -- número máximo de escalações permitidas
    created_by INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Tabela de instâncias de escalação ativas
CREATE TABLE IF NOT EXISTS escalation_instances (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    triggered_at DATETIME NOT NULL,
    executed_actions TEXT, -- JSON array de ExecutedAction
    status TEXT NOT NULL CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled')),
    escalation_level INTEGER NOT NULL DEFAULT 1,
    last_action_at DATETIME,
    next_action_at DATETIME,
    metadata TEXT, -- JSON com metadados adicionais
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES escalation_rules(id) ON DELETE CASCADE
);

-- Atualizar tabela de notificações existente para suportar mais tipos
-- (Fazer via ALTER TABLE para não quebrar dados existentes)

-- ========================================
-- ÍNDICES PARA PERFORMANCE
-- ========================================

-- Knowledge Base
CREATE INDEX IF NOT EXISTS idx_kb_categories_parent ON kb_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_active ON kb_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_kb_categories_slug ON kb_categories(slug);

CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_author ON kb_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_visibility ON kb_articles(visibility);
CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_articles_featured ON kb_articles(featured);
CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON kb_articles(published_at);
CREATE INDEX IF NOT EXISTS idx_kb_articles_search ON kb_articles(title, search_keywords);

CREATE INDEX IF NOT EXISTS idx_kb_tags_slug ON kb_tags(slug);
CREATE INDEX IF NOT EXISTS idx_kb_article_tags_article ON kb_article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_tags_tag ON kb_article_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_kb_feedback_article ON kb_article_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_feedback_helpful ON kb_article_feedback(was_helpful);

CREATE INDEX IF NOT EXISTS idx_kb_attachments_article ON kb_article_attachments(article_id);

-- Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_analytics_agent_date ON analytics_agent_metrics(agent_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_category_date ON analytics_category_metrics(category_id, date);

-- Sessions e Notificações
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_events_processed ON notification_events(processed);
CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(event_type);

-- Notification Batches
CREATE INDEX IF NOT EXISTS idx_notification_batches_batch_key ON notification_batches(batch_key);
CREATE INDEX IF NOT EXISTS idx_notification_batches_status ON notification_batches(status);
CREATE INDEX IF NOT EXISTS idx_notification_batches_scheduled ON notification_batches(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_batches_created ON notification_batches(created_at);

-- Filter Rules
CREATE INDEX IF NOT EXISTS idx_filter_rules_user_id ON filter_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_filter_rules_active ON filter_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_rules_priority ON filter_rules(priority);

-- Escalation Rules
CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON escalation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_priority ON escalation_rules(priority);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_created_by ON escalation_rules(created_by);

-- Escalation Instances
CREATE INDEX IF NOT EXISTS idx_escalation_instances_notification ON escalation_instances(notification_id);
CREATE INDEX IF NOT EXISTS idx_escalation_instances_rule ON escalation_instances(rule_id);
CREATE INDEX IF NOT EXISTS idx_escalation_instances_status ON escalation_instances(status);
CREATE INDEX IF NOT EXISTS idx_escalation_instances_next_action ON escalation_instances(next_action_at) WHERE status = 'pending';

-- Batch Configurations
CREATE INDEX IF NOT EXISTS idx_batch_configurations_active ON batch_configurations(is_active);

-- Filter Rules
CREATE INDEX IF NOT EXISTS idx_filter_rules_user ON filter_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_filter_rules_active ON filter_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_filter_rules_priority ON filter_rules(priority DESC);

-- ========================================
-- TRIGGERS PARA AUTOMAÇÃO
-- ========================================

-- Trigger para updated_at nas novas tabelas
CREATE TRIGGER IF NOT EXISTS update_kb_categories_updated_at
    AFTER UPDATE ON kb_categories
    BEGIN
        UPDATE kb_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_kb_articles_updated_at
    AFTER UPDATE ON kb_articles
    BEGIN
        UPDATE kb_articles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_notification_batches_updated_at
    AFTER UPDATE ON notification_batches
    BEGIN
        UPDATE notification_batches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_batch_configurations_updated_at
    AFTER UPDATE ON batch_configurations
    BEGIN
        UPDATE batch_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_filter_rules_updated_at
    AFTER UPDATE ON filter_rules
    BEGIN
        UPDATE filter_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_escalation_rules_updated_at
    AFTER UPDATE ON escalation_rules
    BEGIN
        UPDATE escalation_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_escalation_instances_updated_at
    AFTER UPDATE ON escalation_instances
    BEGIN
        UPDATE escalation_instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para incrementar view_count automaticamente
CREATE TRIGGER IF NOT EXISTS increment_article_view_count
    AFTER INSERT ON audit_logs
    WHEN NEW.entity_type = 'kb_article' AND NEW.action = 'view'
    BEGIN
        UPDATE kb_articles
        SET view_count = view_count + 1
        WHERE id = NEW.entity_id;
    END;

-- Trigger para atualizar contadores de feedback
CREATE TRIGGER IF NOT EXISTS update_article_feedback_counters
    AFTER INSERT ON kb_article_feedback
    BEGIN
        UPDATE kb_articles
        SET
            helpful_votes = (
                SELECT COUNT(*) FROM kb_article_feedback
                WHERE article_id = NEW.article_id AND was_helpful = 1
            ),
            not_helpful_votes = (
                SELECT COUNT(*) FROM kb_article_feedback
                WHERE article_id = NEW.article_id AND was_helpful = 0
            )
        WHERE id = NEW.article_id;
    END;

-- ========================================
-- SISTEMA DE WORKFLOWS AVANÇADO
-- ========================================

-- Tabela de definições de workflow
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_conditions TEXT NOT NULL, -- JSON com condições de trigger
    steps_json TEXT NOT NULL, -- JSON com os passos do workflow
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de workflows (mantida para compatibilidade)
CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'status_changed', 'sla_warning', 'time_based', 'manual', 'comment_added', 'assignment_changed')),
    trigger_conditions TEXT, -- JSON conditions for triggering
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,
    category TEXT, -- 'ticket_automation', 'notification', 'escalation', 'approval'
    priority INTEGER DEFAULT 0, -- Higher priority runs first
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_executed_at DATETIME,
    created_by INTEGER NOT NULL,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de steps do workflow
CREATE TABLE IF NOT EXISTS workflow_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('action', 'condition', 'approval', 'delay', 'parallel', 'webhook', 'script', 'notification')),
    name TEXT NOT NULL,
    description TEXT,
    configuration TEXT NOT NULL, -- JSON configuration for the step
    timeout_minutes INTEGER DEFAULT 60,
    retry_count INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 5,
    is_optional BOOLEAN DEFAULT FALSE,
    parent_step_id INTEGER, -- For nested or parallel steps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE,
    UNIQUE(workflow_id, step_order)
);

-- Tabela de execuções de workflow
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
    FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id) ON DELETE SET NULL,
    FOREIGN KEY (trigger_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de execuções de steps
CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL,
    step_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'timeout')),
    input_data TEXT, -- JSON input data
    output_data TEXT, -- JSON output data
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    execution_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
);

-- Tabela de aprovações de workflow
CREATE TABLE IF NOT EXISTS workflow_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER NOT NULL, -- ID da execução do workflow
    approver_id INTEGER NOT NULL, -- Quem deve aprovar
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    comments TEXT, -- Comentários da aprovação
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- SISTEMA DE APROVAÇÕES
-- ========================================

-- Tabela de aprovações
CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'ticket', 'change_request', 'escalation', 'workflow'
    entity_id INTEGER NOT NULL,
    approval_type TEXT NOT NULL, -- 'budget', 'access', 'change', 'escalation'
    requested_by INTEGER NOT NULL,
    assigned_to INTEGER,
    assigned_group TEXT, -- JSON array of user IDs or role names
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'timeout')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    reason TEXT,
    approval_data TEXT, -- JSON data about what needs approval
    approved_by INTEGER,
    approved_at DATETIME,
    rejection_reason TEXT,
    due_date DATETIME,
    auto_approve_after DATETIME,
    notification_sent BOOLEAN DEFAULT FALSE,
    escalation_level INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de histórico de aprovações
CREATE TABLE IF NOT EXISTS approval_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    approval_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'requested', 'assigned', 'approved', 'rejected', 'escalated', 'cancelled'
    performed_by INTEGER,
    previous_status TEXT,
    new_status TEXT,
    comment TEXT,
    metadata TEXT, -- JSON additional data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de tokens de aprovação (para link-based approval sem login)
CREATE TABLE IF NOT EXISTS approval_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    approval_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE
);

-- ========================================
-- SISTEMA DE INTEGRAÇÕES
-- ========================================

-- Tabela de integrações configuradas
CREATE TABLE IF NOT EXISTS integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'webhook', 'api', 'sso', 'email', 'whatsapp', 'teams', 'slack', 'gov_br'
    provider TEXT NOT NULL, -- 'microsoft', 'google', 'whatsapp_business', 'slack', 'custom'
    configuration TEXT NOT NULL, -- JSON configuration
    credentials TEXT, -- Encrypted JSON credentials
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE, -- System integrations cannot be deleted
    sync_frequency TEXT, -- 'realtime', 'hourly', 'daily', 'weekly', 'manual'
    last_sync_at DATETIME,
    last_sync_status TEXT, -- 'success', 'error', 'partial'
    error_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de logs de integração
CREATE TABLE IF NOT EXISTS integration_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    integration_id INTEGER NOT NULL,
    operation TEXT NOT NULL, -- 'sync', 'send', 'receive', 'auth', 'webhook'
    status TEXT NOT NULL, -- 'success', 'error', 'warning', 'info'
    message TEXT,
    request_data TEXT, -- JSON request data
    response_data TEXT, -- JSON response data
    error_details TEXT, -- JSON error details
    execution_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

-- Tabela de webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    integration_id INTEGER,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT DEFAULT 'POST' CHECK (method IN ('POST', 'PUT', 'PATCH')),
    event_types TEXT NOT NULL, -- JSON array of event types
    headers TEXT, -- JSON headers to send
    secret_token TEXT, -- For signature verification
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at DATETIME,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de entregas de webhook
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON payload sent
    request_headers TEXT, -- JSON headers sent
    response_status INTEGER,
    response_body TEXT,
    response_headers TEXT, -- JSON response headers
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    delivery_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    next_retry_at DATETIME,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

-- ========================================
-- SISTEMA DE IA E CLASSIFICAÇÃO
-- ========================================

-- Tabela de classificações de IA
CREATE TABLE IF NOT EXISTS ai_classifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    suggested_category_id INTEGER,
    suggested_priority_id INTEGER,
    suggested_category TEXT, -- Nome da categoria sugerida
    confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
    reasoning TEXT, -- Explicação da classificação
    model_name TEXT NOT NULL DEFAULT 'gpt-4o', -- 'gpt-4o', 'claude-3', 'local-model', 'rule-based'
    model_version TEXT DEFAULT '2024-08-06',
    probability_distribution TEXT, -- JSON with all class probabilities
    input_tokens INTEGER,
    output_tokens INTEGER,
    processing_time_ms INTEGER,
    was_accepted BOOLEAN, -- Se a sugestão foi aceita
    corrected_category_id INTEGER, -- Categoria correta se diferente
    feedback_by INTEGER, -- Quem deu o feedback
    feedback_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (suggested_category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (suggested_priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
    FOREIGN KEY (corrected_category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (feedback_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de sugestões de IA
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    suggestion_type TEXT NOT NULL, -- 'solution', 'response', 'escalation', 'related_articles', 'assignment', 'auto_response'
    content TEXT NOT NULL, -- O conteúdo da sugestão
    confidence_score DECIMAL(5,4),
    model_name TEXT DEFAULT 'gpt-4o',
    source_type TEXT, -- 'knowledge_base', 'similar_tickets', 'ai_model', 'rule_based'
    source_references TEXT, -- JSON array of source IDs
    reasoning TEXT, -- Por que esta sugestão foi feita
    was_used BOOLEAN DEFAULT FALSE,
    was_helpful BOOLEAN, -- Feedback do usuário
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

-- Tabela de dados de treinamento para modelos de IA
CREATE TABLE IF NOT EXISTS ai_training_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input TEXT NOT NULL, -- Texto de entrada para treinamento
    output TEXT NOT NULL, -- Resultado esperado
    feedback TEXT, -- Feedback sobre a qualidade dos dados
    model_version TEXT DEFAULT '1.0', -- Versão do modelo para qual este dado é usado
    data_type TEXT NOT NULL, -- 'classification', 'suggestion', 'sentiment', 'intent'
    quality_score DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00
    source_entity_type TEXT, -- 'ticket', 'comment', 'kb_article'
    source_entity_id INTEGER,
    created_by INTEGER,
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    is_validated BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de embeddings vetoriais para busca semântica
CREATE TABLE IF NOT EXISTS vector_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'ticket', 'comment', 'kb_article', 'category'
    entity_id INTEGER NOT NULL,
    embedding_vector TEXT NOT NULL, -- JSON array com o vetor de embedding
    model_name TEXT NOT NULL DEFAULT 'text-embedding-3-small', -- Modelo usado para gerar o embedding
    model_version TEXT DEFAULT '1.0',
    vector_dimension INTEGER DEFAULT 1536, -- Dimensão do vetor
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, model_name)
);

-- ========================================
-- SISTEMA DE ORGANIZAÇÕES E DEPARTAMENTOS
-- ========================================

-- Tabela de organizações (para multi-tenancy futuro)
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

-- Tabela de tenants legada (compatibilidade com rotas/base antiga)
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
    is_active BOOLEAN DEFAULT TRUE,
    trial_ends_at DATETIME,
    subscription_ends_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações de tenant (multi-tenant)
CREATE TABLE IF NOT EXISTS tenant_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    feature_flags TEXT NOT NULL, -- JSON com flags de funcionalidades
    limits TEXT NOT NULL, -- JSON com limites (users, tickets, storage)
    customizations TEXT, -- JSON com customizações (logo, cores, etc.)
    api_settings TEXT, -- JSON com configurações de API
    integrations_config TEXT, -- JSON com configurações de integrações
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(organization_id)
);

-- Tabela de auditoria avançada
CREATE TABLE IF NOT EXISTS audit_advanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'ticket', 'user', 'category', etc.
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'view', 'export'
    old_values TEXT, -- JSON com valores antigos (campo por campo)
    new_values TEXT, -- JSON com valores novos (campo por campo)
    user_id INTEGER,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT, -- Para rastreamento de requests
    api_endpoint TEXT, -- Endpoint da API usado
    organization_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Tabela de tracking de uso da API
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL, -- '/api/tickets', '/api/users', etc.
    method TEXT NOT NULL, -- 'GET', 'POST', 'PUT', 'DELETE'
    organization_id INTEGER DEFAULT 1, -- ID do tenant/organização
    user_id INTEGER, -- Usuário que fez a chamada
    api_key_id INTEGER, -- Se foi feita via API key
    response_time_ms INTEGER NOT NULL, -- Tempo de resposta em milissegundos
    status_code INTEGER NOT NULL, -- Status HTTP da resposta
    request_size_bytes INTEGER, -- Tamanho do request em bytes
    response_size_bytes INTEGER, -- Tamanho da resposta em bytes
    error_message TEXT, -- Mensagem de erro se houver
    rate_limit_hit BOOLEAN DEFAULT FALSE, -- Se hit rate limit
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    date DATE DEFAULT (DATE('now')), -- Para aggregações por dia
    hour INTEGER DEFAULT (strftime('%H', 'now')), -- Para aggregações por hora
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Teams (referenced by problems, change_requests, configuration_items, service_request_tasks, etc.)
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    lead_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id);

CREATE TRIGGER IF NOT EXISTS update_teams_updated_at
AFTER UPDATE ON teams
FOR EACH ROW
BEGIN
    UPDATE teams SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Tabela de departamentos
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER DEFAULT 1, -- Default org for single-tenant
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER, -- For hierarchical departments
    manager_id INTEGER,
    email TEXT, -- Department email for auto-assignment
    phone TEXT,
    cost_center TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    business_hours TEXT, -- JSON with business hours
    escalation_rules TEXT, -- JSON escalation configuration
    sla_policy_id INTEGER, -- Default SLA for this department
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL
);

-- Tabela de usuários por departamento (many-to-many)
CREATE TABLE IF NOT EXISTS user_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'lead', 'manager', 'admin')),
    is_primary BOOLEAN DEFAULT FALSE, -- Primary department for the user
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE(user_id, department_id)
);

-- ========================================
-- SISTEMA DE ANALYTICS AVANÇADO
-- ========================================

-- Tabela de métricas em tempo real
CREATE TABLE IF NOT EXISTS analytics_realtime_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    dimension_filters TEXT, -- JSON filters applied (dept, category, etc.)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME -- For automatic cleanup
);

-- Tabela de eventos de analytics
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- 'page_view', 'ticket_action', 'search', 'kb_view', 'feature_use'
    user_id INTEGER,
    session_id TEXT,
    entity_type TEXT, -- 'ticket', 'kb_article', 'page'
    entity_id INTEGER,
    properties TEXT, -- JSON with event properties
    user_agent TEXT,
    ip_address TEXT,
    referrer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de métricas de performance por agente (histórico)
CREATE TABLE IF NOT EXISTS analytics_agent_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
    tickets_assigned INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    tickets_escalated INTEGER DEFAULT 0,
    avg_first_response_minutes DECIMAL(10,2),
    avg_resolution_minutes DECIMAL(10,2),
    satisfaction_score DECIMAL(3,2), -- Average CSAT
    satisfaction_responses INTEGER DEFAULT 0,
    sla_breaches INTEGER DEFAULT 0,
    knowledge_articles_created INTEGER DEFAULT 0,
    peer_help_given INTEGER DEFAULT 0, -- Times helped other agents
    peer_help_received INTEGER DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(agent_id, period_start, period_type)
);

-- ========================================
-- SISTEMA DE COMUNICAÇÃO UNIFICADA
-- ========================================

-- Tabela de canais de comunicação
CREATE TABLE IF NOT EXISTS communication_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'email', 'whatsapp', 'teams', 'slack', 'sms', 'voice', 'chat'
    configuration TEXT NOT NULL, -- JSON configuration
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0, -- Higher priority channels tried first
    success_rate DECIMAL(5,4), -- Delivery success rate
    avg_response_time_minutes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de mensagens enviadas
CREATE TABLE IF NOT EXISTS communication_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    ticket_id INTEGER,
    user_id INTEGER NOT NULL, -- Recipient
    sender_id INTEGER, -- Who sent it (can be system)
    message_type TEXT NOT NULL, -- 'notification', 'update', 'reminder', 'alert', 'marketing'
    subject TEXT,
    content TEXT NOT NULL,
    content_format TEXT DEFAULT 'text', -- 'text', 'html', 'markdown'
    template_id INTEGER, -- If used a template
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')),
    external_id TEXT, -- ID from external system
    delivery_attempts INTEGER DEFAULT 0,
    delivered_at DATETIME,
    read_at DATETIME,
    failed_reason TEXT,
    cost_cents INTEGER, -- Cost in cents for paid channels
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES communication_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- BRASIL-SPECIFIC TABLES
-- ========================================

-- Tabela de contatos WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    phone_number TEXT NOT NULL, -- Format: +55XXXXXXXXXXX
    display_name TEXT,
    profile_picture_url TEXT,
    is_business BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_seen DATETIME,
    status_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(phone_number)
);

-- Tabela de sessões WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL, -- Número do telefone da sessão
    session_data TEXT, -- JSON com dados da sessão WhatsApp
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP, -- Última atividade da sessão
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone_number)
);

-- Tabela de mensagens WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    ticket_id INTEGER,
    message_id TEXT UNIQUE NOT NULL, -- WhatsApp message ID
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL, -- 'text', 'image', 'document', 'audio', 'video', 'location'
    content TEXT,
    media_url TEXT,
    media_mime_type TEXT,
    media_caption TEXT,
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
);

-- Tabela de integrações gov.br
CREATE TABLE IF NOT EXISTS govbr_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    cpf TEXT UNIQUE, -- Brazilian CPF
    cnpj TEXT, -- Brazilian CNPJ for businesses
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at DATETIME,
    profile_data TEXT, -- JSON with gov.br profile data
    verification_level TEXT DEFAULT 'bronze', -- 'bronze', 'silver', 'gold'
    last_sync_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de consentimentos LGPD
CREATE TABLE IF NOT EXISTS lgpd_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    consent_type TEXT NOT NULL, -- 'data_processing', 'marketing', 'analytics', 'cookies'
    purpose TEXT NOT NULL, -- Specific purpose of data processing
    legal_basis TEXT NOT NULL, -- 'consent', 'contract', 'legal_obligation', 'legitimate_interest'
    is_given BOOLEAN NOT NULL,
    consent_method TEXT, -- 'web_form', 'api', 'email', 'phone', 'paper'
    consent_evidence TEXT, -- JSON with evidence of consent
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME, -- When consent expires
    withdrawn_at DATETIME,
    withdrawal_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- PERFORMANCE CRITICAL INDEXES (Added by Performance Engineer)
-- ========================================

-- Composite indexes for frequent JOIN operations
CREATE INDEX IF NOT EXISTS idx_tickets_org_status ON tickets(organization_id, status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org_assigned ON tickets(organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_org_user ON tickets(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org_created ON tickets(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_status ON tickets(assigned_to, status_id) WHERE assigned_to IS NOT NULL;

-- Covering indexes for analytics queries (includes commonly selected columns)
CREATE INDEX IF NOT EXISTS idx_tickets_analytics ON tickets(organization_id, status_id, priority_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_tracking ON tickets(organization_id, status_id, created_at, resolved_at);

-- Comments optimizations
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created ON comments(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON comments(user_id, created_at DESC);

-- SLA tracking composite indexes
CREATE INDEX IF NOT EXISTS idx_sla_tracking_ticket_policy ON sla_tracking(ticket_id, sla_policy_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_response_met ON sla_tracking(response_met, response_due_at);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_resolution_met ON sla_tracking(resolution_met, resolution_due_at);

-- Notifications performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_user ON notifications(ticket_id, user_id);

-- KB Articles search optimization
CREATE INDEX IF NOT EXISTS idx_kb_articles_status_published ON kb_articles(status, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_kb_articles_category_status ON kb_articles(category_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_views ON kb_articles(view_count DESC) WHERE status = 'published';

-- Analytics daily metrics
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date_desc ON analytics_daily_metrics(date DESC);

-- User sessions for real-time features
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active, last_activity);

-- Audit logs optimization
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

-- ========================================
-- ÍNDICES PARA PERFORMANCE DAS NOVAS TABELAS
-- ========================================

-- Workflows
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON workflow_steps(step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_type ON workflow_steps(step_type);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_trigger ON workflow_executions(trigger_entity_type, trigger_entity_id);

CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_execution ON workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_step ON workflow_step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status ON workflow_step_executions(status);

-- Aprovações
CREATE INDEX IF NOT EXISTS idx_approvals_entity ON approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by ON approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_approvals_assigned_to ON approvals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_due_date ON approvals(due_date);

CREATE INDEX IF NOT EXISTS idx_approval_history_approval ON approval_history(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_performed_by ON approval_history(performed_by);

CREATE INDEX IF NOT EXISTS idx_approval_tokens_approval ON approval_tokens(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_token ON approval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_expires ON approval_tokens(expires_at);

-- Integrações
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_active ON integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by);

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON integration_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_webhooks_integration ON webhooks(integration_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_success ON webhook_deliveries(success);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered ON webhook_deliveries(delivered_at);

-- IA e Classificação
CREATE INDEX IF NOT EXISTS idx_ai_classifications_ticket ON ai_classifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_model ON ai_classifications(model_name);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_confidence ON ai_classifications(confidence_score);
CREATE INDEX IF NOT EXISTS idx_ai_classifications_accepted ON ai_classifications(was_accepted);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_ticket ON ai_suggestions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_used ON ai_suggestions(was_used);

-- Training data indexes (table may not exist - conditional)
-- CREATE INDEX IF NOT EXISTS idx_ai_training_data_validated ON ai_training_data(is_validated);

-- Vector Embeddings (table may not exist - conditional)
-- CREATE INDEX IF NOT EXISTS idx_vector_embeddings_model ON vector_embeddings(model_name);

-- Workflow Definitions
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active ON workflow_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_by ON workflow_definitions(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_version ON workflow_definitions(version);

-- Workflow Approvals
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_execution ON workflow_approvals(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver ON workflow_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON workflow_approvals(status);

-- Organizações e Departamentos
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription ON organizations(subscription_status);

CREATE INDEX IF NOT EXISTS idx_departments_organization ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active);

CREATE INDEX IF NOT EXISTS idx_user_departments_user ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department ON user_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_primary ON user_departments(is_primary);

-- Analytics Avançado
CREATE INDEX IF NOT EXISTS idx_analytics_realtime_metric ON analytics_realtime_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_realtime_timestamp ON analytics_realtime_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_realtime_expires ON analytics_realtime_metrics(expires_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_entity ON analytics_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_agent_performance_agent ON analytics_agent_performance(agent_id);
CREATE INDEX IF NOT EXISTS idx_analytics_agent_performance_period ON analytics_agent_performance(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_agent_performance_type ON analytics_agent_performance(period_type);

-- Comunicação
CREATE INDEX IF NOT EXISTS idx_communication_channels_type ON communication_channels(type);
CREATE INDEX IF NOT EXISTS idx_communication_channels_active ON communication_channels(is_active);

CREATE INDEX IF NOT EXISTS idx_communication_messages_channel ON communication_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_ticket ON communication_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_user ON communication_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_status ON communication_messages(status);
CREATE INDEX IF NOT EXISTS idx_communication_messages_type ON communication_messages(message_type);

-- Enterprise Features
CREATE INDEX IF NOT EXISTS idx_tenant_configurations_org ON tenant_configurations(organization_id);

CREATE INDEX IF NOT EXISTS idx_audit_advanced_entity ON audit_advanced(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_user ON audit_advanced(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_organization ON audit_advanced(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_created ON audit_advanced(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_advanced_action ON audit_advanced(action);

CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage_tracking(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_organization ON api_usage_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_tracking(date);
CREATE INDEX IF NOT EXISTS idx_api_usage_hour ON api_usage_tracking(hour);
CREATE INDEX IF NOT EXISTS idx_api_usage_status ON api_usage_tracking(status_code);

-- Brasil-specific
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_active ON whatsapp_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_activity ON whatsapp_sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_user ON whatsapp_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts(phone_number);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ticket ON whatsapp_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages(direction);

CREATE INDEX IF NOT EXISTS idx_govbr_integrations_user ON govbr_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_govbr_integrations_cpf ON govbr_integrations(cpf);
CREATE INDEX IF NOT EXISTS idx_govbr_integrations_active ON govbr_integrations(is_active);

CREATE INDEX IF NOT EXISTS idx_lgpd_consents_user ON lgpd_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_consents_type ON lgpd_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_lgpd_consents_given ON lgpd_consents(is_given);

-- ========================================
-- TRIGGERS PARA AUTOMAÇÃO DAS NOVAS TABELAS
-- ========================================

-- AI & ML Tables
CREATE TRIGGER IF NOT EXISTS update_vector_embeddings_updated_at
    AFTER UPDATE ON vector_embeddings
    BEGIN
        UPDATE vector_embeddings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Workflow Definitions
CREATE TRIGGER IF NOT EXISTS update_workflow_definitions_updated_at
    AFTER UPDATE ON workflow_definitions
    BEGIN
        UPDATE workflow_definitions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Enterprise Tables
CREATE TRIGGER IF NOT EXISTS update_tenant_configurations_updated_at
    AFTER UPDATE ON tenant_configurations
    BEGIN
        UPDATE tenant_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- WhatsApp Sessions
CREATE TRIGGER IF NOT EXISTS update_whatsapp_sessions_updated_at
    AFTER UPDATE ON whatsapp_sessions
    BEGIN
        UPDATE whatsapp_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para auditoria automática em mudanças de tickets
CREATE TRIGGER IF NOT EXISTS audit_ticket_changes
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
            1 -- Default organization
        );
    END;

-- Trigger para auditoria automática em mudanças de usuários
CREATE TRIGGER IF NOT EXISTS audit_user_changes
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
            1 -- Default organization
        );
    END;

-- Workflows
CREATE TRIGGER IF NOT EXISTS update_workflows_updated_at
    AFTER UPDATE ON workflows
    BEGIN
        UPDATE workflows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_workflow_steps_updated_at
    AFTER UPDATE ON workflow_steps
    BEGIN
        UPDATE workflow_steps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Aprovações
CREATE TRIGGER IF NOT EXISTS update_approvals_updated_at
    AFTER UPDATE ON approvals
    BEGIN
        UPDATE approvals SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Integrações
CREATE TRIGGER IF NOT EXISTS update_integrations_updated_at
    AFTER UPDATE ON integrations
    BEGIN
        UPDATE integrations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_webhooks_updated_at
    AFTER UPDATE ON webhooks
    BEGIN
        UPDATE webhooks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Organizações e Departamentos
CREATE TRIGGER IF NOT EXISTS update_organizations_updated_at
    AFTER UPDATE ON organizations
    BEGIN
        UPDATE organizations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_departments_updated_at
    AFTER UPDATE ON departments
    BEGIN
        UPDATE departments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Comunicação
CREATE TRIGGER IF NOT EXISTS update_communication_channels_updated_at
    AFTER UPDATE ON communication_channels
    BEGIN
        UPDATE communication_channels SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Brasil-specific
CREATE TRIGGER IF NOT EXISTS update_whatsapp_contacts_updated_at
    AFTER UPDATE ON whatsapp_contacts
    BEGIN
        UPDATE whatsapp_contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_govbr_integrations_updated_at
    AFTER UPDATE ON govbr_integrations
    BEGIN
        UPDATE govbr_integrations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para incrementar counters de workflow execution
CREATE TRIGGER IF NOT EXISTS increment_workflow_execution_counters
    AFTER UPDATE ON workflow_executions
    WHEN OLD.status != NEW.status AND NEW.status IN ('completed', 'failed')
    BEGIN
        UPDATE workflows
        SET
            execution_count = execution_count + 1,
            success_count = CASE WHEN NEW.status = 'completed'
                           THEN success_count + 1
                           ELSE success_count END,
            failure_count = CASE WHEN NEW.status = 'failed'
                           THEN failure_count + 1
                           ELSE failure_count END,
            last_executed_at = CURRENT_TIMESTAMP
        WHERE id = NEW.workflow_id;
    END;

-- Trigger para criar log de auditoria em mudanças importantes
CREATE TRIGGER IF NOT EXISTS audit_workflow_changes
    AFTER UPDATE ON workflows
    WHEN OLD.is_active != NEW.is_active OR OLD.trigger_conditions != NEW.trigger_conditions
    BEGIN
        INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
        VALUES (
            'workflow',
            NEW.id,
            'update',
            json_object('is_active', OLD.is_active, 'trigger_conditions', OLD.trigger_conditions),
            json_object('is_active', NEW.is_active, 'trigger_conditions', NEW.trigger_conditions),
            NEW.updated_by
        );
    END;

-- Trigger para audit log em aprovações
CREATE TRIGGER IF NOT EXISTS audit_approval_status_changes
    AFTER UPDATE ON approvals
    WHEN OLD.status != NEW.status
    BEGIN
        INSERT INTO approval_history (approval_id, action, performed_by, previous_status, new_status)
        VALUES (NEW.id, NEW.status, NEW.approved_by, OLD.status, NEW.status);

        INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
        VALUES (
            'approval',
            NEW.id,
            'status_change',
            json_object('status', OLD.status),
            json_object('status', NEW.status, 'approved_by', NEW.approved_by),
            NEW.approved_by
        );
    END;

-- ========================================
-- ADVANCED PERFORMANCE INDEXES
-- Covering indexes, partial indexes, and composite indexes for optimal query performance
-- ========================================

-- Covering index for dashboard metrics query (avoids table lookups)
CREATE INDEX IF NOT EXISTS idx_tickets_dashboard_covering
ON tickets(organization_id, status_id, priority_id, created_at DESC)
WHERE status_id IN (1, 2, 3, 4);

-- Partial index for active tickets (most commonly queried)
CREATE INDEX IF NOT EXISTS idx_tickets_active_only
ON tickets(organization_id, created_at DESC, assigned_to)
WHERE status_id IN (1, 2);

-- Partial index for SLA tracking on unresolved tickets
CREATE INDEX IF NOT EXISTS idx_sla_tracking_active_violations
ON sla_tracking(ticket_id, response_due_at, resolution_due_at)
WHERE response_met = 0 OR resolution_met = 0;

-- Composite index for ticket filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tickets_filter_sort
ON tickets(organization_id, status_id, priority_id, assigned_to, created_at DESC);

-- Covering index for ticket list with counts
CREATE INDEX IF NOT EXISTS idx_tickets_list_covering
ON tickets(organization_id, status_id, id, title, created_at, user_id, assigned_to, category_id, priority_id);

-- Partial index for unassigned tickets
CREATE INDEX IF NOT EXISTS idx_tickets_unassigned
ON tickets(organization_id, created_at DESC, priority_id)
WHERE assigned_to IS NULL AND status_id IN (1, 2);

-- Index for ticket search by title (case-insensitive support)
CREATE INDEX IF NOT EXISTS idx_tickets_title_search
ON tickets(organization_id, title COLLATE NOCASE);

-- Composite index for comments with user join optimization
CREATE INDEX IF NOT EXISTS idx_comments_ticket_user_time
ON comments(ticket_id, user_id, created_at DESC);

-- Partial index for internal comments only
CREATE INDEX IF NOT EXISTS idx_comments_internal
ON comments(ticket_id, created_at DESC)
WHERE is_internal = 1;

-- Index for SLA policy matching
CREATE INDEX IF NOT EXISTS idx_sla_policies_matching
ON sla_policies(is_active, priority_id, category_id);

-- Composite index for notifications filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
ON notifications(user_id, tenant_id, is_read, type, created_at DESC);

-- Partial index for unread notifications with tenant isolation
CREATE INDEX IF NOT EXISTS idx_notifications_unread_only
ON notifications(user_id, tenant_id, created_at DESC)
WHERE is_read = 0;

-- Index for tenant-based notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_tenant
ON notifications(tenant_id, created_at DESC);

-- Index for audit log queries by date range
CREATE INDEX IF NOT EXISTS idx_audit_logs_date_range
ON audit_logs(organization_id, created_at DESC, entity_type);

-- Composite index for knowledge base article search
CREATE INDEX IF NOT EXISTS idx_kb_articles_published_search
ON kb_articles(status, visibility, category_id, published_at DESC)
WHERE status = 'published';

-- Index for analytics date range queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date
ON analytics_daily_metrics(date DESC);

-- Covering index for agent metrics
CREATE INDEX IF NOT EXISTS idx_analytics_agent_covering
ON analytics_agent_metrics(agent_id, date DESC, tickets_assigned, tickets_resolved);

-- Partial index for active user sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_only
ON user_sessions(user_id, last_activity DESC)
WHERE is_active = 1;

-- Composite index for login attempts security queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_security
ON login_attempts(email, ip_address, created_at DESC, success);

-- Partial index for failed login attempts (security monitoring)
CREATE INDEX IF NOT EXISTS idx_login_attempts_failed
ON login_attempts(email, ip_address, created_at DESC)
WHERE success = 0;

-- Index for rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
ON rate_limits(identifier, identifier_type, endpoint, last_attempt_at DESC);

-- Composite index for refresh token validation
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_validation
ON refresh_tokens(token_hash, is_active, expires_at);

-- Partial index for active refresh tokens only
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active_only
ON refresh_tokens(user_id, expires_at DESC)
WHERE is_active = 1 AND revoked_at IS NULL;

-- Index for verification codes lookup
CREATE INDEX IF NOT EXISTS idx_verification_codes_lookup
ON verification_codes(code_hash, type, expires_at);

-- Partial index for unused verification codes
CREATE INDEX IF NOT EXISTS idx_verification_codes_pending
ON verification_codes(user_id, type, expires_at DESC)
WHERE used_at IS NULL;

-- Composite index for workflow execution queries
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_time
ON workflow_executions(workflow_id, status, started_at DESC);

-- Index for webhook delivery monitoring
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_monitoring
ON webhook_deliveries(webhook_id, success, delivered_at DESC);

-- Partial index for failed webhook deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_failed
ON webhook_deliveries(webhook_id, delivered_at DESC)
WHERE success = 0;

-- Composite index for AI suggestions relevance
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_relevance
ON ai_suggestions(ticket_id, suggestion_type, confidence_score DESC);

-- Index for vector similarity search preparation (commented - table may not exist)
-- CREATE INDEX IF NOT EXISTS idx_vector_embeddings_lookup
-- ON vector_embeddings(entity_type, entity_id, model_name, updated_at DESC);

-- Composite index for organization statistics
CREATE INDEX IF NOT EXISTS idx_tickets_org_stats
ON tickets(organization_id, status_id, priority_id, DATE(created_at));

-- Index for time-based analytics aggregation
CREATE INDEX IF NOT EXISTS idx_tickets_analytics_time
ON tickets(organization_id, DATE(created_at), status_id, priority_id);

-- Index for recently created tickets (hot data)
CREATE INDEX IF NOT EXISTS idx_tickets_recent
ON tickets(created_at DESC, status_id, priority_id);

-- Composite index for agent workload queries
CREATE INDEX IF NOT EXISTS idx_tickets_agent_workload
ON tickets(assigned_to, status_id, priority_id, created_at DESC)
WHERE assigned_to IS NOT NULL;

-- Index for category-based analytics
CREATE INDEX IF NOT EXISTS idx_tickets_category_analytics
ON tickets(organization_id, category_id, status_id, DATE(created_at));

-- Covering index for SLA dashboard
CREATE INDEX IF NOT EXISTS idx_sla_tracking_dashboard
ON sla_tracking(ticket_id, sla_policy_id, response_met, resolution_met, response_due_at, resolution_due_at);

-- Partial index for breached SLAs (response_met=0 or resolution_met=0)
CREATE INDEX IF NOT EXISTS idx_sla_tracking_breached
ON sla_tracking(ticket_id, sla_policy_id, response_due_at, resolution_due_at)
WHERE response_met = 0 OR resolution_met = 0;

-- Composite index for attachment queries
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_uploaded
ON attachments(ticket_id, uploaded_by, created_at DESC);

-- Index for user activity tracking
CREATE INDEX IF NOT EXISTS idx_users_activity
ON users(is_active, last_login_at DESC, role);

-- Partial index for locked users (security)
CREATE INDEX IF NOT EXISTS idx_users_locked
ON users(locked_until, failed_login_attempts)
WHERE locked_until IS NOT NULL;

-- Composite index for department hierarchy queries
CREATE INDEX IF NOT EXISTS idx_departments_hierarchy
ON departments(organization_id, parent_id, is_active);

-- Index for user-department relationships
CREATE INDEX IF NOT EXISTS idx_user_departments_lookup
ON user_departments(user_id, department_id, is_primary);

-- Composite index for communication messages
CREATE INDEX IF NOT EXISTS idx_communication_messages_channel_time
ON communication_messages(channel_id, created_at DESC, status);

-- Index for analytics events time-series
CREATE INDEX IF NOT EXISTS idx_analytics_events_timeseries
ON analytics_events(event_type, created_at DESC);

-- Index for API usage tracking
CREATE INDEX IF NOT EXISTS idx_api_usage_current
ON api_usage_tracking(organization_id, endpoint, timestamp DESC);

-- Composite index for LGPD consent queries
CREATE INDEX IF NOT EXISTS idx_lgpd_consents_user_type
ON lgpd_consents(user_id, consent_type, is_given, created_at DESC);

-- Index for cache table cleanup
CREATE INDEX IF NOT EXISTS idx_cache_cleanup
ON cache(expires_at ASC)
WHERE expires_at IS NOT NULL;

-- PERFORMANCE NOTES:
-- 1. Covering indexes include all columns needed by a query to avoid table lookups
-- 2. Partial indexes use WHERE clauses to index only relevant subsets (smaller, faster)
-- 3. Composite indexes optimize multi-column WHERE/ORDER BY clauses
-- 4. DESC indexes optimize reverse sorting (e.g., latest first)
-- 5. Indexes have write cost - only create for frequently used queries
-- 6. SQLite automatically uses indexes for prefix matches in composite indexes
-- 7. Monitor query plans with EXPLAIN QUERY PLAN to validate index usage

-- ========================================
-- SISTEMA DE RELATÓRIOS AGENDADOS
-- ========================================

-- Tabela de relatórios agendados
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- 'tickets', 'sla', 'agents', 'survey', 'custom'
    filters TEXT, -- JSON com filtros aplicados
    metrics TEXT, -- JSON com métricas selecionadas
    recipients TEXT NOT NULL, -- JSON array de emails ou user IDs
    schedule_expression TEXT NOT NULL, -- CRON expression or predefined string ('daily', 'weekly')
    format TEXT DEFAULT 'json', -- 'json', 'csv', 'pdf'
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_run_at DATETIME,
    next_run_at DATETIME,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS update_scheduled_reports_updated_at
    AFTER UPDATE ON scheduled_reports
    BEGIN
        UPDATE scheduled_reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- ========================================
-- ITIL PROBLEM MANAGEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS root_cause_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER,
    organization_id INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES root_cause_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','identified','root_cause_analysis','known_error','resolved','closed')),
    priority_id INTEGER,
    category_id INTEGER,
    assigned_to INTEGER,
    assigned_team_id INTEGER,
    root_cause TEXT,
    root_cause_category_id INTEGER,
    workaround TEXT,
    impact TEXT CHECK(impact IS NULL OR impact IN ('low','medium','high','critical')),
    urgency TEXT DEFAULT 'medium' CHECK(urgency IN ('low','medium','high','critical')),
    affected_services TEXT, -- JSON array
    resolution TEXT,
    resolution_date DATETIME,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (root_cause_category_id) REFERENCES root_cause_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_priority ON problems(priority_id);
CREATE INDEX IF NOT EXISTS idx_problems_assigned ON problems(assigned_to);
CREATE INDEX IF NOT EXISTS idx_problems_org ON problems(organization_id);
CREATE INDEX IF NOT EXISTS idx_problems_number ON problems(problem_number);

CREATE TRIGGER IF NOT EXISTS update_problems_updated_at
    AFTER UPDATE ON problems
    BEGIN
        UPDATE problems SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS known_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ke_number TEXT NOT NULL UNIQUE,
    problem_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    symptoms TEXT,
    root_cause TEXT,
    workaround TEXT,
    permanent_fix TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('proposed','active','retired','superseded')),
    affected_cis TEXT, -- JSON array
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_known_errors_status ON known_errors(status);
CREATE INDEX IF NOT EXISTS idx_known_errors_problem ON known_errors(problem_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_org ON known_errors(organization_id);

CREATE TRIGGER IF NOT EXISTS update_known_errors_updated_at
    AFTER UPDATE ON known_errors
    BEGIN
        UPDATE known_errors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS problem_incident_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    linked_by INTEGER,
    link_type TEXT DEFAULT 'related' CHECK(link_type IN ('caused_by','related','duplicate')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(problem_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_incident_links_problem ON problem_incident_links(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_incident_links_ticket ON problem_incident_links(ticket_id);

CREATE TABLE IF NOT EXISTS problem_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('note','status_change','assignment','escalation','rca_update','workaround','resolution','attachment','link')),
    description TEXT,
    old_value TEXT,
    new_value TEXT,
    user_id INTEGER,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_problem_activities_problem ON problem_activities(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_activities_created ON problem_activities(created_at DESC);

CREATE TABLE IF NOT EXISTS problem_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    storage_path TEXT NOT NULL,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- ITIL CHANGE MANAGEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS change_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    requires_cab_approval BOOLEAN DEFAULT FALSE,
    default_risk_level TEXT DEFAULT 'medium' CHECK(default_risk_level IN ('low','medium','high','critical')),
    lead_time_days INTEGER DEFAULT 5,
    organization_id INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    change_type_id INTEGER,
    category TEXT NOT NULL DEFAULT 'normal' CHECK(category IN ('standard','normal','emergency')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
    risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low','medium','high','critical')),
    risk_assessment TEXT,
    impact_assessment TEXT,
    reason_for_change TEXT,
    business_justification TEXT,
    implementation_plan TEXT,
    backout_plan TEXT,
    test_plan TEXT,
    communication_plan TEXT,
    requested_start_date DATETIME,
    requested_end_date DATETIME,
    actual_start_date DATETIME,
    actual_end_date DATETIME,
    requester_id INTEGER NOT NULL,
    owner_id INTEGER,
    implementer_id INTEGER,
    cab_meeting_id INTEGER,
    approval_status TEXT DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected','deferred','withdrawn')),
    approved_by INTEGER,
    approved_at DATETIME,
    approval_notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','under_review','approved','rejected','pending_assessment','pending_cab','scheduled','in_progress','completed','failed','cancelled','rolled_back')),
    pir_required BOOLEAN DEFAULT FALSE,
    pir_completed BOOLEAN DEFAULT FALSE,
    pir_notes TEXT,
    pir_success_rating INTEGER CHECK(pir_success_rating >= 1 AND pir_success_rating <= 5),
    affected_cis TEXT, -- JSON array
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (change_type_id) REFERENCES change_types(id) ON DELETE SET NULL,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (implementer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_approval ON change_requests(approval_status);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester ON change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_org ON change_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_number ON change_requests(change_number);
CREATE INDEX IF NOT EXISTS idx_change_requests_schedule ON change_requests(requested_start_date, requested_end_date);

CREATE TRIGGER IF NOT EXISTS update_change_requests_updated_at
    AFTER UPDATE ON change_requests
    BEGIN
        UPDATE change_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS change_request_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_request_id INTEGER NOT NULL,
    cab_member_id INTEGER,
    approver_id INTEGER,
    approval_level INTEGER DEFAULT 1,
    approver_type TEXT DEFAULT 'user',
    vote TEXT CHECK(vote IN ('approve','reject','defer','abstain')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','abstained','deferred')),
    voted_at DATETIME,
    decided_at DATETIME,
    comments TEXT,
    conditions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (change_request_id) REFERENCES change_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (cab_member_id) REFERENCES cab_members(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_change_approvals_request ON change_request_approvals(change_request_id);

CREATE TABLE IF NOT EXISTS change_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_request_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assignee_id INTEGER,
    assigned_team_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','blocked','cancelled')),
    task_order INTEGER DEFAULT 0,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    started_at DATETIME,
    completed_at DATETIME,
    completion_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (change_request_id) REFERENCES change_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_change_tasks_request ON change_tasks(change_request_id);

CREATE TRIGGER IF NOT EXISTS update_change_tasks_updated_at
    AFTER UPDATE ON change_tasks
    BEGIN
        UPDATE change_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS change_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    type TEXT NOT NULL DEFAULT 'blackout' CHECK(type IN ('blackout','freeze','preferred','maintenance')),
    severity TEXT DEFAULT 'soft' CHECK(severity IN ('soft','hard')),
    affected_environments TEXT, -- JSON array
    affected_change_types TEXT, -- JSON array
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern TEXT, -- JSON
    organization_id INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TRIGGER IF NOT EXISTS update_change_calendar_updated_at
    AFTER UPDATE ON change_calendar
    BEGIN
        UPDATE change_calendar SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- ========================================
-- CMDB (Configuration Management Database)
-- ========================================

CREATE TABLE IF NOT EXISTS ci_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'server',
    color TEXT DEFAULT '#3B82F6',
    parent_type_id INTEGER,
    attributes_schema TEXT, -- JSON schema for custom attributes
    is_active BOOLEAN DEFAULT TRUE,
    organization_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_type_id) REFERENCES ci_types(id) ON DELETE SET NULL
);

CREATE TRIGGER IF NOT EXISTS update_ci_types_updated_at
    AFTER UPDATE ON ci_types
    BEGIN
        UPDATE ci_types SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS ci_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    is_operational BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ci_relationship_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    inverse_name TEXT,
    color TEXT DEFAULT '#6B7280',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configuration_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ci_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    ci_type_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL DEFAULT 1,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    owner_id INTEGER,
    managed_by_team_id INTEGER,
    vendor TEXT,
    manufacturer TEXT,
    location TEXT,
    environment TEXT DEFAULT 'production' CHECK(environment IN ('production','staging','development','test','dr')),
    data_center TEXT,
    rack_position TEXT,
    purchase_date DATETIME,
    installation_date DATETIME,
    warranty_expiry DATETIME,
    end_of_life_date DATETIME,
    retirement_date DATETIME,
    serial_number TEXT,
    asset_tag TEXT,
    ip_address TEXT,
    mac_address TEXT,
    hostname TEXT,
    os_version TEXT,
    business_service TEXT,
    criticality TEXT DEFAULT 'medium' CHECK(criticality IN ('critical','high','medium','low')),
    business_impact TEXT,
    recovery_time_objective INTEGER, -- in minutes
    recovery_point_objective INTEGER, -- in minutes
    custom_attributes TEXT, -- JSON
    created_by INTEGER,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ci_type_id) REFERENCES ci_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES ci_statuses(id) ON DELETE RESTRICT,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (managed_by_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_configuration_items_type ON configuration_items(ci_type_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_status ON configuration_items(status_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_org ON configuration_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_number ON configuration_items(ci_number);
CREATE INDEX IF NOT EXISTS idx_configuration_items_env ON configuration_items(environment);
CREATE INDEX IF NOT EXISTS idx_configuration_items_criticality ON configuration_items(criticality);

CREATE TRIGGER IF NOT EXISTS update_configuration_items_updated_at
    AFTER UPDATE ON configuration_items
    BEGIN
        UPDATE configuration_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS ci_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_ci_id INTEGER NOT NULL,
    target_ci_id INTEGER NOT NULL,
    relationship_type_id INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_ci_id) REFERENCES configuration_items(id) ON DELETE CASCADE,
    FOREIGN KEY (target_ci_id) REFERENCES configuration_items(id) ON DELETE CASCADE,
    FOREIGN KEY (relationship_type_id) REFERENCES ci_relationship_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(source_ci_id, target_ci_id, relationship_type_id)
);

CREATE INDEX IF NOT EXISTS idx_ci_relationships_source ON ci_relationships(source_ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_relationships_target ON ci_relationships(target_ci_id);

CREATE TRIGGER IF NOT EXISTS update_ci_relationships_updated_at
    AFTER UPDATE ON ci_relationships
    BEGIN
        UPDATE ci_relationships SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS ci_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ci_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('created','updated','deleted','status_changed','relationship_added','relationship_removed')),
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER,
    change_reason TEXT,
    related_ticket_id INTEGER,
    related_change_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ci_id) REFERENCES configuration_items(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (related_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    FOREIGN KEY (related_change_id) REFERENCES change_requests(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ci_history_ci ON ci_history(ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_history_created ON ci_history(created_at DESC);

CREATE TABLE IF NOT EXISTS ci_ticket_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ci_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    link_type TEXT DEFAULT 'affected' CHECK(link_type IN ('affected','caused_by','related','changed')),
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ci_id) REFERENCES configuration_items(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(ci_id, ticket_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_ci_ticket_links_ci ON ci_ticket_links(ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_ticket_links_ticket ON ci_ticket_links(ticket_id);

-- ========================================
-- SERVICE CATALOG
-- ========================================

CREATE TABLE IF NOT EXISTS service_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'folder',
    color TEXT DEFAULT '#3B82F6',
    parent_category_id INTEGER,
    display_order INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    organization_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_category_id) REFERENCES service_categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_categories_org ON service_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_slug ON service_categories(slug);

CREATE TRIGGER IF NOT EXISTS update_service_categories_updated_at
    AFTER UPDATE ON service_categories
    BEGIN
        UPDATE service_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS service_catalog_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    short_description TEXT,
    description TEXT,
    category_id INTEGER NOT NULL,
    organization_id INTEGER NOT NULL DEFAULT 1,
    icon TEXT DEFAULT 'document',
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    form_schema TEXT, -- JSON schema for dynamic form
    default_priority_id INTEGER,
    default_category_id INTEGER,
    sla_policy_id INTEGER,
    fulfillment_team_id INTEGER,
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_levels INTEGER DEFAULT 1,
    estimated_time_minutes INTEGER,
    cost TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    request_count INTEGER DEFAULT 0,
    avg_fulfillment_time REAL,
    satisfaction_rating REAL,
    tags TEXT, -- JSON array
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (default_priority_id) REFERENCES priorities(id) ON DELETE SET NULL,
    FOREIGN KEY (default_category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE SET NULL,
    FOREIGN KEY (fulfillment_team_id) REFERENCES teams(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_items_category ON service_catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_org ON service_catalog_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_slug ON service_catalog_items(slug);

CREATE TRIGGER IF NOT EXISTS update_service_catalog_items_updated_at
    AFTER UPDATE ON service_catalog_items
    BEGIN
        UPDATE service_catalog_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number TEXT NOT NULL UNIQUE,
    catalog_item_id INTEGER NOT NULL,
    ticket_id INTEGER,
    requester_id INTEGER NOT NULL,
    requester_name TEXT,
    requester_email TEXT,
    requester_department TEXT,
    on_behalf_of_id INTEGER,
    form_data TEXT NOT NULL DEFAULT '{}', -- JSON
    justification TEXT,
    requested_date DATETIME,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('draft','submitted','pending_approval','approved','rejected','in_progress','fulfilled','cancelled','failed')),
    approval_status TEXT DEFAULT 'not_required' CHECK(approval_status IN ('pending','approved','rejected','not_required')),
    approved_by INTEGER,
    approved_at DATETIME,
    fulfilled_by INTEGER,
    fulfilled_at DATETIME,
    cancelled_by INTEGER,
    cancelled_at DATETIME,
    cancellation_reason TEXT,
    satisfaction_rating INTEGER CHECK(satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    satisfaction_comment TEXT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (catalog_item_id) REFERENCES service_catalog_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (on_behalf_of_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (fulfilled_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_requests_catalog ON service_requests(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_requester ON service_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_org ON service_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_number ON service_requests(request_number);

CREATE TRIGGER IF NOT EXISTS update_service_requests_updated_at
    AFTER UPDATE ON service_requests
    BEGIN
        UPDATE service_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS service_request_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id INTEGER NOT NULL,
    approval_level INTEGER DEFAULT 1,
    approver_id INTEGER,
    approver_role TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','delegated','expired')),
    decision_at DATETIME,
    comments TEXT,
    delegated_to INTEGER,
    due_date DATETIME,
    reminded_at DATETIME,
    reminder_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (delegated_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_request_approvals_request ON service_request_approvals(service_request_id);

CREATE TRIGGER IF NOT EXISTS update_service_request_approvals_updated_at
    AFTER UPDATE ON service_request_approvals
    BEGIN
        UPDATE service_request_approvals SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS service_request_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id INTEGER NOT NULL,
    task_order INTEGER DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to INTEGER,
    assigned_team_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','blocked','cancelled')),
    started_at DATETIME,
    completed_at DATETIME,
    completion_notes TEXT,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_request_tasks_request ON service_request_tasks(service_request_id);

CREATE TRIGGER IF NOT EXISTS update_service_request_tasks_updated_at
    AFTER UPDATE ON service_request_tasks
    BEGIN
        UPDATE service_request_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- ========================================
-- CAB (Change Advisory Board)
-- ========================================

CREATE TABLE IF NOT EXISTS cab_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    meeting_day TEXT, -- 'monday','tuesday', etc.
    meeting_time TEXT, -- 'HH:MM'
    meeting_duration INTEGER DEFAULT 60, -- minutes
    meeting_location TEXT,
    meeting_url TEXT,
    chair_user_id INTEGER,
    secretary_user_id INTEGER,
    minimum_members INTEGER DEFAULT 3,
    quorum_percentage REAL DEFAULT 50.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chair_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (secretary_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TRIGGER IF NOT EXISTS update_cab_configurations_updated_at
    AFTER UPDATE ON cab_configurations
    BEGIN
        UPDATE cab_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TABLE IF NOT EXISTS cab_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cab_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('chair','secretary','member','advisor')),
    is_voting_member BOOLEAN DEFAULT TRUE,
    expertise_areas TEXT, -- JSON array
    is_active BOOLEAN DEFAULT TRUE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cab_id) REFERENCES cab_configurations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(cab_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cab_members_cab ON cab_members(cab_id);
CREATE INDEX IF NOT EXISTS idx_cab_members_user ON cab_members(user_id);

CREATE TABLE IF NOT EXISTS cab_meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cab_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    meeting_date DATETIME NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT,
    duration_minutes INTEGER DEFAULT 60,
    location TEXT,
    meeting_url TEXT,
    meeting_type TEXT NOT NULL DEFAULT 'regular' CHECK(meeting_type IN ('regular','emergency','virtual','ad_hoc')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled')),
    attendees TEXT, -- JSON array of user IDs
    actual_start_time DATETIME,
    actual_end_time DATETIME,
    agenda TEXT,
    minutes TEXT,
    notes TEXT,
    decisions TEXT, -- JSON array
    action_items TEXT, -- JSON array
    organizer_id INTEGER,
    organization_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cab_id) REFERENCES cab_configurations(id) ON DELETE CASCADE,
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cab_meetings_cab ON cab_meetings(cab_id);
CREATE INDEX IF NOT EXISTS idx_cab_meetings_date ON cab_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_cab_meetings_status ON cab_meetings(status);

CREATE TRIGGER IF NOT EXISTS update_cab_meetings_updated_at
    AFTER UPDATE ON cab_meetings
    BEGIN
        UPDATE cab_meetings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
