import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');

/**
 * OpenAPI Specification Endpoint
 *
 * Serves the OpenAPI YAML specification file.
 * Accessible at /api/docs/openapi.yaml
 */
export async function GET(req: NextRequest) {
  try {
    const origin = req.headers.get('origin') || '';
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    // Read the OpenAPI spec from the root directory
    const openApiPath = join(process.cwd(), 'openapi.yaml')
    const openApiContent = readFileSync(openApiPath, 'utf-8')

    return new NextResponse(openApiContent, {
      headers: {
        'Content-Type': 'application/x-yaml',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error reading OpenAPI spec:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load OpenAPI specification',
      },
      { status: 500 }
    )
  }
}

/**
 * CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
