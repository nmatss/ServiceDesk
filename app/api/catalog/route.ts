/**
 * Service Catalog API
 *
 * Provides endpoints for managing Service Catalog items and service requests.
 * Supports ITIL Service Request Management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import { logger } from '@/lib/monitoring/logger'
import { z } from 'zod'
import { jsonWithCache } from '@/lib/api/cache-headers'
import { cacheInvalidation } from '@/lib/api/cache'

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Validation schemas
const catalogItemSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório'),
  short_description: z.string().optional(),
  description: z.string().optional(),
  category_id: z.number().int().positive(),
  icon: z.string().default('document'),
  image_url: z.string().url().optional(),
  display_order: z.number().int().default(0),
  form_schema: z.record(z.string(), z.any()).optional(),
  default_priority_id: z.number().int().positive().optional(),
  default_category_id: z.number().int().positive().optional(),
  sla_policy_id: z.number().int().positive().optional(),
  estimated_time_minutes: z.number().int().positive().optional(),
  fulfillment_team_id: z.number().int().positive().optional(),
  requires_approval: z.boolean().default(false),
  cost: z.string().optional(),
  is_published: z.boolean().default(true),
  is_active: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
})

const serviceRequestSchema = z.object({
  catalog_item_id: z.number().int().positive(),
  form_data: z.record(z.string(), z.any()),
  justification: z.string().optional(),
  requested_date: z.string().optional(),
  on_behalf_of_id: z.number().int().positive().optional()
})

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  is_public: z.coerce.boolean().optional(),
  is_featured: z.coerce.boolean().optional(),
  is_active: z.coerce.boolean().optional()
})

/**
 * Generate unique service request number
 */
async function generateRequestNumber(): Promise<string> {
  const result = await executeQueryOne<{ max_num: number | null }>(
    `SELECT MAX(CAST(SUBSTR(request_number, 4) AS INTEGER)) as max_num
     FROM service_requests WHERE request_number LIKE 'SR-%'`,
    []
  )

  const nextNum = (result?.max_num || 0) + 1
  return `SR-${String(nextNum).padStart(5, '0')}`
}

/**
 * GET /api/catalog - List Service Catalog Items
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { organizationId } = guard.auth!

    const { searchParams } = new URL(request.url)
    const params = querySchema.parse(Object.fromEntries(searchParams))

    const offset = (params.page - 1) * params.limit

    // Build query
    let whereClause = 'WHERE sc.organization_id = ?'
    const queryParams: (string | number | boolean)[] = [organizationId]

    if (params.search) {
      whereClause += ` AND (sc.name LIKE ? OR sc.short_description LIKE ? OR sc.keywords LIKE ?)`
      const searchPattern = `%${params.search}%`
      queryParams.push(searchPattern, searchPattern, searchPattern)
    }

    if (params.category_id) {
      whereClause += ' AND sc.category_id = ?'
      queryParams.push(params.category_id)
    }

    if (params.is_public !== undefined) {
      whereClause += ' AND sc.is_public = ?'
      queryParams.push(params.is_public ? 1 : 0)
    }

    if (params.is_featured !== undefined) {
      whereClause += ' AND sc.is_featured = ?'
      queryParams.push(params.is_featured ? 1 : 0)
    }

    if (params.is_active !== undefined) {
      whereClause += ' AND sc.is_active = ?'
      queryParams.push(params.is_active ? 1 : 0)
    }

    // Get total count
    const countResult = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM service_catalog_items sc ${whereClause}`,
      queryParams
    )

    // Get catalog items with categories
    const items = await executeQuery<any>(
      `SELECT
        sc.*,
        cat.name as category_name,
        cat.slug as category_slug,
        cat.icon as category_icon,
        cat.color as category_color
      FROM service_catalog_items sc
      LEFT JOIN service_categories cat ON sc.category_id = cat.id
      ${whereClause}
      ORDER BY sc.display_order ASC, sc.name ASC
      LIMIT ? OFFSET ?`,
      [...queryParams, params.limit, offset]
    )

    // Get categories for filtering
    const categories = await executeQuery<any>(
      `SELECT id, name, slug, icon, color, description
      FROM service_categories
      WHERE organization_id = ? AND is_active = 1
      ORDER BY display_order ASC, name ASC`,
      [organizationId]
    )

    return jsonWithCache({
      success: true,
      catalog_items: items,
      categories,
      pagination: {
        total: countResult?.total || 0,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil((countResult?.total || 0) / params.limit)
      }
    }, 'STATIC') // Cache for 10 minutes
  } catch (error) {
    logger.error('Error listing catalog items', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar itens do catálogo' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/catalog - Create Service Catalog Item (Admin only)
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request)
    if (guard.response) return guard.response
    const { userId, organizationId, role } = guard.auth!

    // Only admins can create catalog items
    if (role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Apenas administradores podem criar itens do catálogo' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = catalogItemSchema.parse(body)

    // Check if slug is unique
    const existing = await executeQueryOne<{ id: number }>(
      `SELECT id FROM service_catalog_items WHERE slug = ? AND organization_id = ?`,
      [data.slug, organizationId]
    )

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Já existe um item com este slug' },
        { status: 400 }
      )
    }

    const result = await executeRun(
      `INSERT INTO service_catalog_items (
        name, slug, short_description, description, category_id, organization_id,
        icon, image_url, display_order, form_schema, default_priority_id,
        default_category_id, sla_policy_id, estimated_time_minutes,
        fulfillment_team_id, requires_approval, cost,
        is_published, is_active, tags, created_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        data.name,
        data.slug,
        data.short_description || null,
        data.description || null,
        data.category_id,
        organizationId,
        data.icon,
        data.image_url || null,
        data.display_order,
        data.form_schema ? JSON.stringify(data.form_schema) : null,
        data.default_priority_id || null,
        data.default_category_id || null,
        data.sla_policy_id || null,
        data.estimated_time_minutes || null,
        data.fulfillment_team_id || null,
        data.requires_approval ? 1 : 0,
        data.cost || null,
        data.is_published ? 1 : 0,
        data.is_active ? 1 : 0,
        data.tags ? JSON.stringify(data.tags) : null,
        userId
      ]
    )

    const item = await executeQueryOne<any>(
      `SELECT * FROM service_catalog_items WHERE id = ?`,
      [result.lastInsertRowid]
    )

    logger.info(`Catalog item created: ${data.name} by user ${userId}`)

    // Invalidate catalog cache
    await cacheInvalidation.catalog()

    return NextResponse.json({
      success: true,
      catalog_item: item,
      message: 'Item do catálogo criado com sucesso'
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('Error creating catalog item', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao criar item do catálogo' },
      { status: 500 }
    )
  }
}
