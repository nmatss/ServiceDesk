/**
 * WhatsApp Contacts API
 * List and create/update WhatsApp contacts with tenant isolation
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun, type SqlParam } from '@/lib/db/adapter';
import { sqlNow, getDbType } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * GET - List WhatsApp contacts
 * Supports search by name/phone, pagination, optional stats
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, context, response } = requireTenantUserContext(request);
  if (response) return response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);
    const offset = (page - 1) * limit;
    const includeStats = searchParams.get('includeStats') === 'true';

    const conditions: string[] = [];
    const params: SqlParam[] = [];
    const countParams: SqlParam[] = [];

    // Org scoping for PostgreSQL (SQLite tables lack organization_id)
    if (getDbType() === 'postgresql') {
      conditions.push('c.organization_id = ?');
      params.push(auth!.organizationId);
      countParams.push(auth!.organizationId);
    }

    // Search by name or phone
    if (search) {
      const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const nameCol = getDbType() === 'postgresql' ? 'c.name' : 'c.display_name';
      conditions.push(`(c.phone_number LIKE ? ESCAPE '\\' OR ${nameCol} LIKE ? ESCAPE '\\')`);
      const searchPattern = `%${escaped}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countRow = await executeQueryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM whatsapp_contacts c ${whereClause}`,
      countParams
    );
    const total = countRow?.total || 0;

    // Fetch contacts with last message info
    const nameCol = getDbType() === 'postgresql' ? 'c.name' : 'c.display_name';
    const contacts = await executeQuery<Record<string, SqlParam>>(
      `SELECT
        c.id,
        c.phone_number,
        ${nameCol} as display_name,
        c.profile_picture_url,
        c.user_id,
        c.created_at,
        c.updated_at,
        COUNT(DISTINCT m.id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM whatsapp_contacts c
      LEFT JOIN whatsapp_messages m ON ${
        getDbType() === 'postgresql'
          ? 'm.session_id IN (SELECT s.id FROM whatsapp_sessions s WHERE s.phone_number = c.phone_number)'
          : 'm.contact_id = c.id'
      }
      ${whereClause}
      GROUP BY c.id, c.phone_number, ${nameCol}, c.profile_picture_url, c.user_id, c.created_at, c.updated_at
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    let stats = null;
    if (includeStats) {
      const orgCondition = getDbType() === 'postgresql'
        ? 'WHERE c.organization_id = ?'
        : '';
      const orgParams: SqlParam[] = getDbType() === 'postgresql'
        ? [auth!.organizationId]
        : [];

      stats = await executeQueryOne<Record<string, number>>(
        `SELECT
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN c.created_at >= ${sqlNow()} - INTERVAL '7 days' THEN 1 END) as new_this_week
        FROM whatsapp_contacts c
        ${orgCondition}`,
        orgParams
      );
    }

    return apiSuccess({
      contacts,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching WhatsApp contacts', error);
    return apiError('Failed to fetch contacts', 500);
  }
}

/**
 * POST - Create or update a WhatsApp contact (upsert by phone_number + org)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, context, response } = requireTenantUserContext(request);
  if (response) return response;

  try {
    const body = await request.json();
    const { phone_number, display_name, profile_picture_url, user_id } = body;

    if (!phone_number || typeof phone_number !== 'string') {
      return apiError('phone_number is required', 400);
    }

    // Validate phone number format (E.164)
    if (!/^\+\d{10,15}$/.test(phone_number)) {
      return apiError('Invalid phone number format. Use E.164 format (e.g. +5511999999999)', 400);
    }

    const isPg = getDbType() === 'postgresql';
    const nameCol = isPg ? 'name' : 'display_name';

    // Check if contact already exists (by phone + org)
    const existingConditions = ['phone_number = ?'];
    const existingParams: SqlParam[] = [phone_number];
    if (isPg) {
      existingConditions.push('organization_id = ?');
      existingParams.push(auth!.organizationId);
    }

    const existing = await executeQueryOne<{ id: number }>(
      `SELECT id FROM whatsapp_contacts WHERE ${existingConditions.join(' AND ')}`,
      existingParams
    );

    if (existing) {
      // Update existing contact
      await executeRun(
        `UPDATE whatsapp_contacts
         SET ${nameCol} = ?, profile_picture_url = ?, user_id = ?, updated_at = ${sqlNow()}
         WHERE id = ?`,
        [
          display_name || null,
          profile_picture_url || null,
          user_id || null,
          existing.id,
        ]
      );

      const updated = await executeQueryOne<Record<string, SqlParam>>(
        `SELECT id, phone_number, ${nameCol} as display_name, profile_picture_url, user_id, created_at, updated_at
         FROM whatsapp_contacts WHERE id = ?`,
        [existing.id]
      );

      return apiSuccess(updated, { message: 'Contact updated' });
    } else {
      // Create new contact
      const insertCols = isPg
        ? `phone_number, ${nameCol}, profile_picture_url, user_id, organization_id, created_at, updated_at`
        : `phone_number, ${nameCol}, profile_picture_url, user_id, created_at, updated_at`;

      const insertPlaceholders = isPg
        ? `?, ?, ?, ?, ?, ${sqlNow()}, ${sqlNow()}`
        : `?, ?, ?, ?, ${sqlNow()}, ${sqlNow()}`;

      const insertParams: SqlParam[] = isPg
        ? [phone_number, display_name || null, profile_picture_url || null, user_id || null, auth!.organizationId]
        : [phone_number, display_name || null, profile_picture_url || null, user_id || null];

      const result = await executeRun(
        `INSERT INTO whatsapp_contacts (${insertCols}) VALUES (${insertPlaceholders})`,
        insertParams
      );

      const newId = result.lastInsertRowid;
      const created = await executeQueryOne<Record<string, SqlParam>>(
        `SELECT id, phone_number, ${nameCol} as display_name, profile_picture_url, user_id, created_at, updated_at
         FROM whatsapp_contacts WHERE id = ?`,
        [newId as number]
      );

      return apiSuccess(created, { message: 'Contact created', status: 201 });
    }
  } catch (error) {
    logger.error('Error creating/updating WhatsApp contact', error);
    return apiError('Failed to create/update contact', 500);
  }
}
