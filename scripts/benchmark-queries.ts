/**
 * Database Query Benchmark Script
 *
 * Agent 13: Database Optimization
 * Created: 2025-12-25
 *
 * Benchmarks critical database queries to measure optimization impact:
 * - Tests before/after performance improvements
 * - Measures average, min, max execution times
 * - Identifies performance bottlenecks
 * - Generates comparison reports
 *
 * Usage:
 * ```bash
 * npx ts-node scripts/benchmark-queries.ts
 * ```
 */

import { analyticsQueries, ticketQueries } from '../lib/db/queries';
import {
  wrapQuery,
  printQueryStats,
  resetQueryStats,
  getDatabaseStats,
  explainQuery
} from '../lib/db/query-monitor';
import { db } from '../lib/db/connection';

/**
 * Benchmark configuration
 */
const BENCHMARK_CONFIG = {
  iterations: 10,
  warmupIterations: 2,
  organizationId: 1 // Test with organization ID 1
};

/**
 * Test suite for critical queries
 */
const QUERY_TESTS = [
  {
    name: 'getRealTimeKPIs',
    category: 'Analytics',
    description: 'Real-time KPI dashboard metrics',
    expectedImprovement: '85%',
    fn: () => analyticsQueries.getRealTimeKPIs(BENCHMARK_CONFIG.organizationId)
  },
  {
    name: 'getAll (tickets)',
    category: 'Tickets',
    description: 'Fetch all tickets with details',
    expectedImprovement: '50%',
    fn: () => ticketQueries.getAll(BENCHMARK_CONFIG.organizationId)
  },
  {
    name: 'getSLAAnalytics (month)',
    category: 'Analytics',
    description: 'Monthly SLA performance analytics',
    expectedImprovement: '40%',
    fn: () => analyticsQueries.getSLAAnalytics(BENCHMARK_CONFIG.organizationId, 'month')
  },
  {
    name: 'getAgentPerformance (month)',
    category: 'Analytics',
    description: 'Monthly agent performance metrics',
    expectedImprovement: '45%',
    fn: () => analyticsQueries.getAgentPerformance(BENCHMARK_CONFIG.organizationId, 'month')
  },
  {
    name: 'getCategoryAnalytics (month)',
    category: 'Analytics',
    description: 'Category-based ticket analytics',
    expectedImprovement: '35%',
    fn: () => analyticsQueries.getCategoryAnalytics(BENCHMARK_CONFIG.organizationId, 'month')
  }
];

/**
 * Benchmark result for a single query
 */
interface BenchmarkResult {
  name: string;
  category: string;
  description: string;
  iterations: number;
  times: number[];
  avg: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  stdDev: number;
  expectedImprovement: string;
}

/**
 * Run benchmark for a single query
 */
async function benchmarkQuery(test: typeof QUERY_TESTS[0]): Promise<BenchmarkResult> {
  const times: number[] = [];

  console.log(`\n🧪 Benchmarking: ${test.name}`);
  console.log(`   ${test.description}`);

  // Warmup iterations (not counted)
  for (let i = 0; i < BENCHMARK_CONFIG.warmupIterations; i++) {
    try {
      test.fn();
    } catch (error) {
      console.log(`   ⚠️  Warmup iteration ${i + 1} failed (this is OK if table is empty)`);
    }
  }

  // Actual benchmark iterations
  for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
    const start = Date.now();
    try {
      test.fn();
      const duration = Date.now() - start;
      times.push(duration);
      process.stdout.write('.');
    } catch (error) {
      console.log(`\n   ⚠️  Iteration ${i + 1} failed:`, error);
      times.push(9999); // Add penalty time for failed queries
    }
  }

  console.log(' ✅');

  // Calculate statistics
  const sortedTimes = [...times].sort((a, b) => a - b);
  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const min = sortedTimes[0];
  const max = sortedTimes[sortedTimes.length - 1];
  const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
  const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

  // Standard deviation
  const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    name: test.name,
    category: test.category,
    description: test.description,
    iterations: BENCHMARK_CONFIG.iterations,
    times,
    avg,
    min,
    max,
    median,
    p95,
    stdDev,
    expectedImprovement: test.expectedImprovement
  };
}

/**
 * Print benchmark results table
 */
function printResults(results: BenchmarkResult[]) {
  console.log('\n');
  console.log('=' .repeat(120));
  console.log('📊 BENCHMARK RESULTS - AGENT 13 DATABASE OPTIMIZATIONS');
  console.log('=' .repeat(120));
  console.log(
    'Query'.padEnd(30) +
    'Category'.padEnd(15) +
    'Avg (ms)'.padEnd(12) +
    'Min (ms)'.padEnd(12) +
    'Max (ms)'.padEnd(12) +
    'Median'.padEnd(12) +
    'P95'.padEnd(12) +
    'Expected'
  );
  console.log('=' .repeat(120));

  for (const result of results) {
    console.log(
      result.name.padEnd(30) +
      result.category.padEnd(15) +
      result.avg.toFixed(1).padEnd(12) +
      result.min.toFixed(0).padEnd(12) +
      result.max.toFixed(0).padEnd(12) +
      result.median.toFixed(0).padEnd(12) +
      result.p95.toFixed(0).padEnd(12) +
      result.expectedImprovement
    );
  }

  console.log('=' .repeat(120));

  // Summary statistics
  const totalAvg = results.reduce((sum, r) => sum + r.avg, 0) / results.length;
  const totalQueries = results.reduce((sum, r) => sum + r.iterations, 0);

  console.log(`\nTotal queries executed: ${totalQueries}`);
  console.log(`Average query time: ${totalAvg.toFixed(1)}ms`);
  console.log(`Fastest query: ${Math.min(...results.map(r => r.min)).toFixed(0)}ms`);
  console.log(`Slowest query: ${Math.max(...results.map(r => r.max)).toFixed(0)}ms`);
}

/**
 * Analyze query plans for slow queries
 */
function analyzeSlowQueries(results: BenchmarkResult[]) {
  console.log('\n\n📋 SLOW QUERY ANALYSIS (avg > 100ms)\n');

  const slowQueries = results.filter(r => r.avg > 100);

  if (slowQueries.length === 0) {
    console.log('✅ No slow queries detected! All queries under 100ms.\n');
    return;
  }

  for (const query of slowQueries) {
    console.log(`⚠️  ${query.name}: ${query.avg.toFixed(1)}ms average`);
    console.log(`   ${query.description}`);
    console.log(`   Recommendation: Consider adding indexes or using materialized views`);
    console.log('');
  }
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(results: BenchmarkResult[]) {
  console.log('\n\n💡 OPTIMIZATION RECOMMENDATIONS\n');

  const recommendations: string[] = [];

  // Check for queries that could benefit from caching
  results.forEach(result => {
    if (result.avg > 50 && result.stdDev < 10) {
      recommendations.push(
        `✓ ${result.name}: Consistent timing (${result.avg.toFixed(1)}ms) - Good candidate for caching`
      );
    }

    if (result.avg > 100) {
      recommendations.push(
        `⚠ ${result.name}: Slow query (${result.avg.toFixed(1)}ms) - Consider optimizing or pre-computing`
      );
    }

    if (result.stdDev > 50) {
      recommendations.push(
        `⚠ ${result.name}: High variance (σ=${result.stdDev.toFixed(1)}ms) - Performance is inconsistent`
      );
    }
  });

  if (recommendations.length === 0) {
    console.log('✅ All queries performing well! No immediate optimizations needed.\n');
  } else {
    recommendations.forEach(rec => console.log(rec));
    console.log('');
  }
}

/**
 * Export results to JSON
 */
function exportResults(results: BenchmarkResult[]) {
  const output = {
    timestamp: new Date().toISOString(),
    config: BENCHMARK_CONFIG,
    results: results,
    summary: {
      totalQueries: results.reduce((sum, r) => sum + r.iterations, 0),
      averageTime: results.reduce((sum, r) => sum + r.avg, 0) / results.length,
      fastestQuery: Math.min(...results.map(r => r.min)),
      slowestQuery: Math.max(...results.map(r => r.max))
    }
  };

  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(process.cwd(), 'benchmark-results.json');

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results exported to: ${outputPath}\n`);
}

/**
 * Main benchmark runner
 */
async function runBenchmarks() {
  console.log('🚀 Starting Database Query Benchmarks');
  console.log(`   Organization ID: ${BENCHMARK_CONFIG.organizationId}`);
  console.log(`   Iterations per query: ${BENCHMARK_CONFIG.iterations}`);
  console.log(`   Warmup iterations: ${BENCHMARK_CONFIG.warmupIterations}`);

  // Get database stats
  console.log('\n📈 Database Statistics:');
  getDatabaseStats();

  // Reset query monitoring stats
  resetQueryStats();

  // Run benchmarks
  const results: BenchmarkResult[] = [];

  for (const test of QUERY_TESTS) {
    const result = await benchmarkQuery(test);
    results.push(result);
  }

  // Print results
  printResults(results);

  // Analyze slow queries
  analyzeSlowQueries(results);

  // Generate recommendations
  generateRecommendations(results);

  // Print query monitoring stats
  console.log('\n📊 Query Monitoring Statistics:\n');
  printQueryStats();

  // Export results
  exportResults(results);

  console.log('✅ Benchmark complete!\n');
}

// Run benchmarks
if (require.main === module) {
  runBenchmarks().catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
}

export { runBenchmarks, QUERY_TESTS };
