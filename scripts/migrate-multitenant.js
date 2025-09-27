#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

// Path to the database
const dbPath = path.join(__dirname, '..', 'servicedesk.db')
const migrationPath = path.join(__dirname, '..', 'lib', 'db', 'migrations', '001-add-multi-tenant.sql')

console.log('🚀 Starting Multi-Tenant Migration...')
console.log(`Database: ${dbPath}`)
console.log(`Migration: ${migrationPath}`)

try {
  // Check if migration file exists
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath)
    process.exit(1)
  }

  // Read migration SQL
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
  console.log('📖 Migration file loaded successfully')

  // Connect to database
  const db = new Database(dbPath)

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  console.log('📊 Database connected successfully')

  // Check current state
  console.log('\n🔍 Checking current database state...')

  try {
    const tenantTableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='tenants'
    `).get()

    if (tenantTableExists) {
      console.log('⚠️  Multi-tenant tables already exist. Checking if migration is needed...')

      const tenantCount = db.prepare('SELECT COUNT(*) as count FROM tenants').get()
      console.log(`📊 Current tenant count: ${tenantCount.count}`)

      if (tenantCount.count > 0) {
        console.log('✅ Multi-tenant structure already exists and has data')
        console.log('🏁 Migration completed (no changes needed)')
        process.exit(0)
      }
    }
  } catch (error) {
    console.log('📝 Multi-tenant tables do not exist yet, proceeding with migration...')
  }

  // Execute migration
  console.log('\n🛠️  Executing migration...')

  // Split migration into individual statements
  const statements = migrationSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

  console.log(`📋 Found ${statements.length} SQL statements to execute`)

  // Execute each statement
  let executedStatements = 0

  for (const statement of statements) {
    try {
      if (statement.trim()) {
        db.exec(statement + ';')
        executedStatements++

        // Log progress every 10 statements
        if (executedStatements % 10 === 0) {
          console.log(`⏳ Executed ${executedStatements}/${statements.length} statements...`)
        }
      }
    } catch (error) {
      // Ignore some expected errors for existing columns/tables
      if (
        error.message.includes('duplicate column name') ||
        error.message.includes('table') && error.message.includes('already exists') ||
        error.message.includes('index') && error.message.includes('already exists')
      ) {
        console.log(`⚠️  Skipping: ${error.message}`)
        continue
      }

      console.error('❌ Error executing statement:', statement.substring(0, 100) + '...')
      console.error('Error:', error.message)
      throw error
    }
  }

  console.log(`✅ Successfully executed ${executedStatements} statements`)

  // Verify migration success
  console.log('\n🔍 Verifying migration...')

  try {
    // Check if tenant table exists and has data
    const tenantsExist = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='tenants'
    `).get()

    if (!tenantsExist) {
      throw new Error('Tenants table was not created')
    }

    const tenantCount = db.prepare('SELECT COUNT(*) as count FROM tenants').get()
    console.log(`✅ Tenants table exists with ${tenantCount.count} records`)

    // Check if teams table exists
    const teamsExist = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='teams'
    `).get()

    if (!teamsExist) {
      throw new Error('Teams table was not created')
    }

    const teamCount = db.prepare('SELECT COUNT(*) as count FROM teams').get()
    console.log(`✅ Teams table exists with ${teamCount.count} records`)

    // Check if ticket_types table exists
    const ticketTypesExist = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='ticket_types'
    `).get()

    if (!ticketTypesExist) {
      throw new Error('Ticket types table was not created')
    }

    const ticketTypeCount = db.prepare('SELECT COUNT(*) as count FROM ticket_types').get()
    console.log(`✅ Ticket types table exists with ${ticketTypeCount.count} records`)

    // Check if existing tables have tenant_id
    const usersTableInfo = db.prepare("PRAGMA table_info(users)").all()
    const hasTenantId = usersTableInfo.some(col => col.name === 'tenant_id')

    if (!hasTenantId) {
      throw new Error('Users table does not have tenant_id column')
    }

    console.log('✅ Existing tables updated with tenant_id columns')

    // Check if data was migrated
    const usersWithTenant = db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id IS NOT NULL').get()
    console.log(`✅ ${usersWithTenant.count} users assigned to tenants`)

    const ticketsWithTenant = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE tenant_id IS NOT NULL').get()
    console.log(`✅ ${ticketsWithTenant.count} tickets assigned to tenants`)

  } catch (error) {
    console.error('❌ Migration verification failed:', error.message)
    throw error
  }

  // Show summary
  console.log('\n📊 Migration Summary:')

  const defaultTenant = db.prepare('SELECT * FROM tenants WHERE id = 1').get()
  if (defaultTenant) {
    console.log(`✅ Default tenant created: "${defaultTenant.name}" (${defaultTenant.slug})`)
  }

  const teams = db.prepare('SELECT COUNT(*) as count FROM teams WHERE tenant_id = 1').get()
  console.log(`✅ ${teams.count} default teams created`)

  const ticketTypes = db.prepare('SELECT COUNT(*) as count FROM ticket_types WHERE tenant_id = 1').get()
  console.log(`✅ ${ticketTypes.count} default ticket types created`)

  console.log('\n🎉 Multi-Tenant Migration completed successfully!')
  console.log('🏗️  Your ServiceDesk now supports:')
  console.log('   • Multiple tenants/companies')
  console.log('   • Team/department management')
  console.log('   • Incident vs Request separation')
  console.log('   • Tenant-isolated data')
  console.log('\n🚀 You can now start using the multi-tenant features!')

} catch (error) {
  console.error('\n❌ Migration failed:', error.message)
  console.error('Stack trace:', error.stack)
  process.exit(1)
} finally {
  // Close database connection
  try {
    if (db) {
      db.close()
      console.log('🔌 Database connection closed')
    }
  } catch (error) {
    console.error('Error closing database:', error.message)
  }
}