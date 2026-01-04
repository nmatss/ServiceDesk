import { NextRequest } from 'next/server'
import { getTenantContextFromRequest, getUserContextFromRequest } from '@/lib/tenant/context'
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const tenantContext = getTenantContextFromRequest(request)
    if (!tenantContext) {
      return new Response('Tenant não encontrado', { status: 400 })
    }

    const userContext = getUserContextFromRequest(request)
    if (!userContext) {
      return new Response('Usuário não autenticado', { status: 401 })
    }

    const encoder = new TextEncoder()

    const customReadable = new ReadableStream({
      start(controller) {
        // Heartbeat para manter a conexão viva
        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        }, 30000)

        // Função para enviar notificação
        const sendNotification = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        // Enviar notificação de conexão
        sendNotification({
          id: Date.now(),
          type: 'connection',
          message: 'Conectado ao sistema de notificações',
          timestamp: new Date().toISOString(),
          user_id: userContext.id,
          tenant_id: tenantContext.id
        })

        // Simular notificações periódicas
        const notificationInterval = setInterval(() => {
          const notifications = [
            {
              type: 'ticket_created',
              message: 'Novo ticket criado',
              title: 'Ticket #123'
            },
            {
              type: 'ticket_updated',
              message: 'Status do ticket atualizado',
              title: 'Ticket #124'
            },
            {
              type: 'comment_added',
              message: 'Novo comentário adicionado',
              title: 'Ticket #125'
            }
          ]

          const randomNotification = notifications[Math.floor(Math.random() * notifications.length)]

          sendNotification({
            id: Date.now(),
            ...randomNotification,
            timestamp: new Date().toISOString(),
            user_id: userContext.id,
            tenant_id: tenantContext.id,
            is_read: false
          })
        }, 120000) // A cada 2 minutos

        // Cleanup quando a conexão é fechada
        const cleanup = () => {
          clearInterval(keepAlive)
          clearInterval(notificationInterval)
          try {
            controller.close()
          } catch (e) {
            // Conexão já foi fechada
          }
        }

        // Escutar sinal de abort
        request.signal.addEventListener('abort', cleanup)

        // Cleanup automático após 5 minutos
        setTimeout(cleanup, 300000)
      }
    })

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization, X-Tenant-ID',
      },
    })
  } catch (error) {
    logger.error('Error in notifications SSE', error)
    return new Response('Erro interno do servidor', { status: 500 })
  }
}