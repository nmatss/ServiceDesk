/**
 * Email Template API Routes (Single Template)
 * Manage individual email templates
 *
 * GET /api/integrations/email/templates/[id] - Get template by ID
 * PUT /api/integrations/email/templates/[id] - Update template
 * DELETE /api/integrations/email/templates/[id] - Delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context';
import { templateEngine, EmailTemplate } from '@/lib/integrations/email/templates';
import db from '@/lib/db/connection';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    const templateId = parseInt(params.id);

    const template = db.prepare(`
      SELECT * FROM email_templates
      WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL)
    `).get(templateId, tenantContext.id) as any;

    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    const result: EmailTemplate = {
      id: template.id,
      name: template.name,
      code: template.code,
      subject: template.subject,
      bodyHtml: template.body_html,
      bodyText: template.body_text,
      language: template.language,
      category: template.category,
      variables: JSON.parse(template.variables || '[]'),
      description: template.description,
      isActive: template.is_active === 1,
      tenantId: template.tenant_id,
      createdAt: new Date(template.created_at),
      updatedAt: new Date(template.updated_at),
    };

    return NextResponse.json({
      success: true,
      template: result,
    });
  } catch (error) {
    logger.error('Error fetching template', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    // Only admins can update templates
    if (!['super_admin', 'tenant_admin'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const templateId = parseInt(params.id);
    const data = await request.json();

    // Check if template exists and belongs to tenant
    const existing = db.prepare(`
      SELECT * FROM email_templates
      WHERE id = ? AND tenant_id = ?
    `).get(templateId, tenantContext.id) as any;

    if (!existing) {
      return NextResponse.json(
        { error: 'Template não encontrado ou não pertence a este tenant' },
        { status: 404 }
      );
    }

    // Update template
    const updates: Partial<EmailTemplate> = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.subject !== undefined) updates.subject = data.subject;
    if (data.bodyHtml !== undefined) updates.bodyHtml = data.bodyHtml;
    if (data.bodyText !== undefined) updates.bodyText = data.bodyText;
    if (data.variables !== undefined) updates.variables = data.variables;
    if (data.description !== undefined) updates.description = data.description;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    await templateEngine.updateTemplate(templateId, updates);

    return NextResponse.json({
      success: true,
      message: 'Template atualizado com sucesso',
    });
  } catch (error) {
    logger.error('Error updating template', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    // Only admins can delete templates
    if (!['super_admin', 'tenant_admin'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const templateId = parseInt(params.id);

    // Check if template exists and belongs to tenant
    const existing = db.prepare(`
      SELECT * FROM email_templates
      WHERE id = ? AND tenant_id = ?
    `).get(templateId, tenantContext.id) as any;

    if (!existing) {
      return NextResponse.json(
        { error: 'Template não encontrado ou não pertence a este tenant' },
        { status: 404 }
      );
    }

    // Soft delete (mark as inactive) instead of hard delete
    db.prepare(`
      UPDATE email_templates
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(templateId);

    return NextResponse.json({
      success: true,
      message: 'Template desativado com sucesso',
    });
  } catch (error) {
    logger.error('Error deleting template', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
