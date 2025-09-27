import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import db from '@/lib/db/connection'
import { getTenantContextFromRequest } from '@/lib/tenant/context'

export async function GET(request: NextRequest) {
  try {
    // Get tenant context from middleware
    const tenantContext = getTenantContextFromRequest(request)

    if (!tenantContext) {
      return NextResponse.json(
        { error: 'Tenant não encontrado' },
        { status: 400 }
      )
    }

    // Query categories with tenant isolation
    const categories = db.prepare(`
      SELECT id, name, description, color, created_at, updated_at
      FROM categories
      WHERE tenant_id = ?
      ORDER BY name
    `).all(tenantContext.id)

    return NextResponse.json({
      success: true,
      categories
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

