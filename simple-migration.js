const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, 'data/servicedesk.db')
const db = new Database(DB_PATH)

console.log('🔄 Running simple migration...')

try {
  // Just create the essential tables that are missing

  // Email queue table for email system
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      cc_emails TEXT,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      template_type TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      scheduled_at DATETIME,
      sent_at DATETIME,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ Email queue table created/verified')

  // File storage table for uploads
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
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ File storage table created/verified')

  // Knowledge articles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      category TEXT DEFAULT 'Geral',
      tags TEXT,
      status TEXT DEFAULT 'published',
      author_id INTEGER NOT NULL DEFAULT 1,
      view_count INTEGER DEFAULT 0,
      slug TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  console.log('✅ Knowledge articles table created/verified')

  // Insert sample knowledge article if none exist
  const existingArticles = db.prepare("SELECT COUNT(*) as count FROM knowledge_articles").get()
  if (existingArticles.count === 0) {
    db.exec(`
      INSERT INTO knowledge_articles (title, content, excerpt, category, slug)
      VALUES (
        'Como usar o ServiceDesk Pro',
        'O ServiceDesk Pro é uma plataforma completa para gestão de tickets e atendimento ao cliente...',
        'Guia básico para utilizar o ServiceDesk Pro',
        'Tutorial',
        'como-usar-servicedesk-pro'
      )
    `)
    console.log('✅ Sample knowledge article created')
  }

  // Check final table count
  const result = db.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type = "table"').get()
  console.log(`📊 Database contains ${result.count} tables`)

  // List all tables
  const tables = db.prepare('SELECT name FROM sqlite_master WHERE type = "table" ORDER BY name').all()
  console.log('📋 Available tables:')
  tables.forEach(table => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get()
    console.log(`   - ${table.name} (${count.count} records)`)
  })

  console.log('✅ Simple migration completed successfully!')

} catch (error) {
  console.error('❌ Migration failed:', error.message)
} finally {
  db.close()
  console.log('🔒 Database connection closed')
}