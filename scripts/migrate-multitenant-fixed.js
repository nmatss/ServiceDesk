#!/usr/bin/env node

const Database = require('better-sqlite3')
const path = require('path')

// Path to the database
const dbPath = path.join(__dirname, '..', 'servicedesk.db')

console.log('🚀 Starting Fixed Multi-Tenant Migration...')
console.log(`Database: ${dbPath}`)

try {
  const db = new Database(dbPath)
  db.pragma('foreign_keys = OFF') // Disable foreign keys during migration

  console.log('📊 Database connected successfully')

  // Step 1: Create core tenant tables
  console.log('\n📋 Step 1: Creating core tenant tables...')

  // Create tenants table
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
      subscription_plan TEXT NOT NULL DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'professional', 'enterprise')),
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
  `)
  console.log('✅ Tenants table created')

  // Create ticket_types table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'ExclamationTriangleIcon',
      color TEXT DEFAULT '#EF4444',
      workflow_type TEXT NOT NULL CHECK (workflow_type IN ('incident', 'request', 'change', 'problem')),
      sla_required BOOLEAN DEFAULT TRUE,
      approval_required BOOLEAN DEFAULT FALSE,
      escalation_enabled BOOLEAN DEFAULT TRUE,
      auto_assignment_enabled BOOLEAN DEFAULT FALSE,
      customer_visible BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, slug)
    )
  `)
  console.log('✅ Ticket types table created')

  // Create teams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      team_type TEXT NOT NULL CHECK (team_type IN ('technical', 'business', 'support', 'management')),
      specializations TEXT,
      capabilities TEXT,
      icon TEXT DEFAULT 'UsersIcon',
      color TEXT DEFAULT '#3B82F6',
      manager_id INTEGER,
      parent_team_id INTEGER,
      escalation_team_id INTEGER,
      business_hours TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      sla_response_time INTEGER,
      max_concurrent_tickets INTEGER DEFAULT 50,
      auto_assignment_enabled BOOLEAN DEFAULT FALSE,
      assignment_algorithm TEXT DEFAULT 'round_robin' CHECK (assignment_algorithm IN ('round_robin', 'least_loaded', 'skill_based')),
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, slug)
    )
  `)
  console.log('✅ Teams table created')

  // Create team_members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'lead', 'senior', 'member', 'trainee')),
      specializations TEXT,
      availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'away', 'off_duty')),
      workload_percentage INTEGER DEFAULT 100,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      left_at DATETIME,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(team_id, user_id)
    )
  `)
  console.log('✅ Team members table created')

  // Step 2: Add tenant_id columns to existing tables (only if not exists)
  console.log('\n📋 Step 2: Adding tenant_id columns...')

  const columnsToAdd = [
    { table: 'users', column: 'tenant_id', type: 'INTEGER' },
    { table: 'categories', column: 'tenant_id', type: 'INTEGER' },
    { table: 'priorities', column: 'tenant_id', type: 'INTEGER' },
    { table: 'statuses', column: 'tenant_id', type: 'INTEGER' },
    { table: 'tickets', column: 'tenant_id', type: 'INTEGER' },
    { table: 'tickets', column: 'ticket_type_id', type: 'INTEGER' },
    { table: 'tickets', column: 'assigned_team_id', type: 'INTEGER' },
    { table: 'tickets', column: 'ticket_number', type: 'TEXT' },
    { table: 'comments', column: 'tenant_id', type: 'INTEGER' },
    { table: 'attachments', column: 'tenant_id', type: 'INTEGER' },
    { table: 'notifications', column: 'tenant_id', type: 'INTEGER' },
    { table: 'sla_policies', column: 'tenant_id', type: 'INTEGER' },
    { table: 'sla_tracking', column: 'tenant_id', type: 'INTEGER' },
    { table: 'audit_logs', column: 'tenant_id', type: 'INTEGER' },
  ]

  for (const { table, column, type } of columnsToAdd) {
    try {
      // Check if column exists
      const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all()
      const columnExists = tableInfo.some(col => col.name === column)

      if (!columnExists) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
        console.log(`✅ Added ${column} to ${table}`)
      } else {
        console.log(`⚠️  Column ${column} already exists in ${table}`)
      }
    } catch (error) {
      console.log(`❌ Failed to add ${column} to ${table}:`, error.message)
    }
  }

  // Step 3: Insert default tenant
  console.log('\n📋 Step 3: Creating default tenant...')

  const existingTenant = db.prepare('SELECT id FROM tenants WHERE id = 1').get()
  if (!existingTenant) {
    const insertTenant = db.prepare(`
      INSERT INTO tenants (
        name, slug, subdomain, subscription_plan, max_users, max_tickets_per_month,
        features, billing_email, technical_contact_email, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertTenant.run(
      'Empresa Demo',
      'empresa-demo',
      'demo',
      'enterprise',
      500,
      10000,
      JSON.stringify(['incidents', 'requests', 'knowledge_base', 'analytics', 'automations', 'teams', 'sla', 'approvals']),
      'admin@empresa-demo.com',
      'suporte@empresa-demo.com',
      1
    )
    console.log('✅ Default tenant created')
  } else {
    console.log('⚠️  Default tenant already exists')
  }

  // Step 4: Create default ticket types
  console.log('\n📋 Step 4: Creating default ticket types...')

  const existingTicketTypes = db.prepare('SELECT COUNT(*) as count FROM ticket_types WHERE tenant_id = 1').get()
  if (existingTicketTypes.count === 0) {
    const ticketTypes = [
      ['Incidente', 'incident', 'Problemas que afetam serviços em produção', 'ExclamationTriangleIcon', '#EF4444', 'incident', 1, 1, 1],
      ['Requisição de Serviço', 'service-request', 'Solicitações de novos serviços ou recursos', 'PlusCircleIcon', '#10B981', 'request', 1, 1, 2],
      ['Requisição de Mudança', 'change-request', 'Solicitações de mudanças em sistemas', 'ArrowPathIcon', '#F59E0B', 'change', 1, 0, 3],
      ['Problema', 'problem', 'Investigação de causa raiz de incidentes recorrentes', 'MagnifyingGlassIcon', '#8B5CF6', 'problem', 0, 0, 4]
    ]

    const insertTicketType = db.prepare(`
      INSERT INTO ticket_types (
        tenant_id, name, slug, description, icon, color, workflow_type,
        sla_required, customer_visible, sort_order
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const type of ticketTypes) {
      insertTicketType.run(...type)
    }
    console.log('✅ Default ticket types created')
  } else {
    console.log('⚠️  Default ticket types already exist')
  }

  // Step 5: Create default teams
  console.log('\n📋 Step 5: Creating default teams...')

  const existingTeams = db.prepare('SELECT COUNT(*) as count FROM teams WHERE tenant_id = 1').get()
  if (existingTeams.count === 0) {
    const teams = [
      ['Infraestrutura', 'infrastructure', 'Equipe responsável por servidores, redes e infraestrutura', 'technical',
       JSON.stringify(['servers', 'networking', 'storage', 'virtualization', 'cloud']),
       JSON.stringify(['incident_response', 'monitoring', 'capacity_planning', 'disaster_recovery']),
       'ServerIcon', '#3B82F6', 30],
      ['Desenvolvimento', 'development', 'Equipe de desenvolvimento de software', 'technical',
       JSON.stringify(['web_development', 'mobile_development', 'apis', 'databases', 'devops']),
       JSON.stringify(['bug_fixes', 'feature_development', 'code_review', 'deployment']),
       'CodeBracketIcon', '#10B981', 60],
      ['Suporte Técnico', 'technical-support', 'Equipe de suporte técnico aos usuários', 'support',
       JSON.stringify(['user_support', 'troubleshooting', 'training', 'documentation']),
       JSON.stringify(['incident_resolution', 'user_assistance', 'knowledge_base', 'training']),
       'UserGroupIcon', '#F59E0B', 15],
      ['Segurança', 'security', 'Equipe de segurança da informação', 'technical',
       JSON.stringify(['cybersecurity', 'compliance', 'risk_assessment', 'incident_response']),
       JSON.stringify(['security_monitoring', 'threat_analysis', 'policy_enforcement', 'audit']),
       'ShieldCheckIcon', '#EF4444', 15]
    ]

    const insertTeam = db.prepare(`
      INSERT INTO teams (
        tenant_id, name, slug, description, team_type, specializations,
        capabilities, icon, color, sla_response_time
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const team of teams) {
      insertTeam.run(...team)
    }
    console.log('✅ Default teams created')
  } else {
    console.log('⚠️  Default teams already exist')
  }

  // Step 6: Update existing data to assign to default tenant
  console.log('\n📋 Step 6: Assigning existing data to default tenant...')

  const updates = [
    'UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE categories SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE priorities SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE statuses SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE tickets SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE tickets SET ticket_type_id = 1 WHERE ticket_type_id IS NULL',
    'UPDATE comments SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE attachments SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE notifications SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE sla_policies SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE sla_tracking SET tenant_id = 1 WHERE tenant_id IS NULL',
    'UPDATE audit_logs SET tenant_id = 1 WHERE tenant_id IS NULL'
  ]

  for (const update of updates) {
    try {
      const result = db.exec(update)
      console.log(`✅ Updated table: ${update.split(' ')[1]}`)
    } catch (error) {
      console.log(`⚠️  Skipped update (probably no data): ${update.split(' ')[1]}`)
    }
  }

  // Step 7: Generate ticket numbers for existing tickets
  console.log('\n📋 Step 7: Generating ticket numbers...')

  try {
    db.exec(`
      UPDATE tickets
      SET ticket_number = 'INC-' || strftime('%Y', created_at) || '-' || printf('%06d', id)
      WHERE ticket_number IS NULL
    `)
    console.log('✅ Ticket numbers generated')
  } catch (error) {
    console.log('⚠️  Ticket number generation skipped:', error.message)
  }

  // Step 8: Create indexes
  console.log('\n📋 Step 8: Creating indexes...')

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)',
    'CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_ticket_types_tenant ON ticket_types(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_tenant_number ON tickets(tenant_id, ticket_number)'
  ]

  for (const index of indexes) {
    try {
      db.exec(index)
    } catch (error) {
      // Ignore if index already exists
    }
  }
  console.log('✅ Indexes created')

  // Verification
  console.log('\n🔍 Verifying migration...')

  const tenantCount = db.prepare('SELECT COUNT(*) as count FROM tenants').get()
  console.log(`✅ Tenants: ${tenantCount.count}`)

  const teamCount = db.prepare('SELECT COUNT(*) as count FROM teams WHERE tenant_id = 1').get()
  console.log(`✅ Teams: ${teamCount.count}`)

  const ticketTypeCount = db.prepare('SELECT COUNT(*) as count FROM ticket_types WHERE tenant_id = 1').get()
  console.log(`✅ Ticket Types: ${ticketTypeCount.count}`)

  const usersWithTenant = db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id = 1').get()
  console.log(`✅ Users assigned to tenant: ${usersWithTenant.count}`)

  const ticketsWithTenant = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE tenant_id = 1').get()
  console.log(`✅ Tickets assigned to tenant: ${ticketsWithTenant.count}`)

  db.pragma('foreign_keys = ON') // Re-enable foreign keys
  db.close()

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
}