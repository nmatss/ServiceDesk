#!/usr/bin/env tsx

/**
 * Script para inicializar o banco de dados.
 *
 * - SQLite: usa schema + seed existentes
 * - PostgreSQL: aplica schema PostgreSQL e seed mínimo local
 */

import fs from 'fs';
import path from 'path';
import { initializeDatabase, seedDatabase, isDatabaseInitialized } from '../lib/db';
import { logger } from '@/lib/monitoring/logger';
import { getDatabaseType, getPostgresConnectionString } from '@/lib/db/config';

type SQLiteColumnSpec = { name: string; ddl: string };

async function ensureSQLiteTableColumns(
  table: string,
  columns: SQLiteColumnSpec[]
): Promise<void> {
  const { default: db } = await import('@/lib/db/connection');
  const tableExists = db.prepare(
    "SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(table) as { ok: number } | undefined;

  if (!tableExists) {
    return;
  }

  const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const existingColumns = new Set(tableInfo.map((column) => column.name));

  for (const column of columns) {
    if (!existingColumns.has(column.name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.ddl}`);
      logger.info(`✅ Added missing column ${table}.${column.name} (SQLite)`);
    }
  }
}

async function ensureSQLiteCompatibilityColumns(): Promise<void> {
  const { default: db } = await import('@/lib/db/connection');
  const tableInfo = db.prepare('PRAGMA table_info(tickets)').all() as Array<{ name: string }>;
  const hasSlaPolicyId = tableInfo.some((column) => column.name === 'sla_policy_id');

  if (!hasSlaPolicyId) {
    db.exec('ALTER TABLE tickets ADD COLUMN sla_policy_id INTEGER');
    logger.info('✅ Added missing column tickets.sla_policy_id (SQLite)');
  }
}

async function ensureSQLiteTenantCompatibility(): Promise<void> {
  const { default: db } = await import('@/lib/db/connection');

  // Apply supplemental multi-tenant schema for missing legacy tables.
  const multiTenantSchemaPath = path.join(process.cwd(), 'lib', 'db', 'schema-multitenant.sql');
  if (fs.existsSync(multiTenantSchemaPath)) {
    const schema = fs.readFileSync(multiTenantSchemaPath, 'utf-8');
    const createTableStatements = schema.match(/CREATE TABLE IF NOT EXISTS[\s\S]*?;/gi) || [];
    for (const statement of createTableStatements) {
      db.exec(statement);
    }
    logger.info('✅ Applied schema-multitenant.sql compatibility layer (SQLite)');
  }

  // Ensure organizations exists before syncing tenant identifiers.
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      domain TEXT,
      settings TEXT,
      subscription_plan TEXT DEFAULT 'basic',
      subscription_status TEXT DEFAULT 'active',
      subscription_expires_at DATETIME,
      max_users INTEGER DEFAULT 50,
      max_tickets_per_month INTEGER DEFAULT 1000,
      features TEXT,
      billing_email TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
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
    )
  `);

  db.exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      added_by INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ticket_id, tag_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_followers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ticket_id, user_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_ticket_id INTEGER NOT NULL,
      target_ticket_id INTEGER NOT NULL,
      relationship_type TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureSQLiteTableColumns('users', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
  ]);
  await ensureSQLiteTableColumns('tickets', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'ticket_type_id', ddl: 'INTEGER' },
    { name: 'assigned_team_id', ddl: 'INTEGER' },
  ]);
  await ensureSQLiteTableColumns('comments', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
  ]);
  await ensureSQLiteTableColumns('attachments', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'original_filename', ddl: 'TEXT' },
    { name: 'file_size', ddl: 'INTEGER' },
    { name: 'storage_path', ddl: 'TEXT' },
    { name: 'is_public', ddl: 'BOOLEAN DEFAULT FALSE' },
  ]);
  await ensureSQLiteTableColumns('categories', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
  ]);
  await ensureSQLiteTableColumns('priorities', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
  ]);
  await ensureSQLiteTableColumns('statuses', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
  ]);
  await ensureSQLiteTableColumns('notifications', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
  ]);
  await ensureSQLiteTableColumns('audit_logs', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
  ]);
  await ensureSQLiteTableColumns('ticket_activities', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'old_value', ddl: 'TEXT' },
    { name: 'new_value', ddl: 'TEXT' },
    { name: 'metadata', ddl: 'TEXT' },
  ]);
  await ensureSQLiteTableColumns('tags', [
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'color', ddl: "TEXT DEFAULT '#3B82F6'" },
    { name: 'description', ddl: 'TEXT' },
    { name: 'usage_count', ddl: 'INTEGER DEFAULT 0' },
  ]);

  // Keep organizations and tenants synchronized for legacy and new code paths.
  db.exec(`
    INSERT OR IGNORE INTO organizations (
      id, name, slug, domain, settings, subscription_plan, max_users, max_tickets_per_month,
      features, billing_email, is_active, created_at, updated_at
    )
    SELECT
      t.id,
      t.name,
      t.slug,
      t.domain,
      COALESCE(t.settings, '{}'),
      COALESCE(t.subscription_plan, 'basic'),
      COALESCE(t.max_users, 50),
      COALESCE(t.max_tickets_per_month, 1000),
      COALESCE(t.features, '[]'),
      t.billing_email,
      COALESCE(t.is_active, 1),
      COALESCE(t.created_at, CURRENT_TIMESTAMP),
      COALESCE(t.updated_at, CURRENT_TIMESTAMP)
    FROM tenants t
  `);

  db.exec(`
    INSERT OR IGNORE INTO tenants (
      id, name, slug, domain, subscription_plan, max_users, max_tickets_per_month,
      features, settings, billing_email, is_active, created_at, updated_at
    )
    SELECT
      o.id,
      o.name,
      o.slug,
      o.domain,
      COALESCE(o.subscription_plan, 'basic'),
      COALESCE(o.max_users, 50),
      COALESCE(o.max_tickets_per_month, 1000),
      COALESCE(o.features, '[]'),
      COALESCE(o.settings, '{}'),
      o.billing_email,
      COALESCE(o.is_active, 1),
      COALESCE(o.created_at, CURRENT_TIMESTAMP),
      COALESCE(o.updated_at, CURRENT_TIMESTAMP)
    FROM organizations o
  `);

  const tenantScopedTables = [
    'users',
    'tickets',
    'comments',
    'attachments',
    'categories',
    'priorities',
    'statuses',
    'notifications',
    'audit_logs',
    'tags',
    'ticket_activities',
  ];

  for (const table of tenantScopedTables) {
    const tableExists = db.prepare(
      "SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get(table) as { ok: number } | undefined;
    if (!tableExists) {
      continue;
    }

    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const colNames = new Set(columns.map((column) => column.name));
    if (colNames.has('tenant_id') && colNames.has('organization_id')) {
      db.exec(`
        UPDATE ${table}
        SET tenant_id = COALESCE(tenant_id, organization_id, 1),
            organization_id = COALESCE(organization_id, tenant_id, 1)
      `);
    }
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket_id ON ticket_activities(ticket_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_activities_user_id ON ticket_activities(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_activities_tenant_id ON ticket_activities(tenant_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_activities_org_id ON ticket_activities(organization_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_activities_created_at ON ticket_activities(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON tags(tenant_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tags_org_id ON tags(organization_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket_id ON ticket_tags(ticket_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag_id ON ticket_tags(tag_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_followers_ticket_id ON ticket_followers(ticket_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_followers_user_id ON ticket_followers(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_relationships_source ON ticket_relationships(source_ticket_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_relationships_target ON ticket_relationships(target_ticket_id)');
}

async function ensureSQLiteFileStorageCompatibility(): Promise<void> {
  const { default: db } = await import('@/lib/db/connection');

  db.exec(`
    CREATE TABLE IF NOT EXISTS file_storage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      organization_id INTEGER NOT NULL DEFAULT 1,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      original_filename TEXT,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      file_size INTEGER,
      file_path TEXT NOT NULL,
      storage_path TEXT,
      storage_type TEXT DEFAULT 'local',
      uploaded_by INTEGER NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      is_public BOOLEAN DEFAULT FALSE,
      virus_scanned BOOLEAN DEFAULT FALSE,
      virus_scan_result TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const tableInfo = db.prepare('PRAGMA table_info(file_storage)').all() as Array<{ name: string }>;
  const existingColumns = new Set(tableInfo.map((column) => column.name));
  const requiredColumns: Array<{ name: string; ddl: string }> = [
    { name: 'tenant_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'organization_id', ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'original_filename', ddl: 'TEXT' },
    { name: 'file_size', ddl: 'INTEGER' },
    { name: 'storage_path', ddl: 'TEXT' },
    { name: 'uploaded_at', ddl: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    { name: 'updated_at', ddl: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
  ];

  for (const column of requiredColumns) {
    if (!existingColumns.has(column.name)) {
      db.exec(`ALTER TABLE file_storage ADD COLUMN ${column.name} ${column.ddl}`);
      logger.info(`✅ Added missing column file_storage.${column.name} (SQLite)`);
    }
  }

  db.exec(`
    UPDATE file_storage
    SET tenant_id = COALESCE(tenant_id, organization_id, 1),
        organization_id = COALESCE(organization_id, tenant_id, 1),
        original_filename = COALESCE(original_filename, original_name, filename),
        file_size = COALESCE(file_size, size),
        storage_path = COALESCE(storage_path, file_path),
        uploaded_at = COALESCE(uploaded_at, created_at, CURRENT_TIMESTAMP)
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_file_storage_tenant ON file_storage(tenant_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_storage_org ON file_storage(organization_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_storage_entity ON file_storage(entity_type, entity_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_storage_uploaded_by ON file_storage(uploaded_by)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_storage_file_path ON file_storage(file_path)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_file_storage_storage_path ON file_storage(storage_path)');
}

async function ensurePostgreSQLTenantCompatibility(client: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  await client.query(`
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
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
    )
  `);

  await client.query(`
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
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ticket_tags (
      id BIGSERIAL PRIMARY KEY,
      ticket_id BIGINT NOT NULL,
      tag_id BIGINT NOT NULL,
      added_by BIGINT,
      added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ticket_id, tag_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ticket_followers (
      id BIGSERIAL PRIMARY KEY,
      ticket_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ticket_id, user_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ticket_relationships (
      id BIGSERIAL PRIMARY KEY,
      source_ticket_id BIGINT NOT NULL,
      target_ticket_id BIGINT NOT NULL,
      relationship_type VARCHAR(20) NOT NULL,
      created_by BIGINT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const alterWhenTableExists = async (table: string, columnDDL: string) => {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = '${table}'
        ) THEN
          EXECUTE 'ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${columnDDL}';
        END IF;
      END $$;
    `);
  };

  const tableColumns: Array<{ table: string; ddl: string[] }> = [
    { table: 'users', ddl: ['tenant_id BIGINT'] },
    { table: 'tickets', ddl: ['tenant_id BIGINT', 'ticket_type_id BIGINT', 'assigned_team_id BIGINT'] },
    { table: 'comments', ddl: ['tenant_id BIGINT', 'organization_id BIGINT'] },
    { table: 'attachments', ddl: ['tenant_id BIGINT', 'organization_id BIGINT'] },
    { table: 'categories', ddl: ['tenant_id BIGINT', 'organization_id BIGINT'] },
    { table: 'priorities', ddl: ['tenant_id BIGINT', 'organization_id BIGINT'] },
    { table: 'statuses', ddl: ['tenant_id BIGINT', 'organization_id BIGINT'] },
    { table: 'notifications', ddl: ['tenant_id BIGINT', 'organization_id BIGINT'] },
    { table: 'audit_logs', ddl: ['tenant_id BIGINT', 'organization_id BIGINT'] },
    { table: 'ticket_activities', ddl: ['tenant_id BIGINT', 'organization_id BIGINT', 'old_value TEXT', 'new_value TEXT', 'metadata JSONB'] },
  ];

  for (const entry of tableColumns) {
    for (const ddl of entry.ddl) {
      await alterWhenTableExists(entry.table, ddl);
    }
  }

  await client.query(`
    INSERT INTO organizations (id, name, slug, subscription_plan, subscription_status, is_active)
    VALUES (1, 'Empresa Demo', 'empresa-demo', 'basic', 'active', TRUE)
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO tenants (id, name, slug, subscription_plan, is_active)
    VALUES (1, 'Empresa Demo', 'empresa-demo', 'basic', TRUE)
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO organizations (
      id, name, slug, domain, settings, subscription_plan, max_users, max_tickets_per_month,
      features, billing_email, is_active, created_at, updated_at
    )
    SELECT
      t.id,
      t.name,
      t.slug,
      t.domain,
      COALESCE(t.settings, '{}'::jsonb),
      COALESCE(t.subscription_plan, 'basic'),
      COALESCE(t.max_users, 50),
      COALESCE(t.max_tickets_per_month, 1000),
      COALESCE(t.features, '[]'::jsonb),
      t.billing_email,
      COALESCE(t.is_active, TRUE),
      COALESCE(t.created_at, CURRENT_TIMESTAMP),
      COALESCE(t.updated_at, CURRENT_TIMESTAMP)
    FROM tenants t
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO tenants (
      id, name, slug, domain, subscription_plan, max_users, max_tickets_per_month,
      features, settings, billing_email, is_active, created_at, updated_at
    )
    SELECT
      o.id,
      o.name,
      o.slug,
      o.domain,
      COALESCE(o.subscription_plan, 'basic'),
      COALESCE(o.max_users, 50),
      COALESCE(o.max_tickets_per_month, 1000),
      COALESCE(o.features, '[]'::jsonb),
      COALESCE(o.settings, '{}'::jsonb),
      o.billing_email,
      COALESCE(o.is_active, TRUE),
      COALESCE(o.created_at, CURRENT_TIMESTAMP),
      COALESCE(o.updated_at, CURRENT_TIMESTAMP)
    FROM organizations o
    ON CONFLICT (id) DO NOTHING
  `);

  const backfillQueries = [
    `UPDATE users SET tenant_id = COALESCE(tenant_id, organization_id, 1)`,
    `UPDATE tickets SET tenant_id = COALESCE(tenant_id, organization_id, 1)`,
    `UPDATE comments SET tenant_id = COALESCE(tenant_id, organization_id, 1), organization_id = COALESCE(organization_id, tenant_id, 1)`,
    `UPDATE attachments SET tenant_id = COALESCE(tenant_id, organization_id, 1), organization_id = COALESCE(organization_id, tenant_id, 1)`,
    `UPDATE categories SET tenant_id = COALESCE(tenant_id, organization_id, 1), organization_id = COALESCE(organization_id, tenant_id, 1)`,
    `UPDATE priorities SET tenant_id = COALESCE(tenant_id, organization_id, 1), organization_id = COALESCE(organization_id, tenant_id, 1)`,
    `UPDATE statuses SET tenant_id = COALESCE(tenant_id, organization_id, 1), organization_id = COALESCE(organization_id, tenant_id, 1)`,
    `UPDATE notifications SET tenant_id = COALESCE(tenant_id, organization_id, 1), organization_id = COALESCE(organization_id, tenant_id, 1)`,
    `UPDATE audit_logs SET tenant_id = COALESCE(tenant_id, organization_id, 1), organization_id = COALESCE(organization_id, tenant_id, 1)`,
    `UPDATE ticket_activities SET tenant_id = COALESCE(tenant_id, organization_id, 1), organization_id = COALESCE(organization_id, tenant_id, 1)`,
  ];

  for (const query of backfillQueries) {
    await client.query(`
      DO $$
      BEGIN
        EXECUTE '${query.replace(/'/g, "''")}';
      EXCEPTION
        WHEN undefined_table THEN
          NULL;
        WHEN undefined_column THEN
          NULL;
      END $$;
    `);
  }

  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket_id ON ticket_activities(ticket_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_activities_user_id ON ticket_activities(user_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_activities_tenant_id ON ticket_activities(tenant_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_activities_org_id ON ticket_activities(organization_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_activities_created_at ON ticket_activities(created_at)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON tags(tenant_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_tags_org_id ON tags(organization_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket_id ON ticket_tags(ticket_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag_id ON ticket_tags(tag_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_followers_ticket_id ON ticket_followers(ticket_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_followers_user_id ON ticket_followers(user_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_relationships_source ON ticket_relationships(source_ticket_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_ticket_relationships_target ON ticket_relationships(target_ticket_id)');
}

async function ensurePostgreSQLFileStorageCompatibility(client: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  await client.query(`
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
      storage_type VARCHAR(20) DEFAULT 'local',
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
    )
  `);

  const alterStatements = [
    'ALTER TABLE file_storage ADD COLUMN IF NOT EXISTS tenant_id BIGINT',
    'ALTER TABLE file_storage ADD COLUMN IF NOT EXISTS organization_id BIGINT',
    'ALTER TABLE file_storage ADD COLUMN IF NOT EXISTS original_filename VARCHAR(500)',
    'ALTER TABLE file_storage ADD COLUMN IF NOT EXISTS file_size BIGINT',
    'ALTER TABLE file_storage ADD COLUMN IF NOT EXISTS storage_path VARCHAR(1000)',
    'ALTER TABLE file_storage ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
    'ALTER TABLE file_storage ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
  ];

  for (const statement of alterStatements) {
    await client.query(statement);
  }

  await client.query(`
    UPDATE file_storage
    SET tenant_id = COALESCE(tenant_id, organization_id, 1),
        organization_id = COALESCE(organization_id, tenant_id, 1),
        original_filename = COALESCE(original_filename, original_name, filename),
        file_size = COALESCE(file_size, size),
        storage_path = COALESCE(storage_path, file_path),
        uploaded_at = COALESCE(uploaded_at, created_at, CURRENT_TIMESTAMP)
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_file_storage_tenant ON file_storage(tenant_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_file_storage_org ON file_storage(organization_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_file_storage_entity ON file_storage(entity_type, entity_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_file_storage_uploaded_by ON file_storage(uploaded_by)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_file_storage_file_path ON file_storage(file_path)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_file_storage_storage_path ON file_storage(storage_path)');
}

async function initSQLite(): Promise<void> {
  logger.info('🚀 Initializing SQLite database...\n');

  // Always apply schema to pick up new tables (CREATE TABLE IF NOT EXISTS is idempotent)
  const initialized = initializeDatabase();
  if (!initialized) {
    logger.error('❌ Failed to initialize SQLite database');
    process.exit(1);
  }

  await ensureSQLiteCompatibilityColumns();
  await ensureSQLiteTenantCompatibility();
  await ensureSQLiteFileStorageCompatibility();

  const seeded = await seedDatabase();
  if (!seeded) {
    logger.error('❌ Failed to seed SQLite database');
    process.exit(1);
  }

  logger.info('\n✅ SQLite setup completed successfully!');
}

async function initPostgreSQL(): Promise<void> {
  logger.info('🚀 Initializing PostgreSQL database...\n');

  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    logger.error(
      '❌ PostgreSQL connection not configured. Set DATABASE_URL=postgresql://... or PG* variables.'
    );
    process.exit(1);
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const schemaCheck = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'users'
      ) AS exists
    `);

    const schemaInitialized = schemaCheck.rows[0]?.exists === true;

    if (!schemaInitialized) {
      const schemaPath = path.join(process.cwd(), 'lib', 'db', 'schema.postgres.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schema);
      logger.info('✅ PostgreSQL schema applied');
    } else {
      logger.info('📊 PostgreSQL schema already initialized (users table found)');
    }

    await client.query(`
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
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active) WHERE is_active = TRUE`);

    await client.query(`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS sla_policy_id BIGINT
    `);
    logger.info('✅ Ensured tickets.sla_policy_id exists (PostgreSQL)');

    await ensurePostgreSQLTenantCompatibility(client);
    logger.info('✅ Ensured tenant/organization compatibility structures (PostgreSQL)');

    await ensurePostgreSQLFileStorageCompatibility(client);
    logger.info('✅ Ensured file_storage compatibility table/columns (PostgreSQL)');

    await client.query(`
      INSERT INTO organizations (id, name, slug, subscription_plan, subscription_status, is_active)
      VALUES (1, 'Empresa Demo', 'empresa-demo', 'basic', 'active', TRUE)
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO categories (id, name, description, color)
      VALUES
        (1, 'Técnico', 'Problemas técnicos', '#3B82F6'),
        (2, 'Administrativo', 'Solicitações administrativas', '#10B981'),
        (3, 'Infraestrutura', 'Infraestrutura e rede', '#F59E0B')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO priorities (id, name, level, color)
      VALUES
        (1, 'Baixa', 1, '#10B981'),
        (2, 'Média', 2, '#3B82F6'),
        (3, 'Alta', 3, '#F59E0B'),
        (4, 'Crítica', 4, '#EF4444')
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO statuses (id, name, description, color, is_final)
      VALUES
        (1, 'Aberto', 'Ticket aberto', '#3B82F6', FALSE),
        (2, 'Em Andamento', 'Ticket em atendimento', '#F59E0B', FALSE),
        (3, 'Resolvido', 'Ticket resolvido', '#10B981', TRUE),
        (4, 'Fechado', 'Ticket fechado', '#6B7280', TRUE)
      ON CONFLICT (id) DO NOTHING
    `);

    logger.info('✅ PostgreSQL base seed applied');
    logger.info('\n✅ PostgreSQL setup completed successfully!');
  } catch (error) {
    logger.error('❌ Error during PostgreSQL initialization', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function main() {
  const dbType = getDatabaseType();
  logger.info(`Database type detected: ${dbType}`);

  if (dbType === 'postgresql') {
    await initPostgreSQL();
    return;
  }

  await initSQLite();
}

main().catch((error) => {
  logger.error('❌ Error during database initialization', error);
  process.exit(1);
});
