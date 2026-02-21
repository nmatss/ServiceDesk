import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { getDb } from '@/lib/db'
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

export class SocketServer {
  private io: SocketIOServer
  private db = getDb()
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
    // Limpar sessões inativas a cada 5 minutos
    setInterval(() => {
      this.cleanupInactiveSessions()
    }, 5 * 60 * 1000)
  }

  private cleanupInactiveSessions(): void {
    const MAX_INACTIVE = 30 * 60 * 1000 // 30 minutos
    const now = Date.now()

    for (const [socketId, session] of this.activeSessions) {
      const lastActivity = session.lastActivity.getTime()
      if (now - lastActivity > MAX_INACTIVE) {
        // Remover sessão inativa
        this.activeSessions.delete(socketId)

        // Limpar de userSockets também
        const userSockets = this.userSockets.get(session.userId)
        if (userSockets) {
          userSockets.delete(socketId)
          if (userSockets.size === 0) {
            this.userSockets.delete(session.userId)
          }
        }

        // Atualizar banco de dados
        try {
          this.db.prepare(`
            UPDATE user_sessions
            SET is_active = 0
            WHERE id = ?
          `).run(socketId)
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

      // Adicionar informações do usuário ao socket
      socket.userId = user.id
      socket.userRole = user.role
      socket.userName = user.name

      // Salvar sessão no banco
      this.saveUserSession(socket)

      next()
    } catch (error) {
      logger.error('Socket authentication error', error)
      next(new Error('Authentication error'))
    }
  }

  private saveUserSession(socket: ExtendedSocket) {
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

      // Armazenar sessão em memória
      this.activeSessions.set(socket.id, sessionInfo)

      // Mapear usuário para socket
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

      // Inserir ou atualizar sessão no banco
      this.db.prepare(`
        INSERT OR REPLACE INTO user_sessions (id, user_id, socket_id, user_agent, ip_address, is_active, last_activity)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        sessionData.sessionId,
        sessionData.userId,
        sessionData.sessionId,
        sessionData.userAgent,
        sessionData.ipAddress,
        sessionData.isActive ? 1 : 0
      )

      logger.info(`🔗 User ${socket.userName} (${socket.userId}) connected with session ${socket.id}`)
    } catch (error) {
      logger.error('Error saving user session', error)
    }
  }

  private removeUserSession(socket: ExtendedSocket) {
    try {
      // Remover da memória
      this.activeSessions.delete(socket.id)

      // Remover do mapeamento de usuário
      const userSockets = this.userSockets.get(socket.userId)
      if (userSockets) {
        userSockets.delete(socket.id)
        if (userSockets.size === 0) {
          this.userSockets.delete(socket.userId)
        }
      }

      // Atualizar banco
      this.db.prepare(`
        UPDATE user_sessions
        SET is_active = 0, last_activity = datetime('now')
        WHERE id = ?
      `).run(socket.id)

      logger.info(`🔌 User ${socket.userName} (${socket.userId}) disconnected from session ${socket.id}`)
    } catch (error) {
      logger.error('Error removing user session', error)
    }
  }

  private setupEventHandlers() {
    // Middleware de autenticação
    this.io.use((socket, next) => {
      this.authenticateSocket(socket as ExtendedSocket, next);
    })

    this.io.on('connection', (socket) => {
      const extSocket = socket as ExtendedSocket;
      logger.info(`✅ Socket connected: ${extSocket.id} (User: ${extSocket.userName})`)

      // Entrar em sala baseada no role do usuário
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
        logger.info(`👤 User ${extSocket.userName} joined ticket room: ${ticketId}`)
      })

      extSocket.on('leave_ticket', (ticketId: number) => {
        extSocket.leave(`ticket_${ticketId}`)
        logger.info(`👤 User ${extSocket.userName} left ticket room: ${ticketId}`)
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

      // Atualizar última atividade periodicamente
      const activityInterval = setInterval(() => {
        try {
          // Atualizar sessão em memória
          const session = this.activeSessions.get(extSocket.id)
          if (session) {
            session.lastActivity = new Date()
            this.activeSessions.set(extSocket.id, session)
          }

          // Atualizar banco
          this.db.prepare(`
            UPDATE user_sessions
            SET last_activity = datetime('now')
            WHERE id = ?
          `).run(extSocket.id)
        } catch (error) {
          logger.error('Error updating activity', error)
        }
      }, 30000) // A cada 30 segundos

      extSocket.on('disconnect', (reason) => {
        logger.info(`❌ Socket disconnected: ${extSocket.id} (Reason: ${reason})`)
        clearInterval(activityInterval)
        this.removeUserSession(extSocket)

        // Notificar outros usuários que este usuário saiu
        this.broadcastUserStatus(extSocket.userId, false)
      })

      // Enviar lista de usuários online quando conectar
      this.sendOnlineUsers(extSocket)

      // Notificar outros usuários que este usuário está online
      this.broadcastUserStatus(extSocket.userId, true)
    })
  }

  private sendOnlineUsers(socket: ExtendedSocket) {
    try {
      const onlineUsers = this.db.prepare(`
        SELECT DISTINCT u.id, u.name, u.role, s.last_activity
        FROM users u
        INNER JOIN user_sessions s ON u.id = s.user_id
        WHERE s.is_active = 1
        AND s.last_activity > datetime('now', '-5 minutes')
        ORDER BY u.name
      `).all()

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

  // Métodos públicos para enviar notificações

  public notifyTicketAssigned(ticketId: number, assignedToUserId: number, ticketData: Record<string, unknown>) {
    const notification = {
      type: 'ticket_assigned',
      title: 'Novo ticket atribuído',
      message: `Ticket #${ticketId} foi atribuído a você`,
      data: ticketData,
      timestamp: new Date().toISOString()
    }

    // Enviar para o usuário específico
    this.io.to(`user_${assignedToUserId}`).emit('notification', notification)

    // Salvar no banco para persistência
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

    // Enviar para todos na sala do ticket, exceto quem fez a atualização
    if (excludeUserId) {
      this.io.to(`ticket_${ticketId}`).except(`user_${excludeUserId}`).emit('notification', notification)
    } else {
      this.io.to(`ticket_${ticketId}`).emit('notification', notification)
    }
  }

  public notifyNewComment(ticketId: number, commentData: Record<string, unknown>, ticketData: Record<string, unknown>) {
    const notification = {
      type: 'comment_added',
      title: 'Novo comentário',
      message: `Novo comentário no ticket #${ticketId}`,
      data: { ...commentData, ticket: ticketData },
      timestamp: new Date().toISOString()
    }

    // Enviar para todos na sala do ticket, exceto quem comentou
    this.io.to(`ticket_${ticketId}`).except(`user_${commentData.authorId}`).emit('notification', notification)
  }

  public notifySLAWarning(ticketId: number, slaData: Record<string, unknown>) {
    const notification = {
      type: 'sla_warning',
      title: 'Aviso de SLA',
      message: `Ticket #${ticketId} está próximo do vencimento do SLA`,
      data: slaData,
      timestamp: new Date().toISOString(),
      priority: 'high'
    }

    // Enviar para agentes e admins
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

    // Enviar para todos os admins
    this.io.to('admins').emit('notification', notification)
  }

  private saveNotificationEvent(eventType: string, targetUsers: number[], payload: Record<string, unknown>) {
    try {
      this.db.prepare(`
        INSERT INTO notification_events (event_type, target_users, payload)
        VALUES (?, ?, ?)
      `).run(
        eventType,
        JSON.stringify(targetUsers),
        JSON.stringify(payload)
      )
    } catch (error) {
      logger.error('Error saving notification event', error)
    }
  }

  // Método para obter estatísticas de conexões
  public getConnectionStats() {
    try {
      const totalConnections = this.io.sockets.sockets.size

      const activeUsers = this.db.prepare(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM user_sessions
        WHERE is_active = 1
        AND last_activity > datetime('now', '-5 minutes')
      `).get() as { count: number }

      const usersByRole = this.db.prepare(`
        SELECT u.role, COUNT(DISTINCT u.id) as count
        FROM users u
        INNER JOIN user_sessions s ON u.id = s.user_id
        WHERE s.is_active = 1
        AND s.last_activity > datetime('now', '-5 minutes')
        GROUP BY u.role
      `).all()

      return {
        totalConnections,
        activeUsers: activeUsers.count,
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
