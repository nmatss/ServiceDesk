#!/usr/bin/env tsx

/**
 * Database Benchmark Script
 * Runs comprehensive performance tests on the database
 */

import benchmark from '../lib/db/benchmark';
import { pool } from '../lib/db/connection';
import { logger } from '../lib/monitoring/logger';

async function main() {
  logger.info('Starting database benchmark suite...\n');

  try {
    // Run full benchmark suite
    await benchmark.runFullBenchmarkSuite(1);

    // Additional specific benchmarks
    await pool.execute(async (db) => {
      // Benchmark CRUD operations
      logger.info('\n4. Benchmarking CRUD Operations...');
      const crudResults = await benchmark.benchmarkCRUD(
        db,
        'users',
        {
          name: 'Test User',
          email: 'test@benchmark.com',
          role: 'user',
          password_hash: 'test_hash',
        },
        { runs: 100 }
      );

      logger.info('CRUD Performance:');
      logger.info(`  INSERT: ${crudResults.insert.avgTime.toFixed(3)}ms (${crudResults.insert.opsPerSecond.toFixed(0)} ops/sec)`);
      logger.info(`  SELECT: ${crudResults.select.avgTime.toFixed(3)}ms (${crudResults.select.opsPerSecond.toFixed(0)} ops/sec)`);
      logger.info(`  UPDATE: ${crudResults.update.avgTime.toFixed(3)}ms (${crudResults.update.opsPerSecond.toFixed(0)} ops/sec)`);
      logger.info(`  DELETE: ${crudResults.delete.avgTime.toFixed(3)}ms (${crudResults.delete.opsPerSecond.toFixed(0)} ops/sec)`);
    });

    logger.info('\n✅ Benchmark suite completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Benchmark failed:', error);
    process.exit(1);
  }
}

main();
