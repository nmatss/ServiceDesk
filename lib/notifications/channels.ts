import nodemailer from 'nodemailer'
import { WebClient } from '@slack/web-api'
import { Client } from '@microsoft/microsoft-graph-client'
import { NotificationPayload } from './realtime-engine'
import { getDb } from '@/lib/db'
import { logger } from '../monitoring/logger';

export interface NotificationChannel {
  name: string
  type: 'email' | 'push' | 'sms' | 'webhook' | 'teams' | 'slack' | 'whatsapp'
  isEnabled: boolean
  config: any
  priority: number
  rateLimit?: {
    maxPerMinute: number
    maxPerHour: number
    maxPerDay: number
  }
  retryPolicy?: {
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
}

export interface DeliveryResult {
  success: boolean
  channel: string
  messageId?: string
  error?: string
  timestamp: Date
  retryCount?: number
}

export class NotificationChannelManager {
  private db = getDb()
  private channels = new Map<string, NotificationChannel>()
  private rateLimiters = new Map<string, any>()
  private retryQueues = new Map<string, any[]>()

  // Email configuration
  private emailTransporter: nodemailer.Transporter | null = null

  // Slack configuration
  private slackClient: WebClient | null = null

  // Teams configuration
  private teamsClient: Client | null = null

  // WhatsApp configuration (using Twilio)
  private whatsappConfig: any = null

  constructor() {
    this.initializeChannels()
    this.setupRateLimiters()
    this.setupRetryProcessing()
  }

  private initializeChannels() {
    // Load channels from environment or database
    this.loadChannelConfigurations()
    this.initializeEmailChannel()
    this.initializeSlackChannel()
    this.initializeTeamsChannel()
    this.initializeWhatsAppChannel()
    this.initializePushChannel()
    this.initializeSMSChannel()
  }

  private loadChannelConfigurations() {
    try {
      // Load from database if available
      const configs = this.db.prepare(`
        SELECT * FROM notification_channels WHERE is_enabled = 1
      `).all() as any[]

      for (const config of configs) {
        this.channels.set(config.name, {
          name: config.name,
          type: config.type,
          isEnabled: config.is_enabled,
          config: JSON.parse(config.config || '{}'),
          priority: config.priority || 1,
          rateLimit: config.rate_limit ? JSON.parse(config.rate_limit) : undefined,
          retryPolicy: config.retry_policy ? JSON.parse(config.retry_policy) : undefined
        })
      }
    } catch (error) {
      logger.info('Loading default channel configurations')
      this.loadDefaultChannels()
    }
  }

  private loadDefaultChannels() {
    // Email channel
    this.channels.set('email', {
      name: 'email',
      type: 'email',
      isEnabled: !!process.env.SMTP_HOST,
      config: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        },
        from: process.env.SMTP_FROM || 'noreply@servicedesk.com'
      },
      priority: 1,
      rateLimit: {
        maxPerMinute: 60,
        maxPerHour: 1000,
        maxPerDay: 10000
      },
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 5000,
        backoffMultiplier: 2
      }
    })

    // Slack channel
    this.channels.set('slack', {
      name: 'slack',
      type: 'slack',
      isEnabled: !!process.env.SLACK_BOT_TOKEN,
      config: {
        token: process.env.SLACK_BOT_TOKEN,
        defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || '#servicedesk'
      },
      priority: 2,
      rateLimit: {
        maxPerMinute: 60,
        maxPerHour: 3600,
        maxPerDay: 10000
      },
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 2000,
        backoffMultiplier: 2
      }
    })

    // Teams channel
    this.channels.set('teams', {
      name: 'teams',
      type: 'teams',
      isEnabled: !!process.env.TEAMS_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.TEAMS_WEBHOOK_URL,
        clientId: process.env.TEAMS_CLIENT_ID,
        clientSecret: process.env.TEAMS_CLIENT_SECRET,
        tenantId: process.env.TEAMS_TENANT_ID
      },
      priority: 2,
      rateLimit: {
        maxPerMinute: 30,
        maxPerHour: 1000,
        maxPerDay: 5000
      },
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 3000,
        backoffMultiplier: 2
      }
    })

    // WhatsApp channel (via Twilio)
    this.channels.set('whatsapp', {
      name: 'whatsapp',
      type: 'whatsapp',
      isEnabled: !!process.env.TWILIO_ACCOUNT_SID,
      config: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_WHATSAPP_FROM
      },
      priority: 3,
      rateLimit: {
        maxPerMinute: 10,
        maxPerHour: 100,
        maxPerDay: 1000
      },
      retryPolicy: {
        maxRetries: 2,
        retryDelay: 10000,
        backoffMultiplier: 3
      }
    })

    // Push notifications
    this.channels.set('push', {
      name: 'push',
      type: 'push',
      isEnabled: !!process.env.PUSH_VAPID_PUBLIC_KEY,
      config: {
        vapidPublicKey: process.env.PUSH_VAPID_PUBLIC_KEY,
        vapidPrivateKey: process.env.PUSH_VAPID_PRIVATE_KEY,
        vapidSubject: process.env.PUSH_VAPID_SUBJECT || 'mailto:admin@servicedesk.com'
      },
      priority: 1,
      rateLimit: {
        maxPerMinute: 100,
        maxPerHour: 2000,
        maxPerDay: 10000
      }
    })

    // SMS channel
    this.channels.set('sms', {
      name: 'sms',
      type: 'sms',
      isEnabled: !!process.env.TWILIO_ACCOUNT_SID,
      config: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_PHONE_FROM
      },
      priority: 4,
      rateLimit: {
        maxPerMinute: 5,
        maxPerHour: 50,
        maxPerDay: 500
      },
      retryPolicy: {
        maxRetries: 2,
        retryDelay: 5000,
        backoffMultiplier: 2
      }
    })
  }

  private initializeEmailChannel() {
    const emailChannel = this.channels.get('email')
    if (emailChannel?.isEnabled) {
      try {
        this.emailTransporter = nodemailer.createTransporter(emailChannel.config)
        logger.info('✅ Email channel initialized')
      } catch (error) {
        logger.error('❌ Failed to initialize email channel', error)
        emailChannel.isEnabled = false
      }
    }
  }

  private initializeSlackChannel() {
    const slackChannel = this.channels.get('slack')
    if (slackChannel?.isEnabled) {
      try {
        this.slackClient = new WebClient(slackChannel.config.token)
        logger.info('✅ Slack channel initialized')
      } catch (error) {
        logger.error('❌ Failed to initialize Slack channel', error)
        slackChannel.isEnabled = false
      }
    }
  }

  private initializeTeamsChannel() {
    const teamsChannel = this.channels.get('teams')
    if (teamsChannel?.isEnabled && teamsChannel.config.clientId) {
      try {
        // Initialize Microsoft Graph client for Teams
        this.teamsClient = Client.init({
          authProvider: async (done) => {
            // Implement app-only authentication for Teams
            // This would typically use client credentials flow
            done(null, 'access_token_here')
          }
        })
        logger.info('✅ Teams channel initialized')
      } catch (error) {
        logger.error('❌ Failed to initialize Teams channel', error)
        teamsChannel.isEnabled = false
      }
    }
  }

  private initializeWhatsAppChannel() {
    const whatsappChannel = this.channels.get('whatsapp')
    if (whatsappChannel?.isEnabled) {
      this.whatsappConfig = whatsappChannel.config
      logger.info('✅ WhatsApp channel initialized')
    }
  }

  private initializePushChannel() {
    const pushChannel = this.channels.get('push')
    if (pushChannel?.isEnabled) {
      // Web Push will be handled in the browser
      logger.info('✅ Push notification channel configured')
    }
  }

  private initializeSMSChannel() {
    const smsChannel = this.channels.get('sms')
    if (smsChannel?.isEnabled) {
      logger.info('✅ SMS channel initialized')
    }
  }

  private setupRateLimiters() {
    // Initialize rate limiters for each channel
    for (const [channelName, channel] of this.channels.entries()) {
      if (channel.rateLimit) {
        this.rateLimiters.set(channelName, {
          minute: new Map(),
          hour: new Map(),
          day: new Map(),
          lastCleanup: Date.now()
        })
      }
    }

    // Cleanup rate limiters periodically
    setInterval(() => {
      this.cleanupRateLimiters()
    }, 60000) // Every minute
  }

  private setupRetryProcessing() {
    // Process retry queues periodically
    setInterval(() => {
      this.processRetryQueues()
    }, 30000) // Every 30 seconds
  }

  public async deliverViaChannel(
    channelName: string,
    notification: NotificationPayload,
    userId: number,
    userPreferences: any
  ): Promise<DeliveryResult> {
    const channel = this.channels.get(channelName)
    if (!channel || !channel.isEnabled) {
      return {
        success: false,
        channel: channelName,
        error: 'Channel not available',
        timestamp: new Date()
      }
    }

    // Check rate limits
    if (!(await this.checkRateLimit(channelName, userId))) {
      return {
        success: false,
        channel: channelName,
        error: 'Rate limit exceeded',
        timestamp: new Date()
      }
    }

    try {
      let result: DeliveryResult

      switch (channel.type) {
        case 'email':
          result = await this.deliverViaEmail(notification, userId, userPreferences)
          break
        case 'slack':
          result = await this.deliverViaSlack(notification, userId, userPreferences)
          break
        case 'teams':
          result = await this.deliverViaTeams(notification, userId, userPreferences)
          break
        case 'whatsapp':
          result = await this.deliverViaWhatsApp(notification, userId, userPreferences)
          break
        case 'push':
          result = await this.deliverViaPush(notification, userId, userPreferences)
          break
        case 'sms':
          result = await this.deliverViaSMS(notification, userId, userPreferences)
          break
        default:
          result = {
            success: false,
            channel: channelName,
            error: 'Unknown channel type',
            timestamp: new Date()
          }
      }

      // Update rate limiter
      this.updateRateLimit(channelName, userId)

      // Log delivery
      this.logDelivery(result, notification, userId)

      return result
    } catch (error) {
      const result: DeliveryResult = {
        success: false,
        channel: channelName,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      }

      // Add to retry queue if retry policy exists
      if (channel.retryPolicy) {
        this.addToRetryQueue(channelName, notification, userId, userPreferences, 0)
      }

      return result
    }
  }

  private async deliverViaEmail(
    notification: NotificationPayload,
    userId: number,
    userPreferences: any
  ): Promise<DeliveryResult> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured')
    }

    const user = await this.getUserInfo(userId)
    if (!user?.email) {
      throw new Error('User email not found')
    }

    const emailContent = await this.generateEmailContent(notification, user)

    const mailOptions = {
      from: this.channels.get('email')!.config.from,
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text
    }

    const info = await this.emailTransporter.sendMail(mailOptions)

    return {
      success: true,
      channel: 'email',
      messageId: info.messageId,
      timestamp: new Date()
    }
  }

  private async deliverViaSlack(
    notification: NotificationPayload,
    userId: number,
    userPreferences: any
  ): Promise<DeliveryResult> {
    if (!this.slackClient) {
      throw new Error('Slack client not configured')
    }

    const user = await this.getUserInfo(userId)
    const slackUserId = userPreferences.slackUserId || this.getSlackUserByEmail(user?.email)

    if (!slackUserId) {
      // Send to default channel
      const channel = userPreferences.slackChannel || this.channels.get('slack')!.config.defaultChannel
      const slackMessage = this.formatSlackMessage(notification, user)

      const result = await this.slackClient.chat.postMessage({
        channel,
        ...slackMessage
      })

      return {
        success: true,
        channel: 'slack',
        messageId: result.ts,
        timestamp: new Date()
      }
    } else {
      // Send DM to user
      const slackMessage = this.formatSlackMessage(notification, user)

      const result = await this.slackClient.chat.postMessage({
        channel: slackUserId,
        ...slackMessage
      })

      return {
        success: true,
        channel: 'slack',
        messageId: result.ts,
        timestamp: new Date()
      }
    }
  }

  private async deliverViaTeams(
    notification: NotificationPayload,
    userId: number,
    userPreferences: any
  ): Promise<DeliveryResult> {
    const teamsChannel = this.channels.get('teams')!
    const user = await this.getUserInfo(userId)

    // Use webhook for simple messages
    if (teamsChannel.config.webhookUrl) {
      const teamsMessage = this.formatTeamsMessage(notification, user)

      const response = await fetch(teamsChannel.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsMessage)
      })

      if (!response.ok) {
        throw new Error(`Teams webhook failed: ${response.statusText}`)
      }

      return {
        success: true,
        channel: 'teams',
        messageId: `webhook_${Date.now()}`,
        timestamp: new Date()
      }
    }

    // Use Graph API for more advanced features
    if (this.teamsClient && userPreferences.teamsUserId) {
      const teamsMessage = this.formatTeamsMessage(notification, user)

      // Send message via Graph API
      // Implementation would depend on specific Teams integration requirements

      return {
        success: true,
        channel: 'teams',
        messageId: `graph_${Date.now()}`,
        timestamp: new Date()
      }
    }

    throw new Error('Teams delivery method not configured')
  }

  private async deliverViaWhatsApp(
    notification: NotificationPayload,
    userId: number,
    userPreferences: any
  ): Promise<DeliveryResult> {
    if (!this.whatsappConfig) {
      throw new Error('WhatsApp not configured')
    }

    const user = await this.getUserInfo(userId)
    const phoneNumber = user?.phone || userPreferences.whatsappNumber

    if (!phoneNumber) {
      throw new Error('User phone number not found')
    }

    const twilio = require('twilio')(
      this.whatsappConfig.accountSid,
      this.whatsappConfig.authToken
    )

    const message = await twilio.messages.create({
      from: `whatsapp:${this.whatsappConfig.fromNumber}`,
      to: `whatsapp:${phoneNumber}`,
      body: this.formatWhatsAppMessage(notification, user)
    })

    return {
      success: true,
      channel: 'whatsapp',
      messageId: message.sid,
      timestamp: new Date()
    }
  }

  private async deliverViaPush(
    notification: NotificationPayload,
    userId: number,
    userPreferences: any
  ): Promise<DeliveryResult> {
    // Get user's push subscriptions
    const subscriptions = await this.getUserPushSubscriptions(userId)

    if (subscriptions.length === 0) {
      throw new Error('No push subscriptions found for user')
    }

    const webpush = require('web-push')
    const pushChannel = this.channels.get('push')!

    webpush.setVapidDetails(
      pushChannel.config.vapidSubject,
      pushChannel.config.vapidPublicKey,
      pushChannel.config.vapidPrivateKey
    )

    const pushPayload = {
      title: notification.title,
      body: notification.message,
      icon: '/icons/notification-icon.png',
      badge: '/icons/badge-icon.png',
      data: {
        id: notification.id,
        type: notification.type,
        ticketId: notification.ticketId,
        url: this.getNotificationUrl(notification)
      }
    }

    const promises = subscriptions.map(async (subscription: any) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(pushPayload))
        return { success: true, subscription: subscription.endpoint }
      } catch (error) {
        logger.error('Push notification failed', error)
        // Remove invalid subscription
        if (error.statusCode === 410) {
          await this.removeInvalidPushSubscription(subscription.id)
        }
        return { success: false, subscription: subscription.endpoint, error }
      }
    })

    const results = await Promise.allSettled(promises)
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length

    return {
      success: successCount > 0,
      channel: 'push',
      messageId: `push_${Date.now()}`,
      timestamp: new Date()
    }
  }

  private async deliverViaSMS(
    notification: NotificationPayload,
    userId: number,
    userPreferences: any
  ): Promise<DeliveryResult> {
    const smsChannel = this.channels.get('sms')!
    const user = await this.getUserInfo(userId)
    const phoneNumber = user?.phone || userPreferences.smsNumber

    if (!phoneNumber) {
      throw new Error('User phone number not found')
    }

    const twilio = require('twilio')(
      smsChannel.config.accountSid,
      smsChannel.config.authToken
    )

    const message = await twilio.messages.create({
      from: smsChannel.config.fromNumber,
      to: phoneNumber,
      body: this.formatSMSMessage(notification, user)
    })

    return {
      success: true,
      channel: 'sms',
      messageId: message.sid,
      timestamp: new Date()
    }
  }

  // Message formatting methods
  private async generateEmailContent(notification: NotificationPayload, user: any) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const ticketUrl = notification.ticketId ? `${baseUrl}/tickets/${notification.ticketId}` : baseUrl

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${notification.title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background: ${this.getPriorityColor(notification.priority)}; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">${notification.title}</h1>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Olá ${user.name},</p>
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">${notification.message}</p>

              ${notification.ticketId ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p style="margin: 0; color: #666;"><strong>Ticket:</strong> #${notification.ticketId}</p>
                </div>
              ` : ''}

              ${notification.data ? `
                <div style="margin: 20px 0;">
                  <h3 style="color: #333; margin-bottom: 10px;">Detalhes:</h3>
                  <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(notification.data, null, 2)}</pre>
                </div>
              ` : ''}

              <div style="text-align: center; margin-top: 30px;">
                <a href="${ticketUrl}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Ver no ServiceDesk</a>
              </div>
            </div>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
              <p style="margin: 0;">ServiceDesk - Sistema de Atendimento</p>
              <p style="margin: 5px 0 0 0;">Este é um email automático, não responda.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
      ${notification.title}

      Olá ${user.name},

      ${notification.message}

      ${notification.ticketId ? `Ticket: #${notification.ticketId}` : ''}

      Acesse: ${ticketUrl}

      ServiceDesk - Sistema de Atendimento
    `

    return {
      subject: `[ServiceDesk] ${notification.title}`,
      html,
      text
    }
  }

  private formatSlackMessage(notification: NotificationPayload, user: any) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: notification.title
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.message
        }
      }
    ]

    if (notification.ticketId) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Ticket:* #${notification.ticketId}`
          },
          {
            type: 'mrkdwn',
            text: `*Prioridade:* ${notification.priority}`
          }
        ]
      })

      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Ver Ticket'
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/tickets/${notification.ticketId}`
          }
        ]
      })
    }

    return {
      text: notification.title,
      blocks
    }
  }

  private formatTeamsMessage(notification: NotificationPayload, user: any) {
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getPriorityColor(notification.priority),
      summary: notification.title,
      sections: [
        {
          activityTitle: notification.title,
          activitySubtitle: notification.message,
          activityImage: 'https://servicedesk.com/logo.png',
          facts: notification.ticketId ? [
            {
              name: 'Ticket',
              value: `#${notification.ticketId}`
            },
            {
              name: 'Prioridade',
              value: notification.priority
            }
          ] : [],
          markdown: true
        }
      ],
      potentialAction: notification.ticketId ? [
        {
          '@type': 'OpenUri',
          name: 'Ver Ticket',
          targets: [
            {
              os: 'default',
              uri: `${process.env.NEXT_PUBLIC_APP_URL}/tickets/${notification.ticketId}`
            }
          ]
        }
      ] : []
    }
  }

  private formatWhatsAppMessage(notification: NotificationPayload, user: any): string {
    let message = `🔔 *${notification.title}*\n\n${notification.message}`

    if (notification.ticketId) {
      message += `\n\n📋 Ticket: #${notification.ticketId}`
    }

    if (notification.priority === 'critical' || notification.priority === 'high') {
      message = `🚨 ${message}`
    }

    message += `\n\n🔗 ${process.env.NEXT_PUBLIC_APP_URL}/tickets/${notification.ticketId || ''}`

    return message
  }

  private formatSMSMessage(notification: NotificationPayload, user: any): string {
    let message = `ServiceDesk: ${notification.title}`

    if (notification.ticketId) {
      message += ` - Ticket #${notification.ticketId}`
    }

    // SMS has character limits
    if (message.length > 160) {
      message = message.substring(0, 155) + '...'
    }

    return message
  }

  // Rate limiting
  private async checkRateLimit(channelName: string, userId: number): Promise<boolean> {
    const channel = this.channels.get(channelName)
    if (!channel?.rateLimit) return true

    const limiter = this.rateLimiters.get(channelName)
    if (!limiter) return true

    const now = Date.now()
    const userKey = `${channelName}_${userId}`

    // Check minute limit
    if (channel.rateLimit.maxPerMinute) {
      const minuteKey = Math.floor(now / 60000)
      const minuteCount = limiter.minute.get(`${userKey}_${minuteKey}`) || 0
      if (minuteCount >= channel.rateLimit.maxPerMinute) return false
    }

    // Check hour limit
    if (channel.rateLimit.maxPerHour) {
      const hourKey = Math.floor(now / 3600000)
      const hourCount = limiter.hour.get(`${userKey}_${hourKey}`) || 0
      if (hourCount >= channel.rateLimit.maxPerHour) return false
    }

    // Check day limit
    if (channel.rateLimit.maxPerDay) {
      const dayKey = Math.floor(now / 86400000)
      const dayCount = limiter.day.get(`${userKey}_${dayKey}`) || 0
      if (dayCount >= channel.rateLimit.maxPerDay) return false
    }

    return true
  }

  private updateRateLimit(channelName: string, userId: number) {
    const channel = this.channels.get(channelName)
    if (!channel?.rateLimit) return

    const limiter = this.rateLimiters.get(channelName)
    if (!limiter) return

    const now = Date.now()
    const userKey = `${channelName}_${userId}`

    // Update minute counter
    if (channel.rateLimit.maxPerMinute) {
      const minuteKey = Math.floor(now / 60000)
      const key = `${userKey}_${minuteKey}`
      limiter.minute.set(key, (limiter.minute.get(key) || 0) + 1)
    }

    // Update hour counter
    if (channel.rateLimit.maxPerHour) {
      const hourKey = Math.floor(now / 3600000)
      const key = `${userKey}_${hourKey}`
      limiter.hour.set(key, (limiter.hour.get(key) || 0) + 1)
    }

    // Update day counter
    if (channel.rateLimit.maxPerDay) {
      const dayKey = Math.floor(now / 86400000)
      const key = `${userKey}_${dayKey}`
      limiter.day.set(key, (limiter.day.get(key) || 0) + 1)
    }
  }

  private cleanupRateLimiters() {
    const now = Date.now()

    for (const [channelName, limiter] of this.rateLimiters.entries()) {
      // Clean minute counters older than 1 hour
      const oneHourAgo = Math.floor((now - 3600000) / 60000)
      for (const key of limiter.minute.keys()) {
        const keyTime = parseInt(key.split('_').pop() || '0')
        if (keyTime < oneHourAgo) {
          limiter.minute.delete(key)
        }
      }

      // Clean hour counters older than 1 day
      const oneDayAgo = Math.floor((now - 86400000) / 3600000)
      for (const key of limiter.hour.keys()) {
        const keyTime = parseInt(key.split('_').pop() || '0')
        if (keyTime < oneDayAgo) {
          limiter.hour.delete(key)
        }
      }

      // Clean day counters older than 30 days
      const thirtyDaysAgo = Math.floor((now - 30 * 86400000) / 86400000)
      for (const key of limiter.day.keys()) {
        const keyTime = parseInt(key.split('_').pop() || '0')
        if (keyTime < thirtyDaysAgo) {
          limiter.day.delete(key)
        }
      }
    }
  }

  // Retry logic
  private addToRetryQueue(
    channelName: string,
    notification: NotificationPayload,
    userId: number,
    userPreferences: any,
    retryCount: number
  ) {
    if (!this.retryQueues.has(channelName)) {
      this.retryQueues.set(channelName, [])
    }

    const channel = this.channels.get(channelName)
    if (!channel?.retryPolicy || retryCount >= channel.retryPolicy.maxRetries) {
      return
    }

    const retryDelay = channel.retryPolicy.retryDelay * Math.pow(channel.retryPolicy.backoffMultiplier, retryCount)
    const retryAt = Date.now() + retryDelay

    this.retryQueues.get(channelName)!.push({
      notification,
      userId,
      userPreferences,
      retryCount: retryCount + 1,
      retryAt
    })
  }

  private async processRetryQueues() {
    const now = Date.now()

    for (const [channelName, queue] of this.retryQueues.entries()) {
      const readyItems = queue.filter(item => item.retryAt <= now)

      for (const item of readyItems) {
        try {
          await this.deliverViaChannel(channelName, item.notification, item.userId, item.userPreferences)
          // Remove from queue on success
          const index = queue.indexOf(item)
          if (index > -1) queue.splice(index, 1)
        } catch (error) {
          // Add back to retry queue with incremented count
          const index = queue.indexOf(item)
          if (index > -1) queue.splice(index, 1)

          this.addToRetryQueue(
            channelName,
            item.notification,
            item.userId,
            item.userPreferences,
            item.retryCount
          )
        }
      }
    }
  }

  // Helper methods
  private async getUserInfo(userId: number): Promise<any> {
    try {
      return this.db.prepare(`
        SELECT id, name, email, phone FROM users WHERE id = ?
      `).get(userId)
    } catch (error) {
      logger.error('Error getting user info', error)
      return null
    }
  }

  private async getSlackUserByEmail(email: string): Promise<string | null> {
    if (!this.slackClient || !email) return null

    try {
      const result = await this.slackClient.users.lookupByEmail({ email })
      return result.user?.id || null
    } catch (error) {
      logger.error('Error looking up Slack user', error)
      return null
    }
  }

  private async getUserPushSubscriptions(userId: number): Promise<any[]> {
    try {
      return this.db.prepare(`
        SELECT * FROM push_subscriptions
        WHERE user_id = ? AND is_active = 1
      `).all(userId) as any[]
    } catch (error) {
      logger.error('Error getting push subscriptions', error)
      return []
    }
  }

  private async removeInvalidPushSubscription(subscriptionId: string) {
    try {
      this.db.prepare(`
        UPDATE push_subscriptions
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(subscriptionId)
    } catch (error) {
      logger.error('Error removing invalid push subscription', error)
    }
  }

  private getNotificationUrl(notification: NotificationPayload): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (notification.ticketId) {
      return `${baseUrl}/tickets/${notification.ticketId}`
    }

    return `${baseUrl}/notifications`
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'low': return '#28a745'
      case 'medium': return '#ffc107'
      case 'high': return '#fd7e14'
      case 'critical': return '#dc3545'
      default: return '#6c757d'
    }
  }

  private logDelivery(result: DeliveryResult, notification: NotificationPayload, userId: number) {
    try {
      this.db.prepare(`
        INSERT INTO notification_deliveries (
          notification_id, user_id, channel, success, message_id, error, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        notification.id,
        userId,
        result.channel,
        result.success ? 1 : 0,
        result.messageId || null,
        result.error || null,
        result.timestamp.toISOString()
      )
    } catch (error) {
      logger.error('Error logging delivery', error)
    }
  }

  // Public methods
  public getAvailableChannels(): NotificationChannel[] {
    return Array.from(this.channels.values()).filter(c => c.isEnabled)
  }

  public getChannelStatus(channelName: string): NotificationChannel | null {
    return this.channels.get(channelName) || null
  }

  public async testChannel(channelName: string, testUserId: number): Promise<DeliveryResult> {
    const testNotification: NotificationPayload = {
      type: 'test',
      title: 'Teste de Notificação',
      message: 'Esta é uma mensagem de teste do sistema de notificações.',
      priority: 'low',
      channels: [channelName]
    }

    return this.deliverViaChannel(channelName, testNotification, testUserId, {})
  }

  public getDeliveryStats(channelName?: string): any {
    try {
      let query = `
        SELECT
          channel,
          COUNT(*) as total,
          COUNT(CASE WHEN success = 1 THEN 1 END) as successful,
          COUNT(CASE WHEN success = 0 THEN 1 END) as failed
        FROM notification_deliveries
        WHERE timestamp > datetime('now', '-24 hours')
      `

      if (channelName) {
        query += ' AND channel = ?'
        query += ' GROUP BY channel'
        return this.db.prepare(query).get(channelName)
      } else {
        query += ' GROUP BY channel'
        return this.db.prepare(query).all()
      }
    } catch (error) {
      logger.error('Error getting delivery stats', error)
      return null
    }
  }
}