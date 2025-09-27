import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import emailService from '@/lib/email/service'

export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    // Only admin users can send emails directly
    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
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

    let emailHtml = html
    let emailText = text
    let emailSubject = subject

    // If using template, compile it with data
    if (template && templateData) {
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
      tenant_id: tenantContext.id,
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
    console.error('Error sending email:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    if (!['super_admin', 'tenant_admin', 'team_manager'].includes(userContext.role)) {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    // Get email statistics
    const stats = await emailService.getEmailStats(tenantContext.id)

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error fetching email stats:', error)
    return NextResponse.json({
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}