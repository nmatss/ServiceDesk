/**
 * Email Webhook API Route
 * Receives incoming emails from email services (SendGrid, Mailgun, etc.)
 *
 * POST /api/integrations/email/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailAutomation } from '@/lib/integrations/email/automation';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WEBHOOK);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Get webhook secret for verification
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    const authHeader = request.headers.get('authorization');

    // Verify webhook secret
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      logger.warn('Unauthorized webhook attempt', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get content type
    const contentType = request.headers.get('content-type') || '';

    let rawEmail: Buffer | string;
    let tenantId = 1; // Default tenant

    // Handle different webhook formats
    if (contentType.includes('application/json')) {
      // JSON format (SendGrid, Mailgun, etc.)
      const data = await request.json();

      // Extract tenant ID if provided
      if (data.tenantId) {
        tenantId = parseInt(data.tenantId);
      }

      // Parse different webhook formats
      if (data.email) {
        // Raw email in JSON
        rawEmail = Buffer.from(data.email, 'utf-8');
      } else if (data.msg) {
        // SendGrid format
        rawEmail = Buffer.from(data.msg, 'utf-8');
      } else if (data['body-mime']) {
        // Mailgun format
        rawEmail = Buffer.from(data['body-mime'], 'utf-8');
      } else {
        return NextResponse.json(
          { error: 'Invalid webhook payload' },
          { status: 400 }
        );
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Form data format (Mailgun)
      const formData = await request.formData();
      const bodyMime = formData.get('body-mime');

      if (!bodyMime) {
        return NextResponse.json(
          { error: 'Missing email data' },
          { status: 400 }
        );
      }

      rawEmail = bodyMime.toString();

      // Extract tenant ID from custom headers if provided
      const tenantHeader = formData.get('X-Tenant-Id');
      if (tenantHeader) {
        tenantId = parseInt(tenantHeader.toString());
      }
    } else {
      // Assume raw email
      rawEmail = Buffer.from(await request.arrayBuffer());
    }

    // Process incoming email
    logger.info('Processing incoming email webhook', { tenantId });

    const result = await emailAutomation.processIncomingEmail(rawEmail, tenantId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        ticketId: result.ticketId,
        action: result.action,
        message: 'Email processed successfully',
      });
    } else {
      logger.error('Email processing failed', { error: result.error });
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to process email',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Webhook error', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Handle GET requests (webhook verification)
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WEBHOOK);
  if (rateLimitResponse) return rateLimitResponse;

  // Some webhook services require GET verification
  const challenge = request.nextUrl.searchParams.get('challenge');

  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    service: 'ServiceDesk Email Webhook',
    version: '1.0',
    status: 'active',
  });
}
