/**
 * Database Performance Statistics API
 * Exposes query performance metrics, cache stats, and pool stats
 */

import { logger } from '@/lib/monitoring/logger';
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db/adapter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Database table row counts
    const tables = ['tickets', 'users', 'comments', 'notifications', 'sla_tracking'];
    const dbStats: Record<string, { count: number }> = {};

    for (const table of tables) {
      try {
        const result = await executeQuery<{ count: number }>(
          `SELECT COUNT(*) as count FROM ${table}`,
          []
        );
        dbStats[table] = { count: result[0]?.count || 0 };
      } catch {
        dbStats[table] = { count: 0 };
      }
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      database: {
        tables: dbStats,
      },
      health: {
        status: 'healthy',
      },
    });
  } catch (error) {
    logger.error('Failed to fetch database stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database statistics' },
      { status: 500 }
    );
  }
}
