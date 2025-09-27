const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database path
const dbPath = path.join(process.cwd(), 'data', 'servicedesk.db');

// Ensure data directory exists
const { mkdirSync } = require('fs');
try {
  mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (error) {
  // Directory already exists or permission error
}

// Connect to database
const db = new Database(dbPath, {
  verbose: console.log
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Run migrations in order
const migrations = [
  '001-add-multi-tenant.sql',
  '002-add-missing-tables.sql'
];

for (const migrationFile of migrations) {
  console.log(`\n=== Running migration ${migrationFile} ===`);

  const migrationPath = path.join(__dirname, '..', 'lib', 'db', 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.log(`Migration file ${migrationFile} not found, skipping...`);
    continue;
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  try {
    // For multi-tenant migration, execute as a single block due to transaction
    if (migrationFile === '001-add-multi-tenant.sql') {
      console.log('Executing multi-tenant migration as single transaction...');
      db.exec(migrationSQL);
    } else {
      // Split by semicolons and execute each statement for other migrations
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());

      for (const statement of statements) {
        const trimmedStatement = statement.trim();
        if (trimmedStatement) {
          console.log(`Executing: ${trimmedStatement.substring(0, 50)}...`);
          try {
            db.exec(trimmedStatement);
          } catch (error) {
            // Skip if table/column already exists
            if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
              console.log('Already exists, skipping...');
              continue;
            }
            throw error;
          }
        }
      }
    }

    console.log(`Migration ${migrationFile} completed successfully!`);
  } catch (error) {
    console.error(`Migration ${migrationFile} failed:`, error);
    process.exit(1);
  }
}

console.log('\n=== All migrations completed successfully! ===');
db.close();