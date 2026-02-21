/**
 * Gov.br Verification and Data Normalization
 *
 * Handles verification level processing, CPF/CNPJ validation,
 * profile data normalization, and user synchronization with local database.
 *
 * @module lib/integrations/govbr/verification
 */

import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import logger from '@/lib/monitoring/structured-logger';
import { captureException } from '@/lib/monitoring/sentry-helpers';
import type { GovBrUserProfile, GovBrTokens, TrustLevel } from './oauth-client';
import { getGovBrClient } from './oauth-client';

/**
 * Normalized Gov.br user data for database storage
 */
export interface NormalizedGovBrData {
  cpf?: string;
  cnpj?: string;
  name: string;
  email?: string;
  phone?: string;
  verificationLevel: TrustLevel;
  profileData: string; // JSON
  govbrSub: string;
}

/**
 * User sync result
 */
export interface UserSyncResult {
  success: boolean;
  userId?: number;
  isNewUser?: boolean;
  verificationLevel?: TrustLevel;
  error?: string;
}

/**
 * Normalize Gov.br profile data for database storage
 */
export function normalizeGovBrProfile(profile: GovBrUserProfile): NormalizedGovBrData {
  const client = getGovBrClient();
  const trustLevelInfo = client.getTrustLevel(profile.amr);

  // Extract and clean CPF
  let cpf: string | undefined;
  if (profile.cpf) {
    cpf = profile.cpf.replace(/[^\d]/g, '');
  } else if (profile.sub) {
    const subCPF = profile.sub.replace(/[^\d]/g, '');
    if (subCPF.length === 11) {
      cpf = subCPF;
    }
  }

  // Validate CPF if present
  if (cpf && !client.validateCPF(cpf)) {
    logger.warn('Invalid CPF in Gov.br profile', { cpf: client.formatCPF(cpf) });
    cpf = undefined;
  }

  // Extract and clean CNPJ
  let cnpj: string | undefined;
  if (profile.cnpj) {
    cnpj = profile.cnpj.replace(/[^\d]/g, '');
    if (!client.validateCNPJ(cnpj)) {
      logger.warn('Invalid CNPJ in Gov.br profile', { cnpj: client.formatCNPJ(cnpj) });
      cnpj = undefined;
    }
  }

  // Clean phone number
  let phone: string | undefined;
  if (profile.phone_number) {
    phone = profile.phone_number.replace(/[^\d]/g, '');
  }

  // Prepare profile data for JSON storage
  const profileData = {
    sub: profile.sub,
    given_name: profile.given_name,
    family_name: profile.family_name,
    social_name: profile.social_name,
    birth_date: profile.birth_date,
    email_verified: profile.email_verified,
    phone_number_verified: profile.phone_number_verified,
    picture: profile.picture,
    amr: profile.amr,
    trust_level: trustLevelInfo.level,
    trust_description: trustLevelInfo.description,
  };

  return {
    cpf,
    cnpj,
    name: profile.social_name || profile.name,
    email: profile.email,
    phone,
    verificationLevel: trustLevelInfo.level,
    profileData: JSON.stringify(profileData),
    govbrSub: profile.sub,
  };
}

export async function syncGovBrUser(
  profile: GovBrUserProfile,
  tokens: GovBrTokens,
  tenantId: number
): Promise<UserSyncResult> {
  try {
    const normalized = normalizeGovBrProfile(profile);

    if (!normalized.cpf && !normalized.cnpj) {
      return {
        success: false,
        error: 'CPF ou CNPJ não fornecido pelo Gov.br',
      };
    }

    let existingUser: { id: number; email: string; name: string } | undefined;

    if (normalized.cpf) {
      existingUser = await executeQueryOne<{ id: number; email: string; name: string }>(
        `SELECT id, email, name FROM users WHERE tenant_id = ? AND (email = ? OR metadata LIKE ?)`,
        [
          tenantId,
          normalized.email,
          `%"cpf":"${normalized.cpf}"%`
        ]
      );
    }

    let userId: number;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;

      await executeRun(
        `UPDATE users
         SET name = ?,
             email = ?,
             sso_provider = 'gov_br',
             sso_user_id = ?,
             email_verified_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE email_verified_at END,
             is_email_verified = CASE WHEN ? THEN 1 ELSE is_email_verified END,
             metadata = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [
          normalized.name,
          normalized.email || existingUser.email,
          normalized.govbrSub,
          normalized.email && profile.email_verified ? 1 : 0,
          normalized.email && profile.email_verified ? 1 : 0,
          JSON.stringify({
            cpf: normalized.cpf,
            cnpj: normalized.cnpj,
            phone: normalized.phone,
            govbr_profile: normalized.profileData,
          }),
          userId,
          tenantId
        ]
      );

      logger.info('Updated existing user with Gov.br profile', {
        userId,
        tenantId,
        verificationLevel: normalized.verificationLevel,
      });
    } else {
      const result = await executeRun(
        `INSERT INTO users (
          tenant_id,
          name,
          email,
          role,
          sso_provider,
          sso_user_id,
          is_active,
          is_email_verified,
          email_verified_at,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          normalized.name,
          normalized.email || `govbr_${normalized.cpf}@temp.local`,
          'user',
          'gov_br',
          normalized.govbrSub,
          1,
          normalized.email && profile.email_verified ? 1 : 0,
          normalized.email && profile.email_verified ? new Date().toISOString() : null,
          JSON.stringify({
            cpf: normalized.cpf,
            cnpj: normalized.cnpj,
            phone: normalized.phone,
            govbr_profile: normalized.profileData,
          })
        ]
      );

      userId = result.lastInsertRowid as number;
      isNewUser = true;

      logger.info('Created new user from Gov.br profile', {
        userId,
        tenantId,
        verificationLevel: normalized.verificationLevel,
      });
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const existingIntegration = await executeQueryOne<{ id: number }>(
      `SELECT id FROM govbr_integrations WHERE user_id = ?`,
      [userId]
    );

    if (existingIntegration) {
      await executeRun(
        `UPDATE govbr_integrations
         SET cpf = ?,
             cnpj = ?,
             access_token = ?,
             refresh_token = ?,
             token_expires_at = ?,
             profile_data = ?,
             verification_level = ?,
             last_sync_at = CURRENT_TIMESTAMP,
             is_active = 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          normalized.cpf,
          normalized.cnpj,
          tokens.access_token,
          tokens.refresh_token || null,
          expiresAt,
          normalized.profileData,
          normalized.verificationLevel,
          userId
        ]
      );
    } else {
      await executeRun(
        `INSERT INTO govbr_integrations (
          user_id,
          cpf,
          cnpj,
          access_token,
          refresh_token,
          token_expires_at,
          profile_data,
          verification_level,
          last_sync_at,
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1)`,
        [
          userId,
          normalized.cpf,
          normalized.cnpj,
          tokens.access_token,
          tokens.refresh_token || null,
          expiresAt,
          normalized.profileData,
          normalized.verificationLevel
        ]
      );
    }

    await executeRun(
      `INSERT INTO audit_logs (
        tenant_id,
        user_id,
        entity_type,
        entity_id,
        action,
        new_values
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        userId,
        'user',
        userId,
        isNewUser ? 'govbr_user_created' : 'govbr_user_updated',
        JSON.stringify({
          verification_level: normalized.verificationLevel,
          has_cpf: !!normalized.cpf,
          has_cnpj: !!normalized.cnpj,
          email_verified: profile.email_verified,
        })
      ]
    );

    return {
      success: true,
      userId,
      isNewUser,
      verificationLevel: normalized.verificationLevel,
    };
  } catch (error) {
    logger.error('Error syncing Gov.br user', { error, tenantId });
    captureException(error as Error, {
      tags: { integration: 'govbr', operation: 'user_sync' },
      extra: { tenantId, profile_sub: profile.sub },
      level: 'error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function refreshGovBrTokens(
  userId: number
): Promise<{ success: boolean; tokens?: GovBrTokens; error?: string }> {
  const client = getGovBrClient();

  try {
    const integration = await executeQueryOne<{ refresh_token: string; token_expires_at: string }>(
      `SELECT refresh_token, token_expires_at
       FROM govbr_integrations
       WHERE user_id = ? AND is_active = 1`,
      [userId]
    );

    if (!integration || !integration.refresh_token) {
      return {
        success: false,
        error: 'No refresh token found',
      };
    }

    const expiresAt = new Date(integration.token_expires_at);
    const now = new Date();

    if (expiresAt > now) {
      return {
        success: true,
      };
    }

    const result = await client.refreshAccessToken(integration.refresh_token);

    if (!result.success || !result.tokens) {
      return {
        success: false,
        error: result.error || 'Token refresh failed',
      };
    }

    const newExpiresAt = new Date(Date.now() + result.tokens.expires_in * 1000).toISOString();

    await executeRun(
      `UPDATE govbr_integrations
       SET access_token = ?,
           refresh_token = ?,
           token_expires_at = ?,
           last_sync_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [
        result.tokens.access_token,
        result.tokens.refresh_token || integration.refresh_token,
        newExpiresAt,
        userId
      ]
    );

    logger.info('Gov.br tokens refreshed successfully', { userId });

    return {
      success: true,
      tokens: result.tokens,
    };
  } catch (error) {
    logger.error('Error refreshing Gov.br tokens', { error, userId });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
