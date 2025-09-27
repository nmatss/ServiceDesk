const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, 'data/servicedesk.db')
const db = new Database(DB_PATH)

console.log('🔄 Running final migration...')

try {
  // Create essential tables that might be missing

  console.log('Creating email_queue table...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  console.log('Creating file_storage table...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_storage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  console.log('Creating knowledge_articles table...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'Geral',
      status TEXT DEFAULT 'published',
      author_id INTEGER DEFAULT 1,
      view_count INTEGER DEFAULT 0,
      slug TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Check final status
  const result = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table'").get()
  console.log(`✅ Database contains ${result.count} tables`)

  console.log('✅ Final migration completed successfully!')

} catch (error) {
  console.error('❌ Migration failed:', error.message)
  console.error(error.stack)
} finally {
  db.close()
  console.log('🔒 Database connection closed')
}