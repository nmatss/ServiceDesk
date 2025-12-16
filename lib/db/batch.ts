/**
 * Batch Operations for Database
 * High-performance bulk inserts, updates, and deletes
 */

import Database from 'better-sqlite3';
import logger from '../monitoring/structured-logger';

interface BatchConfig {
  batchSize: number;
  enableLogging: boolean;
}

interface BatchResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  duration: number;
  errors: Array<{ index: number; error: Error }>;
}

class BatchOperations {
  private config: BatchConfig;

  constructor(config?: Partial<BatchConfig>) {
    this.config = {
      batchSize: config?.batchSize ?? 1000,
      enableLogging: config?.enableLogging ?? true,
    };
  }

  /**
   * Batch insert
   */
  async batchInsert<T extends Record<string, unknown>>(
    db: Database.Database,
    tableName: string,
    records: T[],
    options?: { batchSize?: number; onProgress?: (processed: number, total: number) => void }
  ): Promise<BatchResult> {
    if (records.length === 0) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        duration: 0,
        errors: [],
      };
    }

    const startTime = performance.now();
    const batchSize = options?.batchSize ?? this.config.batchSize;
    const errors: Array<{ index: number; error: Error }> = [];
    let successful = 0;

    // Preparar statement de insert
    const firstRecord = records[0];
    if (!firstRecord) {
      throw new Error('Records array is empty');
    }
    const columns = Object.keys(firstRecord);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    // Processar em batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      try {
        // Usar transação para batch
        db.transaction(() => {
          const stmt = db.prepare(sql);

          for (let j = 0; j < batch.length; j++) {
            const record = batch[j];
            if (!record) continue;
            const values = columns.map(col => record[col]);

            try {
              stmt.run(...values);
              successful++;
            } catch (error) {
              errors.push({
                index: i + j,
                error: error as Error,
              });
            }
          }
        })();

        // Callback de progresso
        if (options?.onProgress) {
          options.onProgress(Math.min(i + batchSize, records.length), records.length);
        }
      } catch (error) {
        logger.error(`Batch insert failed for batch starting at index ${i}`, error);

        // Adicionar todos os registros do batch como failed
        for (let j = 0; j < batch.length; j++) {
          errors.push({
            index: i + j,
            error: error as Error,
          });
        }
      }
    }

    const duration = performance.now() - startTime;

    if (this.config.enableLogging) {
      logger.info('Batch insert completed', {
        table: tableName,
        totalProcessed: records.length,
        successful,
        failed: errors.length,
        duration,
      });
    }

    return {
      totalProcessed: records.length,
      successful,
      failed: errors.length,
      duration,
      errors,
    };
  }

  /**
   * Batch update
   */
  async batchUpdate<T extends Record<string, unknown>>(
    db: Database.Database,
    tableName: string,
    updates: Array<{ id: number | string; data: T }>,
    options?: { batchSize?: number; onProgress?: (processed: number, total: number) => void }
  ): Promise<BatchResult> {
    if (updates.length === 0) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        duration: 0,
        errors: [],
      };
    }

    const startTime = performance.now();
    const batchSize = options?.batchSize ?? this.config.batchSize;
    const errors: Array<{ index: number; error: Error }> = [];
    let successful = 0;

    // Processar em batches
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      try {
        db.transaction(() => {
          for (let j = 0; j < batch.length; j++) {
            const update = batch[j];
            if (!update) continue;

            const { id, data } = update;

            // Construir SQL de update dinamicamente
            const columns = Object.keys(data);
            const setClause = columns.map(col => `${col} = ?`).join(', ');
            const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;

            try {
              const values = [...columns.map(col => data[col]), id];
              const stmt = db.prepare(sql);
              stmt.run(...values);
              successful++;
            } catch (error) {
              errors.push({
                index: i + j,
                error: error as Error,
              });
            }
          }
        })();

        // Callback de progresso
        if (options?.onProgress) {
          options.onProgress(Math.min(i + batchSize, updates.length), updates.length);
        }
      } catch (error) {
        logger.error(`Batch update failed for batch starting at index ${i}`, error);

        for (let j = 0; j < batch.length; j++) {
          errors.push({
            index: i + j,
            error: error as Error,
          });
        }
      }
    }

    const duration = performance.now() - startTime;

    if (this.config.enableLogging) {
      logger.info('Batch update completed', {
        table: tableName,
        totalProcessed: updates.length,
        successful,
        failed: errors.length,
        duration,
      });
    }

    return {
      totalProcessed: updates.length,
      successful,
      failed: errors.length,
      duration,
      errors,
    };
  }

  /**
   * Batch delete
   */
  async batchDelete(
    db: Database.Database,
    tableName: string,
    ids: Array<number | string>,
    options?: { batchSize?: number; onProgress?: (processed: number, total: number) => void }
  ): Promise<BatchResult> {
    if (ids.length === 0) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        duration: 0,
        errors: [],
      };
    }

    const startTime = performance.now();
    const batchSize = options?.batchSize ?? this.config.batchSize;
    const errors: Array<{ index: number; error: Error }> = [];
    let successful = 0;

    // Processar em batches usando IN clause para melhor performance
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);

      try {
        db.transaction(() => {
          const placeholders = batch.map(() => '?').join(', ');
          const sql = `DELETE FROM ${tableName} WHERE id IN (${placeholders})`;
          const stmt = db.prepare(sql);
          const result = stmt.run(...batch);
          successful += result.changes;
        })();

        // Callback de progresso
        if (options?.onProgress) {
          options.onProgress(Math.min(i + batchSize, ids.length), ids.length);
        }
      } catch (error) {
        logger.error(`Batch delete failed for batch starting at index ${i}`, error);

        for (let j = 0; j < batch.length; j++) {
          errors.push({
            index: i + j,
            error: error as Error,
          });
        }
      }
    }

    const duration = performance.now() - startTime;

    if (this.config.enableLogging) {
      logger.info('Batch delete completed', {
        table: tableName,
        totalProcessed: ids.length,
        successful,
        failed: errors.length,
        duration,
      });
    }

    return {
      totalProcessed: ids.length,
      successful,
      failed: errors.length,
      duration,
      errors,
    };
  }

  /**
   * Upsert (insert or update)
   */
  async batchUpsert<T extends Record<string, unknown>>(
    db: Database.Database,
    tableName: string,
    records: T[],
    conflictColumns: string[],
    options?: { batchSize?: number; onProgress?: (processed: number, total: number) => void }
  ): Promise<BatchResult> {
    if (records.length === 0) {
      return {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        duration: 0,
        errors: [],
      };
    }

    const startTime = performance.now();
    const batchSize = options?.batchSize ?? this.config.batchSize;
    const errors: Array<{ index: number; error: Error }> = [];
    let successful = 0;

    // Preparar statement de upsert (SQLite 3.24+)
    const firstRecord = records[0];
    if (!firstRecord) {
      throw new Error('Records array is empty');
    }
    const columns = Object.keys(firstRecord);
    const placeholders = columns.map(() => '?').join(', ');
    const updateClause = columns
      .filter(col => !conflictColumns.includes(col))
      .map(col => `${col} = excluded.${col}`)
      .join(', ');

    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT(${conflictColumns.join(', ')})
      DO UPDATE SET ${updateClause}
    `;

    // Processar em batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      try {
        db.transaction(() => {
          const stmt = db.prepare(sql);

          for (let j = 0; j < batch.length; j++) {
            const record = batch[j];
            if (!record) continue;
            const values = columns.map(col => record[col]);

            try {
              stmt.run(...values);
              successful++;
            } catch (error) {
              errors.push({
                index: i + j,
                error: error as Error,
              });
            }
          }
        })();

        // Callback de progresso
        if (options?.onProgress) {
          options.onProgress(Math.min(i + batchSize, records.length), records.length);
        }
      } catch (error) {
        logger.error(`Batch upsert failed for batch starting at index ${i}`, error);

        for (let j = 0; j < batch.length; j++) {
          errors.push({
            index: i + j,
            error: error as Error,
          });
        }
      }
    }

    const duration = performance.now() - startTime;

    if (this.config.enableLogging) {
      logger.info('Batch upsert completed', {
        table: tableName,
        totalProcessed: records.length,
        successful,
        failed: errors.length,
        duration,
      });
    }

    return {
      totalProcessed: records.length,
      successful,
      failed: errors.length,
      duration,
      errors,
    };
  }

  /**
   * Executa múltiplas queries em uma transação
   */
  async transaction(
    db: Database.Database,
    operations: Array<() => void>
  ): Promise<{ success: boolean; error?: Error }> {
    try {
      db.transaction(() => {
        for (const operation of operations) {
          operation();
        }
      })();

      return { success: true };
    } catch (error) {
      logger.error('Transaction failed', error);
      return { success: false, error: error as Error };
    }
  }
}

// Singleton instance
const batchOps = new BatchOperations({
  batchSize: parseInt(process.env.BATCH_SIZE || '1000', 10),
  enableLogging: process.env.NODE_ENV !== 'production',
});

export default batchOps;
export { BatchOperations, type BatchResult, type BatchConfig };
