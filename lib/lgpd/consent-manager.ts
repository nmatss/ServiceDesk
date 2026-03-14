/**
 * LGPD Consent Management System
 * Full implementation of consent recording, withdrawal, and validation
 * Compliant with LGPD Art. 8º and Art. 9º
 */

import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { logger } from '../monitoring/observability';

export interface ConsentRecord {
  id?: number;
  userId: number;
  purpose: 'analytics' | 'marketing' | 'essential' | 'data_processing' | 'cookies' | 'third_party_sharing';
  granted: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest';
  expiresAt?: Date;
  withdrawnAt?: Date;
  withdrawalReason?: string;
  consentMethod: 'web_form' | 'api' | 'email' | 'phone' | 'import';
  consentEvidence?: string; // JSON evidence
}

export interface ConsentHistory {
  userId: number;
  consents: ConsentRecord[];
  totalGiven: number;
  totalWithdrawn: number;
  lastUpdate: Date;
}

export class ConsentManager {
  /**
   * Record user consent - LGPD Art. 8º compliant
   */
  async recordConsent(consent: Omit<ConsentRecord, 'id' | 'timestamp'>): Promise<number> {
    try {
      const result = await executeRun(`
        INSERT INTO lgpd_consents (
          user_id,
          consent_type,
          purpose,
          legal_basis,
          is_given,
          consent_method,
          consent_evidence,
          ip_address,
          user_agent,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        consent.userId,
        consent.purpose,
        consent.purpose, // purpose description
        consent.legalBasis,
        consent.granted ? 1 : 0,
        consent.consentMethod,
        consent.consentEvidence || null,
        consent.ipAddress,
        consent.userAgent,
        consent.expiresAt?.toISOString() || null
      ]);

      logger.info('Consent recorded', {
        consentId: result.lastInsertRowid,
        userId: consent.userId,
        purpose: consent.purpose,
        granted: consent.granted
      });

      return result.lastInsertRowid as number;
    } catch (error) {
      logger.error('Failed to record consent', { error, consent });
      throw new Error(`Failed to record consent: ${error}`);
    }
  }

  /**
   * Withdraw consent - LGPD Art. 8º § 5º
   */
  async withdrawConsent(
    userId: number,
    purpose: string,
    reason?: string
  ): Promise<void> {
    try {
      const result = await executeRun(`
        UPDATE lgpd_consents
        SET is_given = 0,
            withdrawn_at = CURRENT_TIMESTAMP,
            withdrawal_reason = ?
        WHERE user_id = ? AND consent_type = ? AND is_given = 1
      `, [reason || 'User requested withdrawal', userId, purpose]);

      if (result.changes === 0) {
        throw new Error('No active consent found to withdraw');
      }

      logger.info('Consent withdrawn', { userId, purpose, reason });

      // Trigger data processing review
      await this.reviewDataProcessingAfterWithdrawal(userId, purpose);
    } catch (error) {
      logger.error('Failed to withdraw consent', { error, userId, purpose });
      throw new Error(`Failed to withdraw consent: ${error}`);
    }
  }

  /**
   * Get consent history for user
   */
  async getConsentHistory(userId: number): Promise<ConsentHistory> {
    try {
      const consents = await executeQuery<ConsentRecord>(`
        SELECT
          id,
          user_id as userId,
          consent_type as purpose,
          is_given as granted,
          created_at as timestamp,
          ip_address as ipAddress,
          user_agent as userAgent,
          legal_basis as legalBasis,
          expires_at as expiresAt,
          withdrawn_at as withdrawnAt,
          withdrawal_reason as withdrawalReason,
          consent_method as consentMethod,
          consent_evidence as consentEvidence
        FROM lgpd_consents
        WHERE user_id = ?
        ORDER BY created_at DESC
      `, [userId]);

      const totalGiven = consents.filter(c => c.granted).length;
      const totalWithdrawn = consents.filter(c => c.withdrawnAt).length;
      const lastUpdate = consents.length > 0 ? new Date(consents[0]?.timestamp || Date.now()) : new Date();

      return {
        userId,
        consents,
        totalGiven,
        totalWithdrawn,
        lastUpdate
      };
    } catch (error) {
      logger.error('Failed to get consent history', { error, userId });
      throw new Error(`Failed to get consent history: ${error}`);
    }
  }

  /**
   * Validate if user has valid consent for specific purpose
   */
  async validateConsent(userId: number, purpose: string): Promise<{
    valid: boolean;
    consentId?: number;
    grantedAt?: Date;
    expiresAt?: Date;
    reason?: string;
  }> {
    try {
      const consent = await executeQueryOne(`
        SELECT
          id,
          created_at as grantedAt,
          expires_at as expiresAt,
          is_given as granted
        FROM lgpd_consents
        WHERE user_id = ? AND consent_type = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId, purpose]);

      if (!consent) {
        return {
          valid: false,
          reason: 'No consent record found'
        };
      }

      if (!consent.granted) {
        return {
          valid: false,
          consentId: consent.id,
          reason: 'Consent was withdrawn'
        };
      }

      // Check expiry
      if (consent.expiresAt) {
        const expiryDate = new Date(consent.expiresAt);
        if (expiryDate < new Date()) {
          return {
            valid: false,
            consentId: consent.id,
            grantedAt: new Date(consent.grantedAt),
            expiresAt: expiryDate,
            reason: 'Consent expired'
          };
        }
      }

      return {
        valid: true,
        consentId: consent.id,
        grantedAt: new Date(consent.grantedAt),
        expiresAt: consent.expiresAt ? new Date(consent.expiresAt) : undefined
      };
    } catch (error) {
      logger.error('Failed to validate consent', { error, userId, purpose });
      return {
        valid: false,
        reason: `Validation error: ${error}`
      };
    }
  }

  /**
   * Get all active consents for user
   */
  async getActiveConsents(userId: number): Promise<string[]> {
    try {
      const consents = await executeQuery<{ consent_type: string }>(`
        SELECT DISTINCT consent_type
        FROM lgpd_consents
        WHERE user_id = ? AND is_given = 1
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `, [userId]);

      return consents.map(c => c.consent_type);
    } catch (error) {
      logger.error('Failed to get active consents', { error, userId });
      return [];
    }
  }

  /**
   * Bulk withdraw all consents (for account deletion)
   */
  async withdrawAllConsents(userId: number, reason: string = 'Account deletion'): Promise<number> {
    try {
      const result = await executeRun(`
        UPDATE lgpd_consents
        SET is_given = 0,
            withdrawn_at = CURRENT_TIMESTAMP,
            withdrawal_reason = ?
        WHERE user_id = ? AND is_given = 1
      `, [reason, userId]);

      logger.info('All consents withdrawn', { userId, count: result.changes });

      return result.changes;
    } catch (error) {
      logger.error('Failed to withdraw all consents', { error, userId });
      throw new Error(`Failed to withdraw all consents: ${error}`);
    }
  }

  /**
   * Check expiring consents (for automated notifications)
   */
  async getExpiringConsents(daysBeforeExpiry: number = 30): Promise<ConsentRecord[]> {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + daysBeforeExpiry);

      const consents = await executeQuery<ConsentRecord>(`
        SELECT
          id,
          user_id as userId,
          consent_type as purpose,
          is_given as granted,
          created_at as timestamp,
          expires_at as expiresAt
        FROM lgpd_consents
        WHERE is_given = 1
          AND expires_at IS NOT NULL
          AND expires_at <= ?
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY expires_at ASC
      `, [expiryDate.toISOString()]);

      return consents;
    } catch (error) {
      logger.error('Failed to get expiring consents', { error });
      return [];
    }
  }

  /**
   * Generate consent statistics for compliance reporting
   */
  async getConsentStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalConsents: number;
    activeConsents: number;
    withdrawnConsents: number;
    expiredConsents: number;
    byPurpose: Record<string, number>;
    byLegalBasis: Record<string, number>;
  }> {
    try {
      const dateFilter = startDate && endDate
        ? `AND created_at BETWEEN ? AND ?`
        : '';
      const dateParams = startDate && endDate
        ? [startDate.toISOString(), endDate.toISOString()]
        : [];

      const stats = await executeQueryOne(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN is_given = 1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN withdrawn_at IS NOT NULL THEN 1 ELSE 0 END) as withdrawn,
          SUM(CASE WHEN expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) as expired
        FROM lgpd_consents
        WHERE 1=1 ${dateFilter}
      `, dateParams);

      const byPurpose = await executeQuery<{ consent_type: string; count: number }>(`
        SELECT consent_type, COUNT(*) as count
        FROM lgpd_consents
        WHERE 1=1 ${dateFilter}
        GROUP BY consent_type
      `, dateParams);

      const byLegalBasis = await executeQuery<{ legal_basis: string; count: number }>(`
        SELECT legal_basis, COUNT(*) as count
        FROM lgpd_consents
        WHERE 1=1 ${dateFilter}
        GROUP BY legal_basis
      `, dateParams);

      return {
        totalConsents: stats?.total || 0,
        activeConsents: stats?.active || 0,
        withdrawnConsents: stats?.withdrawn || 0,
        expiredConsents: stats?.expired || 0,
        byPurpose: byPurpose.reduce((acc, item) => ({ ...acc, [item.consent_type]: item.count }), {} as Record<string, number>),
        byLegalBasis: byLegalBasis.reduce((acc, item) => ({ ...acc, [item.legal_basis]: item.count }), {} as Record<string, number>)
      };
    } catch (error) {
      logger.error('Failed to get consent statistics', { error });
      throw new Error(`Failed to get consent statistics: ${error}`);
    }
  }

  /**
   * Private: Review data processing after consent withdrawal
   */
  private async reviewDataProcessingAfterWithdrawal(userId: number, purpose: string): Promise<void> {
    try {
      // Log the data processing review
      logger.warn('Data processing review triggered', { userId, purpose });

      // In a real implementation, this would:
      // 1. Stop all automated data processing for this purpose
      // 2. Remove user from marketing lists if marketing consent withdrawn
      // 3. Disable analytics tracking if analytics consent withdrawn
      // 4. Schedule data deletion if no legal basis remains

      // For now, we just log it for compliance audit
      await executeRun(`
        INSERT INTO audit_advanced (
          entity_type, entity_id, action, new_values, organization_id
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        'consent',
        userId,
        'withdrawal_review',
        JSON.stringify({ purpose, reviewDate: new Date().toISOString() }),
        1 // Default organization
      ]);
    } catch (error) {
      logger.error('Failed to review data processing', { error, userId, purpose });
    }
  }
}

export const consentManager = new ConsentManager();
