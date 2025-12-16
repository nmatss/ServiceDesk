-- Migration: Tags, Macros e Relacionamentos de Tickets
-- Version: 011
-- Date: 2025-12-10

-- ========================================
-- SISTEMA DE TAGS
-- ========================================

-- Tabela de tags
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de relacionamento ticket-tags (many-to-many)
CREATE TABLE IF NOT EXISTS ticket_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    added_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(ticket_id, tag_id)
);

-- Índices para tags
CREATE INDEX IF NOT EXISTS idx_tags_organization ON tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket ON ticket_tags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag ON ticket_tags(tag_id);

-- ========================================
-- SISTEMA DE MACROS (Respostas Rápidas)
-- ========================================

-- Tabela de macros
CREATE TABLE IF NOT EXISTS macros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    actions TEXT, -- JSON com ações automáticas
    category_id INTEGER, -- categoria específica ou NULL para todas
    is_shared BOOLEAN DEFAULT TRUE, -- se é compartilhado com todos agentes
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de histórico de uso de macros
CREATE TABLE IF NOT EXISTS macro_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    macro_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    used_by INTEGER NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (macro_id) REFERENCES macros(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para macros
CREATE INDEX IF NOT EXISTS idx_macros_organization ON macros(organization_id);
CREATE INDEX IF NOT EXISTS idx_macros_category ON macros(category_id);
CREATE INDEX IF NOT EXISTS idx_macros_created_by ON macros(created_by);
CREATE INDEX IF NOT EXISTS idx_macro_usage_macro ON macro_usage(macro_id);
CREATE INDEX IF NOT EXISTS idx_macro_usage_ticket ON macro_usage(ticket_id);

-- ========================================
-- SISTEMA DE RELACIONAMENTOS ENTRE TICKETS
-- ========================================

-- Tabela de relacionamentos
CREATE TABLE IF NOT EXISTS ticket_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_ticket_id INTEGER NOT NULL,
    target_ticket_id INTEGER NOT NULL,
    relationship_type VARCHAR(50) NOT NULL CHECK (
        relationship_type IN ('parent', 'child', 'related', 'duplicate', 'blocks', 'blocked_by', 'caused_by', 'causes')
    ),
    description TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (target_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(source_ticket_id, target_ticket_id, relationship_type),
    CHECK(source_ticket_id != target_ticket_id)
);

-- Índices para relacionamentos
CREATE INDEX IF NOT EXISTS idx_ticket_rel_source ON ticket_relationships(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_rel_target ON ticket_relationships(target_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_rel_type ON ticket_relationships(relationship_type);

-- ========================================
-- SISTEMA DE FOLLOWERS (Observadores)
-- ========================================

-- Tabela de followers de tickets
CREATE TABLE IF NOT EXISTS ticket_followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    notify_on_comment BOOLEAN DEFAULT TRUE,
    notify_on_status_change BOOLEAN DEFAULT TRUE,
    notify_on_assignment BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(ticket_id, user_id)
);

-- Índices para followers
CREATE INDEX IF NOT EXISTS idx_ticket_followers_ticket ON ticket_followers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_followers_user ON ticket_followers(user_id);

-- ========================================
-- SISTEMA DE CAMPOS CUSTOMIZADOS
-- ========================================

-- Tabela de definição de campos customizados
CREATE TABLE IF NOT EXISTS custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    label VARCHAR(150) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (
        field_type IN ('text', 'textarea', 'number', 'date', 'datetime', 'select', 'multiselect', 'checkbox', 'email', 'url', 'phone')
    ),
    options TEXT, -- JSON para select/multiselect
    default_value TEXT,
    placeholder TEXT,
    help_text TEXT,
    validation_rules TEXT, -- JSON com regras de validação
    entity_type VARCHAR(50) NOT NULL DEFAULT 'ticket' CHECK (
        entity_type IN ('ticket', 'user', 'organization', 'contact')
    ),
    is_required BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_visible_to_users BOOLEAN DEFAULT TRUE, -- se usuários finais podem ver
    is_editable_by_users BOOLEAN DEFAULT FALSE, -- se usuários finais podem editar
    position INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, name, entity_type)
);

-- Tabela de valores de campos customizados
CREATE TABLE IF NOT EXISTS custom_field_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    custom_field_id INTEGER NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
    UNIQUE(custom_field_id, entity_type, entity_id)
);

-- Índices para campos customizados
CREATE INDEX IF NOT EXISTS idx_custom_fields_org ON custom_fields(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity ON custom_fields(entity_type);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON custom_field_values(custom_field_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON custom_field_values(entity_type, entity_id);

-- ========================================
-- SISTEMA DE DASHBOARDS CUSTOMIZADOS
-- ========================================

-- Tabela de dashboards
CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    layout TEXT NOT NULL, -- JSON com configuração de layout
    is_default BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de widgets do dashboard
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id INTEGER NOT NULL,
    widget_type VARCHAR(50) NOT NULL,
    title VARCHAR(100),
    configuration TEXT, -- JSON com configuração do widget
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 1,
    height INTEGER DEFAULT 1,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
);

-- Índices para dashboards
CREATE INDEX IF NOT EXISTS idx_dashboards_org ON dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);

-- ========================================
-- ADICIONAR ORGANIZATION_ID EM TABELAS EXISTENTES
-- ========================================

-- Nota: Estas alterações devem ser feitas com cuidado em produção
-- SQLite não suporta ADD COLUMN com FOREIGN KEY diretamente

-- Adicionar organization_id em categories (se não existir)
-- ALTER TABLE categories ADD COLUMN organization_id INTEGER DEFAULT 1;

-- Adicionar organization_id em priorities (se não existir)
-- ALTER TABLE priorities ADD COLUMN organization_id INTEGER DEFAULT 1;

-- Adicionar organization_id em statuses (se não existir)
-- ALTER TABLE statuses ADD COLUMN organization_id INTEGER DEFAULT 1;

-- Adicionar organization_id em sla_policies (se não existir)
-- ALTER TABLE sla_policies ADD COLUMN organization_id INTEGER DEFAULT 1;

-- Adicionar organization_id em ticket_templates (se não existir)
-- ALTER TABLE ticket_templates ADD COLUMN organization_id INTEGER DEFAULT 1;

-- Adicionar organization_id em knowledge_articles (se não existir)
-- ALTER TABLE knowledge_articles ADD COLUMN organization_id INTEGER DEFAULT 1;

-- Adicionar organization_id em automations (se não existir)
-- ALTER TABLE automations ADD COLUMN organization_id INTEGER DEFAULT 1;

-- ========================================
-- TABELA DE TIMES/EQUIPES
-- ========================================

CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    leader_id INTEGER,
    color VARCHAR(7) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    auto_assign BOOLEAN DEFAULT FALSE, -- distribuição automática de tickets
    working_hours TEXT, -- JSON com horário de trabalho
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, name)
);

-- Tabela de membros do time
CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'lead', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    left_at DATETIME,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

-- Tabela de categorias por time
CREATE TABLE IF NOT EXISTS team_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE, -- se é a categoria principal do time
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(team_id, category_id)
);

-- Índices para times
CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_categories_team ON team_categories(team_id);
CREATE INDEX IF NOT EXISTS idx_team_categories_category ON team_categories(category_id);

-- ========================================
-- SISTEMA DE ATIVIDADES / TIMELINE
-- ========================================

CREATE TABLE IF NOT EXISTS ticket_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER,
    activity_type VARCHAR(50) NOT NULL CHECK (
        activity_type IN (
            'created', 'updated', 'status_changed', 'priority_changed',
            'assigned', 'unassigned', 'comment_added', 'comment_edited',
            'attachment_added', 'attachment_removed', 'tag_added', 'tag_removed',
            'merged', 'split', 'linked', 'unlinked', 'escalated', 'resolved',
            'reopened', 'sla_warning', 'sla_breach', 'custom_field_changed'
        )
    ),
    description TEXT,
    old_value TEXT,
    new_value TEXT,
    metadata TEXT, -- JSON com dados adicionais
    is_internal BOOLEAN DEFAULT FALSE, -- se é visível apenas para agentes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para atividades
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_user ON ticket_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_type ON ticket_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_created ON ticket_activities(created_at);

-- ========================================
-- VIEWS ÚTEIS
-- ========================================

-- View de tickets com todas as informações
CREATE VIEW IF NOT EXISTS v_tickets_full AS
SELECT
    t.*,
    u.name as user_name,
    u.email as user_email,
    a.name as assigned_agent_name,
    a.email as assigned_agent_email,
    c.name as category_name,
    c.color as category_color,
    p.name as priority_name,
    p.level as priority_level,
    p.color as priority_color,
    s.name as status_name,
    s.color as status_color,
    s.is_final as status_is_final,
    (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
    (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count,
    (SELECT GROUP_CONCAT(tg.name, ',') FROM tags tg
     JOIN ticket_tags tt ON tg.id = tt.tag_id
     WHERE tt.ticket_id = t.id) as tags
FROM tickets t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN users a ON t.assigned_to = a.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN priorities p ON t.priority_id = p.id
LEFT JOIN statuses s ON t.status_id = s.id;

-- View de métricas de agentes
CREATE VIEW IF NOT EXISTS v_agent_metrics AS
SELECT
    u.id as agent_id,
    u.name as agent_name,
    u.email as agent_email,
    COUNT(t.id) as total_assigned,
    COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as total_resolved,
    COUNT(CASE WHEN s.is_final = 0 THEN 1 END) as total_open,
    AVG(CASE WHEN t.resolved_at IS NOT NULL
        THEN (julianday(t.resolved_at) - julianday(t.created_at)) * 24 * 60
        END) as avg_resolution_minutes,
    AVG(ss.rating) as avg_satisfaction
FROM users u
LEFT JOIN tickets t ON u.id = t.assigned_to
LEFT JOIN statuses s ON t.status_id = s.id
LEFT JOIN satisfaction_surveys ss ON t.id = ss.ticket_id
WHERE u.role IN ('admin', 'agent')
GROUP BY u.id, u.name, u.email;

-- ========================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- ========================================

-- Trigger para atualizar updated_at em tags
CREATE TRIGGER IF NOT EXISTS update_tags_timestamp
AFTER UPDATE ON tags
BEGIN
    UPDATE tags SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger para atualizar updated_at em macros
CREATE TRIGGER IF NOT EXISTS update_macros_timestamp
AFTER UPDATE ON macros
BEGIN
    UPDATE macros SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger para atualizar usage_count em tags quando ticket_tags é inserido
CREATE TRIGGER IF NOT EXISTS update_tag_usage_on_insert
AFTER INSERT ON ticket_tags
BEGIN
    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
END;

-- Trigger para atualizar usage_count em tags quando ticket_tags é deletado
CREATE TRIGGER IF NOT EXISTS update_tag_usage_on_delete
AFTER DELETE ON ticket_tags
BEGIN
    UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
END;

-- Trigger para atualizar usage_count em macros quando usado
CREATE TRIGGER IF NOT EXISTS update_macro_usage
AFTER INSERT ON macro_usage
BEGIN
    UPDATE macros SET
        usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP
    WHERE id = NEW.macro_id;
END;

-- Trigger para criar atividade quando ticket é criado
CREATE TRIGGER IF NOT EXISTS create_ticket_activity_on_create
AFTER INSERT ON tickets
BEGIN
    INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description)
    VALUES (NEW.id, NEW.user_id, 'created', 'Ticket criado');
END;

-- Trigger para criar atividade quando status muda
CREATE TRIGGER IF NOT EXISTS create_ticket_activity_on_status_change
AFTER UPDATE OF status_id ON tickets
WHEN OLD.status_id != NEW.status_id
BEGIN
    INSERT INTO ticket_activities (ticket_id, user_id, activity_type, old_value, new_value, description)
    VALUES (
        NEW.id,
        NULL,
        'status_changed',
        (SELECT name FROM statuses WHERE id = OLD.status_id),
        (SELECT name FROM statuses WHERE id = NEW.status_id),
        'Status alterado'
    );
END;

-- Trigger para criar atividade quando assigned_to muda
CREATE TRIGGER IF NOT EXISTS create_ticket_activity_on_assignment
AFTER UPDATE OF assigned_to ON tickets
WHEN OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
BEGIN
    INSERT INTO ticket_activities (ticket_id, user_id, activity_type, old_value, new_value, description)
    VALUES (
        NEW.id,
        NULL,
        CASE WHEN NEW.assigned_to IS NULL THEN 'unassigned' ELSE 'assigned' END,
        (SELECT name FROM users WHERE id = OLD.assigned_to),
        (SELECT name FROM users WHERE id = NEW.assigned_to),
        CASE WHEN NEW.assigned_to IS NULL THEN 'Ticket desatribuído' ELSE 'Ticket atribuído' END
    );
END;

-- Trigger para criar atividade quando comentário é adicionado
CREATE TRIGGER IF NOT EXISTS create_ticket_activity_on_comment
AFTER INSERT ON comments
BEGIN
    INSERT INTO ticket_activities (ticket_id, user_id, activity_type, is_internal, description)
    VALUES (NEW.ticket_id, NEW.user_id, 'comment_added', NEW.is_internal, 'Comentário adicionado');
END;

-- Dados iniciais de tags padrão
INSERT OR IGNORE INTO tags (organization_id, name, color, description) VALUES
(1, 'Urgente', '#EF4444', 'Requer atenção imediata'),
(1, 'Bug', '#F97316', 'Erro ou defeito no sistema'),
(1, 'Feature', '#3B82F6', 'Solicitação de nova funcionalidade'),
(1, 'Dúvida', '#8B5CF6', 'Questionamento ou pedido de informação'),
(1, 'Documentação', '#10B981', 'Relacionado a documentação'),
(1, 'Em Análise', '#F59E0B', 'Sendo analisado pela equipe'),
(1, 'Aguardando Cliente', '#6B7280', 'Aguardando resposta do cliente'),
(1, 'Duplicado', '#9CA3AF', 'Ticket duplicado de outro');

-- Dados iniciais de macros padrão
INSERT OR IGNORE INTO macros (organization_id, name, content, actions, created_by, description) VALUES
(1, 'Saudação Inicial', 'Olá! Obrigado por entrar em contato conosco.

Analisei sua solicitação e estou trabalhando para resolver o mais rápido possível.

Em breve entrarei em contato com mais informações.

Atenciosamente,
Equipe de Suporte', '[]', 1, 'Primeira resposta ao cliente'),

(1, 'Solicitar Mais Informações', 'Olá!

Para dar continuidade ao atendimento, precisamos de algumas informações adicionais:

1. [INFORMAÇÃO 1]
2. [INFORMAÇÃO 2]
3. [INFORMAÇÃO 3]

Por favor, responda com os dados solicitados para que possamos prosseguir.

Atenciosamente,
Equipe de Suporte', '[]', 1, 'Solicitar informações do cliente'),

(1, 'Ticket Resolvido', 'Olá!

Informamos que sua solicitação foi resolvida com sucesso.

Resumo da solução:
[DESCREVER SOLUÇÃO]

Caso tenha mais alguma dúvida, não hesite em entrar em contato.

Atenciosamente,
Equipe de Suporte', '[{"type":"set_status","value":3}]', 1, 'Marcar ticket como resolvido'),

(1, 'Aguardando Cliente', 'Olá!

Entramos em contato anteriormente e ainda aguardamos seu retorno.

Por favor, responda a esta mensagem para que possamos dar continuidade ao atendimento.

Caso não recebamos resposta em 72 horas, o ticket será fechado automaticamente.

Atenciosamente,
Equipe de Suporte', '[{"type":"add_tag","value":"Aguardando Cliente"}]', 1, 'Lembrete para cliente'),

(1, 'Escalonamento', 'Olá!

Sua solicitação foi escalonada para nossa equipe especializada.

Um técnico sênior entrará em contato em breve com mais informações.

Pedimos desculpas pelo inconveniente e agradecemos sua paciência.

Atenciosamente,
Equipe de Suporte', '[{"type":"set_priority","value":3}]', 1, 'Escalar ticket para equipe sênior');
