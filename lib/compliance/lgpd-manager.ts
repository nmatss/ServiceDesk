import db from '../db/connection';

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
    db.prepare(`
      INSERT INTO lgpd_consents (
        user_id, consent_type, purpose, legal_basis, is_given,
        ip_address, user_agent, consent_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'web_form')
    `).run(userId, consentType, purpose, legalBasis, isGiven ? 1 : 0, ipAddress, userAgent);
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
    userData.user = db.prepare(`
      SELECT id, name, email, role, created_at, updated_at
      FROM users WHERE id = ? AND organization_id = ?
    `).get(userId, organizationId);

    // Tickets
    userData.tickets = db.prepare(`
      SELECT * FROM tickets WHERE user_id = ? AND organization_id = ?
    `).all(userId, organizationId);

    // Comments
    userData.comments = db.prepare(`
      SELECT c.* FROM comments c
      INNER JOIN tickets t ON c.ticket_id = t.id
      WHERE c.user_id = ? AND t.organization_id = ?
    `).all(userId, organizationId);

    // Consents
    userData.consents = db.prepare(`
      SELECT * FROM lgpd_consents WHERE user_id = ?
    `).all(userId);

    // Audit logs
    userData.auditLogs = db.prepare(`
      SELECT * FROM audit_advanced
      WHERE user_id = ? AND organization_id = ?
      ORDER BY created_at DESC LIMIT 1000
    `).all(userId, organizationId);

    return userData;
  }

  /**
   * Direito ao esquecimento - anonimiza dados do usuário
   */
  async anonymizeUser(userId: number, organizationId: number): Promise<void> {
    const transaction = db.transaction(() => {
      // Anonimiza dados do usuário
      db.prepare(`
        UPDATE users SET
          name = 'Usuário Anonimizado',
          email = 'anonymized_' || id || '@deleted.local',
          password_hash = NULL,
          avatar_url = NULL,
          metadata = NULL
        WHERE id = ? AND organization_id = ?
      `).run(userId, organizationId);

      // Anonimiza comentários
      db.prepare(`
        UPDATE comments SET
          content = '[CONTEÚDO REMOVIDO POR SOLICITAÇÃO DO USUÁRIO]'
        WHERE user_id = ? AND ticket_id IN (
          SELECT id FROM tickets WHERE organization_id = ?
        )
      `).run(userId, organizationId);

      // Marca consents como withdrawn
      db.prepare(`
        UPDATE lgpd_consents SET
          is_given = 0,
          withdrawn_at = CURRENT_TIMESTAMP,
          withdrawal_reason = 'User requested data deletion'
        WHERE user_id = ?
      `).run(userId);

      // Log da anonimização
      db.prepare(`
        INSERT INTO audit_advanced (
          entity_type, entity_id, action, organization_id
        ) VALUES ('user', ?, 'anonymize', ?)
      `).run(userId, organizationId);
    });

    transaction();
  }

  /**
   * Verifica se usuário deu consentimento
   */
  async hasConsent(
    userId: number,
    consentType: string
  ): Promise<boolean> {
    const consent = db.prepare(`
      SELECT is_given FROM lgpd_consents
      WHERE user_id = ? AND consent_type = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, consentType) as any;

    return consent?.is_given === 1;
  }
}

export const lgpdManager = new LGPDManager();
