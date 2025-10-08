import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    const priorities = db.prepare(`
      SELECT id, name, level, color, created_at, updated_at
      FROM priorities
      WHERE tenant_id = ?
      ORDER BY level
    `).all(tenantContext.id)

    return NextResponse.json({
      success: true,
      priorities
    })
  } catch (error) {
    logger.error('Error fetching priorities', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

