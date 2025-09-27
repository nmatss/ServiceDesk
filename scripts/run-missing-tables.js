const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database path
const dbPath = path.join(process.cwd(), 'data', 'servicedesk.db');

// Connect to database
const db = new Database(dbPath, {
  verbose: console.log
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('Running only the missing tables from 002-add-missing-tables.sql...');

try {
  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'lib', 'db', 'migrations', '002-add-missing-tables.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  // Extract only the CREATE TABLE statements that we need
  const statements = [
    // Knowledge base tables
    `CREATE TABLE IF NOT EXISTS knowledge_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      category TEXT DEFAULT 'Geral',
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      author_id INTEGER NOT NULL,
      view_count INTEGER DEFAULT 0,
      helpful_count INTEGER DEFAULT 0,
      not_helpful_count INTEGER DEFAULT 0,
      slug TEXT,
      meta_title TEXT,
      meta_description TEXT,
      featured BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS knowledge_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      article_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      helpful BOOLEAN NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(article_id, user_id, tenant_id)
    )`,

    // File storage table
    `CREATE TABLE IF NOT EXISTS file_storage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      storage_type TEXT DEFAULT 'local' CHECK (storage_type IN ('local', 's3', 'cloudinary')),
      uploaded_by INTEGER NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      is_public BOOLEAN DEFAULT FALSE,
      virus_scanned BOOLEAN DEFAULT FALSE,
      virus_scan_result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // Email templates table
    `CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      subject TEXT NOT NULL,
      html_content TEXT NOT NULL,
      text_content TEXT,
      template_type TEXT NOT NULL CHECK (template_type IN ('notification', 'welcome', 'reset_password', 'ticket_created', 'ticket_updated', 'ticket_resolved', 'sla_breach')),
      variables TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE(tenant_id, slug)
    )`,

    // Business hours table
    `CREATE TABLE IF NOT EXISTS business_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      monday_start TIME,
      monday_end TIME,
      tuesday_start TIME,
      tuesday_end TIME,
      wednesday_start TIME,
      wednesday_end TIME,
      thursday_start TIME,
      thursday_end TIME,
      friday_start TIME,
      friday_end TIME,
      saturday_start TIME,
      saturday_end TIME,
      sunday_start TIME,
      sunday_end TIME,
      is_default BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )`,

    // Holidays table
    `CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      date DATE NOT NULL,
      is_recurring BOOLEAN DEFAULT FALSE,
      business_hours_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (business_hours_id) REFERENCES business_hours(id) ON DELETE CASCADE
    )`,

    // Scheduled reports table
    `CREATE TABLE IF NOT EXISTS scheduled_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK (report_type IN ('tickets', 'sla', 'performance', 'analytics')),
      frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
      format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'excel')),
      recipients TEXT NOT NULL,
      parameters TEXT,
      next_run_at DATETIME,
      last_run_at DATETIME,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // User sessions table
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ];

  // SLA columns for tickets table
  const slaColumns = [
    'ALTER TABLE tickets ADD COLUMN sla_policy_id INTEGER',
    'ALTER TABLE tickets ADD COLUMN response_due_at DATETIME',
    'ALTER TABLE tickets ADD COLUMN resolution_due_at DATETIME',
    'ALTER TABLE tickets ADD COLUMN first_response_at DATETIME',
    'ALTER TABLE tickets ADD COLUMN response_breached BOOLEAN DEFAULT FALSE',
    'ALTER TABLE tickets ADD COLUMN resolution_breached BOOLEAN DEFAULT FALSE',
    'ALTER TABLE tickets ADD COLUMN escalated_at DATETIME',
    'ALTER TABLE tickets ADD COLUMN escalation_level INTEGER DEFAULT 0'
  ];

  // Execute CREATE TABLE statements
  for (const statement of statements) {
    console.log(`Creating table...`);
    try {
      db.exec(statement);
      console.log('✓ Table created successfully');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ Table already exists, skipping...');
      } else {
        throw error;
      }
    }
  }

  // Execute ALTER TABLE statements for SLA columns
  for (const statement of slaColumns) {
    console.log(`Adding SLA column...`);
    try {
      db.exec(statement);
      console.log('✓ Column added successfully');
    } catch (error) {
      if (error.message.includes('duplicate column')) {
        console.log('✓ Column already exists, skipping...');
      } else {
        throw error;
      }
    }
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tenant ON knowledge_articles(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON knowledge_articles(tenant_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_knowledge_articles_author ON knowledge_articles(tenant_id, author_id)',
    'CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_article ON knowledge_feedback(article_id)',
    'CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_user ON knowledge_feedback(tenant_id, user_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_storage_tenant ON file_storage(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_storage_entity ON file_storage(entity_type, entity_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_storage_uploaded_by ON file_storage(uploaded_by)',
    'CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(tenant_id, template_type)',
    'CREATE INDEX IF NOT EXISTS idx_business_hours_tenant ON business_hours(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_holidays_tenant ON holidays(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(tenant_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant ON scheduled_reports(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = TRUE',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(tenant_id, user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_sla_policy ON tickets(sla_policy_id)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_response_due ON tickets(response_due_at) WHERE response_breached = FALSE',
    'CREATE INDEX IF NOT EXISTS idx_tickets_resolution_due ON tickets(resolution_due_at) WHERE resolution_breached = FALSE',
    'CREATE INDEX IF NOT EXISTS idx_tickets_breached ON tickets(tenant_id) WHERE response_breached = TRUE OR resolution_breached = TRUE'
  ];

  console.log('\nCreating indexes...');
  for (const indexSQL of indexes) {
    try {
      db.exec(indexSQL);
      console.log('✓ Index created');
    } catch (error) {
      console.log('✗ Index failed:', error.message);
    }
  }

  console.log('\n✅ Missing tables migration completed successfully!');

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}