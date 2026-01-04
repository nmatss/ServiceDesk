/**
 * Macros API
 *
 * CRUD operations for quick reply macros.
 *
 * @module app/api/macros/route
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// ========================================
// GET - List all macros
// ========================================

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const organizationId = parseInt(searchParams.get('organizationId') || '1');
    const userId = searchParams.get('userId');
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search') || '';

    let query = `
      SELECT
        m.*,
        u.name as created_by_name,
        c.name as category_name
      FROM macros m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.organization_id = ? AND m.is_active = 1
    `;
    const params: (string | number)[] = [organizationId];

    // Filter by visibility (shared or own macros)
    if (userId) {
      query += ` AND (m.is_shared = 1 OR m.created_by = ?)`;
      params.push(parseInt(userId));
    }

    // Filter by category
    if (categoryId) {
      query += ` AND (m.category_id IS NULL OR m.category_id = ?)`;
      params.push(parseInt(categoryId));
    }

    // Search
    if (search) {
      query += ` AND (m.name LIKE ? OR m.content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY m.usage_count DESC, m.name ASC`;

    const macros = db.prepare(query).all(...params);

    // Parse JSON fields
    const parsedMacros = macros.map((macro: any) => ({
      ...macro,
      actions: macro.actions ? JSON.parse(macro.actions) : [],
    }));

    return NextResponse.json(parsedMacros);
  } catch (error) {
    console.error('Error fetching macros:', error);
    return NextResponse.json(
      { error: 'Failed to fetch macros' },
      { status: 500 }
    );
  }
}

// ========================================
// POST - Create a new macro
// ========================================

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const {
      name,
      description,
      content,
      actions,
      categoryId,
      isShared = true,
      organizationId = 1,
      createdBy,
    } = body;

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      );
    }

    if (!createdBy) {
      return NextResponse.json(
        { error: 'Created by user is required' },
        { status: 400 }
      );
    }

    const result = db.prepare(`
      INSERT INTO macros (
        organization_id, name, description, content, actions,
        category_id, is_shared, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      organizationId,
      name,
      description,
      content,
      actions ? JSON.stringify(actions) : '[]',
      categoryId || null,
      isShared ? 1 : 0,
      createdBy
    );

    const macro = db.prepare(`
      SELECT
        m.*,
        u.name as created_by_name,
        c.name as category_name
      FROM macros m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid) as any;

    if (!macro) {
      return NextResponse.json(
        { error: 'Macro not found after creation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...macro,
      actions: macro.actions ? JSON.parse(macro.actions) : [],
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating macro:', error);
    return NextResponse.json(
      { error: 'Failed to create macro' },
      { status: 500 }
    );
  }
}
