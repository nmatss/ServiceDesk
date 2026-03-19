import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { emailService } from '@/lib/email/service';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return apiError('Unauthorized', 401);
  }

  try {
    const startTime = Date.now();

    // Get count of pending emails before processing
    const before = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM email_queue
      WHERE status = 'pending'
        AND attempts < max_attempts
        AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
    `, []);
    const pendingCount = before?.count || 0;

    // Process up to 50 emails per run
    await emailService.processEmailQueue(50);

    // Get results after processing
    const after = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM email_queue
      WHERE status = 'pending'
        AND attempts < max_attempts
        AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP)
    `, []);
    const remainingCount = after?.count || 0;
    const processedCount = pendingCount - remainingCount;

    // Get failed emails count
    const failed = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM email_queue
      WHERE status = 'failed'
        AND attempts >= max_attempts
    `, []);

    // Clean up old sent emails (older than 30 days)
    const cleanup = await executeRun(`
      DELETE FROM email_queue
      WHERE status = 'sent'
        AND sent_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    `, []).catch(() => ({ changes: 0 }));

    const duration = Date.now() - startTime;

    return apiSuccess({
      processed: processedCount,
      remaining: remainingCount,
      failed: failed?.count || 0,
      cleaned: cleanup.changes || 0,
      duration_ms: duration
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao processar fila de emails';
    return apiError(message, 500);
  }
}
