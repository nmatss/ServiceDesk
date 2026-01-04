#!/usr/bin/env tsx
/**
 * Apply Performance Optimizations Script
 *
 * Automated script to apply all performance optimizations
 * created by Agent 12.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '../servicedesk.db');
const INDEXES_SQL = path.join(__dirname, '../lib/db/performance-indexes.sql');

interface OptimizationResult {
  step: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
  duration?: number;
}

const results: OptimizationResult[] = [];

/**
 * Step 1: Backup database
 */
async function backupDatabase(): Promise<OptimizationResult> {
  const startTime = Date.now();

  try {
    console.log('📦 Step 1: Creating database backup...');

    const backupPath = path.join(__dirname, `../servicedesk.backup.${Date.now()}.db`);
    fs.copyFileSync(DB_PATH, backupPath);

    const duration = Date.now() - startTime;
    console.log(`✅ Backup created: ${backupPath} (${duration}ms)\n`);

    return {
      step: 'Database Backup',
      status: 'success',
      message: `Backup created at ${backupPath}`,
      duration,
    };
  } catch (error) {
    return {
      step: 'Database Backup',
      status: 'error',
      message: `Failed to create backup: ${error}`,
    };
  }
}

/**
 * Step 2: Apply performance indexes
 */
async function applyPerformanceIndexes(): Promise<OptimizationResult> {
  const startTime = Date.now();

  try {
    console.log('🔧 Step 2: Applying performance indexes...');

    // Read indexes SQL file
    if (!fs.existsSync(INDEXES_SQL)) {
      throw new Error(`Indexes file not found: ${INDEXES_SQL}`);
    }

    const indexesSQL = fs.readFileSync(INDEXES_SQL, 'utf-8');

    // Connect to database
    const db = new Database(DB_PATH);

    // Count existing indexes
    const beforeCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as { count: number };

    // Apply indexes
    db.exec(indexesSQL);

    // Count new indexes
    const afterCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as { count: number };

    const newIndexes = afterCount.count - beforeCount.count;

    db.close();

    const duration = Date.now() - startTime;
    console.log(`✅ Applied ${newIndexes} new performance indexes (${duration}ms)\n`);

    return {
      step: 'Performance Indexes',
      status: 'success',
      message: `Applied ${newIndexes} new indexes`,
      duration,
    };
  } catch (error) {
    return {
      step: 'Performance Indexes',
      status: 'error',
      message: `Failed to apply indexes: ${error}`,
    };
  }
}

/**
 * Step 3: Update database statistics
 */
async function updateStatistics(): Promise<OptimizationResult> {
  const startTime = Date.now();

  try {
    console.log('📊 Step 3: Updating database statistics...');

    const db = new Database(DB_PATH);

    // Run ANALYZE to update query planner statistics
    db.exec('ANALYZE;');

    db.close();

    const duration = Date.now() - startTime;
    console.log(`✅ Database statistics updated (${duration}ms)\n`);

    return {
      step: 'Update Statistics',
      status: 'success',
      message: 'Statistics updated successfully',
      duration,
    };
  } catch (error) {
    return {
      step: 'Update Statistics',
      status: 'error',
      message: `Failed to update statistics: ${error}`,
    };
  }
}

/**
 * Step 4: Verify indexes
 */
async function verifyIndexes(): Promise<OptimizationResult> {
  const startTime = Date.now();

  try {
    console.log('🔍 Step 4: Verifying indexes...');

    const db = new Database(DB_PATH);

    // Get list of performance indexes
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index'
        AND name LIKE 'idx_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    // Verify key indexes exist
    const keyIndexes = [
      'idx_tickets_org_created_date',
      'idx_tickets_org_created_datetime',
      'idx_sla_tracking_org_response',
      'idx_sla_tracking_metrics',
      'idx_tickets_agent_org_status',
    ];

    const missing: string[] = [];
    for (const keyIndex of keyIndexes) {
      if (!indexes.some(idx => idx.name === keyIndex)) {
        missing.push(keyIndex);
      }
    }

    db.close();

    const duration = Date.now() - startTime;

    if (missing.length > 0) {
      console.log(`⚠️  Warning: Missing ${missing.length} key indexes:\n`);
      missing.forEach(idx => console.log(`   - ${idx}`));
      console.log('');

      return {
        step: 'Verify Indexes',
        status: 'error',
        message: `Missing ${missing.length} key indexes: ${missing.join(', ')}`,
        duration,
      };
    }

    console.log(`✅ All ${keyIndexes.length} key indexes verified (${duration}ms)\n`);

    return {
      step: 'Verify Indexes',
      status: 'success',
      message: `All ${keyIndexes.length} key indexes verified`,
      duration,
    };
  } catch (error) {
    return {
      step: 'Verify Indexes',
      status: 'error',
      message: `Failed to verify indexes: ${error}`,
    };
  }
}

/**
 * Step 5: Test query performance
 */
async function testQueryPerformance(): Promise<OptimizationResult> {
  const startTime = Date.now();

  try {
    console.log('⚡ Step 5: Testing query performance...');

    const db = new Database(DB_PATH);

    // Test optimized KPI query
    const queryStart = Date.now();
    const result = db.prepare(`
      WITH ticket_metrics AS (
        SELECT
          COUNT(*) FILTER (WHERE date(created_at) = date('now')) as tickets_today,
          COUNT(*) FILTER (WHERE datetime(created_at) >= datetime('now', '-7 days')) as tickets_this_week,
          COUNT(*) as total_tickets
        FROM tickets
        WHERE organization_id = 1
      )
      SELECT * FROM ticket_metrics
    `).get();
    const queryDuration = Date.now() - queryStart;

    db.close();

    const totalDuration = Date.now() - startTime;

    console.log(`   Query result:`, result);
    console.log(`   Query time: ${queryDuration}ms`);

    if (queryDuration > 200) {
      console.log(`⚠️  Warning: Query slower than expected (${queryDuration}ms > 200ms)\n`);
    } else {
      console.log(`✅ Query performance excellent (${queryDuration}ms < 200ms)\n`);
    }

    return {
      step: 'Test Query Performance',
      status: queryDuration > 200 ? 'error' : 'success',
      message: `Query executed in ${queryDuration}ms`,
      duration: totalDuration,
    };
  } catch (error) {
    return {
      step: 'Test Query Performance',
      status: 'error',
      message: `Failed to test query: ${error}`,
    };
  }
}

/**
 * Step 6: Generate report
 */
async function generateReport(): Promise<OptimizationResult> {
  const startTime = Date.now();

  try {
    console.log('📄 Step 6: Generating optimization report...');

    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = path.join(reportsDir, `optimization-${Date.now()}.json`);

    const report = {
      timestamp: new Date().toISOString(),
      steps: results,
      summary: {
        totalSteps: results.length,
        successfulSteps: results.filter(r => r.status === 'success').length,
        failedSteps: results.filter(r => r.status === 'error').length,
        totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
      },
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    const duration = Date.now() - startTime;
    console.log(`✅ Report saved: ${reportPath} (${duration}ms)\n`);

    return {
      step: 'Generate Report',
      status: 'success',
      message: `Report saved to ${reportPath}`,
      duration,
    };
  } catch (error) {
    return {
      step: 'Generate Report',
      status: 'error',
      message: `Failed to generate report: ${error}`,
    };
  }
}

/**
 * Display summary
 */
function displaySummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 OPTIMIZATION SUMMARY');
  console.log('='.repeat(80) + '\n');

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  console.log(`Total Steps: ${results.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log('');

  console.log('Step Results:');
  results.forEach((result, index) => {
    const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⏭️';
    console.log(`${index + 1}. ${icon} ${result.step}: ${result.message} (${result.duration || 0}ms)`);
  });

  console.log('\n' + '='.repeat(80));

  if (errorCount === 0) {
    console.log('🎉 All optimizations applied successfully!');
    console.log('\nNext steps:');
    console.log('  1. Run benchmarks: npm run db:benchmark');
    console.log('  2. Test dashboard performance in browser');
    console.log('  3. Review PERFORMANCE_QUICK_START.md for next steps');
  } else {
    console.log('⚠️  Some optimizations failed. Please review the errors above.');
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 APPLYING PERFORMANCE OPTIMIZATIONS');
  console.log('='.repeat(80) + '\n');

  // Execute optimization steps
  results.push(await backupDatabase());
  results.push(await applyPerformanceIndexes());
  results.push(await updateStatistics());
  results.push(await verifyIndexes());
  results.push(await testQueryPerformance());
  results.push(await generateReport());

  // Display summary
  displaySummary();

  // Exit with appropriate code
  const hasErrors = results.some(r => r.status === 'error');
  process.exit(hasErrors ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main, backupDatabase, applyPerformanceIndexes, updateStatistics, verifyIndexes, testQueryPerformance };
