/**
 * WhatsApp Messages API
 * Query messages with filters, pagination, and contact info
 */

import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, type SqlParam } from '@/lib/db/adapter';
import { getDbType } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * GET - Query WhatsApp messages
 * Filters: contact_id, session_id, direction, message_type, date range
 * Includes contact name via JOIN
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const { auth, context, response } = requireTenantUserContext(request);
  if (response) return response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const contactId = searchParams.get('contactId');
    const sessionId = searchParams.get('sessionId');
    const ticketId = searchParams.get('ticketId');
    const direction = searchParams.get('direction');
    const messageType = searchParams.get('messageType');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);
    const offset = (page - 1) * limit;

    const isPg = getDbType() === 'postgresql';
    const conditions: string[] = [];
    const params: SqlParam[] = [];
    const countParams: SqlParam[] = [];

    if (isPg) {
      // Messages table in PG uses session_id -> whatsapp_sessions which has organization_id
      // Join through sessions for org scoping
      conditions.push('s.organization_id = ?');
      params.push(auth!.organizationId);
      countParams.push(auth!.organizationId);
    }

    if (contactId) {
      if (isPg) {
        // In PG, filter by contact's phone through session
        conditions.push('s.phone_number = (SELECT phone_number FROM whatsapp_contacts WHERE id = ?)');
      } else {
        conditions.push('m.contact_id = ?');
      }
      params.push(parseInt(contactId, 10));
      countParams.push(parseInt(contactId, 10));
    }

    if (sessionId) {
      if (isPg) {
        conditions.push('m.session_id = ?');
      } else {
        // SQLite messages don't have session_id, filter by contact through session phone
        conditions.push('m.contact_id IN (SELECT wc.id FROM whatsapp_contacts wc JOIN whatsapp_sessions ws ON ws.phone_number = wc.phone_number WHERE ws.id = ?)');
      }
      params.push(parseInt(sessionId, 10));
      countParams.push(parseInt(sessionId, 10));
    }

    if (ticketId) {
      if (isPg) {
        // PG messages don't have ticket_id, but sessions do
        conditions.push('s.ticket_id = ?');
      } else {
        conditions.push('m.ticket_id = ?');
      }
      params.push(parseInt(ticketId, 10));
      countParams.push(parseInt(ticketId, 10));
    }

    if (direction && ['inbound', 'outbound'].includes(direction)) {
      conditions.push('m.direction = ?');
      params.push(direction);
      countParams.push(direction);
    }

    if (messageType) {
      conditions.push('m.message_type = ?');
      params.push(messageType);
      countParams.push(messageType);
    }

    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!isNaN(d.getTime())) {
        conditions.push('m.created_at >= ?');
        params.push(d.toISOString());
        countParams.push(d.toISOString());
      }
    }

    if (dateTo) {
      const d = new Date(dateTo);
      if (!isNaN(d.getTime())) {
        conditions.push('m.created_at <= ?');
        params.push(d.toISOString());
        countParams.push(d.toISOString());
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build queries based on DB type
    let countSql: string;
    let selectSql: string;

    if (isPg) {
      // PostgreSQL: messages JOIN sessions JOIN contacts
      const joinClause = `FROM whatsapp_messages m
        JOIN whatsapp_sessions s ON m.session_id = s.id
        LEFT JOIN whatsapp_contacts c ON c.phone_number = s.phone_number AND c.organization_id = s.organization_id`;

      countSql = `SELECT COUNT(*) as total ${joinClause} ${whereClause}`;

      selectSql = `SELECT
        m.id,
        m.session_id,
        m.direction,
        m.message_type,
        m.content,
        m.media_url,
        m.status,
        m.external_id as message_id,
        m.created_at,
        c.id as contact_id,
        c.phone_number as contact_phone,
        c.name as contact_name,
        c.profile_picture_url as contact_picture
      ${joinClause}
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?`;
    } else {
      // SQLite: messages JOIN contacts directly
      const joinClause = `FROM whatsapp_messages m
        LEFT JOIN whatsapp_contacts c ON m.contact_id = c.id`;

      countSql = `SELECT COUNT(*) as total ${joinClause} ${whereClause}`;

      selectSql = `SELECT
        m.id,
        m.contact_id,
        m.ticket_id,
        m.message_id,
        m.direction,
        m.message_type,
        m.content,
        m.media_url,
        m.media_mime_type,
        m.media_caption,
        m.status,
        m.timestamp,
        m.created_at,
        c.phone_number as contact_phone,
        c.display_name as contact_name,
        c.profile_picture_url as contact_picture
      ${joinClause}
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?`;
    }

    const countRow = await executeQueryOne<{ total: number }>(countSql, countParams);
    const total = countRow?.total || 0;

    const messages = await executeQuery<Record<string, SqlParam>>(
      selectSql,
      [...params, limit, offset]
    );

    return apiSuccess({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching WhatsApp messages', error);
    return apiError('Failed to fetch messages', 500);
  }
}
