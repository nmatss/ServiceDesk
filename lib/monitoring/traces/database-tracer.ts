/**
 * Traces customizados para operações de banco de dados
 */

import { ddTracer, SpanAttributes } from '../datadog-tracer';
import { logger } from '../logger';

/**
 * Trace de query SQL
 */
export async function traceQuery<T>(
  queryName: string,
  sql: string,
  params: any[] = [],
  fn: () => T
): Promise<T> {
  return await ddTracer.trace(
    'database.query',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', queryName);
      span.setAttribute('db.statement', sql.substring(0, 1000)); // Limitar tamanho
      span.setAttribute('db.params_count', params.length);
      span.setAttribute('resource.name', queryName);

      const startTime = Date.now();

      try {
        const result = fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.success', true);

        // Log queries lentas (> 100ms)
        if (duration > 100) {
          logger.performance('Slow database query detected', duration, {
            query_name: queryName,
            sql: sql.substring(0, 500),
            params_count: params.length,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.success', false);
        span.setAttribute('error.message', (error as Error).message);

        logger.error('Database query failed', error, {
          query_name: queryName,
          sql: sql.substring(0, 500),
          params_count: params.length,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de transação
 */
export async function traceTransaction<T>(
  transactionName: string,
  fn: () => Promise<T>
): Promise<T> {
  return await ddTracer.trace(
    'database.transaction',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'transaction');
      span.setAttribute('db.transaction_name', transactionName);
      span.setAttribute('resource.name', `Transaction: ${transactionName}`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.transaction_success', true);

        logger.info('Database transaction completed', {
          transaction_name: transactionName,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.transaction_success', false);
        span.setAttribute('error.message', (error as Error).message);

        logger.error('Database transaction failed', error, {
          transaction_name: transactionName,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de insert
 */
export async function traceInsert(
  tableName: string,
  fn: () => any
): Promise<any> {
  return await ddTracer.trace(
    'database.insert',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'insert');
      span.setAttribute('db.table', tableName);
      span.setAttribute('resource.name', `INSERT INTO ${tableName}`);

      const startTime = Date.now();

      try {
        const result = fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.rows_affected', result.changes || 0);
        span.setAttribute('db.last_insert_id', result.lastInsertRowid || null);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('error.message', (error as Error).message);

        throw error;
      }
    }
  );
}

/**
 * Trace de update
 */
export async function traceUpdate(
  tableName: string,
  fn: () => any
): Promise<any> {
  return await ddTracer.trace(
    'database.update',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'update');
      span.setAttribute('db.table', tableName);
      span.setAttribute('resource.name', `UPDATE ${tableName}`);

      const startTime = Date.now();

      try {
        const result = fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.rows_affected', result.changes || 0);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('error.message', (error as Error).message);

        throw error;
      }
    }
  );
}

/**
 * Trace de delete
 */
export async function traceDelete(
  tableName: string,
  fn: () => any
): Promise<any> {
  return await ddTracer.trace(
    'database.delete',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'delete');
      span.setAttribute('db.table', tableName);
      span.setAttribute('resource.name', `DELETE FROM ${tableName}`);

      const startTime = Date.now();

      try {
        const result = fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.rows_affected', result.changes || 0);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('error.message', (error as Error).message);

        throw error;
      }
    }
  );
}

/**
 * Trace de select
 */
export async function traceSelect<T>(
  tableName: string,
  fn: () => T
): Promise<T> {
  return await ddTracer.trace(
    'database.select',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'select');
      span.setAttribute('db.table', tableName);
      span.setAttribute('resource.name', `SELECT FROM ${tableName}`);

      const startTime = Date.now();

      try {
        const result = fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);

        // Contar registros se for array
        if (Array.isArray(result)) {
          span.setAttribute('db.rows_returned', result.length);
        } else if (result) {
          span.setAttribute('db.rows_returned', 1);
        } else {
          span.setAttribute('db.rows_returned', 0);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('error.message', (error as Error).message);

        throw error;
      }
    }
  );
}

/**
 * Trace de conexão ao banco
 */
export async function traceConnect(
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'database.connect',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'connect');
      span.setAttribute('resource.name', 'Database Connection');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.connected', true);

        logger.info('Database connection established', {
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.connected', false);
        span.setAttribute('error.message', (error as Error).message);

        logger.error('Database connection failed', error, {
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de migration
 */
export async function traceMigration(
  migrationName: string,
  direction: 'up' | 'down',
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'database.migration',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'migration');
      span.setAttribute('db.migration_name', migrationName);
      span.setAttribute('db.migration_direction', direction);
      span.setAttribute('resource.name', `Migration: ${migrationName} (${direction})`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.migration_success', true);

        logger.info('Database migration completed', {
          migration_name: migrationName,
          direction,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.migration_success', false);
        span.setAttribute('error.message', (error as Error).message);

        logger.error('Database migration failed', error, {
          migration_name: migrationName,
          direction,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de índice
 */
export async function traceIndexOperation(
  indexName: string,
  operation: 'create' | 'drop' | 'analyze',
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'database.index',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'index');
      span.setAttribute('db.index_name', indexName);
      span.setAttribute('db.index_operation', operation);
      span.setAttribute('resource.name', `Index ${operation}: ${indexName}`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.index_success', true);

        logger.info('Database index operation completed', {
          index_name: indexName,
          operation,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.index_success', false);
        span.setAttribute('error.message', (error as Error).message);

        logger.error('Database index operation failed', error, {
          index_name: indexName,
          operation,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de vacuum
 */
export async function traceVacuum(
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'database.vacuum',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'vacuum');
      span.setAttribute('resource.name', 'Database VACUUM');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.vacuum_success', true);

        logger.info('Database vacuum completed', {
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.vacuum_success', false);
        span.setAttribute('error.message', (error as Error).message);

        logger.error('Database vacuum failed', error, {
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de backup
 */
export async function traceBackup(
  backupPath: string,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'database.backup',
    async (span) => {
      span.setAttribute('db.system', 'sqlite');
      span.setAttribute('db.operation', 'backup');
      span.setAttribute('db.backup_path', backupPath);
      span.setAttribute('resource.name', 'Database Backup');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.backup_success', true);

        logger.info('Database backup completed', {
          backup_path: backupPath,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('db.backup_success', false);
        span.setAttribute('error.message', (error as Error).message);

        logger.error('Database backup failed', error, {
          backup_path: backupPath,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}
