/**
 * Confidence Gate for Autonomous AI Agent
 *
 * Evaluates whether the AI agent should auto-resolve, suggest, or escalate
 * a ticket based on multiple scoring factors.
 */

import { logger } from '@/lib/monitoring/logger';
import { executeQueryOne, type SqlParam } from '@/lib/db/adapter';
import type { Intent, IntentType } from './intent-resolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KBMatch {
  articleId: number;
  title: string;
  content: string;
  /** 0–100 relevance score */
  relevance: number;
}

export interface TicketHistory {
  /** Total times this intent type was auto-resolved */
  totalAutoResolved: number;
  /** Total times this intent type was processed by agent */
  totalProcessed: number;
  /** Success rate 0–100 (user didn't reopen) */
  successRate: number;
}

export type AgentAction = 'auto_resolve' | 'suggest' | 'escalate';

export interface ConfidenceResult {
  score: number; // 0–100
  action: AgentAction;
  reasoning: string;
}

export interface ConfidenceThresholds {
  autoResolveMin: number; // default 85
  suggestMin: number;     // default 60
}

// ---------------------------------------------------------------------------
// Complexity heuristics
// ---------------------------------------------------------------------------

const COMPLEX_KEYWORDS = [
  'servidor', 'server', 'banco de dados', 'database', 'produção', 'production',
  'todos os usuários', 'all users', 'empresa toda', 'migração', 'migration',
  'firewall', 'rede', 'network', 'cluster', 'infraestrutura', 'infrastructure',
  'backup', 'disaster', 'outage', 'fora do ar', 'indisponível',
];

function isComplexTicket(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return COMPLEX_KEYWORDS.some(kw => text.includes(kw));
}

// ---------------------------------------------------------------------------
// ConfidenceGate
// ---------------------------------------------------------------------------

export class ConfidenceGate {
  private defaultThresholds: ConfidenceThresholds = {
    autoResolveMin: 85,
    suggestMin: 60,
  };

  /**
   * Load org-specific thresholds from system_settings, falling back to defaults.
   */
  async getThresholds(orgId: number): Promise<ConfidenceThresholds> {
    try {
      const row = await executeQueryOne<{ value: string }>(
        `SELECT value FROM system_settings WHERE key = ? AND organization_id = ?`,
        ['ai_agent_thresholds', orgId] as SqlParam[]
      );
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        return {
          autoResolveMin: parsed.autoResolveMin ?? this.defaultThresholds.autoResolveMin,
          suggestMin: parsed.suggestMin ?? this.defaultThresholds.suggestMin,
        };
      }
    } catch {
      // Use defaults
    }
    return { ...this.defaultThresholds };
  }

  /**
   * Evaluate confidence and decide on action.
   *
   * Scoring breakdown (max 100):
   *   - Intent detection confidence: 0–40 points
   *   - KB article match quality:    0–30 points
   *   - Historical success rate:     0–20 points
   *   - Ticket complexity:           +10 (simple) or -10 (complex)
   */
  evaluate(
    intent: Intent,
    kbMatch: KBMatch | null,
    ticketHistory: TicketHistory,
    ticketTitle: string,
    ticketDescription: string,
    thresholds?: ConfidenceThresholds,
  ): ConfidenceResult {
    const th = thresholds ?? this.defaultThresholds;
    const reasons: string[] = [];

    // 1. Intent detection confidence (0–40 points)
    const intentScore = Math.round((intent.confidence / 100) * 40);
    reasons.push(`Intenção "${intent.type}" (${intentScore}/40 pts)`);

    // 2. KB article match quality (0–30 points)
    let kbScore = 0;
    if (kbMatch) {
      kbScore = Math.round((kbMatch.relevance / 100) * 30);
      reasons.push(`Artigo KB #${kbMatch.articleId} — relevância ${kbMatch.relevance}% (${kbScore}/30 pts)`);
    } else {
      reasons.push('Nenhum artigo KB encontrado (0/30 pts)');
    }

    // 3. Historical success rate (0–20 points)
    let historyScore = 0;
    if (ticketHistory.totalProcessed > 0) {
      historyScore = Math.round((ticketHistory.successRate / 100) * 20);
      reasons.push(`Histórico: ${ticketHistory.successRate}% sucesso em ${ticketHistory.totalProcessed} tickets (${historyScore}/20 pts)`);
    } else {
      // No history → give a neutral 10 points
      historyScore = 10;
      reasons.push('Sem histórico anterior (10/20 pts — neutro)');
    }

    // 4. Complexity modifier (+/-10 points)
    const complex = isComplexTicket(ticketTitle, ticketDescription);
    const complexityModifier = complex ? -10 : 10;
    reasons.push(complex ? 'Ticket complexo (-10 pts)' : 'Ticket simples (+10 pts)');

    // Final score clamped to 0–100
    const rawScore = intentScore + kbScore + historyScore + complexityModifier;
    const score = Math.max(0, Math.min(100, rawScore));

    // Decide action based on thresholds
    let action: AgentAction;
    if (score >= th.autoResolveMin) {
      action = 'auto_resolve';
    } else if (score >= th.suggestMin) {
      action = 'suggest';
    } else {
      action = 'escalate';
    }

    const reasoning = reasons.join(' | ') + ` → Score final: ${score} → Ação: ${action}`;

    logger.info(`ConfidenceGate: score=${score}, action=${action}`, {
      type: 'ai_agent',
      score,
      action,
    });

    return { score, action, reasoning };
  }
}

export const confidenceGate = new ConfidenceGate();
