import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/auth/super-admin-guard';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun, sqlNow } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

interface SettingRow {
  id: number;
  key: string;
  value: string;
  description: string | null;
  type: string;
  is_public: number;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: Record<string, { value: string; type: string; description: string }> = {
  system_name: { value: 'ServiceDesk', type: 'string', description: 'Nome do sistema' },
  base_url: { value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', type: 'string', description: 'URL base do sistema' },
  maintenance_mode: { value: 'false', type: 'boolean', description: 'Modo de manutenção ativo' },
  max_organizations: { value: '100', type: 'number', description: 'Número máximo de organizações' },
  default_max_users_per_org: { value: '50', type: 'number', description: 'Limite padrão de usuários por organização' },
  default_max_tickets_per_org: { value: '1000', type: 'number', description: 'Limite padrão de tickets por organização' },
  smtp_host: { value: '', type: 'string', description: 'Servidor SMTP' },
  smtp_port: { value: '587', type: 'number', description: 'Porta SMTP' },
  smtp_user: { value: '', type: 'string', description: 'Usuário SMTP' },
  smtp_from_email: { value: '', type: 'string', description: 'E-mail de envio' },
  smtp_from_name: { value: 'ServiceDesk', type: 'string', description: 'Nome do remetente' },
  password_min_length: { value: '8', type: 'number', description: 'Tamanho mínimo de senha' },
  session_timeout_minutes: { value: '60', type: 'number', description: 'Timeout de sessão em minutos' },
  require_2fa: { value: 'false', type: 'boolean', description: 'Exigir autenticação de dois fatores' },
  max_login_attempts: { value: '5', type: 'number', description: 'Máximo de tentativas de login' },
};

function parseSettingValue(value: string, type: string): string | number | boolean {
  if (type === 'boolean') return value === 'true';
  if (type === 'number') {
    const n = Number(value);
    return isNaN(n) ? 0 : n;
  }
  return value;
}

/**
 * GET /api/admin/super/settings
 * Retorna todas as configurações do sistema
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    const rows = await executeQuery<SettingRow>(
      'SELECT * FROM system_settings ORDER BY key ASC'
    );

    const settings: Record<string, unknown> = {};

    // Start with defaults
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      settings[key] = parseSettingValue(def.value, def.type);
    }

    // Override with stored values
    for (const row of rows) {
      settings[row.key] = parseSettingValue(row.value, row.type);
    }

    return apiSuccess(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao carregar configurações: ${message}`, 500);
  }
}

const settingsSchema = z.object({
  system_name: z.string().min(1).max(200).optional(),
  base_url: z.string().max(500).optional(),
  maintenance_mode: z.boolean().optional(),
  max_organizations: z.number().int().min(1).max(100000).optional(),
  default_max_users_per_org: z.number().int().min(1).max(100000).optional(),
  default_max_tickets_per_org: z.number().int().min(1).max(10000000).optional(),
  smtp_host: z.string().max(255).optional(),
  smtp_port: z.number().int().min(1).max(65535).optional(),
  smtp_user: z.string().max(255).optional(),
  smtp_from_email: z.string().max(255).optional(),
  smtp_from_name: z.string().max(255).optional(),
  password_min_length: z.number().int().min(4).max(128).optional(),
  session_timeout_minutes: z.number().int().min(5).max(10080).optional(),
  require_2fa: z.boolean().optional(),
  max_login_attempts: z.number().int().min(1).max(100).optional(),
});

/**
 * PUT /api/admin/super/settings
 * Atualiza configurações do sistema
 */
export async function PUT(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  const guard = requireSuperAdmin(request);
  if (guard.response) return guard.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Corpo da requisição inválido (JSON malformado)', 400);
    }

    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e: { message: string }) => e.message).join('; ');
      return apiError(`Dados inválidos: ${errors}`, 400);
    }

    const data = parsed.data;
    const now = sqlNow();

    for (const [key, rawValue] of Object.entries(data)) {
      if (rawValue === undefined) continue;

      const def = DEFAULT_SETTINGS[key];
      if (!def) continue;

      const stringValue = String(rawValue);

      const existing = await executeQueryOne<{ id: number }>(
        'SELECT id FROM system_settings WHERE key = ?',
        [key]
      );

      if (existing) {
        await executeRun(
          `UPDATE system_settings SET value = ?, updated_by = ?, updated_at = ${now} WHERE key = ?`,
          [stringValue, guard.auth.userId, key]
        );
      } else {
        await executeRun(
          `INSERT INTO system_settings (key, value, description, type, is_public, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ${now}, ${now})`,
          [key, stringValue, def.description, def.type, guard.auth.userId]
        );
      }
    }

    // Return updated settings
    const rows = await executeQuery<SettingRow>(
      'SELECT * FROM system_settings ORDER BY key ASC'
    );

    const settings: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      settings[key] = parseSettingValue(def.value, def.type);
    }
    for (const row of rows) {
      settings[row.key] = parseSettingValue(row.value, row.type);
    }

    return apiSuccess(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return apiError(`Erro ao atualizar configurações: ${message}`, 500);
  }
}
