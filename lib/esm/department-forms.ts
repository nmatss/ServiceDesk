/**
 * ESM Department Form Engine
 *
 * Validates ESM form submissions and transforms them into ticket payloads.
 */

import {
  type ESMTemplate,
  type ESMField,
  getWorkspaceById,
  getTemplateById,
} from './workspace-templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface TicketPayload {
  title: string;
  description: string;
  category_name: string;
  priority: string;
  custom_fields: Record<string, unknown>;
  auto_assign_team?: string;
  requester_id: number;
  workspace_id: string;
  template_id: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ---------------------------------------------------------------------------
// DepartmentFormEngine
// ---------------------------------------------------------------------------

export class DepartmentFormEngine {
  /**
   * Retrieve the template definition for a given workspace + template pair.
   */
  getFormForTemplate(workspaceId: string, templateId: string): ESMTemplate | null {
    return getTemplateById(workspaceId, templateId) ?? null;
  }

  /**
   * Validate user-submitted form data against the template field definitions.
   */
  validateForm(template: ESMTemplate, data: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];

    for (const field of template.fields) {
      const value = data[field.name];

      // Required check
      if (field.required && isBlank(value)) {
        errors.push({ field: field.name, message: `${field.label} e obrigatorio` });
        continue;
      }

      // Skip further checks if value is empty and not required
      if (isBlank(value)) continue;

      // Type-specific validation
      switch (field.type) {
        case 'email':
          if (typeof value === 'string' && !isValidEmail(value)) {
            errors.push({ field: field.name, message: `${field.label} deve ser um e-mail valido` });
          }
          break;

        case 'number':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push({ field: field.name, message: `${field.label} deve ser um numero valido` });
          }
          break;

        case 'date':
          if (typeof value === 'string') {
            const d = new Date(value);
            if (isNaN(d.getTime())) {
              errors.push({ field: field.name, message: `${field.label} deve ser uma data valida` });
            }
          }
          break;

        case 'select':
          if (field.options && typeof value === 'string' && !field.options.includes(value)) {
            errors.push({ field: field.name, message: `${field.label}: opcao invalida` });
          }
          break;

        case 'checkbox':
          if (typeof value !== 'boolean') {
            errors.push({ field: field.name, message: `${field.label} deve ser verdadeiro ou falso` });
          }
          break;

        default:
          // text, textarea, file – no extra validation beyond required
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Build a ticket payload from validated form data.
   *
   * The title is derived from the template name plus a prominent field value.
   * The description is a markdown table of all submitted fields.
   */
  buildTicketPayload(
    template: ESMTemplate,
    data: Record<string, unknown>,
    userId: number,
    workspaceId: string,
  ): TicketPayload {
    // Pick the first non-empty text field for a human-readable title suffix
    const titleField = this.pickTitleField(template.fields, data);
    const titleSuffix = titleField ? ` - ${String(titleField)}` : '';
    const title = `${template.name}${titleSuffix}`;

    // Build markdown description
    const lines: string[] = [
      `## ${template.name}`,
      '',
      `> ${template.description}`,
      '',
      '| Campo | Valor |',
      '|---|---|',
    ];

    for (const field of template.fields) {
      const value = data[field.name];
      if (!isBlank(value)) {
        const display = field.type === 'file' ? '(arquivo anexado)' : String(value);
        lines.push(`| ${field.label} | ${display} |`);
      }
    }

    return {
      title,
      description: lines.join('\n'),
      category_name: template.category,
      priority: template.priority,
      custom_fields: data,
      auto_assign_team: template.auto_assign_team,
      requester_id: userId,
      workspace_id: workspaceId,
      template_id: template.id,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private pickTitleField(fields: ESMField[], data: Record<string, unknown>): string | null {
    // Priority: nome_colaborador, nome_solicitante, fornecedor, nome_software, nome_projeto, descricao_item
    const preferred = [
      'nome_colaborador',
      'nome_solicitante',
      'fornecedor',
      'nome_software',
      'nome_projeto',
      'descricao_item',
      'nome_marca',
      'nome_treinamento',
      'contraparte',
      'nome_viajante',
      'nome_pessoa',
      'nome_usuario',
    ];

    for (const key of preferred) {
      const val = data[key];
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }

    // Fall back to first non-empty text field
    for (const field of fields) {
      if ((field.type === 'text' || field.type === 'textarea') && typeof data[field.name] === 'string') {
        const v = (data[field.name] as string).trim();
        if (v) return v.length > 60 ? v.slice(0, 57) + '...' : v;
      }
    }

    return null;
  }
}

/**
 * Singleton instance for convenience.
 */
export const departmentFormEngine = new DepartmentFormEngine();
