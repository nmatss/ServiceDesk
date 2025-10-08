import { NotificationPayload } from './realtime-engine'
import { getDb } from '@/lib/db'
import { logger } from '../monitoring/logger';

export interface BatchConfig {
  maxBatchSize: number
  maxWaitTime: number // milliseconds
  batchKey: string
  groupBy: 'user' | 'ticket' | 'type' | 'priority' | 'custom'
  customGrouper?: (notification: NotificationPayload) => string
}

export interface NotificationBatch {
  id: string
  notifications: NotificationPayload[]
  targetUsers: number[]
  createdAt: Date
  scheduledAt: Date
  config: BatchConfig
  metadata?: any
}

export interface BatchedNotification {
  notification: NotificationPayload
  targetUsers: number[]
  batchId: string
  addedAt: Date
}

export class NotificationBatchingEngine {
  private db = getDb()
  private activeBatches = new Map<string, NotificationBatch>()
  private batchConfigs = new Map<string, BatchConfig>()
  private batchTimers = new Map<string, NodeJS.Timeout>()

  // Default batch configurations
  private readonly DEFAULT_CONFIGS: Record<string, BatchConfig> = {
    digest_email: {
      maxBatchSize: 50,
      maxWaitTime: 15 * 60 * 1000, // 15 minutes
      batchKey: 'digest_email',
      groupBy: 'user'
    },
    ticket_updates: {
      maxBatchSize: 10,
      maxWaitTime: 5 * 60 * 1000, // 5 minutes
      batchKey: 'ticket_updates',
      groupBy: 'ticket'
    },
    sla_warnings: {
      maxBatchSize: 20,
      maxWaitTime: 2 * 60 * 1000, // 2 minutes
      batchKey: 'sla_warnings',
      groupBy: 'priority'
    },
    system_alerts: {
      maxBatchSize: 5,
      maxWaitTime: 1 * 60 * 1000, // 1 minute
      batchKey: 'system_alerts',
      groupBy: 'type'
    },
    comment_notifications: {
      maxBatchSize: 15,
      maxWaitTime: 3 * 60 * 1000, // 3 minutes
      batchKey: 'comment_notifications',
      groupBy: 'ticket'
    },
    status_updates: {
      maxBatchSize: 25,
      maxWaitTime: 10 * 60 * 1000, // 10 minutes
      batchKey: 'status_updates',
      groupBy: 'user'
    }
  }

  constructor() {
    this.initializeBatchConfigs()
    this.setupBatchProcessing()
    this.loadPersistedBatches()
  }

  private initializeBatchConfigs() {
    // Load default configurations
    for (const [key, config] of Object.entries(this.DEFAULT_CONFIGS)) {
      this.batchConfigs.set(key, config)
    }

    // Load custom configurations from database
    this.loadCustomBatchConfigs()
  }

  private loadCustomBatchConfigs() {
    try {
      const configs = this.db.prepare(`
        SELECT * FROM batch_configurations WHERE is_active = 1
      `).all() as any[]

      for (const config of configs) {
        this.batchConfigs.set(config.batch_key, {
          maxBatchSize: config.max_batch_size,
          maxWaitTime: config.max_wait_time,
          batchKey: config.batch_key,
          groupBy: config.group_by,
          customGrouper: config.custom_grouper ? eval(config.custom_grouper) : undefined
        })
      }
    } catch (error) {
      logger.info('No custom batch configurations found, using defaults')
    }
  }

  private setupBatchProcessing() {
    // Process ready batches every 30 seconds
    setInterval(() => {
      this.processReadyBatches()
    }, 30000)

    // Cleanup old batches every hour
    setInterval(() => {
      this.cleanupOldBatches()
    }, 60 * 60 * 1000)
  }

  private loadPersistedBatches() {
    try {
      const batches = this.db.prepare(`
        SELECT * FROM notification_batches
        WHERE status = 'pending' AND scheduled_at > datetime('now')
      `).all() as any[]

      for (const batchData of batches) {
        const batch: NotificationBatch = {
          id: batchData.id,
          notifications: JSON.parse(batchData.notifications),
          targetUsers: JSON.parse(batchData.target_users),
          createdAt: new Date(batchData.created_at),
          scheduledAt: new Date(batchData.scheduled_at),
          config: this.batchConfigs.get(batchData.batch_key) || this.DEFAULT_CONFIGS.digest_email,
          metadata: batchData.metadata ? JSON.parse(batchData.metadata) : undefined
        }

        this.activeBatches.set(batch.id, batch)
        this.scheduleBatchExecution(batch)
      }

      logger.info(`Loaded ${batches.length} persisted notification batches`)
    } catch (error) {
      logger.error('Error loading persisted batches', error)
    }
  }

  public addToBatch(notification: NotificationPayload, targetUsers: number[]): string {
    const batchKey = this.determineBatchKey(notification)
    const config = this.batchConfigs.get(batchKey) || this.DEFAULT_CONFIGS.digest_email

    // Create group key for batching
    const groupKey = this.createGroupKey(notification, config)
    const batchId = `${batchKey}_${groupKey}_${Date.now()}`

    // Check if there's an existing batch for this group
    const existingBatch = this.findExistingBatch(batchKey, groupKey)

    if (existingBatch && existingBatch.notifications.length < config.maxBatchSize) {
      // Add to existing batch
      existingBatch.notifications.push(notification)
      existingBatch.targetUsers = [...new Set([...existingBatch.targetUsers, ...targetUsers])]

      // Update persisted batch
      this.updatePersistedBatch(existingBatch)

      logger.info(`Added notification to existing batch ${existingBatch.id} (${existingBatch.notifications.length}/${config.maxBatchSize})`)
      return existingBatch.id
    } else {
      // Create new batch
      const newBatch: NotificationBatch = {
        id: batchId,
        notifications: [notification],
        targetUsers: [...targetUsers],
        createdAt: new Date(),
        scheduledAt: new Date(Date.now() + config.maxWaitTime),
        config,
        metadata: {
          groupKey,
          batchKey
        }
      }

      this.activeBatches.set(batchId, newBatch)
      this.scheduleBatchExecution(newBatch)
      this.persistBatch(newBatch)

      logger.info(`Created new batch ${batchId} for ${batchKey}`)
      return batchId
    }
  }

  private determineBatchKey(notification: NotificationPayload): string {
    // Check if notification specifies a batch key
    if (notification.metadata?.batchKey) {
      return notification.metadata.batchKey
    }

    // Determine batch key based on notification type and priority
    switch (notification.type) {
      case 'ticket_assigned':
      case 'ticket_updated':
      case 'ticket_resolved':
      case 'ticket_closed':
        return 'ticket_updates'

      case 'comment_added':
      case 'comment_internal':
        return 'comment_notifications'

      case 'sla_warning':
      case 'sla_breach':
        return 'sla_warnings'

      case 'system_alert':
      case 'system_maintenance':
        return 'system_alerts'

      case 'status_changed':
      case 'priority_changed':
        return 'status_updates'

      default:
        // High priority notifications should not be batched
        if (notification.priority === 'critical' || notification.priority === 'high') {
          return 'immediate'
        }
        return 'digest_email'
    }
  }

  private createGroupKey(notification: NotificationPayload, config: BatchConfig): string {
    switch (config.groupBy) {
      case 'user':
        // Group by first target user (for digest emails)
        return `user_${notification.targetUsers?.[0] || 'all'}`

      case 'ticket':
        return `ticket_${notification.ticketId || 'general'}`

      case 'type':
        return `type_${notification.type}`

      case 'priority':
        return `priority_${notification.priority}`

      case 'custom':
        if (config.customGrouper) {
          return config.customGrouper(notification)
        }
        return 'default'

      default:
        return 'default'
    }
  }

  private findExistingBatch(batchKey: string, groupKey: string): NotificationBatch | null {
    for (const batch of this.activeBatches.values()) {
      if (batch.metadata?.batchKey === batchKey && batch.metadata?.groupKey === groupKey) {
        return batch
      }
    }
    return null
  }

  private scheduleBatchExecution(batch: NotificationBatch) {
    const timeUntilExecution = batch.scheduledAt.getTime() - Date.now()

    if (timeUntilExecution <= 0) {
      // Execute immediately
      this.executeBatch(batch.id)
      return
    }

    // Schedule execution
    const timer = setTimeout(() => {
      this.executeBatch(batch.id)
    }, timeUntilExecution)

    this.batchTimers.set(batch.id, timer)
  }

  private async executeBatch(batchId: string) {
    const batch = this.activeBatches.get(batchId)
    if (!batch) {
      logger.warn(`Batch ${batchId} not found for execution`)
      return
    }

    try {
      logger.info(`Executing batch ${batchId} with ${batch.notifications.length} notifications`)

      // Create combined notification for batch
      const combinedNotification = this.createCombinedNotification(batch)

      // Mark batch as ready for delivery
      batch.metadata = { ...batch.metadata, status: 'ready', executedAt: new Date() }

      // Update database
      this.updateBatchStatus(batchId, 'ready')

      // Cleanup
      this.activeBatches.delete(batchId)
      const timer = this.batchTimers.get(batchId)
      if (timer) {
        clearTimeout(timer)
        this.batchTimers.delete(batchId)
      }

      return combinedNotification
    } catch (error) {
      logger.error(`Error executing batch ${batchId}:`, error)
      this.updateBatchStatus(batchId, 'failed')
    }
  }

  private createCombinedNotification(batch: NotificationBatch): NotificationPayload {
    const notifications = batch.notifications
    const config = batch.config

    // Group notifications by type for better organization
    const notificationsByType = new Map<string, NotificationPayload[]>()
    for (const notification of notifications) {
      const type = notification.type
      if (!notificationsByType.has(type)) {
        notificationsByType.set(type, [])
      }
      notificationsByType.get(type)!.push(notification)
    }

    // Create combined title and message
    const title = this.createBatchTitle(batch, notificationsByType)
    const message = this.createBatchMessage(batch, notificationsByType)

    // Determine priority (highest priority in batch)
    const priority = this.determineBatchPriority(notifications)

    // Create combined notification
    const combinedNotification: NotificationPayload = {
      id: `batch_${batch.id}`,
      type: 'batch_notification',
      title,
      message,
      priority,
      targetUsers: batch.targetUsers,
      data: {
        batchId: batch.id,
        batchType: config.batchKey,
        notificationCount: notifications.length,
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          priority: n.priority,
          ticketId: n.ticketId,
          timestamp: n.metadata?.timestamp || new Date().toISOString()
        })),
        groupedByType: Object.fromEntries(
          Array.from(notificationsByType.entries()).map(([type, notifications]) => [
            type,
            {
              count: notifications.length,
              items: notifications.map(n => ({
                id: n.id,
                title: n.title,
                message: n.message,
                ticketId: n.ticketId
              }))
            }
          ])
        )
      },
      metadata: {
        ...batch.metadata,
        isBatch: true,
        originalNotifications: notifications.length
      },
      channels: ['email', 'socket'], // Batched notifications typically go via email
      batchable: false // Don't batch the batch itself
    }

    return combinedNotification
  }

  private createBatchTitle(batch: NotificationBatch, notificationsByType: Map<string, NotificationPayload[]>): string {
    const totalCount = batch.notifications.length
    const typeCount = notificationsByType.size

    if (totalCount === 1) {
      return batch.notifications[0].title
    }

    const config = batch.config

    switch (config.batchKey) {
      case 'digest_email':
        return `Resumo de Notificações - ${totalCount} atualizações`

      case 'ticket_updates':
        const ticketId = batch.notifications[0].ticketId
        return `Atualizações do Ticket #${ticketId} - ${totalCount} itens`

      case 'sla_warnings':
        return `Avisos de SLA - ${totalCount} tickets próximos do vencimento`

      case 'system_alerts':
        return `Alertas do Sistema - ${totalCount} notificações`

      case 'comment_notifications':
        const commentTicketId = batch.notifications[0].ticketId
        return `Novos Comentários - Ticket #${commentTicketId}`

      case 'status_updates':
        return `Atualizações de Status - ${totalCount} mudanças`

      default:
        if (typeCount === 1) {
          const type = Array.from(notificationsByType.keys())[0]
          return `${this.getTypeDisplayName(type)} - ${totalCount} notificações`
        }
        return `${totalCount} Notificações - ${typeCount} tipos`
    }
  }

  private createBatchMessage(batch: NotificationBatch, notificationsByType: Map<string, NotificationPayload[]>): string {
    const notifications = batch.notifications
    const config = batch.config

    let message = ''

    if (config.batchKey === 'digest_email') {
      message = 'Aqui está um resumo das suas notificações recentes:\n\n'

      for (const [type, typeNotifications] of notificationsByType.entries()) {
        message += `${this.getTypeDisplayName(type)} (${typeNotifications.length}):\n`
        for (const notification of typeNotifications.slice(0, 5)) { // Show max 5 per type
          message += `  • ${notification.title}\n`
        }
        if (typeNotifications.length > 5) {
          message += `  • ... e mais ${typeNotifications.length - 5} notificações\n`
        }
        message += '\n'
      }
    } else {
      // For specific batch types, create more targeted messages
      message = this.createTargetedBatchMessage(batch, notificationsByType)
    }

    return message.trim()
  }

  private createTargetedBatchMessage(batch: NotificationBatch, notificationsByType: Map<string, NotificationPayload[]>): string {
    const config = batch.config
    const notifications = batch.notifications

    switch (config.batchKey) {
      case 'ticket_updates':
        return notifications.map(n => `• ${n.message}`).join('\n')

      case 'sla_warnings':
        return `Os seguintes tickets estão próximos do vencimento do SLA:\n\n` +
               notifications.map(n => `• Ticket #${n.ticketId}: ${n.message}`).join('\n')

      case 'system_alerts':
        return notifications.map(n => `• ${n.title}: ${n.message}`).join('\n')

      case 'comment_notifications':
        return `Novos comentários foram adicionados:\n\n` +
               notifications.map(n => `• ${n.message}`).join('\n')

      case 'status_updates':
        return notifications.map(n => `• ${n.message}`).join('\n')

      default:
        return notifications.map(n => `• ${n.title}: ${n.message}`).join('\n')
    }
  }

  private determineBatchPriority(notifications: NotificationPayload[]): 'low' | 'medium' | 'high' | 'critical' {
    const priorities = notifications.map(n => n.priority)

    if (priorities.includes('critical')) return 'critical'
    if (priorities.includes('high')) return 'high'
    if (priorities.includes('medium')) return 'medium'
    return 'low'
  }

  private getTypeDisplayName(type: string): string {
    const typeNames: Record<string, string> = {
      ticket_assigned: 'Tickets Atribuídos',
      ticket_updated: 'Atualizações de Tickets',
      ticket_resolved: 'Tickets Resolvidos',
      ticket_closed: 'Tickets Fechados',
      comment_added: 'Novos Comentários',
      comment_internal: 'Comentários Internos',
      sla_warning: 'Avisos de SLA',
      sla_breach: 'Violações de SLA',
      system_alert: 'Alertas do Sistema',
      status_changed: 'Mudanças de Status',
      priority_changed: 'Mudanças de Prioridade',
      escalation: 'Escalações'
    }

    return typeNames[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Database operations
  private persistBatch(batch: NotificationBatch) {
    try {
      this.db.prepare(`
        INSERT INTO notification_batches (
          id, batch_key, notifications, target_users, created_at, scheduled_at,
          status, config, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.id,
        batch.config.batchKey,
        JSON.stringify(batch.notifications),
        JSON.stringify(batch.targetUsers),
        batch.createdAt.toISOString(),
        batch.scheduledAt.toISOString(),
        'pending',
        JSON.stringify(batch.config),
        JSON.stringify(batch.metadata)
      )
    } catch (error) {
      logger.error('Error persisting batch', error)
    }
  }

  private updatePersistedBatch(batch: NotificationBatch) {
    try {
      this.db.prepare(`
        UPDATE notification_batches
        SET notifications = ?, target_users = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        JSON.stringify(batch.notifications),
        JSON.stringify(batch.targetUsers),
        JSON.stringify(batch.metadata),
        batch.id
      )
    } catch (error) {
      logger.error('Error updating persisted batch', error)
    }
  }

  private updateBatchStatus(batchId: string, status: string) {
    try {
      this.db.prepare(`
        UPDATE notification_batches
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, batchId)
    } catch (error) {
      logger.error('Error updating batch status', error)
    }
  }

  // Public methods for batch management
  public getReadyBatches(): Array<{ notification: NotificationPayload; targetUsers: number[] }> {
    try {
      const readyBatches = this.db.prepare(`
        SELECT * FROM notification_batches
        WHERE status = 'ready'
        ORDER BY created_at ASC
        LIMIT 50
      `).all() as any[]

      const results: Array<{ notification: NotificationPayload; targetUsers: number[] }> = []

      for (const batchData of readyBatches) {
        const batch: NotificationBatch = {
          id: batchData.id,
          notifications: JSON.parse(batchData.notifications),
          targetUsers: JSON.parse(batchData.target_users),
          createdAt: new Date(batchData.created_at),
          scheduledAt: new Date(batchData.scheduled_at),
          config: JSON.parse(batchData.config),
          metadata: batchData.metadata ? JSON.parse(batchData.metadata) : undefined
        }

        const combinedNotification = this.createCombinedNotification(batch)

        results.push({
          notification: combinedNotification,
          targetUsers: batch.targetUsers
        })

        // Mark as processed
        this.updateBatchStatus(batch.id, 'processed')
      }

      return results
    } catch (error) {
      logger.error('Error getting ready batches', error)
      return []
    }
  }

  public forceBatchExecution(batchId: string): void {
    const batch = this.activeBatches.get(batchId)
    if (batch) {
      // Cancel timer and execute immediately
      const timer = this.batchTimers.get(batchId)
      if (timer) {
        clearTimeout(timer)
        this.batchTimers.delete(batchId)
      }
      this.executeBatch(batchId)
    }
  }

  public getBatchStatus(batchId: string): any {
    const activeBatch = this.activeBatches.get(batchId)
    if (activeBatch) {
      return {
        id: batchId,
        status: 'pending',
        notificationCount: activeBatch.notifications.length,
        targetUserCount: activeBatch.targetUsers.length,
        scheduledAt: activeBatch.scheduledAt,
        createdAt: activeBatch.createdAt
      }
    }

    // Check database for completed batches
    try {
      const batch = this.db.prepare(`
        SELECT * FROM notification_batches WHERE id = ?
      `).get(batchId) as any

      if (batch) {
        return {
          id: batchId,
          status: batch.status,
          notificationCount: JSON.parse(batch.notifications).length,
          targetUserCount: JSON.parse(batch.target_users).length,
          scheduledAt: new Date(batch.scheduled_at),
          createdAt: new Date(batch.created_at),
          updatedAt: batch.updated_at ? new Date(batch.updated_at) : undefined
        }
      }
    } catch (error) {
      logger.error('Error getting batch status', error)
    }

    return null
  }

  public updateBatchConfig(batchKey: string, config: Partial<BatchConfig>): void {
    const existingConfig = this.batchConfigs.get(batchKey)
    if (existingConfig) {
      const updatedConfig = { ...existingConfig, ...config }
      this.batchConfigs.set(batchKey, updatedConfig)

      // Save to database
      try {
        this.db.prepare(`
          INSERT OR REPLACE INTO batch_configurations (
            batch_key, max_batch_size, max_wait_time, group_by, is_active, updated_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          batchKey,
          updatedConfig.maxBatchSize,
          updatedConfig.maxWaitTime,
          updatedConfig.groupBy,
          1
        )
      } catch (error) {
        logger.error('Error saving batch configuration', error)
      }
    }
  }

  public getBatchConfigs(): Map<string, BatchConfig> {
    return new Map(this.batchConfigs)
  }

  public getBatchStatistics(): any {
    try {
      const stats = this.db.prepare(`
        SELECT
          batch_key,
          status,
          COUNT(*) as count,
          AVG(json_array_length(notifications)) as avg_notifications_per_batch,
          MIN(created_at) as oldest_batch,
          MAX(created_at) as newest_batch
        FROM notification_batches
        WHERE created_at > datetime('now', '-7 days')
        GROUP BY batch_key, status
        ORDER BY batch_key, status
      `).all()

      const activeBatchStats = {
        activeBatches: this.activeBatches.size,
        scheduledTimers: this.batchTimers.size,
        pendingNotifications: Array.from(this.activeBatches.values())
          .reduce((sum, batch) => sum + batch.notifications.length, 0)
      }

      return {
        databaseStats: stats,
        runtimeStats: activeBatchStats
      }
    } catch (error) {
      logger.error('Error getting batch statistics', error)
      return null
    }
  }

  private processReadyBatches() {
    // Process any batches that are ready but haven't been executed
    for (const [batchId, batch] of this.activeBatches.entries()) {
      if (batch.scheduledAt.getTime() <= Date.now()) {
        this.executeBatch(batchId)
      }
    }
  }

  private cleanupOldBatches() {
    // Cleanup old database records
    try {
      const deleted = this.db.prepare(`
        DELETE FROM notification_batches
        WHERE status IN ('processed', 'failed')
        AND created_at < datetime('now', '-30 days')
      `).run()

      if (deleted.changes > 0) {
        logger.info(`Cleaned up ${deleted.changes} old notification batches`)
      }
    } catch (error) {
      logger.error('Error cleaning up old batches', error)
    }

    // Cleanup active batches that have been processed but still in memory
    for (const [batchId, batch] of this.activeBatches.entries()) {
      if (batch.metadata?.status === 'ready' || batch.metadata?.status === 'processed') {
        this.activeBatches.delete(batchId)
        const timer = this.batchTimers.get(batchId)
        if (timer) {
          clearTimeout(timer)
          this.batchTimers.delete(batchId)
        }
      }
    }
  }

  // Smart batching features
  public shouldBatch(notification: NotificationPayload): boolean {
    // Never batch critical notifications
    if (notification.priority === 'critical') {
      return false
    }

    // Check if notification explicitly requests not to be batched
    if (notification.batchable === false) {
      return false
    }

    // Check notification type
    const noBatchTypes = ['password_reset', 'login_alert', 'security_alert', 'immediate_response']
    if (noBatchTypes.includes(notification.type)) {
      return false
    }

    // Check user preferences
    // This would be implemented based on user notification preferences

    return true
  }

  public getOptimalBatchSize(batchKey: string, currentHour: number): number {
    const config = this.batchConfigs.get(batchKey)
    if (!config) return 10

    // Adjust batch size based on time of day
    if (currentHour >= 9 && currentHour <= 17) {
      // Business hours - smaller batches for faster delivery
      return Math.floor(config.maxBatchSize * 0.7)
    } else {
      // Off hours - larger batches for efficiency
      return config.maxBatchSize
    }
  }

  public getOptimalWaitTime(batchKey: string, priority: string): number {
    const config = this.batchConfigs.get(batchKey)
    if (!config) return 5 * 60 * 1000

    // Adjust wait time based on priority
    switch (priority) {
      case 'high':
        return Math.floor(config.maxWaitTime * 0.5)
      case 'medium':
        return Math.floor(config.maxWaitTime * 0.75)
      case 'low':
      default:
        return config.maxWaitTime
    }
  }
}