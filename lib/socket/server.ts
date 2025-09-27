import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth/sqlite-auth'

export class SocketServer {
  private io: SocketIOServer
  private db = getDb()

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
  }

  private async authenticateSocket(socket: any, next: any) {
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
      console.error('Socket authentication error:', error)
      next(new Error('Authentication error'))
    }
  }

  private saveUserSession(socket: any) {
    try {
      const sessionData = {
        sessionId: socket.id,
        userId: socket.userId,
        userAgent: socket.handshake.headers['user-agent'] || 'unknown',
        ipAddress: socket.handshake.address || 'unknown',
        isActive: true
      }

      // Inserir ou atualizar sessão
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

      console.log(`🔗 User ${socket.userName} (${socket.userId}) connected with session ${socket.id}`)
    } catch (error) {
      console.error('Error saving user session:', error)
    }
  }

  private removeUserSession(socket: any) {
    try {
      this.db.prepare(`
        UPDATE user_sessions
        SET is_active = 0, last_activity = datetime('now')
        WHERE id = ?
      `).run(socket.id)

      console.log(`🔌 User ${socket.userName} (${socket.userId}) disconnected from session ${socket.id}`)
    } catch (error) {
      console.error('Error removing user session:', error)
    }
  }

  private setupEventHandlers() {
    // Middleware de autenticação
    this.io.use(this.authenticateSocket.bind(this))

    this.io.on('connection', (socket) => {
      console.log(`✅ Socket connected: ${socket.id} (User: ${socket.userName})`)

      // Entrar em sala baseada no role do usuário
      const userRoom = `user_${socket.userId}`
      const roleRoom = `role_${socket.userRole}`

      socket.join(userRoom)
      socket.join(roleRoom)

      // Se for admin, entrar na sala de admins
      if (socket.userRole === 'admin') {
        socket.join('admins')
      }

      // Se for agent ou admin, entrar na sala de agentes
      if (socket.userRole === 'agent' || socket.userRole === 'admin') {
        socket.join('agents')
      }

      // Eventos do socket
      socket.on('join_ticket', (ticketId: number) => {
        socket.join(`ticket_${ticketId}`)
        console.log(`👤 User ${socket.userName} joined ticket room: ${ticketId}`)
      })

      socket.on('leave_ticket', (ticketId: number) => {
        socket.leave(`ticket_${ticketId}`)
        console.log(`👤 User ${socket.userName} left ticket room: ${ticketId}`)
      })

      socket.on('typing_start', (data: { ticketId: number; userName: string }) => {
        socket.to(`ticket_${data.ticketId}`).emit('user_typing', {
          userName: data.userName,
          userId: socket.userId,
          isTyping: true
        })
      })

      socket.on('typing_stop', (data: { ticketId: number }) => {
        socket.to(`ticket_${data.ticketId}`).emit('user_typing', {
          userName: socket.userName,
          userId: socket.userId,
          isTyping: false
        })
      })

      socket.on('request_online_users', () => {
        this.sendOnlineUsers(socket)
      })

      // Atualizar última atividade periodicamente
      const activityInterval = setInterval(() => {
        try {
          this.db.prepare(`
            UPDATE user_sessions
            SET last_activity = datetime('now')
            WHERE id = ?
          `).run(socket.id)
        } catch (error) {
          console.error('Error updating activity:', error)
        }
      }, 30000) // A cada 30 segundos

      socket.on('disconnect', (reason) => {
        console.log(`❌ Socket disconnected: ${socket.id} (Reason: ${reason})`)
        clearInterval(activityInterval)
        this.removeUserSession(socket)

        // Notificar outros usuários que este usuário saiu
        this.broadcastUserStatus(socket.userId, false)
      })

      // Enviar lista de usuários online quando conectar
      this.sendOnlineUsers(socket)

      // Notificar outros usuários que este usuário está online
      this.broadcastUserStatus(socket.userId, true)
    })
  }

  private sendOnlineUsers(socket: any) {
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
      console.error('Error fetching online users:', error)
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

  public notifyTicketAssigned(ticketId: number, assignedToUserId: number, ticketData: any) {
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

  public notifyTicketUpdated(ticketId: number, ticketData: any, excludeUserId?: number) {
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

  public notifyNewComment(ticketId: number, commentData: any, ticketData: any) {
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

  public notifySLAWarning(ticketId: number, slaData: any) {
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

  private saveNotificationEvent(eventType: string, targetUsers: number[], payload: any) {
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
      console.error('Error saving notification event:', error)
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
      console.error('Error getting connection stats:', error)
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