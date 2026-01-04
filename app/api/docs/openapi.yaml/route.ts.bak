import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * OpenAPI Specification Endpoint
 *
 * Serves the OpenAPI YAML specification file.
 * Accessible at /api/docs/openapi.yaml
 */
export async function GET() {
  try {
    // Read the OpenAPI spec from the root directory
    const openApiPath = join(process.cwd(), 'openapi.yaml')
    const openApiContent = readFileSync(openApiPath, 'utf-8')

    return new NextResponse(openApiContent, {
      headers: {
        'Content-Type': 'application/x-yaml',
        'Access-Control-Allow-Origin': '*',
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
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
