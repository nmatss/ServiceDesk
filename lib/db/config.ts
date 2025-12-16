/**
 * Database Configuration
 *
 * Supports dual mode:
 * - SQLite: Development (fast, local, zero-config)
 * - PostgreSQL (Neon): Production (scalable, concurrent, cloud-native)
 *
 * Switch via DATABASE_URL environment variable
 */

export type DatabaseType = 'sqlite' | 'postgresql';

export const dbConfig = {
  // Configurações do SQLite (desenvolvimento)
  sqlite: {
    path: './data/servicedesk.db',
    options: {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    },
    pragmas: {
      foreign_keys: 'ON',
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: 1000,
      temp_store: 'MEMORY',
    },
  },

  // Configurações do PostgreSQL/Neon (produção)
  postgresql: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production',
    pool: {
      max: 20, // máximo de conexões
      min: 2, // mínimo de conexões
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
    // Query timeout (30 segundos)
    statement_timeout: 30000,
    // Lock timeout (10 segundos)
    lock_timeout: 10000,
    // Idle in transaction timeout (60 segundos)
    idle_in_transaction_session_timeout: 60000,
  },

  // Configurações gerais
  general: {
    // Tamanho máximo de upload de arquivo (em bytes)
    maxFileSize: 10 * 1024 * 1024, // 10MB

    // Tipos de arquivo permitidos
    allowedFileTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-rar-compressed',
    ],

    // Configurações de paginação
    defaultPageSize: 20,
    maxPageSize: 100,

    // Configurações de cache
    cache: {
      enabled: true,
      ttl: 300, // 5 minutos
    },
  },
};

/**
 * Determina qual banco de dados usar baseado nas variáveis de ambiente
 *
 * Prioridade:
 * 1. DATABASE_URL está definida -> PostgreSQL
 * 2. DB_TYPE='postgresql' -> PostgreSQL (requer DATABASE_URL)
 * 3. Padrão -> SQLite (desenvolvimento)
 */
export function getDatabaseType(): DatabaseType {
  // Se DATABASE_URL está definida, usar PostgreSQL
  if (process.env.DATABASE_URL) {
    return 'postgresql';
  }

  // Se DB_TYPE está explicitamente definido
  if (process.env.DB_TYPE === 'postgresql' || process.env.DB_TYPE === 'postgres') {
    if (!process.env.DATABASE_URL) {
      console.warn('WARNING: DB_TYPE is set to postgresql but DATABASE_URL is not defined. Falling back to SQLite.');
      return 'sqlite';
    }
    return 'postgresql';
  }

  // Padrão: SQLite para desenvolvimento
  return 'sqlite';
}

/**
 * Verifica se está usando PostgreSQL
 */
export function isPostgreSQL(): boolean {
  return getDatabaseType() === 'postgresql';
}

/**
 * Verifica se está usando SQLite
 */
export function isSQLite(): boolean {
  return getDatabaseType() === 'sqlite';
}

/**
 * Obtém configuração do banco atual
 */
export function getCurrentDbConfig() {
  const dbType = getDatabaseType();
  return {
    type: dbType,
    config: dbType === 'sqlite' ? dbConfig.sqlite : dbConfig.postgresql,
  };
}

/**
 * Valida configuração do banco de dados
 */
export function validateDatabaseConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dbType = getDatabaseType();

  if (dbType === 'postgresql') {
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required for PostgreSQL');
    } else {
      // Validar formato da URL
      try {
        new URL(process.env.DATABASE_URL);
      } catch (e) {
        errors.push('DATABASE_URL is not a valid URL');
      }
    }

    // Avisos para produção
    if (process.env.NODE_ENV === 'production') {
      if (!dbConfig.postgresql.ssl) {
        warnings.push('SSL is disabled in production');
      }
    }
  }

  if (dbType === 'sqlite') {
    if (process.env.NODE_ENV === 'production') {
      warnings.push('Using SQLite in production is not recommended for high concurrency');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Imprime informações de configuração do banco
 */
export function printDatabaseInfo(): void {
  const dbType = getDatabaseType();
  const config = getCurrentDbConfig();
  const validation = validateDatabaseConfig();

  console.log('\n' + '='.repeat(60));
  console.log('Database Configuration');
  console.log('='.repeat(60));
  console.log(`Type: ${dbType.toUpperCase()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  if (dbType === 'postgresql') {
    const url = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') || 'NOT SET';
    const pgConfig = config.config as typeof dbConfig.postgresql;
    console.log(`URL: ${url}`);
    console.log(`SSL: ${pgConfig.ssl ? 'Enabled' : 'Disabled'}`);
    console.log(`Pool Size: ${pgConfig.pool.min}-${pgConfig.pool.max}`);
  } else {
    const sqliteConfig = config.config as typeof dbConfig.sqlite;
    console.log(`Path: ${sqliteConfig.path}`);
    console.log(`Journal Mode: ${sqliteConfig.pragmas.journal_mode}`);
  }

  if (validation.errors.length > 0) {
    console.log('\n❌ Errors:');
    validation.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(w => console.log(`  - ${w}`));
  }

  console.log('='.repeat(60) + '\n');
}

