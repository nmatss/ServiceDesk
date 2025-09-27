import Handlebars from 'handlebars'

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface TicketEmailData {
  ticketNumber: string
  title: string
  description: string
  priority: string
  status: string
  assignedTo?: string
  customer: {
    name: string
    email: string
  }
  tenant: {
    name: string
    url?: string
    supportEmail?: string
  }
  urls: {
    ticketUrl: string
    portalUrl: string
  }
}

export interface UserEmailData {
  name: string
  email: string
  password?: string
  resetToken?: string
  tenant: {
    name: string
    url?: string
  }
  urls: {
    loginUrl: string
    resetUrl?: string
  }
}

// Base HTML template
const baseHtmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .content {
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
        }
        .ticket-info {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .priority-high { background: #fee2e2; color: #dc2626; }
        .priority-medium { background: #fef3c7; color: #d97706; }
        .priority-low { background: #dcfce7; color: #16a34a; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">{{tenant.name}}</div>
            <div>ServiceDesk Pro</div>
        </div>
        <div class="content">
            {{{content}}}
        </div>
        <div class="footer">
            <p>Este é um email automático do sistema ServiceDesk Pro.</p>
            {{#if tenant.supportEmail}}
            <p>Para suporte, entre em contato: <a href="mailto:{{tenant.supportEmail}}">{{tenant.supportEmail}}</a></p>
            {{/if}}
        </div>
    </div>
</body>
</html>
`

// Ticket Created Template
export const ticketCreatedTemplate: EmailTemplate = {
  subject: 'Ticket {{ticketNumber}} criado - {{title}}',
  html: baseHtmlTemplate.replace('{{{content}}}', `
    <h2>Seu ticket foi criado com sucesso!</h2>
    <p>Olá {{customer.name}},</p>
    <p>Seu ticket foi registrado em nosso sistema e nossa equipe já foi notificada.</p>

    <div class="ticket-info">
        <h3>Detalhes do Ticket</h3>
        <p><strong>Número:</strong> {{ticketNumber}}</p>
        <p><strong>Título:</strong> {{title}}</p>
        <p><strong>Prioridade:</strong> <span class="status-badge priority-{{priorityClass}}">{{priority}}</span></p>
        <p><strong>Status:</strong> {{status}}</p>
        <p><strong>Descrição:</strong></p>
        <p>{{description}}</p>
    </div>

    <p>Você pode acompanhar o andamento do seu ticket através do portal:</p>
    <a href="{{urls.ticketUrl}}" class="button">Ver Ticket</a>

    <p>Você receberá atualizações por email sempre que houver novidades.</p>
  `),
  text: `
Seu ticket foi criado com sucesso!

Olá {{customer.name}},

Seu ticket foi registrado em nosso sistema e nossa equipe já foi notificada.

Detalhes do Ticket:
- Número: {{ticketNumber}}
- Título: {{title}}
- Prioridade: {{priority}}
- Status: {{status}}

Descrição: {{description}}

Acompanhe em: {{urls.ticketUrl}}

Você receberá atualizações por email sempre que houver novidades.
  `
}

// Ticket Updated Template
export const ticketUpdatedTemplate: EmailTemplate = {
  subject: 'Ticket {{ticketNumber}} atualizado - {{title}}',
  html: baseHtmlTemplate.replace('{{{content}}}', `
    <h2>Seu ticket foi atualizado</h2>
    <p>Olá {{customer.name}},</p>
    <p>Há uma nova atualização no seu ticket.</p>

    <div class="ticket-info">
        <h3>Detalhes do Ticket</h3>
        <p><strong>Número:</strong> {{ticketNumber}}</p>
        <p><strong>Título:</strong> {{title}}</p>
        <p><strong>Status:</strong> {{status}}</p>
        {{#if assignedTo}}
        <p><strong>Atribuído para:</strong> {{assignedTo}}</p>
        {{/if}}
    </div>

    <a href="{{urls.ticketUrl}}" class="button">Ver Ticket</a>
  `),
  text: `
Seu ticket foi atualizado

Olá {{customer.name}},

Há uma nova atualização no seu ticket.

Detalhes:
- Número: {{ticketNumber}}
- Título: {{title}}
- Status: {{status}}
{{#if assignedTo}}
- Atribuído para: {{assignedTo}}
{{/if}}

Ver ticket: {{urls.ticketUrl}}
  `
}

// Ticket Resolved Template
export const ticketResolvedTemplate: EmailTemplate = {
  subject: 'Ticket {{ticketNumber}} resolvido - {{title}}',
  html: baseHtmlTemplate.replace('{{{content}}}', `
    <h2>✅ Seu ticket foi resolvido!</h2>
    <p>Olá {{customer.name}},</p>
    <p>Temos o prazer de informar que seu ticket foi resolvido com sucesso.</p>

    <div class="ticket-info">
        <h3>Detalhes do Ticket</h3>
        <p><strong>Número:</strong> {{ticketNumber}}</p>
        <p><strong>Título:</strong> {{title}}</p>
        <p><strong>Status:</strong> {{status}}</p>
    </div>

    <p>Se você está satisfeito com a resolução, nenhuma ação adicional é necessária.</p>
    <p>Se você ainda tem dúvidas ou precisar de ajuda adicional, responda este email ou abra um novo ticket.</p>

    <a href="{{urls.ticketUrl}}" class="button">Ver Ticket</a>
  `),
  text: `
✅ Seu ticket foi resolvido!

Olá {{customer.name}},

Temos o prazer de informar que seu ticket foi resolvido com sucesso.

Detalhes:
- Número: {{ticketNumber}}
- Título: {{title}}
- Status: {{status}}

Se você está satisfeito com a resolução, nenhuma ação adicional é necessária.
Se você ainda tem dúvidas, responda este email ou abra um novo ticket.

Ver ticket: {{urls.ticketUrl}}
  `
}

// Welcome User Template
export const welcomeUserTemplate: EmailTemplate = {
  subject: 'Bem-vindo ao {{tenant.name}} - ServiceDesk Pro',
  html: baseHtmlTemplate.replace('{{{content}}}', `
    <h2>🎉 Bem-vindo!</h2>
    <p>Olá {{name}},</p>
    <p>Sua conta foi criada com sucesso no ServiceDesk Pro.</p>

    <div class="ticket-info">
        <h3>Suas credenciais de acesso</h3>
        <p><strong>Email:</strong> {{email}}</p>
        {{#if password}}
        <p><strong>Senha temporária:</strong> {{password}}</p>
        <p><em>Por favor, altere sua senha no primeiro acesso.</em></p>
        {{/if}}
    </div>

    <a href="{{urls.loginUrl}}" class="button">Fazer Login</a>

    <p>Se você tiver alguma dúvida, não hesite em entrar em contato conosco.</p>
  `),
  text: `
🎉 Bem-vindo!

Olá {{name}},

Sua conta foi criada com sucesso no ServiceDesk Pro.

Credenciais:
- Email: {{email}}
{{#if password}}
- Senha temporária: {{password}}
(Por favor, altere sua senha no primeiro acesso)
{{/if}}

Fazer login: {{urls.loginUrl}}
  `
}

// Password Reset Template
export const passwordResetTemplate: EmailTemplate = {
  subject: 'Redefinição de senha - {{tenant.name}}',
  html: baseHtmlTemplate.replace('{{{content}}}', `
    <h2>🔑 Redefinição de senha</h2>
    <p>Olá {{name}},</p>
    <p>Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:</p>

    <a href="{{urls.resetUrl}}" class="button">Redefinir Senha</a>

    <p>Este link expira em 1 hora por motivos de segurança.</p>
    <p>Se você não solicitou esta redefinição, ignore este email.</p>
  `),
  text: `
🔑 Redefinição de senha

Olá {{name}},

Você solicitou a redefinição da sua senha. Acesse o link abaixo para criar uma nova senha:

{{urls.resetUrl}}

Este link expira em 1 hora por motivos de segurança.
Se você não solicitou esta redefinição, ignore este email.
  `
}

// Helper function to compile templates
export const compileTemplate = (template: string, data: any): string => {
  // Add helper for priority class
  Handlebars.registerHelper('priorityClass', function(priority) {
    switch (priority?.toLowerCase()) {
      case 'alta': return 'high'
      case 'média': return 'medium'
      case 'baixa': return 'low'
      default: return 'medium'
    }
  })

  const compiled = Handlebars.compile(template)
  return compiled(data)
}

export const emailTemplates = {
  ticketCreated: ticketCreatedTemplate,
  ticketUpdated: ticketUpdatedTemplate,
  ticketResolved: ticketResolvedTemplate,
  welcomeUser: welcomeUserTemplate,
  passwordReset: passwordResetTemplate
}