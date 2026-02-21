#!/usr/bin/env tsx

/**
 * Apply missing ITIL tables from schema.sql to existing SQLite database.
 * Also seeds ITIL reference data.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'servicedesk.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Read schema.sql
const schema = readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf-8');

// Extract all CREATE TABLE IF NOT EXISTS statements
const createStatements = schema.match(/CREATE TABLE IF NOT EXISTS[\s\S]*?;/gi) || [];
console.log('Found', createStatements.length, 'CREATE TABLE statements in schema.sql');

// Get existing tables
const existingTables = new Set(
  (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>)
    .map(t => t.name)
);

let created = 0;
let skipped = 0;
let errors = 0;

for (const stmt of createStatements) {
  const match = stmt.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
  if (!match) continue;
  const tableName = match[1];

  if (existingTables.has(tableName)) {
    skipped++;
    continue;
  }

  try {
    db.exec(stmt);
    console.log(' ✓ Created:', tableName);
    created++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(' ✗ Error creating', tableName + ':', msg);
    errors++;
  }
}

console.log('\nTables — Created:', created, '| Skipped (exist):', skipped, '| Errors:', errors);

// Apply CREATE INDEX statements
const indexStatements = schema.match(/CREATE INDEX IF NOT EXISTS[\s\S]*?;/gi) || [];
let idxCreated = 0;
let idxErrors = 0;
for (const stmt of indexStatements) {
  try {
    db.exec(stmt);
    idxCreated++;
  } catch {
    idxErrors++;
  }
}
console.log('Indexes — Created:', idxCreated, '| Errors:', idxErrors);

// Apply CREATE TRIGGER statements
const triggerStatements = schema.match(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?END;/gi) || [];
let trigCreated = 0;
let trigErrors = 0;
for (const stmt of triggerStatements) {
  try {
    db.exec(stmt);
    trigCreated++;
  } catch {
    trigErrors++;
  }
}
console.log('Triggers — Created:', trigCreated, '| Errors:', trigErrors);

// =====================
// SEED ITIL REFERENCE DATA
// =====================
console.log('\n=== Seeding ITIL Reference Data ===');

function seedIfEmpty(table: string, insertSQL: string): void {
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
  if (row.cnt > 0) {
    console.log(' ⏭ ', table, '— already has', row.cnt, 'rows');
    return;
  }
  try {
    db.exec(insertSQL);
    const after = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
    console.log(' ✓', table, '— seeded', after.cnt, 'rows');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(' ✗', table, '— seed error:', msg);
  }
}

seedIfEmpty('root_cause_categories', `
  INSERT INTO root_cause_categories (name, description, organization_id) VALUES
    ('Hardware', 'Hardware-related root causes', 1),
    ('Software', 'Software-related root causes', 1),
    ('Network', 'Network-related root causes', 1),
    ('Human Error', 'Human error root causes', 1),
    ('Process', 'Process-related root causes', 1),
    ('External', 'External/third-party root causes', 1);
`);

seedIfEmpty('ci_types', `
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

seedIfEmpty('ci_statuses', `
  INSERT INTO ci_statuses (name, description, color, is_operational) VALUES
    ('Active', 'CI is operational and in use', '#10B981', TRUE),
    ('Inactive', 'CI exists but is not in use', '#6B7280', FALSE),
    ('Under Maintenance', 'CI is being maintained', '#F59E0B', FALSE),
    ('Planned', 'CI is planned but not deployed', '#3B82F6', FALSE),
    ('Retired', 'CI has been decommissioned', '#EF4444', FALSE);
`);

seedIfEmpty('ci_relationship_types', `
  INSERT INTO ci_relationship_types (name, description, inverse_name, color) VALUES
    ('Depends On', 'This CI depends on target CI', 'Depended On By', '#EF4444'),
    ('Hosts', 'This CI hosts the target CI', 'Hosted On', '#3B82F6'),
    ('Connects To', 'This CI connects to target CI', 'Connected From', '#10B981'),
    ('Runs On', 'This CI runs on target CI', 'Runs', '#F59E0B'),
    ('Backs Up', 'This CI is backed up by target CI', 'Backup Of', '#8B5CF6'),
    ('Monitors', 'This CI monitors target CI', 'Monitored By', '#06B6D4');
`);

seedIfEmpty('change_types', `
  INSERT INTO change_types (name, description, color, requires_cab_approval, default_risk_level, lead_time_days, organization_id) VALUES
    ('Standard', 'Pre-approved low-risk changes', '#10B981', FALSE, 'low', 0, 1),
    ('Normal', 'Regular changes requiring approval', '#3B82F6', TRUE, 'medium', 5, 1),
    ('Emergency', 'Urgent changes to restore service', '#EF4444', FALSE, 'high', 0, 1),
    ('Major', 'High-impact changes requiring full CAB review', '#F59E0B', TRUE, 'high', 10, 1);
`);

seedIfEmpty('service_categories', `
  INSERT INTO service_categories (name, slug, description, icon, color, display_order, organization_id) VALUES
    ('Servicos de TI', 'servicos-ti', 'Servicos de tecnologia da informacao', 'computer-desktop', '#3B82F6', 1, 1),
    ('Recursos Humanos', 'recursos-humanos', 'Servicos de RH e pessoal', 'users', '#10B981', 2, 1),
    ('Infraestrutura', 'infraestrutura', 'Servicos de infraestrutura e facilidades', 'building-office', '#F59E0B', 3, 1),
    ('Seguranca', 'seguranca', 'Servicos de seguranca da informacao', 'shield-check', '#EF4444', 4, 1);
`);

seedIfEmpty('service_catalog_items', `
  INSERT INTO service_catalog_items (name, slug, short_description, category_id, icon, form_schema, organization_id) VALUES
    ('Novo Computador', 'novo-computador', 'Solicitar um novo desktop ou laptop', 1, 'computer-desktop', '{"fields":[{"name":"type","label":"Tipo","type":"select","options":["Desktop","Laptop"],"required":true},{"name":"justification","label":"Justificativa","type":"textarea","required":true}]}', 1),
    ('Acesso a Sistema', 'acesso-sistema', 'Solicitar acesso a um sistema corporativo', 1, 'key', '{"fields":[{"name":"system","label":"Sistema","type":"text","required":true},{"name":"access_level","label":"Nivel de Acesso","type":"select","options":["Leitura","Escrita","Admin"],"required":true}]}', 1),
    ('Reset de Senha', 'reset-senha', 'Solicitar reset de senha', 1, 'lock-closed', '{"fields":[{"name":"system","label":"Sistema","type":"text","required":true}]}', 1),
    ('Nova Conta de Email', 'nova-conta-email', 'Solicitar nova conta de email', 1, 'envelope', '{"fields":[{"name":"full_name","label":"Nome Completo","type":"text","required":true},{"name":"department","label":"Departamento","type":"text","required":true}]}', 1);
`);

// RBAC — roles and permissions already exist, but check role_permissions completeness
const rpCount = (db.prepare('SELECT COUNT(*) as cnt FROM role_permissions').get() as { cnt: number }).cnt;
console.log('\n role_permissions:', rpCount, 'existing mappings');

if (rpCount < 50) {
  console.log(' Seeding role_permissions...');

  // Super admin gets all permissions
  db.exec(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin';
  `);

  // Tenant admin gets everything except admin:settings
  db.exec(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p
    WHERE r.name = 'tenant_admin' AND p.name != 'admin:settings';
  `);

  // Agent permissions
  db.exec(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p
    WHERE r.name = 'agent' AND p.resource IN ('tickets', 'problems', 'changes', 'cmdb', 'catalog', 'knowledge', 'sla')
    AND p.action IN ('create', 'read', 'update', 'assign', 'request');
  `);

  // User permissions
  db.exec(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p
    WHERE r.name = 'user' AND (
      p.name IN ('tickets:create', 'tickets:read', 'catalog:read', 'catalog:request', 'knowledge:read', 'changes:read')
    );
  `);

  // Manager permissions
  db.exec(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p
    WHERE r.name = 'manager' AND (
      p.resource IN ('tickets', 'problems', 'changes', 'cmdb', 'catalog', 'knowledge', 'sla', 'reports')
      AND p.action IN ('create', 'read', 'update', 'assign', 'request', 'view', 'approve')
    );
  `);

  // Read only permissions
  db.exec(`
    INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p
    WHERE r.name = 'read_only' AND p.action = 'read';
  `);

  const rpAfter = (db.prepare('SELECT COUNT(*) as cnt FROM role_permissions').get() as { cnt: number }).cnt;
  console.log(' ✓ role_permissions now:', rpAfter, 'mappings');
}

// VERIFY
console.log('\n=== FINAL VERIFICATION ===');
const itilTables = [
  'problems', 'known_errors', 'problem_incident_links', 'problem_activities',
  'root_cause_categories', 'change_types', 'change_requests', 'change_request_approvals',
  'change_tasks', 'ci_types', 'ci_statuses', 'ci_relationship_types',
  'configuration_items', 'ci_relationships', 'ci_history',
  'service_categories', 'service_catalog_items', 'service_requests',
  'cab_configurations', 'cab_members', 'cab_meetings',
  'roles', 'permissions', 'role_permissions'
];

const finalTables = new Set(
  (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>)
    .map(t => t.name)
);

let allOk = true;
for (const t of itilTables) {
  const exists = finalTables.has(t);
  if (!exists) {
    allOk = false;
    console.log(' ✗ STILL MISSING:', t);
  }
}

if (allOk) {
  console.log(' ✓ All', itilTables.length, 'ITIL/RBAC tables verified');
} else {
  console.log(' ✗ Some tables still missing');
}

console.log('Total tables in database:', finalTables.size);

db.close();
console.log('\n✅ Done');
