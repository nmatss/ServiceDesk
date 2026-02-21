/**
 * WhatsApp Templates API
 * Manage WhatsApp Business message templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { WhatsAppTemplateManager } from '@/lib/integrations/whatsapp/templates';
import { getWhatsAppClient } from '@/lib/integrations/whatsapp/business-api';
import { createAuditLog } from '@/lib/audit/logger';
import { z } from 'zod';
import logger from '@/lib/monitoring/structured-logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const templateSchema = z.object({
  name: z.string().min(1).max(512),
  category: z.enum(['TRANSACTIONAL', 'MARKETING', 'AUTHENTICATION', 'UTILITY']),
  language: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/),
  components: z.array(
    z.object({
      type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
      format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
      text: z.string().optional(),
      buttons: z
        .array(
          z.object({
            type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
            text: z.string(),
            url: z.string().optional(),
            phone_number: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
});

/**
 * GET - List all templates
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'manager'] });
    if (guard.response) return guard.response;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const language = searchParams.get('language') || undefined;

    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    const client = getWhatsAppClient();
    const templateManager = new WhatsAppTemplateManager(client, businessAccountId);

    const templates = await templateManager.listTemplates({
      status,
      category,
      language,
    });

    return NextResponse.json({
      templates,
      total: templates.length,
    });
  } catch (error) {
    logger.error('Error listing WhatsApp templates', { error });
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

/**
 * POST - Create/register a new template
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guardPost = requireTenantUserContext(request, { requireRoles: ['admin', 'manager'] });
    if (guardPost.response) return guardPost.response;
    const { userId } = guardPost.auth!;

    const body = await request.json();
    const validatedData = templateSchema.parse(body);

    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    const client = getWhatsAppClient();
    const templateManager = new WhatsAppTemplateManager(client, businessAccountId);

    // Register template with WhatsApp
    const result = await templateManager.registerTemplate(validatedData);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to register template' }, { status: 400 });
    }

    // Log action
    await createAuditLog({
      user_id: userId,
      action: 'whatsapp_template_registered',
      resource_type: 'whatsapp_template',
      new_values: JSON.stringify({
        name: validatedData.name,
        category: validatedData.category,
        language: validatedData.language,
        templateId: result.templateId,
      }),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      templateId: result.templateId,
      status: result.status,
      message: 'Template registered successfully. It will be available after WhatsApp approval.',
    });
  } catch (error) {
    logger.error('Error registering WhatsApp template', { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to register template' }, { status: 500 });
  }
}

/**
 * DELETE - Delete a template
 */
export async function DELETE(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guardDel = requireTenantUserContext(request, { requireRoles: ['admin'] });
    if (guardDel.response) return guardDel.response;
    const userIdDel = guardDel.auth!.userId;

    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    const language = searchParams.get('language') || 'pt_BR';

    if (!name) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }

    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    const client = getWhatsAppClient();
    const templateManager = new WhatsAppTemplateManager(client, businessAccountId);

    const result = await templateManager.deleteTemplate(name, language);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete template' }, { status: 400 });
    }

    // Log action
    await createAuditLog({
      user_id: userIdDel,
      action: 'whatsapp_template_deleted',
      resource_type: 'whatsapp_template',
      old_values: JSON.stringify({ name, language }),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting WhatsApp template', { error });
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
