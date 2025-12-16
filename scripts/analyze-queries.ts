#!/usr/bin/env tsx

/**
 * Query Analysis Script
 * Analyzes query plans and identifies optimization opportunities
 */

import { pool } from '../lib/db/connection';
import queryMonitor from '../lib/db/monitor';
import { logger } from '../lib/monitoring/logger';

async function main() {
  logger.info('Database Query Analysis Tool\n');

  await pool.execute((db) => {
    // Queries to analyze
    const criticalQueries = [
      {
        name: 'Dashboard Metrics',
        sql: `
          SELECT
            COUNT(*) as total_tickets,
            SUM(CASE WHEN status_id = 1 THEN 1 ELSE 0 END) as open_tickets
          FROM tickets
          WHERE organization_id = ?
        `,
      },
      {
        name: 'Ticket List',
        sql: `
          SELECT t.*, u.name, c.name, p.name, s.name
          FROM tickets t
          INNER JOIN users u ON t.user_id = u.id
          INNER JOIN categories c ON t.category_id = c.id
          INNER JOIN priorities p ON t.priority_id = p.id
          INNER JOIN statuses s ON t.status_id = s.id
          WHERE t.organization_id = ?
        `,
      },
      {
        name: 'SLA Violations',
        sql: `
          SELECT t.*, st.response_due_at, st.resolution_due_at
          FROM tickets t
          INNER JOIN sla_tracking st ON t.id = st.ticket_id
          WHERE t.organization_id = ?
            AND st.response_met = 0
        `,
      },
      {
        name: 'Unread Notifications',
        sql: `
          SELECT *
          FROM notifications
          WHERE user_id = ? AND is_read = 0
          ORDER BY created_at DESC
        `,
      },
    ];

    logger.info('=== Query Plan Analysis ===\n');

    for (const query of criticalQueries) {
      logger.info(`\n--- ${query.name} ---`);
      logger.info(`SQL: ${query.sql.trim().substring(0, 100)}...\n`);

      try {
        const analysis = queryMonitor.analyzeQueryPlan(db, query.sql);

        logger.info('Query Plan:');
        logger.info(JSON.stringify(analysis.plan, null, 2));

        logger.info('\nAnalysis:');
        logger.info(`  Full Table Scan: ${analysis.hasFullScan ? '⚠️  YES' : '✅ NO'}`);
        logger.info(`  Index Scan: ${analysis.hasIndexScan ? '✅ YES' : '⚠️  NO'}`);

        if (analysis.warnings.length > 0) {
          logger.info('\n  Warnings:');
          for (const warning of analysis.warnings) {
            logger.info(`    ⚠️  ${warning}`);
          }
        } else {
          logger.info('  ✅ No warnings - query is optimized!');
        }
      } catch (error) {
        logger.error(`  ❌ Failed to analyze query: ${error}`);
      }

      logger.info('\n' + '='.repeat(60));
    }

    // Analyze indexes
    logger.info('\n\n=== Index Analysis ===\n');

    const indexes = db
      .prepare(
        `
      SELECT name, tbl_name, sql
      FROM sqlite_master
      WHERE type = 'index'
        AND tbl_name IN ('tickets', 'users', 'comments', 'notifications', 'sla_tracking')
      ORDER BY tbl_name, name
    `
      )
      .all() as Array<{ name: string; tbl_name: string; sql: string | null }>;

    const indexesByTable: Record<string, Array<{ name: string; sql: string | null }>> = {};

    for (const index of indexes) {
      if (!indexesByTable[index.tbl_name]) {
        indexesByTable[index.tbl_name] = [];
      }
      indexesByTable[index.tbl_name].push({
        name: index.name,
        sql: index.sql,
      });
    }

    for (const [table, tableIndexes] of Object.entries(indexesByTable)) {
      logger.info(`\n${table} (${tableIndexes.length} indexes):`);
      for (const index of tableIndexes) {
        logger.info(`  - ${index.name}`);
        if (index.sql && index.sql.includes('WHERE')) {
          logger.info(`    (Partial Index)`);
        }
      }
    }

    // Database statistics
    logger.info('\n\n=== Database Statistics ===\n');

    const tables = ['tickets', 'users', 'comments', 'notifications', 'sla_tracking'];

    for (const table of tables) {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
        count: number;
      };
      const size = db.prepare(`SELECT page_count * page_size as size FROM pragma_page_count('${table}'), pragma_page_size()`).get() as { size: number } | undefined;

      logger.info(`${table}:`);
      logger.info(`  Rows: ${count.count.toLocaleString()}`);
      if (size) {
        logger.info(`  Size: ${(size.size / 1024).toFixed(2)} KB`);
      }
    }
  });

  logger.info('\n\n✅ Analysis complete!');
}

main();
