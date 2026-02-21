/**
 * WhatsApp Message Templates System
 * Manages WhatsApp Business API message templates
 *
 * Features:
 * - Pre-approved template management
 * - Multi-language support
 * - Dynamic variable substitution
 * - Template registration with WhatsApp
 * - Template categories (transactional, marketing, authentication)
 */

import { WhatsAppBusinessAPI } from './business-api';
import logger from '@/lib/monitoring/structured-logger';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';

export interface WhatsAppTemplate {
  id?: number;
  name: string;
  category: 'TRANSACTIONAL' | 'MARKETING' | 'AUTHENTICATION' | 'UTILITY';
  language: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  components: TemplateComponent[];
  variables?: Record<string, string>;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: TemplateButton[];
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateRegistrationRequest {
  name: string;
  category: string;
  language: string;
  components: TemplateComponent[];
}

export interface TemplateRegistrationResponse {
  success: boolean;
  templateId?: string;
  status?: string;
  error?: string;
}

/**
 * WhatsApp Template Manager
 */
export class WhatsAppTemplateManager {
  private api: WhatsAppBusinessAPI;
  private businessAccountId: string;

  constructor(api: WhatsAppBusinessAPI, businessAccountId: string) {
    this.api = api;
    this.businessAccountId = businessAccountId;
  }

  /**
   * Register a new template with WhatsApp
   */
  async registerTemplate(template: TemplateRegistrationRequest): Promise<TemplateRegistrationResponse> {
    try {
      // Validate template
      this.validateTemplate(template);

      // Register with WhatsApp API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.businessAccountId}/message_templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(template),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to register template');
      }

      // Save to local database
      await this.saveTemplateToDatabase({
        name: template.name,
        category: template.category as any,
        language: template.language,
        status: 'PENDING',
        components: template.components,
      });

      logger.info('WhatsApp template registered', {
        templateName: template.name,
        templateId: data.id,
      });

      return {
        success: true,
        templateId: data.id,
        status: data.status,
      };
    } catch (error) {
      logger.error('Error registering WhatsApp template', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateName: template.name,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List all templates
   */
  async listTemplates(filters?: {
    status?: string;
    category?: string;
    language?: string;
  }): Promise<WhatsAppTemplate[]> {
    try {
      let query = 'SELECT * FROM whatsapp_templates WHERE 1=1';
      const params: any[] = [];

      if (filters?.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters?.category) {
        query += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters?.language) {
        query += ' AND language = ?';
        params.push(filters.language);
      }

      query += ' ORDER BY created_at DESC';

      const templates = await executeQuery<any>(query, params);

      return templates.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        language: t.language,
        status: t.status,
        components: JSON.parse(t.components || '[]'),
        variables: t.variables ? JSON.parse(t.variables) : undefined,
        metadata: t.metadata ? JSON.parse(t.metadata) : undefined,
        created_at: t.created_at,
        updated_at: t.updated_at,
      }));
    } catch (error) {
      logger.error('Error listing templates', { error });
      return [];
    }
  }

  /**
   * Get template by name
   */
  async getTemplate(name: string, language: string = 'pt_BR'): Promise<WhatsAppTemplate | null> {
    try {
      const template = await executeQueryOne<any>(
        'SELECT * FROM whatsapp_templates WHERE name = ? AND language = ? LIMIT 1',
        [name, language]
      );

      if (!template) {
        return null;
      }

      return {
        id: template.id,
        name: template.name,
        category: template.category,
        language: template.language,
        status: template.status,
        components: JSON.parse(template.components || '[]'),
        variables: template.variables ? JSON.parse(template.variables) : undefined,
        metadata: template.metadata ? JSON.parse(template.metadata) : undefined,
        created_at: template.created_at,
        updated_at: template.updated_at,
      };
    } catch (error) {
      logger.error('Error getting template', { error, name, language });
      return null;
    }
  }

  /**
   * Send template message with variable substitution
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    variables: Record<string, string>,
    language: string = 'pt_BR'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get template
      const template = await this.getTemplate(templateName, language);
      if (!template) {
        throw new Error(`Template ${templateName} not found`);
      }

      if (template.status !== 'APPROVED') {
        throw new Error(`Template ${templateName} is not approved (status: ${template.status})`);
      }

      // Build components with variables
      const components = this.buildTemplateComponents(template, variables);

      // Send via API - the method signature needs tenantId
      return await this.api.sendTemplateMessage(to, templateName, language, components);
    } catch (error) {
      logger.error('Error sending template message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateName,
        to,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build template components with variable substitution
   */
  private buildTemplateComponents(template: WhatsAppTemplate, variables: Record<string, string>): any[] {
    const components: any[] = [];

    for (const component of template.components) {
      if (component.type === 'HEADER' && component.format === 'TEXT' && component.text) {
        // Header with variables
        const headerVars = this.extractVariables(component.text);
        if (headerVars.length > 0) {
          components.push({
            type: 'header',
            parameters: headerVars.map((varName) => ({
              type: 'text',
              text: variables[varName] || `{{${varName}}}`,
            })),
          });
        }
      } else if (component.type === 'HEADER' && component.format !== 'TEXT') {
        // Media header
        components.push({
          type: 'header',
          parameters: [
            {
              type: component.format?.toLowerCase(),
              [component.format?.toLowerCase() || 'image']: {
                link: variables.header_media_url || '',
              },
            },
          ],
        });
      }

      if (component.type === 'BODY' && component.text) {
        // Body with variables
        const bodyVars = this.extractVariables(component.text);
        if (bodyVars.length > 0) {
          components.push({
            type: 'body',
            parameters: bodyVars.map((varName) => ({
              type: 'text',
              text: variables[varName] || `{{${varName}}}`,
            })),
          });
        }
      }

      if (component.type === 'BUTTONS' && component.buttons) {
        // Button components
        component.buttons.forEach((button, index) => {
          if (button.type === 'URL' && button.url && button.url.includes('{{')) {
            const urlVars = this.extractVariables(button.url);
            if (urlVars.length > 0) {
              components.push({
                type: 'button',
                sub_type: 'url',
                index,
                parameters: urlVars.map((varName) => ({
                  type: 'text',
                  text: variables[varName] || '',
                })),
              });
            }
          }
        });
      }
    }

    return components;
  }

  /**
   * Extract variable names from template text
   */
  private extractVariables(text: string): string[] {
    const regex = /\{\{(\d+)\}\}/g;
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      }
    }

    return matches;
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: TemplateRegistrationRequest): void {
    if (!template.name || template.name.length < 1 || template.name.length > 512) {
      throw new Error('Template name must be between 1 and 512 characters');
    }

    if (!['TRANSACTIONAL', 'MARKETING', 'AUTHENTICATION', 'UTILITY'].includes(template.category)) {
      throw new Error('Invalid template category');
    }

    if (!template.language || !template.language.match(/^[a-z]{2}_[A-Z]{2}$/)) {
      throw new Error('Invalid language code format (expected: xx_XX)');
    }

    if (!template.components || template.components.length === 0) {
      throw new Error('Template must have at least one component');
    }

    // Validate components
    let hasBody = false;
    for (const component of template.components) {
      if (component.type === 'BODY') {
        hasBody = true;
      }

      if (component.type === 'HEADER' && component.format !== 'TEXT') {
        if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format || '')) {
          throw new Error('Invalid header format');
        }
      }
    }

    if (!hasBody) {
      throw new Error('Template must have a BODY component');
    }
  }

  /**
   * Save template to local database
   */
  private async saveTemplateToDatabase(template: WhatsAppTemplate): Promise<void> {
    try {
      const existing = await executeQueryOne<{ id: number }>(
        'SELECT id FROM whatsapp_templates WHERE name = ? AND language = ?',
        [template.name, template.language]
      );

      if (existing) {
        await executeRun(
          `UPDATE whatsapp_templates
           SET category = ?, status = ?, components = ?, variables = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
           WHERE name = ? AND language = ?`,
          [
            template.category,
            template.status,
            JSON.stringify(template.components),
            template.variables ? JSON.stringify(template.variables) : null,
            template.metadata ? JSON.stringify(template.metadata) : null,
            template.name,
            template.language
          ]
        );
      } else {
        await executeRun(
          `INSERT INTO whatsapp_templates (name, category, language, status, components, variables, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            template.name,
            template.category,
            template.language,
            template.status,
            JSON.stringify(template.components),
            template.variables ? JSON.stringify(template.variables) : null,
            template.metadata ? JSON.stringify(template.metadata) : null
          ]
        );
      }
    } catch (error) {
      logger.error('Error saving template to database', { error });
      throw error;
    }
  }

  /**
   * Update template status (after approval/rejection)
   */
  async updateTemplateStatus(name: string, language: string, status: string): Promise<void> {
    try {
      await executeRun(
        `UPDATE whatsapp_templates
         SET status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE name = ? AND language = ?`,
        [status, name, language]
      );

      logger.info('Template status updated', { name, language, status });
    } catch (error) {
      logger.error('Error updating template status', { error, name, language, status });
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(name: string, language: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from local database
      await executeRun(
        'DELETE FROM whatsapp_templates WHERE name = ? AND language = ?',
        [name, language]
      );

      // Note: Deleting from WhatsApp API requires the template ID
      // You may want to implement API deletion separately

      logger.info('Template deleted', { name, language });

      return { success: true };
    } catch (error) {
      logger.error('Error deleting template', { error, name, language });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Pre-defined template library for common ServiceDesk scenarios
 */
export const PREDEFINED_TEMPLATES = {
  TICKET_CREATED: {
    name: 'ticket_created',
    category: 'TRANSACTIONAL' as const,
    language: 'pt_BR',
    components: [
      {
        type: 'BODY' as const,
        text: 'Olá {{1}}! Seu chamado #{{2}} foi criado com sucesso. Nossa equipe responderá em breve.',
      },
      {
        type: 'FOOTER' as const,
        text: 'ServiceDesk - Atendimento automatizado',
      },
    ],
  },

  TICKET_UPDATED: {
    name: 'ticket_updated',
    category: 'TRANSACTIONAL' as const,
    language: 'pt_BR',
    components: [
      {
        type: 'BODY' as const,
        text: '📋 Atualização do chamado #{{1}}\n\nStatus: {{2}}\n\n{{3}}',
      },
    ],
  },

  TICKET_ASSIGNED: {
    name: 'ticket_assigned',
    category: 'TRANSACTIONAL' as const,
    language: 'pt_BR',
    components: [
      {
        type: 'BODY' as const,
        text: '✅ Seu chamado #{{1}} foi atribuído ao agente {{2}}. Em breve você receberá uma resposta.',
      },
    ],
  },

  TICKET_RESOLVED: {
    name: 'ticket_resolved',
    category: 'TRANSACTIONAL' as const,
    language: 'pt_BR',
    components: [
      {
        type: 'BODY' as const,
        text: '🎉 Seu chamado #{{1}} foi resolvido!\n\nSolução: {{2}}\n\nSe você ainda tiver dúvidas, responda esta mensagem.',
      },
      {
        type: 'BUTTONS' as const,
        buttons: [
          { type: 'QUICK_REPLY' as const, text: '👍 Resolvido' },
          { type: 'QUICK_REPLY' as const, text: '👎 Ainda com problema' },
        ],
      },
    ],
  },

  AGENT_RESPONSE: {
    name: 'agent_response',
    category: 'TRANSACTIONAL' as const,
    language: 'pt_BR',
    components: [
      {
        type: 'HEADER' as const,
        format: 'TEXT' as const,
        text: 'Resposta do Agente',
      },
      {
        type: 'BODY' as const,
        text: '📨 Chamado #{{1}}\nAgente: {{2}}\n\n{{3}}',
      },
    ],
  },

  SLA_WARNING: {
    name: 'sla_warning',
    category: 'TRANSACTIONAL' as const,
    language: 'pt_BR',
    components: [
      {
        type: 'BODY' as const,
        text: '⚠️ Atenção: O prazo do seu chamado #{{1}} está próximo do vencimento.\n\nVence em: {{2}}',
      },
    ],
  },
};

export default WhatsAppTemplateManager;
