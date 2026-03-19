import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { requireTenantUserContext } from '@/lib/tenant/request-guard'
import emailService from '@/lib/email/service'
import { logger } from '@/lib/monitoring/logger';
import { isAdmin } from '@/lib/auth/roles';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.EMAIL_SEND);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response: authResponse } = requireTenantUserContext(request)
    if (authResponse) return authResponse

    // Only admin users can send emails directly
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const {
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      template,
      templateData,
      priority = 'medium',
      scheduledAt
    } = await request.json()

    if (!to || !subject || (!html && !template)) {
      return NextResponse.json({
        error: 'Campos obrigatórios: to, subject e (html ou template)'
      }, { status: 400 })
    }

    // SECURITY: Whitelist of allowed template names to prevent arbitrary template injection
    const ALLOWED_TEMPLATES = [
      'ticketCreated',
      'ticketUpdated',
      'ticketResolved',
      'welcomeUser',
      'passwordReset',
    ] as const

    let emailHtml = html
    let emailText = text
    let emailSubject = subject

    // If using template, compile it with data
    if (template && templateData) {
      if (!ALLOWED_TEMPLATES.includes(template)) {
        return NextResponse.json({
          error: 'Template não permitido. Templates válidos: ' + ALLOWED_TEMPLATES.join(', ')
        }, { status: 400 })
      }

      const { compileTemplate, emailTemplates } = await import('@/lib/email/templates')

      if (emailTemplates[template as keyof typeof emailTemplates]) {
        const templateObj = emailTemplates[template as keyof typeof emailTemplates]
        emailSubject = compileTemplate(templateObj.subject, templateData)
        emailHtml = compileTemplate(templateObj.html, templateData)
        emailText = compileTemplate(templateObj.text, templateData)
      } else {
        return NextResponse.json({
          error: 'Template não encontrado'
        }, { status: 400 })
      }
    }

    // Queue the email
    const queueId = await emailService.queueEmail({
      tenant_id: auth.organizationId,
      to_email: Array.isArray(to) ? to.join(',') : to,
      cc_emails: cc ? (Array.isArray(cc) ? cc.join(',') : cc) : undefined,
      bcc_emails: bcc ? (Array.isArray(bcc) ? bcc.join(',') : bcc) : undefined,
      subject: emailSubject,
      html_content: emailHtml,
      text_content: emailText || '',
      template_type: template || 'custom',
      template_data: templateData ? JSON.stringify(templateData) : undefined,
      priority: priority as 'high' | 'medium' | 'low',
      scheduled_at: scheduledAt ? new Date(scheduledAt) : undefined
    })

    if (!queueId) {
      return NextResponse.json({
        error: 'Erro ao adicionar email na fila'
      }, { status: 500 })
    }

    // Process high priority emails immediately
    if (priority === 'high') {
      await emailService.processEmailQueue(1)
    }

    return NextResponse.json({
      success: true,
      queueId,
      message: 'Email adicionado à fila com sucesso'
    })

  } catch (error) {
    logger.error('Error sending email', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.EMAIL_SEND);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { auth, response: authResponse } = requireTenantUserContext(request)
    if (authResponse) return authResponse

    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    // Get email statistics
    const stats = await emailService.getEmailStats(auth.organizationId)

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    logger.error('Error fetching email stats', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}