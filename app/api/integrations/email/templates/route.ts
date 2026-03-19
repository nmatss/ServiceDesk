/**
 * Email Templates API Routes
 * Manage email templates
 *
 * GET /api/integrations/email/templates - List all templates
 * POST /api/integrations/email/templates - Create new template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { templateEngine, EmailTemplate } from '@/lib/integrations/email/templates';
import { executeQuery, executeQueryOne, sqlTrue } from '@/lib/db/adapter';
import { logger } from '@/lib/monitoring/logger';
import { isAdmin } from '@/lib/auth/roles';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response: authResponse } = requireTenantUserContext(request);
    if (authResponse) return authResponse;

    // Only admins can view templates
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const language = searchParams.get('language') || 'pt-BR';
    const activeOnly = searchParams.get('active') === 'true';

    // Build query
    let query = `
      SELECT * FROM email_templates
      WHERE (tenant_id = ? OR tenant_id IS NULL)
    `;
    const params: (string | number | boolean | null)[] = [auth.organizationId];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (language) {
      query += ' AND language = ?';
      params.push(language);
    }

    if (activeOnly) {
      query += ` AND is_active = ${sqlTrue()}`;
    }

    query += ' ORDER BY category, name';

    const templates = await executeQuery<any>(query, params);

    const result: EmailTemplate[] = templates.map(t => ({
      id: t.id,
      name: t.name,
      code: t.code,
      subject: t.subject,
      bodyHtml: t.body_html,
      bodyText: t.body_text,
      language: t.language,
      category: t.category,
      variables: JSON.parse(t.variables || '[]'),
      description: t.description,
      isActive: t.is_active === 1,
      tenantId: t.tenant_id,
      createdAt: new Date(t.created_at),
      updatedAt: new Date(t.updated_at),
    }));

    return NextResponse.json({
      success: true,
      templates: result,
      count: result.length,
    });
  } catch (error) {
    logger.error('Error fetching templates', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response: authResponse } = requireTenantUserContext(request);
    if (authResponse) return authResponse;

    // Only admins can create templates
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.name || !data.code || !data.subject || !data.bodyHtml || !data.bodyText) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, code, subject, bodyHtml, bodyText' },
        { status: 400 }
      );
    }

    // Check if template code already exists
    const existing = await executeQueryOne(`
      SELECT id FROM email_templates
      WHERE code = ? AND language = ? AND tenant_id = ?
    `, [data.code, data.language || 'pt-BR', auth.organizationId]);

    if (existing) {
      return NextResponse.json(
        { error: 'Template com este código já existe' },
        { status: 409 }
      );
    }

    // Create template
    const template: EmailTemplate = {
      name: data.name,
      code: data.code,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      bodyText: data.bodyText,
      language: data.language || 'pt-BR',
      category: data.category || 'custom',
      variables: data.variables || [],
      description: data.description,
      isActive: data.isActive !== false,
      tenantId: auth.organizationId,
    };

    const templateId = await templateEngine.saveTemplate(template);

    return NextResponse.json({
      success: true,
      templateId,
      message: 'Template criado com sucesso',
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating template', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
