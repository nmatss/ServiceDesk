const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '../../data/servicedesk.db')
const MIGRATION_PATH = path.join(__dirname, 'migrations/002-add-missing-tables.sql')

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Initialize database
const db = new Database(DB_PATH)

// Enable foreign keys
db.pragma('foreign_keys = ON')

console.log('🔄 Starting database migration...')

try {
  // Check if migration file exists
  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error('❌ Migration file not found:', MIGRATION_PATH)
    process.exit(1)
  }

  // Read migration SQL
  const migrationSQL = fs.readFileSync(MIGRATION_PATH, 'utf8')

  // Split by semicolon and filter out empty statements
  const statements = migrationSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0)

  console.log(`📝 Found ${statements.length} SQL statements to execute`)

  // Execute migration in transaction
  const transaction = db.transaction(() => {
    let executedCount = 0

    for (const statement of statements) {
      try {
        db.exec(statement)
        executedCount++
        console.log(`✅ Executed statement ${executedCount}/${statements.length}`)
      } catch (error) {
        // Skip if table/column already exists
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate column name')) {
          console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`)
          executedCount++
        } else {
          console.error(`❌ Error executing statement: ${statement.substring(0, 100)}...`)
          throw error
        }
      }
    }

    return executedCount
  })

  const executedCount = transaction()

  console.log(`✅ Migration completed successfully! Executed ${executedCount} statements.`)

  // Test database connection
  console.log('🔍 Testing database connection...')
  const testQuery = db.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type = "table"')
  const result = testQuery.get()
  console.log(`📊 Database contains ${result.count} tables`)

  // List all tables
  const tablesQuery = db.prepare('SELECT name FROM sqlite_master WHERE type = "table" ORDER BY name')
  const tables = tablesQuery.all()
  console.log('📋 Available tables:')
  tables.forEach(table => {
    console.log(`   - ${table.name}`)
  })

} catch (error) {
  console.error('❌ Migration failed:', error.message)
  process.exit(1)
} finally {
  db.close()
  console.log('🔒 Database connection closed')
}