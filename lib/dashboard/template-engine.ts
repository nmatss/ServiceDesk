/**
 * Dashboard Template Engine
 *
 * Manages dashboard templates - loading, saving, and applying them
 */

import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import logger from '../monitoring/structured-logger';

export interface DashboardTemplate {
  id?: number;
  name: string;
  display_name: string;
  description: string;
  config: any;
  category: 'executive' | 'agent' | 'sla' | 'customer' | 'technical' | 'custom';
  preview_image?: string;
  is_system?: boolean;
  is_active?: boolean;
}

/**
 * Load all available templates
 */
export async function loadDashboardTemplates(
  category?: string,
  includeInactive = false
): Promise<DashboardTemplate[]> {
  try {
    let query = `
      SELECT
        id,
        name,
        display_name,
        description,
        config,
        category,
        preview_image,
        is_system,
        is_active,
        created_at,
        updated_at
      FROM dashboard_templates
      WHERE 1=1
    `;

    const params: (string | number)[] = [];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (!includeInactive) {
      query += ` AND is_active = 1`;
    }

    query += ` ORDER BY is_system DESC, display_name ASC`;

    const templates = await executeQuery<{
      id: number;
      name: string;
      display_name: string;
      description: string;
      config: string;
      category: string;
      preview_image: string | null;
      is_system: number;
      is_active: number;
      created_at: string;
      updated_at: string;
    }>(query, params);

    return templates.map((template) => ({
      ...template,
      config: JSON.parse(template.config),
      is_system: Boolean(template.is_system),
      is_active: Boolean(template.is_active)
    }));
  } catch (error) {
    logger.error('Error loading dashboard templates', error);
    return [];
  }
}

/**
 * Load a specific template by name
 */
export async function loadDashboardTemplate(name: string): Promise<DashboardTemplate | null> {
  try {
    const template = await executeQueryOne<{
      id: number;
      name: string;
      display_name: string;
      description: string;
      config: string;
      category: string;
      preview_image: string | null;
      is_system: number;
      is_active: number;
    }>(`
      SELECT
        id,
        name,
        display_name,
        description,
        config,
        category,
        preview_image,
        is_system,
        is_active
      FROM dashboard_templates
      WHERE name = ? AND is_active = 1
    `, [name]);

    if (!template) {
      return null;
    }

    return {
      ...template,
      config: JSON.parse(template.config),
      is_system: Boolean(template.is_system),
      is_active: Boolean(template.is_active)
    };
  } catch (error) {
    logger.error('Error loading dashboard template', error);
    return null;
  }
}

/**
 * Save a new template
 */
export async function saveDashboardTemplate(
  template: Omit<DashboardTemplate, 'id'>
): Promise<DashboardTemplate | null> {
  try {
    const result = await executeRun(`
      INSERT INTO dashboard_templates (
        name,
        display_name,
        description,
        config,
        category,
        preview_image,
        is_system,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      template.name,
      template.display_name,
      template.description,
      JSON.stringify(template.config),
      template.category,
      template.preview_image || null,
      template.is_system ? 1 : 0,
      template.is_active !== false ? 1 : 0
    ]);

    const savedTemplate = await executeQueryOne<{
      id: number;
      name: string;
      display_name: string;
      description: string;
      config: string;
      category: string;
      preview_image: string | null;
      is_system: number;
      is_active: number;
    }>(`
      SELECT * FROM dashboard_templates WHERE id = ?
    `, [result.lastInsertRowid]);

    if (!savedTemplate) {
      return null;
    }

    return {
      ...savedTemplate,
      config: JSON.parse(savedTemplate.config),
      is_system: Boolean(savedTemplate.is_system),
      is_active: Boolean(savedTemplate.is_active)
    };
  } catch (error) {
    logger.error('Error saving dashboard template', error);
    return null;
  }
}

/**
 * Update an existing template
 */
export async function updateDashboardTemplate(
  id: number,
  updates: Partial<Omit<DashboardTemplate, 'id'>>
): Promise<DashboardTemplate | null> {
  try {
    const existingTemplate = await executeQueryOne<{ is_system: number }>(`
      SELECT is_system FROM dashboard_templates WHERE id = ?
    `, [id]);

    if (!existingTemplate) {
      throw new Error('Template not found');
    }

    if (existingTemplate.is_system) {
      throw new Error('Cannot modify system templates');
    }

    const updateFields: string[] = [];
    const params: (string | number)[] = [];

    if (updates.display_name !== undefined) {
      updateFields.push('display_name = ?');
      params.push(updates.display_name);
    }

    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      params.push(updates.description);
    }

    if (updates.config !== undefined) {
      updateFields.push('config = ?');
      params.push(JSON.stringify(updates.config));
    }

    if (updates.category !== undefined) {
      updateFields.push('category = ?');
      params.push(updates.category);
    }

    if (updates.preview_image !== undefined) {
      updateFields.push('preview_image = ?');
      params.push(updates.preview_image);
    }

    if (updates.is_active !== undefined) {
      updateFields.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return null;
    }

    updateFields.push('updated_at = datetime("now")');
    params.push(id);

    await executeRun(`
      UPDATE dashboard_templates
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, params);

    const updatedTemplate = await executeQueryOne<any>(`
      SELECT * FROM dashboard_templates WHERE id = ?
    `, [id]);

    return {
      ...updatedTemplate,
      config: JSON.parse(updatedTemplate.config),
      is_system: Boolean(updatedTemplate.is_system),
      is_active: Boolean(updatedTemplate.is_active)
    };
  } catch (error) {
    logger.error('Error updating dashboard template', error);
    return null;
  }
}

/**
 * Delete a template
 */
export async function deleteDashboardTemplate(id: number): Promise<boolean> {
  try {
    const existingTemplate = await executeQueryOne<{ is_system: number }>(`
      SELECT is_system FROM dashboard_templates WHERE id = ?
    `, [id]);

    if (!existingTemplate) {
      throw new Error('Template not found');
    }

    if (existingTemplate.is_system) {
      throw new Error('Cannot delete system templates');
    }

    await executeRun(`DELETE FROM dashboard_templates WHERE id = ?`, [id]);

    return true;
  } catch (error) {
    logger.error('Error deleting dashboard template', error);
    return false;
  }
}

/**
 * Apply a template to create a new dashboard
 */
export async function applyTemplate(
  templateName: string,
  userId: number,
  customizations?: {
    name?: string;
    description?: string;
    is_default?: boolean;
  }
): Promise<any> {
  try {
    const template = await loadDashboardTemplate(templateName);

    if (!template) {
      throw new Error('Template not found');
    }

    // Create dashboard from template
    const result = await executeRun(`
      INSERT INTO dashboards (
        name,
        description,
        config,
        user_id,
        is_default,
        is_shared,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      customizations?.name || template.display_name,
      customizations?.description || template.description,
      JSON.stringify(template.config),
      userId,
      customizations?.is_default ? 1 : 0,
      0 // Not shared by default
    ]);

    const dashboard = await executeQueryOne<any>(`
      SELECT * FROM dashboards WHERE id = ?
    `, [result.lastInsertRowid]);

    return {
      ...dashboard,
      config: JSON.parse(dashboard.config),
      is_default: Boolean(dashboard.is_default),
      is_shared: Boolean(dashboard.is_shared)
    };
  } catch (error) {
    logger.error('Error applying dashboard template', error);
    throw error;
  }
}

/**
 * Get template categories
 */
export function getTemplateCategories(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return [
    {
      id: 'executive',
      name: 'Executive',
      description: 'High-level KPIs and trends for executive decision-making'
    },
    {
      id: 'agent',
      name: 'Agent',
      description: 'Detailed metrics for support agents and team leads'
    },
    {
      id: 'sla',
      name: 'SLA',
      description: 'Service level agreement tracking and compliance'
    },
    {
      id: 'customer',
      name: 'Customer',
      description: 'Customer satisfaction and feedback metrics'
    },
    {
      id: 'technical',
      name: 'Technical',
      description: 'Technical metrics and system performance'
    },
    {
      id: 'custom',
      name: 'Custom',
      description: 'User-created custom dashboards'
    }
  ];
}
