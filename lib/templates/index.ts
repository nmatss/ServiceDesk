import { executeQuery, executeQueryOne, executeRun, sqlTrue, type SqlParam } from '@/lib/db/adapter';
import { Template, CreateTemplate, TemplateWithDetails } from '../types/database';
import logger from '../monitoring/structured-logger';

/**
 * Busca templates por tipo e categoria
 */
export async function getTemplates(options: {
  type?: string;
  categoryId?: number;
  isActive?: boolean;
  userId?: number;
  limit?: number;
  offset?: number;
} = {}): Promise<{ templates: TemplateWithDetails[]; total: number }> {
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
    const params: SqlParam[] = [];

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
    const templates = await executeQuery<TemplateWithDetails>(`
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
    `, [...params, limit, offset]);

    // Contar total
    const countResult = await executeQueryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM templates t
      ${whereClause}
    `, params);

    return { templates, total: countResult?.total || 0 };
  } catch (error) {
    logger.error('Error getting templates', error);
    return { templates: [], total: 0 };
  }
}

/**
 * Busca template por ID
 */
export async function getTemplateById(id: number): Promise<TemplateWithDetails | null> {
  try {
    const result = await executeQueryOne<TemplateWithDetails>(`
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
    `, [id]);
    return result || null;
  } catch (error) {
    logger.error('Error getting template by ID', error);
    return null;
  }
}

/**
 * Cria um novo template
 */
export async function createTemplate(template: CreateTemplate): Promise<Template | null> {
  try {
    const result = await executeRun(`
      INSERT INTO templates (
        name, description, type, category_id, title_template,
        content_template, variables, is_active, tags, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);

    if (result.lastInsertRowid) {
      const created = await executeQueryOne<Template>(
        'SELECT * FROM templates WHERE id = ?',
        [result.lastInsertRowid]
      );
      return created || null;
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
export async function updateTemplate(id: number, updates: Partial<Template>): Promise<boolean> {
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

    const result = await executeRun(`
      UPDATE templates
      SET ${fields.join(', ')}
      WHERE id = ?
    `, [...values, id]);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error updating template', error);
    return false;
  }
}

/**
 * Exclui template
 */
export async function deleteTemplate(id: number): Promise<boolean> {
  try {
    const result = await executeRun('DELETE FROM templates WHERE id = ?', [id]);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error deleting template', error);
    return false;
  }
}

/**
 * Processa template com variaveis
 */
export async function processTemplate(
  templateId: number,
  variables: Record<string, any> = {},
  ticketId?: number
): Promise<{ title: string; content: string; variables_used: string[] } | null> {
  try {
    const template = await getTemplateById(templateId);
    if (!template || !template.is_active) {
      return null;
    }

    // Buscar dados do ticket se fornecido
    let ticketData: any = null;
    if (ticketId) {
      ticketData = await executeQueryOne(`
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
      `, [ticketId]);
    }

    // Variaveis disponiveis
    const availableVariables: Record<string, any> = {
      current_date: new Date().toLocaleDateString('pt-BR'),
      current_time: new Date().toLocaleTimeString('pt-BR'),
      current_datetime: new Date().toLocaleString('pt-BR'),

      // Variaveis do ticket
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

      // Variaveis customizadas
      ...variables
    };

    // Funcao para substituir variaveis
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

    // Processar titulo
    const titleResult = replaceVariables(template.title_template || '');
    const contentResult = replaceVariables(template.content_template || '');

    // Combinar variaveis usadas
    const variablesUsed = Array.from(new Set([...titleResult.usedVariables, ...contentResult.usedVariables]));

    // Registrar uso do template
    await recordTemplateUsage(templateId, ticketId);

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
export async function recordTemplateUsage(templateId: number, ticketId?: number): Promise<boolean> {
  try {
    // Registrar na tabela de uso
    await executeRun(`
      INSERT INTO template_usage (template_id, ticket_id, used_at)
      VALUES (?, ?, ?)
    `, [templateId, ticketId || null, new Date().toISOString()]);

    // Atualizar contador
    await executeRun(`
      UPDATE templates
      SET usage_count = usage_count + 1,
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [templateId]);

    return true;
  } catch (error) {
    logger.error('Error recording template usage', error);
    return false;
  }
}

/**
 * Busca templates populares
 */
export async function getPopularTemplates(limit: number = 10): Promise<TemplateWithDetails[]> {
  try {
    return await executeQuery<TemplateWithDetails>(`
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.is_active = ${sqlTrue()}
      ORDER BY t.usage_count DESC, t.created_at DESC
      LIMIT ?
    `, [limit]);
  } catch (error) {
    logger.error('Error getting popular templates', error);
    return [];
  }
}

/**
 * Busca templates por tags
 */
export async function getTemplatesByTags(tags: string[]): Promise<TemplateWithDetails[]> {
  try {
    if (tags.length === 0) return [];

    const templates = await executeQuery<TemplateWithDetails>(`
      SELECT
        t.*,
        c.name as category_name,
        c.color as category_color,
        u.name as created_by_name
      FROM templates t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.is_active = ${sqlTrue()} AND t.tags IS NOT NULL
    `);

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
 * Busca estatisticas de uso dos templates
 */
export async function getTemplateUsageStats(templateId?: number): Promise<any> {
  try {
    let whereClause = '';
    const params: SqlParam[] = [];

    if (templateId) {
      whereClause = 'WHERE tu.template_id = ?';
      params.push(templateId);
    }

    const stats = await executeQuery(`
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
    `, params);

    return templateId ? stats[0] || null : stats;
  } catch (error) {
    logger.error('Error getting template usage stats', error);
    return templateId ? null : [];
  }
}

/**
 * Duplica template
 */
export async function duplicateTemplate(templateId: number, newName: string, userId: number): Promise<Template | null> {
  try {
    const original = await getTemplateById(templateId);
    if (!original) return null;

    const duplicate: CreateTemplate = {
      name: newName,
      description: `Copia de: ${original.description || original.name}`,
      type: original.type,
      organization_id: original.organization_id,
      category_id: original.category_id,
      title_template: original.title_template,
      content_template: original.content_template,
      variables: original.variables ? JSON.parse(original.variables) : null,
      is_active: false, // Criar como inativo por padrao
      tags: original.tags ? JSON.parse(original.tags) : null,
      created_by: userId
    };

    return await createTemplate(duplicate);
  } catch (error) {
    logger.error('Error duplicating template', error);
    return null;
  }
}

/**
 * Valida variaveis do template
 */
export function validateTemplateVariables(content: string, variables: Record<string, any>): {
  valid: boolean;
  missing_variables: string[];
  extra_variables: string[];
} {
  try {
    // Extrair variaveis do conteudo
    const contentVariables = new Set<string>();
    const matches = content.match(/\{\{([^}]+)\}\}/g);

    if (matches) {
      matches.forEach(match => {
        const variableName = match.replace(/[{}]/g, '').trim();
        contentVariables.add(variableName);
      });
    }

    const providedVariables = new Set(Object.keys(variables));

    // Variaveis em falta
    const missingVariables = Array.from(contentVariables).filter(
      variable => !providedVariables.has(variable)
    );

    // Variaveis extras
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
