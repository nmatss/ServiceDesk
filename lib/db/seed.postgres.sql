-- ========================================
-- ServiceDesk PostgreSQL Base Seed (Idempotent)
-- ========================================

-- Default organization
INSERT INTO organizations (id, name, slug, subscription_plan, subscription_status, is_active)
VALUES (1, 'Empresa Demo', 'empresa-demo', 'basic', 'active', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Categories
INSERT INTO categories (id, name, description, color)
VALUES
  (1, 'Tecnico', 'Problemas tecnicos', '#3B82F6'),
  (2, 'Administrativo', 'Solicitacoes administrativas', '#10B981'),
  (3, 'Infraestrutura', 'Infraestrutura e rede', '#F59E0B')
ON CONFLICT (id) DO NOTHING;

-- Priorities
INSERT INTO priorities (id, name, level, color)
VALUES
  (1, 'Baixa', 1, '#10B981'),
  (2, 'Media', 2, '#3B82F6'),
  (3, 'Alta', 3, '#F59E0B'),
  (4, 'Critica', 4, '#EF4444')
ON CONFLICT (id) DO NOTHING;

-- Statuses
INSERT INTO statuses (id, name, description, color, is_final)
VALUES
  (1, 'Aberto', 'Ticket aberto', '#3B82F6', FALSE),
  (2, 'Em Andamento', 'Ticket em atendimento', '#F59E0B', FALSE),
  (3, 'Resolvido', 'Ticket resolvido', '#10B981', TRUE),
  (4, 'Fechado', 'Ticket fechado', '#6B7280', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Keep sequences aligned after explicit IDs
SELECT setval(pg_get_serial_sequence('organizations', 'id'), COALESCE(MAX(id), 1), true) FROM organizations;
SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(MAX(id), 1), true) FROM categories;
SELECT setval(pg_get_serial_sequence('priorities', 'id'), COALESCE(MAX(id), 1), true) FROM priorities;
SELECT setval(pg_get_serial_sequence('statuses', 'id'), COALESCE(MAX(id), 1), true) FROM statuses;

-- ========================================
-- ITIL REFERENCE DATA
-- ========================================

-- Teams
INSERT INTO teams (id, name, description, organization_id) VALUES
  (1, 'IT Support', 'General IT support team', 1),
  (2, 'Infrastructure', 'Infrastructure and operations team', 1),
  (3, 'Development', 'Software development team', 1),
  (4, 'Security', 'Information security team', 1),
  (5, 'Network', 'Network operations team', 1)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('teams', 'id'), COALESCE(MAX(id), 1), true) FROM teams;

-- Root Cause Categories
INSERT INTO root_cause_categories (id, name, description, organization_id) VALUES
  (1, 'Hardware', 'Hardware-related root causes', 1),
  (2, 'Software', 'Software-related root causes', 1),
  (3, 'Network', 'Network-related root causes', 1),
  (4, 'Human Error', 'Human error root causes', 1),
  (5, 'Process', 'Process-related root causes', 1),
  (6, 'External', 'External/third-party root causes', 1)
ON CONFLICT (id) DO NOTHING;

-- CI Types
INSERT INTO ci_types (id, name, description, icon, color, organization_id) VALUES
  (1, 'Server', 'Physical or virtual server', 'server', '#3B82F6', 1),
  (2, 'Network Device', 'Router, switch, firewall', 'wifi', '#10B981', 1),
  (3, 'Application', 'Software application or service', 'cube', '#8B5CF6', 1),
  (4, 'Database', 'Database instance', 'circle-stack', '#F59E0B', 1),
  (5, 'Storage', 'Storage system or volume', 'archive-box', '#6366F1', 1),
  (6, 'Workstation', 'Desktop or laptop', 'computer-desktop', '#EC4899', 1),
  (7, 'Cloud Service', 'Cloud-hosted service or resource', 'cloud', '#06B6D4', 1),
  (8, 'Printer', 'Printer or MFD', 'printer', '#78716C', 1)
ON CONFLICT (id) DO NOTHING;

-- CI Statuses
INSERT INTO ci_statuses (id, name, description, color, is_operational) VALUES
  (1, 'Active', 'CI is operational and in use', '#10B981', TRUE),
  (2, 'Inactive', 'CI exists but is not in use', '#6B7280', FALSE),
  (3, 'Under Maintenance', 'CI is being maintained', '#F59E0B', FALSE),
  (4, 'Planned', 'CI is planned but not deployed', '#3B82F6', FALSE),
  (5, 'Retired', 'CI has been decommissioned', '#EF4444', FALSE)
ON CONFLICT (id) DO NOTHING;

-- CI Relationship Types
INSERT INTO ci_relationship_types (id, name, description, inverse_name, color) VALUES
  (1, 'Depends On', 'This CI depends on target CI', 'Depended On By', '#EF4444'),
  (2, 'Hosts', 'This CI hosts the target CI', 'Hosted On', '#3B82F6'),
  (3, 'Connects To', 'This CI connects to target CI', 'Connected From', '#10B981'),
  (4, 'Runs On', 'This CI runs on target CI', 'Runs', '#F59E0B'),
  (5, 'Backs Up', 'This CI is backed up by target CI', 'Backup Of', '#8B5CF6'),
  (6, 'Monitors', 'This CI monitors target CI', 'Monitored By', '#06B6D4')
ON CONFLICT (id) DO NOTHING;

-- Change Types
INSERT INTO change_types (id, name, description, color, requires_cab_approval, default_risk_level, lead_time_days, organization_id) VALUES
  (1, 'Standard', 'Pre-approved low-risk changes', '#10B981', FALSE, 'low', 0, 1),
  (2, 'Normal', 'Regular changes requiring approval', '#3B82F6', TRUE, 'medium', 5, 1),
  (3, 'Emergency', 'Urgent changes to restore service', '#EF4444', FALSE, 'high', 0, 1),
  (4, 'Major', 'High-impact changes requiring full CAB review', '#F59E0B', TRUE, 'high', 10, 1)
ON CONFLICT (id) DO NOTHING;

-- Service Categories
INSERT INTO service_categories (id, name, slug, description, icon, color, display_order, organization_id) VALUES
  (1, 'Servicos de TI', 'servicos-ti', 'Servicos de tecnologia da informacao', 'computer-desktop', '#3B82F6', 1, 1),
  (2, 'Recursos Humanos', 'recursos-humanos', 'Servicos de RH e pessoal', 'users', '#10B981', 2, 1),
  (3, 'Infraestrutura', 'infraestrutura', 'Servicos de infraestrutura e facilidades', 'building-office', '#F59E0B', 3, 1),
  (4, 'Seguranca', 'seguranca', 'Servicos de seguranca da informacao', 'shield-check', '#EF4444', 4, 1)
ON CONFLICT (id) DO NOTHING;

-- Service Catalog Items
INSERT INTO service_catalog_items (id, name, slug, short_description, category_id, icon, form_schema, organization_id) VALUES
  (1, 'Novo Computador', 'novo-computador', 'Solicitar um novo desktop ou laptop', 1, 'computer-desktop', '{"fields":[{"name":"type","label":"Tipo","type":"select","options":["Desktop","Laptop"],"required":true},{"name":"justification","label":"Justificativa","type":"textarea","required":true}]}', 1),
  (2, 'Acesso a Sistema', 'acesso-sistema', 'Solicitar acesso a um sistema corporativo', 1, 'key', '{"fields":[{"name":"system","label":"Sistema","type":"text","required":true},{"name":"access_level","label":"Nivel de Acesso","type":"select","options":["Leitura","Escrita","Admin"],"required":true}]}', 1),
  (3, 'Reset de Senha', 'reset-senha', 'Solicitar reset de senha', 1, 'lock-closed', '{"fields":[{"name":"system","label":"Sistema","type":"text","required":true}]}', 1),
  (4, 'Nova Conta de Email', 'nova-conta-email', 'Solicitar nova conta de email', 1, 'envelope', '{"fields":[{"name":"full_name","label":"Nome Completo","type":"text","required":true},{"name":"department","label":"Departamento","type":"text","required":true}]}', 1)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- RBAC ROLES AND PERMISSIONS
-- ========================================

-- Roles
INSERT INTO roles (id, name, display_name, description, is_system) VALUES
  (1, 'super_admin', 'Super Administrador', 'Acesso total ao sistema', TRUE),
  (2, 'tenant_admin', 'Administrador do Tenant', 'Administrador da organizacao', TRUE),
  (3, 'manager', 'Gerente', 'Gerente de equipe com acesso a relatorios', TRUE),
  (4, 'agent', 'Agente', 'Agente de suporte tecnico', TRUE),
  (5, 'user', 'Usuario', 'Usuario final do sistema', TRUE),
  (6, 'read_only', 'Somente Leitura', 'Acesso somente leitura', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Permissions
INSERT INTO permissions (id, name, description, resource, action) VALUES
  (1, 'tickets:create', 'Criar tickets', 'tickets', 'create'),
  (2, 'tickets:read', 'Visualizar tickets', 'tickets', 'read'),
  (3, 'tickets:update', 'Atualizar tickets', 'tickets', 'update'),
  (4, 'tickets:delete', 'Excluir tickets', 'tickets', 'delete'),
  (5, 'tickets:assign', 'Atribuir tickets', 'tickets', 'assign'),
  (6, 'problems:create', 'Criar problemas', 'problems', 'create'),
  (7, 'problems:read', 'Visualizar problemas', 'problems', 'read'),
  (8, 'problems:update', 'Atualizar problemas', 'problems', 'update'),
  (9, 'problems:delete', 'Excluir problemas', 'problems', 'delete'),
  (10, 'changes:create', 'Criar mudancas', 'changes', 'create'),
  (11, 'changes:read', 'Visualizar mudancas', 'changes', 'read'),
  (12, 'changes:update', 'Atualizar mudancas', 'changes', 'update'),
  (13, 'changes:approve', 'Aprovar mudancas', 'changes', 'approve'),
  (14, 'changes:delete', 'Excluir mudancas', 'changes', 'delete'),
  (15, 'cmdb:read', 'Visualizar CMDB', 'cmdb', 'read'),
  (16, 'cmdb:manage', 'Gerenciar CMDB', 'cmdb', 'manage'),
  (17, 'catalog:read', 'Visualizar catalogo', 'catalog', 'read'),
  (18, 'catalog:manage', 'Gerenciar catalogo', 'catalog', 'manage'),
  (19, 'catalog:request', 'Solicitar servicos', 'catalog', 'request'),
  (20, 'reports:view', 'Visualizar relatorios', 'reports', 'view'),
  (21, 'reports:create', 'Criar relatorios', 'reports', 'create'),
  (22, 'admin:settings', 'Configuracoes do sistema', 'admin', 'settings'),
  (23, 'admin:users', 'Gerenciar usuarios', 'admin', 'users'),
  (24, 'admin:roles', 'Gerenciar papeis', 'admin', 'roles'),
  (25, 'knowledge:read', 'Visualizar base de conhecimento', 'knowledge', 'read'),
  (26, 'knowledge:create', 'Criar artigos', 'knowledge', 'create'),
  (27, 'knowledge:manage', 'Gerenciar base de conhecimento', 'knowledge', 'manage'),
  (28, 'sla:read', 'Visualizar SLA', 'sla', 'read'),
  (29, 'sla:manage', 'Gerenciar SLA', 'sla', 'manage')
ON CONFLICT (id) DO NOTHING;

-- Super admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, p.id FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Tenant admin gets everything except admin:settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, p.id FROM permissions p WHERE p.name != 'admin:settings'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Agent permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, p.id FROM permissions p
WHERE p.resource IN ('tickets', 'problems', 'changes', 'cmdb', 'catalog', 'knowledge', 'sla')
AND p.action IN ('create', 'read', 'update', 'assign', 'request')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- User permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, p.id FROM permissions p
WHERE p.name IN ('tickets:create', 'tickets:read', 'catalog:read', 'catalog:request', 'knowledge:read', 'changes:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, p.id FROM permissions p
WHERE p.resource IN ('tickets', 'problems', 'changes', 'cmdb', 'catalog', 'knowledge', 'sla', 'reports')
AND p.action IN ('create', 'read', 'update', 'assign', 'request', 'view', 'approve')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Read only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 6, p.id FROM permissions p WHERE p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Align all new sequences
SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE(MAX(id), 1), true) FROM roles;
SELECT setval(pg_get_serial_sequence('permissions', 'id'), COALESCE(MAX(id), 1), true) FROM permissions;
SELECT setval(pg_get_serial_sequence('root_cause_categories', 'id'), COALESCE(MAX(id), 1), true) FROM root_cause_categories;
SELECT setval(pg_get_serial_sequence('ci_types', 'id'), COALESCE(MAX(id), 1), true) FROM ci_types;
SELECT setval(pg_get_serial_sequence('ci_statuses', 'id'), COALESCE(MAX(id), 1), true) FROM ci_statuses;
SELECT setval(pg_get_serial_sequence('ci_relationship_types', 'id'), COALESCE(MAX(id), 1), true) FROM ci_relationship_types;
SELECT setval(pg_get_serial_sequence('change_types', 'id'), COALESCE(MAX(id), 1), true) FROM change_types;
SELECT setval(pg_get_serial_sequence('service_categories', 'id'), COALESCE(MAX(id), 1), true) FROM service_categories;
SELECT setval(pg_get_serial_sequence('service_catalog_items', 'id'), COALESCE(MAX(id), 1), true) FROM service_catalog_items;
