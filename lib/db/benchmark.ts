/**
 * Database Query Performance Benchmarking Tools
 * Measures and compares query performance across different strategies
 */

import Database from 'better-sqlite3';
import { pool } from './connection';
import logger from '../monitoring/structured-logger';

interface BenchmarkResult {
  name: string;
  runs: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50Time: number;
  p95Time: number;
  p99Time: number;
  opsPerSecond: number;
  queryPlan?: unknown[];
}

interface BenchmarkOptions {
  runs?: number;
  warmupRuns?: number;
  includeQueryPlan?: boolean;
  logResults?: boolean;
}

class QueryBenchmark {
  /**
   * Benchmark a single query
   */
  async benchmarkQuery(
    db: Database.Database,
    sql: string,
    params: unknown[] = [],
    options: BenchmarkOptions & { name: string } = { name: 'Query', runs: 100 }
  ): Promise<BenchmarkResult> {
    const runs = options.runs ?? 100;
    const warmupRuns = options.warmupRuns ?? 10;
    const name = options.name;

    // Warmup runs (não contam para estatísticas)
    const stmt = db.prepare(sql);
    for (let i = 0; i < warmupRuns; i++) {
      stmt.all(...params);
    }

    // Benchmark runs
    const times: number[] = [];

    for (let i = 0; i < runs; i++) {
      const startTime = performance.now();
      stmt.all(...params);
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    // Calcular estatísticas
    times.sort((a, b) => a - b);

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const avgTime = totalTime / runs;
    const minTime = times[0];
    const maxTime = times[runs - 1];
    const p50Time = times[Math.floor(runs * 0.5)];
    const p95Time = times[Math.floor(runs * 0.95)];
    const p99Time = times[Math.floor(runs * 0.99)];
    const opsPerSecond = 1000 / avgTime;

    const result: BenchmarkResult = {
      name,
      runs,
      totalTime,
      avgTime,
      minTime: minTime ?? 0,
      maxTime: maxTime ?? 0,
      p50Time: p50Time ?? 0,
      p95Time: p95Time ?? 0,
      p99Time: p99Time ?? 0,
      opsPerSecond,
    };

    // Query plan
    if (options.includeQueryPlan) {
      try {
        result.queryPlan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all();
      } catch (error) {
        // Ignorar erros de EXPLAIN
      }
    }

    if (options.logResults) {
      logger.info(`Benchmark: ${name}`, result);
    }

    return result;
  }

  /**
   * Compara múltiplas queries
   */
  async compareQueries(
    db: Database.Database,
    queries: Array<{
      name: string;
      sql: string;
      params?: unknown[];
    }>,
    options?: BenchmarkOptions
  ): Promise<{
    results: BenchmarkResult[];
    fastest: string;
    slowest: string;
    speedup: Record<string, number>;
  }> {
    const results: BenchmarkResult[] = [];

    for (const query of queries) {
      const result = await this.benchmarkQuery(
        db,
        query.sql,
        query.params ?? [],
        { ...options, name: query.name }
      );
      results.push(result);
    }

    // Ordenar por tempo médio
    results.sort((a, b) => a.avgTime - b.avgTime);

    const fastest = results[0]?.name ?? 'Unknown';
    const slowest = results[results.length - 1]?.name ?? 'Unknown';

    // Calcular speedup relativo ao mais rápido
    const speedup: Record<string, number> = {};
    const fastestTime = results[0]?.avgTime ?? 1;

    for (const result of results) {
      speedup[result.name] = result.avgTime / fastestTime;
    }

    return {
      results,
      fastest,
      slowest,
      speedup,
    };
  }

  /**
   * Benchmark de operações CRUD
   */
  async benchmarkCRUD(
    db: Database.Database,
    tableName: string,
    sampleData: Record<string, unknown>,
    options?: BenchmarkOptions
  ): Promise<{
    insert: BenchmarkResult;
    select: BenchmarkResult;
    update: BenchmarkResult;
    delete: BenchmarkResult;
  }> {
    const runs = options?.runs ?? 100;

    // Preparar dados
    const columns = Object.keys(sampleData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(sampleData);

    // INSERT benchmark
    const insertSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    const insertIds: number[] = [];

    const insertTimes: number[] = [];
    for (let i = 0; i < runs; i++) {
      const startTime = performance.now();
      const result = db.prepare(insertSql).run(...values);
      const endTime = performance.now();
      insertTimes.push(endTime - startTime);
      insertIds.push(result.lastInsertRowid as number);
    }

    // SELECT benchmark
    const selectSql = `SELECT * FROM ${tableName} WHERE id = ?`;
    const selectTimes: number[] = [];
    for (let i = 0; i < runs; i++) {
      const id = insertIds[i % insertIds.length];
      const startTime = performance.now();
      db.prepare(selectSql).get(id);
      const endTime = performance.now();
      selectTimes.push(endTime - startTime);
    }

    // UPDATE benchmark
    const updateColumn = columns[0];
    const updateSql = `UPDATE ${tableName} SET ${updateColumn} = ? WHERE id = ?`;
    const updateTimes: number[] = [];
    for (let i = 0; i < runs; i++) {
      const id = insertIds[i % insertIds.length];
      const startTime = performance.now();
      db.prepare(updateSql).run(values[0], id);
      const endTime = performance.now();
      updateTimes.push(endTime - startTime);
    }

    // DELETE benchmark
    const deleteSql = `DELETE FROM ${tableName} WHERE id = ?`;
    const deleteTimes: number[] = [];
    for (let i = 0; i < runs; i++) {
      const id = insertIds[i];
      const startTime = performance.now();
      db.prepare(deleteSql).run(id);
      const endTime = performance.now();
      deleteTimes.push(endTime - startTime);
    }

    return {
      insert: this.calculateStats('INSERT', insertTimes),
      select: this.calculateStats('SELECT', selectTimes),
      update: this.calculateStats('UPDATE', updateTimes),
      delete: this.calculateStats('DELETE', deleteTimes),
    };
  }

  /**
   * Benchmark de índices
   */
  async benchmarkIndex(
    db: Database.Database,
    tableName: string,
    columnName: string,
    options?: BenchmarkOptions
  ): Promise<{
    withoutIndex: BenchmarkResult;
    withIndex: BenchmarkResult;
    improvement: number;
  }> {
    const runs = options?.runs ?? 100;
    const indexName = `idx_benchmark_${tableName}_${columnName}`;

    // Garantir que não existe índice
    try {
      db.prepare(`DROP INDEX IF EXISTS ${indexName}`).run();
    } catch (error) {
      // Ignorar erro
    }

    // Benchmark sem índice
    const sqlWithoutIndex = `SELECT * FROM ${tableName} WHERE ${columnName} = ?`;
    const withoutIndex = await this.benchmarkQuery(
      db,
      sqlWithoutIndex,
      ['test'],
      { ...options, name: 'Without Index', runs }
    );

    // Criar índice
    db.prepare(`CREATE INDEX ${indexName} ON ${tableName}(${columnName})`).run();

    // Benchmark com índice
    const withIndex = await this.benchmarkQuery(
      db,
      sqlWithoutIndex,
      ['test'],
      { ...options, name: 'With Index', runs }
    );

    // Limpar índice
    try {
      db.prepare(`DROP INDEX ${indexName}`).run();
    } catch (error) {
      // Ignorar erro
    }

    const improvement = ((withoutIndex.avgTime - withIndex.avgTime) / withoutIndex.avgTime) * 100;

    return {
      withoutIndex,
      withIndex,
      improvement,
    };
  }

  /**
   * Benchmark de JOIN strategies
   */
  async benchmarkJoins(
    db: Database.Database,
    organizationId: number,
    options?: BenchmarkOptions
  ): Promise<{
    results: BenchmarkResult[];
    recommendation: string;
  }> {
    const queries = [
      {
        name: 'Multiple Queries (N+1)',
        sql: `SELECT * FROM tickets WHERE organization_id = ?`,
        params: [organizationId],
      },
      {
        name: 'Single JOIN Query',
        sql: `
          SELECT
            t.*,
            u.name as user_name,
            c.name as category_name,
            p.name as priority_name,
            s.name as status_name
          FROM tickets t
          INNER JOIN users u ON t.user_id = u.id
          INNER JOIN categories c ON t.category_id = c.id
          INNER JOIN priorities p ON t.priority_id = p.id
          INNER JOIN statuses s ON t.status_id = s.id
          WHERE t.organization_id = ?
        `,
        params: [organizationId],
      },
      {
        name: 'LEFT JOIN with Subqueries',
        sql: `
          SELECT
            t.*,
            (SELECT COUNT(*) FROM comments WHERE ticket_id = t.id) as comments_count,
            (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id) as attachments_count
          FROM tickets t
          WHERE t.organization_id = ?
        `,
        params: [organizationId],
      },
      {
        name: 'CTE Query',
        sql: `
          WITH ticket_comments AS (
            SELECT ticket_id, COUNT(*) as count
            FROM comments
            GROUP BY ticket_id
          )
          SELECT t.*, COALESCE(tc.count, 0) as comments_count
          FROM tickets t
          LEFT JOIN ticket_comments tc ON t.id = tc.ticket_id
          WHERE t.organization_id = ?
        `,
        params: [organizationId],
      },
    ];

    const comparison = await this.compareQueries(db, queries, options);

    let recommendation = '';
    if (comparison.fastest.includes('CTE')) {
      recommendation = 'Use CTEs for complex aggregations';
    } else if (comparison.fastest.includes('Single JOIN')) {
      recommendation = 'Use single JOIN query for best performance';
    } else {
      recommendation = 'Optimize query structure';
    }

    return {
      results: comparison.results,
      recommendation,
    };
  }

  /**
   * Calcula estatísticas de tempos
   */
  private calculateStats(name: string, times: number[]): BenchmarkResult {
    times.sort((a, b) => a - b);

    const runs = times.length;
    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const avgTime = totalTime / runs;
    const minTime = times[0];
    const maxTime = times[runs - 1];
    const p50Time = times[Math.floor(runs * 0.5)];
    const p95Time = times[Math.floor(runs * 0.95)];
    const p99Time = times[Math.floor(runs * 0.99)];
    const opsPerSecond = 1000 / avgTime;

    return {
      name,
      runs,
      totalTime,
      avgTime,
      minTime: minTime ?? 0,
      maxTime: maxTime ?? 0,
      p50Time: p50Time ?? 0,
      p95Time: p95Time ?? 0,
      p99Time: p99Time ?? 0,
      opsPerSecond,
    };
  }

  /**
   * Formata resultados para exibição
   */
  formatResults(results: BenchmarkResult | BenchmarkResult[]): string {
    const resultsArray = Array.isArray(results) ? results : [results];
    let output = '\n=== Query Performance Benchmark ===\n\n';

    for (const result of resultsArray) {
      output += `Query: ${result.name}\n`;
      output += `  Runs: ${result.runs}\n`;
      output += `  Avg: ${result.avgTime.toFixed(3)}ms\n`;
      output += `  Min: ${result.minTime.toFixed(3)}ms\n`;
      output += `  Max: ${result.maxTime.toFixed(3)}ms\n`;
      output += `  P50: ${result.p50Time.toFixed(3)}ms\n`;
      output += `  P95: ${result.p95Time.toFixed(3)}ms\n`;
      output += `  P99: ${result.p99Time.toFixed(3)}ms\n`;
      output += `  Ops/sec: ${result.opsPerSecond.toFixed(0)}\n`;

      if (result.queryPlan) {
        output += `  Query Plan:\n`;
        output += `    ${JSON.stringify(result.queryPlan, null, 2)}\n`;
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Executa suite completa de benchmarks
   */
  async runFullBenchmarkSuite(organizationId: number = 1): Promise<void> {
    logger.info('Starting comprehensive database benchmark suite...');

    await pool.execute(async (db) => {
      // 1. Dashboard Queries
      logger.info('\n1. Benchmarking Dashboard Queries...');
      const dashboardResults = await this.compareQueries(
        db,
        [
          {
            name: 'Dashboard - Separate Queries',
            sql: 'SELECT COUNT(*) FROM tickets WHERE organization_id = ?',
            params: [organizationId],
          },
          {
            name: 'Dashboard - CTE Query',
            sql: `
              WITH stats AS (
                SELECT
                  COUNT(*) as total,
                  SUM(CASE WHEN status_id = 1 THEN 1 ELSE 0 END) as open
                FROM tickets
                WHERE organization_id = ?
              )
              SELECT * FROM stats
            `,
            params: [organizationId],
          },
        ],
        { runs: 100, includeQueryPlan: true, logResults: true }
      );

      logger.info(this.formatResults(dashboardResults.results));

      // 2. JOIN Strategies
      logger.info('\n2. Benchmarking JOIN Strategies...');
      const joinResults = await this.benchmarkJoins(db, organizationId, {
        runs: 50,
        includeQueryPlan: true,
      });

      logger.info(this.formatResults(joinResults.results));
      logger.info(`Recommendation: ${joinResults.recommendation}`);

      // 3. Index Performance
      logger.info('\n3. Benchmarking Index Performance...');
      const indexResult = await this.benchmarkIndex(db, 'tickets', 'status_id', {
        runs: 100,
      });

      logger.info(`Without Index: ${indexResult.withoutIndex.avgTime.toFixed(3)}ms`);
      logger.info(`With Index: ${indexResult.withIndex.avgTime.toFixed(3)}ms`);
      logger.info(`Improvement: ${indexResult.improvement.toFixed(2)}%`);

      logger.info('\nBenchmark suite completed!');
    });
  }
}

// Singleton instance
const benchmark = new QueryBenchmark();

export default benchmark;
export { QueryBenchmark, type BenchmarkResult, type BenchmarkOptions };
