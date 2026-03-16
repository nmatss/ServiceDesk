/**
 * Autonomous AI Agent (Agentic AI L1)
 *
 * Main orchestrator that processes L1 support tickets autonomously.
 * Flow: load ticket → resolve intent → search KB → evaluate confidence
 *       → execute action (auto-resolve / suggest / escalate)
 */

import { logger } from '@/lib/monitoring/logger';
import { executeQuery, executeQueryOne, sqlNow, type SqlParam } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import { intentResolver, type Intent } from './intent-resolver';
import { confidenceGate, type KBMatch, type TicketHistory, type ConfidenceResult } from './confidence-gate';
import { actionExecutor, type ActionResult, type ActionType } from './action-executor';
import { agentGuardrails } from './agent-guardrails';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentResult {
  resolved: boolean;
  action_taken: ActionType | 'blocked';
  confidence: number;
  response?: string;
  escalated_to?: number;
  reasoning?: string;
  error?: string;
}

interface TicketRow {
  id: number;
  title: string;
  description: string;
  status: string;
  priority_id: number | null;
  category_id: number | null;
  assigned_to: number | null;
  organization_id: number;
  created_by: number;
}

// ---------------------------------------------------------------------------
// KB search
// ---------------------------------------------------------------------------

async function searchKnowledgeBase(
  orgId: number,
  title: string,
  description: string,
): Promise<KBMatch | null> {
  const searchTerms = `${title} ${description}`.substring(0, 200);
  const words = searchTerms
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5);

  if (words.length === 0) return null;

  // Build LIKE conditions for each significant word
  const conditions: string[] = [];
  const params: SqlParam[] = [orgId];

  for (const word of words) {
    const escaped = word.replace(/%/g, '\\%').replace(/_/g, '\\_');
    conditions.push(`(LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(content) LIKE ? ESCAPE '\\')`);
    params.push(`%${escaped}%`, `%${escaped}%`);
  }

  const sql = `
    SELECT id, title, content
    FROM kb_articles
    WHERE organization_id = ?
      AND status = 'published'
      AND (${conditions.join(' OR ')})
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  const article = await executeQueryOne<{ id: number; title: string; content: string }>(sql, params);

  if (!article) return null;

  // Compute a simple relevance score based on word matches
  const articleText = `${article.title} ${article.content}`.toLowerCase();
  let matchCount = 0;
  for (const word of words) {
    if (articleText.includes(word)) matchCount++;
  }
  const relevance = Math.round((matchCount / words.length) * 100);

  return {
    articleId: article.id,
    title: article.title,
    content: article.content,
    relevance,
  };
}

// ---------------------------------------------------------------------------
// Historical stats
// ---------------------------------------------------------------------------

async function getTicketHistory(orgId: number, intentType: string): Promise<TicketHistory> {
  const dbType = getDatabaseType();
  const thirtyDaysAgo = dbType === 'postgresql'
    ? "NOW() - INTERVAL '30 days'"
    : "datetime('now', '-30 days')";

  const stats = await executeQueryOne<{
    total_resolved: number;
    total_processed: number;
  }>(
    `SELECT
       COUNT(CASE WHEN activity_type = 'ai_auto_resolved' THEN 1 END) as total_resolved,
       COUNT(*) as total_processed
     FROM ticket_activities
     WHERE organization_id = ?
       AND activity_type IN ('ai_auto_resolved', 'ai_escalated', 'ai_suggestion_posted')
       AND description LIKE ?
       AND created_at >= ${thirtyDaysAgo}`,
    [orgId, `%${intentType}%`] as SqlParam[]
  );

  const totalResolved = stats?.total_resolved ?? 0;
  const totalProcessed = stats?.total_processed ?? 0;
  const successRate = totalProcessed > 0
    ? Math.round((totalResolved / totalProcessed) * 100)
    : 0;

  return {
    totalAutoResolved: totalResolved,
    totalProcessed,
    successRate,
  };
}

// ---------------------------------------------------------------------------
// AutonomousAgent
// ---------------------------------------------------------------------------

export class AutonomousAgent {
  /**
   * Main entry point: process a ticket through the full AI agent pipeline.
   */
  async processTicket(orgId: number, ticketId: number): Promise<AgentResult> {
    logger.info(`AI Agent processing ticket #${ticketId} for org #${orgId}`, {
      type: 'ai_agent',
      ticketId,
      orgId,
    });

    try {
      // 1. Load ticket from DB
      const ticket = await executeQueryOne<TicketRow>(
        `SELECT t.id, t.title, t.description, s.name as status,
                t.priority_id, t.category_id, t.assigned_to,
                t.organization_id, t.created_by
         FROM tickets t
         LEFT JOIN statuses s ON t.status_id = s.id
         WHERE t.id = ? AND t.organization_id = ?`,
        [ticketId, orgId] as SqlParam[]
      );

      if (!ticket) {
        return {
          resolved: false,
          action_taken: 'blocked',
          confidence: 0,
          error: 'Ticket não encontrado',
        };
      }

      // 2. Resolve intent
      const intent: Intent = await intentResolver.resolveIntent(
        ticket.title || '',
        ticket.description || '',
      );

      // 3. Run guardrails
      const guardrailResult = await agentGuardrails.canAutoResolve(orgId, ticketId, intent);
      if (!guardrailResult.allowed) {
        logger.info(`Guardrails blocked ticket #${ticketId}: ${guardrailResult.reason}`, {
          type: 'ai_agent',
          ticketId,
          reason: guardrailResult.reason,
        });
        return {
          resolved: false,
          action_taken: 'blocked',
          confidence: intent.confidence,
          reasoning: guardrailResult.reason,
        };
      }

      // 4. Search knowledge base
      const kbMatch = await searchKnowledgeBase(orgId, ticket.title, ticket.description);

      // 5. Get historical data
      const history = await getTicketHistory(orgId, intent.type);

      // 6. Evaluate confidence
      const thresholds = await confidenceGate.getThresholds(orgId);
      const confidenceResult: ConfidenceResult = confidenceGate.evaluate(
        intent,
        kbMatch,
        history,
        ticket.title,
        ticket.description,
        thresholds,
      );

      // 7. Execute action
      const actionResult: ActionResult = await actionExecutor.execute(
        orgId,
        ticketId,
        intent,
        confidenceResult.action,
        kbMatch,
      );

      return {
        resolved: actionResult.actionType === 'auto_resolved',
        action_taken: actionResult.actionType,
        confidence: confidenceResult.score,
        response: actionResult.response,
        escalated_to: actionResult.escalatedTo,
        reasoning: confidenceResult.reasoning,
        error: actionResult.error,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`AI Agent error processing ticket #${ticketId}: ${message}`, {
        type: 'ai_agent',
        ticketId,
        orgId,
        error: message,
      });
      return {
        resolved: false,
        action_taken: 'escalated',
        confidence: 0,
        error: message,
      };
    }
  }
}

export const autonomousAgent = new AutonomousAgent();
