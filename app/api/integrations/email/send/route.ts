/**
 * Send Email API Route
 * Send emails directly or using templates
 *
 * POST /api/integrations/email/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context';
import { emailSender } from '@/lib/integrations/email/sender';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.EMAIL_SEND);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    // Only authorized users can send emails
    if (!['super_admin', 'tenant_admin', 'team_manager', 'agent'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.to) {
      return NextResponse.json(
        { error: 'Campo obrigatório: to' },
        { status: 400 }
      );
    }

    // Check if using template or custom content
    if (data.templateCode) {
      // Send using template
      if (!data.templateData) {
        return NextResponse.json(
          { error: 'Template data é obrigatório ao usar template' },
          { status: 400 }
        );
      }

      // Queue or send immediately based on priority
      const shouldQueue = data.queue !== false;

      if (shouldQueue) {
        const queueId = await emailSender.queueTemplate(
          data.templateCode,
          data.to,
          data.templateData,
          tenantContext.id,
          {
            cc: data.cc,
            bcc: data.bcc,
            priority: data.priority || 'normal',
            replyTo: data.replyTo,
            attachments: data.attachments,
            metadata: data.metadata,
          }
        );

        if (!queueId) {
          return NextResponse.json(
            { error: 'Falha ao adicionar email na fila' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          queueId,
          message: 'Email adicionado à fila com sucesso',
        });
      } else {
        const result = await emailSender.sendTemplate(
          data.templateCode,
          data.to,
          data.templateData,
          {
            cc: data.cc,
            bcc: data.bcc,
            priority: data.priority || 'normal',
            replyTo: data.replyTo,
            attachments: data.attachments,
          }
        );

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Falha ao enviar email' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          messageId: result.messageId,
          message: 'Email enviado com sucesso',
        });
      }
    } else {
      // Send custom email
      if (!data.subject || (!data.html && !data.text)) {
        return NextResponse.json(
          { error: 'Campos obrigatórios: subject e (html ou text)' },
          { status: 400 }
        );
      }

      const shouldQueue = data.queue !== false;

      if (shouldQueue) {
        const queueId = await emailSender.queue(
          {
            to: data.to,
            cc: data.cc,
            bcc: data.bcc,
            subject: data.subject,
            html: data.html,
            text: data.text,
            priority: data.priority || 'normal',
            replyTo: data.replyTo,
            attachments: data.attachments,
            headers: data.headers,
            metadata: data.metadata,
          },
          tenantContext.id
        );

        if (!queueId) {
          return NextResponse.json(
            { error: 'Falha ao adicionar email na fila' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          queueId,
          message: 'Email adicionado à fila com sucesso',
        });
      } else {
        const result = await emailSender.send({
          to: data.to,
          cc: data.cc,
          bcc: data.bcc,
          subject: data.subject,
          html: data.html,
          text: data.text,
          priority: data.priority || 'normal',
          replyTo: data.replyTo,
          attachments: data.attachments,
          headers: data.headers,
        });

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Falha ao enviar email' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          messageId: result.messageId,
          message: 'Email enviado com sucesso',
        });
      }
    }
  } catch (error) {
    logger.error('Error sending email', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Get email send statistics
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.EMAIL_SEND);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request);
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 });
    }

    const userContext = getUserContextFromRequest(request);
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
    }

    if (!['super_admin', 'tenant_admin'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 });
    }

    const stats = await emailSender.getStats(tenantContext.id);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Error fetching email stats', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
