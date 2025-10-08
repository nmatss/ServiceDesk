/**
 * Exemplo de Implementação - Datadog Tracing
 *
 * Este arquivo demonstra como usar os tracers customizados do Datadog
 * em diferentes cenários do ServiceDesk.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  traceLogin,
  traceRegister,
  traceCreateTicket,
  traceUpdateTicket,
  traceResolveTicket,
  traceCreateSLATracking,
  traceCheckSLACompliance,
  traceQuery,
  traceTransaction,
  traceAPICall,
  traceBackgroundJob,
  traceCacheOperation,
} from '@/lib/monitoring/traces';

// ====================================
// EXEMPLO 1: API de Autenticação
// ====================================

/**
 * POST /api/auth/login
 * Login com trace completo
 */
export async function loginHandler(request: NextRequest) {
  return await traceAPICall('POST', '/api/auth/login', async () => {
    const { email, password } = await request.json();

    // Trace de login com métricas automáticas
    const user = await traceLogin(email, async () => {
      // Buscar usuário no banco
      const dbUser = await getUserByEmail(email);
      if (!dbUser) {
        throw new Error('User not found');
      }

      // Verificar senha
      const isValid = await verifyPassword(password, dbUser.password_hash);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      return dbUser;
    });

    // Gerar token JWT com trace
    const token = await traceGenerateToken(user.id, async () => {
      return await generateToken(user);
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  }, {
    'http.route': '/api/auth/login',
    'user.organization_id': user?.organization_id,
  });
}

/**
 * POST /api/auth/register
 * Registro com trace e validação
 */
export async function registerHandler(request: NextRequest) {
  return await traceAPICall('POST', '/api/auth/register', async () => {
    const { name, email, password, role } = await request.json();

    // Trace de registro
    const user = await traceRegister(email, role || 'user', async () => {
      // Verificar se email já existe
      const existing = await getUserByEmail(email);
      if (existing) {
        throw new Error('Email already registered');
      }

      // Criar usuário
      return await createUser({ name, email, password, role });
    });

    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
      },
    });
  });
}

// ====================================
// EXEMPLO 2: API de Tickets
// ====================================

/**
 * POST /api/tickets
 * Criação de ticket com SLA tracking
 */
export async function createTicketHandler(request: NextRequest) {
  return await traceAPICall('POST', '/api/tickets', async () => {
    const ticketData = await request.json();
    const { user, organizationId } = await getAuthContext(request);

    // Trace de criação de ticket
    const ticket = await traceCreateTicket(
      user.id,
      organizationId,
      ticketData,
      async () => {
        // Validar dados
        validateTicketData(ticketData);

        // Criar ticket no banco
        return await ticketQueries.create(ticketData, organizationId);
      }
    );

    // Buscar política de SLA aplicável
    const slaPolicy = await getSLAPolicyForTicket(ticket);

    // Criar tracking de SLA se houver política
    if (slaPolicy) {
      await traceCreateSLATracking(
        ticket.id,
        slaPolicy,
        organizationId,
        async () => {
          return await createSLATracking({
            ticket_id: ticket.id,
            sla_policy_id: slaPolicy.id,
            response_due_at: calculateResponseDue(slaPolicy),
            resolution_due_at: calculateResolutionDue(slaPolicy),
          });
        }
      );
    }

    // Enviar notificação (trace separado)
    await sendTicketCreatedNotification(ticket);

    return NextResponse.json({ ticket });
  }, {
    'ticket.category_id': ticketData.category_id,
    'ticket.priority_id': ticketData.priority_id,
  });
}

/**
 * PATCH /api/tickets/:id
 * Atualização de ticket com histórico
 */
export async function updateTicketHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ticketId = parseInt(params.id);

  return await traceAPICall('PATCH', `/api/tickets/${ticketId}`, async () => {
    const updates = await request.json();
    const { user, organizationId } = await getAuthContext(request);

    // Trace de atualização
    const ticket = await traceUpdateTicket(
      ticketId,
      user.id,
      organizationId,
      updates,
      async () => {
        // Buscar ticket atual
        const current = await ticketQueries.getById(ticketId, organizationId);
        if (!current) {
          throw new Error('Ticket not found');
        }

        // Verificar permissões
        checkUpdatePermissions(user, current);

        // Atualizar ticket
        return await ticketQueries.update({ id: ticketId, ...updates }, organizationId);
      }
    );

    // Se status mudou para resolvido, atualizar SLA
    if (updates.status_id && isResolvedStatus(updates.status_id)) {
      await updateSLAResolution(ticket);
    }

    return NextResponse.json({ ticket });
  });
}

/**
 * POST /api/tickets/:id/resolve
 * Resolução de ticket com métricas de SLA
 */
export async function resolveTicketHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ticketId = parseInt(params.id);

  return await traceAPICall('POST', `/api/tickets/${ticketId}/resolve`, async () => {
    const { resolution } = await request.json();
    const { user, organizationId } = await getAuthContext(request);

    // Trace de resolução
    const ticket = await traceResolveTicket(
      ticketId,
      user.id,
      organizationId,
      resolution,
      async () => {
        // Atualizar status e adicionar resolução
        return await resolveTicket(ticketId, {
          resolved_by: user.id,
          resolution,
          resolved_at: new Date().toISOString(),
        });
      }
    );

    // Atualizar métricas de SLA
    await traceCheckSLACompliance(
      ticketId,
      ticket.sla_tracking_id,
      organizationId,
      async () => {
        return await checkAndUpdateSLA(ticket);
      }
    );

    // Enviar pesquisa de satisfação
    await sendSatisfactionSurvey(ticket);

    return NextResponse.json({ ticket });
  });
}

// ====================================
// EXEMPLO 3: Operações de Database
// ====================================

/**
 * Query complexa com trace
 */
async function getTicketAnalytics(organizationId: number) {
  return await traceTransaction('ticket-analytics', async () => {
    // Query 1: Tickets por categoria
    const byCategory = await traceQuery(
      'tickets-by-category',
      `SELECT
        c.id, c.name, COUNT(t.id) as count
       FROM categories c
       LEFT JOIN tickets t ON c.id = t.category_id
       WHERE t.organization_id = ?
       GROUP BY c.id, c.name`,
      [organizationId],
      () => db.prepare(sql).all(organizationId)
    );

    // Query 2: Tickets por prioridade
    const byPriority = await traceQuery(
      'tickets-by-priority',
      `SELECT
        p.id, p.name, COUNT(t.id) as count
       FROM priorities p
       LEFT JOIN tickets t ON p.id = t.priority_id
       WHERE t.organization_id = ?
       GROUP BY p.id, p.name`,
      [organizationId],
      () => db.prepare(sql).all(organizationId)
    );

    // Query 3: Métricas de SLA
    const slaMetrics = await traceQuery(
      'sla-metrics',
      `SELECT
        AVG(CASE WHEN response_met = 1 THEN 1 ELSE 0 END) as response_rate,
        AVG(CASE WHEN resolution_met = 1 THEN 1 ELSE 0 END) as resolution_rate,
        AVG(response_time_minutes) as avg_response_time,
        AVG(resolution_time_minutes) as avg_resolution_time
       FROM sla_tracking st
       JOIN tickets t ON st.ticket_id = t.id
       WHERE t.organization_id = ?`,
      [organizationId],
      () => db.prepare(sql).get(organizationId)
    );

    return {
      byCategory,
      byPriority,
      slaMetrics,
    };
  });
}

// ====================================
// EXEMPLO 4: Background Jobs
// ====================================

/**
 * Job de verificação de SLA
 */
async function slaComplianceJob() {
  await traceBackgroundJob(
    'sla-compliance-check',
    { schedule: 'every-5-minutes' },
    async () => {
      const organizations = await getAllOrganizations();

      for (const org of organizations) {
        // Buscar tickets ativos
        const activeTickets = await getActiveTickets(org.id);

        for (const ticket of activeTickets) {
          // Verificar compliance de SLA
          await traceCheckSLACompliance(
            ticket.id,
            ticket.sla_tracking_id,
            org.id,
            async () => {
              const compliance = await checkSLACompliance(ticket);

              // Se próximo ao breach, escalar
              if (compliance.minutesUntilBreach < 30) {
                await escalateTicket(ticket, 'SLA breach imminent');
              }

              return compliance;
            }
          );
        }
      }
    }
  );
}

/**
 * Job de limpeza de cache
 */
async function cacheCleanupJob() {
  await traceBackgroundJob(
    'cache-cleanup',
    { schedule: 'daily' },
    async () => {
      // Limpar cache de usuários inativos
      await traceCacheOperation('clear', 'inactive-users', async () => {
        return await clearInactiveUsersCache();
      });

      // Limpar cache de tickets antigos
      await traceCacheOperation('clear', 'old-tickets', async () => {
        return await clearOldTicketsCache();
      });
    }
  );
}

// ====================================
// EXEMPLO 5: Cache Operations
// ====================================

/**
 * Buscar ticket com cache
 */
async function getTicketWithCache(ticketId: number, organizationId: number) {
  const cacheKey = `ticket:${organizationId}:${ticketId}`;

  // Tentar buscar do cache
  const cached = await traceCacheOperation('get', cacheKey, async () => {
    return await cache.get(cacheKey);
  });

  if (cached) {
    return cached;
  }

  // Buscar do banco se não houver cache
  const ticket = await traceQuery(
    'get-ticket-by-id',
    'SELECT * FROM tickets WHERE id = ? AND organization_id = ?',
    [ticketId, organizationId],
    () => db.prepare(sql).get(ticketId, organizationId)
  );

  // Salvar no cache
  await traceCacheOperation('set', cacheKey, async () => {
    return await cache.set(cacheKey, ticket, 300); // 5 minutos
  });

  return ticket;
}

// ====================================
// EXEMPLO 6: External API Calls
// ====================================

/**
 * Enviar mensagem WhatsApp
 */
async function sendWhatsAppMessage(to: string, message: string) {
  return await traceExternalAPI(
    'whatsapp',
    'POST',
    '/messages',
    async () => {
      const response = await fetch('https://api.whatsapp.com/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          to,
          message,
          template: 'ticket_notification',
        }),
      });

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.statusText}`);
      }

      return await response.json();
    }
  );
}

/**
 * Integração com Slack
 */
async function sendSlackNotification(channel: string, message: string) {
  return await traceExternalAPI(
    'slack',
    'POST',
    '/chat.postMessage',
    async () => {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLACK_TOKEN}`,
        },
        body: JSON.stringify({
          channel,
          text: message,
        }),
      });

      return await response.json();
    }
  );
}

// ====================================
// EXEMPLO 7: Decorators (Classes)
// ====================================

import { Trace, TraceSync } from '@/lib/monitoring/datadog-tracer';

/**
 * Classe de serviço com decorators
 */
class TicketService {
  @Trace('TicketService.createTicket')
  async createTicket(data: any, organizationId: number) {
    // Lógica de criação
    const ticket = await ticketQueries.create(data, organizationId);

    // Enviar notificações
    await this.sendNotifications(ticket);

    return ticket;
  }

  @Trace('TicketService.updateTicket')
  async updateTicket(id: number, updates: any, organizationId: number) {
    const ticket = await ticketQueries.update({ id, ...updates }, organizationId);
    return ticket;
  }

  @TraceSync('TicketService.validateTicket')
  validateTicket(data: any): boolean {
    // Validação síncrona
    return data.title && data.description && data.category_id;
  }

  @Trace('TicketService.sendNotifications')
  private async sendNotifications(ticket: any) {
    // Notificar criador
    await sendEmailNotification(ticket.user_id, 'ticket_created', ticket);

    // Notificar agente atribuído
    if (ticket.assigned_to) {
      await sendEmailNotification(ticket.assigned_to, 'ticket_assigned', ticket);
    }
  }
}

// ====================================
// HELPERS E UTILIDADES
// ====================================

/**
 * Helper functions usadas nos exemplos acima
 */

function validateTicketData(data: any) {
  if (!data.title || !data.description) {
    throw new Error('Title and description are required');
  }
}

function calculateResponseDue(policy: any): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + policy.response_time_minutes);
  return now.toISOString();
}

function calculateResolutionDue(policy: any): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + policy.resolution_time_minutes);
  return now.toISOString();
}

function isResolvedStatus(statusId: number): boolean {
  // IDs dos status de resolução (configurável)
  return [3, 4].includes(statusId); // resolved, closed
}

async function getAuthContext(request: NextRequest) {
  // Buscar contexto de autenticação do request
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const user = await verifyToken(token);
  return { user, organizationId: user.organization_id };
}

// ====================================
// EXPORT
// ====================================

export {
  loginHandler,
  registerHandler,
  createTicketHandler,
  updateTicketHandler,
  resolveTicketHandler,
  getTicketAnalytics,
  slaComplianceJob,
  cacheCleanupJob,
  getTicketWithCache,
  sendWhatsAppMessage,
  sendSlackNotification,
  TicketService,
};
