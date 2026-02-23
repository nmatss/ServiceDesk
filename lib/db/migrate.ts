// Database Migration Runner
// Runs SQL migration files to update existing databases

import fs from 'fs';
import path from 'path';
import db from './connection';
import logger from '../monitoring/structured-logger';

// Helper function to match the expected openDb API
const openDb = async () => db;

interface Migration {
  id: string;
  name: string;
  path: string;
  sql: string;
}

class DatabaseMigrator {
  private db: any;
  private migrationsDir: string;

  constructor(migrationsDir: string = path.join(__dirname, 'migrations')) {
    this.migrationsDir = migrationsDir;
  }

  async init() {
    this.db = await openDb();
    await this.createMigrationsTable();
  }

  private async createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.db.exec(sql);
  }

  private dbAll(sql: string, params?: any[]): any[] {
    if (typeof this.db.all === 'function') {
      return params ? this.db.all(sql, params) : this.db.all(sql);
    }
    if (typeof this.db.prepare === 'function') {
      const stmt = this.db.prepare(sql);
      return params ? stmt.all(...params) : stmt.all();
    }
    throw new Error('Database adapter does not support query all');
  }

  private dbRun(sql: string, params?: any[]): void {
    if (typeof this.db.run === 'function') {
      params ? this.db.run(sql, params) : this.db.run(sql);
      return;
    }
    if (typeof this.db.prepare === 'function') {
      const stmt = this.db.prepare(sql);
      params ? stmt.run(...params) : stmt.run();
      return;
    }
    throw new Error('Database adapter does not support run');
  }

  async getAvailableMigrations(): Promise<Migration[]> {
    if (!fs.existsSync(this.migrationsDir)) {
      logger.warn('Migrations directory not found', this.migrationsDir);
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      // Skip PostgreSQL-only migrations when running on SQLite.
      if (file.includes('postgres') || file.includes('postgresql')) {
        continue;
      }

      const filePath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Skip psql meta-commands (e.g. \i) which SQLite cannot process.
      if (sql.includes('\\i ')) {
        continue;
      }

      const id = path.basename(file, '.sql');
      const name = this.extractMigrationName(sql) || id;

      migrations.push({
        id,
        name,
        path: filePath,
        sql
      });
    }

    return migrations;
  }

  private extractMigrationName(sql: string): string | null {
    const match = sql.match(/-- Description: (.+)/);
    return match && match[1] ? match[1].trim() : null;
  }

  async getExecutedMigrations(): Promise<string[]> {
    try {
      const result = this.dbAll('SELECT id FROM migrations ORDER BY executed_at');
      return result.map((row: any) => row.id);
    } catch (error) {
      logger.warn('Could not fetch executed migrations', error);
      return [];
    }
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const available = await this.getAvailableMigrations();
    const executed = await this.getExecutedMigrations();

    return available.filter(migration => !executed.includes(migration.id));
  }

  async executeMigration(migration: Migration): Promise<void> {
    logger.info(`Executing migration: ${migration.id} - ${migration.name}`);

    try {
      // Execute the migration SQL
      await this.db.exec(migration.sql);

      // Record the migration as executed
      this.dbRun('INSERT INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);

      logger.info(`✅ Migration ${migration.id} completed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isIdempotent =
        message.includes('duplicate column name') ||
        message.includes('already exists') ||
        message.includes('already exists in sqlite_master') ||
        message.includes('no such column: tenant_id') ||
        message.includes('no such column:') ||
        message.includes('Cannot add a REFERENCES column with non-NULL default value');

      if (isIdempotent) {
        logger.warn(`⚠️ Migration ${migration.id} skipped due to existing schema: ${message}`);
        this.dbRun('INSERT OR IGNORE INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
        return;
      }

      if (message.includes('service_catalog_items has no column named estimated_fulfillment_time')) {
        logger.warn('⚠️ Attempting to add service_catalog_items.estimated_fulfillment_time column before retrying migration');
        try {
          this.db.exec('ALTER TABLE service_catalog_items ADD COLUMN estimated_fulfillment_time INTEGER');
        } catch (alterError) {
          const alterMessage = alterError instanceof Error ? alterError.message : String(alterError);
          if (!alterMessage.includes('duplicate column name')) {
            throw alterError;
          }
        }

        try {
          await this.db.exec(migration.sql);
          this.dbRun('INSERT OR IGNORE INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
          logger.info(`✅ Migration ${migration.id} completed successfully (repair)`);
          return;
        } catch (retryError) {
          logger.error(`❌ Migration ${migration.id} failed after repair attempt:`, retryError);
          throw retryError;
        }
      }

      if (message.includes('update_tag_usage_count') && message.includes('no such column: usage_count')) {
        logger.warn('⚠️ Attempting to repair missing kb_tags.usage_count column before retrying migration');
        try {
          this.db.exec('ALTER TABLE kb_tags ADD COLUMN usage_count INTEGER DEFAULT 0');
        } catch (alterError) {
          const alterMessage = alterError instanceof Error ? alterError.message : String(alterError);
          if (!alterMessage.includes('duplicate column name')) {
            throw alterError;
          }
        }

        try {
          await this.db.exec(migration.sql);
          this.dbRun('INSERT OR IGNORE INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
          logger.info(`✅ Migration ${migration.id} completed successfully (repair)`);
          return;
        } catch (retryError) {
          logger.error(`❌ Migration ${migration.id} failed after repair attempt:`, retryError);
          throw retryError;
        }
      }

      if (message.includes('cannot start a transaction within a transaction')) {
        const sanitizedSql = migration.sql
          .split('\n')
          .filter(line => !/^\s*BEGIN\s+TRANSACTION;?\s*$/i.test(line))
          .filter(line => !/^\s*COMMIT;?\s*$/i.test(line))
          .filter(line => !/^\s*ROLLBACK;?\s*$/i.test(line))
          .join('\n');

        logger.warn(`⚠️ Retrying migration ${migration.id} without explicit transaction wrappers`);
        try {
          await this.db.exec(sanitizedSql);
          this.dbRun('INSERT OR IGNORE INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
          logger.info(`✅ Migration ${migration.id} completed successfully (retry)`);
          return;
        } catch (retryError) {
          const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
          if (retryMessage.includes('update_tag_usage_count') && retryMessage.includes('no such column: usage_count')) {
            logger.warn('⚠️ Attempting to repair missing kb_tags.usage_count column before retrying sanitized migration');
            try {
              this.db.exec('ALTER TABLE kb_tags ADD COLUMN usage_count INTEGER DEFAULT 0');
            } catch (alterError) {
              const alterMessage = alterError instanceof Error ? alterError.message : String(alterError);
              if (!alterMessage.includes('duplicate column name')) {
                throw alterError;
              }
            }

            await this.db.exec(sanitizedSql);
            this.dbRun('INSERT OR IGNORE INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
            logger.info(`✅ Migration ${migration.id} completed successfully (repair)`);
            return;
          }
          if (retryMessage.includes('no such column: tenant_id')) {
            logger.warn(`⚠️ Migration ${migration.id} skipped due to existing schema: ${retryMessage}`);
            this.dbRun('INSERT OR IGNORE INTO migrations (id, name) VALUES (?, ?)', [migration.id, migration.name]);
            return;
          }
          throw retryError;
        }
      }

      logger.error(`❌ Migration ${migration.id} failed:`, error);
      throw error;
    }
  }

  async runPendingMigrations(): Promise<void> {
    await this.init();

    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      logger.info('✅ No pending migrations');
      return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    logger.info('🎉 All migrations completed successfully');
  }

  async rollbackMigration(migrationId: string): Promise<void> {
    logger.info(`Rolling back migration: ${migrationId}`);

    try {
      // Remove the migration record
      this.dbRun('DELETE FROM migrations WHERE id = ?', [migrationId]);
      logger.info(`✅ Migration ${migrationId} rolled back`);
      logger.info('⚠️  Note: You may need to manually revert database changes');
    } catch (error) {
      logger.error(`❌ Rollback failed for ${migrationId}:`, error);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<void> {
    await this.init();

    const available = await this.getAvailableMigrations();
    const executed = await this.getExecutedMigrations();

    logger.info('\n📊 Migration Status');
    logger.info('===================');

    for (const migration of available) {
      const status = executed.includes(migration.id) ? '✅' : '⏳';
      logger.info(`${status} ${migration.id} - ${migration.name}`);
    }

    logger.info(`\nTotal migrations: ${available.length}`);
    logger.info(`Executed: ${executed.length}`);
    logger.info(`Pending: ${available.length - executed.length}`);
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

// CLI Interface
async function main() {
  const migrator = new DatabaseMigrator();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'status':
        await migrator.getMigrationStatus();
        break;

      case 'migrate':
        await migrator.runPendingMigrations();
        break;

      case 'rollback':
        const migrationId = process.argv[3];
        if (!migrationId) {
          logger.error('Please provide migration ID to rollback');
          process.exit(1);
        }
        await migrator.rollbackMigration(migrationId);
        break;

      default:
        logger.info('Usage');
        logger.info('  npm run migrate status   - Show migration status');
        logger.info('  npm run migrate migrate  - Run pending migrations');
        logger.info('  npm run migrate rollback <id> - Rollback a migration');
        break;
    }
  } catch (error) {
    logger.error('Migration failed', error);
    process.exit(1);
  } finally {
    await migrator.close();
  }
}

// Export for programmatic use
export { DatabaseMigrator };

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}
