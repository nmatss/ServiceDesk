-- ================================================
-- Email Integration Tables
-- ================================================
-- Migration: 010_email_integration
-- Description: Tables for complete email automation system
-- Dependencies: 001_initial_schema.sql
-- Date: 2025-12-05
-- ================================================

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'pt-BR',
    category VARCHAR(50) DEFAULT 'custom', -- ticket, user, system, custom
    variables TEXT, -- JSON array of required variables
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, code, language)
);

-- Email Queue Table (Enhanced from existing)
CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    to_email TEXT NOT NULL,
    cc_emails TEXT,
    bcc_emails TEXT,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT NOT NULL,
    template_code VARCHAR(100),
    template_data TEXT, -- JSON data used for template
    attachments TEXT, -- JSON array of attachments
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    scheduled_at DATETIME,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'bounced')),
    sent_at DATETIME,
    error_message TEXT,
    metadata TEXT, -- JSON for additional data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Email Automation Rules Table
CREATE TABLE IF NOT EXISTS email_automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL, -- incoming_email, ticket_created, ticket_updated, sla_warning
    conditions TEXT NOT NULL, -- JSON array of conditions
    actions TEXT NOT NULL, -- JSON array of actions
    priority INTEGER DEFAULT 0, -- Higher priority rules execute first
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Email Tracking Table
CREATE TABLE IF NOT EXISTS email_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER,
    message_id VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- sent, delivered, opened, clicked, bounced, complained
    event_data TEXT, -- JSON for event details
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (queue_id) REFERENCES email_queue(id) ON DELETE SET NULL
);

-- Email Threads Table (for conversation tracking)
CREATE TABLE IF NOT EXISTS email_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    ticket_id INTEGER,
    message_id VARCHAR(255) NOT NULL UNIQUE,
    in_reply_to VARCHAR(255),
    references_list TEXT, -- JSON array of message IDs
    subject VARCHAR(500),
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    to_emails TEXT NOT NULL, -- JSON array
    cc_emails TEXT, -- JSON array
    body_text TEXT,
    body_html TEXT,
    is_incoming BOOLEAN DEFAULT 1,
    has_attachments BOOLEAN DEFAULT 0,
    attachment_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
);

-- Email Attachments Table
CREATE TABLE IF NOT EXISTS email_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    size INTEGER,
    storage_path VARCHAR(500),
    is_inline BOOLEAN DEFAULT 0,
    content_id VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES email_threads(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_priority ON email_queue(priority);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_tenant ON email_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_code ON email_templates(code);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_email_automation_tenant ON email_automation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_automation_trigger ON email_automation_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_email_automation_active ON email_automation_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_email_tracking_queue ON email_tracking(queue_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_email ON email_tracking(email);
CREATE INDEX IF NOT EXISTS idx_email_tracking_event ON email_tracking(event_type);

CREATE INDEX IF NOT EXISTS idx_email_threads_tenant ON email_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_ticket ON email_threads(ticket_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_message_id ON email_threads(message_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_in_reply_to ON email_threads(in_reply_to);

CREATE INDEX IF NOT EXISTS idx_email_attachments_thread ON email_attachments(thread_id);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_email_templates_timestamp
    AFTER UPDATE ON email_templates
    FOR EACH ROW
BEGIN
    UPDATE email_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_email_queue_timestamp
    AFTER UPDATE ON email_queue
    FOR EACH ROW
BEGIN
    UPDATE email_queue SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_email_automation_timestamp
    AFTER UPDATE ON email_automation_rules
    FOR EACH ROW
BEGIN
    UPDATE email_automation_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert default email templates
INSERT OR IGNORE INTO email_templates (tenant_id, name, code, subject, body_html, body_text, category, variables, is_active) VALUES
-- Ticket Created
(NULL, 'Ticket Created', 'ticket_created',
'Ticket #{{ticketNumber}} criado - {{ticket.title}}',
'<html><body><h2>Ticket Criado</h2><p>Seu ticket foi criado com sucesso!</p><p>Número: #{{ticketNumber}}</p></body></html>',
'Ticket Criado\n\nSeu ticket foi criado com sucesso!\nNúmero: #{{ticketNumber}}',
'ticket',
'["ticketNumber", "ticket.title", "customer.name", "tenant.name"]',
1),

-- Ticket Updated
(NULL, 'Ticket Updated', 'ticket_updated',
'Ticket #{{ticketNumber}} atualizado - {{ticket.title}}',
'<html><body><h2>Ticket Atualizado</h2><p>Seu ticket foi atualizado.</p><p>Número: #{{ticketNumber}}</p></body></html>',
'Ticket Atualizado\n\nSeu ticket foi atualizado.\nNúmero: #{{ticketNumber}}',
'ticket',
'["ticketNumber", "ticket.title", "customer.name", "tenant.name"]',
1),

-- Ticket Resolved
(NULL, 'Ticket Resolved', 'ticket_resolved',
'Ticket #{{ticketNumber}} resolvido - {{ticket.title}}',
'<html><body><h2>Ticket Resolvido</h2><p>Seu ticket foi resolvido!</p><p>Número: #{{ticketNumber}}</p></body></html>',
'Ticket Resolvido\n\nSeu ticket foi resolvido!\nNúmero: #{{ticketNumber}}',
'ticket',
'["ticketNumber", "ticket.title", "customer.name", "tenant.name"]',
1),

-- SLA Warning
(NULL, 'SLA Warning', 'sla_warning',
'⚠️ Alerta SLA - Ticket #{{ticketNumber}}',
'<html><body><h2>Alerta de SLA</h2><p>O prazo está próximo!</p><p>Ticket: #{{ticketNumber}}</p></body></html>',
'Alerta de SLA\n\nO prazo está próximo!\nTicket: #{{ticketNumber}}',
'system',
'["ticketNumber", "ticket.title", "agent.name", "sla.deadline"]',
1),

-- New Comment
(NULL, 'New Comment', 'new_comment',
'Novo comentário no ticket #{{ticketNumber}}',
'<html><body><h2>Novo Comentário</h2><p>{{comment.author}} adicionou um comentário.</p><p>Ticket: #{{ticketNumber}}</p></body></html>',
'Novo Comentário\n\n{{comment.author}} adicionou um comentário.\nTicket: #{{ticketNumber}}',
'ticket',
'["ticketNumber", "ticket.title", "comment.author", "comment.content"]',
1);

-- Sample automation rule (auto-assign high priority tickets)
INSERT OR IGNORE INTO email_automation_rules (tenant_id, name, description, trigger_type, conditions, actions, priority, is_active) VALUES
(1, 'Auto-assign High Priority', 'Automatically assign high priority tickets', 'incoming_email',
'[{"field":"priority","operator":"equals","value":"high"}]',
'[{"type":"assign_to","params":{"userId":1}},{"type":"send_email","params":{"template":"ticket_created"}}]',
10, 1);

-- Migration complete marker
-- This migration adds complete email integration support
