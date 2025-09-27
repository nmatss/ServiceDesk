const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, 'data/servicedesk.db')
const db = new Database(DB_PATH)

console.log('🔄 Fixing database schema...')

try {
  // Create tables without tenant references first

  // Knowledge articles without tenant_id
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      slug TEXT UNIQUE,
      meta_title TEXT,
      meta_description TEXT,
      featured BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Knowledge feedback without tenant_id
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      helpful BOOLEAN NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(article_id, user_id)
    )
  `)

  // File storage table
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_storage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      uploaded_by INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  // Email templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT,
      template_type TEXT NOT NULL,
      variables TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Email queue table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      cc_emails TEXT,
      bcc_emails TEXT,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT,
      template_type TEXT,
      template_data TEXT,
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      scheduled_at DATETIME,
      sent_at DATETIME,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Audit logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      user_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  // Business hours table
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_working_day BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // SLA policies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sla_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      priority_level INTEGER NOT NULL,
      response_time_hours INTEGER NOT NULL,
      resolution_time_hours INTEGER NOT NULL,
      escalation_time_hours INTEGER,
      business_hours_only BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Check if tickets table exists and add missing columns
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'").all()

  if (tables.length > 0) {
    console.log('✅ Tickets table exists, adding missing columns...')

    // Get existing columns
    const columns = db.prepare("PRAGMA table_info(tickets)").all()
    const columnNames = columns.map(col => col.name)

    const columnsToAdd = [
      'sla_policy_id INTEGER',
      'response_due_at DATETIME',
      'resolution_due_at DATETIME',
      'first_response_at DATETIME',
      'response_breached BOOLEAN DEFAULT FALSE',
      'resolution_breached BOOLEAN DEFAULT FALSE',
      'escalated_at DATETIME',
      'escalation_level INTEGER DEFAULT 0'
    ]

    for (const column of columnsToAdd) {
      const columnName = column.split(' ')[0]
      if (!columnNames.includes(columnName)) {
        try {
          db.exec(`ALTER TABLE tickets ADD COLUMN ${column}`)
          console.log(`✅ Added column: ${columnName}`)
        } catch (error) {
          if (!error.message.includes('duplicate column name')) {
            console.error(`❌ Error adding column ${columnName}:`, error.message)
          }
        }
      } else {
        console.log(`⚠️  Column ${columnName} already exists`)
      }
    }
  }

  // Insert default data
  console.log('🔄 Inserting default data...')

  // Insert default business hours
  const existingBusinessHours = db.prepare("SELECT COUNT(*) as count FROM business_hours").get()
  if (existingBusinessHours.count === 0) {
    const businessHoursStmt = db.prepare(`
      INSERT INTO business_hours (day_of_week, start_time, end_time, is_working_day)
      VALUES (?, ?, ?, ?)
    `)

    // Monday to Friday
    for (let day = 1; day <= 5; day++) {
      businessHoursStmt.run(day, '08:00', '18:00', true)
    }

    // Weekend
    businessHoursStmt.run(0, '00:00', '00:00', false) // Sunday
    businessHoursStmt.run(6, '00:00', '00:00', false) // Saturday

    console.log('✅ Default business hours created')
  }

  // Insert default SLA policies
  const existingSLA = db.prepare("SELECT COUNT(*) as count FROM sla_policies").get()
  if (existingSLA.count === 0) {
    const slaStmt = db.prepare(`
      INSERT INTO sla_policies (name, description, priority_level, response_time_hours, resolution_time_hours, escalation_time_hours)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    slaStmt.run('Crítica', 'Para incidentes críticos que afetam produção', 1, 1, 4, 2)
    slaStmt.run('Alta', 'Para problemas urgentes', 2, 2, 8, 4)
    slaStmt.run('Média', 'Para problemas padrão', 3, 4, 24, 12)
    slaStmt.run('Baixa', 'Para problemas menores', 4, 8, 72, 24)

    console.log('✅ Default SLA policies created')
  }

  // Insert default email templates
  const existingTemplates = db.prepare("SELECT COUNT(*) as count FROM email_templates").get()
  if (existingTemplates.count === 0) {
    const templateStmt = db.prepare(`
      INSERT INTO email_templates (name, subject, body_html, body_text, template_type, variables)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    templateStmt.run(
      'ticket_created',
      'Ticket #{{ticketNumber}} - {{title}}',
      '<h2>Seu ticket foi criado</h2><p>Olá {{customerName}},</p><p>Seu ticket #{{ticketNumber}} foi criado com sucesso.</p><p><strong>Título:</strong> {{title}}</p><p><strong>Descrição:</strong> {{description}}</p><p>Você pode acompanhar o progresso em: <a href="{{ticketUrl}}">{{ticketUrl}}</a></p>',
      'Seu ticket #{{ticketNumber}} foi criado com sucesso.',
      'ticket_created',
      '["ticketNumber", "title", "description", "customerName", "ticketUrl"]'
    )

    templateStmt.run(
      'ticket_updated',
      'Ticket #{{ticketNumber}} - Atualização',
      '<h2>Seu ticket foi atualizado</h2><p>Olá {{customerName}},</p><p>Seu ticket #{{ticketNumber}} foi atualizado.</p><p><strong>Status:</strong> {{status}}</p><p>Acesse: <a href="{{ticketUrl}}">{{ticketUrl}}</a></p>',
      'Seu ticket #{{ticketNumber}} foi atualizado.',
      'ticket_updated',
      '["ticketNumber", "status", "customerName", "ticketUrl"]'
    )

    console.log('✅ Default email templates created')
  }

  console.log('✅ Database schema fixed successfully!')

  // Show final table count
  const finalResult = db.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type = "table"').get()
  console.log(`📊 Database now contains ${finalResult.count} tables`)

} catch (error) {
  console.error('❌ Error fixing database:', error.message)
} finally {
  db.close()
  console.log('🔒 Database connection closed')
}