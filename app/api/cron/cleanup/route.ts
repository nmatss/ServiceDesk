import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeRun } from '@/lib/db/adapter';
import { createAuditLog } from '@/lib/audit/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401);
  }

  try {
    const startTime = Date.now();
    const results: Record<string, number> = {};

    // 1. Clean up expired refresh tokens (older than 7 days past expiration)
    const refreshTokens = await executeRun(`
      DELETE FROM refresh_tokens
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
    `, []).catch(() => ({ changes: 0 }));
    results.expired_refresh_tokens = refreshTokens.changes || 0;

    // 2. Clean up expired verification codes (older than 24 hours)
    const verificationCodes = await executeRun(`
      DELETE FROM verification_codes
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
    `, []).catch(() => ({ changes: 0 }));
    results.expired_verification_codes = verificationCodes.changes || 0;

    // 3. Clean up expired approval tokens (older than 7 days)
    const approvalTokens = await executeRun(`
      DELETE FROM approval_tokens
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
    `, []).catch(() => ({ changes: 0 }));
    results.expired_approval_tokens = approvalTokens.changes || 0;

    // 4. Clean up expired ticket access tokens (older than 7 days)
    const ticketAccessTokens = await executeRun(`
      DELETE FROM ticket_access_tokens
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
    `, []).catch(() => ({ changes: 0 }));
    results.expired_ticket_access_tokens = ticketAccessTokens.changes || 0;

    // 5. Clean up old rate limit entries (older than 1 hour)
    const rateLimits = await executeRun(`
      DELETE FROM rate_limits
      WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '1 hour'
    `, []).catch(() => ({ changes: 0 }));
    results.expired_rate_limits = rateLimits.changes || 0;

    // 6. Clean up expired user sessions (older than 30 days)
    const sessions = await executeRun(`
      DELETE FROM user_sessions
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    `, []).catch(() => ({ changes: 0 }));
    results.expired_sessions = sessions.changes || 0;

    // 7. Clean up old login attempts (older than 90 days)
    const loginAttempts = await executeRun(`
      DELETE FROM login_attempts
      WHERE attempted_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    `, []).catch(() => ({ changes: 0 }));
    results.old_login_attempts = loginAttempts.changes || 0;

    // 8. Clean up old audit logs (older than 1 year)
    const auditLogs = await executeRun(`
      DELETE FROM audit_logs
      WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '365 days'
    `, []).catch(() => ({ changes: 0 }));
    results.old_audit_logs = auditLogs.changes || 0;

    // 9. Clean up old API usage tracking (older than 90 days)
    const apiUsage = await executeRun(`
      DELETE FROM api_usage_tracking
      WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    `, []).catch(() => ({ changes: 0 }));
    results.old_api_usage = apiUsage.changes || 0;

    // 10. Clean up old notification records (older than 90 days, already read)
    const notifications = await executeRun(`
      DELETE FROM notifications
      WHERE is_read = 1
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    `, []).catch(() => ({ changes: 0 }));
    results.old_notifications = notifications.changes || 0;

    // 11. Clean up expired cache entries
    const cache = await executeRun(`
      DELETE FROM cache
      WHERE expires_at IS NOT NULL
        AND expires_at < CURRENT_TIMESTAMP
    `, []).catch(() => ({ changes: 0 }));
    results.expired_cache = cache.changes || 0;

    // Calculate totals
    const totalCleaned = Object.values(results).reduce((sum, val) => sum + val, 0);
    const duration = Date.now() - startTime;

    // Audit log the cleanup
    await createAuditLog({
      action: 'system_cleanup_cron',
      resource_type: 'cron',
      new_values: JSON.stringify({ ...results, total: totalCleaned, duration_ms: duration })
    });

    return apiSuccess({
      total_cleaned: totalCleaned,
      details: results,
      duration_ms: duration
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao executar limpeza do sistema';
    return apiError(message, 500);
  }
}
