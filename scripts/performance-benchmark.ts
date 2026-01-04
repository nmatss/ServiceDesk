#!/usr/bin/env tsx
/**
 * Performance Benchmark Script
 *
 * Measures database query performance and API response times
 * before and after optimizations
 */

import Database from 'better-sqlite3';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  queryName: string;
  executionTime: number;
  rowsReturned: number;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
}

interface BenchmarkSuite {
  suiteName: string;
  timestamp: string;
  results: BenchmarkResult[];
  summary: {
    totalQueries: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
  };
}

const DB_PATH = path.join(__dirname, '../servicedesk.db');
const BENCHMARK_ITERATIONS = 10;
const ORGANIZATION_ID = 1;

/**
 * Measure query execution time
 */
function measureQuery(
  db: Database.Database,
  queryName: string,
  query: string,
  params: unknown[] = [],
  iterations = BENCHMARK_ITERATIONS
): BenchmarkResult {
  const times: number[] = [];
  let rowCount = 0;

  // Warm up
  db.prepare(query).all(...params);

  // Run benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = db.prepare(query).all(...params);
    const end = performance.now();

    times.push(end - start);
    if (i === 0) rowCount = result.length;
  }

  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / iterations;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return {
    queryName,
    executionTime: totalTime,
    rowsReturned: rowCount,
    iterations,
    averageTime: avgTime,
    minTime,
    maxTime,
  };
}

/**
 * Run database performance benchmarks
 */
async function runDatabaseBenchmarks(): Promise<BenchmarkSuite> {
  console.log('🔍 Starting database performance benchmarks...\n');

  const db = new Database(DB_PATH);
  const results: BenchmarkResult[] = [];

  // ========================================
  // TICKET QUERIES
  // ========================================

  console.log('📊 Benchmarking ticket queries...');

  // 1. Get all tickets with details
  results.push(
    measureQuery(
      db,
      'Get All Tickets (with JOINs)',
      `
      SELECT
        t.*,
        u.name as user_name, u.email as user_email,
        a.name as assigned_agent_name,
        c.name as category_name, c.color as category_color,
        p.name as priority_name, p.level as priority_level,
        s.name as status_name, s.color as status_color
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE t.organization_id = ?
      ORDER BY t.created_at DESC
    `,
      [ORGANIZATION_ID]
    )
  );

  // 2. Get tickets by user
  results.push(
    measureQuery(
      db,
      'Get Tickets By User',
      `
      SELECT t.* FROM tickets t
      WHERE t.organization_id = ? AND t.user_id = ?
      ORDER BY t.created_at DESC
    `,
      [ORGANIZATION_ID, 1]
    )
  );

  // ========================================
  // ANALYTICS QUERIES
  // ========================================

  console.log('📈 Benchmarking analytics queries...');

  // 3. Real-time KPIs (BEFORE optimization - with subqueries)
  results.push(
    measureQuery(
      db,
      'Real-Time KPIs (Subqueries - BEFORE)',
      `
      SELECT
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND date(created_at) = date('now')) as tickets_today,
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ? AND datetime(created_at) >= datetime('now', '-7 days')) as tickets_this_week,
        (SELECT COUNT(*) FROM tickets WHERE organization_id = ?) as total_tickets
    `,
      [ORGANIZATION_ID, ORGANIZATION_ID, ORGANIZATION_ID]
    )
  );

  // 4. Real-time KPIs (AFTER optimization - with CTEs)
  results.push(
    measureQuery(
      db,
      'Real-Time KPIs (CTEs - AFTER)',
      `
      WITH ticket_metrics AS (
        SELECT
          COUNT(*) FILTER (WHERE date(created_at) = date('now')) as tickets_today,
          COUNT(*) FILTER (WHERE datetime(created_at) >= datetime('now', '-7 days')) as tickets_this_week,
          COUNT(*) as total_tickets
        FROM tickets
        WHERE organization_id = ?
      )
      SELECT * FROM ticket_metrics
    `,
      [ORGANIZATION_ID]
    )
  );

  // 5. SLA Analytics
  results.push(
    measureQuery(
      db,
      'SLA Analytics (30 days)',
      `
      SELECT
        date(t.created_at) as date,
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN st.response_met = 1 THEN 1 END) as response_met,
        COUNT(CASE WHEN st.resolution_met = 1 THEN 1 END) as resolution_met
      FROM tickets t
      LEFT JOIN sla_tracking st ON t.id = st.ticket_id
      WHERE t.organization_id = ? AND datetime(t.created_at) >= datetime('now', '-30 days')
      GROUP BY date(t.created_at)
    `,
      [ORGANIZATION_ID]
    )
  );

  // 6. Agent Performance
  results.push(
    measureQuery(
      db,
      'Agent Performance (30 days)',
      `
      SELECT
        u.id, u.name, u.email,
        COUNT(t.id) as assigned_tickets,
        COUNT(CASE WHEN s.is_final = 1 THEN 1 END) as resolved_tickets
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_to
        AND t.organization_id = ?
        AND datetime(t.created_at) >= datetime('now', '-30 days')
      LEFT JOIN statuses s ON t.status_id = s.id
      WHERE u.role IN ('admin', 'agent')
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(t.id) > 0
    `,
      [ORGANIZATION_ID]
    )
  );

  // 7. Category Distribution
  results.push(
    measureQuery(
      db,
      'Category Distribution',
      `
      SELECT
        c.id, c.name, c.color,
        COUNT(t.id) as ticket_count
      FROM categories c
      LEFT JOIN tickets t ON c.id = t.category_id
        AND t.organization_id = ?
        AND datetime(t.created_at) >= datetime('now', '-30 days')
      GROUP BY c.id, c.name, c.color
    `,
      [ORGANIZATION_ID]
    )
  );

  // ========================================
  // DASHBOARD QUERIES
  // ========================================

  console.log('📊 Benchmarking dashboard queries...');

  // 8. Ticket Volume Trends
  results.push(
    measureQuery(
      db,
      'Ticket Volume Trends (30 days)',
      `
      SELECT
        date(created_at) as date,
        COUNT(*) as created,
        COUNT(CASE WHEN status_id IN (SELECT id FROM statuses WHERE is_final = 1) THEN 1 END) as resolved
      FROM tickets
      WHERE organization_id = ? AND datetime(created_at) >= datetime('now', '-30 days')
      GROUP BY date(created_at)
    `,
      [ORGANIZATION_ID]
    )
  );

  // 9. SLA Breaches
  results.push(
    measureQuery(
      db,
      'SLA Breaches',
      `
      SELECT st.*, t.title
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      WHERE t.organization_id = ?
        AND ((st.response_due_at < CURRENT_TIMESTAMP AND st.response_met = 0)
         OR (st.resolution_due_at < CURRENT_TIMESTAMP AND st.resolution_met = 0))
    `,
      [ORGANIZATION_ID]
    )
  );

  // ========================================
  // COMMENT & ATTACHMENT QUERIES
  // ========================================

  console.log('💬 Benchmarking comment/attachment queries...');

  // 10. Comments by ticket (N+1 pattern - BEFORE)
  const tickets = db.prepare('SELECT id FROM tickets WHERE organization_id = ? LIMIT 10').all(ORGANIZATION_ID) as Array<{ id: number }>;
  const start = performance.now();
  for (const ticket of tickets) {
    db.prepare('SELECT * FROM comments WHERE ticket_id = ?').all(ticket.id);
  }
  const end = performance.now();

  results.push({
    queryName: 'Comments by Ticket (N+1 - BEFORE)',
    executionTime: end - start,
    rowsReturned: tickets.length,
    iterations: 1,
    averageTime: end - start,
    minTime: end - start,
    maxTime: end - start,
  });

  // 11. Comments with JOIN (AFTER)
  results.push(
    measureQuery(
      db,
      'Comments with JOIN (AFTER)',
      `
      SELECT c.*, t.id as ticket_id
      FROM comments c
      INNER JOIN tickets t ON c.ticket_id = t.id
      WHERE t.organization_id = ? AND t.id IN (SELECT id FROM tickets WHERE organization_id = ? LIMIT 10)
    `,
      [ORGANIZATION_ID, ORGANIZATION_ID]
    )
  );

  db.close();

  // Calculate summary
  const totalTime = results.reduce((sum, r) => sum + r.averageTime, 0);
  const avgTime = totalTime / results.length;

  return {
    suiteName: 'Database Performance Benchmark',
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalQueries: results.length,
      averageExecutionTime: avgTime,
      totalExecutionTime: totalTime,
    },
  };
}

/**
 * Display benchmark results
 */
function displayResults(suite: BenchmarkSuite) {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 ${suite.suiteName}`);
  console.log(`⏰ ${suite.timestamp}`);
  console.log('='.repeat(80) + '\n');

  console.log('Query Performance Results:\n');

  suite.results.forEach((result, index) => {
    const improvement = result.queryName.includes('AFTER')
      ? suite.results.find(r => r.queryName.includes('BEFORE') && r.queryName.split('(')[0] === result.queryName.split('(')[0])
      : null;

    console.log(`${index + 1}. ${result.queryName}`);
    console.log(`   Average: ${result.averageTime.toFixed(2)}ms`);
    console.log(`   Min/Max: ${result.minTime.toFixed(2)}ms / ${result.maxTime.toFixed(2)}ms`);
    console.log(`   Rows: ${result.rowsReturned}`);

    if (improvement) {
      const speedup = ((improvement.averageTime - result.averageTime) / improvement.averageTime) * 100;
      console.log(`   🚀 Improvement: ${speedup.toFixed(1)}% faster`);
    }

    console.log('');
  });

  console.log('='.repeat(80));
  console.log('Summary:');
  console.log(`  Total Queries: ${suite.summary.totalQueries}`);
  console.log(`  Average Execution Time: ${suite.summary.averageExecutionTime.toFixed(2)}ms`);
  console.log(`  Total Execution Time: ${suite.summary.totalExecutionTime.toFixed(2)}ms`);
  console.log('='.repeat(80) + '\n');

  // Identify slow queries (> 100ms)
  const slowQueries = suite.results.filter(r => r.averageTime > 100);
  if (slowQueries.length > 0) {
    console.log('⚠️  Slow Queries (> 100ms):\n');
    slowQueries.forEach(q => {
      console.log(`   - ${q.queryName}: ${q.averageTime.toFixed(2)}ms`);
    });
    console.log('');
  }

  // Save results to file
  const resultsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultsFile = path.join(resultsDir, `benchmark-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(suite, null, 2));
  console.log(`✅ Results saved to: ${resultsFile}\n`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const suite = await runDatabaseBenchmarks();
    displayResults(suite);

    console.log('✨ Benchmark complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

main();
