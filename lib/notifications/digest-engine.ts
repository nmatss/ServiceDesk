import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import { NotificationPayload } from './realtime-engine'
import { QuietHoursManager } from './quiet-hours'
import logger from '../monitoring/structured-logger';

export interface DigestConfig {
  userId: number
  enabled: boolean
  frequency: 'hourly' | 'daily' | 'weekly' | 'custom'
  customCron?: string // For custom frequencies
  deliveryTime: string // HH:mm format
  timezone: string
  channels: string[]
  categories: {
    [category: string]: {
      enabled: boolean
      priority: 'all' | 'high' | 'critical'
      maxItems?: number
    }
  }
  groupBy: 'category' | 'ticket' | 'priority' | 'time'
  template: 'summary' | 'detailed' | 'executive'
  includeRead: boolean
  minNotifications: number // Minimum notifications to send digest
  maxNotifications: number // Maximum notifications per digest
}

export interface DigestSchedule {
  userId: number
  nextDelivery: Date
  lastDelivery?: Date
  frequency: string
  enabled: boolean
}

export interface DigestContent {
  id: string
  userId: number
  period: {
    start: Date
    end: Date
  }
  notifications: NotificationPayload[]
  summary: {
    totalNotifications: number
    byCategory: Record<string, number>
    byPriority: Record<string, number>
    byTicket: Record<number, number>
    criticalCount: number
    unreadCount: number
  }
  groupedContent: any
  template: string
  deliveryChannels: string[]
  generatedAt: Date
}

export class DigestEngine {
  private userConfigs = new Map<number, DigestConfig>()
  private schedules = new Map<number, DigestSchedule>()
  private quietHoursManager: QuietHoursManager

  // Default digest configuration
  private readonly DEFAULT_CONFIG: Omit<DigestConfig, 'userId'> = {
    enabled: false,
    frequency: 'daily',
    deliveryTime: '09:00',
    timezone: 'America/Sao_Paulo',
    channels: ['email'],
    categories: {
      ticket_updates: { enabled: true, priority: 'all', maxItems: 10 },
      sla_warnings: { enabled: true, priority: 'all', maxItems: 5 },
      system_alerts: { enabled: true, priority: 'high', maxItems: 5 },
      comments: { enabled: true, priority: 'all', maxItems: 15 },
      escalations: { enabled: true, priority: 'all', maxItems: 3 }
    },
    groupBy: 'category',
    template: 'summary',
    includeRead: false,
    minNotifications: 3,
    maxNotifications: 50
  }

  // Templates for different digest formats
  private readonly TEMPLATES = {
    summary: {
      name: 'Summary',
      description: 'Brief overview with key highlights',
      maxItems: 20
    },
    detailed: {
      name: 'Detailed',
      description: 'Comprehensive list with full details',
      maxItems: 50
    },
    executive: {
      name: 'Executive',
      description: 'High-level overview for management',
      maxItems: 10
    }
  }

  constructor(quietHoursManager: QuietHoursManager) {
    this.quietHoursManager = quietHoursManager
    this.initAsync()
    this.setupDigestScheduling()
  }

  private async initAsync() {
    await this.loadDigestConfigs()
  }

  private async loadDigestConfigs() {
    try {
      const configs = await executeQuery<{ user_id: number; digest_config: string }>(`
        SELECT user_id, digest_config FROM users
        WHERE digest_config IS NOT NULL
      `, [])

      for (const config of configs) {
        try {
          const digestConfig = JSON.parse(config.digest_config)
          this.userConfigs.set(config.user_id, this.normalizeConfig(digestConfig, config.user_id))
        } catch (error) {
          logger.error(`Error parsing digest config for user ${config.user_id}:`, error)
        }
      }

      logger.info(`Loaded digest configs for ${configs.length} users`)
    } catch (error) {
      logger.error('Error loading digest configurations', error)
    }
  }

  private normalizeConfig(config: any, userId: number): DigestConfig {
    return {
      userId,
      enabled: config.enabled ?? this.DEFAULT_CONFIG.enabled,
      frequency: config.frequency ?? this.DEFAULT_CONFIG.frequency,
      customCron: config.customCron,
      deliveryTime: config.deliveryTime ?? this.DEFAULT_CONFIG.deliveryTime,
      timezone: config.timezone ?? this.DEFAULT_CONFIG.timezone,
      channels: config.channels ?? this.DEFAULT_CONFIG.channels,
      categories: { ...this.DEFAULT_CONFIG.categories, ...(config.categories || {}) },
      groupBy: config.groupBy ?? this.DEFAULT_CONFIG.groupBy,
      template: config.template ?? this.DEFAULT_CONFIG.template,
      includeRead: config.includeRead ?? this.DEFAULT_CONFIG.includeRead,
      minNotifications: config.minNotifications ?? this.DEFAULT_CONFIG.minNotifications,
      maxNotifications: config.maxNotifications ?? this.DEFAULT_CONFIG.maxNotifications
    }
  }

  public getUserConfig(userId: number): DigestConfig {
    let config = this.userConfigs.get(userId)
    if (!config) {
      config = { ...this.DEFAULT_CONFIG, userId }
      this.userConfigs.set(userId, config)
    }
    return config
  }

  public async updateUserConfig(userId: number, updates: Partial<DigestConfig>): Promise<void> {
    const currentConfig = this.getUserConfig(userId)
    const newConfig = { ...currentConfig, ...updates, userId }

    this.userConfigs.set(userId, newConfig)

    // Update schedule
    this.calculateNextDelivery(userId)

    // Save to database
    try {
      await executeRun(`
        UPDATE users
        SET digest_config = ?
        WHERE id = ?
      `, [JSON.stringify(newConfig), userId])

      logger.info(`Updated digest config for user ${userId}`)
    } catch (error) {
      logger.error('Error saving digest config', error)
    }
  }

  public async generateDigest(userId: number, endTime?: Date): Promise<DigestContent | null> {
    const config = this.getUserConfig(userId)
    if (!config.enabled) {
      return null
    }

    const end = endTime || new Date()
    const start = await this.calculatePeriodStart(config, end)

    // Get notifications for the period
    const notifications = await this.getNotificationsForPeriod(userId, start, end, config)

    if (notifications.length < config.minNotifications) {
      logger.info(`Insufficient notifications for digest (${notifications.length} < ${config.minNotifications})`)
      return null
    }

    // Limit notifications if too many
    const limitedNotifications = notifications.slice(0, config.maxNotifications)

    // Generate summary
    const summary = this.generateSummary(limitedNotifications)

    // Group content according to user preference
    const groupedContent = this.groupNotifications(limitedNotifications, config.groupBy)

    const digest: DigestContent = {
      id: `digest_${userId}_${Date.now()}`,
      userId,
      period: { start, end },
      notifications: limitedNotifications,
      summary,
      groupedContent,
      template: config.template,
      deliveryChannels: config.channels,
      generatedAt: new Date()
    }

    // Save digest to database
    await this.saveDigest(digest)

    return digest
  }

  private async calculatePeriodStart(config: DigestConfig, endTime: Date): Promise<Date> {
    const start = new Date(endTime)

    switch (config.frequency) {
      case 'hourly':
        start.setHours(start.getHours() - 1)
        break

      case 'daily':
        start.setDate(start.getDate() - 1)
        break

      case 'weekly':
        start.setDate(start.getDate() - 7)
        break

      case 'custom':
        // For custom frequencies, use the last delivery time or 24 hours ago
        const lastDelivery = await this.getLastDeliveryTime(config.userId)
        if (lastDelivery) {
          return lastDelivery
        } else {
          start.setDate(start.getDate() - 1)
        }
        break
    }

    return start
  }

  private async getNotificationsForPeriod(
    userId: number,
    start: Date,
    end: Date,
    config: DigestConfig
  ): Promise<NotificationPayload[]> {
    try {
      let whereClause = `
        WHERE user_id = ? AND created_at BETWEEN ? AND ?
      `
      const params: any[] = [userId, start.toISOString(), end.toISOString()]

      if (!config.includeRead) {
        whereClause += ' AND is_read = 0'
      }

      const notifications = await executeQuery<any>(`
        SELECT * FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
      `, params)

      // Filter and transform notifications
      return notifications
        .filter(notification => this.shouldIncludeInDigest(notification, config))
        .map(notification => this.transformNotification(notification))
    } catch (error) {
      logger.error('Error getting notifications for digest', error)
      return []
    }
  }

  private shouldIncludeInDigest(notification: any, config: DigestConfig): boolean {
    const category = this.getNotificationCategory(notification.type)
    const categoryConfig = config.categories[category]

    if (!categoryConfig || !categoryConfig.enabled) {
      return false
    }

    // Check priority filter
    if (categoryConfig.priority === 'high' && !['high', 'critical'].includes(notification.priority || 'medium')) {
      return false
    }

    if (categoryConfig.priority === 'critical' && notification.priority !== 'critical') {
      return false
    }

    return true
  }

  private transformNotification(dbNotification: any): NotificationPayload {
    return {
      id: dbNotification.id,
      type: dbNotification.type,
      title: dbNotification.title,
      message: dbNotification.message,
      priority: dbNotification.priority || 'medium',
      ticketId: dbNotification.ticket_id,
      authorId: dbNotification.author_id,
      data: dbNotification.data ? JSON.parse(dbNotification.data) : undefined,
      metadata: {
        timestamp: dbNotification.created_at,
        isRead: dbNotification.is_read,
        readAt: dbNotification.read_at
      }
    }
  }

  private generateSummary(notifications: NotificationPayload[]): DigestContent['summary'] {
    const summary = {
      totalNotifications: notifications.length,
      byCategory: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byTicket: {} as Record<number, number>,
      criticalCount: 0,
      unreadCount: 0
    }

    for (const notification of notifications) {
      // Count by category
      const category = this.getNotificationCategory(notification.type)
      summary.byCategory[category] = (summary.byCategory[category] || 0) + 1

      // Count by priority
      summary.byPriority[notification.priority] = (summary.byPriority[notification.priority] || 0) + 1

      // Count by ticket
      if (notification.ticketId) {
        summary.byTicket[notification.ticketId] = (summary.byTicket[notification.ticketId] || 0) + 1
      }

      // Count critical
      if (notification.priority === 'critical') {
        summary.criticalCount++
      }

      // Count unread
      if (!notification.metadata?.isRead) {
        summary.unreadCount++
      }
    }

    return summary
  }

  private groupNotifications(notifications: NotificationPayload[], groupBy: string): any {
    switch (groupBy) {
      case 'category':
        return this.groupByCategory(notifications)

      case 'ticket':
        return this.groupByTicket(notifications)

      case 'priority':
        return this.groupByPriority(notifications)

      case 'time':
        return this.groupByTime(notifications)

      default:
        return { all: notifications }
    }
  }

  private groupByCategory(notifications: NotificationPayload[]): Record<string, any> {
    const groups: Record<string, any> = {}

    for (const notification of notifications) {
      const category = this.getNotificationCategory(notification.type)
      if (!groups[category]) {
        groups[category] = {
          name: this.getCategoryDisplayName(category),
          count: 0,
          items: [],
          priorities: { low: 0, medium: 0, high: 0, critical: 0 }
        }
      }

      groups[category].count++
      groups[category].items.push(notification)
      groups[category].priorities[notification.priority]++
    }

    // Sort items within each category by priority and time
    for (const group of Object.values(groups)) {
      (group as any).items.sort((a: NotificationPayload, b: NotificationPayload) => {
        const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 }
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder]
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder]

        if (aPriority !== bPriority) {
          return bPriority - aPriority
        }

        const aTime = new Date(a.metadata?.timestamp || 0).getTime()
        const bTime = new Date(b.metadata?.timestamp || 0).getTime()
        return bTime - aTime
      })
    }

    return groups
  }

  private groupByTicket(notifications: NotificationPayload[]): Record<string, any> {
    const groups: Record<string, any> = {}
    const noTicket: NotificationPayload[] = []

    for (const notification of notifications) {
      if (notification.ticketId) {
        const ticketKey = `ticket_${notification.ticketId}`
        if (!groups[ticketKey]) {
          groups[ticketKey] = {
            ticketId: notification.ticketId,
            count: 0,
            items: [],
            latestUpdate: new Date(0)
          }
        }

        groups[ticketKey].count++
        groups[ticketKey].items.push(notification)

        const notificationTime = new Date(notification.metadata?.timestamp || 0)
        if (notificationTime > groups[ticketKey].latestUpdate) {
          groups[ticketKey].latestUpdate = notificationTime
        }
      } else {
        noTicket.push(notification)
      }
    }

    if (noTicket.length > 0) {
      groups['general'] = {
        name: 'General Notifications',
        count: noTicket.length,
        items: noTicket
      }
    }

    return groups
  }

  private groupByPriority(notifications: NotificationPayload[]): Record<string, any> {
    const groups: Record<string, any> = {
      critical: { name: 'Critical', items: [], count: 0 },
      high: { name: 'High Priority', items: [], count: 0 },
      medium: { name: 'Medium Priority', items: [], count: 0 },
      low: { name: 'Low Priority', items: [], count: 0 }
    }

    for (const notification of notifications) {
      const priority = notification.priority
      groups[priority].items.push(notification)
      groups[priority].count++
    }

    // Remove empty groups
    for (const [key, group] of Object.entries(groups)) {
      if ((group as any).count === 0) {
        delete groups[key]
      }
    }

    return groups
  }

  private groupByTime(notifications: NotificationPayload[]): Record<string, any> {
    const groups: Record<string, any> = {}

    for (const notification of notifications) {
      const timestamp = new Date(notification.metadata?.timestamp || 0)
      const hourKey = `${timestamp.getDate()}_${timestamp.getHours()}`
      const timeLabel = timestamp.toLocaleString('pt-BR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      if (!groups[hourKey]) {
        groups[hourKey] = {
          timeLabel,
          timestamp,
          count: 0,
          items: []
        }
      }

      groups[hourKey].count++
      groups[hourKey].items.push(notification)
    }

    return groups
  }

  private getNotificationCategory(type: string): string {
    const categoryMap: Record<string, string> = {
      ticket_assigned: 'ticket_updates',
      ticket_updated: 'ticket_updates',
      ticket_resolved: 'ticket_updates',
      ticket_closed: 'ticket_updates',
      comment_added: 'comments',
      comment_internal: 'comments',
      sla_warning: 'sla_warnings',
      sla_breach: 'sla_warnings',
      system_alert: 'system_alerts',
      escalation: 'escalations'
    }

    return categoryMap[type] || 'general'
  }

  private getCategoryDisplayName(category: string): string {
    const displayNames: Record<string, string> = {
      ticket_updates: 'Atualizações de Tickets',
      comments: 'Comentários',
      sla_warnings: 'Avisos de SLA',
      system_alerts: 'Alertas do Sistema',
      escalations: 'Escalações',
      general: 'Geral'
    }

    return displayNames[category] || category
  }

  // Scheduling
  private setupDigestScheduling() {
    // Check for scheduled digests every minute
    setInterval(() => {
      this.processScheduledDigests()
    }, 60 * 1000)

    // Calculate all schedules at startup
    this.calculateAllSchedules()
  }

  private calculateAllSchedules() {
    for (const userId of this.userConfigs.keys()) {
      this.calculateNextDelivery(userId)
    }
  }

  private calculateNextDelivery(userId: number): void {
    const config = this.getUserConfig(userId)
    if (!config.enabled) {
      this.schedules.delete(userId)
      return
    }

    const now = new Date()
    const nextDelivery = this.calculateNextDeliveryTime(config, now)

    const schedule: DigestSchedule = {
      userId,
      nextDelivery,
      lastDelivery: undefined, // Will be loaded async
      frequency: config.frequency,
      enabled: config.enabled
    }

    this.schedules.set(userId, schedule)

    // Load last delivery time async
    this.getLastDeliveryTime(userId).then(lastDelivery => {
      const s = this.schedules.get(userId)
      if (s) {
        s.lastDelivery = lastDelivery
      }
    })
  }

  private calculateNextDeliveryTime(config: DigestConfig, currentTime: Date): Date {
    const userTime = this.convertToUserTimezone(currentTime, config.timezone)
    const timeParts = config.deliveryTime.split(':').map(Number);
    const deliveryHour = timeParts[0] ?? 9;
    const deliveryMinute = timeParts[1] ?? 0;

    const nextDelivery = new Date(userTime)
    nextDelivery.setHours(deliveryHour, deliveryMinute, 0, 0)

    switch (config.frequency) {
      case 'hourly':
        if (nextDelivery <= userTime) {
          nextDelivery.setHours(nextDelivery.getHours() + 1)
        }
        break

      case 'daily':
        if (nextDelivery <= userTime) {
          nextDelivery.setDate(nextDelivery.getDate() + 1)
        }
        break

      case 'weekly':
        if (nextDelivery <= userTime) {
          nextDelivery.setDate(nextDelivery.getDate() + 7)
        }
        break

      case 'custom':
        // For custom schedules, implement cron-like parsing
        if (config.customCron) {
          // Simplified: assume daily for now
          if (nextDelivery <= userTime) {
            nextDelivery.setDate(nextDelivery.getDate() + 1)
          }
        }
        break
    }

    // Convert back to server timezone
    return this.convertFromUserTimezone(nextDelivery, config.timezone)
  }

  private async processScheduledDigests(): Promise<void> {
    const now = new Date()

    for (const [userId, schedule] of this.schedules.entries()) {
      if (schedule.enabled && schedule.nextDelivery <= now) {
        try {
          await this.processDigestForUser(userId)
          this.calculateNextDelivery(userId) // Reschedule
        } catch (error) {
          logger.error(`Error processing digest for user ${userId}:`, error)
        }
      }
    }
  }

  private async processDigestForUser(userId: number): Promise<void> {
    const config = this.getUserConfig(userId)

    // Check quiet hours
    if (this.quietHoursManager.isInQuietHours(userId)) {
      const allowedChannels = this.quietHoursManager.filterNotificationChannels(
        { priority: 'low', channels: config.channels } as NotificationPayload,
        userId
      )

      if (allowedChannels.length === 0) {
        logger.info(`Skipping digest for user ${userId} due to quiet hours`)
        return
      }

      // Update channels for delivery
      config.channels = allowedChannels
    }

    // Generate digest
    const digest = await this.generateDigest(userId)
    if (!digest) {
      logger.info(`No digest generated for user ${userId} (insufficient notifications)`)
      return
    }

    // Deliver digest
    await this.deliverDigest(digest)

    // Update last delivery time
    this.updateLastDeliveryTime(userId, new Date())

    logger.info(`Delivered digest ${digest.id} to user ${userId}`)
  }

  private async deliverDigest(digest: DigestContent): Promise<void> {
    // Create notification payload for the digest
    const digestNotification: NotificationPayload = {
      id: digest.id,
      type: 'digest',
      title: this.generateDigestTitle(digest),
      message: this.generateDigestPreview(digest),
      priority: 'low',
      targetUsers: [digest.userId],
      channels: digest.deliveryChannels,
      data: {
        digestId: digest.id,
        period: digest.period,
        summary: digest.summary,
        content: digest.groupedContent,
        template: digest.template
      },
      metadata: {
        isDigest: true,
        generatedAt: digest.generatedAt
      },
      batchable: false
    }

    // This would integrate with the main notification engine
    // For now, we'll save it as a special notification
    await this.saveDigestNotification(digestNotification)
  }

  private generateDigestTitle(digest: DigestContent): string {
    const { summary, period } = digest
    const startDate = period.start.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
    const endDate = period.end.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })

    if (summary.totalNotifications === 0) {
      return `Resumo: Nenhuma notificação (${startDate} - ${endDate})`
    }

    if (summary.criticalCount > 0) {
      return `Resumo: ${summary.totalNotifications} notificações (${summary.criticalCount} críticas)`
    }

    return `Resumo: ${summary.totalNotifications} notificações (${startDate} - ${endDate})`
  }

  private generateDigestPreview(digest: DigestContent): string {
    const { summary } = digest

    if (summary.totalNotifications === 0) {
      return 'Nenhuma notificação no período selecionado.'
    }

    const parts: string[] = []

    if (summary.criticalCount > 0) {
      parts.push(`${summary.criticalCount} críticas`)
    }

    const nonCritical = summary.totalNotifications - summary.criticalCount
    if (nonCritical > 0) {
      parts.push(`${nonCritical} outras`)
    }

    if (summary.unreadCount > 0) {
      parts.push(`${summary.unreadCount} não lidas`)
    }

    return `Você tem ${summary.totalNotifications} notificações: ${parts.join(', ')}.`
  }

  // Database operations
  private async saveDigest(digest: DigestContent): Promise<void> {
    try {
      await executeRun(`
        INSERT INTO notification_digests (
          id, user_id, period_start, period_end, notifications_count,
          summary, grouped_content, template, delivery_channels, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        digest.id,
        digest.userId,
        digest.period.start.toISOString(),
        digest.period.end.toISOString(),
        digest.notifications.length,
        JSON.stringify(digest.summary),
        JSON.stringify(digest.groupedContent),
        digest.template,
        JSON.stringify(digest.deliveryChannels),
        digest.generatedAt.toISOString()
      ])
    } catch (error) {
      logger.error('Error saving digest', error)
    }
  }

  private async saveDigestNotification(notification: NotificationPayload): Promise<void> {
    try {
      await executeRun(`
        INSERT INTO notifications (
          id, user_id, type, title, message, priority, data, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        notification.id,
        notification.targetUsers![0],
        notification.type,
        notification.title,
        notification.message,
        notification.priority,
        JSON.stringify(notification.data),
        JSON.stringify(notification.metadata),
        new Date().toISOString()
      ])
    } catch (error) {
      logger.error('Error saving digest notification', error)
    }
  }

  private async getLastDeliveryTime(userId: number): Promise<Date | undefined> {
    try {
      const result = await executeQueryOne<{ last_delivery: string | null }>(`
        SELECT MAX(generated_at) as last_delivery
        FROM notification_digests
        WHERE user_id = ?
      `, [userId])

      return result?.last_delivery ? new Date(result.last_delivery) : undefined
    } catch (error) {
      logger.error('Error getting last delivery time', error)
      return undefined
    }
  }

  private updateLastDeliveryTime(userId: number, deliveryTime: Date): void {
    const schedule = this.schedules.get(userId)
    if (schedule) {
      schedule.lastDelivery = deliveryTime
      this.schedules.set(userId, schedule)
    }
  }

  // Utility methods
  private convertToUserTimezone(date: Date, timezone: string): Date {
    try {
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    } catch (error) {
      logger.error(`Invalid timezone: ${timezone}`, error)
      return date
    }
  }

  private convertFromUserTimezone(date: Date, timezone: string): Date {
    try {
      const userTime = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
      const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
      const offset = userTime.getTime() - utcTime.getTime()
      return new Date(date.getTime() - offset)
    } catch (error) {
      logger.error(`Error converting from timezone: ${timezone}`, error)
      return date
    }
  }

  // Public API methods
  public async getDigestHistory(userId: number, limit: number = 10): Promise<DigestContent[]> {
    try {
      const digests = await executeQuery<any>(`
        SELECT * FROM notification_digests
        WHERE user_id = ?
        ORDER BY generated_at DESC
        LIMIT ?
      `, [userId, limit])

      return digests.map(digest => ({
        id: digest.id,
        userId: digest.user_id,
        period: {
          start: new Date(digest.period_start),
          end: new Date(digest.period_end)
        },
        notifications: [], // Not loaded for history
        summary: JSON.parse(digest.summary),
        groupedContent: JSON.parse(digest.grouped_content),
        template: digest.template,
        deliveryChannels: JSON.parse(digest.delivery_channels),
        generatedAt: new Date(digest.generated_at)
      }))
    } catch (error) {
      logger.error('Error getting digest history', error)
      return []
    }
  }

  public getDigestSchedules(): DigestSchedule[] {
    return Array.from(this.schedules.values())
  }

  public async forceDigestGeneration(userId: number): Promise<DigestContent | null> {
    return this.generateDigest(userId)
  }

  public async previewDigest(userId: number, config?: Partial<DigestConfig>): Promise<DigestContent | null> {
    // Temporarily apply preview config
    const originalConfig = this.getUserConfig(userId)
    if (config) {
      const previewConfig = { ...originalConfig, ...config }
      this.userConfigs.set(userId, previewConfig)
    }

    const digest = await this.generateDigest(userId)

    // Restore original config
    this.userConfigs.set(userId, originalConfig)

    return digest
  }

  public getDigestStats(): any {
    return {
      totalConfiguredUsers: this.userConfigs.size,
      enabledUsers: Array.from(this.userConfigs.values()).filter(c => c.enabled).length,
      schedules: this.schedules.size,
      templates: Object.keys(this.TEMPLATES),
      supportedFrequencies: ['hourly', 'daily', 'weekly', 'custom']
    }
  }
}
