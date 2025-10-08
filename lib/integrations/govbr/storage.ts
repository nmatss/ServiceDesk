/**
 * Gov.br Data Storage Layer
 * Camada de persistência para dados do Gov.br
 */

import { getDb } from '@/lib/db/connection';
import {
  GovBrIntegration,
  CreateGovBrIntegration
} from '@/lib/types/database';

/**
 * Gov.br Integrations
 */
export async function createGovBrIntegration(data: CreateGovBrIntegration): Promise<GovBrIntegration> {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO govbr_integrations (
      user_id, cpf, cnpj, access_token, refresh_token, token_expires_at,
      profile_data, verification_level, last_sync_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.user_id || null,
    data.cpf || null,
    data.cnpj || null,
    data.access_token || null,
    data.refresh_token || null,
    data.token_expires_at || null,
    data.profile_data || null,
    data.verification_level,
    data.last_sync_at || null,
    data.is_active ? 1 : 0
  );

  return getGovBrIntegrationById(result.lastInsertRowid as number)!;
}

export async function getGovBrIntegrationById(id: number): Promise<GovBrIntegration | null> {
  const db = getDb();

  const integration = db.prepare(`
    SELECT * FROM govbr_integrations
    WHERE id = ?
  `).get(id);

  return integration ? convertDbIntegrationToIntegration(integration) : null;
}

export async function getGovBrIntegrationByUserId(userId: number): Promise<GovBrIntegration | null> {
  const db = getDb();

  const integration = db.prepare(`
    SELECT * FROM govbr_integrations
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId);

  return integration ? convertDbIntegrationToIntegration(integration) : null;
}

export async function getGovBrIntegrationByCpf(cpf: string): Promise<GovBrIntegration | null> {
  const db = getDb();

  const cleanCpf = cpf.replace(/\D/g, '');

  const integration = db.prepare(`
    SELECT * FROM govbr_integrations
    WHERE cpf = ? AND is_active = 1
    ORDER BY created_at DESC
    LIMIT 1
  `).get(cleanCpf);

  return integration ? convertDbIntegrationToIntegration(integration) : null;
}

export async function updateGovBrIntegration(integration: GovBrIntegration): Promise<void> {
  const db = getDb();

  db.prepare(`
    UPDATE govbr_integrations
    SET user_id = ?, cpf = ?, cnpj = ?, access_token = ?,
        refresh_token = ?, token_expires_at = ?, profile_data = ?,
        verification_level = ?, last_sync_at = ?, is_active = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    integration.user_id || null,
    integration.cpf || null,
    integration.cnpj || null,
    integration.access_token || null,
    integration.refresh_token || null,
    integration.token_expires_at || null,
    integration.profile_data || null,
    integration.verification_level,
    integration.last_sync_at || null,
    integration.is_active ? 1 : 0,
    integration.id
  );
}

export async function deactivateGovBrIntegration(id: number): Promise<void> {
  const db = getDb();

  db.prepare(`
    UPDATE govbr_integrations
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
}

export async function getExpiredTokens(): Promise<GovBrIntegration[]> {
  const db = getDb();

  const integrations = db.prepare(`
    SELECT * FROM govbr_integrations
    WHERE is_active = 1
      AND token_expires_at IS NOT NULL
      AND datetime(token_expires_at) <= datetime('now')
  `).all();

  return integrations.map(convertDbIntegrationToIntegration);
}

export async function getUserByGovBrCpf(cpf: string): Promise<{ id: number; email: string; name: string } | null> {
  const db = getDb();

  const cleanCpf = cpf.replace(/\D/g, '');

  // Busca usuário pela integração Gov.br
  const result = db.prepare(`
    SELECT u.id, u.email, u.name
    FROM users u
    JOIN govbr_integrations g ON u.id = g.user_id
    WHERE g.cpf = ? AND g.is_active = 1 AND u.is_active = 1
    LIMIT 1
  `).get(cleanCpf);

  return result || null;
}

/**
 * Analytics and Reports
 */
export async function getGovBrStats(days = 30): Promise<{
  totalIntegrations: number;
  activeIntegrations: number;
  verificationLevels: Record<string, number>;
  recentLogins: number;
  cpfValidations: number;
  cnpjValidations: number;
}> {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_integrations,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_integrations,
      COUNT(CASE WHEN datetime(last_sync_at) >= datetime('now', '-${days} days') THEN 1 END) as recent_logins
    FROM govbr_integrations
  `).get();

  // Busca níveis de verificação
  const verificationStats = db.prepare(`
    SELECT verification_level, COUNT(*) as count
    FROM govbr_integrations
    WHERE is_active = 1
    GROUP BY verification_level
  `).all();

  const verificationLevels: Record<string, number> = {};
  verificationStats.forEach((stat: any) => {
    verificationLevels[stat.verification_level || 'unknown'] = stat.count;
  });

  return {
    totalIntegrations: stats.total_integrations || 0,
    activeIntegrations: stats.active_integrations || 0,
    verificationLevels,
    recentLogins: stats.recent_logins || 0,
    cpfValidations: 0, // TODO: Implementar contadores de validação
    cnpjValidations: 0 // TODO: Implementar contadores de validação
  };
}

export async function getGovBrIntegrationsByVerificationLevel(
  level: string
): Promise<Array<GovBrIntegration & { user_name: string; user_email: string }>> {
  const db = getDb();

  const results = db.prepare(`
    SELECT g.*, u.name as user_name, u.email as user_email
    FROM govbr_integrations g
    JOIN users u ON g.user_id = u.id
    WHERE g.verification_level LIKE ? AND g.is_active = 1
    ORDER BY g.last_sync_at DESC
  `).all(`%${level}%`);

  return results.map(row => ({
    ...convertDbIntegrationToIntegration(row),
    user_name: row.user_name,
    user_email: row.user_email
  }));
}

export async function searchGovBrIntegrations(params: {
  cpf?: string;
  cnpj?: string;
  email?: string;
  name?: string;
  verificationLevel?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Array<GovBrIntegration & { user_name: string; user_email: string }>> {
  const db = getDb();

  let whereConditions: string[] = [];
  let queryParams: any[] = [];

  if (params.cpf) {
    whereConditions.push('g.cpf = ?');
    queryParams.push(params.cpf.replace(/\D/g, ''));
  }

  if (params.cnpj) {
    whereConditions.push('g.cnpj = ?');
    queryParams.push(params.cnpj.replace(/\D/g, ''));
  }

  if (params.email) {
    whereConditions.push('u.email LIKE ?');
    queryParams.push(`%${params.email}%`);
  }

  if (params.name) {
    whereConditions.push('u.name LIKE ?');
    queryParams.push(`%${params.name}%`);
  }

  if (params.verificationLevel) {
    whereConditions.push('g.verification_level LIKE ?');
    queryParams.push(`%${params.verificationLevel}%`);
  }

  if (params.isActive !== undefined) {
    whereConditions.push('g.is_active = ?');
    queryParams.push(params.isActive ? 1 : 0);
  }

  const whereClause = whereConditions.length > 0
    ? `WHERE ${whereConditions.join(' AND ')}`
    : '';

  const limit = params.limit || 50;
  const offset = params.offset || 0;

  queryParams.push(limit, offset);

  const results = db.prepare(`
    SELECT g.*, u.name as user_name, u.email as user_email
    FROM govbr_integrations g
    JOIN users u ON g.user_id = u.id
    ${whereClause}
    ORDER BY g.last_sync_at DESC
    LIMIT ? OFFSET ?
  `).all(...queryParams);

  return results.map(row => ({
    ...convertDbIntegrationToIntegration(row),
    user_name: row.user_name,
    user_email: row.user_email
  }));
}

/**
 * Document Validation History
 */
export async function logDocumentValidation(data: {
  integration_id?: number;
  document: string;
  document_type: 'cpf' | 'cnpj' | 'cep' | 'titulo_eleitor' | 'pis_pasep';
  validation_result: boolean;
  validation_data?: any;
  ip_address?: string;
  user_agent?: string;
}): Promise<void> {
  const db = getDb();

  db.prepare(`
    INSERT INTO document_validations (
      integration_id, document, document_type, validation_result,
      validation_data, ip_address, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    data.integration_id || null,
    data.document,
    data.document_type,
    data.validation_result ? 1 : 0,
    data.validation_data ? JSON.stringify(data.validation_data) : null,
    data.ip_address || null,
    data.user_agent || null
  );
}

export async function getDocumentValidationHistory(
  document: string,
  limit = 10
): Promise<Array<{
  id: number;
  document: string;
  document_type: string;
  validation_result: boolean;
  validation_data?: any;
  created_at: string;
}>> {
  const db = getDb();

  const results = db.prepare(`
    SELECT * FROM document_validations
    WHERE document = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(document, limit);

  return results.map(row => ({
    id: row.id,
    document: row.document,
    document_type: row.document_type,
    validation_result: Boolean(row.validation_result),
    validation_data: row.validation_data ? JSON.parse(row.validation_data) : undefined,
    created_at: row.created_at
  }));
}

/**
 * Utility Functions
 */
function convertDbIntegrationToIntegration(dbIntegration: any): GovBrIntegration {
  return {
    id: dbIntegration.id,
    user_id: dbIntegration.user_id || undefined,
    cpf: dbIntegration.cpf || undefined,
    cnpj: dbIntegration.cnpj || undefined,
    access_token: dbIntegration.access_token || undefined,
    refresh_token: dbIntegration.refresh_token || undefined,
    token_expires_at: dbIntegration.token_expires_at || undefined,
    profile_data: dbIntegration.profile_data || undefined,
    verification_level: dbIntegration.verification_level,
    last_sync_at: dbIntegration.last_sync_at || undefined,
    is_active: Boolean(dbIntegration.is_active),
    created_at: dbIntegration.created_at,
    updated_at: dbIntegration.updated_at
  };
}