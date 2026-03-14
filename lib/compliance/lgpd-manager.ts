import { executeQuery, executeQueryOne, executeRun, executeTransaction } from '@/lib/db/adapter';

export class LGPDManager {
  /**
   * Registra consentimento do usuário
   */
  async recordConsent(
    userId: number,
    consentType: 'data_processing' | 'marketing' | 'analytics' | 'cookies',
    purpose: string,
    legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest',
    isGiven: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await executeRun(`
      INSERT INTO lgpd_consents (
        user_id, consent_type, purpose, legal_basis, is_given,
        ip_address, user_agent, consent_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'web_form')
    `, [userId, consentType, purpose, legalBasis, isGiven ? 1 : 0, ipAddress, userAgent]);
  }

  /**
   * Direito de acesso - exporta todos os dados do usuário
   */
  async exportUserData(userId: number, organizationId: number): Promise<any> {
    const userData: any = {
      user: null,
      tickets: [],
      comments: [],
      consents: [],
      auditLogs: []
    };

    // User data
    userData.user = await executeQueryOne(`
      SELECT id, name, email, role, created_at, updated_at
      FROM users WHERE id = ? AND organization_id = ?
    `, [userId, organizationId]);

    // Tickets
    userData.tickets = await executeQuery(`
      SELECT * FROM tickets WHERE user_id = ? AND organization_id = ?
    `, [userId, organizationId]);

    // Comments
    userData.comments = await executeQuery(`
      SELECT c.* FROM comments c
      INNER JOIN tickets t ON c.ticket_id = t.id
      WHERE c.user_id = ? AND t.organization_id = ?
    `, [userId, organizationId]);

    // Consents
    userData.consents = await executeQuery(`
      SELECT * FROM lgpd_consents WHERE user_id = ?
    `, [userId]);

    // Audit logs
    userData.auditLogs = await executeQuery(`
      SELECT * FROM audit_advanced
      WHERE user_id = ? AND organization_id = ?
      ORDER BY created_at DESC LIMIT 1000
    `, [userId, organizationId]);

    return userData;
  }

  /**
   * Direito ao esquecimento - anonimiza dados do usuário
   */
  async anonymizeUser(userId: number, organizationId: number): Promise<void> {
    await executeTransaction(async (db) => {
      // Anonimiza dados do usuário
      await db.run(`
        UPDATE users SET
          name = 'Usuário Anonimizado',
          email = 'anonymized_' || id || '@deleted.local',
          password_hash = NULL,
          avatar_url = NULL,
          metadata = NULL
        WHERE id = ? AND organization_id = ?
      `, [userId, organizationId]);

      // Anonimiza comentários
      await db.run(`
        UPDATE comments SET
          content = '[CONTEÚDO REMOVIDO POR SOLICITAÇÃO DO USUÁRIO]'
        WHERE user_id = ? AND ticket_id IN (
          SELECT id FROM tickets WHERE organization_id = ?
        )
      `, [userId, organizationId]);

      // Marca consents como withdrawn
      await db.run(`
        UPDATE lgpd_consents SET
          is_given = 0,
          withdrawn_at = CURRENT_TIMESTAMP,
          withdrawal_reason = 'User requested data deletion'
        WHERE user_id = ?
      `, [userId]);

      // Log da anonimização
      await db.run(`
        INSERT INTO audit_advanced (
          entity_type, entity_id, action, organization_id
        ) VALUES ('user', ?, 'anonymize', ?)
      `, [userId, organizationId]);
    });
  }

  /**
   * Verifica se usuário deu consentimento
   */
  async hasConsent(
    userId: number,
    consentType: string
  ): Promise<boolean> {
    const consent = await executeQueryOne(`
      SELECT is_given FROM lgpd_consents
      WHERE user_id = ? AND consent_type = ?
      ORDER BY created_at DESC LIMIT 1
    `, [userId, consentType]);

    return consent?.is_given === 1;
  }
}

export const lgpdManager = new LGPDManager();
