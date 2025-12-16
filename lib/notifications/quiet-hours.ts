import { getDb } from '@/lib/db'
import { NotificationPayload } from './realtime-engine'
import logger from '../monitoring/structured-logger';

export interface QuietHoursConfig {
  userId: number
  enabled: boolean
  startTime: string // HH:mm format
  endTime: string   // HH:mm format
  timezone: string
  days: number[]    // 0-6, Sunday = 0
  exceptions: QuietHoursException[]
  emergencyOverride: boolean // Allow critical notifications through
  channels: {
    [channel: string]: {
      respectQuietHours: boolean
      allowedPriorities: string[] // priorities that can override quiet hours
    }
  }
}

export interface QuietHoursException {
  id: string
  name: string
  startDate: Date
  endDate: Date
  type: 'allow_all' | 'block_all' | 'custom'
  customRules?: unknown[]
  reason?: string
}

export interface QuietHoursSchedule {
  userId: number
  currentlyInQuietHours: boolean
  nextQuietHoursStart?: Date
  nextQuietHoursEnd?: Date
  timezone: string
  activeExceptions: QuietHoursException[]
  calculatedAt?: number
}

interface DbQuietHoursRow {
  user_id: number
  quiet_hours_config: string
}

interface RawQuietHoursException {
  id: string
  name: string
  startDate: string | Date
  endDate: string | Date
  type: 'allow_all' | 'block_all' | 'custom'
  customRules?: unknown[]
  reason?: string
}

interface QuietHoursReportChannelSettings {
  totalUsers: number
  respectQuietHours: number
  allowedPriorities: Record<string, number>
}

interface QuietHoursReport {
  totalUsers: number
  usersWithQuietHours: number
  currentlyInQuietHours: number
  averageQuietHoursDuration: number
  timezoneDistribution: Record<string, number>
  channelSettings: Record<string, QuietHoursReportChannelSettings>
  upcomingQuietHours: Array<{
    userId: number
    startTime: Date
    endTime?: Date
    timezone: string
  }>
  exceptions: {
    active: number
    total: number
  }
}

export class QuietHoursManager {
  private db = getDb()
  private userConfigs = new Map<number, QuietHoursConfig>()
  private scheduleCache = new Map<number, QuietHoursSchedule>()

  // Default quiet hours configuration
  private readonly DEFAULT_CONFIG: Omit<QuietHoursConfig, 'userId'> = {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'America/Sao_Paulo',
    days: [0, 1, 2, 3, 4, 5, 6], // All days
    exceptions: [],
    emergencyOverride: true,
    channels: {
      socket: { respectQuietHours: false, allowedPriorities: ['critical'] },
      email: { respectQuietHours: true, allowedPriorities: ['critical'] },
      push: { respectQuietHours: true, allowedPriorities: ['critical'] },
      sms: { respectQuietHours: true, allowedPriorities: ['critical', 'high'] },
      slack: { respectQuietHours: true, allowedPriorities: ['critical'] },
      teams: { respectQuietHours: true, allowedPriorities: ['critical'] },
      whatsapp: { respectQuietHours: true, allowedPriorities: ['critical'] }
    }
  }

  constructor() {
    this.loadQuietHoursConfigs()
    this.setupScheduleUpdates()
  }

  private loadQuietHoursConfigs() {
    try {
      const configs = this.db.prepare(`
        SELECT user_id, quiet_hours_config FROM users
        WHERE quiet_hours_config IS NOT NULL
      `).all() as DbQuietHoursRow[]

      for (const config of configs) {
        try {
          const quietHoursConfig = JSON.parse(config.quiet_hours_config) as Partial<QuietHoursConfig>
          this.userConfigs.set(config.user_id, this.normalizeConfig(quietHoursConfig, config.user_id))
        } catch (error) {
          logger.error(`Error parsing quiet hours config for user ${config.user_id}:`, error)
        }
      }

      logger.info(`Loaded quiet hours configs for ${configs.length} users`)
    } catch (error) {
      logger.error('Error loading quiet hours configurations', error)
    }
  }

  private normalizeConfig(config: Partial<QuietHoursConfig>, userId: number): QuietHoursConfig {
    return {
      userId,
      enabled: config.enabled ?? this.DEFAULT_CONFIG.enabled,
      startTime: config.startTime ?? this.DEFAULT_CONFIG.startTime,
      endTime: config.endTime ?? this.DEFAULT_CONFIG.endTime,
      timezone: config.timezone ?? this.DEFAULT_CONFIG.timezone,
      days: config.days ?? this.DEFAULT_CONFIG.days,
      exceptions: (config.exceptions || []).map((exc: RawQuietHoursException): QuietHoursException => ({
        id: exc.id,
        name: exc.name,
        startDate: new Date(exc.startDate),
        endDate: new Date(exc.endDate),
        type: exc.type,
        customRules: exc.customRules,
        reason: exc.reason
      })),
      emergencyOverride: config.emergencyOverride ?? this.DEFAULT_CONFIG.emergencyOverride,
      channels: { ...this.DEFAULT_CONFIG.channels, ...(config.channels || {}) }
    }
  }

  public isInQuietHours(userId: number, currentTime?: Date): boolean {
    const schedule = this.getQuietHoursSchedule(userId, currentTime)
    return schedule.currentlyInQuietHours
  }

  public getQuietHoursSchedule(userId: number, currentTime?: Date): QuietHoursSchedule {
    const now = currentTime || new Date()

    if (this.scheduleCache.has(userId)) {
      const cached = this.scheduleCache.get(userId)!
      // Use cache if it's recent (within 5 minutes)
      if (cached.calculatedAt && Math.abs(now.getTime() - cached.calculatedAt) < 5 * 60 * 1000) {
        return cached
      }
    }

    const config = this.getUserConfig(userId)
    const schedule = this.calculateSchedule(config, now)

    // Add calculation timestamp for cache validation
    schedule.calculatedAt = now.getTime()
    this.scheduleCache.set(userId, schedule)

    return schedule
  }

  private calculateSchedule(config: QuietHoursConfig, currentTime: Date): QuietHoursSchedule {
    if (!config.enabled) {
      return {
        userId: config.userId,
        currentlyInQuietHours: false,
        timezone: config.timezone,
        activeExceptions: []
      }
    }

    // Convert current time to user's timezone
    const userTime = this.convertToUserTimezone(currentTime, config.timezone)
    const currentDay = userTime.getDay()
    const currentTimeMinutes = userTime.getHours() * 60 + userTime.getMinutes()

    // Check if current day is included in quiet hours
    if (!config.days.includes(currentDay)) {
      return {
        userId: config.userId,
        currentlyInQuietHours: false,
        timezone: config.timezone,
        activeExceptions: []
      }
    }

    // Parse start and end times
    const startTimeParts = config.startTime.split(':').map(Number)
    const endTimeParts = config.endTime.split(':').map(Number)
    const startHour = startTimeParts[0] ?? 0
    const startMinute = startTimeParts[1] ?? 0
    const endHour = endTimeParts[0] ?? 0
    const endMinute = endTimeParts[1] ?? 0
    const startTimeMinutes = startHour * 60 + startMinute
    const endTimeMinutes = endHour * 60 + endMinute

    // Check for active exceptions
    const activeExceptions = this.getActiveExceptions(config, currentTime)

    // If there are exceptions, apply them
    if (activeExceptions.length > 0) {
      const allowAllException = activeExceptions.find(exc => exc.type === 'allow_all')
      const blockAllException = activeExceptions.find(exc => exc.type === 'block_all')

      if (allowAllException) {
        return {
          userId: config.userId,
          currentlyInQuietHours: false,
          timezone: config.timezone,
          activeExceptions
        }
      }

      if (blockAllException) {
        return {
          userId: config.userId,
          currentlyInQuietHours: true,
          timezone: config.timezone,
          activeExceptions
        }
      }
    }

    // Calculate if currently in quiet hours
    let currentlyInQuietHours: boolean

    if (startTimeMinutes <= endTimeMinutes) {
      // Same day quiet hours (e.g., 14:00 to 18:00)
      currentlyInQuietHours = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00 next day)
      currentlyInQuietHours = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes
    }

    // Calculate next quiet hours times
    const { nextStart, nextEnd } = this.calculateNextQuietHoursTimes(config, userTime)

    return {
      userId: config.userId,
      currentlyInQuietHours,
      nextQuietHoursStart: this.convertFromUserTimezone(nextStart, config.timezone),
      nextQuietHoursEnd: this.convertFromUserTimezone(nextEnd, config.timezone),
      timezone: config.timezone,
      activeExceptions
    }
  }

  private getActiveExceptions(config: QuietHoursConfig, currentTime: Date): QuietHoursException[] {
    return config.exceptions.filter(exception => {
      return currentTime >= exception.startDate && currentTime <= exception.endDate
    })
  }

  private calculateNextQuietHoursTimes(config: QuietHoursConfig, userTime: Date): { nextStart: Date; nextEnd: Date } {
    const startTimeParts = config.startTime.split(':').map(Number)
    const endTimeParts = config.endTime.split(':').map(Number)
    const startHour = startTimeParts[0] ?? 0
    const startMinute = startTimeParts[1] ?? 0
    const endHour = endTimeParts[0] ?? 0
    const endMinute = endTimeParts[1] ?? 0

    const today = new Date(userTime)
    today.setHours(startHour, startMinute, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let nextStart: Date
    let nextEnd: Date

    if (startHour <= endHour) {
      // Same day quiet hours
      if (userTime < today) {
        nextStart = today
        nextEnd = new Date(today)
        nextEnd.setHours(endHour, endMinute, 0, 0)
      } else {
        nextStart = tomorrow
        nextEnd = new Date(tomorrow)
        nextEnd.setHours(endHour, endMinute, 0, 0)
      }
    } else {
      // Overnight quiet hours
      if (userTime.getHours() < endHour || (userTime.getHours() === endHour && userTime.getMinutes() < endMinute)) {
        // Currently in the "next day" part of quiet hours
        nextStart = today
        nextEnd = new Date(userTime)
        nextEnd.setHours(endHour, endMinute, 0, 0)
      } else if (userTime < today) {
        nextStart = today
        nextEnd = new Date(today)
        nextEnd.setDate(nextEnd.getDate() + 1)
        nextEnd.setHours(endHour, endMinute, 0, 0)
      } else {
        nextStart = tomorrow
        nextEnd = new Date(tomorrow)
        nextEnd.setDate(nextEnd.getDate() + 1)
        nextEnd.setHours(endHour, endMinute, 0, 0)
      }
    }

    return { nextStart, nextEnd }
  }

  public canDeliverNotification(
    notification: NotificationPayload,
    userId: number,
    channel: string,
    currentTime?: Date
  ): boolean {
    const config = this.getUserConfig(userId)

    if (!config.enabled) {
      return true
    }

    const schedule = this.getQuietHoursSchedule(userId, currentTime)

    if (!schedule.currentlyInQuietHours) {
      return true
    }

    // Check channel-specific settings
    const channelConfig = config.channels[channel]
    if (!channelConfig || !channelConfig.respectQuietHours) {
      return true
    }

    // Check if notification priority can override quiet hours
    if (channelConfig.allowedPriorities.includes(notification.priority)) {
      return true
    }

    // Check emergency override for critical notifications
    if (config.emergencyOverride && notification.priority === 'critical') {
      return true
    }

    return false
  }

  public filterNotificationChannels(
    notification: NotificationPayload,
    userId: number,
    currentTime?: Date
  ): string[] {
    const originalChannels = notification.channels || ['socket']
    const config = this.getUserConfig(userId)

    if (!config.enabled) {
      return originalChannels
    }

    const schedule = this.getQuietHoursSchedule(userId, currentTime)

    if (!schedule.currentlyInQuietHours) {
      return originalChannels
    }

    // Filter channels based on quiet hours settings
    return originalChannels.filter(channel => {
      return this.canDeliverNotification(notification, userId, channel, currentTime)
    })
  }

  public getUserConfig(userId: number): QuietHoursConfig {
    let config = this.userConfigs.get(userId)
    if (!config) {
      config = { ...this.DEFAULT_CONFIG, userId }
      this.userConfigs.set(userId, config)
    }
    return config
  }

  public updateUserConfig(userId: number, updates: Partial<QuietHoursConfig>): void {
    const currentConfig = this.getUserConfig(userId)
    const newConfig = { ...currentConfig, ...updates, userId }

    this.userConfigs.set(userId, newConfig)
    this.scheduleCache.delete(userId) // Invalidate cache

    // Save to database
    try {
      this.db.prepare(`
        UPDATE users
        SET quiet_hours_config = ?
        WHERE id = ?
      `).run(JSON.stringify(newConfig), userId)

      logger.info(`Updated quiet hours config for user ${userId}`)
    } catch (error) {
      logger.error('Error saving quiet hours config', error)
    }
  }

  public addException(
    userId: number,
    exception: Omit<QuietHoursException, 'id'>
  ): string {
    const config = this.getUserConfig(userId)
    const exceptionId = `exc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    const newException: QuietHoursException = {
      ...exception,
      id: exceptionId
    }

    config.exceptions.push(newException)
    this.updateUserConfig(userId, { exceptions: config.exceptions })

    logger.info(`Added quiet hours exception ${exceptionId} for user ${userId}`)
    return exceptionId
  }

  public removeException(userId: number, exceptionId: string): boolean {
    const config = this.getUserConfig(userId)
    const initialLength = config.exceptions.length

    config.exceptions = config.exceptions.filter(exc => exc.id !== exceptionId)

    if (config.exceptions.length !== initialLength) {
      this.updateUserConfig(userId, { exceptions: config.exceptions })
      logger.info(`Removed quiet hours exception ${exceptionId} for user ${userId}`)
      return true
    }

    return false
  }

  // Bulk operations for admins
  public bulkUpdateConfigs(updates: Array<{ userId: number; config: Partial<QuietHoursConfig> }>): void {
    for (const update of updates) {
      this.updateUserConfig(update.userId, update.config)
    }
  }

  public getQuietHoursReport(userIds?: number[]): QuietHoursReport {
    const targetUsers = userIds || Array.from(this.userConfigs.keys())
    const now = new Date()

    const report: QuietHoursReport = {
      totalUsers: targetUsers.length,
      usersWithQuietHours: 0,
      currentlyInQuietHours: 0,
      averageQuietHoursDuration: 0,
      timezoneDistribution: {} as Record<string, number>,
      channelSettings: {} as Record<string, QuietHoursReportChannelSettings>,
      upcomingQuietHours: [] as Array<{
        userId: number
        startTime: Date
        endTime?: Date
        timezone: string
      }>,
      exceptions: {
        active: 0,
        total: 0
      }
    }

    const quietHoursDurations: number[] = []

    for (const userId of targetUsers) {
      const config = this.getUserConfig(userId)

      if (config.enabled) {
        report.usersWithQuietHours++

        const schedule = this.getQuietHoursSchedule(userId, now)
        if (schedule.currentlyInQuietHours) {
          report.currentlyInQuietHours++
        }

        // Calculate duration
        const startTimeParts = config.startTime.split(':').map(Number)
        const endTimeParts = config.endTime.split(':').map(Number)
        const startHour = startTimeParts[0] ?? 0
        const startMinute = startTimeParts[1] ?? 0
        const endHour = endTimeParts[0] ?? 0
        const endMinute = endTimeParts[1] ?? 0
        let duration: number

        if (startHour <= endHour) {
          duration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
        } else {
          duration = (24 * 60) - (startHour * 60 + startMinute) + (endHour * 60 + endMinute)
        }

        quietHoursDurations.push(duration)

        // Timezone distribution
        report.timezoneDistribution[config.timezone] = (report.timezoneDistribution[config.timezone] || 0) + 1

        // Channel settings aggregation
        for (const [channel, settings] of Object.entries(config.channels)) {
          if (!report.channelSettings[channel]) {
            report.channelSettings[channel] = {
              totalUsers: 0,
              respectQuietHours: 0,
              allowedPriorities: {} as Record<string, number>
            }
          }

          report.channelSettings[channel].totalUsers++
          if (settings.respectQuietHours) {
            report.channelSettings[channel].respectQuietHours++
          }

          for (const priority of settings.allowedPriorities) {
            report.channelSettings[channel].allowedPriorities[priority] =
              (report.channelSettings[channel].allowedPriorities[priority] || 0) + 1
          }
        }

        // Active exceptions
        const activeExceptions = schedule.activeExceptions.length
        report.exceptions.active += activeExceptions
        report.exceptions.total += config.exceptions.length

        // Upcoming quiet hours
        if (schedule.nextQuietHoursStart) {
          report.upcomingQuietHours.push({
            userId,
            startTime: schedule.nextQuietHoursStart,
            endTime: schedule.nextQuietHoursEnd,
            timezone: config.timezone
          })
        }
      }
    }

    // Calculate average duration
    if (quietHoursDurations.length > 0) {
      report.averageQuietHoursDuration = quietHoursDurations.reduce((sum, dur) => sum + dur, 0) / quietHoursDurations.length
    }

    // Sort upcoming quiet hours by start time
    report.upcomingQuietHours.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    report.upcomingQuietHours = report.upcomingQuietHours.slice(0, 10) // Top 10

    return report
  }

  // Timezone utilities
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
      // This is a simplification - for production, use a proper timezone library
      const userTime = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
      const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
      const offset = userTime.getTime() - utcTime.getTime()
      return new Date(date.getTime() - offset)
    } catch (error) {
      logger.error(`Error converting from timezone: ${timezone}`, error)
      return date
    }
  }

  // Setup periodic tasks
  private setupScheduleUpdates() {
    // Update schedules every 5 minutes
    setInterval(() => {
      this.updateAllSchedules()
    }, 5 * 60 * 1000)

    // Clean up expired exceptions daily
    setInterval(() => {
      this.cleanupExpiredExceptions()
    }, 24 * 60 * 60 * 1000)
  }

  private updateAllSchedules() {
    // Clear cache to force recalculation
    this.scheduleCache.clear()
  }

  private cleanupExpiredExceptions() {
    const now = new Date()
    let cleaned = 0

    for (const [userId, config] of Array.from(this.userConfigs.entries())) {
      const initialLength = config.exceptions.length
      config.exceptions = config.exceptions.filter(exc => exc.endDate > now)

      if (config.exceptions.length !== initialLength) {
        this.updateUserConfig(userId, { exceptions: config.exceptions })
        cleaned += initialLength - config.exceptions.length
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired quiet hours exceptions`)
    }
  }

  // Testing and debugging
  public simulateQuietHours(userId: number, simulatedTime: Date): QuietHoursSchedule {
    return this.getQuietHoursSchedule(userId, simulatedTime)
  }

  public getNextNotificationWindow(userId: number): { start: Date; end: Date } | null {
    const schedule = this.getQuietHoursSchedule(userId)

    if (!schedule.currentlyInQuietHours) {
      // Currently allowed, next window is immediate until next quiet hours
      return {
        start: new Date(),
        end: schedule.nextQuietHoursStart || new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    } else {
      // Currently in quiet hours, next window starts when quiet hours end
      return schedule.nextQuietHoursEnd ? {
        start: schedule.nextQuietHoursEnd,
        end: schedule.nextQuietHoursStart || new Date(schedule.nextQuietHoursEnd.getTime() + 24 * 60 * 60 * 1000)
      } : null
    }
  }
}