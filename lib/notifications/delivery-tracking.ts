import { getDb } from '@/lib/db'
import logger from '../monitoring/structured-logger';

export interface DeliveryAttempt {
  id: string
  notificationId: string
  userId: number
  channel: string
  attempt: number
  status: 'pending' | 'delivered' | 'failed' | 'read' | 'expired'
  messageId?: string
  error?: string
  deliveredAt?: Date
  readAt?: Date
  expiresAt?: Date
  retryAfter?: Date
  metadata?: any
}

export interface DeliveryReceipt {
  notificationId: string
  userId: number
  channel: string
  status: 'delivered' | 'read' | 'failed'
  timestamp: Date
  messageId?: string
  deviceInfo?: any
  location?: any
}

export interface DeliveryMetrics {
  totalSent: number
  totalDelivered: number
  totalRead: number
  totalFailed: number
  deliveryRate: number
  readRate: number
  averageDeliveryTime: number
  averageReadTime: number
  channelBreakdown: Record<string, any>
  failureReasons: Record<string, number>
}

export class DeliveryTracker {
  private db = getDb()
  private deliveryAttempts = new Map<string, DeliveryAttempt>()

  // Real-time tracking
  private deliveryCallbacks = new Map<string, Function[]>()
  private readCallbacks = new Map<string, Function[]>()

  constructor() {
    this.initializeDeliveryTracking()
    this.setupCleanupTasks()
    this.loadPendingDeliveries()
  }

  private initializeDeliveryTracking() {
    // Setup database schema if needed
    this.ensureDeliveryTables()
  }

  private ensureDeliveryTables() {
    try {
      // Create delivery attempts table
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS notification_deliveries (
          id TEXT PRIMARY KEY,
          notification_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          channel TEXT NOT NULL,
          attempt INTEGER DEFAULT 1,
          status TEXT DEFAULT 'pending',
          message_id TEXT,
          error TEXT,
          delivered_at DATETIME,
          read_at DATETIME,
          expires_at DATETIME,
          retry_after DATETIME,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()

      // Create delivery receipts table
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS delivery_receipts (
          id TEXT PRIMARY KEY,
          notification_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL,
          message_id TEXT,
          device_info TEXT,
          location_info TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()

      // Create indexes for performance
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_delivery_notification_user
        ON notification_deliveries(notification_id, user_id)
      `).run()

      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_delivery_status_channel
        ON notification_deliveries(status, channel)
      `).run()

      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_delivery_created_at
        ON notification_deliveries(created_at)
      `).run()

    } catch (error) {
      logger.error('Error creating delivery tracking tables', error)
    }
  }

  private loadPendingDeliveries() {
    try {
      const pendingDeliveries = this.db.prepare(`
        SELECT * FROM notification_deliveries
        WHERE status IN ('pending', 'failed') AND expires_at > datetime('now')
      `).all() as any[]

      for (const delivery of pendingDeliveries) {
        const attempt: DeliveryAttempt = {
          id: delivery.id,
          notificationId: delivery.notification_id,
          userId: delivery.user_id,
          channel: delivery.channel,
          attempt: delivery.attempt,
          status: delivery.status,
          messageId: delivery.message_id,
          error: delivery.error,
          deliveredAt: delivery.delivered_at ? new Date(delivery.delivered_at) : undefined,
          readAt: delivery.read_at ? new Date(delivery.read_at) : undefined,
          expiresAt: delivery.expires_at ? new Date(delivery.expires_at) : undefined,
          retryAfter: delivery.retry_after ? new Date(delivery.retry_after) : undefined,
          metadata: delivery.metadata ? JSON.parse(delivery.metadata) : undefined
        }

        this.deliveryAttempts.set(attempt.id, attempt)
      }

      logger.info(`Loaded ${pendingDeliveries.length} pending delivery attempts`)
    } catch (error) {
      logger.error('Error loading pending deliveries', error)
    }
  }

  public trackNotification(notificationId: string, targetUsers: number[], channels: string[] = ['socket']): void {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    for (const userId of targetUsers) {
      for (const channel of channels) {
        const deliveryId = `${notificationId}_${userId}_${channel}_${Date.now()}`

        const attempt: DeliveryAttempt = {
          id: deliveryId,
          notificationId,
          userId,
          channel,
          attempt: 1,
          status: 'pending',
          expiresAt,
          metadata: {
            trackingStarted: new Date().toISOString()
          }
        }

        this.deliveryAttempts.set(deliveryId, attempt)
        this.persistDeliveryAttempt(attempt)

        logger.info(`Tracking delivery: ${deliveryId}`)
      }
    }
  }

  public markAsDelivered(
    notificationId: string,
    userId: number,
    channel: string,
    messageId?: string,
    deviceInfo?: any
  ): void {
    const deliveryKey = this.findDeliveryKey(notificationId, userId, channel)
    if (!deliveryKey) {
      logger.warn(`No delivery tracking found for ${notificationId}/${userId}/${channel}`)
      return
    }

    const attempt = this.deliveryAttempts.get(deliveryKey)
    if (attempt) {
      attempt.status = 'delivered'
      attempt.deliveredAt = new Date()
      attempt.messageId = messageId

      this.deliveryAttempts.set(deliveryKey, attempt)
      this.updateDeliveryAttempt(attempt)

      // Create delivery receipt
      const receipt: DeliveryReceipt = {
        notificationId,
        userId,
        channel,
        status: 'delivered',
        timestamp: new Date(),
        messageId,
        deviceInfo
      }

      this.recordDeliveryReceipt(receipt)

      // Trigger callbacks
      this.triggerDeliveryCallbacks(notificationId, userId, channel, 'delivered')

      logger.info(`Marked as delivered: ${deliveryKey}`)
    }
  }

  public markAsRead(
    notificationId: string,
    userId: number,
    channel: string = 'socket',
    deviceInfo?: any
  ): void {
    const deliveryKey = this.findDeliveryKey(notificationId, userId, channel)
    if (!deliveryKey) {
      logger.warn(`No delivery tracking found for ${notificationId}/${userId}/${channel}`)
      return
    }

    const attempt = this.deliveryAttempts.get(deliveryKey)
    if (attempt) {
      attempt.status = 'read'
      attempt.readAt = new Date()

      this.deliveryAttempts.set(deliveryKey, attempt)
      this.updateDeliveryAttempt(attempt)

      // Create read receipt
      const receipt: DeliveryReceipt = {
        notificationId,
        userId,
        channel,
        status: 'read',
        timestamp: new Date(),
        deviceInfo
      }

      this.recordDeliveryReceipt(receipt)

      // Trigger callbacks
      this.triggerReadCallbacks(notificationId, userId, channel)

      logger.info(`Marked as read: ${deliveryKey}`)
    }
  }

  public markAsFailed(
    notificationId: string,
    userId: number,
    channel: string,
    error: string,
    shouldRetry: boolean = true
  ): void {
    const deliveryKey = this.findDeliveryKey(notificationId, userId, channel)
    if (!deliveryKey) {
      logger.warn(`No delivery tracking found for ${notificationId}/${userId}/${channel}`)
      return
    }

    const attempt = this.deliveryAttempts.get(deliveryKey)
    if (attempt) {
      attempt.status = 'failed'
      attempt.error = error

      if (shouldRetry && attempt.attempt < 3) {
        // Schedule retry
        const retryDelay = Math.pow(2, attempt.attempt) * 60000 // Exponential backoff
        attempt.retryAfter = new Date(Date.now() + retryDelay)
        attempt.attempt += 1
        attempt.status = 'pending'
      }

      this.deliveryAttempts.set(deliveryKey, attempt)
      this.updateDeliveryAttempt(attempt)

      // Record failure receipt
      const receipt: DeliveryReceipt = {
        notificationId,
        userId,
        channel,
        status: 'failed',
        timestamp: new Date()
      }

      this.recordDeliveryReceipt(receipt)

      logger.info(`Marked as failed: ${deliveryKey} - ${error}`)
    }
  }

  public getDeliveryStatus(notificationId: string): Record<string, any> {
    const deliveries = Array.from(this.deliveryAttempts.values())
      .filter(attempt => attempt.notificationId === notificationId)

    const status = {
      notificationId,
      totalRecipients: deliveries.length,
      delivered: deliveries.filter(d => d.status === 'delivered' || d.status === 'read').length,
      read: deliveries.filter(d => d.status === 'read').length,
      failed: deliveries.filter(d => d.status === 'failed').length,
      pending: deliveries.filter(d => d.status === 'pending').length,
      deliveryRate: 0,
      readRate: 0,
      averageDeliveryTime: 0,
      channelBreakdown: {} as Record<string, any>,
      deliveries: deliveries.map(d => ({
        userId: d.userId,
        channel: d.channel,
        status: d.status,
        attempt: d.attempt,
        deliveredAt: d.deliveredAt,
        readAt: d.readAt,
        error: d.error
      }))
    }

    if (status.totalRecipients > 0) {
      status.deliveryRate = (status.delivered / status.totalRecipients) * 100
      status.readRate = status.delivered > 0 ? (status.read / status.delivered) * 100 : 0
    }

    // Calculate average delivery time
    const deliveredAttempts = deliveries.filter(d => d.deliveredAt)
    if (deliveredAttempts.length > 0) {
      const totalDeliveryTime = deliveredAttempts.reduce((sum, d) => {
        const deliveryTime = d.deliveredAt!.getTime() - new Date(d.metadata?.trackingStarted || 0).getTime()
        return sum + deliveryTime
      }, 0)
      status.averageDeliveryTime = totalDeliveryTime / deliveredAttempts.length
    }

    // Channel breakdown
    const channelGroups = deliveries.reduce((groups, d) => {
      if (!groups[d.channel]) {
        groups[d.channel] = { total: 0, delivered: 0, read: 0, failed: 0 }
      }
      groups[d.channel].total++
      if (d.status === 'delivered' || d.status === 'read') groups[d.channel].delivered++
      if (d.status === 'read') groups[d.channel].read++
      if (d.status === 'failed') groups[d.channel].failed++
      return groups
    }, {} as Record<string, any>)

    status.channelBreakdown = channelGroups

    return status
  }

  public getUserDeliveryHistory(
    userId: number,
    timeRange: { start: Date; end: Date },
    channels?: string[]
  ): DeliveryReceipt[] {
    try {
      let query = `
        SELECT * FROM delivery_receipts
        WHERE user_id = ? AND timestamp BETWEEN ? AND ?
      `
      const params: any[] = [userId, timeRange.start.toISOString(), timeRange.end.toISOString()]

      if (channels && channels.length > 0) {
        const placeholders = channels.map(() => '?').join(',')
        query += ` AND channel IN (${placeholders})`
        params.push(...channels)
      }

      query += ` ORDER BY timestamp DESC`

      const receipts = this.db.prepare(query).all(...params) as any[]

      return receipts.map(r => ({
        notificationId: r.notification_id,
        userId: r.user_id,
        channel: r.channel,
        status: r.status,
        timestamp: new Date(r.timestamp),
        messageId: r.message_id,
        deviceInfo: r.device_info ? JSON.parse(r.device_info) : undefined,
        location: r.location_info ? JSON.parse(r.location_info) : undefined
      }))
    } catch (error) {
      logger.error('Error getting user delivery history', error)
      return []
    }
  }

  public getDeliveryMetrics(
    timeRange: { start: Date; end: Date },
    channels?: string[],
    userIds?: number[]
  ): DeliveryMetrics {
    try {
      let whereClause = 'WHERE created_at BETWEEN ? AND ?'
      const params: any[] = [timeRange.start.toISOString(), timeRange.end.toISOString()]

      if (channels && channels.length > 0) {
        const placeholders = channels.map(() => '?').join(',')
        whereClause += ` AND channel IN (${placeholders})`
        params.push(...channels)
      }

      if (userIds && userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(',')
        whereClause += ` AND user_id IN (${placeholders})`
        params.push(...userIds)
      }

      // Overall metrics
      const overallStats = this.db.prepare(`
        SELECT
          COUNT(*) as total_sent,
          COUNT(CASE WHEN status IN ('delivered', 'read') THEN 1 END) as total_delivered,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as total_read,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
          AVG(CASE WHEN delivered_at IS NOT NULL
              THEN (julianday(delivered_at) - julianday(created_at)) * 86400000
              END) as avg_delivery_time,
          AVG(CASE WHEN read_at IS NOT NULL
              THEN (julianday(read_at) - julianday(delivered_at)) * 86400000
              END) as avg_read_time
        FROM notification_deliveries
        ${whereClause}
      `).get(...params) as any

      // Channel breakdown
      const channelStats = this.db.prepare(`
        SELECT
          channel,
          COUNT(*) as total,
          COUNT(CASE WHEN status IN ('delivered', 'read') THEN 1 END) as delivered,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          AVG(CASE WHEN delivered_at IS NOT NULL
              THEN (julianday(delivered_at) - julianday(created_at)) * 86400000
              END) as avg_delivery_time
        FROM notification_deliveries
        ${whereClause}
        GROUP BY channel
      `).all(...params) as any[]

      // Failure reasons
      const failureReasons = this.db.prepare(`
        SELECT error, COUNT(*) as count
        FROM notification_deliveries
        ${whereClause} AND status = 'failed' AND error IS NOT NULL
        GROUP BY error
        ORDER BY count DESC
      `).all(...params) as any[]

      const metrics: DeliveryMetrics = {
        totalSent: overallStats.total_sent || 0,
        totalDelivered: overallStats.total_delivered || 0,
        totalRead: overallStats.total_read || 0,
        totalFailed: overallStats.total_failed || 0,
        deliveryRate: overallStats.total_sent > 0
          ? (overallStats.total_delivered / overallStats.total_sent) * 100
          : 0,
        readRate: overallStats.total_delivered > 0
          ? (overallStats.total_read / overallStats.total_delivered) * 100
          : 0,
        averageDeliveryTime: overallStats.avg_delivery_time || 0,
        averageReadTime: overallStats.avg_read_time || 0,
        channelBreakdown: channelStats.reduce((breakdown, stat) => {
          breakdown[stat.channel] = {
            total: stat.total,
            delivered: stat.delivered,
            read: stat.read,
            failed: stat.failed,
            deliveryRate: stat.total > 0 ? (stat.delivered / stat.total) * 100 : 0,
            readRate: stat.delivered > 0 ? (stat.read / stat.delivered) * 100 : 0,
            avgDeliveryTime: stat.avg_delivery_time || 0
          }
          return breakdown
        }, {} as Record<string, any>),
        failureReasons: failureReasons.reduce((reasons, reason) => {
          reasons[reason.error] = reason.count
          return reasons
        }, {} as Record<string, number>)
      }

      return metrics
    } catch (error) {
      logger.error('Error getting delivery metrics', error)
      return {
        totalSent: 0,
        totalDelivered: 0,
        totalRead: 0,
        totalFailed: 0,
        deliveryRate: 0,
        readRate: 0,
        averageDeliveryTime: 0,
        averageReadTime: 0,
        channelBreakdown: {},
        failureReasons: {}
      }
    }
  }

  // Real-time callbacks
  public onDelivery(notificationId: string, callback: Function): void {
    if (!this.deliveryCallbacks.has(notificationId)) {
      this.deliveryCallbacks.set(notificationId, [])
    }
    this.deliveryCallbacks.get(notificationId)!.push(callback)
  }

  public onRead(notificationId: string, callback: Function): void {
    if (!this.readCallbacks.has(notificationId)) {
      this.readCallbacks.set(notificationId, [])
    }
    this.readCallbacks.get(notificationId)!.push(callback)
  }

  private triggerDeliveryCallbacks(notificationId: string, userId: number, channel: string, status: string): void {
    const callbacks = this.deliveryCallbacks.get(notificationId)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({ notificationId, userId, channel, status, timestamp: new Date() })
        } catch (error) {
          logger.error('Error in delivery callback', error)
        }
      })
    }
  }

  private triggerReadCallbacks(notificationId: string, userId: number, channel: string): void {
    const callbacks = this.readCallbacks.get(notificationId)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback({ notificationId, userId, channel, timestamp: new Date() })
        } catch (error) {
          logger.error('Error in read callback', error)
        }
      })
    }
  }

  // Database operations
  private persistDeliveryAttempt(attempt: DeliveryAttempt): void {
    try {
      this.db.prepare(`
        INSERT INTO notification_deliveries (
          id, notification_id, user_id, channel, attempt, status,
          message_id, error, delivered_at, read_at, expires_at, retry_after, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        attempt.id,
        attempt.notificationId,
        attempt.userId,
        attempt.channel,
        attempt.attempt,
        attempt.status,
        attempt.messageId || null,
        attempt.error || null,
        attempt.deliveredAt?.toISOString() || null,
        attempt.readAt?.toISOString() || null,
        attempt.expiresAt?.toISOString() || null,
        attempt.retryAfter?.toISOString() || null,
        attempt.metadata ? JSON.stringify(attempt.metadata) : null
      )
    } catch (error) {
      logger.error('Error persisting delivery attempt', error)
    }
  }

  private updateDeliveryAttempt(attempt: DeliveryAttempt): void {
    try {
      this.db.prepare(`
        UPDATE notification_deliveries
        SET status = ?, message_id = ?, error = ?, delivered_at = ?,
            read_at = ?, retry_after = ?, attempt = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        attempt.status,
        attempt.messageId || null,
        attempt.error || null,
        attempt.deliveredAt?.toISOString() || null,
        attempt.readAt?.toISOString() || null,
        attempt.retryAfter?.toISOString() || null,
        attempt.attempt,
        attempt.metadata ? JSON.stringify(attempt.metadata) : null,
        attempt.id
      )
    } catch (error) {
      logger.error('Error updating delivery attempt', error)
    }
  }

  private recordDeliveryReceipt(receipt: DeliveryReceipt): void {
    try {
      const receiptId = `receipt_${receipt.notificationId}_${receipt.userId}_${receipt.channel}_${Date.now()}`

      this.db.prepare(`
        INSERT INTO delivery_receipts (
          id, notification_id, user_id, channel, status, message_id,
          device_info, location_info, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        receiptId,
        receipt.notificationId,
        receipt.userId,
        receipt.channel,
        receipt.status,
        receipt.messageId || null,
        receipt.deviceInfo ? JSON.stringify(receipt.deviceInfo) : null,
        receipt.location ? JSON.stringify(receipt.location) : null,
        receipt.timestamp.toISOString()
      )
    } catch (error) {
      logger.error('Error recording delivery receipt', error)
    }
  }

  private findDeliveryKey(notificationId: string, userId: number, channel: string): string | null {
    for (const [key, attempt] of this.deliveryAttempts.entries()) {
      if (attempt.notificationId === notificationId &&
          attempt.userId === userId &&
          attempt.channel === channel) {
        return key
      }
    }
    return null
  }

  private setupCleanupTasks(): void {
    // Cleanup expired deliveries every hour
    setInterval(() => {
      this.cleanupExpiredDeliveries()
    }, 60 * 60 * 1000)

    // Cleanup old receipts every day
    setInterval(() => {
      this.cleanupOldReceipts()
    }, 24 * 60 * 60 * 1000)

    // Process retry queue every 5 minutes
    setInterval(() => {
      this.processRetryQueue()
    }, 5 * 60 * 1000)
  }

  private cleanupExpiredDeliveries(): void {
    try {
      const now = new Date()
      const expiredKeys: string[] = []

      for (const [key, attempt] of this.deliveryAttempts.entries()) {
        if (attempt.expiresAt && attempt.expiresAt < now) {
          expiredKeys.push(key)
        }
      }

      for (const key of expiredKeys) {
        const attempt = this.deliveryAttempts.get(key)
        if (attempt) {
          attempt.status = 'expired'
          this.updateDeliveryAttempt(attempt)
          this.deliveryAttempts.delete(key)
        }
      }

      if (expiredKeys.length > 0) {
        logger.info(`Cleaned up ${expiredKeys.length} expired delivery attempts`)
      }
    } catch (error) {
      logger.error('Error cleaning up expired deliveries', error)
    }
  }

  private cleanupOldReceipts(): void {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

      const deleted = this.db.prepare(`
        DELETE FROM delivery_receipts
        WHERE timestamp < ?
      `).run(cutoffDate.toISOString())

      if (deleted.changes > 0) {
        logger.info(`Cleaned up ${deleted.changes} old delivery receipts`)
      }
    } catch (error) {
      logger.error('Error cleaning up old receipts', error)
    }
  }

  private processRetryQueue(): void {
    try {
      const now = new Date()
      const retryAttempts: DeliveryAttempt[] = []

      for (const attempt of this.deliveryAttempts.values()) {
        if (attempt.status === 'pending' &&
            attempt.retryAfter &&
            attempt.retryAfter <= now) {
          retryAttempts.push(attempt)
        }
      }

      for (const attempt of retryAttempts) {
        logger.info(`Retrying delivery: ${attempt.id} (attempt ${attempt.attempt})`)
        // The actual retry would be handled by the notification engine
        // Here we just update the status and reset retry timer
        attempt.retryAfter = undefined
        this.updateDeliveryAttempt(attempt)
      }

      if (retryAttempts.length > 0) {
        logger.info(`Processed ${retryAttempts.length} retry attempts`)
      }
    } catch (error) {
      logger.error('Error processing retry queue', error)
    }
  }

  // Public utility methods
  public getFailedDeliveries(channel?: string): DeliveryAttempt[] {
    const failed: DeliveryAttempt[] = []

    for (const attempt of this.deliveryAttempts.values()) {
      if (attempt.status === 'failed' && (!channel || attempt.channel === channel)) {
        failed.push(attempt)
      }
    }

    return failed
  }

  public getPendingRetries(): DeliveryAttempt[] {
    const pending: DeliveryAttempt[] = []
    const now = new Date()

    for (const attempt of this.deliveryAttempts.values()) {
      if (attempt.status === 'pending' &&
          attempt.retryAfter &&
          attempt.retryAfter <= now) {
        pending.push(attempt)
      }
    }

    return pending
  }

  public getDeliveryReport(notificationId: string): any {
    const status = this.getDeliveryStatus(notificationId)
    const receipts = this.getReceiptsForNotification(notificationId)

    return {
      ...status,
      timeline: receipts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      summary: {
        deliverySuccessRate: status.deliveryRate,
        readEngagementRate: status.readRate,
        averageTimeToDelivery: status.averageDeliveryTime,
        channelPerformance: status.channelBreakdown
      }
    }
  }

  private getReceiptsForNotification(notificationId: string): DeliveryReceipt[] {
    try {
      const receipts = this.db.prepare(`
        SELECT * FROM delivery_receipts
        WHERE notification_id = ?
        ORDER BY timestamp ASC
      `).all(notificationId) as any[]

      return receipts.map(r => ({
        notificationId: r.notification_id,
        userId: r.user_id,
        channel: r.channel,
        status: r.status,
        timestamp: new Date(r.timestamp),
        messageId: r.message_id,
        deviceInfo: r.device_info ? JSON.parse(r.device_info) : undefined,
        location: r.location_info ? JSON.parse(r.location_info) : undefined
      }))
    } catch (error) {
      logger.error('Error getting receipts for notification', error)
      return []
    }
  }
}