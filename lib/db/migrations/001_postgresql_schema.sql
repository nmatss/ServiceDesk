-- PostgreSQL Migration Schema
-- This file contains PostgreSQL-specific schema conversion from SQLite
-- for enterprise production deployment

-- ========================================
-- CONFIGURAÇÕES INICIAIS POSTGRESQL
-- ========================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ========================================
-- SISTEMA DE AUTENTICAÇÃO ENTERPRISE
-- ========================================

-- Tabela de usuários expandida para enterprise (PostgreSQL version)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'agent', 'user', 'manager', 'read_only', 'api_client')),
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(32),
    two_factor_backup_codes JSONB, -- JSON array
    sso_provider VARCHAR(50), -- 'google', 'saml', 'ad', 'gov_br', etc.
    sso_user_id VARCHAR(255), -- External user ID
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    language VARCHAR(10) DEFAULT 'pt-BR',
    metadata JSONB, -- JSON for additional user data
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de refresh tokens para JWT
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    device_info JSONB, -- JSON com informações do dispositivo
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Tabela de permissões granulares
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(50) NOT NULL, -- 'tickets', 'users', 'reports', etc.
    action VARCHAR(20) NOT NULL, -- 'create', 'read', 'update', 'delete', 'manage'
    conditions JSONB, -- JSON para condições especiais
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de papéis (roles) granulares
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE, -- roles do sistema que não podem ser deletados
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relacionamento roles-permissions (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- quem concedeu a permissão
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- Tabela de relacionamento user-roles (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- quem concedeu o papel
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ, -- para papéis temporários
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, role_id)
);

-- ========================================
-- CORE ENTITIES
-- ========================================

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de prioridades
CREATE TABLE IF NOT EXISTS priorities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 4),
    color VARCHAR(7) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de status
CREATE TABLE IF NOT EXISTS statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    color VARCHAR(7) NOT NULL,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de tickets
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    priority_id INTEGER NOT NULL REFERENCES priorities(id) ON DELETE RESTRICT,
    status_id INTEGER NOT NULL REFERENCES statuses(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

-- ========================================
-- SISTEMA DE WORKFLOWS AVANÇADO
-- ========================================

-- Tabela de workflows
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'status_changed', 'sla_warning', 'time_based', 'manual', 'comment_added', 'assignment_changed')),
    trigger_conditions JSONB, -- JSON conditions for triggering
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,
    category VARCHAR(50), -- 'ticket_automation', 'notification', 'escalation', 'approval'
    priority INTEGER DEFAULT 0, -- Higher priority runs first
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de steps do workflow
CREATE TABLE IF NOT EXISTS workflow_steps (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('action', 'condition', 'approval', 'delay', 'parallel', 'webhook', 'script', 'notification')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    configuration JSONB NOT NULL, -- JSON configuration for the step
    timeout_minutes INTEGER DEFAULT 60,
    retry_count INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 5,
    is_optional BOOLEAN DEFAULT FALSE,
    parent_step_id INTEGER REFERENCES workflow_steps(id) ON DELETE CASCADE, -- For nested or parallel steps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id, step_order)
);

-- ========================================
-- SISTEMA DE IA E CLASSIFICAÇÃO
-- ========================================

-- Tabela de classificações de IA
CREATE TABLE IF NOT EXISTS ai_classifications (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'ticket', 'comment', 'knowledge_article'
    entity_id INTEGER NOT NULL,
    classification_type VARCHAR(50) NOT NULL, -- 'category', 'priority', 'sentiment', 'intent', 'language', 'urgency'
    model_name VARCHAR(100) NOT NULL, -- 'gpt-4', 'claude-3', 'local-model', 'rule-based'
    model_version VARCHAR(50),
    predicted_value VARCHAR(255) NOT NULL,
    confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
    probability_distribution JSONB, -- JSON with all class probabilities
    input_tokens INTEGER,
    output_tokens INTEGER,
    processing_time_ms INTEGER,
    was_correct BOOLEAN, -- Feedback if prediction was right
    corrected_value VARCHAR(255), -- What the correct value should have been
    feedback_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Who provided the feedback
    feedback_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- SISTEMA DE INTEGRAÇÕES
-- ========================================

-- Tabela de integrações configuradas
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'webhook', 'api', 'sso', 'email', 'whatsapp', 'teams', 'slack', 'gov_br'
    provider VARCHAR(100) NOT NULL, -- 'microsoft', 'google', 'whatsapp_business', 'slack', 'custom'
    configuration JSONB NOT NULL, -- JSON configuration
    credentials JSONB, -- Encrypted JSON credentials
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE, -- System integrations cannot be deleted
    sync_frequency VARCHAR(20), -- 'realtime', 'hourly', 'daily', 'weekly', 'manual'
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(20), -- 'success', 'error', 'partial'
    error_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- BRASIL-SPECIFIC TABLES
-- ========================================

-- Tabela de contatos WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL, -- Format: +55XXXXXXXXXXX
    display_name VARCHAR(255),
    profile_picture_url VARCHAR(500),
    is_business BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ,
    status_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone_number)
);

-- Tabela de consentimentos LGPD
CREATE TABLE IF NOT EXISTS lgpd_consents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL, -- 'data_processing', 'marketing', 'analytics', 'cookies'
    purpose TEXT NOT NULL, -- Specific purpose of data processing
    legal_basis VARCHAR(50) NOT NULL, -- 'consent', 'contract', 'legal_obligation', 'legitimate_interest'
    is_given BOOLEAN NOT NULL,
    consent_method VARCHAR(20), -- 'web_form', 'api', 'email', 'phone', 'paper'
    consent_evidence JSONB, -- JSON with evidence of consent
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ, -- When consent expires
    withdrawn_at TIMESTAMPTZ,
    withdrawal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ÍNDICES PARA PERFORMANCE POSTGRESQL
-- ========================================

-- Usuários
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users USING btree(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users USING btree(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users USING btree(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_sso_provider ON users USING btree(sso_provider) WHERE sso_provider IS NOT NULL;

-- Refresh tokens
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens USING btree(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens USING btree(expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens USING btree(is_active) WHERE is_active = true;

-- Tickets
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_id ON tickets USING btree(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_assigned_to ON tickets USING btree(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_category_id ON tickets USING btree(category_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_priority_id ON tickets USING btree(priority_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_status_id ON tickets USING btree(status_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_at ON tickets USING btree(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_updated_at ON tickets USING btree(updated_at);

-- Full-text search index para tickets
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_search ON tickets USING gin(to_tsvector('portuguese', title || ' ' || description));

-- Workflows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_trigger_type ON workflows USING btree(trigger_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_active ON workflows USING btree(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_category ON workflows USING btree(category) WHERE category IS NOT NULL;

-- AI Classifications
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_classifications_entity ON ai_classifications USING btree(entity_type, entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_classifications_type ON ai_classifications USING btree(classification_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_classifications_model ON ai_classifications USING btree(model_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_classifications_confidence ON ai_classifications USING btree(confidence_score);

-- Integrações
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_type ON integrations USING btree(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_provider ON integrations USING btree(provider);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_active ON integrations USING btree(is_active) WHERE is_active = true;

-- WhatsApp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts USING btree(phone_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_contacts_user ON whatsapp_contacts USING btree(user_id) WHERE user_id IS NOT NULL;

-- LGPD
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lgpd_consents_user ON lgpd_consents USING btree(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lgpd_consents_type ON lgpd_consents USING btree(consent_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lgpd_consents_given ON lgpd_consents USING btree(is_given);

-- ========================================
-- FUNCTIONS E TRIGGERS POSTGRESQL
-- ========================================

-- Function para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_priorities_updated_at BEFORE UPDATE ON priorities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_statuses_updated_at BEFORE UPDATE ON statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflow_steps_updated_at BEFORE UPDATE ON workflow_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_contacts_updated_at BEFORE UPDATE ON whatsapp_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function para validação de email
CREATE OR REPLACE FUNCTION validate_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql;

-- Function para hash de senha bcrypt
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Esta função deve ser implementada com uma extensão pgcrypto
    -- ou usando uma biblioteca externa no código da aplicação
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- PARTICIONAMENTO PARA ESCALA
-- ========================================

-- Exemplo de particionamento para audit_logs (por data)
-- CREATE TABLE audit_logs_y2024m01 PARTITION OF audit_logs
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ========================================
-- POLÍTICAS DE RETENÇÃO
-- ========================================

-- Function para limpeza automática de dados antigos
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Limpar logs de integração mais antigos que 90 dias
    DELETE FROM integration_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

    -- Limpar eventos de analytics mais antigos que 1 ano
    DELETE FROM analytics_events WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year';

    -- Limpar refresh tokens expirados
    DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP;

    -- Limpar métricas de tempo real expiradas
    DELETE FROM analytics_realtime_metrics WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CONFIGURAÇÕES DE PERFORMANCE
-- ========================================

-- Configurações recomendadas para PostgreSQL (aplicar via postgresql.conf)
/*
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 8
max_parallel_workers_per_gather = 2
max_parallel_workers = 8
max_parallel_maintenance_workers = 2
*/