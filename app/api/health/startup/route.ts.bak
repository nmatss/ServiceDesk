/**
 * Startup Probe Endpoint
 *
 * Kubernetes startup probe - checks if the application has finished starting up.
 * This probe allows slow-starting containers more time to initialize.
 * Once successful, liveness and readiness probes take over.
 *
 * Endpoint: GET /api/health/startup
 * Response: 200 OK if started, 503 if still starting
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

// Track startup state
let isStartupComplete = false;
let startupCheckedAt: Date | null = null;

/**
 * Perform comprehensive startup checks
 */
async function performStartupChecks(): Promise<{
  complete: boolean;
  checks: Record<string, any>;
}> {
  const checks: Record<string, any> = {};

  // Check database schema
  try {
    const tables = db
      .prepare(
        `
      SELECT name FROM sqlite_master
      WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `
      )
      .all() as { name: string }[];

    checks.database_schema = {
      status: tables.length > 0 ? 'ok' : 'error',
      tables_count: tables.length,
      message: tables.length > 0 ? 'Database schema initialized' : 'No tables found',
    };
  } catch (error) {
    checks.database_schema = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to check database schema',
    };
  }

  // Check critical tables exist
  const requiredTables = [
    'users',
    'tickets',
    'categories',
    'priorities',
    'statuses',
    'notifications',
  ];
  const missingTables: string[] = [];

  for (const table of requiredTables) {
    try {
      const result = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(table);
      if (!result) {
        missingTables.push(table);
      }
    } catch (error) {
      missingTables.push(table);
    }
  }

  checks.required_tables = {
    status: missingTables.length === 0 ? 'ok' : 'error',
    missing: missingTables,
    message:
      missingTables.length === 0
        ? 'All required tables exist'
        : `Missing tables: ${missingTables.join(', ')}`,
  };

  // Check environment variables
  const requiredEnvVars = ['NODE_ENV'];
  const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  checks.environment = {
    status: missingEnvVars.length === 0 ? 'ok' : 'warning',
    missing: missingEnvVars,
    message:
      missingEnvVars.length === 0
        ? 'Environment variables configured'
        : `Missing env vars: ${missingEnvVars.join(', ')}`,
  };

  // Determine if startup is complete
  const complete =
    checks.database_schema.status === 'ok' && checks.required_tables.status === 'ok';

  return { complete, checks };
}

/**
 * GET /api/health/startup
 *
 * Check if application startup is complete
 */
export async function GET(_request: NextRequest) {
  const startTime = Date.now();

  // If already marked as complete, return immediately
  if (isStartupComplete) {
    return NextResponse.json(
      {
        status: 'complete',
        complete: true,
        timestamp: new Date().toISOString(),
        startupCheckedAt: startupCheckedAt?.toISOString(),
        message: 'Application startup complete',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  }

  // Perform startup checks
  const { complete, checks } = await performStartupChecks();

  if (complete) {
    isStartupComplete = true;
    startupCheckedAt = new Date();
  }

  const duration = Date.now() - startTime;

  return NextResponse.json(
    {
      status: complete ? 'complete' : 'starting',
      complete,
      timestamp: new Date().toISOString(),
      checks,
      checkDuration: duration,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.DD_VERSION || '1.0.0',
    },
    {
      status: complete ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
