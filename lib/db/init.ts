import db from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../monitoring/structured-logger';

function applySchemaFile(pathname: string): void {
  const schemaPath = join(process.cwd(), pathname);
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
}

function applySchemaCreateTablesOnly(pathname: string): void {
  const schemaPath = join(process.cwd(), pathname);
  const schema = readFileSync(schemaPath, 'utf-8');
  const createTableStatements = schema.match(/CREATE TABLE IF NOT EXISTS[\s\S]*?;/gi) || [];

  for (const statement of createTableStatements) {
    db.exec(statement);
  }
}

function hasTable(table: string): boolean {
  const result = db.prepare(
    "SELECT 1 as ok FROM sqlite_master WHERE type='table' AND name = ?"
  ).get(table) as { ok: number } | undefined;
  return Boolean(result);
}

function ensureColumn(table: string, column: string, ddl: string): void {
  if (!hasTable(table)) {
    return;
  }

  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function ensureBootstrapCompatibility(): void {
  ensureColumn('users', 'organization_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('users', 'tenant_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('tickets', 'organization_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('tickets', 'tenant_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('comments', 'organization_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('comments', 'tenant_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('attachments', 'organization_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('attachments', 'tenant_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('notifications', 'organization_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('notifications', 'tenant_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('audit_logs', 'organization_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('audit_logs', 'tenant_id', 'INTEGER NOT NULL DEFAULT 1');

  if (hasTable('users')) {
    db.exec(`
      UPDATE users
      SET tenant_id = COALESCE(tenant_id, organization_id, 1),
          organization_id = COALESCE(organization_id, tenant_id, 1)
    `);
  }
}

function seedITILReferenceData(): void {
  // Root Cause Categories
  const hasRCC = db.prepare("SELECT 1 FROM root_cause_categories LIMIT 1").get();
  if (!hasRCC) {
    db.exec(`
      INSERT INTO root_cause_categories (name, description, organization_id) VALUES
        ('Hardware', 'Hardware-related root causes', 1),
        ('Software', 'Software-related root causes', 1),
        ('Network', 'Network-related root causes', 1),
        ('Human Error', 'Human error root causes', 1),
        ('Process', 'Process-related root causes', 1),
        ('External', 'External/third-party root causes', 1);
    `);
  }

  // CI Types
  const hasCITypes = db.prepare("SELECT 1 FROM ci_types LIMIT 1").get();
  if (!hasCITypes) {
    db.exec(`
      INSERT INTO ci_types (name, description, icon, color, organization_id) VALUES
        ('Server', 'Physical or virtual server', 'server', '#3B82F6', 1),
        ('Network Device', 'Router, switch, firewall', 'wifi', '#10B981', 1),
        ('Application', 'Software application or service', 'cube', '#8B5CF6', 1),
        ('Database', 'Database instance', 'circle-stack', '#F59E0B', 1),
        ('Storage', 'Storage system or volume', 'archive-box', '#6366F1', 1),
        ('Workstation', 'Desktop or laptop', 'computer-desktop', '#EC4899', 1),
        ('Cloud Service', 'Cloud-hosted service or resource', 'cloud', '#06B6D4', 1),
        ('Printer', 'Printer or MFD', 'printer', '#78716C', 1);
    `);
  }

  // CI Statuses
  const hasCIStatuses = db.prepare("SELECT 1 FROM ci_statuses LIMIT 1").get();
  if (!hasCIStatuses) {
    db.exec(`
      INSERT INTO ci_statuses (name, description, color, is_operational) VALUES
        ('Active', 'CI is operational and in use', '#10B981', TRUE),
        ('Inactive', 'CI exists but is not in use', '#6B7280', FALSE),
        ('Under Maintenance', 'CI is being maintained', '#F59E0B', FALSE),
        ('Planned', 'CI is planned but not deployed', '#3B82F6', FALSE),
        ('Retired', 'CI has been decommissioned', '#EF4444', FALSE);
    `);
  }

  // CI Relationship Types
  const hasCIRelTypes = db.prepare("SELECT 1 FROM ci_relationship_types LIMIT 1").get();
  if (!hasCIRelTypes) {
    db.exec(`
      INSERT INTO ci_relationship_types (name, description, inverse_name, color) VALUES
        ('Depends On', 'This CI depends on target CI', 'Depended On By', '#EF4444'),
        ('Hosts', 'This CI hosts the target CI', 'Hosted On', '#3B82F6'),
        ('Connects To', 'This CI connects to target CI', 'Connected From', '#10B981'),
        ('Runs On', 'This CI runs on target CI', 'Runs', '#F59E0B'),
        ('Backs Up', 'This CI is backed up by target CI', 'Backup Of', '#8B5CF6'),
        ('Monitors', 'This CI monitors target CI', 'Monitored By', '#06B6D4');
    `);
  }

  // Change Types
  const hasChangeTypes = db.prepare("SELECT 1 FROM change_types LIMIT 1").get();
  if (!hasChangeTypes) {
    db.exec(`
      INSERT INTO change_types (name, description, color, requires_cab_approval, default_risk_level, lead_time_days, organization_id) VALUES
        ('Standard', 'Pre-approved low-risk changes', '#10B981', FALSE, 'low', 0, 1),
        ('Normal', 'Regular changes requiring approval', '#3B82F6', TRUE, 'medium', 5, 1),
        ('Emergency', 'Urgent changes to restore service', '#EF4444', FALSE, 'high', 0, 1),
        ('Major', 'High-impact changes requiring full CAB review', '#F59E0B', TRUE, 'high', 10, 1);
    `);
  }

  // Service Categories
  const hasServiceCats = db.prepare("SELECT 1 FROM service_categories LIMIT 1").get();
  if (!hasServiceCats) {
    db.exec(`
      INSERT INTO service_categories (name, slug, description, icon, color, display_order, organization_id) VALUES
        ('Serviços de TI', 'servicos-ti', 'Serviços de tecnologia da informação', 'computer-desktop', '#3B82F6', 1, 1),
        ('Recursos Humanos', 'recursos-humanos', 'Serviços de RH e pessoal', 'users', '#10B981', 2, 1),
        ('Infraestrutura', 'infraestrutura', 'Serviços de infraestrutura e facilidades', 'building-office', '#F59E0B', 3, 1),
        ('Segurança', 'seguranca', 'Serviços de segurança da informação', 'shield-check', '#EF4444', 4, 1);
    `);
  }

  // Service Catalog Items
  const hasServiceItems = db.prepare("SELECT 1 FROM service_catalog_items LIMIT 1").get();
  if (!hasServiceItems) {
    db.exec(`
      INSERT INTO service_catalog_items (name, slug, short_description, category_id, icon, form_schema, organization_id) VALUES
        ('Novo Computador', 'novo-computador', 'Solicitar um novo desktop ou laptop', 1, 'computer-desktop', '{"fields":[{"name":"type","label":"Tipo","type":"select","options":["Desktop","Laptop"],"required":true},{"name":"justification","label":"Justificativa","type":"textarea","required":true}]}', 1),
        ('Acesso a Sistema', 'acesso-sistema', 'Solicitar acesso a um sistema corporativo', 1, 'key', '{"fields":[{"name":"system","label":"Sistema","type":"text","required":true},{"name":"access_level","label":"Nível de Acesso","type":"select","options":["Leitura","Escrita","Admin"],"required":true}]}', 1),
        ('Reset de Senha', 'reset-senha', 'Solicitar reset de senha', 1, 'lock-closed', '{"fields":[{"name":"system","label":"Sistema","type":"text","required":true}]}', 1),
        ('Nova Conta de Email', 'nova-conta-email', 'Solicitar nova conta de email', 1, 'envelope', '{"fields":[{"name":"full_name","label":"Nome Completo","type":"text","required":true},{"name":"department","label":"Departamento","type":"text","required":true}]}', 1);
    `);
  }

  // RBAC Roles
  const hasRoles = db.prepare("SELECT 1 FROM roles LIMIT 1").get();
  if (!hasRoles) {
    db.exec(`
      INSERT INTO roles (name, display_name, description, is_system) VALUES
        ('super_admin', 'Super Administrador', 'Acesso total ao sistema', TRUE),
        ('tenant_admin', 'Administrador do Tenant', 'Administrador da organização', TRUE),
        ('manager', 'Gerente', 'Gerente de equipe com acesso a relatórios', TRUE),
        ('agent', 'Agente', 'Agente de suporte técnico', TRUE),
        ('user', 'Usuário', 'Usuário final do sistema', TRUE),
        ('read_only', 'Somente Leitura', 'Acesso somente leitura', TRUE);
    `);
  }

  // RBAC Permissions
  const hasPermissions = db.prepare("SELECT 1 FROM permissions LIMIT 1").get();
  if (!hasPermissions) {
    db.exec(`
      INSERT INTO permissions (name, description, resource, action) VALUES
        ('tickets:create', 'Criar tickets', 'tickets', 'create'),
        ('tickets:read', 'Visualizar tickets', 'tickets', 'read'),
        ('tickets:update', 'Atualizar tickets', 'tickets', 'update'),
        ('tickets:delete', 'Excluir tickets', 'tickets', 'delete'),
        ('tickets:assign', 'Atribuir tickets', 'tickets', 'assign'),
        ('problems:create', 'Criar problemas', 'problems', 'create'),
        ('problems:read', 'Visualizar problemas', 'problems', 'read'),
        ('problems:update', 'Atualizar problemas', 'problems', 'update'),
        ('problems:delete', 'Excluir problemas', 'problems', 'delete'),
        ('changes:create', 'Criar mudanças', 'changes', 'create'),
        ('changes:read', 'Visualizar mudanças', 'changes', 'read'),
        ('changes:update', 'Atualizar mudanças', 'changes', 'update'),
        ('changes:approve', 'Aprovar mudanças', 'changes', 'approve'),
        ('changes:delete', 'Excluir mudanças', 'changes', 'delete'),
        ('cmdb:read', 'Visualizar CMDB', 'cmdb', 'read'),
        ('cmdb:manage', 'Gerenciar CMDB', 'cmdb', 'manage'),
        ('catalog:read', 'Visualizar catálogo', 'catalog', 'read'),
        ('catalog:manage', 'Gerenciar catálogo', 'catalog', 'manage'),
        ('catalog:request', 'Solicitar serviços', 'catalog', 'request'),
        ('reports:view', 'Visualizar relatórios', 'reports', 'view'),
        ('reports:create', 'Criar relatórios', 'reports', 'create'),
        ('admin:settings', 'Configurações do sistema', 'admin', 'settings'),
        ('admin:users', 'Gerenciar usuários', 'admin', 'users'),
        ('admin:roles', 'Gerenciar papéis', 'admin', 'roles'),
        ('knowledge:read', 'Visualizar base de conhecimento', 'knowledge', 'read'),
        ('knowledge:create', 'Criar artigos', 'knowledge', 'create'),
        ('knowledge:manage', 'Gerenciar base de conhecimento', 'knowledge', 'manage'),
        ('sla:read', 'Visualizar SLA', 'sla', 'read'),
        ('sla:manage', 'Gerenciar SLA', 'sla', 'manage');
    `);

    // Assign all permissions to super_admin
    db.exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin';
    `);

    // Assign tenant_admin permissions (everything except admin:settings)
    db.exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'tenant_admin' AND p.name != 'admin:settings';
    `);

    // Assign agent permissions
    db.exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'agent' AND p.resource IN ('tickets', 'problems', 'changes', 'cmdb', 'catalog', 'knowledge', 'sla')
      AND p.action IN ('create', 'read', 'update', 'assign', 'request');
    `);

    // Assign user permissions (read + create tickets + request catalog + read knowledge)
    db.exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'user' AND (
        p.name IN ('tickets:create', 'tickets:read', 'catalog:read', 'catalog:request', 'knowledge:read', 'changes:read')
      );
    `);

    // Assign manager permissions (agent + reports + sla)
    db.exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'manager' AND (
        p.resource IN ('tickets', 'problems', 'changes', 'cmdb', 'catalog', 'knowledge', 'sla', 'reports')
        AND p.action IN ('create', 'read', 'update', 'assign', 'request', 'view', 'approve')
      );
    `);

    // Assign read_only permissions
    db.exec(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'read_only' AND p.action = 'read';
    `);
  }

  logger.info('✅ ITIL reference data and RBAC seeded');
}

/**
 * Inicializa o banco de dados criando as tabelas se elas não existirem
 */
export function initializeDatabase() {
  try {
    // Drop indexes that previously used non-deterministic datetime('now')
    // so the corrected schema can recreate them cleanly.
    const staleIndexes = [
      'idx_sla_tracking_breached',
      'idx_users_locked',
      'idx_cache_cleanup',
    ];
    for (const idx of staleIndexes) {
      try { db.exec(`DROP INDEX IF EXISTS ${idx}`); } catch { /* ignore */ }
    }

    // Base schema (idempotent — uses CREATE TABLE/INDEX IF NOT EXISTS)
    applySchemaFile('lib/db/schema.sql');

    // Multi-tenant compatibility tables only.
    // We intentionally skip indexes/triggers here because legacy instances
    // may not yet have all referenced columns during bootstrap.
    applySchemaCreateTablesOnly('lib/db/schema-multitenant.sql');

    // Final compatibility pass for mixed tenant_id/organization_id code paths.
    ensureBootstrapCompatibility();

    // Seed ITIL reference data (idempotent)
    seedITILReferenceData();

    logger.info('✅ Database initialized successfully');
    return true;
  } catch (error) {
    logger.error('❌ Error initializing database', error);
    return false;
  }
}

/**
 * Verifica se o banco de dados está inicializado
 */
export function isDatabaseInitialized(): boolean {
  try {
    // Verifica se a tabela users existe
    const result = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='users'
    `).get();
    
    return !!result;
  } catch (error) {
    logger.error('Error checking database initialization', error);
    return false;
  }
}

/**
 * Fecha a conexão com o banco de dados
 */
export function closeDatabase() {
  try {
    db.close();
    logger.info('✅ Database connection closed');
  } catch (error) {
    logger.error('❌ Error closing database', error);
  }
}
