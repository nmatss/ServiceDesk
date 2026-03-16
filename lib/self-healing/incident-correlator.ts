/**
 * Incident Correlator — Self-Healing Module
 *
 * Correlates incoming alerts with CMDB configuration items and existing tickets
 * to determine blast radius and risk level.
 */

import { executeQuery, type SqlParam } from '@/lib/db/adapter';
import { logger, EventType, LogLevel } from '@/lib/monitoring/logger';
import type { NormalizedAlert } from './monitor-bridge';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CorrelatedCI {
  id: number;
  ci_number: string;
  name: string;
  description: string | null;
  ci_type_name: string;
  status_name: string;
  is_operational: boolean;
  environment: string | null;
  criticality: string | null;
  hostname: string | null;
  ip_address: string | null;
}

export interface RelatedTicket {
  id: number;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

export interface CorrelationResult {
  ci: CorrelatedCI | null;
  related_cis: CorrelatedCI[];
  existing_tickets: RelatedTicket[];
  blast_radius: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

// ─── IncidentCorrelator ──────────────────────────────────────────────────────

export class IncidentCorrelator {
  /**
   * Correlate an alert with CMDB CIs and existing tickets.
   */
  async correlate(orgId: number, alert: NormalizedAlert): Promise<CorrelationResult> {
    try {
      // 1. Find matching CI by service name / hostname / tags
      const ci = await this.findMatchingCI(orgId, alert);

      // 2. Find related/dependent CIs
      const relatedCIs = ci ? await this.findRelatedCIs(orgId, ci.id) : [];

      // 3. Check for existing open tickets related to this CI/service
      const existingTickets = await this.findExistingTickets(orgId, alert, ci);

      // 4. Calculate blast radius
      const blastRadius = this.calculateBlastRadius(ci, relatedCIs);

      // 5. Calculate risk level
      const riskLevel = this.calculateRiskLevel(alert, ci, blastRadius);

      logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Correlation complete: CI=${ci?.name || 'none'}, blast=${blastRadius}, risk=${riskLevel}`, {
          orgId,
          alertId: alert.id,
          ciId: ci?.id,
          relatedCICount: relatedCIs.length,
          existingTicketCount: existingTickets.length,
          blastRadius,
          riskLevel,
        });

      return {
        ci,
        related_cis: relatedCIs,
        existing_tickets: existingTickets,
        blast_radius: blastRadius,
        risk_level: riskLevel,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.log(LogLevel.ERROR, EventType.ERROR, `[Self-Healing] Correlation error: ${errMsg}`, { orgId, alertId: alert.id });

      return {
        ci: null,
        related_cis: [],
        existing_tickets: [],
        blast_radius: 0,
        risk_level: 'medium',
      };
    }
  }

  /**
   * Find a CI matching the alert's service name, hostname, or IP.
   */
  private async findMatchingCI(orgId: number, alert: NormalizedAlert): Promise<CorrelatedCI | null> {
    const searchTerms: string[] = [];
    const params: SqlParam[] = [orgId];

    if (alert.service && alert.service !== 'unknown') {
      searchTerms.push(alert.service);
    }
    if (alert.tags.host) searchTerms.push(alert.tags.host);
    if (alert.tags.hostname) searchTerms.push(alert.tags.hostname);
    if (alert.tags.instance) {
      // Prometheus instance format: "host:port"
      const host = alert.tags.instance.split(':')[0];
      if (host) searchTerms.push(host);
    }
    if (alert.tags.ip) searchTerms.push(alert.tags.ip);

    if (searchTerms.length === 0) return null;

    // Build OR conditions for matching
    const conditions: string[] = [];
    for (const term of searchTerms) {
      const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
      conditions.push("(ci.name LIKE ? ESCAPE '\\')");
      params.push(`%${escaped}%`);
      conditions.push("(ci.hostname LIKE ? ESCAPE '\\')");
      params.push(`%${escaped}%`);
      conditions.push('(ci.ip_address = ?)');
      params.push(term);
    }

    const sql = `
      SELECT
        ci.id,
        ci.ci_number,
        ci.name,
        ci.description,
        ct.name AS ci_type_name,
        cs.name AS status_name,
        cs.is_operational,
        ci.environment,
        ci.criticality,
        ci.hostname,
        ci.ip_address
      FROM configuration_items ci
      LEFT JOIN ci_types ct ON ct.id = ci.ci_type_id
      LEFT JOIN ci_statuses cs ON cs.id = ci.status_id
      WHERE ci.organization_id = ?
        AND (${conditions.join(' OR ')})
      ORDER BY ci.criticality DESC
      LIMIT 1
    `;

    const rows = await executeQuery<CorrelatedCI>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Find CIs related to a given CI via ci_relationships.
   */
  private async findRelatedCIs(orgId: number, ciId: number): Promise<CorrelatedCI[]> {
    const sql = `
      SELECT DISTINCT
        ci.id,
        ci.ci_number,
        ci.name,
        ci.description,
        ct.name AS ci_type_name,
        cs.name AS status_name,
        cs.is_operational,
        ci.environment,
        ci.criticality,
        ci.hostname,
        ci.ip_address
      FROM ci_relationships rel
      JOIN configuration_items ci ON (
        (rel.target_ci_id = ci.id AND rel.source_ci_id = ?)
        OR (rel.source_ci_id = ci.id AND rel.target_ci_id = ?)
      )
      LEFT JOIN ci_types ct ON ct.id = ci.ci_type_id
      LEFT JOIN ci_statuses cs ON cs.id = ci.status_id
      WHERE ci.organization_id = ?
        AND ci.id != ?
      LIMIT 50
    `;

    return executeQuery<CorrelatedCI>(sql, [ciId, ciId, orgId, ciId]);
  }

  /**
   * Find existing open tickets related to the alerted CI or service.
   */
  private async findExistingTickets(
    orgId: number,
    alert: NormalizedAlert,
    ci: CorrelatedCI | null
  ): Promise<RelatedTicket[]> {
    const conditions: string[] = ['t.organization_id = ?'];
    const params: SqlParam[] = [orgId];

    // Only look at open/in-progress tickets
    conditions.push("t.status IN ('open', 'in_progress', 'pending')");

    const orConditions: string[] = [];

    // Match by CI link
    if (ci) {
      orConditions.push(`t.id IN (SELECT ticket_id FROM ci_ticket_links WHERE ci_id = ?)`);
      params.push(ci.id);
    }

    // Match by title similarity (auto-healing prefix)
    if (alert.service && alert.service !== 'unknown') {
      const escaped = alert.service.replace(/%/g, '\\%').replace(/_/g, '\\_');
      orConditions.push("(t.title LIKE ? ESCAPE '\\')");
      params.push(`%${escaped}%`);
    }

    // Match by auto-healing tag
    orConditions.push(
      "t.id IN (SELECT ticket_id FROM ticket_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tg.name = 'auto-healing')"
    );

    if (orConditions.length > 0) {
      conditions.push(`(${orConditions.join(' OR ')})`);
    }

    const sql = `
      SELECT
        t.id,
        t.ticket_number,
        t.title,
        t.status,
        t.priority,
        t.created_at
      FROM tickets t
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.created_at DESC
      LIMIT 10
    `;

    return executeQuery<RelatedTicket>(sql, params);
  }

  /**
   * Calculate blast radius: how many CIs/services could be affected.
   */
  private calculateBlastRadius(ci: CorrelatedCI | null, relatedCIs: CorrelatedCI[]): number {
    if (!ci) return 0;
    // Base = 1 (the affected CI) + related CIs
    return 1 + relatedCIs.length;
  }

  /**
   * Calculate overall risk level from alert severity, CI criticality, and blast radius.
   */
  private calculateRiskLevel(
    alert: NormalizedAlert,
    ci: CorrelatedCI | null,
    blastRadius: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;

    // Alert severity contribution (0-3)
    const severityScores: Record<string, number> = {
      info: 0,
      warning: 1,
      error: 2,
      critical: 3,
    };
    score += severityScores[alert.severity] || 1;

    // CI criticality contribution (0-3)
    if (ci?.criticality) {
      const criticalityScores: Record<string, number> = {
        low: 0,
        medium: 1,
        high: 2,
        critical: 3,
      };
      score += criticalityScores[ci.criticality] || 1;
    }

    // Blast radius contribution
    if (blastRadius >= 10) score += 3;
    else if (blastRadius >= 5) score += 2;
    else if (blastRadius >= 2) score += 1;

    // Map score to risk level
    if (score >= 7) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }
}
