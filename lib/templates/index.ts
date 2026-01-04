import db from '../db/connection';
import { Template, CreateTemplate, TemplateWithDetails } from '../types/database';
import logger from '../monitoring/structured-logger';

/**
 * Busca templates por tipo e categoria
 */
export function getTemplates(options: {
  type?: string;
  categoryId?: number;
  isActive?: boolean;
  userId?: number;
  limit?: number;
  offset?: number;
} = {}): { templates: TemplateWithDetails[]; total: number } {
  try {
    const {
      type,
      categoryId,
      isActive = true,
      userId,
      limit = 50,
      offset = 0
    } = options;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (type) {
      whereClause += ' AND t.type = ?';
      params.push(type);
    }

    if (categoryId) {
      whereClause += ' AND t.category_id = ?';
      params.push(categoryId);
    }

    if (isActive !== undefined) {
      whereClause += ' AND t.is_active = ?';
      params.push(isActive ? 1 : 0);
    }

    if (userId) {
      whereClause += ' AND t.created_by = ?';
      params.push(userId);
    }

    // Buscar templates
    const templates = db.prepare(`
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        u.name as created_by_name,
        u.email as created_by_email
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      ${whereClause}
      ORDER BY t.usage_count DESC, t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as TemplateWithDetails[];

    // Contar total
    const { total } = db.prepare(`
      SELECT COUNT(*) as total
      FROM templates t
      ${whereClause}
    `).get(...params) as { total: number };

    return { templates, total };
  } catch (error) {
    logger.error('Error getting templates', error);
    return { templates: [], total: 0 };
  }
}

/**
 * Busca template por ID
 */
export function getTemplateById(id: number): TemplateWithDetails | null {
  try {
    return db.prepare(`
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        u.name as created_by_name,
        u.email as created_by_email
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(id) as TemplateWithDetails | null;
  } catch (error) {
    logger.error('Error getting template by ID', error);
    return null;
  }
}

/**
 * Cria um novo template
 */
export function createTemplate(template: CreateTemplate): Template | null {
  try {
    const insertQuery = db.prepare(`
      INSERT INTO templates (
        name, description, type, category_id, title_template,
        content_template, variables, is_active, tags, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertQuery.run(
      template.name,
      template.description || null,
      template.type,
      template.category_id || null,
      template.title_template || null,
      template.content_template,
      template.variables ? JSON.stringify(template.variables) : null,
      template.is_active ? 1 : 0,
      template.tags ? JSON.stringify(template.tags) : null,
      template.created_by
    );

    if (result.lastInsertRowid) {
      return db.prepare('SELECT * FROM templates WHERE id = ?')
        .get(result.lastInsertRowid) as Template;
    }

    return null;
  } catch (error) {
    logger.error('Error creating template', error);
    return null;
  }
}

/**
 * Atualiza template
 */
export function updateTemplate(id: number, updates: Partial<Template>): boolean {
  try {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'variables' || key === 'tags') {
          values.push(value ? JSON.stringify(value) : null);
        } else if (key === 'is_active') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const updateQuery = db.prepare(`
      UPDATE templates
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    const result = updateQuery.run(...values, id);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error updating template', error);
    return false;
  }
}

/**
 * Exclui template
 */
export function deleteTemplate(id: number): boolean {
  try {
    const result = db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error deleting template', error);
    return false;
  }
}

/**
 * Processa template com variáveis
 */
export function processTemplate(
  templateId: number,
  variables: Record<string, any> = {},
  ticketId?: number
): { title: string; content: string; variables_used: string[] } | null {
  try {
    const template = getTemplateById(templateId);
    if (!template || !template.is_active) {
      return null;
    }

    // Buscar dados do ticket se fornecido
    let ticketData: any = null;
    if (ticketId) {
      ticketData = db.prepare(`
        SELECT
          t.*,
          u.name as user_name,
          u.email as user_email,
          c.name as category_name,
          p.name as priority_name,
          s.name as status_name,
          a.name as assigned_to_name
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN users a ON t.assigned_to = a.id
        WHERE t.id = ?
      `).get(ticketId);
    }

    // Variáveis disponíveis
    const availableVariables = {
      current_date: new Date().toLocaleDateString('pt-BR'),
      current_time: new Date().toLocaleTimeString('pt-BR'),
      current_datetime: new Date().toLocaleString('pt-BR'),

      // Variáveis do ticket
      ...(ticketData && {
        ticket_id: ticketData.id,
        ticket_title: ticketData.title,
        ticket_description: ticketData.description,
        ticket_user_name: ticketData.user_name,
        ticket_user_email: ticketData.user_email,
        ticket_category: ticketData.category_name,
        ticket_priority: ticketData.priority_name,
        ticket_status: ticketData.status_name,
        ticket_assigned_to: ticketData.assigned_to_name,
        ticket_created_at: new Date(ticketData.created_at).toLocaleString('pt-BR'),
        ticket_updated_at: new Date(ticketData.updated_at).toLocaleString('pt-BR')
      }),

      // Variáveis customizadas
      ...variables
    };

    // Função para substituir variáveis
    const replaceVariables = (text: string) => {
      const usedVariables: string[] = [];
      const result = text.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
        const trimmedName = variableName.trim();
        if (availableVariables[trimmedName] !== undefined) {
          usedVariables.push(trimmedName);
          return availableVariables[trimmedName];
        }
        return match;
      });
      return { result, usedVariables };
    };

    // Processar título
    const titleResult = replaceVariables(template.title_template || '');
    const contentResult = replaceVariables(template.content_template || '');

    // Combinar variáveis usadas
    const variablesUsed = Array.from(new Set([...titleResult.usedVariables, ...contentResult.usedVariables]));

    // Registrar uso do template
    recordTemplateUsage(templateId, ticketId);

    return {
      title: titleResult.result,
      content: contentResult.result,
      variables_used: variablesUsed
    };
  } catch (error) {
    logger.error('Error processing template', error);
    return null;
  }
}

/**
 * Registra uso do template
 */
export function recordTemplateUsage(templateId: number, ticketId?: number): boolean {
  try {
    // Registrar na tabela de uso
    db.prepare(`
      INSERT INTO template_usage (template_id, ticket_id, used_at)
      VALUES (?, ?, ?)
    `).run(templateId, ticketId || null, new Date().toISOString());

    // Atualizar contador
    db.prepare(`
      UPDATE templates
      SET usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(templateId);

    return true;
  } catch (error) {
    logger.error('Error recording template usage', error);
    return false;
  }
}

/**
 * Busca templates populares
 */
export function getPopularTemplates(limit: number = 10): TemplateWithDetails[] {
  try {
    return db.prepare(`
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.is_active = 1
      ORDER BY t.usage_count DESC, t.created_at DESC
      LIMIT ?
    `).all(limit) as TemplateWithDetails[];
  } catch (error) {
    logger.error('Error getting popular templates', error);
    return [];
  }
}

/**
 * Busca templates por tags
 */
export function getTemplatesByTags(tags: string[]): TemplateWithDetails[] {
  try {
    if (tags.length === 0) return [];

    const templates = db.prepare(`
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.is_active = 1 AND t.tags IS NOT NULL
    `).all() as TemplateWithDetails[];

    // Filtrar por tags
    return templates.filter(template => {
      if (!template.tags) return false;
      const templateTags = JSON.parse(template.tags);
      return tags.some(tag => templateTags.includes(tag));
    });
  } catch (error) {
    logger.error('Error getting templates by tags', error);
    return [];
  }
}

/**
 * Busca estatísticas de uso dos templates
 */
export function getTemplateUsageStats(templateId?: number): any {
  try {
    let whereClause = '';
    const params: any[] = [];

    if (templateId) {
      whereClause = 'WHERE tu.template_id = ?';
      params.push(templateId);
    }

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_usage,
        COUNT(DISTINCT tu.ticket_id) as unique_tickets,
        COUNT(DISTINCT DATE(tu.used_at)) as days_used,
        t.name as template_name,
        t.type as template_type
      FROM template_usage tu
      LEFT JOIN templates t ON tu.template_id = t.id
      ${whereClause}
      GROUP BY tu.template_id, t.name, t.type
      ORDER BY total_usage DESC
    `).all(...params);

    return templateId ? stats[0] || null : stats;
  } catch (error) {
    logger.error('Error getting template usage stats', error);
    return templateId ? null : [];
  }
}

/**
 * Duplica template
 */
export function duplicateTemplate(templateId: number, newName: string, userId: number): Template | null {
  try {
    const original = getTemplateById(templateId);
    if (!original) return null;

    const duplicate: CreateTemplate = {
      name: newName,
      description: `Cópia de: ${original.description || original.name}`,
      type: original.type,
      organization_id: original.organization_id,
      category_id: original.category_id,
      title_template: original.title_template,
      content_template: original.content_template,
      variables: original.variables ? JSON.parse(original.variables) : null,
      is_active: false, // Criar como inativo por padrão
      tags: original.tags ? JSON.parse(original.tags) : null,
      created_by: userId
    };

    return createTemplate(duplicate);
  } catch (error) {
    logger.error('Error duplicating template', error);
    return null;
  }
}

/**
 * Valida variáveis do template
 */
export function validateTemplateVariables(content: string, variables: Record<string, any>): {
  valid: boolean;
  missing_variables: string[];
  extra_variables: string[];
} {
  try {
    // Extrair variáveis do conteúdo
    const contentVariables = new Set<string>();
    const matches = content.match(/\{\{([^}]+)\}\}/g);

    if (matches) {
      matches.forEach(match => {
        const variableName = match.replace(/[{}]/g, '').trim();
        contentVariables.add(variableName);
      });
    }

    const providedVariables = new Set(Object.keys(variables));

    // Variáveis em falta
    const missingVariables = Array.from(contentVariables).filter(
      variable => !providedVariables.has(variable)
    );

    // Variáveis extras
    const extraVariables = Array.from(providedVariables).filter(
      variable => !contentVariables.has(variable)
    );

    return {
      valid: missingVariables.length === 0,
      missing_variables: missingVariables,
      extra_variables: extraVariables
    };
  } catch (error) {
    logger.error('Error validating template variables', error);
    return {
      valid: false,
      missing_variables: [],
      extra_variables: []
    };
  }
}