import Database from 'better-sqlite3'

const db = new Database('./servicedesk.db')

console.log('\n=== CHECKING NOTIFICATION TABLES ===\n')

const tables = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND (
    name LIKE '%notification%' OR
    name LIKE '%escalation%' OR
    name LIKE '%filter%' OR
    name LIKE '%batch%'
  )
  ORDER BY name
`).all() as { name: string }[]

console.log('Found tables:')
tables.forEach(t => console.log(`  ✓ ${t.name}`))

console.log('\n=== CHECKING SPECIFIC TABLES ===\n')

const requiredTables = [
  'notification_batches',
  'batch_configurations',
  'filter_rules',
  'escalation_rules',
  'escalation_instances'
]

requiredTables.forEach(tableName => {
  const exists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name = ?
  `).get(tableName)

  if (exists) {
    console.log(`✅ ${tableName} - EXISTS`)
  } else {
    console.log(`❌ ${tableName} - MISSING`)
  }
})

console.log('\n')
db.close()
