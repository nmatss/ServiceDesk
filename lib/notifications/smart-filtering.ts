import { NotificationPayload } from './realtime-engine'
import { getDb } from '@/lib/db'
import logger from '../monitoring/structured-logger';

export interface FilterActionParams {
  delayMinutes?: number
  newPriority?: string
  setBatchable?: boolean
  [key: string]: unknown
}

export interface FilterRule {
  id: string
  name: string
  description: string
  conditions: FilterCondition[]
  action: 'block' | 'allow' | 'delay' | 'modify' | 'priority_change'
  actionParams?: FilterActionParams
  priority: number
  isActive: boolean
  userId?: number // User-specific rule, null for global
  createdAt: Date
  updatedAt: Date
}

export interface FilterCondition {
  field: string // 'type', 'priority', 'ticketId', 'authorId', 'content', 'time', 'channel'
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'between' | 'regex'
  value: unknown
  metadata?: Record<string, unknown>
}

export interface UserPreferences {
  userId: number
  quietHoursEnabled: boolean
  quietHoursStart: string // HH:mm format
  quietHoursEnd: string
  timezone: string
  channels: {
    [channel: string]: {
      enabled: boolean
      priority: 'all' | 'high' | 'critical'
      quietHours: boolean
    }
  }
  categories: {
    [category: string]: {
      enabled: boolean
      frequency: 'immediate' | 'batched' | 'digest'
      channels: string[]
    }
  }
  frequency: {
    maxPerHour: number
    maxPerDay: number
    digestFrequency: 'never' | 'hourly' | 'daily' | 'weekly'
  }
  keywords: {
    blocked: string[]
    priority: string[]
  }
  mentions: {
    enabled: boolean
    channels: string[]
  }
  workingHours: {
    enabled: boolean
    start: string
    end: string
    days: number[] // 0-6, Sunday = 0
  }
}

export interface UserInfo {
  id: number
  name?: string
  email?: string
  role: string
  timezone?: string
}

export interface FilterContext {
  notification: NotificationPayload
  user: UserInfo
  preferences: UserPreferences
  currentTime: Date
  recentNotifications: NotificationPayload[]
  ticketContext?: Record<string, unknown>
}

export class SmartFilteringEngine {
  private db = getDb()
  private globalRules: FilterRule[] = []
  private userRules = new Map<number, FilterRule[]>()
  private userPreferences = new Map<number, UserPreferences>()
  private notificationHistory = new Map<number, NotificationPayload[]>()

  // Machine learning features (reserved for future use)
  // private userBehaviorPatterns = new Map<number, Record<string, unknown>>()
  // private notificationScores = new Map<string, number>()

  constructor() {
    this.loadFilterRules()
    this.loadUserPreferences()
    this.setupFilteringTasks()
  }

  private loadFilterRules() {
    try {
      // Load global rules
      interface DbFilterRule {
        id: string
        name: string
        description: string
        conditions: string
        action: string
        action_params: string | null
        priority: number
        is_active: number
        user_id: number | null
        created_at: string
        updated_at: string
      }

      const globalRules = this.db.prepare(`
        SELECT * FROM filter_rules
        WHERE user_id IS NULL AND is_active = 1
        ORDER BY priority DESC
      `).all() as DbFilterRule[]

      this.globalRules = globalRules.map(this.mapDatabaseRuleToFilterRule)

      // Load user-specific rules
      const userRules = this.db.prepare(`
        SELECT * FROM filter_rules
        WHERE user_id IS NOT NULL AND is_active = 1
        ORDER BY user_id, priority DESC
      `).all() as DbFilterRule[]

      for (const rule of userRules) {
        const filterRule = this.mapDatabaseRuleToFilterRule(rule)
        const userId = rule.user_id

        if (userId !== null) {
          if (!this.userRules.has(userId)) {
            this.userRules.set(userId, [])
          }
          this.userRules.get(userId)!.push(filterRule)
        }
      }

      logger.info(`Loaded ${this.globalRules.length} global filter rules and ${userRules.length} user-specific rules`)
    } catch (error) {
      logger.error('Error loading filter rules', error)
      this.createDefaultFilterRules()
    }
  }

  private mapDatabaseRuleToFilterRule(rule: {
    id: string
    name: string
    description: string
    conditions: string
    action: string
    action_params: string | null
    priority: number
    is_active: number
    user_id: number | null
    created_at: string
    updated_at: string
  }): FilterRule {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      conditions: JSON.parse(rule.conditions) as FilterCondition[],
      action: rule.action as FilterRule['action'],
      actionParams: rule.action_params ? JSON.parse(rule.action_params) as FilterActionParams : undefined,
      priority: rule.priority,
      isActive: Boolean(rule.is_active),
      userId: rule.user_id ?? undefined,
      createdAt: new Date(rule.created_at),
      updatedAt: new Date(rule.updated_at)
    }
  }

  private createDefaultFilterRules() {
    const defaultRules: Omit<FilterRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Block Spam Notifications',
        description: 'Block notifications with spam indicators',
        conditions: [
          { field: 'content', operator: 'contains', value: 'spam' },
          { field: 'content', operator: 'contains', value: 'urgent!!!' }
        ],
        action: 'block',
        priority: 100,
        isActive: true
      },
      {
        name: 'Critical Notifications Always Pass',
        description: 'Always allow critical priority notifications',
        conditions: [
          { field: 'priority', operator: 'equals', value: 'critical' }
        ],
        action: 'allow',
        priority: 90,
        isActive: true
      },
      {
        name: 'Rate Limit Low Priority',
        description: 'Delay low priority notifications during busy times',
        conditions: [
          { field: 'priority', operator: 'equals', value: 'low' }
        ],
        action: 'delay',
        actionParams: { delayMinutes: 30 },
        priority: 10,
        isActive: true
      },
      {
        name: 'Batch Similar Ticket Updates',
        description: 'Batch multiple updates for the same ticket',
        conditions: [
          { field: 'type', operator: 'in', value: ['ticket_updated', 'status_changed'] }
        ],
        action: 'modify',
        actionParams: { setBatchable: true },
        priority: 20,
        isActive: true
      }
    ]

    for (const rule of defaultRules) {
      this.createFilterRule(rule)
    }
  }

  private loadUserPreferences() {
    try {
      interface DbUserPreference {
        user_id: number
        notification_preferences: string
      }

      const preferences = this.db.prepare(`
        SELECT user_id, notification_preferences FROM users
        WHERE notification_preferences IS NOT NULL
      `).all() as DbUserPreference[]

      for (const pref of preferences) {
        const userPrefs = JSON.parse(pref.notification_preferences) as Partial<UserPreferences>
        this.userPreferences.set(pref.user_id, this.normalizeUserPreferences(userPrefs))
      }

      logger.info(`Loaded preferences for ${preferences.length} users`)
    } catch (error) {
      logger.error('Error loading user preferences', error)
    }
  }

  private normalizeUserPreferences(prefs: Partial<UserPreferences>): UserPreferences {
    return {
      userId: prefs.userId || 0,
      quietHoursEnabled: prefs.quietHoursEnabled || false,
      quietHoursStart: prefs.quietHoursStart || '22:00',
      quietHoursEnd: prefs.quietHoursEnd || '08:00',
      timezone: prefs.timezone || 'America/Sao_Paulo',
      channels: prefs.channels || {
        socket: { enabled: true, priority: 'all', quietHours: false },
        email: { enabled: true, priority: 'high', quietHours: true },
        push: { enabled: false, priority: 'critical', quietHours: true },
        sms: { enabled: false, priority: 'critical', quietHours: true }
      },
      categories: prefs.categories || {
        ticket_updates: { enabled: true, frequency: 'immediate', channels: ['socket'] },
        sla_warnings: { enabled: true, frequency: 'immediate', channels: ['socket', 'email'] },
        system_alerts: { enabled: true, frequency: 'immediate', channels: ['socket'] },
        comments: { enabled: true, frequency: 'immediate', channels: ['socket'] }
      },
      frequency: prefs.frequency || {
        maxPerHour: 50,
        maxPerDay: 200,
        digestFrequency: 'daily'
      },
      keywords: prefs.keywords || {
        blocked: [],
        priority: []
      },
      mentions: prefs.mentions || {
        enabled: true,
        channels: ['socket', 'email']
      },
      workingHours: prefs.workingHours || {
        enabled: false,
        start: '09:00',
        end: '18:00',
        days: [1, 2, 3, 4, 5] // Monday to Friday
      }
    }
  }

  public async filterNotification(notification: NotificationPayload): Promise<NotificationPayload | null> {
    try {
      // Create filter context for each target user
      const targetUsers = notification.targetUsers || []
      const filteredTargets: number[] = []

      for (const userId of targetUsers) {
        const user = await this.getUserInfo(userId)
        const preferences = this.getUserPreferences(userId)
        const recentNotifications = this.getRecentNotifications(userId)

        const context: FilterContext = {
          notification,
          user,
          preferences,
          currentTime: new Date(),
          recentNotifications
        }

        // Apply filtering for this user
        const filterResult = await this.applyFiltersForUser(context)

        if (filterResult.allowed) {
          filteredTargets.push(userId)

          // Apply modifications if any
          if (filterResult.modifications) {
            Object.assign(notification, filterResult.modifications)
          }
        }
      }

      // If no users remain after filtering, return null
      if (filteredTargets.length === 0) {
        logger.info(`Notification ${notification.id} filtered out for all users`)
        return null
      }

      // Update target users list
      notification.targetUsers = filteredTargets

      // Record notification for history
      this.recordNotificationForUsers(notification, filteredTargets)

      return notification
    } catch (error) {
      logger.error('Error in smart filtering', error)
      return notification // Return original on error
    }
  }

  private async applyFiltersForUser(context: FilterContext): Promise<{
    allowed: boolean;
    reason?: string;
    modifications?: Partial<NotificationPayload>;
  }> {
    const { user } = context

    // 1. Check basic user preferences
    const basicCheck = this.checkBasicPreferences(context)
    if (!basicCheck.allowed) {
      return basicCheck
    }

    // 2. Check quiet hours
    const quietHoursCheck = this.checkQuietHours(context)
    if (!quietHoursCheck.allowed) {
      return quietHoursCheck
    }

    // 3. Check working hours (if enabled)
    const workingHoursCheck = this.checkWorkingHours(context)
    if (!workingHoursCheck.allowed) {
      return workingHoursCheck
    }

    // 4. Check frequency limits
    const frequencyCheck = this.checkFrequencyLimits(context)
    if (!frequencyCheck.allowed) {
      return frequencyCheck
    }

    // 5. Apply global filter rules
    const globalRulesResult = this.applyFilterRules(this.globalRules, context)
    if (!globalRulesResult.allowed) {
      return globalRulesResult
    }

    // 6. Apply user-specific filter rules
    const userRules = this.userRules.get(user.id) || []
    const userRulesResult = this.applyFilterRules(userRules, context)
    if (!userRulesResult.allowed) {
      return userRulesResult
    }

    // 7. Apply ML-based filtering (if available)
    const mlResult = this.applyMLFiltering(context)
    if (!mlResult.allowed) {
      return mlResult
    }

    // 8. Combine all modifications
    const modifications = {
      ...basicCheck.modifications,
      ...globalRulesResult.modifications,
      ...userRulesResult.modifications,
      ...mlResult.modifications
    }

    return {
      allowed: true,
      modifications: Object.keys(modifications).length > 0 ? modifications : undefined
    }
  }

  private checkBasicPreferences(context: FilterContext): {
    allowed: boolean
    reason?: string
    modifications?: Partial<NotificationPayload>
  } {
    const { notification, preferences } = context

    // Check if category is enabled
    const category = this.getNotificationCategory(notification)
    const categoryPrefs = preferences.categories[category]

    if (categoryPrefs && !categoryPrefs.enabled) {
      return { allowed: false, reason: 'Category disabled in user preferences' }
    }

    // Check channel preferences
    const channels = notification.channels || ['socket']
    const allowedChannels = channels.filter(channel => {
      const channelPrefs = preferences.channels[channel]
      if (!channelPrefs || !channelPrefs.enabled) return false

      // Check priority requirements
      if (channelPrefs.priority === 'high' && !['high', 'critical'].includes(notification.priority)) {
        return false
      }
      if (channelPrefs.priority === 'critical' && notification.priority !== 'critical') {
        return false
      }

      return true
    })

    if (allowedChannels.length === 0) {
      return { allowed: false, reason: 'No allowed channels for user' }
    }

    return {
      allowed: true,
      modifications: { channels: allowedChannels }
    }
  }

  private checkQuietHours(context: FilterContext): {
    allowed: boolean
    reason?: string
    modifications?: Partial<NotificationPayload>
  } {
    const { preferences, currentTime } = context

    if (!preferences.quietHoursEnabled) {
      return { allowed: true }
    }

    const userTime = this.convertToUserTimezone(currentTime, preferences.timezone)
    const currentHour = userTime.getHours()
    const currentMinute = userTime.getMinutes()
    const currentTimeMinutes = currentHour * 60 + currentMinute

    const [startHour = 0, startMinute = 0] = preferences.quietHoursStart.split(':').map(Number)
    const [endHour = 0, endMinute = 0] = preferences.quietHoursEnd.split(':').map(Number)
    const startTimeMinutes = startHour * 60 + startMinute
    const endTimeMinutes = endHour * 60 + endMinute

    let isQuietTime = false

    if (startTimeMinutes < endTimeMinutes) {
      // Same day quiet hours (e.g., 22:00 to 08:00 next day)
      isQuietTime = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00 next day)
      isQuietTime = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes
    }

    if (isQuietTime) {
      // Filter out channels that respect quiet hours
      const { notification } = context
      const channels = notification.channels || ['socket']
      const allowedChannels = channels.filter(channel => {
        const channelPrefs = preferences.channels[channel]
        return channelPrefs && !channelPrefs.quietHours
      })

      if (allowedChannels.length === 0) {
        return { allowed: false, reason: 'Quiet hours active, no allowed channels' }
      }

      return {
        allowed: true,
        modifications: { channels: allowedChannels }
      }
    }

    return { allowed: true }
  }

  private checkWorkingHours(context: FilterContext): {
    allowed: boolean
    reason?: string
    modifications?: Partial<NotificationPayload>
  } {
    const { preferences, currentTime } = context

    if (!preferences.workingHours.enabled) {
      return { allowed: true }
    }

    const userTime = this.convertToUserTimezone(currentTime, preferences.timezone)
    const currentDay = userTime.getDay() // 0 = Sunday
    const currentHour = userTime.getHours()
    const currentMinute = userTime.getMinutes()
    const currentTimeMinutes = currentHour * 60 + currentMinute

    // Check if current day is a working day
    if (!preferences.workingHours.days.includes(currentDay)) {
      return { allowed: false, reason: 'Outside working days' }
    }

    const [startHour = 0, startMinute = 0] = preferences.workingHours.start.split(':').map(Number)
    const [endHour = 0, endMinute = 0] = preferences.workingHours.end.split(':').map(Number)
    const startTimeMinutes = startHour * 60 + startMinute
    const endTimeMinutes = endHour * 60 + endMinute

    if (currentTimeMinutes < startTimeMinutes || currentTimeMinutes > endTimeMinutes) {
      return { allowed: false, reason: 'Outside working hours' }
    }

    return { allowed: true }
  }

  private checkFrequencyLimits(context: FilterContext): {
    allowed: boolean
    reason?: string
    modifications?: Partial<NotificationPayload>
  } {
    const { preferences, user, currentTime } = context
    const recentNotifications = this.getRecentNotifications(user.id)

    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000)

    const notificationsLastHour = recentNotifications.filter(n =>
      n.metadata?.timestamp && new Date(n.metadata.timestamp) > oneHourAgo
    )

    const notificationsLastDay = recentNotifications.filter(n =>
      n.metadata?.timestamp && new Date(n.metadata.timestamp) > oneDayAgo
    )

    if (notificationsLastHour.length >= preferences.frequency.maxPerHour) {
      return { allowed: false, reason: 'Hourly frequency limit exceeded' }
    }

    if (notificationsLastDay.length >= preferences.frequency.maxPerDay) {
      return { allowed: false, reason: 'Daily frequency limit exceeded' }
    }

    return { allowed: true }
  }

  private applyFilterRules(rules: FilterRule[], context: FilterContext): {
    allowed: boolean
    reason?: string
    modifications?: Partial<NotificationPayload>
  } {
    for (const rule of rules) {
      if (!rule.isActive) continue

      const matches = this.evaluateFilterRule(rule, context)
      if (matches) {
        switch (rule.action) {
          case 'block':
            return { allowed: false, reason: `Blocked by rule: ${rule.name}` }

          case 'allow':
            return { allowed: true, reason: `Allowed by rule: ${rule.name}` }

          case 'delay':
            const delayMinutes = rule.actionParams?.delayMinutes || 30
            const delayedTime = new Date(Date.now() + delayMinutes * 60 * 1000)
            return {
              allowed: true,
              modifications: { metadata: { ...context.notification.metadata, scheduledAt: delayedTime.toISOString() } },
              reason: `Delayed by rule: ${rule.name}`
            }

          case 'modify':
            // Convert action params to notification payload modifications
            const mods: Partial<NotificationPayload> = {}
            if (rule.actionParams?.setBatchable !== undefined) {
              mods.batchable = rule.actionParams.setBatchable
            }
            return {
              allowed: true,
              modifications: mods,
              reason: `Modified by rule: ${rule.name}`
            }

          case 'priority_change':
            const newPriority = rule.actionParams?.newPriority
            const validPriorities: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical']
            return {
              allowed: true,
              modifications: {
                priority: validPriorities.includes(newPriority as 'low' | 'medium' | 'high' | 'critical')
                  ? (newPriority as 'low' | 'medium' | 'high' | 'critical')
                  : context.notification.priority
              },
              reason: `Priority changed by rule: ${rule.name}`
            }
        }
      }
    }

    return { allowed: true }
  }

  private evaluateFilterRule(rule: FilterRule, context: FilterContext): boolean {
    const { notification } = context

    // All conditions must match (AND logic)
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, notification, context)) {
        return false
      }
    }

    return true
  }

  private evaluateCondition(condition: FilterCondition, notification: NotificationPayload, context: FilterContext): boolean {
    let fieldValue: unknown

    // Get field value
    switch (condition.field) {
      case 'type':
        fieldValue = notification.type
        break
      case 'priority':
        fieldValue = notification.priority
        break
      case 'ticketId':
        fieldValue = notification.ticketId
        break
      case 'authorId':
        fieldValue = notification.authorId
        break
      case 'content':
        fieldValue = `${notification.title} ${notification.message}`.toLowerCase()
        break
      case 'channel':
        fieldValue = notification.channels
        break
      case 'time':
        fieldValue = context.currentTime
        break
      default:
        fieldValue = notification.data?.[condition.field] || notification.metadata?.[condition.field]
    }

    // Apply operator
    return this.applyOperator(condition.operator, fieldValue, condition.value)
  }

  private applyOperator(operator: string, fieldValue: unknown, conditionValue: unknown): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue

      case 'not_equals':
        return fieldValue !== conditionValue

      case 'contains':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' && fieldValue.includes(conditionValue)

      case 'not_contains':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' && !fieldValue.includes(conditionValue)

      case 'starts_with':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' && fieldValue.startsWith(conditionValue)

      case 'ends_with':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' && fieldValue.endsWith(conditionValue)

      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue)

      case 'not_in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue)

      case 'greater_than':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue > conditionValue

      case 'less_than':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue < conditionValue

      case 'between':
        return Array.isArray(conditionValue) &&
               conditionValue.length >= 2 &&
               typeof fieldValue === 'number' &&
               typeof conditionValue[0] === 'number' &&
               typeof conditionValue[1] === 'number' &&
               fieldValue >= conditionValue[0] &&
               fieldValue <= conditionValue[1]

      case 'regex':
        try {
          if (typeof conditionValue !== 'string') {
            return false
          }
          const regex = new RegExp(conditionValue)
          return regex.test(String(fieldValue))
        } catch {
          return false
        }

      default:
        return false
    }
  }

  private applyMLFiltering(context: FilterContext): {
    allowed: boolean
    reason?: string
    modifications?: Partial<NotificationPayload>
  } {
    // Placeholder for machine learning-based filtering
    // This would integrate with ML models for predicting user engagement
    const { notification, user } = context

    // Simple heuristic-based scoring for now
    const score = this.calculateNotificationScore(notification, user)

    if (score < 0.3) {
      return { allowed: false, reason: 'Low relevance score' }
    }

    return { allowed: true }
  }

  private calculateNotificationScore(notification: NotificationPayload, user: UserInfo): number {
    let score = 0.5 // Base score

    // Priority boost
    switch (notification.priority) {
      case 'critical': score += 0.4; break
      case 'high': score += 0.2; break
      case 'medium': score += 0.1; break
      case 'low': score -= 0.1; break
    }

    // Type relevance
    const userRole = user.role
    if (userRole === 'admin') {
      score += 0.2 // Admins get more notifications
    } else if (userRole === 'agent') {
      if (['ticket_assigned', 'sla_warning'].includes(notification.type)) {
        score += 0.3
      }
    }

    // Ticket involvement
    if (notification.ticketId && notification.authorId !== user.id) {
      // Check if user is involved with this ticket
      const isInvolved = this.isUserInvolvedWithTicket(user.id, notification.ticketId)
      if (isInvolved) {
        score += 0.2
      } else {
        score -= 0.1
      }
    }

    return Math.max(0, Math.min(1, score))
  }

  // Helper methods
  private getUserPreferences(userId: number): UserPreferences {
    let prefs = this.userPreferences.get(userId)
    if (!prefs) {
      // Create default preferences
      prefs = this.normalizeUserPreferences({ userId })
      this.userPreferences.set(userId, prefs)
    }
    return prefs
  }

  private async getUserInfo(userId: number): Promise<UserInfo> {
    try {
      const user = this.db.prepare(`
        SELECT id, name, email, role, timezone FROM users WHERE id = ?
      `).get(userId) as UserInfo | undefined

      return user || { id: userId, role: 'user' }
    } catch (error) {
      logger.error('Error getting user info', error)
      return { id: userId, role: 'user' }
    }
  }

  private getRecentNotifications(userId: number): NotificationPayload[] {
    let history = this.notificationHistory.get(userId)
    if (!history) {
      history = []
      this.notificationHistory.set(userId, history)
    }

    // Keep only last 100 notifications
    return history.slice(-100)
  }

  private recordNotificationForUsers(notification: NotificationPayload, userIds: number[]) {
    const timestampedNotification = {
      ...notification,
      metadata: {
        ...notification.metadata,
        timestamp: new Date().toISOString()
      }
    }

    for (const userId of userIds) {
      let history = this.notificationHistory.get(userId)
      if (!history) {
        history = []
        this.notificationHistory.set(userId, history)
      }

      history.push(timestampedNotification)

      // Keep only last 100 notifications per user
      if (history.length > 100) {
        history.splice(0, history.length - 100)
      }
    }
  }

  private getNotificationCategory(notification: NotificationPayload): string {
    const typeCategories: Record<string, string> = {
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

    return typeCategories[notification.type] || 'general'
  }

  private convertToUserTimezone(date: Date, timezone: string): Date {
    try {
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    } catch {
      return date // Fallback to original date if timezone is invalid
    }
  }

  private isUserInvolvedWithTicket(userId: number, ticketId: number): boolean {
    try {
      const involvement = this.db.prepare(`
        SELECT 1 FROM (
          SELECT user_id FROM tickets WHERE id = ? AND user_id = ?
          UNION
          SELECT assigned_to FROM tickets WHERE id = ? AND assigned_to = ?
          UNION
          SELECT author_id FROM comments WHERE ticket_id = ? AND author_id = ?
        ) LIMIT 1
      `).get(ticketId, userId, ticketId, userId, ticketId, userId)

      return !!involvement
    } catch (error) {
      logger.error('Error checking user ticket involvement', error)
      return false
    }
  }

  // Public management methods
  public createFilterRule(rule: Omit<FilterRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()

    const fullRule: FilterRule = {
      ...rule,
      id: ruleId,
      createdAt: now,
      updatedAt: now
    }

    try {
      this.db.prepare(`
        INSERT INTO filter_rules (
          id, name, description, conditions, action, action_params,
          priority, is_active, user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ruleId,
        rule.name,
        rule.description,
        JSON.stringify(rule.conditions),
        rule.action,
        rule.actionParams ? JSON.stringify(rule.actionParams) : null,
        rule.priority,
        rule.isActive ? 1 : 0,
        rule.userId || null,
        now.toISOString(),
        now.toISOString()
      )

      // Add to appropriate cache
      if (rule.userId) {
        if (!this.userRules.has(rule.userId)) {
          this.userRules.set(rule.userId, [])
        }
        this.userRules.get(rule.userId)!.push(fullRule)
        this.userRules.get(rule.userId)!.sort((a, b) => b.priority - a.priority)
      } else {
        this.globalRules.push(fullRule)
        this.globalRules.sort((a, b) => b.priority - a.priority)
      }

      logger.info(`Created filter rule: ${ruleId}`)
      return ruleId
    } catch (error) {
      logger.error('Error creating filter rule', error)
      throw error
    }
  }

  public updateUserPreferences(userId: number, preferences: Partial<UserPreferences>): void {
    const current = this.getUserPreferences(userId)
    const updated = { ...current, ...preferences }

    this.userPreferences.set(userId, updated)

    try {
      this.db.prepare(`
        UPDATE users
        SET notification_preferences = ?
        WHERE id = ?
      `).run(JSON.stringify(updated), userId)
    } catch (error) {
      logger.error('Error updating user preferences', error)
    }
  }

  public getFilteringStats(): {
    globalRules: number
    userRules: number
    cachedPreferences: number
    notificationHistory: number
  } {
    return {
      globalRules: this.globalRules.length,
      userRules: Array.from(this.userRules.values()).reduce((sum, rules) => sum + rules.length, 0),
      cachedPreferences: this.userPreferences.size,
      notificationHistory: Array.from(this.notificationHistory.values()).reduce((sum, history) => sum + history.length, 0)
    }
  }

  private setupFilteringTasks() {
    // Cleanup old notification history every hour
    setInterval(() => {
      this.cleanupNotificationHistory()
    }, 60 * 60 * 1000)

    // Refresh user preferences every 10 minutes
    setInterval(() => {
      this.loadUserPreferences()
    }, 10 * 60 * 1000)
  }

  private cleanupNotificationHistory() {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

    for (const [userId, history] of this.notificationHistory.entries()) {
      const validHistory = history.filter(n => {
        const timestamp = n.metadata?.timestamp ? new Date(n.metadata.timestamp) : new Date(0)
        return timestamp > cutoffTime
      })

      if (validHistory.length !== history.length) {
        this.notificationHistory.set(userId, validHistory)
      }
    }
  }
}