-- Schema do banco de dados ServiceDesk
-- SQLite Database Schema

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'user')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de prioridades
CREATE TABLE IF NOT EXISTS priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 4),
    color TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de status
CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE RESTRICT
);

-- Tabela de comentários
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
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
    ticket_id INTEGER,
    type TEXT NOT NULL CHECK (type IN ('ticket_assigned', 'ticket_updated', 'ticket_resolved', 'ticket_escalated', 'sla_warning', 'sla_breach', 'escalation', 'comment_added', 'system_alert')),
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
    entity_type TEXT NOT NULL, -- 'ticket', 'user', 'category', etc.
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'view'
    old_values TEXT, -- JSON com valores antigos
    new_values TEXT, -- JSON com valores novos
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at);

CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);

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
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_templates_category ON ticket_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_templates_priority ON ticket_templates(priority_id);
CREATE INDEX IF NOT EXISTS idx_templates_active ON ticket_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

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
