/**
 * WhatsApp Template Registration API
 * Quick endpoint for registering predefined templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { WhatsAppTemplateManager, PREDEFINED_TEMPLATES } from '@/lib/integrations/whatsapp/templates';
import { getWhatsAppClient } from '@/lib/integrations/whatsapp/business-api';
import { createAuditLog } from '@/lib/audit/logger';
import logger from '@/lib/monitoring/structured-logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * POST - Register all predefined templates
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guard = requireTenantUserContext(request, { requireRoles: ['admin'] });
    if (guard.response) return guard.response;
    const { userId } = guard.auth!;

    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    if (!businessAccountId) {
      return NextResponse.json(
        { error: 'WhatsApp Business Account ID not configured' },
        { status: 500 }
      );
    }

    const client = getWhatsAppClient();
    const templateManager = new WhatsAppTemplateManager(client, businessAccountId);

    const results: Array<{
      name: string;
      success: boolean;
      error?: string;
      templateId?: string;
    }> = [];

    // Register each predefined template
    for (const [_key, template] of Object.entries(PREDEFINED_TEMPLATES)) {
      try {
        const result = await templateManager.registerTemplate(template);
        results.push({
          name: template.name,
          success: result.success,
          error: result.error,
          templateId: result.templateId,
        });

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          name: template.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    // Log action
    await createAuditLog({
      user_id: userId,
      action: 'whatsapp_templates_bulk_registered',
      resource_type: 'whatsapp_template',
      new_values: JSON.stringify({
        total: results.length,
        success: successCount,
        failed: failureCount,
        results,
      }),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Registered ${successCount} templates successfully, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    logger.error('Error bulk registering WhatsApp templates', { error });
    return NextResponse.json({ error: 'Failed to register templates' }, { status: 500 });
  }
}

/**
 * GET - List available predefined templates
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guardGet = requireTenantUserContext(request, { requireRoles: ['admin', 'manager'] });
    if (guardGet.response) return guardGet.response;

    const templates = Object.entries(PREDEFINED_TEMPLATES).map(([key, template]) => ({
      key,
      name: template.name,
      category: template.category,
      language: template.language,
      components: template.components,
    }));

    return NextResponse.json({
      templates,
      total: templates.length,
    });
  } catch (error) {
    logger.error('Error listing predefined templates', { error });
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}
