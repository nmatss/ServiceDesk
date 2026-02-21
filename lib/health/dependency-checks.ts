import { createClient } from 'redis';
import { executeQuery, executeQueryOne } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';

export type HealthCheckStatus = 'ok' | 'error' | 'warning' | 'skipped';

export interface HealthCheckResult {
  status: HealthCheckStatus;
  message?: string;
  metadata?: Record<string, unknown>;
}

function isStrictHealthMode(): boolean {
  return process.env.HEALTH_STRICT_DEPENDENCIES === 'true' || process.env.NODE_ENV === 'production';
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  try {
    const row = await executeQueryOne<{ test: number }>('SELECT 1 AS test');
    if (!row || Number(row.test) !== 1) {
      return {
        status: 'error',
        message: 'Database returned unexpected result',
      };
    }

    return {
      status: 'ok',
      message: 'Database connection successful',
      metadata: {
        type: getDatabaseType(),
      },
    };
  } catch (error) {
    if (!isStrictHealthMode() && getDatabaseType() === 'postgresql') {
      return {
        status: 'warning',
        message: error instanceof Error ? error.message : 'Database connection failed',
        metadata: {
          type: getDatabaseType(),
          degraded: true,
          strictMode: false,
        },
      };
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database connection failed',
      metadata: {
        type: getDatabaseType(),
      },
    };
  }
}

export async function listCurrentTables(): Promise<string[]> {
  const dbType = getDatabaseType();

  if (dbType === 'postgresql') {
    const rows = await executeQuery<{ table_name: string }>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
      `
    );
    return rows.map((row) => row.table_name);
  }

  const rows = await executeQuery<{ name: string }>(
    `
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
    `
  );
  return rows.map((row) => row.name);
}

export async function checkRequiredTables(requiredTables: string[]): Promise<HealthCheckResult> {
  try {
    const currentTables = await listCurrentTables();
    const currentSet = new Set(currentTables.map((table) => table.toLowerCase()));
    const missing = requiredTables.filter((table) => !currentSet.has(table.toLowerCase()));

    if (missing.length > 0) {
      return {
        status: 'error',
        message: `Missing required tables: ${missing.join(', ')}`,
        metadata: {
          missing,
          totalTables: currentTables.length,
        },
      };
    }

    return {
      status: 'ok',
      message: 'All required tables are available',
      metadata: {
        totalTables: currentTables.length,
      },
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to inspect database tables',
    };
  }
}

export async function checkRedisHealth(): Promise<HealthCheckResult> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return {
      status: 'skipped',
      message: 'REDIS_URL not configured',
    };
  }

  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: () => false,
    },
  });

  try {
    await client.connect();
    const pong = await client.ping();

    if (pong !== 'PONG') {
      return {
        status: 'error',
        message: 'Redis ping returned unexpected response',
      };
    }

    return {
      status: 'ok',
      message: 'Redis connection successful',
    };
  } catch (error) {
    if (!isStrictHealthMode()) {
      return {
        status: 'warning',
        message: error instanceof Error ? error.message : 'Redis connection failed',
        metadata: {
          degraded: true,
          strictMode: false,
        },
      };
    }

    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Redis connection failed',
    };
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}
