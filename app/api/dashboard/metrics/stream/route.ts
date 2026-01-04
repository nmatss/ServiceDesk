import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import {
  ticketDataSources,
  slaDataSources,
  agentDataSources,
  customerDataSources
} from '@/lib/analytics/data-sources';

/**
 * GET /api/dashboard/metrics/stream
 * Server-Sent Events endpoint for real-time dashboard metrics
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAuth(req);

    if (!authResult.authenticated || !authResult.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Create SSE response
    const encoder = new TextEncoder();
    let intervalId: NodeJS.Timeout;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const message = `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`;
        controller.enqueue(encoder.encode(message));

        // Set up interval to send metrics every 5 seconds
        intervalId = setInterval(async () => {
          try {
            // Gather all metrics
            const metrics = await gatherDashboardMetrics();

            // Send metrics to client
            const data = `data: ${JSON.stringify({
              type: 'metrics',
              timestamp: new Date().toISOString(),
              data: metrics
            })}\n\n`;

            controller.enqueue(encoder.encode(data));
          } catch (error) {
            logger.error('Error gathering metrics for SSE', error);
          }
        }, 5000);

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          controller.close();
        });
      },

      cancel() {
        if (intervalId) {
          clearInterval(intervalId);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    logger.error('Error setting up SSE stream', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function gatherDashboardMetrics() {
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  try {
    const [
      volumeData,
      categoryData,
      priorityData,
      statusData,
      slaCompliance,
      slaPriority,
      agentPerformance,
      agentWorkload,
      customerSatisfaction
    ] = await Promise.all([
      ticketDataSources.getTicketVolume({ startDate, endDate }),
      ticketDataSources.getTicketsByCategory({ startDate, endDate }),
      ticketDataSources.getTicketsByPriority({ startDate, endDate }),
      ticketDataSources.getTicketsByStatus(),
      slaDataSources.getSLACompliance({ startDate, endDate }),
      slaDataSources.getSLAByPriority({ startDate, endDate }),
      agentDataSources.getAgentPerformance({ startDate, endDate, limit: 10 }),
      agentDataSources.getAgentWorkload(),
      customerDataSources.getCustomerSatisfaction({ startDate, endDate })
    ]);

    // Calculate KPI summary
    const totalTickets = (volumeData as any[]).reduce((sum: number, day: any) => sum + (day.created || 0), 0);
    const totalResolved = (volumeData as any[]).reduce((sum: number, day: any) => sum + (day.resolved || 0), 0);
    const openTickets = (statusData as any[]).find((s: any) => s.status === 'open')?.count || 0;
    const todayVolume = (volumeData as any[])[volumeData.length - 1] as any || { created: 0, resolved: 0 };

    const totalSla = (slaCompliance as any[]).reduce((sum: number, day: any) => sum + (day.total_tickets || 0), 0);
    const metSla = (slaCompliance as any[]).reduce((sum: number, day: any) => sum + (day.response_met || 0), 0);

    const avgResponseTime = (slaCompliance as any[]).reduce((sum: number, day: any) =>
      sum + (day.avg_response_time || 0), 0) / (slaCompliance.length || 1);

    const avgResolutionTime = (slaCompliance as any[]).reduce((sum: number, day: any) =>
      sum + (day.avg_resolution_time || 0), 0) / (slaCompliance.length || 1);

    const avgCsat = (customerSatisfaction as any[]).reduce((sum: number, day: any) => sum + (day.score || 0), 0) / (customerSatisfaction.length || 1);
    const totalCsatResponses = (customerSatisfaction as any[]).reduce((sum: number, day: any) => sum + (day.responses || 0), 0);

    return {
      kpiSummary: {
        tickets_today: (todayVolume as any).created,
        tickets_this_week: (volumeData as any[]).slice(-7).reduce((sum: number, day: any) => sum + day.created, 0),
        tickets_this_month: totalTickets,
        total_tickets: totalTickets,
        sla_response_met: metSla,
        sla_resolution_met: metSla,
        total_sla_tracked: totalSla,
        avg_response_time: avgResponseTime,
        avg_resolution_time: avgResolutionTime,
        fcr_rate: totalTickets > 0 ? (totalResolved / totalTickets) * 100 : 0,
        csat_score: avgCsat,
        csat_responses: totalCsatResponses,
        active_agents: (agentWorkload as any[]).length,
        open_tickets: openTickets,
        resolved_today: (todayVolume as any).resolved
      },
      volumeData,
      categoryData,
      priorityData,
      statusData,
      slaData: slaCompliance,
      slaPriorityData: slaPriority,
      agentData: agentPerformance,
      agentWorkloadData: agentWorkload,
      customerSatisfactionData: customerSatisfaction,
      alerts: [] // Would be populated from actual alert system
    };
  } catch (error) {
    logger.error('Error gathering dashboard metrics', error);
    throw error;
  }
}
