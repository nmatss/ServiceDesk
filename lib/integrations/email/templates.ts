/**
 * Email Template Engine
 * Advanced Handlebars-based templating system
 *
 * Features:
 * - Handlebars template compilation
 * - Multi-language support (i18n)
 * - HTML and plain text versions
 * - Template inheritance and partials
 * - Custom helpers (dates, formatting, etc.)
 * - Template caching for performance
 * - Variable validation
 */

import * as Handlebars from 'handlebars';
import { executeQueryOne, executeRun, sqlTrue, sqlNow, type SqlParam } from '@/lib/db/adapter';
import logger from '@/lib/monitoring/structured-logger';

export interface EmailTemplate {
  id?: number;
  name: string;
  code: string; // Unique identifier (e.g., 'ticket_created')
  subject: string;
  bodyHtml: string;
  bodyText: string;
  language: string;
  category: 'ticket' | 'user' | 'system' | 'custom';
  variables: string[]; // Required variables
  description?: string;
  isActive: boolean;
  tenantId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TemplateData {
  [key: string]: any;
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

export class TemplateEngine {
  private compiledTemplates: Map<string, CompiledTemplate> = new Map();
  private helpersRegistered: boolean = false;

  constructor() {
    this.registerHelpers();
    this.loadDefaultTemplates();
  }

  /**
   * Register Handlebars custom helpers
   */
  private registerHelpers(): void {
    if (this.helpersRegistered) return;

    // Date formatting
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    Handlebars.registerHelper('formatDateTime', (date: Date | string) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    Handlebars.registerHelper('formatTime', (date: Date | string) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // String formatting
    Handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    Handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    Handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    Handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });

    // Number formatting
    Handlebars.registerHelper('currency', (value: number) => {
      if (typeof value !== 'number') return value;
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    });

    Handlebars.registerHelper('number', (value: number) => {
      if (typeof value !== 'number') return value;
      return new Intl.NumberFormat('pt-BR').format(value);
    });

    // Comparisons
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('lte', (a: any, b: any) => a <= b);
    Handlebars.registerHelper('gte', (a: any, b: any) => a >= b);

    // Logic helpers
    Handlebars.registerHelper('and', (a: any, b: any) => a && b);
    Handlebars.registerHelper('or', (a: any, b: any) => a || b);
    Handlebars.registerHelper('not', (a: any) => !a);

    // URL helpers
    Handlebars.registerHelper('ticketUrl', (ticketId: number) => {
      return `${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticketId}`;
    });

    Handlebars.registerHelper('portalUrl', (path?: string) => {
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      return path ? `${baseUrl}/portal/${path}` : `${baseUrl}/portal`;
    });

    Handlebars.registerHelper('loginUrl', () => {
      return `${process.env.APP_URL || 'http://localhost:3000'}/auth/login`;
    });

    // Priority badge helper
    Handlebars.registerHelper('priorityBadge', (priority: string) => {
      const badges: Record<string, string> = {
        critical: '<span style="background: #fee2e2; color: #dc2626; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">🔥 CRÍTICO</span>',
        high: '<span style="background: #fed7aa; color: #ea580c; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">⚡ ALTO</span>',
        medium: '<span style="background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">⚠️ MÉDIO</span>',
        low: '<span style="background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">✓ BAIXO</span>',
      };
      return new Handlebars.SafeString(badges[priority.toLowerCase()] || priority);
    });

    // Status badge helper
    Handlebars.registerHelper('statusBadge', (status: string) => {
      const badges: Record<string, string> = {
        open: '<span style="background: #dbeafe; color: #2563eb; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">🆕 ABERTO</span>',
        'in_progress': '<span style="background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">🔄 EM ANDAMENTO</span>',
        resolved: '<span style="background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">✅ RESOLVIDO</span>',
        closed: '<span style="background: #f1f5f9; color: #64748b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">✓ FECHADO</span>',
      };
      return new Handlebars.SafeString(badges[status.toLowerCase()] || status);
    });

    this.helpersRegistered = true;
  }

  /**
   * Compile template
   */
  compile(template: EmailTemplate): void {
    try {
      const key = `${template.code}_${template.language}`;

      const compiled: CompiledTemplate = {
        id: template.id,
        code: template.code,
        subject: Handlebars.compile(template.subject),
        bodyHtml: Handlebars.compile(template.bodyHtml),
        bodyText: Handlebars.compile(template.bodyText),
        variables: template.variables,
        language: template.language,
      };

      this.compiledTemplates.set(key, compiled);

      logger.debug(`Template compiled: ${key}`);
    } catch (error) {
      logger.error('Template compilation error', { template: template.code, error });
      throw new Error(`Failed to compile template ${template.code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Render template with data
   */
  render(code: string, data: TemplateData, language: string = 'pt-BR'): RenderedTemplate {
    const key = `${code}_${language}`;
    const compiled = this.compiledTemplates.get(key);

    if (!compiled) {
      throw new Error(`Template not found: ${key}`);
    }

    // Validate required variables
    this.validateData(compiled.variables, data);

    try {
      return {
        subject: compiled.subject(data),
        html: compiled.bodyHtml(data),
        text: compiled.bodyText(data),
      };
    } catch (error) {
      logger.error('Template rendering error', { code, error });
      throw new Error(`Failed to render template ${code}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate template data
   */
  private validateData(requiredVars: string[], data: TemplateData): void {
    const missingVars = requiredVars.filter(varName => {
      const keys = varName.split('.');
      let value: any = data;

      for (const key of keys) {
        if (value === null || value === undefined) {
          return true;
        }
        value = value[key];
      }

      return value === null || value === undefined;
    });

    if (missingVars.length > 0) {
      throw new Error(`Missing required template variables: ${missingVars.join(', ')}`);
    }
  }

  /**
   * Load template from database
   */
  async loadTemplate(code: string, language: string = 'pt-BR'): Promise<void> {
    try {
      const template = await executeQueryOne<{
        id: number;
        name: string;
        code: string;
        subject: string;
        body_html: string;
        body_text: string;
        language: string;
        category: 'ticket' | 'user' | 'system' | 'custom';
        variables: string;
        description?: string;
        is_active: number;
        tenant_id?: number;
      }>(
        `SELECT * FROM email_templates
         WHERE code = ? AND language = ? AND is_active = ${sqlTrue()}
         LIMIT 1`,
        [code, language]
      );

      if (!template) {
        logger.warn(`Template not found in database: ${code} (${language})`);
        return;
      }

      const emailTemplate: EmailTemplate = {
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
      };

      this.compile(emailTemplate);
    } catch (error) {
      logger.error('Error loading template from database', { code, language, error });
    }
  }

  /**
   * Save template to database
   */
  async saveTemplate(template: EmailTemplate): Promise<number> {
    try {
      const result = await executeRun(
        `INSERT INTO email_templates (
          name, code, subject, body_html, body_text, language,
          category, variables, description, is_active, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.name,
          template.code,
          template.subject,
          template.bodyHtml,
          template.bodyText,
          template.language,
          template.category,
          JSON.stringify(template.variables),
          template.description || null,
          template.isActive ? 1 : 0,
          template.tenantId || null
        ]
      );

      const templateId = result.lastInsertRowid!;

      // Compile and cache the template
      this.compile({ ...template, id: templateId });

      return templateId;
    } catch (error) {
      logger.error('Error saving template', { template: template.code, error });
      throw new Error('Failed to save template');
    }
  }

  /**
   * Update template in database
   */
  async updateTemplate(id: number, updates: Partial<EmailTemplate>): Promise<void> {
    try {
      const fields: string[] = [];
      const values: SqlParam[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.subject !== undefined) {
        fields.push('subject = ?');
        values.push(updates.subject);
      }
      if (updates.bodyHtml !== undefined) {
        fields.push('body_html = ?');
        values.push(updates.bodyHtml);
      }
      if (updates.bodyText !== undefined) {
        fields.push('body_text = ?');
        values.push(updates.bodyText);
      }
      if (updates.variables !== undefined) {
        fields.push('variables = ?');
        values.push(JSON.stringify(updates.variables));
      }
      if (updates.isActive !== undefined) {
        fields.push('is_active = ?');
        values.push(updates.isActive ? 1 : 0);
      }

      if (fields.length === 0) {
        return;
      }

      values.push(id);

      await executeRun(
        `UPDATE email_templates
         SET ${fields.join(', ')}, updated_at = ${sqlNow()}
         WHERE id = ?`,
        values
      );

      // Reload template into cache
      const template = await executeQueryOne('SELECT * FROM email_templates WHERE id = ?', [id]);
      if (template) {
        const emailTemplate: EmailTemplate = {
          id: template.id,
          name: template.name,
          code: template.code,
          subject: template.subject,
          bodyHtml: template.body_html,
          bodyText: template.body_text,
          language: template.language,
          category: template.category,
          variables: JSON.parse(template.variables || '[]'),
          isActive: template.is_active === 1,
          tenantId: template.tenant_id,
        };

        this.compile(emailTemplate);
      }
    } catch (error) {
      logger.error('Error updating template', { id, error });
      throw new Error('Failed to update template');
    }
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    const defaults: EmailTemplate[] = [
      // Ticket Created
      {
        name: 'Ticket Created',
        code: 'ticket_created',
        subject: 'Ticket #{{ticketNumber}} criado - {{ticket.title}}',
        bodyHtml: this.getDefaultHtmlWrapper(`
          <h2 style="color: #2563eb;">✉️ Seu ticket foi criado com sucesso!</h2>
          <p>Olá <strong>{{customer.name}}</strong>,</p>
          <p>Seu ticket foi registrado em nosso sistema e nossa equipe já foi notificada.</p>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <h3 style="margin-top: 0;">📋 Detalhes do Ticket</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Número:</strong></td>
                <td style="padding: 8px 0;">#{{ticketNumber}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Título:</strong></td>
                <td style="padding: 8px 0;">{{ticket.title}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Prioridade:</strong></td>
                <td style="padding: 8px 0;">{{{priorityBadge ticket.priority}}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;">{{{statusBadge ticket.status}}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; vertical-align: top;"><strong>Descrição:</strong></td>
                <td style="padding: 8px 0;">{{ticket.description}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Criado em:</strong></td>
                <td style="padding: 8px 0;">{{formatDateTime ticket.createdAt}}</td>
              </tr>
            </table>
          </div>

          <p>Você pode acompanhar o andamento do seu ticket através do portal:</p>
          <p style="text-align: center;">
            <a href="{{ticketUrl ticket.id}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Ticket</a>
          </p>

          <p style="color: #64748b; font-size: 14px;">💡 <em>Você receberá atualizações por email sempre que houver novidades.</em></p>
        `),
        bodyText: `
Seu ticket foi criado com sucesso!

Olá {{customer.name}},

Seu ticket foi registrado em nosso sistema e nossa equipe já foi notificada.

Detalhes do Ticket:
- Número: #{{ticketNumber}}
- Título: {{ticket.title}}
- Prioridade: {{ticket.priority}}
- Status: {{ticket.status}}
- Descrição: {{ticket.description}}
- Criado em: {{formatDateTime ticket.createdAt}}

Acompanhe em: {{ticketUrl ticket.id}}

Você receberá atualizações por email sempre que houver novidades.

---
{{tenant.name}}
{{#if tenant.supportEmail}}Suporte: {{tenant.supportEmail}}{{/if}}
        `,
        language: 'pt-BR',
        category: 'ticket',
        variables: ['ticketNumber', 'ticket.title', 'ticket.priority', 'ticket.status', 'ticket.description', 'ticket.createdAt', 'ticket.id', 'customer.name', 'tenant.name'],
        isActive: true,
      },

      // Ticket Updated
      {
        name: 'Ticket Updated',
        code: 'ticket_updated',
        subject: 'Ticket #{{ticketNumber}} atualizado - {{ticket.title}}',
        bodyHtml: this.getDefaultHtmlWrapper(`
          <h2 style="color: #2563eb;">🔔 Seu ticket foi atualizado</h2>
          <p>Olá <strong>{{customer.name}}</strong>,</p>
          <p>Há uma nova atualização no seu ticket.</p>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d97706;">
            <h3 style="margin-top: 0;">📋 Informações do Ticket</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Número:</strong></td>
                <td style="padding: 8px 0;">#{{ticketNumber}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Título:</strong></td>
                <td style="padding: 8px 0;">{{ticket.title}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;">{{{statusBadge ticket.status}}}</td>
              </tr>
              {{#if ticket.assignedTo}}
              <tr>
                <td style="padding: 8px 0;"><strong>Atribuído para:</strong></td>
                <td style="padding: 8px 0;">{{ticket.assignedTo}}</td>
              </tr>
              {{/if}}
              {{#if updateMessage}}
              <tr>
                <td style="padding: 8px 0; vertical-align: top;"><strong>Atualização:</strong></td>
                <td style="padding: 8px 0;">{{updateMessage}}</td>
              </tr>
              {{/if}}
            </table>
          </div>

          <p style="text-align: center;">
            <a href="{{ticketUrl ticket.id}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Atualização</a>
          </p>
        `),
        bodyText: `
Seu ticket foi atualizado

Olá {{customer.name}},

Há uma nova atualização no seu ticket.

Informações:
- Número: #{{ticketNumber}}
- Título: {{ticket.title}}
- Status: {{ticket.status}}
{{#if ticket.assignedTo}}- Atribuído para: {{ticket.assignedTo}}{{/if}}
{{#if updateMessage}}- Atualização: {{updateMessage}}{{/if}}

Ver ticket: {{ticketUrl ticket.id}}

---
{{tenant.name}}
{{#if tenant.supportEmail}}Suporte: {{tenant.supportEmail}}{{/if}}
        `,
        language: 'pt-BR',
        category: 'ticket',
        variables: ['ticketNumber', 'ticket.title', 'ticket.status', 'ticket.id', 'customer.name', 'tenant.name'],
        isActive: true,
      },

      // Ticket Resolved
      {
        name: 'Ticket Resolved',
        code: 'ticket_resolved',
        subject: 'Ticket #{{ticketNumber}} resolvido - {{ticket.title}}',
        bodyHtml: this.getDefaultHtmlWrapper(`
          <h2 style="color: #16a34a;">✅ Seu ticket foi resolvido!</h2>
          <p>Olá <strong>{{customer.name}}</strong>,</p>
          <p>Temos o prazer de informar que seu ticket foi resolvido com sucesso.</p>

          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <h3 style="margin-top: 0;">📋 Detalhes da Resolução</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Número:</strong></td>
                <td style="padding: 8px 0;">#{{ticketNumber}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Título:</strong></td>
                <td style="padding: 8px 0;">{{ticket.title}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;">{{{statusBadge ticket.status}}}</td>
              </tr>
              {{#if resolution}}
              <tr>
                <td style="padding: 8px 0; vertical-align: top;"><strong>Solução:</strong></td>
                <td style="padding: 8px 0;">{{resolution}}</td>
              </tr>
              {{/if}}
              <tr>
                <td style="padding: 8px 0;"><strong>Resolvido em:</strong></td>
                <td style="padding: 8px 0;">{{formatDateTime ticket.resolvedAt}}</td>
              </tr>
            </table>
          </div>

          <p>Se você está satisfeito com a resolução, nenhuma ação adicional é necessária. O ticket será automaticamente fechado em 48 horas.</p>
          <p>Se você ainda tem dúvidas ou precisar de ajuda adicional, responda este email ou abra um novo ticket.</p>

          <p style="text-align: center;">
            <a href="{{ticketUrl ticket.id}}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Ticket</a>
          </p>
        `),
        bodyText: `
✅ Seu ticket foi resolvido!

Olá {{customer.name}},

Temos o prazer de informar que seu ticket foi resolvido com sucesso.

Detalhes:
- Número: #{{ticketNumber}}
- Título: {{ticket.title}}
- Status: {{ticket.status}}
{{#if resolution}}- Solução: {{resolution}}{{/if}}
- Resolvido em: {{formatDateTime ticket.resolvedAt}}

Se você está satisfeito com a resolução, nenhuma ação adicional é necessária.
Se você ainda tem dúvidas, responda este email ou abra um novo ticket.

Ver ticket: {{ticketUrl ticket.id}}

---
{{tenant.name}}
{{#if tenant.supportEmail}}Suporte: {{tenant.supportEmail}}{{/if}}
        `,
        language: 'pt-BR',
        category: 'ticket',
        variables: ['ticketNumber', 'ticket.title', 'ticket.status', 'ticket.id', 'ticket.resolvedAt', 'customer.name', 'tenant.name'],
        isActive: true,
      },

      // SLA Warning
      {
        name: 'SLA Warning',
        code: 'sla_warning',
        subject: '⚠️ Alerta SLA - Ticket #{{ticketNumber}}',
        bodyHtml: this.getDefaultHtmlWrapper(`
          <h2 style="color: #ea580c;">⚠️ Alerta de SLA</h2>
          <p>Olá <strong>{{agent.name}}</strong>,</p>
          <p>O prazo de SLA do ticket está próximo do vencimento.</p>

          <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
            <h3 style="margin-top: 0;">⏰ Informações do SLA</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0;"><strong>Ticket:</strong></td>
                <td style="padding: 8px 0;">#{{ticketNumber}} - {{ticket.title}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Prioridade:</strong></td>
                <td style="padding: 8px 0;">{{{priorityBadge ticket.priority}}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Prazo SLA:</strong></td>
                <td style="padding: 8px 0;">{{formatDateTime sla.deadline}}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Tempo Restante:</strong></td>
                <td style="padding: 8px 0; color: #ea580c; font-weight: bold;">{{sla.timeRemaining}}</td>
              </tr>
            </table>
          </div>

          <p style="text-align: center;">
            <a href="{{ticketUrl ticket.id}}" style="display: inline-block; background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Atender Urgentemente</a>
          </p>
        `),
        bodyText: `
⚠️ Alerta de SLA

Olá {{agent.name}},

O prazo de SLA do ticket está próximo do vencimento.

Informações:
- Ticket: #{{ticketNumber}} - {{ticket.title}}
- Prioridade: {{ticket.priority}}
- Prazo SLA: {{formatDateTime sla.deadline}}
- Tempo Restante: {{sla.timeRemaining}}

Atender urgentemente: {{ticketUrl ticket.id}}

---
{{tenant.name}}
        `,
        language: 'pt-BR',
        category: 'system',
        variables: ['ticketNumber', 'ticket.title', 'ticket.priority', 'ticket.id', 'agent.name', 'sla.deadline', 'sla.timeRemaining', 'tenant.name'],
        isActive: true,
      },

      // New Comment
      {
        name: 'New Comment',
        code: 'new_comment',
        subject: 'Novo comentário no ticket #{{ticketNumber}}',
        bodyHtml: this.getDefaultHtmlWrapper(`
          <h2 style="color: #2563eb;">💬 Novo comentário no seu ticket</h2>
          <p>Olá <strong>{{customer.name}}</strong>,</p>
          <p>{{comment.author}} adicionou um novo comentário ao seu ticket.</p>

          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
            <p style="margin-top: 0;"><strong>Ticket:</strong> #{{ticketNumber}} - {{ticket.title}}</p>
            <p><strong>{{comment.author}}</strong> em {{formatDateTime comment.createdAt}}:</p>
            <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
              {{comment.content}}
            </div>
          </div>

          <p style="text-align: center;">
            <a href="{{ticketUrl ticket.id}}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Comentário</a>
          </p>
        `),
        bodyText: `
Novo comentário no seu ticket

Olá {{customer.name}},

{{comment.author}} adicionou um novo comentário ao seu ticket.

Ticket: #{{ticketNumber}} - {{ticket.title}}

{{comment.author}} em {{formatDateTime comment.createdAt}}:
{{comment.content}}

Ver comentário: {{ticketUrl ticket.id}}

---
{{tenant.name}}
{{#if tenant.supportEmail}}Suporte: {{tenant.supportEmail}}{{/if}}
        `,
        language: 'pt-BR',
        category: 'ticket',
        variables: ['ticketNumber', 'ticket.title', 'ticket.id', 'customer.name', 'comment.author', 'comment.content', 'comment.createdAt', 'tenant.name'],
        isActive: true,
      },
    ];

    // Compile all default templates
    for (const template of defaults) {
      this.compile(template);
    }
  }

  /**
   * Get default HTML wrapper
   */
  private getDefaultHtmlWrapper(content: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{subject}}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">{{tenant.name}}</h1>
            <p style="color: #dbeafe; margin: 5px 0 0 0; font-size: 14px;">ServiceDesk Pro</p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
            ${content}
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">Este é um email automático do sistema ServiceDesk Pro.</p>
            {{#if tenant.supportEmail}}
            <p style="color: #64748b; font-size: 14px; margin: 0;">
                Para suporte, entre em contato: <a href="mailto:{{tenant.supportEmail}}" style="color: #2563eb; text-decoration: none;">{{tenant.supportEmail}}</a>
            </p>
            {{/if}}
            <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0 0;">
              © {{tenant.name}} - Todos os direitos reservados
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get all templates
   */
  getAllTemplates(): EmailTemplate[] {
    const templates: EmailTemplate[] = [];

    this.compiledTemplates.forEach((compiled, _key) => {
      templates.push({
        id: compiled.id,
        name: compiled.code,
        code: compiled.code,
        subject: '', // Cannot extract from compiled template
        bodyHtml: '',
        bodyText: '',
        language: compiled.language,
        category: 'custom',
        variables: compiled.variables,
        isActive: true,
      });
    });

    return templates;
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.compiledTemplates.clear();
    this.loadDefaultTemplates();
  }
}

// Type definitions
interface CompiledTemplate {
  id?: number;
  code: string;
  subject: HandlebarsTemplateDelegate<unknown>;
  bodyHtml: HandlebarsTemplateDelegate<unknown>;
  bodyText: HandlebarsTemplateDelegate<unknown>;
  variables: string[];
  language: string;
}

// Singleton instance
export const templateEngine = new TemplateEngine();
export default templateEngine;
