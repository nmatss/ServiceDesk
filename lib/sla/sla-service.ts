import { executeQuery, executeQueryOne, executeRun, sqlNow, sqlTrue } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import logger from '@/lib/monitoring/structured-logger';

/**
 * SLA Service — Application-layer SLA tracking
 * Replaces database triggers for cross-DB compatibility and testability.
 *
 * Mirrors the logic of these 3 PostgreSQL/SQLite triggers:
 *   1. create_sla_tracking_on_ticket_insert (AFTER INSERT on tickets)
 *   2. update_sla_on_first_response (AFTER INSERT on comments)
 *   3. update_sla_on_resolution (AFTER UPDATE on tickets)
 */

// Privileged roles that count as "agent response" for SLA first-response tracking
const AGENT_ROLES = ['super_admin', 'admin', 'tenant_admin', 'team_manager', 'agent'];

/**
 * Create SLA tracking for a newly created ticket.
 * Replicates trigger: create_sla_tracking_on_ticket_insert
 *
 * Finds the best-matching active SLA policy (preferring category-specific over general)
 * and inserts a sla_tracking row with computed due dates.
 */
export async function createSLATrackingForTicket(
  ticketId: number,
  priorityId: number,
  categoryId: number | null
): Promise<void> {
  try {
    // Find matching SLA policy — same logic as the trigger:
    // prefer category-specific match, fallback to category-null policy
    const policy = await executeQueryOne<{
      id: number;
      response_time_minutes: number;
      resolution_time_minutes: number;
      escalation_time_minutes: number | null;
    }>(
      `SELECT id, response_time_minutes, resolution_time_minutes, escalation_time_minutes
       FROM sla_policies
       WHERE is_active = ${sqlTrue()}
         AND priority_id = ?
         AND (category_id IS NULL OR category_id = ?)
       ORDER BY
         CASE WHEN category_id = ? THEN 1 ELSE 2 END,
         id ASC
       LIMIT 1`,
      [priorityId, categoryId, categoryId]
    );

    if (!policy) {
      logger.debug('No SLA policy found for ticket', { ticketId, priorityId, categoryId });
      return;
    }

    // Calculate due dates using dialect-aware SQL expressions
    const dbType = getDatabaseType();
    let responseDueExpr: string;
    let resolutionDueExpr: string;
    let escalationDueExpr: string;

    if (dbType === 'postgresql') {
      responseDueExpr = `NOW() + (${policy.response_time_minutes} || ' minutes')::interval`;
      resolutionDueExpr = `NOW() + (${policy.resolution_time_minutes} || ' minutes')::interval`;
      escalationDueExpr = policy.escalation_time_minutes != null
        ? `NOW() + (${policy.escalation_time_minutes} || ' minutes')::interval`
        : 'NULL';
    } else {
      responseDueExpr = `datetime('now', '+${policy.response_time_minutes} minutes')`;
      resolutionDueExpr = `datetime('now', '+${policy.resolution_time_minutes} minutes')`;
      escalationDueExpr = policy.escalation_time_minutes != null
        ? `datetime('now', '+${policy.escalation_time_minutes} minutes')`
        : 'NULL';
    }

    await executeRun(
      `INSERT INTO sla_tracking (ticket_id, sla_policy_id, response_due_at, resolution_due_at, escalation_due_at, created_at)
       VALUES (?, ?, ${responseDueExpr}, ${resolutionDueExpr}, ${escalationDueExpr}, ${sqlNow()})`,
      [ticketId, policy.id]
    );

    logger.info('SLA tracking created', { ticketId, policyId: policy.id });
  } catch (error) {
    // Fire-and-forget: never fail the parent request
    logger.error('Error creating SLA tracking for ticket', { ticketId, error });
  }
}

/**
 * Mark SLA first response when an agent/admin posts a comment.
 * Replicates trigger: update_sla_on_first_response
 *
 * Only marks if:
 *   - The commenter has an agent/admin role
 *   - The sla_tracking row exists and response_met is still false
 *   - This is the first agent/admin comment on the ticket
 */
export async function checkAndMarkFirstResponse(
  ticketId: number,
  commenterId: number
): Promise<void> {
  try {
    // Check if commenter is a privileged user (agent/admin)
    const user = await executeQueryOne<{ role: string }>(
      'SELECT role FROM users WHERE id = ?',
      [commenterId]
    );

    if (!user || !AGENT_ROLES.includes(user.role)) {
      return; // End-user comment — no SLA impact
    }

    // Check if SLA tracking exists and hasn't been responded to yet
    const sla = await executeQueryOne<{ id: number; response_met: boolean | number }>(
      `SELECT id, response_met FROM sla_tracking WHERE ticket_id = ? LIMIT 1`,
      [ticketId]
    );

    if (!sla) return; // No SLA tracking for this ticket

    // Normalize boolean (SQLite returns 0/1, PG returns true/false)
    const alreadyResponded = sla.response_met === true || sla.response_met === 1;
    if (alreadyResponded) return;

    // Count prior agent/admin comments on this ticket (excluding the one just inserted)
    const roleList = AGENT_ROLES.map(() => '?').join(',');
    const priorCount = await executeQueryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.ticket_id = ?
         AND u.role IN (${roleList})`,
      [ticketId, ...AGENT_ROLES]
    );

    // If this is the first (or only) agent comment, mark response
    // The count includes the newly inserted comment, so we check <= 1
    if (priorCount && priorCount.cnt <= 1) {
      // Calculate response_time_minutes from ticket creation
      const dbType = getDatabaseType();
      let responseTimeExpr: string;
      if (dbType === 'postgresql') {
        responseTimeExpr = `EXTRACT(EPOCH FROM (NOW() - (SELECT created_at FROM tickets WHERE id = ?)))::INTEGER / 60`;
      } else {
        responseTimeExpr = `CAST((julianday('now') - julianday((SELECT created_at FROM tickets WHERE id = ?))) * 24 * 60 AS INTEGER)`;
      }

      await executeRun(
        `UPDATE sla_tracking
         SET response_met = ${sqlTrue()},
             first_response_at = ${sqlNow()},
             response_time_minutes = (${responseTimeExpr}),
             updated_at = ${sqlNow()}
         WHERE ticket_id = ? AND response_met = ${dbType === 'postgresql' ? 'FALSE' : '0'}`,
        [ticketId, ticketId]
      );

      logger.info('SLA first response marked', { ticketId, commenterId });
    }
  } catch (error) {
    // Fire-and-forget: never fail the parent request
    logger.error('Error marking SLA first response', { ticketId, commenterId, error });
  }
}

/**
 * Mark SLA resolution when ticket status changes to a final status.
 * Replicates trigger: update_sla_on_resolution
 *
 * Also sets tickets.resolved_at, matching the trigger behavior.
 */
export async function checkAndMarkResolution(
  ticketId: number,
  newStatusId: number
): Promise<void> {
  try {
    // Check if the new status is final
    const status = await executeQueryOne<{ is_final: boolean | number }>(
      'SELECT is_final FROM statuses WHERE id = ?',
      [newStatusId]
    );

    if (!status) return;

    // Normalize boolean (SQLite returns 0/1, PG returns true/false)
    const isFinal = status.is_final === true || status.is_final === 1;
    if (!isFinal) return;

    const dbType = getDatabaseType();

    // Calculate resolution_time_minutes from ticket creation
    let resolutionTimeExpr: string;
    if (dbType === 'postgresql') {
      resolutionTimeExpr = `EXTRACT(EPOCH FROM (NOW() - (SELECT created_at FROM tickets WHERE id = ?)))::INTEGER / 60`;
    } else {
      resolutionTimeExpr = `CAST((julianday('now') - julianday((SELECT created_at FROM tickets WHERE id = ?))) * 24 * 60 AS INTEGER)`;
    }

    // Update SLA tracking
    await executeRun(
      `UPDATE sla_tracking
       SET resolution_met = ${sqlTrue()},
           resolution_time_minutes = (${resolutionTimeExpr}),
           updated_at = ${sqlNow()}
       WHERE ticket_id = ? AND resolution_met = ${dbType === 'postgresql' ? 'FALSE' : '0'}`,
      [ticketId, ticketId]
    );

    // Also set resolved_at on the ticket itself (matching trigger behavior)
    await executeRun(
      `UPDATE tickets SET resolved_at = ${sqlNow()} WHERE id = ?`,
      [ticketId]
    );

    logger.info('SLA resolution marked', { ticketId, newStatusId });
  } catch (error) {
    // Fire-and-forget: never fail the parent request
    logger.error('Error marking SLA resolution', { ticketId, newStatusId, error });
  }
}

/**
 * MIGRATION NOTE: After deploying this service, remove the database triggers:
 *
 * -- PostgreSQL
 * DROP TRIGGER IF EXISTS trigger_create_sla_tracking ON tickets;
 * DROP TRIGGER IF EXISTS trigger_update_sla_on_first_response ON comments;
 * DROP TRIGGER IF EXISTS trigger_update_sla_on_resolution ON tickets;
 * DROP FUNCTION IF EXISTS create_sla_tracking_on_ticket_insert();
 * DROP FUNCTION IF EXISTS update_sla_on_first_response();
 * DROP FUNCTION IF EXISTS update_sla_on_resolution();
 *
 * -- SQLite
 * DROP TRIGGER IF EXISTS create_sla_tracking_on_ticket_insert;
 * DROP TRIGGER IF EXISTS update_sla_on_first_response;
 * DROP TRIGGER IF EXISTS update_sla_on_resolution;
 */
