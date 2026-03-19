import { executeQuery, executeQueryOne, executeRun, sqlTrue } from '@/lib/db/adapter'
import { getDatabaseType } from '@/lib/db/config'
import { NotificationPayload } from './realtime-engine'
import logger from '../monitoring/structured-logger';

export interface EscalationRule {
  id: string
  name: string
  description: string
  conditions: EscalationCondition[]
  actions: EscalationAction[]
  priority: number
  isActive: boolean
  cooldownPeriod: number // minutes
  maxEscalations: number
  createdBy: number
  createdAt: Date
  updatedAt: Date
}

export interface EscalationCondition {
  type: 'time_based' | 'delivery_failure' | 'no_response' | 'priority' | 'channel_failure' | 'user_availability'
  parameters: Record<string, any>
}

export interface EscalationAction {
  type: 'notify_user' | 'notify_role' | 'change_priority' | 'change_channels' | 'create_ticket' | 'webhook' | 'sms_fallback'
  parameters: Record<string, any>
  delay?: number // minutes to wait before executing
}

export interface EscalationInstance {
  id: string
  notificationId: string
  ruleId: string
  triggeredAt: Date
  executedActions: ExecutedAction[]
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled'
  escalationLevel: number
  lastActionAt?: Date
  nextActionAt?: Date
  metadata?: Record<string, any>
}

export interface ExecutedAction {
  actionType: string
  executedAt: Date
  success: boolean
  result?: unknown
  error?: string
  retryCount: number
}

interface ActionResult {
  success: boolean
  data?: Record<string, any>
  error?: string
}

export class EscalationManager {
  private realtimeEngine: any // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamically injected engine
  private escalationRules: EscalationRule[] = []
  private activeEscalations = new Map<string, EscalationInstance>()
  private escalationTimers = new Map<string, NodeJS.Timeout>()

  // Default escalation rules
  private readonly DEFAULT_RULES: Omit<EscalationRule, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'Critical Notification Escalation',
      description: 'Escalate critical notifications if not delivered within 5 minutes',
      conditions: [
        {
          type: 'time_based',
          parameters: { timeoutMinutes: 5 }
        },
        {
          type: 'priority',
          parameters: { priority: 'critical' }
        }
      ],
      actions: [
        {
          type: 'notify_role',
          parameters: { role: 'admin', channels: ['email', 'sms'] }
        },
        {
          type: 'change_channels',
          parameters: { channels: ['email', 'sms', 'push'] }
        }
      ],
      priority: 100,
      isActive: true,
      cooldownPeriod: 30,
      maxEscalations: 3
    },
    {
      name: 'SLA Breach Escalation',
      description: 'Escalate SLA breach notifications immediately',
      conditions: [
        {
          type: 'time_based',
          parameters: { timeoutMinutes: 2 }
        }
      ],
      actions: [
        {
          type: 'notify_role',
          parameters: { role: 'manager', channels: ['email', 'teams'] }
        },
        {
          type: 'create_ticket',
          parameters: {
            title: 'SLA Breach Alert',
            priority: 'critical',
            category: 'escalation'
          }
        }
      ],
      priority: 90,
      isActive: true,
      cooldownPeriod: 15,
      maxEscalations: 2
    },
    {
      name: 'Delivery Failure Fallback',
      description: 'Try alternative channels when primary delivery fails',
      conditions: [
        {
          type: 'delivery_failure',
          parameters: { failedChannels: ['email'], failureCount: 2 }
        }
      ],
      actions: [
        {
          type: 'change_channels',
          parameters: { channels: ['sms', 'push'] }
        },
        {
          type: 'notify_user',
          parameters: { userId: 'notification_author', message: 'Primary delivery failed, using fallback channels' }
        }
      ],
      priority: 80,
      isActive: true,
      cooldownPeriod: 10,
      maxEscalations: 1
    },
    {
      name: 'High Priority Timeout',
      description: 'Escalate high priority notifications if no response in 15 minutes',
      conditions: [
        {
          type: 'time_based',
          parameters: { timeoutMinutes: 15 }
        },
        {
          type: 'priority',
          parameters: { priority: 'high' }
        },
        {
          type: 'no_response',
          parameters: { expectedResponse: true }
        }
      ],
      actions: [
        {
          type: 'notify_role',
          parameters: { role: 'agent', channels: ['push', 'socket'] }
        },
        {
          type: 'change_priority',
          parameters: { newPriority: 'critical' }
        }
      ],
      priority: 70,
      isActive: true,
      cooldownPeriod: 45,
      maxEscalations: 2
    },
    {
      name: 'User Unavailable Escalation',
      description: 'Escalate to team when assigned user is unavailable',
      conditions: [
        {
          type: 'user_availability',
          parameters: { checkPresence: true, unavailableMinutes: 10 }
        },
        {
          type: 'time_based',
          parameters: { timeoutMinutes: 10 }
        }
      ],
      actions: [
        {
          type: 'notify_role',
          parameters: { role: 'agent', excludeUsers: ['original_recipient'] }
        }
      ],
      priority: 60,
      isActive: true,
      cooldownPeriod: 20,
      maxEscalations: 1
    }
  ]

  constructor(realtimeEngine: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.realtimeEngine = realtimeEngine
    this.initAsync()
    this.setupEscalationProcessing()
  }

  private async initAsync(): Promise<void> {
    await this.loadEscalationRules()
    await this.loadActiveEscalations()
  }

  private async loadEscalationRules(): Promise<void> {
    try {
      const rules = await executeQuery(`
        SELECT * FROM escalation_rules WHERE is_active = ${sqlTrue()}
        ORDER BY priority DESC
      `, [])

      this.escalationRules = rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        conditions: JSON.parse(rule.conditions),
        actions: JSON.parse(rule.actions),
        priority: rule.priority,
        isActive: rule.is_active,
        cooldownPeriod: rule.cooldown_period,
        maxEscalations: rule.max_escalations,
        createdBy: rule.created_by,
        createdAt: new Date(rule.created_at),
        updatedAt: new Date(rule.updated_at)
      }))

      logger.info(`Loaded ${this.escalationRules.length} escalation rules`)

      // Create default rules if none exist
      if (this.escalationRules.length === 0) {
        await this.createDefaultRules()
      }
    } catch (error) {
      logger.error('Error loading escalation rules', error)
      await this.createDefaultRules()
    }
  }

  private async createDefaultRules(): Promise<void> {
    for (const rule of this.DEFAULT_RULES) {
      const ruleWithCreatedBy = {
        ...rule,
        createdBy: 1
      };
      await this.createEscalationRule(ruleWithCreatedBy, 1) // System user
    }
  }

  private async loadActiveEscalations(): Promise<void> {
    try {
      const escalations = await executeQuery(`
        SELECT * FROM escalation_instances
        WHERE status IN ('pending', 'executing')
      `, [])

      for (const escalation of escalations) {
        const instance: EscalationInstance = {
          id: escalation.id,
          notificationId: escalation.notification_id,
          ruleId: escalation.rule_id,
          triggeredAt: new Date(escalation.triggered_at),
          executedActions: JSON.parse(escalation.executed_actions || '[]'),
          status: escalation.status,
          escalationLevel: escalation.escalation_level,
          lastActionAt: escalation.last_action_at ? new Date(escalation.last_action_at) : undefined,
          nextActionAt: escalation.next_action_at ? new Date(escalation.next_action_at) : undefined,
          metadata: escalation.metadata ? JSON.parse(escalation.metadata) : undefined
        }

        this.activeEscalations.set(instance.id, instance)

        // Reschedule if needed
        if (instance.nextActionAt && instance.nextActionAt > new Date()) {
          this.scheduleEscalationAction(instance)
        }
      }

      logger.info(`Loaded ${escalations.length} active escalations`)
    } catch (error) {
      logger.error('Error loading active escalations', error)
    }
  }

  public setupEscalation(notification: any): void {
    if (!notification.escalationRules || notification.escalationRules.length === 0) {
      // Check if notification matches any default escalation rules
      const matchingRules = this.findMatchingRules(notification)
      if (matchingRules.length === 0) {
        return
      }

      for (const rule of matchingRules) {
        this.createEscalationInstance(notification, rule)
      }
    } else {
      // Use specified escalation rules
      for (const escalationRule of notification.escalationRules) {
        const ruleId = typeof escalationRule === 'string' ? escalationRule : escalationRule.id;
        const rule = this.escalationRules.find(r => r.id === ruleId)
        if (rule && rule.isActive) {
          this.createEscalationInstance(notification, rule)
        }
      }
    }
  }

  private findMatchingRules(notification: any): EscalationRule[] {
    const matchingRules: EscalationRule[] = []

    for (const rule of this.escalationRules) {
      if (!rule.isActive) continue

      // Check if notification matches rule conditions
      let matchesAll = true
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, notification, null)) {
          matchesAll = false
          break
        }
      }

      if (matchesAll) {
        matchingRules.push(rule)
      }
    }

    return matchingRules.sort((a, b) => b.priority - a.priority)
  }

  private createEscalationInstance(notification: any, rule: EscalationRule): string {
    const instanceId = `esc_${notification.id}_${rule.id}_${Date.now()}`

    const instance: EscalationInstance = {
      id: instanceId,
      notificationId: notification.id!,
      ruleId: rule.id,
      triggeredAt: new Date(),
      executedActions: [],
      status: 'pending',
      escalationLevel: 1,
      metadata: {
        originalNotification: {
          type: notification.type,
          priority: notification.priority,
          targetUsers: notification.targetUsers,
          channels: notification.channels
        }
      }
    }

    // Calculate when to start escalation based on time-based conditions
    const timeBasedCondition = rule.conditions.find(c => c.type === 'time_based')
    if (timeBasedCondition) {
      const timeoutMinutes = timeBasedCondition.parameters.timeoutMinutes || 5
      instance.nextActionAt = new Date(Date.now() + timeoutMinutes * 60 * 1000)
    } else {
      // Execute immediately if no time-based condition
      instance.nextActionAt = new Date()
    }

    this.activeEscalations.set(instanceId, instance)
    this.persistEscalationInstance(instance)
    this.scheduleEscalationAction(instance)

    logger.info(`Created escalation instance ${instanceId} for notification ${notification.id}`)
    return instanceId
  }

  private scheduleEscalationAction(instance: EscalationInstance): void {
    if (!instance.nextActionAt || instance.status !== 'pending') {
      return
    }

    const delay = instance.nextActionAt.getTime() - Date.now()
    if (delay <= 0) {
      // Execute immediately
      setImmediate(() => this.executeEscalation(instance.id))
      return
    }

    const timer = setTimeout(() => {
      this.executeEscalation(instance.id)
    }, delay)

    this.escalationTimers.set(instance.id, timer)
  }

  private async executeEscalation(instanceId: string): Promise<void> {
    const instance = this.activeEscalations.get(instanceId)
    if (!instance) {
      logger.warn(`Escalation instance ${instanceId} not found`)
      return
    }

    const rule = this.escalationRules.find(r => r.id === instance.ruleId)
    if (!rule) {
      logger.error(`Escalation rule ${instance.ruleId} not found`)
      this.cancelEscalation(instanceId, 'Rule not found')
      return
    }

    try {
      // Atomically claim this escalation to prevent race conditions with concurrent instances.
      // Only transitions from 'pending' to 'executing' — if another instance already claimed it,
      // the UPDATE will affect 0 rows and we bail out.
      const claimResult = await executeRun(`
        UPDATE escalation_instances
        SET status = 'executing', last_action_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
      `, [instanceId])

      if (claimResult.changes === 0) {
        logger.info(`Escalation ${instanceId} already claimed by another instance, skipping`)
        return
      }

      instance.status = 'executing'
      instance.lastActionAt = new Date()

      logger.info(`Executing escalation ${instanceId}`)

      // Check if escalation conditions are still met
      const notification = await this.getNotificationDetails(instance.notificationId)
      if (!notification) {
        this.cancelEscalation(instanceId, 'Original notification not found')
        return
      }

      const conditionsMet = this.evaluateEscalationConditions(rule, notification, instance)
      if (!conditionsMet) {
        this.cancelEscalation(instanceId, 'Escalation conditions no longer met')
        return
      }

      // Check cooldown
      if (await this.isInCooldown(rule, notification)) {
        logger.info(`Escalation ${instanceId} is in cooldown, skipping`)
        this.scheduleNextEscalation(instance, rule)
        return
      }

      // Check max escalations
      if (instance.escalationLevel > rule.maxEscalations) {
        this.completeEscalation(instanceId, 'Max escalations reached')
        return
      }

      // Execute actions
      await this.executeEscalationActions(instance, rule, notification)

      // Schedule next escalation if applicable
      this.scheduleNextEscalation(instance, rule)

    } catch (error) {
      logger.error(`Error executing escalation ${instanceId}:`, error)
      this.failEscalation(instanceId, error instanceof Error ? error.message : String(error))
    }
  }

  private evaluateEscalationConditions(rule: EscalationRule, notification: any, instance: EscalationInstance): boolean {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, notification, instance)) {
        return false
      }
    }
    return true
  }

  private evaluateCondition(condition: EscalationCondition, notification: any, instance: EscalationInstance | null): boolean {
    switch (condition.type) {
      case 'time_based':
        if (!instance) return true // For rule matching, always pass time-based conditions
        const timeoutMinutes = condition.parameters.timeoutMinutes || 5
        const timeoutMs = timeoutMinutes * 60 * 1000
        return (Date.now() - instance.triggeredAt.getTime()) >= timeoutMs

      case 'priority':
        return notification.priority === condition.parameters.priority

      case 'delivery_failure':
        return this.checkDeliveryFailure(notification, condition.parameters)

      case 'no_response':
        return this.checkNoResponse(notification, condition.parameters)

      case 'channel_failure':
        return this.checkChannelFailure(notification, condition.parameters)

      case 'user_availability':
        return this.checkUserAvailability(notification, condition.parameters)

      default:
        return false
    }
  }

  private checkDeliveryFailure(notification: any, _parameters: Record<string, any>): boolean {
    logger.warn('Escalation check not implemented', { check: 'deliveryFailure', notificationId: notification?.id });
    return false
  }

  private checkNoResponse(notification: any, parameters: Record<string, any>): boolean {
    if (!parameters.expectedResponse) return false

    logger.warn('Escalation check not implemented', { check: 'noResponse', notificationId: notification?.id });
    return false
  }

  private checkChannelFailure(notification: any, _parameters: Record<string, any>): boolean {
    logger.warn('Escalation check not implemented', { check: 'channelFailure', notificationId: notification?.id });
    return false
  }

  private checkUserAvailability(notification: any, parameters: Record<string, any>): boolean {
    if (!parameters.checkPresence) return false

    const targetUsers = notification.targetUsers || []

    // Check if target users are offline/away for specified time
    for (const userId of targetUsers) {
      const presence = this.realtimeEngine?.getPresenceManager()?.getUserPresence(userId)
      if (presence === 'offline' || presence === 'away') {
        // Check how long they've been unavailable
        // This would integrate with presence tracking
        return true
      }
    }

    return false
  }

  private async executeEscalationActions(instance: EscalationInstance, rule: EscalationRule, notification: any): Promise<void> {
    for (const action of rule.actions) {
      try {
        const result = await this.executeAction(action, notification, instance)

        const executedAction: ExecutedAction = {
          actionType: action.type,
          executedAt: new Date(),
          success: result.success,
          result: result.data,
          error: result.error,
          retryCount: 0
        }

        instance.executedActions.push(executedAction)

        if (result.success) {
          logger.info(`Executed escalation action ${action.type} for ${instance.id}`)
        } else {
          logger.error(`Failed to execute escalation action ${action.type} for ${instance.id}: ${result.error}`)
        }
      } catch (error) {
        logger.error(`Error executing action ${action.type}:`, error)
      }
    }

    await this.updateEscalationInstance(instance)
  }

  private async executeAction(action: EscalationAction, notification: any, instance: EscalationInstance): Promise<ActionResult> {
    switch (action.type) {
      case 'notify_user':
        return this.executeNotifyUserAction(action, notification, instance)

      case 'notify_role':
        return this.executeNotifyRoleAction(action, notification, instance)

      case 'change_priority':
        return this.executeChangePriorityAction(action, notification, instance)

      case 'change_channels':
        return this.executeChangeChannelsAction(action, notification, instance)

      case 'create_ticket':
        return this.executeCreateTicketAction(action, notification, instance)

      case 'webhook':
        return this.executeWebhookAction(action, notification, instance)

      case 'sms_fallback':
        return this.executeSMSFallbackAction(action, notification, instance)

      default:
        return { success: false, error: `Unknown action type: ${action.type}` }
    }
  }

  private async executeNotifyUserAction(action: EscalationAction, notification: any, instance: EscalationInstance): Promise<ActionResult> {
    const userId = action.parameters.userId === 'notification_author' ? notification.authorId : action.parameters.userId
    const message = action.parameters.message || `Escalation alert for notification ${notification.id}`

    const escalationNotification: NotificationPayload = {
      type: 'escalation_alert',
      title: 'Notification Escalation',
      message,
      priority: 'high',
      targetUsers: [userId],
      channels: action.parameters.channels || ['socket', 'email'],
      data: {
        originalNotificationId: notification.id,
        escalationInstanceId: instance.id,
        escalationLevel: instance.escalationLevel
      }
    }

    try {
      await this.realtimeEngine.sendNotification(escalationNotification)
      return { success: true, data: { notifiedUser: userId } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async executeNotifyRoleAction(action: EscalationAction, notification: any, instance: EscalationInstance): Promise<ActionResult> {
    const role = action.parameters.role
    const excludeUsers = action.parameters.excludeUsers || []
    const channels = action.parameters.channels || ['socket', 'email']

    const escalationNotification: NotificationPayload = {
      type: 'escalation_alert',
      title: `Escalation Alert - ${role.toUpperCase()}`,
      message: `Notification ${notification.id} has been escalated to ${role} team`,
      priority: 'high',
      targetRoles: [role],
      channels,
      data: {
        originalNotificationId: notification.id,
        escalationInstanceId: instance.id,
        escalationLevel: instance.escalationLevel,
        excludeUsers
      }
    }

    try {
      await this.realtimeEngine.sendToRole(role, escalationNotification)
      return { success: true, data: { notifiedRole: role } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async executeChangePriorityAction(action: EscalationAction, notification: any, _instance: EscalationInstance): Promise<ActionResult> {
    const newPriority = action.parameters.newPriority

    try {
      // Update the original notification priority
      await executeRun(`
        UPDATE notifications
        SET priority = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newPriority, notification.id])

      return { success: true, data: { oldPriority: notification.priority, newPriority } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async executeChangeChannelsAction(action: EscalationAction, notification: any, instance: EscalationInstance): Promise<ActionResult> {
    const newChannels = action.parameters.channels

    // Create a new notification with updated channels
    const escalatedNotification: NotificationPayload = {
      ...notification,
      id: `${notification.id}_escalated_${instance.escalationLevel}`,
      channels: newChannels,
      metadata: {
        ...notification.metadata,
        isEscalated: true,
        originalNotificationId: notification.id,
        escalationLevel: instance.escalationLevel
      }
    }

    try {
      await this.realtimeEngine.sendNotification(escalatedNotification)
      return { success: true, data: { newChannels } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async executeCreateTicketAction(action: EscalationAction, notification: any, _instance: EscalationInstance): Promise<ActionResult> {
    const ticketData = {
      title: action.parameters.title || `Escalation for notification ${notification.id}`,
      description: `Auto-generated ticket due to notification escalation.\n\nOriginal notification: ${notification.title}\nMessage: ${notification.message}`,
      priority: action.parameters.priority || 'high',
      category: action.parameters.category || 'escalation',
      user_id: notification.targetUsers?.[0] || 1,
      created_by: 'system'
    }

    try {
      const result = await executeRun(`
        INSERT INTO tickets (title, description, priority, category_id, user_id, status)
        VALUES (?, ?, ?, (SELECT id FROM categories WHERE name = ? LIMIT 1), ?, 'open')
      `, [ticketData.title, ticketData.description, ticketData.priority, ticketData.category, ticketData.user_id])

      return { success: true, data: { ticketId: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async executeWebhookAction(action: EscalationAction, notification: any, instance: EscalationInstance): Promise<ActionResult> {
    const webhookUrl = action.parameters.url
    const payload = {
      escalationId: instance.id,
      notificationId: notification.id,
      escalationLevel: instance.escalationLevel,
      timestamp: new Date().toISOString(),
      notification,
      customData: action.parameters.customData
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`)
      }

      return { success: true, data: { response: await response.text() } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async executeSMSFallbackAction(action: EscalationAction, notification: any, _instance: EscalationInstance): Promise<ActionResult> {
    // This would integrate with SMS service (Twilio, etc.)
    const phoneNumbers = action.parameters.phoneNumbers || []
    const message = `URGENT: ${notification.title} - ${notification.message}`

    try {
      // Placeholder for SMS implementation
      logger.info(`SMS fallback would send to: ${phoneNumbers.join(', ')}`)
      return { success: true, data: { phoneNumbers, message } }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private scheduleNextEscalation(instance: EscalationInstance, rule: EscalationRule): void {
    instance.escalationLevel++

    if (instance.escalationLevel > rule.maxEscalations) {
      this.completeEscalation(instance.id, 'Max escalations reached')
      return
    }

    // Schedule next escalation based on cooldown
    instance.nextActionAt = new Date(Date.now() + rule.cooldownPeriod * 60 * 1000)
    instance.status = 'pending'

    this.updateEscalationInstance(instance)
    this.scheduleEscalationAction(instance)

    logger.info(`Scheduled next escalation for ${instance.id} at level ${instance.escalationLevel}`)
  }

  private async isInCooldown(rule: EscalationRule, notification: any): Promise<boolean> {
    try {
      const lastEscalation = await executeQueryOne<{ last_action: string | null }>(`
        SELECT MAX(last_action_at) as last_action
        FROM escalation_instances
        WHERE notification_id = ? AND rule_id = ?
        AND status IN ('completed', 'executing')
      `, [notification.id, rule.id])

      if (!lastEscalation?.last_action) return false

      const lastActionTime = new Date(lastEscalation.last_action)
      const cooldownEndTime = new Date(lastActionTime.getTime() + rule.cooldownPeriod * 60 * 1000)

      return new Date() < cooldownEndTime
    } catch (error) {
      logger.error('Error checking cooldown', error)
      return false
    }
  }

  private completeEscalation(instanceId: string, reason: string): void {
    const instance = this.activeEscalations.get(instanceId)
    if (instance) {
      instance.status = 'completed'
      instance.metadata = { ...instance.metadata, completionReason: reason }
      this.updateEscalationInstance(instance)
      this.activeEscalations.delete(instanceId)

      const timer = this.escalationTimers.get(instanceId)
      if (timer) {
        clearTimeout(timer)
        this.escalationTimers.delete(instanceId)
      }

      logger.info(`Completed escalation ${instanceId}: ${reason}`)
    }
  }

  private cancelEscalation(instanceId: string, reason: string): void {
    const instance = this.activeEscalations.get(instanceId)
    if (instance) {
      instance.status = 'cancelled'
      instance.metadata = { ...instance.metadata, cancellationReason: reason }
      this.updateEscalationInstance(instance)
      this.activeEscalations.delete(instanceId)

      const timer = this.escalationTimers.get(instanceId)
      if (timer) {
        clearTimeout(timer)
        this.escalationTimers.delete(instanceId)
      }

      logger.info(`Cancelled escalation ${instanceId}: ${reason}`)
    }
  }

  private failEscalation(instanceId: string, error: string): void {
    const instance = this.activeEscalations.get(instanceId)
    if (instance) {
      instance.status = 'failed'
      instance.metadata = { ...instance.metadata, error }
      this.updateEscalationInstance(instance)
      this.activeEscalations.delete(instanceId)

      const timer = this.escalationTimers.get(instanceId)
      if (timer) {
        clearTimeout(timer)
        this.escalationTimers.delete(instanceId)
      }

      logger.error(`Failed escalation ${instanceId}: ${error}`)
    }
  }

  // Database operations
  private async persistEscalationInstance(instance: EscalationInstance): Promise<void> {
    try {
      await executeRun(`
        INSERT INTO escalation_instances (
          id, notification_id, rule_id, triggered_at, executed_actions,
          status, escalation_level, last_action_at, next_action_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        instance.id,
        instance.notificationId,
        instance.ruleId,
        instance.triggeredAt.toISOString(),
        JSON.stringify(instance.executedActions),
        instance.status,
        instance.escalationLevel,
        instance.lastActionAt?.toISOString() || null,
        instance.nextActionAt?.toISOString() || null,
        JSON.stringify(instance.metadata)
      ])
    } catch (error) {
      logger.error('Error persisting escalation instance', error)
    }
  }

  private async updateEscalationInstance(instance: EscalationInstance): Promise<void> {
    try {
      await executeRun(`
        UPDATE escalation_instances
        SET executed_actions = ?, status = ?, escalation_level = ?,
            last_action_at = ?, next_action_at = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        JSON.stringify(instance.executedActions),
        instance.status,
        instance.escalationLevel,
        instance.lastActionAt?.toISOString() || null,
        instance.nextActionAt?.toISOString() || null,
        JSON.stringify(instance.metadata),
        instance.id
      ])
    } catch (error) {
      logger.error('Error updating escalation instance', error)
    }
  }

  private async getNotificationDetails(notificationId: string): Promise<Record<string, any> | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      return await executeQueryOne(`
        SELECT * FROM notifications WHERE id = ?
      `, [notificationId]) || null
    } catch (error) {
      logger.error('Error getting notification details', error)
      return null
    }
  }

  // Public API methods
  public async createEscalationRule(rule: Omit<EscalationRule, 'id' | 'createdAt' | 'updatedAt'>, createdBy: number): Promise<string> {
    const ruleId = `rule_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}`
    const now = new Date()

    const fullRule: EscalationRule = {
      ...rule,
      id: ruleId,
      createdBy,
      createdAt: now,
      updatedAt: now
    }

    try {
      await executeRun(`
        INSERT INTO escalation_rules (
          id, name, description, conditions, actions, priority,
          is_active, cooldown_period, max_escalations, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ruleId,
        rule.name,
        rule.description,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.priority,
        rule.isActive ? 1 : 0,
        rule.cooldownPeriod,
        rule.maxEscalations,
        createdBy,
        now.toISOString(),
        now.toISOString()
      ])

      this.escalationRules.push(fullRule)
      this.escalationRules.sort((a, b) => b.priority - a.priority)

      logger.info(`Created escalation rule: ${ruleId}`)
      return ruleId
    } catch (error) {
      logger.error('Error creating escalation rule', error)
      throw error
    }
  }

  public processEscalations(): void {
    // This method is called periodically to check for escalations that need processing
    const now = new Date()

    for (const [instanceId, instance] of this.activeEscalations.entries()) {
      if (instance.status === 'pending' &&
          instance.nextActionAt &&
          instance.nextActionAt <= now) {
        setImmediate(() => this.executeEscalation(instanceId))
      }
    }
  }

  public getEscalationStats(): any {
    return {
      activeEscalations: this.activeEscalations.size,
      totalRules: this.escalationRules.length,
      activeRules: this.escalationRules.filter(r => r.isActive).length,
      scheduledTimers: this.escalationTimers.size
    }
  }

  public getActiveEscalations(): EscalationInstance[] {
    return Array.from(this.activeEscalations.values())
  }

  public getEscalationRules(): EscalationRule[] {
    return [...this.escalationRules]
  }

  private processingInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  private setupEscalationProcessing(): void {
    // Process escalations every minute
    this.processingInterval = setInterval(() => {
      this.processEscalations()
    }, 60000)

    // Cleanup completed escalations daily
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEscalations()
    }, 24 * 60 * 60 * 1000)
  }

  public stopEscalationMonitor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    // Clear all scheduled escalation timers
    for (const [id, timer] of this.escalationTimers) {
      clearTimeout(timer)
      this.escalationTimers.delete(id)
    }
    logger.info('Escalation monitor stopped')
  }

  private async cleanupOldEscalations(): Promise<void> {
    try {
      const dialectIsPostgres = getDatabaseType() === 'postgresql'
      const cutoffExpr = dialectIsPostgres
        ? `NOW() - INTERVAL '30 days'`
        : `datetime('now', '-30 days')`

      const deleted = await executeRun(`
        DELETE FROM escalation_instances
        WHERE status IN ('completed', 'cancelled', 'failed')
        AND triggered_at < ${cutoffExpr}
      `, [])

      if (deleted.changes > 0) {
        logger.info(`Cleaned up ${deleted.changes} old escalation instances`)
      }
    } catch (error) {
      logger.error('Error cleaning up old escalations', error)
    }
  }
}
