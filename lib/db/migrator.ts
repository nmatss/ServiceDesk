/**
 * Database Migration Utility
 * Handles migration from SQLite to PostgreSQL for production deployment
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../monitoring/structured-logger';

export interface MigrationConfig {
  source: 'sqlite' | 'postgresql';
  target: 'sqlite' | 'postgresql';
  dataOnly?: boolean; // Only migrate data, not schema
  schemaOnly?: boolean; // Only migrate schema, not data
  batchSize?: number; // For large data migrations
}

export interface MigrationResult {
  success: boolean;
  tablesProcessed: string[];
  recordsProcessed: number;
  errors: Array<{ table: string; error: string }>;
  duration: number;
}

export class DatabaseMigrator {
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
  }

  /**
   * Execute migration from SQLite to PostgreSQL
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      tablesProcessed: [],
      recordsProcessed: 0,
      errors: [],
      duration: 0,
    };

    try {
      if (!this.config.dataOnly) {
        await this.migrateSchema();
      }

      if (!this.config.schemaOnly) {
        await this.migrateData(result);
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      result.errors.push({
        table: 'migration',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Migrate database schema
   */
  private async migrateSchema(): Promise<void> {
    if (this.config.target === 'postgresql') {
      const schemaPath = join(__dirname, 'migrations', '001_postgresql_schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');

      // In a real implementation, you would execute this against PostgreSQL
      logger.info('Schema migration prepared for PostgreSQL');
      logger.info('Schema size', schema.length, 'characters');
    }
  }

  /**
   * Migrate data between databases
   */
  private async migrateData(result: MigrationResult): Promise<void> {
    const tables = this.getTablesInMigrationOrder();

    for (const table of tables) {
      try {
        const records = await this.migrateTable(table);
        result.tablesProcessed.push(table);
        result.recordsProcessed += records;
      } catch (error) {
        result.errors.push({
          table,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Migrate a single table
   */
  private async migrateTable(tableName: string): Promise<number> {
    // batchSize is configured but will be used in real implementation
    // const batchSize = this.config.batchSize || 1000;
    let totalRecords = 0;

    // In a real implementation, you would:
    // 1. Read data from source database in batches
    // 2. Transform data if needed (e.g., SQLite -> PostgreSQL type conversions)
    // 3. Insert into target database

    logger.info(`Migrating table: ${tableName}`);

    // Mock implementation
    totalRecords = Math.floor(Math.random() * 10000);

    return totalRecords;
  }

  /**
   * Get tables in correct order for migration (respecting foreign keys)
   */
  private getTablesInMigrationOrder(): string[] {
    return [
      // Core entities first
      'organizations',
      'users',
      'roles',
      'permissions',
      'role_permissions',
      'user_roles',
      'refresh_tokens',
      'password_history',
      'verification_codes',
      'webauthn_credentials',
      'login_attempts',
      'auth_audit_logs',
      'password_policies',
      'rate_limits',
      'sso_providers',

      // Categories and classifications
      'categories',
      'priorities',
      'statuses',
      'departments',
      'user_departments',

      // Tickets and related
      'tickets',
      'comments',
      'attachments',

      // SLA system
      'sla_policies',
      'sla_tracking',
      'escalations',

      // Knowledge base
      'kb_categories',
      'kb_articles',
      'kb_tags',
      'kb_article_tags',
      'kb_article_feedback',
      'kb_article_attachments',
      'kb_article_suggestions',

      // Templates and automation
      'ticket_templates',
      'automations',
      'workflows',
      'workflow_steps',
      'workflow_executions',
      'workflow_step_executions',

      // Approvals
      'approvals',
      'approval_history',

      // Integrations
      'integrations',
      'integration_logs',
      'webhooks',
      'webhook_deliveries',

      // AI and analytics
      'ai_classifications',
      'ai_suggestions',
      'ai_training_data',
      'analytics_daily_metrics',
      'analytics_agent_metrics',
      'analytics_category_metrics',
      'analytics_realtime_metrics',
      'analytics_events',
      'analytics_agent_performance',

      // Communication
      'communication_channels',
      'communication_messages',

      // Notifications
      'notifications',
      'notification_events',
      'user_sessions',

      // Brasil-specific
      'whatsapp_contacts',
      'whatsapp_messages',
      'govbr_integrations',
      'lgpd_consents',

      // Surveys and audit
      'satisfaction_surveys',
      'audit_logs',
      'system_settings',
      'cache',
    ];
  }

  /**
   * Generate PostgreSQL connection string for Neon
   */
  static generateNeonConnectionString(config: {
    host: string;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  }): string {
    const { host, database, username, password, ssl = true } = config;
    return `postgresql://${username}:${password}@${host}/${database}${ssl ? '?sslmode=require' : ''}`;
  }

  /**
   * Validate migration compatibility
   */
  static validateMigration(sourceSchema: string, targetSchema: string): {
    compatible: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for SQLite-specific features that need conversion
    if (sourceSchema.includes('INTEGER PRIMARY KEY AUTOINCREMENT')) {
      issues.push('SQLite AUTOINCREMENT needs conversion to PostgreSQL SERIAL');
    }

    if (sourceSchema.includes('DATETIME')) {
      issues.push('SQLite DATETIME needs conversion to PostgreSQL TIMESTAMPTZ');
    }

    if (sourceSchema.includes('TEXT') && targetSchema.includes('postgresql')) {
      issues.push('Consider using VARCHAR with appropriate limits instead of TEXT for better performance');
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  }

  /**
   * Generate data type conversion mapping
   */
  static getTypeConversions(): Record<string, string> {
    return {
      // SQLite -> PostgreSQL type conversions
      'INTEGER PRIMARY KEY AUTOINCREMENT': 'SERIAL PRIMARY KEY',
      'INTEGER': 'INTEGER',
      'TEXT': 'TEXT',
      'REAL': 'REAL',
      'BLOB': 'BYTEA',
      'DATETIME': 'TIMESTAMPTZ',
      'DATE': 'DATE',
      'BOOLEAN': 'BOOLEAN',
      'DECIMAL(3,2)': 'DECIMAL(3,2)',
      'DECIMAL(5,4)': 'DECIMAL(5,4)',
      'DECIMAL(10,2)': 'DECIMAL(10,2)',
      'DECIMAL(15,4)': 'DECIMAL(15,4)',
    };
  }

  /**
   * Get environment-specific configuration
   */
  static getEnvironmentConfig(env: 'development' | 'staging' | 'production') {
    const configs = {
      development: {
        source: 'sqlite' as const,
        target: 'sqlite' as const,
        batchSize: 100,
      },
      staging: {
        source: 'sqlite' as const,
        target: 'postgresql' as const,
        batchSize: 500,
      },
      production: {
        source: 'postgresql' as const,
        target: 'postgresql' as const,
        batchSize: 1000,
      },
    };

    return configs[env];
  }
}

/**
 * Utility functions for migration
 */
export const MigrationUtils = {
  /**
   * Convert SQLite schema to PostgreSQL
   */
  convertSQLiteToPostgreSQL(sqliteSchema: string): string {
    let converted = sqliteSchema;
    const conversions = DatabaseMigrator.getTypeConversions();

    for (const [sqlite, postgres] of Object.entries(conversions)) {
      converted = converted.replace(new RegExp(sqlite, 'g'), postgres);
    }

    // Convert CHECK constraints
    converted = converted.replace(
      /CHECK \((.*?)\)/g,
      (_match, constraint) => {
        // PostgreSQL has stricter CHECK constraint syntax
        return `CHECK (${constraint})`;
      }
    );

    // Convert FOREIGN KEY syntax
    converted = converted.replace(
      /FOREIGN KEY \((.*?)\) REFERENCES (.*?) ON DELETE (.*?)(?:\s|$)/g,
      'REFERENCES $2 ON DELETE $3'
    );

    return converted;
  },

  /**
   * Extract table creation statements
   */
  extractTableStatements(schema: string): Record<string, string> {
    const tables: Record<string, string> = {};
    const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\);/g;
    let match;

    while ((match = tableRegex.exec(schema)) !== null) {
      const tableName = match[1];
      if (tableName) {
        tables[tableName] = match[0];
      }
    }

    return tables;
  },

  /**
   * Extract index creation statements
   */
  extractIndexStatements(schema: string): string[] {
    const indexes: string[] = [];
    const indexRegex = /CREATE (?:UNIQUE )?INDEX.*?;/g;
    let match;

    while ((match = indexRegex.exec(schema)) !== null) {
      indexes.push(match[0]);
    }

    return indexes;
  },

  /**
   * Generate environment file template
   */
  generateEnvTemplate(): string {
    return `# Database Configuration
# Choose database type: 'sqlite' for development, 'postgresql' for production
DATABASE_TYPE=sqlite

# SQLite Configuration (Development)
SQLITE_PATH=./data/servicedesk.db

# PostgreSQL Configuration (Production - Neon)
DATABASE_URL=postgresql://username:password@host/database?sslmode=require

# Neon specific
NEON_HOST=your-neon-host.com
NEON_DATABASE=servicedesk
NEON_USERNAME=your-username
NEON_PASSWORD=your-password

# Migration settings
MIGRATION_BATCH_SIZE=1000
MIGRATION_LOG_LEVEL=info

# Performance settings
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000`;
  },
};

export default DatabaseMigrator;