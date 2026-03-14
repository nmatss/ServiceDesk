import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { executeQuery, executeQueryOne, executeRun, sqlFalse } from '@/lib/db/adapter'
import { getDatabaseType } from '@/lib/db/config'
import { verifyToken } from '@/lib/auth/auth-service'
import logger from '../monitoring/structured-logger';

// Extended Socket type with custom properties
export interface ExtendedSocket extends Socket {
  userId: number
  userRole: string
  userName: string
}

export interface SessionInfo {
  socketId: string
  userId: number
  userName: string
  userRole: string
  connectedAt: Date
  lastActivity: Date
}

const MAX_SESSIONS = 10000;

export class SocketServer {
  private io: SocketIOServer
  private activeSessions = new Map<string, SessionInfo>()
  private userSockets = new Map<number, Set<string>>()

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.FRONTEND_URL
          : ["http://localhost:3000", "http://127.0.0.1:3000"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    })

    this.setupEventHandlers()
    this.setupCleanupTasks()
  }

  private setupCleanupTasks() {
    // Limpar sessoes inativas a cada 5 minutos
    setInterval(() => {
      this.cleanupInactiveSessions()
    }, 5 * 60 * 1000)
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const MAX_INACTIVE = 30 * 60 * 1000 // 30 minutos
    const now = Date.now()

    for (const [socketId, session] of this.activeSessions) {
      const lastActivity = session.lastActivity.getTime()
      if (now - lastActivity > MAX_INACTIVE) {
        // Remover sessao inativa
        this.activeSessions.delete(socketId)

        // Limpar de userSockets tambem
        const userSockets = this.userSockets.get(session.userId)
        if (userSockets) {
          userSockets.delete(socketId)
          if (userSockets.size === 0) {
            this.userSockets.delete(session.userId)
          }
        }

        // Atualizar banco de dados
        try {
          await executeRun(`
            UPDATE user_sessions
            SET is_active = ${sqlFalse()}
            WHERE id = ?
          `, [socketId])
        } catch (error) {
          logger.error('Error updating inactive session in database', error)
        }

        logger.info(`Cleaned up inactive session: ${socketId} (User: ${session.userName})`)
      }
    }
  }

  private async authenticateSocket(socket: ExtendedSocket, next: (err?: Error) => void) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')

      if (!token) {
        return next(new Error('Authentication error: No token provided'))
      }

      const user = await verifyToken(token)
      if (!user) {
        return next(new Error('Authentication error: Invalid token'))
      }

      // Adicionar informacoes do usuario ao socket
      socket.userId = user.id
      socket.userRole = user.role
      socket.userName = user.name

      // Salvar sessao no banco
      await this.saveUserSession(socket)

      next()
    } catch (error) {
      logger.error('Socket authentication error', error)
      next(new Error('Authentication error'))
    }
  }

  private async saveUserSession(socket: ExtendedSocket) {
    try {
      const now = new Date()
      const sessionInfo: SessionInfo = {
        socketId: socket.id,
        userId: socket.userId,
        userName: socket.userName,
        userRole: socket.userRole,
        connectedAt: now,
        lastActivity: now
      }

      // Evict oldest session if at capacity
      if (this.activeSessions.size >= MAX_SESSIONS) {
        let oldestKey: string | null = null
        let oldestTime = Infinity
        for (const [key, s] of this.activeSessions) {
          const t = s.lastActivity.getTime()
          if (t < oldestTime) { oldestTime = t; oldestKey = key }
        }
        if (oldestKey) this.activeSessions.delete(oldestKey)
      }

      // Armazenar sessao em memoria
      this.activeSessions.set(socket.id, sessionInfo)

      // Mapear usuario para socket
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set())
      }
      this.userSockets.get(socket.userId)!.add(socket.id)

      const sessionData = {
        sessionId: socket.id,
        userId: socket.userId,
        userAgent: socket.handshake.headers['user-agent'] || 'unknown',
        ipAddress: socket.handshake.address || 'unknown',
        isActive: true
      }

      // Inserir ou atualizar sessao no banco
      // Use ON CONFLICT for cross-DB compat
      await executeRun(`
        INSERT INTO user_sessions (id, user_id, socket_id, user_agent, ip_address, is_active, last_activity)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          user_id = excluded.user_id,
          socket_id = excluded.socket_id,
          user_agent = excluded.user_agent,
          ip_address = excluded.ip_address,
          is_active = excluded.is_active,
          last_activity = CURRENT_TIMESTAMP
      `, [
        sessionData.sessionId,
        sessionData.userId,
        sessionData.sessionId,
        sessionData.userAgent,
        sessionData.ipAddress,
        sessionData.isActive ? 1 : 0
      ])

      logger.info(`User ${socket.userName} (${socket.userId}) connected with session ${socket.id}`)
    } catch (error) {
      logger.error('Error saving user session', error)
    }
  }

  private async removeUserSession(socket: ExtendedSocket) {
    try {
      // Remover da memoria
      this.activeSessions.delete(socket.id)

      // Remover do mapeamento de usuario
      const userSockets = this.userSockets.get(socket.userId)
      if (userSockets) {
        userSockets.delete(socket.id)
        if (userSockets.size === 0) {
          this.userSockets.delete(socket.userId)
        }
      }

      // Atualizar banco
      await executeRun(`
        UPDATE user_sessions
        SET is_active = ${sqlFalse()}, last_activity = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [socket.id])

      logger.info(`User ${socket.userName} (${socket.userId}) disconnected from session ${socket.id}`)
    } catch (error) {
      logger.error('Error removing user session', error)
    }
  }

  private setupEventHandlers() {
    // Middleware de autenticacao
    this.io.use((socket, next) => {
      this.authenticateSocket(socket as ExtendedSocket, next);
    })

    this.io.on('connection', (socket) => {
      const extSocket = socket as ExtendedSocket;
      logger.info(`Socket connected: ${extSocket.id} (User: ${extSocket.userName})`)

      // Entrar em sala baseada no role do usuario
      const userRoom = `user_${extSocket.userId}`
      const roleRoom = `role_${extSocket.userRole}`

      extSocket.join(userRoom)
      extSocket.join(roleRoom)

      // Se for admin, entrar na sala de admins
      if (extSocket.userRole === 'admin') {
        extSocket.join('admins')
      }

      // Se for agent ou admin, entrar na sala de agentes
      if (extSocket.userRole === 'agent' || extSocket.userRole === 'admin') {
        extSocket.join('agents')
      }

      // Eventos do socket
      extSocket.on('join_ticket', (ticketId: number) => {
        extSocket.join(`ticket_${ticketId}`)
        logger.info(`User ${extSocket.userName} joined ticket room: ${ticketId}`)
      })

      extSocket.on('leave_ticket', (ticketId: number) => {
        extSocket.leave(`ticket_${ticketId}`)
        logger.info(`User ${extSocket.userName} left ticket room: ${ticketId}`)
      })

      extSocket.on('typing_start', (data: { ticketId: number; userName: string }) => {
        extSocket.to(`ticket_${data.ticketId}`).emit('user_typing', {
          userName: data.userName,
          userId: extSocket.userId,
          isTyping: true
        })
      })

      extSocket.on('typing_stop', (data: { ticketId: number }) => {
        extSocket.to(`ticket_${data.ticketId}`).emit('user_typing', {
          userName: extSocket.userName,
          userId: extSocket.userId,
          isTyping: false
        })
      })

      extSocket.on('request_online_users', () => {
        this.sendOnlineUsers(extSocket)
      })

      // Atualizar ultima atividade periodicamente
      const activityInterval = setInterval(async () => {
        try {
          // Atualizar sessao em memoria
          const session = this.activeSessions.get(extSocket.id)
          if (session) {
            session.lastActivity = new Date()
            this.activeSessions.set(extSocket.id, session)
          }

          // Atualizar banco
          await executeRun(`
            UPDATE user_sessions
            SET last_activity = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [extSocket.id])
        } catch (error) {
          logger.error('Error updating activity', error)
        }
      }, 30000) // A cada 30 segundos

      extSocket.on('disconnect', (reason) => {
        logger.info(`Socket disconnected: ${extSocket.id} (Reason: ${reason})`)
        clearInterval(activityInterval)
        this.removeUserSession(extSocket)

        // Notificar outros usuarios que este usuario saiu
        this.broadcastUserStatus(extSocket.userId, false)
      })

      // Enviar lista de usuarios online quando conectar
      this.sendOnlineUsers(extSocket)

      // Notificar outros usuarios que este usuario esta online
      this.broadcastUserStatus(extSocket.userId, true)
    })
  }

  private sendOnlineUsers(socket: ExtendedSocket) {
    try {
      // Use in-memory session data instead of DB query for every request
      const fiveMinAgo = Date.now() - 5 * 60 * 1000
      const seenUsers = new Map<number, { id: number; name: string; role: string; last_activity: string }>()

      for (const session of this.activeSessions.values()) {
        if (session.lastActivity.getTime() > fiveMinAgo && !seenUsers.has(session.userId)) {
          seenUsers.set(session.userId, {
            id: session.userId,
            name: session.userName,
            role: session.userRole,
            last_activity: session.lastActivity.toISOString(),
          })
        }
      }

      const onlineUsers = Array.from(seenUsers.values()).sort((a, b) => a.name.localeCompare(b.name))
      socket.emit('online_users_updated', onlineUsers)
    } catch (error) {
      logger.error('Error fetching online users', error)
    }
  }

  private broadcastUserStatus(userId: number, isOnline: boolean) {
    this.io.emit('user_status_changed', {
      userId,
      isOnline,
      timestamp: new Date().toISOString()
    })
  }

  // Metodos publicos para enviar notificacoes

  public notifyTicketAssigned(ticketId: number, assignedToUserId: number, ticketData: Record<string, unknown>) {
    const notification = {
      type: 'ticket_assigned',
      title: 'Novo ticket atribuido',
      message: `Ticket #${ticketId} foi atribuido a voce`,
      data: ticketData,
      timestamp: new Date().toISOString()
    }

    // Enviar para o usuario especifico
    this.io.to(`user_${assignedToUserId}`).emit('notification', notification)

    // Salvar no banco para persistencia
    this.saveNotificationEvent('ticket_assigned', [assignedToUserId], notification)
  }

  public notifyTicketUpdated(ticketId: number, ticketData: Record<string, unknown>, excludeUserId?: number) {
    const notification = {
      type: 'ticket_updated',
      title: 'Ticket atualizado',
      message: `Ticket #${ticketId} foi atualizado`,
      data: ticketData,
      timestamp: new Date().toISOString()
    }

    if (excludeUserId) {
      this.io.to(`ticket_${ticketId}`).except(`user_${excludeUserId}`).emit('notification', notification)
    } else {
      this.io.to(`ticket_${ticketId}`).emit('notification', notification)
    }
  }

  public notifyNewComment(ticketId: number, commentData: Record<string, unknown>, ticketData: Record<string, unknown>) {
    const notification = {
      type: 'comment_added',
      title: 'Novo comentario',
      message: `Novo comentario no ticket #${ticketId}`,
      data: { ...commentData, ticket: ticketData },
      timestamp: new Date().toISOString()
    }

    this.io.to(`ticket_${ticketId}`).except(`user_${commentData.authorId}`).emit('notification', notification)
  }

  public notifySLAWarning(ticketId: number, slaData: Record<string, unknown>) {
    const notification = {
      type: 'sla_warning',
      title: 'Aviso de SLA',
      message: `Ticket #${ticketId} esta proximo do vencimento do SLA`,
      data: slaData,
      timestamp: new Date().toISOString(),
      priority: 'high'
    }

    this.io.to('agents').emit('notification', notification)
  }

  public notifySystemAlert(message: string, priority: 'low' | 'medium' | 'high' = 'medium') {
    const notification = {
      type: 'system_alert',
      title: 'Alerta do Sistema',
      message,
      priority,
      timestamp: new Date().toISOString()
    }

    this.io.to('admins').emit('notification', notification)
  }

  private async saveNotificationEvent(eventType: string, targetUsers: number[], payload: any) {
    try {
      await executeRun(`
        INSERT INTO notification_events (event_type, target_users, payload)
        VALUES (?, ?, ?)
      `, [
        eventType,
        JSON.stringify(targetUsers),
        JSON.stringify(payload)
      ])
    } catch (error) {
      logger.error('Error saving notification event', error)
    }
  }

  // Metodo para obter estatisticas de conexoes
  public async getConnectionStats() {
    try {
      const totalConnections = this.io.sockets.sockets.size

      // Use in-memory data for active user count instead of DB query
      const fiveMinAgo = Date.now() - 5 * 60 * 1000
      const activeUserIds = new Set<number>()
      const roleCount = new Map<string, number>()

      for (const session of this.activeSessions.values()) {
        if (session.lastActivity.getTime() > fiveMinAgo) {
          activeUserIds.add(session.userId)
          roleCount.set(session.userRole, (roleCount.get(session.userRole) || 0) + 1)
        }
      }

      const usersByRole = Array.from(roleCount.entries()).map(([role, count]) => ({ role, count }))

      return {
        totalConnections,
        activeUsers: activeUserIds.size,
        usersByRole
      }
    } catch (error) {
      logger.error('Error getting connection stats', error)
      return {
        totalConnections: 0,
        activeUsers: 0,
        usersByRole: []
      }
    }
  }

  public getIO() {
    return this.io
  }
}

// Singleton instance
let socketServer: SocketServer | null = null

export function initializeSocketServer(httpServer: HTTPServer): SocketServer {
  if (!socketServer) {
    socketServer = new SocketServer(httpServer)
  }
  return socketServer
}

export function getSocketServer(): SocketServer | null {
  return socketServer
}
