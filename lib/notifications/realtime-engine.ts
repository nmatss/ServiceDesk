import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth/sqlite-auth'
import { NotificationChannelManager } from './channels'
import { NotificationBatchingEngine } from './batching'
import { DeliveryTracker } from './delivery-tracking'
import { SmartFilteringEngine } from './smart-filtering'
import { EscalationManager } from './escalation-manager'
import { PresenceManager } from './presence-manager'
import { logger } from '../monitoring/logger';

export interface NotificationPayload {
  id?: string
  type: string
  title: string
  message: string
  data?: any
  priority: 'low' | 'medium' | 'high' | 'critical'
  targetUsers?: number[]
  targetRoles?: string[]
  ticketId?: number
  authorId?: number
  channels?: string[]
  metadata?: any
  expiresAt?: Date
  deliveryTracking?: boolean
  batchable?: boolean
  escalationRules?: any[]
}

export interface UserSession {
  socketId: string
  userId: number
  userName: string
  userRole: string
  lastActivity: Date
  isOnline: boolean
  presence: 'online' | 'away' | 'busy' | 'offline'
  deviceInfo?: any
  ipAddress?: string
  userAgent?: string
}

export class RealtimeNotificationEngine {
  private io: SocketIOServer
  private db = getDb()
  private activeSessions = new Map<string, UserSession>()
  private userSockets = new Map<number, Set<string>>() // userId -> socketIds

  // Engine components
  private channelManager: NotificationChannelManager
  private batchingEngine: NotificationBatchingEngine
  private deliveryTracker: DeliveryTracker
  private smartFiltering: SmartFilteringEngine
  private escalationManager: EscalationManager
  private presenceManager: PresenceManager

  // Notification queues
  private pendingNotifications = new Map<string, NotificationPayload[]>()
  private processingQueue: NotificationPayload[] = []
  private readonly MAX_QUEUE_SIZE = 10000
  private readonly BATCH_PROCESS_INTERVAL = 1000 // 1 second

  constructor(httpServer: HTTPServer) {
    this.initializeSocketServer(httpServer)
    this.initializeEngineComponents()
    this.setupNotificationProcessing()
    this.setupCleanupTasks()
  }

  private initializeSocketServer(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.FRONTEND_URL
          : ["http://localhost:3000", "http://127.0.0.1:3000"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6,
      allowEIO3: true
    })

    this.setupAuthenticationMiddleware()
    this.setupConnectionHandlers()
  }

  private initializeEngineComponents() {
    this.channelManager = new NotificationChannelManager()
    this.batchingEngine = new NotificationBatchingEngine()
    this.deliveryTracker = new DeliveryTracker()
    this.smartFiltering = new SmartFilteringEngine()
    this.escalationManager = new EscalationManager(this)
    this.presenceManager = new PresenceManager(this)
  }

  private setupAuthenticationMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token ||
                     socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                     socket.handshake.query.token

        if (!token) {
          return next(new Error('Authentication required'))
        }

        const user = await verifyToken(token as string)
        if (!user) {
          return next(new Error('Invalid authentication token'))
        }

        // Add user info to socket
        socket.userId = user.id
        socket.userRole = user.role
        socket.userName = user.name
        socket.userEmail = user.email

        next()
      } catch (error) {
        logger.error('Socket authentication error', error)
        next(new Error('Authentication failed'))
      }
    })
  }

  private setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      this.handleUserConnection(socket)
      this.setupSocketEventHandlers(socket)
    })
  }

  private handleUserConnection(socket: any) {
    const session: UserSession = {
      socketId: socket.id,
      userId: socket.userId,
      userName: socket.userName,
      userRole: socket.userRole,
      lastActivity: new Date(),
      isOnline: true,
      presence: 'online',
      deviceInfo: this.extractDeviceInfo(socket),
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    }

    // Store session
    this.activeSessions.set(socket.id, session)

    // Map user to socket
    if (!this.userSockets.has(socket.userId)) {
      this.userSockets.set(socket.userId, new Set())
    }
    this.userSockets.get(socket.userId)!.add(socket.id)

    // Join rooms
    this.joinUserRooms(socket)

    // Save session to database
    this.saveUserSession(session)

    // Update presence
    this.presenceManager.setUserPresence(socket.userId, 'online')

    // Send pending notifications
    this.deliverPendingNotifications(socket.userId)

    // Notify other users about user coming online
    this.broadcastPresenceUpdate(socket.userId, 'online')

    logger.info(`🔗 User ${session.userName} (${session.userId}) connected [${socket.id}]`)
  }

  private setupSocketEventHandlers(socket: any) {
    // Presence events
    socket.on('presence:update', (presence: string) => {
      this.handlePresenceUpdate(socket, presence)
    })

    // Ticket room management
    socket.on('ticket:join', (ticketId: number) => {
      socket.join(`ticket_${ticketId}`)
      this.presenceManager.joinTicket(socket.userId, ticketId)
    })

    socket.on('ticket:leave', (ticketId: number) => {
      socket.leave(`ticket_${ticketId}`)
      this.presenceManager.leaveTicket(socket.userId, ticketId)
    })

    // Typing indicators
    socket.on('typing:start', (data: { ticketId: number }) => {
      socket.to(`ticket_${data.ticketId}`).emit('typing:user', {
        userId: socket.userId,
        userName: socket.userName,
        isTyping: true,
        timestamp: new Date().toISOString()
      })
    })

    socket.on('typing:stop', (data: { ticketId: number }) => {
      socket.to(`ticket_${data.ticketId}`).emit('typing:user', {
        userId: socket.userId,
        userName: socket.userName,
        isTyping: false,
        timestamp: new Date().toISOString()
      })
    })

    // Notification management
    socket.on('notification:read', (notificationId: string) => {
      this.markNotificationAsRead(notificationId, socket.userId)
    })

    socket.on('notification:delivered', (notificationId: string) => {
      this.deliveryTracker.markAsDelivered(notificationId, socket.userId, 'socket')
    })

    // Activity tracking
    socket.on('activity:heartbeat', () => {
      this.updateUserActivity(socket.id)
    })

    // Bulk operations
    socket.on('notifications:mark_all_read', () => {
      this.markAllNotificationsAsRead(socket.userId)
    })

    socket.on('notifications:get_unread_count', (callback) => {
      const count = this.getUnreadNotificationCount(socket.userId)
      callback(count)
    })

    // Disconnect handling
    socket.on('disconnect', (reason) => {
      this.handleUserDisconnection(socket, reason)
    })

    // Error handling
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${socket.userId}:`, error)
    })
  }

  private joinUserRooms(socket: any) {
    // User-specific room
    socket.join(`user_${socket.userId}`)

    // Role-based rooms
    socket.join(`role_${socket.userRole}`)

    // Special rooms based on role
    if (socket.userRole === 'admin') {
      socket.join('admins')
    }

    if (socket.userRole === 'agent' || socket.userRole === 'admin') {
      socket.join('agents')
    }

    if (socket.userRole === 'manager' || socket.userRole === 'admin') {
      socket.join('managers')
    }
  }

  private handlePresenceUpdate(socket: any, presence: string) {
    const session = this.activeSessions.get(socket.id)
    if (session) {
      session.presence = presence as any
      session.lastActivity = new Date()
      this.activeSessions.set(socket.id, session)

      this.presenceManager.setUserPresence(socket.userId, presence as any)
      this.broadcastPresenceUpdate(socket.userId, presence)
    }
  }

  private handleUserDisconnection(socket: any, reason: string) {
    const session = this.activeSessions.get(socket.id)
    if (!session) return

    // Remove from active sessions
    this.activeSessions.delete(socket.id)

    // Remove socket from user mapping
    const userSockets = this.userSockets.get(socket.userId)
    if (userSockets) {
      userSockets.delete(socket.id)
      if (userSockets.size === 0) {
        this.userSockets.delete(socket.userId)
        // User is completely offline
        this.presenceManager.setUserPresence(socket.userId, 'offline')
        this.broadcastPresenceUpdate(socket.userId, 'offline')
      }
    }

    // Update database
    this.updateUserSessionDisconnect(socket.id)

    logger.info(`🔌 User ${session.userName} (${session.userId}) disconnected [${socket.id}] - ${reason}`)
  }

  // Public notification methods
  public async sendNotification(notification: NotificationPayload): Promise<string> {
    const notificationId = this.generateNotificationId()
    notification.id = notificationId

    try {
      // Apply smart filtering
      const filteredNotification = await this.smartFiltering.filterNotification(notification)
      if (!filteredNotification) {
        logger.info(`Notification ${notificationId} filtered out`)
        return notificationId
      }

      // Determine target users
      const targetUsers = await this.resolveTargetUsers(notification)
      if (targetUsers.length === 0) {
        logger.info(`No target users for notification ${notificationId}`)
        return notificationId
      }

      // Check if batchable
      if (notification.batchable) {
        this.batchingEngine.addToBatch(notification, targetUsers)
      } else {
        await this.deliverNotificationNow(notification, targetUsers)
      }

      // Track delivery
      if (notification.deliveryTracking) {
        this.deliveryTracker.trackNotification(notificationId, targetUsers)
      }

      // Setup escalation if needed
      if (notification.escalationRules) {
        this.escalationManager.setupEscalation(notification)
      }

      return notificationId
    } catch (error) {
      logger.error(`Error sending notification ${notificationId}:`, error)
      throw error
    }
  }

  public async sendToUser(userId: number, notification: NotificationPayload): Promise<string> {
    notification.targetUsers = [userId]
    return this.sendNotification(notification)
  }

  public async sendToRole(role: string, notification: NotificationPayload): Promise<string> {
    notification.targetRoles = [role]
    return this.sendNotification(notification)
  }

  public async sendToTicketParticipants(ticketId: number, notification: NotificationPayload): Promise<string> {
    const participants = await this.getTicketParticipants(ticketId)
    notification.targetUsers = participants
    notification.ticketId = ticketId
    return this.sendNotification(notification)
  }

  public async broadcast(notification: NotificationPayload): Promise<string> {
    const allUsers = await this.getAllActiveUsers()
    notification.targetUsers = allUsers
    return this.sendNotification(notification)
  }

  // Delivery methods
  private async deliverNotificationNow(notification: NotificationPayload, targetUsers: number[]) {
    const deliveryPromises: Promise<void>[] = []

    for (const userId of targetUsers) {
      // Check user preferences for channels
      const userPreferences = await this.getUserNotificationPreferences(userId)
      const channels = notification.channels || this.determineChannelsFromPreferences(userPreferences, notification)

      // Deliver via Socket.io (real-time)
      if (channels.includes('socket') || channels.includes('in-app')) {
        deliveryPromises.push(this.deliverViaSocket(notification, userId))
      }

      // Deliver via other channels
      for (const channel of channels) {
        if (channel !== 'socket' && channel !== 'in-app') {
          deliveryPromises.push(
            this.channelManager.deliverViaChannel(channel, notification, userId, userPreferences)
          )
        }
      }
    }

    await Promise.allSettled(deliveryPromises)
  }

  private async deliverViaSocket(notification: NotificationPayload, userId: number) {
    const userSockets = this.userSockets.get(userId)
    if (!userSockets || userSockets.size === 0) {
      // User is offline, store for later delivery
      await this.storePendingNotification(notification, userId)
      return
    }

    const socketNotification = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      timestamp: new Date().toISOString(),
      ticketId: notification.ticketId,
      authorId: notification.authorId,
      metadata: notification.metadata
    }

    // Send to all user's sockets
    this.io.to(`user_${userId}`).emit('notification:received', socketNotification)

    // Mark as delivered via socket
    if (notification.deliveryTracking) {
      this.deliveryTracker.markAsDelivered(notification.id!, userId, 'socket')
    }
  }

  // Helper methods
  private async resolveTargetUsers(notification: NotificationPayload): Promise<number[]> {
    let targetUsers: number[] = []

    if (notification.targetUsers) {
      targetUsers = [...notification.targetUsers]
    }

    if (notification.targetRoles) {
      const roleUsers = await this.getUsersByRoles(notification.targetRoles)
      targetUsers = [...targetUsers, ...roleUsers]
    }

    if (notification.ticketId && !notification.targetUsers && !notification.targetRoles) {
      const ticketUsers = await this.getTicketParticipants(notification.ticketId)
      targetUsers = [...targetUsers, ...ticketUsers]
    }

    // Remove duplicates and exclude author if specified
    const uniqueUsers = [...new Set(targetUsers)]
    if (notification.authorId) {
      return uniqueUsers.filter(id => id !== notification.authorId)
    }

    return uniqueUsers
  }

  private async getTicketParticipants(ticketId: number): Promise<number[]> {
    try {
      const participants = this.db.prepare(`
        SELECT DISTINCT user_id
        FROM (
          SELECT user_id FROM tickets WHERE id = ?
          UNION
          SELECT assigned_to as user_id FROM tickets WHERE id = ? AND assigned_to IS NOT NULL
          UNION
          SELECT author_id as user_id FROM comments WHERE ticket_id = ?
          UNION
          SELECT user_id FROM ticket_followers WHERE ticket_id = ?
        )
        WHERE user_id IS NOT NULL
      `).all(ticketId, ticketId, ticketId, ticketId) as { user_id: number }[]

      return participants.map(p => p.user_id)
    } catch (error) {
      logger.error('Error getting ticket participants', error)
      return []
    }
  }

  private async getUsersByRoles(roles: string[]): Promise<number[]> {
    try {
      const placeholders = roles.map(() => '?').join(',')
      const users = this.db.prepare(`
        SELECT id FROM users
        WHERE role IN (${placeholders}) AND is_active = 1
      `).all(...roles) as { id: number }[]

      return users.map(u => u.id)
    } catch (error) {
      logger.error('Error getting users by roles', error)
      return []
    }
  }

  private async getAllActiveUsers(): Promise<number[]> {
    try {
      const users = this.db.prepare(`
        SELECT id FROM users WHERE is_active = 1
      `).all() as { id: number }[]

      return users.map(u => u.id)
    } catch (error) {
      logger.error('Error getting all active users', error)
      return []
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private extractDeviceInfo(socket: any): any {
    const userAgent = socket.handshake.headers['user-agent'] || ''
    return {
      userAgent,
      platform: this.detectPlatform(userAgent),
      browser: this.detectBrowser(userAgent),
      isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent)
    }
  }

  private detectPlatform(userAgent: string): string {
    if (/Windows/.test(userAgent)) return 'Windows'
    if (/Mac/.test(userAgent)) return 'macOS'
    if (/Linux/.test(userAgent)) return 'Linux'
    if (/Android/.test(userAgent)) return 'Android'
    if (/iPhone|iPad/.test(userAgent)) return 'iOS'
    return 'Unknown'
  }

  private detectBrowser(userAgent: string): string {
    if (/Chrome/.test(userAgent)) return 'Chrome'
    if (/Firefox/.test(userAgent)) return 'Firefox'
    if (/Safari/.test(userAgent)) return 'Safari'
    if (/Edge/.test(userAgent)) return 'Edge'
    return 'Unknown'
  }

  // Database operations
  private saveUserSession(session: UserSession) {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO user_sessions (
          id, user_id, socket_id, user_agent, ip_address,
          is_active, last_activity, presence, device_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session.socketId,
        session.userId,
        session.socketId,
        session.userAgent || '',
        session.ipAddress || '',
        1,
        session.lastActivity.toISOString(),
        session.presence,
        JSON.stringify(session.deviceInfo)
      )
    } catch (error) {
      logger.error('Error saving user session', error)
    }
  }

  private updateUserActivity(socketId: string) {
    const session = this.activeSessions.get(socketId)
    if (session) {
      session.lastActivity = new Date()
      this.activeSessions.set(socketId, session)

      try {
        this.db.prepare(`
          UPDATE user_sessions
          SET last_activity = ?
          WHERE id = ?
        `).run(session.lastActivity.toISOString(), socketId)
      } catch (error) {
        logger.error('Error updating user activity', error)
      }
    }
  }

  private updateUserSessionDisconnect(socketId: string) {
    try {
      this.db.prepare(`
        UPDATE user_sessions
        SET is_active = 0, disconnected_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(socketId)
    } catch (error) {
      logger.error('Error updating user session disconnect', error)
    }
  }

  private async storePendingNotification(notification: NotificationPayload, userId: number) {
    const userKey = `user_${userId}`
    if (!this.pendingNotifications.has(userKey)) {
      this.pendingNotifications.set(userKey, [])
    }

    const notifications = this.pendingNotifications.get(userKey)!
    notifications.push(notification)

    // Limit pending notifications per user
    if (notifications.length > 100) {
      notifications.splice(0, notifications.length - 100)
    }
  }

  private async deliverPendingNotifications(userId: number) {
    const userKey = `user_${userId}`
    const notifications = this.pendingNotifications.get(userKey)

    if (notifications && notifications.length > 0) {
      for (const notification of notifications) {
        await this.deliverViaSocket(notification, userId)
      }
      this.pendingNotifications.delete(userKey)
    }
  }

  private async getUserNotificationPreferences(userId: number): Promise<any> {
    try {
      const prefs = this.db.prepare(`
        SELECT notification_preferences FROM users WHERE id = ?
      `).get(userId) as { notification_preferences: string | null }

      return prefs?.notification_preferences ? JSON.parse(prefs.notification_preferences) : {}
    } catch (error) {
      logger.error('Error getting user notification preferences', error)
      return {}
    }
  }

  private determineChannelsFromPreferences(preferences: any, notification: NotificationPayload): string[] {
    const defaultChannels = ['socket']

    if (!preferences || Object.keys(preferences).length === 0) {
      return defaultChannels
    }

    const channels: string[] = []

    if (preferences.inApp !== false) {
      channels.push('socket')
    }

    if (preferences.email === true || (notification.priority === 'high' || notification.priority === 'critical')) {
      channels.push('email')
    }

    if (preferences.push === true && notification.priority === 'critical') {
      channels.push('push')
    }

    if (preferences.teams === true && (notification.priority === 'high' || notification.priority === 'critical')) {
      channels.push('teams')
    }

    return channels.length > 0 ? channels : defaultChannels
  }

  private markNotificationAsRead(notificationId: string, userId: number) {
    try {
      this.db.prepare(`
        UPDATE notifications
        SET is_read = 1, read_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(notificationId, userId)

      // Emit to user's sockets
      this.io.to(`user_${userId}`).emit('notification:read', { id: notificationId })
    } catch (error) {
      logger.error('Error marking notification as read', error)
    }
  }

  private markAllNotificationsAsRead(userId: number) {
    try {
      this.db.prepare(`
        UPDATE notifications
        SET is_read = 1, read_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND is_read = 0
      `).run(userId)

      // Emit to user's sockets
      this.io.to(`user_${userId}`).emit('notifications:all_read')
    } catch (error) {
      logger.error('Error marking all notifications as read', error)
    }
  }

  private getUnreadNotificationCount(userId: number): number {
    try {
      const result = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM notifications
        WHERE user_id = ? AND is_read = 0
      `).get(userId) as { count: number }

      return result.count
    } catch (error) {
      logger.error('Error getting unread notification count', error)
      return 0
    }
  }

  private broadcastPresenceUpdate(userId: number, presence: string) {
    this.io.emit('presence:update', {
      userId,
      presence,
      timestamp: new Date().toISOString()
    })
  }

  // Notification processing setup
  private setupNotificationProcessing() {
    // Process batched notifications
    setInterval(() => {
      this.processBatchedNotifications()
    }, this.BATCH_PROCESS_INTERVAL)

    // Process escalations
    setInterval(() => {
      this.escalationManager.processEscalations()
    }, 60000) // Every minute
  }

  private async processBatchedNotifications() {
    const batches = this.batchingEngine.getReadyBatches()

    for (const batch of batches) {
      try {
        await this.deliverNotificationNow(batch.notification, batch.targetUsers)
      } catch (error) {
        logger.error('Error processing batched notification', error)
      }
    }
  }

  // Cleanup tasks
  private setupCleanupTasks() {
    // Clean up inactive sessions every 5 minutes
    setInterval(() => {
      this.cleanupInactiveSessions()
    }, 5 * 60 * 1000)

    // Clean up old pending notifications every hour
    setInterval(() => {
      this.cleanupOldPendingNotifications()
    }, 60 * 60 * 1000)
  }

  private cleanupInactiveSessions() {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago

    for (const [socketId, session] of this.activeSessions.entries()) {
      if (session.lastActivity < cutoffTime) {
        this.activeSessions.delete(socketId)

        const userSockets = this.userSockets.get(session.userId)
        if (userSockets) {
          userSockets.delete(socketId)
          if (userSockets.size === 0) {
            this.userSockets.delete(session.userId)
            this.presenceManager.setUserPresence(session.userId, 'offline')
          }
        }
      }
    }
  }

  private cleanupOldPendingNotifications() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

    for (const [userKey, notifications] of this.pendingNotifications.entries()) {
      const validNotifications = notifications.filter(n => {
        const notificationTime = n.metadata?.timestamp ? new Date(n.metadata.timestamp) : new Date()
        return notificationTime > cutoffTime
      })

      if (validNotifications.length === 0) {
        this.pendingNotifications.delete(userKey)
      } else if (validNotifications.length !== notifications.length) {
        this.pendingNotifications.set(userKey, validNotifications)
      }
    }
  }

  // Public getters
  public getActiveUsers(): UserSession[] {
    return Array.from(this.activeSessions.values())
  }

  public getUserPresence(userId: number): string | null {
    return this.presenceManager.getUserPresence(userId)
  }

  public getConnectionStats() {
    return {
      totalConnections: this.activeSessions.size,
      uniqueUsers: this.userSockets.size,
      pendingNotifications: Array.from(this.pendingNotifications.values()).reduce((sum, arr) => sum + arr.length, 0),
      queueSize: this.processingQueue.length
    }
  }

  public getIO(): SocketIOServer {
    return this.io
  }

  public getChannelManager(): NotificationChannelManager {
    return this.channelManager
  }

  public getBatchingEngine(): NotificationBatchingEngine {
    return this.batchingEngine
  }

  public getDeliveryTracker(): DeliveryTracker {
    return this.deliveryTracker
  }

  public getSmartFiltering(): SmartFilteringEngine {
    return this.smartFiltering
  }

  public getEscalationManager(): EscalationManager {
    return this.escalationManager
  }

  public getPresenceManager(): PresenceManager {
    return this.presenceManager
  }
}

// Singleton instance
let realtimeEngine: RealtimeNotificationEngine | null = null

export function initializeRealtimeEngine(httpServer: HTTPServer): RealtimeNotificationEngine {
  if (!realtimeEngine) {
    realtimeEngine = new RealtimeNotificationEngine(httpServer)
  }
  return realtimeEngine
}

export function getRealtimeEngine(): RealtimeNotificationEngine | null {
  return realtimeEngine
}