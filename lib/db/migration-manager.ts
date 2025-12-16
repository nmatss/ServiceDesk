/**
 * PostgreSQL Migration Manager
 *
 * Gerencia migrations versionadas para PostgreSQL
 * Suporta rollback, status check e histórico
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs/promises';
import path from 'path';

interface MigrationResult {
  success: boolean;
  migration: string;
  error?: string;
  duration?: number;
}

export class MigrationManager {
  private connectionString: string;
  private migrationsPath: string;

  constructor(connectionString: string, migrationsPath?: string) {
    this.connectionString = connectionString;
    this.migrationsPath = migrationsPath || path.join(process.cwd(), 'lib', 'db', 'migrations');
  }

  /**
   * Cria tabela de controle de migrations se não existir
   */
  private async ensureMigrationsTable(): Promise<void> {
    const sql = neon(this.connectionString);

    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER,
        status VARCHAR(20) DEFAULT 'applied',
        error_message TEXT
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version
      ON schema_migrations(version)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_status
      ON schema_migrations(status)
    `;

    console.log('✓ Schema migrations table ready');
  }

  /**
   * Lista todos os arquivos de migration disponíveis
   */
  private async getAvailableMigrations(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(f => f.endsWith('.sql'))
        .sort(); // Ordena por nome (assumindo formato XXX_nome.sql)
    } catch (error) {
      console.error('Error reading migrations directory:', error);
      return [];
    }
  }

  /**
   * Obtém migrations já aplicadas do banco
   */
  private async getAppliedMigrations(): Promise<Set<string>> {
    const sql = neon(this.connectionString);

    try {
      const results = await sql`
        SELECT filename FROM schema_migrations
        WHERE status = 'applied'
        ORDER BY version
      `;

      return new Set(results.map(r => r.filename as string));
    } catch (error) {
      console.error('Error getting applied migrations:', error);
      return new Set();
    }
  }

  /**
   * Calcula checksum MD5 de um arquivo
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const content = await fs.readFile(filePath, 'utf-8');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Extrai versão do nome do arquivo (ex: 001_initial.sql -> 1)
   */
  private extractVersion(filename: string): number {
    if (!filename) return 0;
    const match = filename.match(/^(\d+)_/);
    return match?.[1] ? parseInt(match[1], 10) : 0;
  }

  /**
   * Extrai nome da migration (ex: 001_initial_schema.sql -> initial_schema)
   */
  private extractName(filename: string): string {
    if (!filename) return '';
    return filename.replace(/^\d+_/, '').replace(/\.sql$/, '');
  }

  /**
   * Executa uma migration específica
   */
  private async executeMigration(filename: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const filePath = path.join(this.migrationsPath, filename);
    const sql = neon(this.connectionString);

    try {
      // Lê o arquivo SQL
      const migrationSql = await fs.readFile(filePath, 'utf-8');
      const checksum = await this.calculateChecksum(filePath);
      const version = this.extractVersion(filename);
      const name = this.extractName(filename);

      console.log(`\n→ Applying migration: ${filename}`);

      // Executa a migration
      await sql.unsafe(migrationSql);

      // Registra a migration
      await sql`
        INSERT INTO schema_migrations (version, name, filename, checksum, execution_time_ms, status)
        VALUES (
          ${version},
          ${name},
          ${filename},
          ${checksum},
          ${Date.now() - startTime},
          'applied'
        )
      `;

      const duration = Date.now() - startTime;
      console.log(`✓ Migration applied successfully in ${duration}ms`);

      return {
        success: true,
        migration: filename,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`✗ Migration failed: ${errorMessage}`);

      // Registra o erro no banco
      try {
        await sql`
          INSERT INTO schema_migrations (version, name, filename, checksum, execution_time_ms, status, error_message)
          VALUES (
            ${this.extractVersion(filename)},
            ${this.extractName(filename)},
            ${filename},
            ${await this.calculateChecksum(filePath)},
            ${duration},
            'failed',
            ${errorMessage}
          )
          ON CONFLICT (version) DO UPDATE
          SET status = 'failed', error_message = ${errorMessage}
        `;
      } catch (logError) {
        console.error('Failed to log migration error:', logError);
      }

      return {
        success: false,
        migration: filename,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * Executa todas as migrations pendentes
   */
  async migrate(): Promise<{ success: boolean; applied: string[]; failed: string[] }> {
    console.log('🔄 Starting database migration...\n');

    await this.ensureMigrationsTable();

    const available = await this.getAvailableMigrations();
    const applied = await this.getAppliedMigrations();

    const pending = available.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('✓ Database is up to date. No pending migrations.');
      return { success: true, applied: [], failed: [] };
    }

    console.log(`Found ${pending.length} pending migration(s):\n`);
    pending.forEach(f => console.log(`  - ${f}`));

    const results: MigrationResult[] = [];
    const appliedMigrations: string[] = [];
    const failedMigrations: string[] = [];

    for (const migration of pending) {
      const result = await this.executeMigration(migration);
      results.push(result);

      if (result.success) {
        appliedMigrations.push(migration);
      } else {
        failedMigrations.push(migration);
        // Para na primeira falha
        console.error(`\n✗ Migration failed. Stopping migration process.`);
        break;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Applied: ${appliedMigrations.length}`);
    console.log(`Failed: ${failedMigrations.length}`);
    console.log(`Total time: ${results.reduce((sum, r) => sum + (r.duration || 0), 0)}ms`);
    console.log('='.repeat(60));

    return {
      success: failedMigrations.length === 0,
      applied: appliedMigrations,
      failed: failedMigrations
    };
  }

  /**
   * Mostra status atual das migrations
   */
  async status(): Promise<void> {
    await this.ensureMigrationsTable();

    const sql = neon(this.connectionString);
    const available = await this.getAvailableMigrations();
    const appliedSet = await this.getAppliedMigrations();

    console.log('\n' + '='.repeat(80));
    console.log('Database Migration Status');
    console.log('='.repeat(80));

    for (const filename of available) {
      const version = this.extractVersion(filename);
      const name = this.extractName(filename);
      const isApplied = appliedSet.has(filename);

      const status = isApplied ? '✓ Applied' : '○ Pending';
      const color = isApplied ? '\x1b[32m' : '\x1b[33m';
      const reset = '\x1b[0m';

      console.log(`${color}${status}${reset} [${String(version).padStart(3, '0')}] ${name}`);

      if (isApplied) {
        const details = await sql`
          SELECT applied_at, execution_time_ms, status
          FROM schema_migrations
          WHERE filename = ${filename}
          LIMIT 1
        `;

        if (details.length > 0) {
          const d = details[0];
          if (d) {
            console.log(`         Applied: ${d.applied_at} (${d.execution_time_ms}ms)`);
          }
        }
      }
    }

    console.log('='.repeat(80));
    console.log(`Total migrations: ${available.length}`);
    console.log(`Applied: ${appliedSet.size}`);
    console.log(`Pending: ${available.length - appliedSet.size}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Reverte a última migration aplicada (CUIDADO!)
   */
  async rollback(): Promise<{ success: boolean; rolledBack?: string; error?: string }> {
    console.log('⚠️  WARNING: Rolling back last migration...\n');

    const sql = neon(this.connectionString);

    try {
      // Busca a última migration aplicada
      const lastMigration = await sql`
        SELECT * FROM schema_migrations
        WHERE status = 'applied'
        ORDER BY version DESC
        LIMIT 1
      `;

      if (lastMigration.length === 0) {
        console.log('No migrations to rollback.');
        return { success: true };
      }

      const migration = lastMigration[0];
      if (!migration) {
        console.log('No migrations to rollback.');
        return { success: true };
      }

      console.log(`Rolling back: ${migration.filename}`);

      // NOTA: Para rollback completo, você precisaria criar arquivos _down.sql
      // Por enquanto, apenas marca como não aplicada
      await sql`
        DELETE FROM schema_migrations
        WHERE version = ${migration.version}
      `;

      console.log(`✓ Rollback completed: ${migration.filename}`);
      console.log('\n⚠️  WARNING: This only removed the migration record.');
      console.log('   You may need to manually revert database changes.');

      return { success: true, rolledBack: migration.filename as string };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Rollback failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Força re-execução de uma migration específica
   */
  async force(filename: string): Promise<MigrationResult> {
    console.log(`⚠️  Force re-running migration: ${filename}\n`);

    const sql = neon(this.connectionString);

    // Remove registro anterior se existir
    await sql`
      DELETE FROM schema_migrations
      WHERE filename = ${filename}
    `;

    return await this.executeMigration(filename);
  }
}

/**
 * CLI Helper - Executa migration via CLI
 */
export async function runMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const manager = new MigrationManager(connectionString);

  const command = process.argv[2] || 'migrate';

  try {
    switch (command) {
      case 'migrate':
      case 'up':
        const result = await manager.migrate();
        process.exit(result.success ? 0 : 1);
        break;

      case 'status':
        await manager.status();
        break;

      case 'rollback':
      case 'down':
        const rollbackResult = await manager.rollback();
        process.exit(rollbackResult.success ? 0 : 1);
        break;

      case 'force':
        if (!process.argv[3]) {
          console.error('Usage: npm run migrate force <filename>');
          process.exit(1);
        }
        const forceResult = await manager.force(process.argv[3]);
        process.exit(forceResult.success ? 0 : 1);
        break;

      default:
        console.log('Usage: npm run migrate [command]');
        console.log('');
        console.log('Commands:');
        console.log('  migrate, up     Apply all pending migrations (default)');
        console.log('  status          Show migration status');
        console.log('  rollback, down  Rollback last migration');
        console.log('  force <file>    Force re-run specific migration');
        process.exit(0);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Auto-run if called directly
if (require.main === module) {
  runMigration();
}
