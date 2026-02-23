import { getDb } from '@/lib/db'
import logger from '../monitoring/structured-logger';

export interface UserPresence {
  userId: number
  status: 'online' | 'away' | 'busy' | 'offline'
  lastSeen: Date
  deviceInfo?: {
    platform: string
    browser: string
    isMobile: boolean
  }
  location?: {
    timezone: string
    country?: string
    city?: string
  }
  activity?: {
    currentPage?: string
    lastActivity: Date
    idleTime: number // seconds
  }
  statusMessage?: string
  availableUntil?: Date // For temporary status changes
}

export interface PresenceSettings {
  userId: number
  autoAway: {
    enabled: boolean
    idleMinutes: number
  }
  workingHours: {
    enabled: boolean
    timezone: string
    schedule: {
      [key: string]: { // day of week (0-6)
        enabled: boolean
        start: string // HH:mm
        end: string   // HH:mm
      }
    }
  }
  statusVisibility: 'everyone' | 'team' | 'managers' | 'private'
  showLastSeen: boolean
  allowInterruptions: {
    critical: boolean
    high: boolean
    medium: boolean
    low: boolean
  }
}

export interface PresenceEvent {
  userId: number
  event: 'online' | 'offline' | 'away' | 'busy' | 'idle' | 'active'
  timestamp: Date
  metadata?: any
}

export class PresenceManager {
  private db = getDb()
  private realtimeEngine: any
  private userPresences = new Map<number, UserPresence>()
  private presenceSettings = new Map<number, PresenceSettings>()
  private presenceTimers = new Map<number, NodeJS.Timeout>()
  private activityTrackers = new Map<number, NodeJS.Timeout>()
  private hasPresenceSettingsColumn: boolean | null = null

  // Default presence settings
  private readonly DEFAULT_SETTINGS: Omit<PresenceSettings, 'userId'> = {
    autoAway: {
      enabled: true,
      idleMinutes: 10
    },
    workingHours: {
      enabled: false,
      timezone: 'America/Sao_Paulo',
      schedule: {
        '1': { enabled: true, start: '09:00', end: '18:00' }, // Monday
        '2': { enabled: true, start: '09:00', end: '18:00' }, // Tuesday
        '3': { enabled: true, start: '09:00', end: '18:00' }, // Wednesday
        '4': { enabled: true, start: '09:00', end: '18:00' }, // Thursday
        '5': { enabled: true, start: '09:00', end: '18:00' }, // Friday
        '0': { enabled: false, start: '09:00', end: '18:00' }, // Sunday
        '6': { enabled: false, start: '09:00', end: '18:00' }  // Saturday
      }
    },
    statusVisibility: 'team',
    showLastSeen: true,
    allowInterruptions: {
      critical: true,
      high: true,
      medium: false,
      low: false
    }
  }

  constructor(realtimeEngine: any) {
    this.realtimeEngine = realtimeEngine
    this.ensurePresenceSchema()
    this.loadPresenceData()
    this.setupPresenceTracking()
  }

  private ensurePresenceSchema() {
    try {
      const columns = this.db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>
      this.hasPresenceSettingsColumn = columns.some((column) => column.name === 'presence_settings')
      if (!this.hasPresenceSettingsColumn) {
        this.db.prepare(`ALTER TABLE users ADD COLUMN presence_settings TEXT`).run()
        this.hasPresenceSettingsColumn = true
      }

      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS user_presence (
          user_id INTEGER PRIMARY KEY,
          status TEXT NOT NULL,
          last_seen DATETIME NOT NULL,
          device_info TEXT,
          location_info TEXT,
          activity_info TEXT,
          status_message TEXT,
          available_until DATETIME
        )
      `).run()

      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS presence_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          event TEXT NOT NULL,
          metadata TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()

      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_presence_events_user
        ON presence_events(user_id, timestamp DESC)
      `).run()
    } catch (error) {
      logger.warn('Presence schema ensure failed', error)
      this.hasPresenceSettingsColumn = false
    }
  }

  private loadPresenceData() {
    try {
      // Load user presence settings
      if (this.hasPresenceSettingsColumn) {
        const settings = this.db.prepare(`
          SELECT id as user_id, presence_settings FROM users
          WHERE presence_settings IS NOT NULL
        `).all() as any[]

        for (const setting of settings) {
          try {
            const presenceSettings = JSON.parse(setting.presence_settings)
            this.presenceSettings.set(setting.user_id, this.normalizeSettings(presenceSettings, setting.user_id))
          } catch (error) {
            logger.error(`Error parsing presence settings for user ${setting.user_id}:`, error)
          }
        }
      }

      // Load current presence states
      const presences = this.db.prepare(`
        SELECT * FROM user_presence WHERE last_seen > datetime('now', '-1 hour')
      `).all() as any[]

      for (const presence of presences) {
        const userPresence: UserPresence = {
          userId: presence.user_id,
          status: presence.status,
          lastSeen: new Date(presence.last_seen),
          deviceInfo: presence.device_info ? JSON.parse(presence.device_info) : undefined,
          location: presence.location_info ? JSON.parse(presence.location_info) : undefined,
          activity: presence.activity_info ? JSON.parse(presence.activity_info) : undefined,
          statusMessage: presence.status_message,
          availableUntil: presence.available_until ? new Date(presence.available_until) : undefined
        }

        this.userPresences.set(presence.user_id, userPresence)
      }

      logger.info(`Loaded presence data for ${presences.length} users`)
    } catch (error) {
      logger.error('Error loading presence data', error)
    }
  }

  private normalizeSettings(settings: any, userId: number): PresenceSettings {
    return {
      userId,
      autoAway: {
        enabled: settings.autoAway?.enabled ?? this.DEFAULT_SETTINGS.autoAway.enabled,
        idleMinutes: settings.autoAway?.idleMinutes ?? this.DEFAULT_SETTINGS.autoAway.idleMinutes
      },
      workingHours: {
        enabled: settings.workingHours?.enabled ?? this.DEFAULT_SETTINGS.workingHours.enabled,
        timezone: settings.workingHours?.timezone ?? this.DEFAULT_SETTINGS.workingHours.timezone,
        schedule: { ...this.DEFAULT_SETTINGS.workingHours.schedule, ...(settings.workingHours?.schedule || {}) }
      },
      statusVisibility: settings.statusVisibility ?? this.DEFAULT_SETTINGS.statusVisibility,
      showLastSeen: settings.showLastSeen ?? this.DEFAULT_SETTINGS.showLastSeen,
      allowInterruptions: {
        ...this.DEFAULT_SETTINGS.allowInterruptions,
        ...(settings.allowInterruptions || {})
      }
    }
  }

  public setUserPresence(
    userId: number,
    status: UserPresence['status'],
    metadata?: {
      deviceInfo?: any
      location?: any
      statusMessage?: string
      availableUntil?: Date
    }
  ): void {
    const now = new Date()
    let presence = this.userPresences.get(userId)

    if (!presence) {
      presence = {
        userId,
        status,
        lastSeen: now
      }
    } else {
      presence.status = status
      presence.lastSeen = now
    }

    // Update metadata if provided
    if (metadata) {
      if (metadata.deviceInfo) presence.deviceInfo = metadata.deviceInfo
      if (metadata.location) presence.location = metadata.location
      if (metadata.statusMessage !== undefined) presence.statusMessage = metadata.statusMessage
      if (metadata.availableUntil !== undefined) presence.availableUntil = metadata.availableUntil
    }

    // Update activity info
    if (!presence.activity) {
      presence.activity = {
        lastActivity: now,
        idleTime: 0
      }
    } else {
      presence.activity.lastActivity = now
      presence.activity.idleTime = 0
    }

    this.userPresences.set(userId, presence)
    this.persistUserPresence(presence)

    // Setup auto-away timer if applicable
    this.setupAutoAwayTimer(userId)

    // Broadcast presence change
    this.broadcastPresenceChange(userId, status)

    // Log presence event
    this.logPresenceEvent(userId, status === 'offline' ? 'offline' : 'online', metadata)

    logger.info(`Set presence for user ${userId}: ${status}`)
  }

  public getUserPresence(userId: number): UserPresence | null {
    const presence = this.userPresences.get(userId)
    if (!presence) return null

    // Check if user should be considered offline
    if (this.shouldBeOffline(presence)) {
      this.setUserPresence(userId, 'offline')
      return this.userPresences.get(userId) || null
    }

    return presence
  }

  public getUserPresenceWithVisibility(viewerUserId: number, targetUserId: number): Partial<UserPresence> | null {
    const presence = this.getUserPresence(targetUserId)
    if (!presence) return null

    const settings = this.getUserSettings(targetUserId)
    const viewerRole = this.getUserRole(viewerUserId)
    const targetRole = this.getUserRole(targetUserId)

    // Check visibility permissions
    if (!this.canViewPresence(viewerUserId, targetUserId, settings, viewerRole, targetRole)) {
      return { userId: targetUserId, status: 'offline' }
    }

    // Return filtered presence based on settings
    const filteredPresence: Partial<UserPresence> = {
      userId: presence.userId,
      status: presence.status,
      statusMessage: presence.statusMessage
    }

    if (settings.showLastSeen) {
      filteredPresence.lastSeen = presence.lastSeen
    }

    return filteredPresence
  }

  private canViewPresence(
    viewerUserId: number,
    targetUserId: number,
    settings: PresenceSettings,
    viewerRole: string,
    targetRole: string
  ): boolean {
    if (viewerUserId === targetUserId) return true

    switch (settings.statusVisibility) {
      case 'everyone':
        return true

      case 'team':
        // Same role or viewer is manager/admin
        return targetRole === viewerRole ||
               ['admin', 'manager'].includes(viewerRole)

      case 'managers':
        return ['admin', 'manager'].includes(viewerRole)

      case 'private':
        return viewerRole === 'admin'

      default:
        return false
    }
  }

  public updateUserActivity(userId: number, activity?: { currentPage?: string }): void {
    const presence = this.userPresences.get(userId)
    if (!presence || presence.status === 'offline') return

    const now = new Date()

    if (!presence.activity) {
      presence.activity = {
        lastActivity: now,
        idleTime: 0
      }
    } else {
      presence.activity.lastActivity = now
      presence.activity.idleTime = 0
    }

    if (activity?.currentPage) {
      presence.activity.currentPage = activity.currentPage
    }

    // If user was away due to inactivity, bring them back online
    if (presence.status === 'away') {
      this.setUserPresence(userId, 'online')
      return
    }

    this.userPresences.set(userId, presence)
    this.persistUserPresence(presence)

    // Reset auto-away timer
    this.setupAutoAwayTimer(userId)
  }

  public setUserStatus(
    userId: number,
    status: UserPresence['status'],
    statusMessage?: string,
    availableUntil?: Date
  ): void {
    this.setUserPresence(userId, status, { statusMessage, availableUntil })
  }

  public canInterruptUser(userId: number, priority: 'low' | 'medium' | 'high' | 'critical'): boolean {
    const presence = this.getUserPresence(userId)
    if (!presence) return false

    // Always allow if user is online
    if (presence.status === 'online') return true

    // Check user settings for interruptions
    const settings = this.getUserSettings(userId)

    // Check based on status
    if (presence.status === 'busy') {
      return settings.allowInterruptions[priority]
    }

    if (presence.status === 'away') {
      // Allow high and critical during away
      return ['high', 'critical'].includes(priority)
    }

    if (presence.status === 'offline') {
      // Only allow critical when offline
      return priority === 'critical'
    }

    return false
  }

  public getTeamPresence(userIds: number[], viewerUserId: number): Array<Partial<UserPresence>> {
    const teamPresence: Array<Partial<UserPresence>> = []

    for (const userId of userIds) {
      const presence = this.getUserPresenceWithVisibility(viewerUserId, userId)
      if (presence) {
        teamPresence.push(presence)
      }
    }

    return teamPresence.sort((a, b) => {
      // Sort by status priority: online, busy, away, offline
      const statusPriority = { online: 3, busy: 2, away: 1, offline: 0 }
      const aPriority = statusPriority[a.status as keyof typeof statusPriority] || 0
      const bPriority = statusPriority[b.status as keyof typeof statusPriority] || 0
      return bPriority - aPriority
    })
  }

  public getOnlineUsers(roleFilter?: string): number[] {
    const onlineUsers: number[] = []

    for (const [userId, presence] of this.userPresences.entries()) {
      if (presence.status === 'online' || presence.status === 'busy') {
        if (!roleFilter || this.getUserRole(userId) === roleFilter) {
          onlineUsers.push(userId)
        }
      }
    }

    return onlineUsers
  }

  public isUserInWorkingHours(userId: number, checkTime?: Date): boolean {
    const settings = this.getUserSettings(userId)
    if (!settings.workingHours.enabled) return true

    const time = checkTime || new Date()
    const userTime = this.convertToUserTimezone(time, settings.workingHours.timezone)
    const dayOfWeek = userTime.getDay().toString()

    const daySchedule = settings.workingHours.schedule[dayOfWeek]
    if (!daySchedule || !daySchedule.enabled) return false

    const currentMinutes = userTime.getHours() * 60 + userTime.getMinutes()
    const [startHour, startMinute] = daySchedule.start.split(':').map(Number)
    const [endHour, endMinute] = daySchedule.end.split(':').map(Number)
    const startMinutes = (startHour ?? 0) * 60 + (startMinute ?? 0)
    const endMinutes = (endHour ?? 0) * 60 + (endMinute ?? 0)

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }

  public joinTicket(userId: number, ticketId: number): void {
    const presence = this.userPresences.get(userId)
    if (!presence || !presence.activity) return

    presence.activity.currentPage = `/tickets/${ticketId}`
    this.userPresences.set(userId, presence)

    // Notify other users in the ticket
    this.broadcastTicketPresence(userId, ticketId, 'joined')
  }

  public leaveTicket(userId: number, ticketId: number): void {
    const presence = this.userPresences.get(userId)
    if (!presence || !presence.activity) return

    if (presence.activity.currentPage === `/tickets/${ticketId}`) {
      presence.activity.currentPage = undefined
    }
    this.userPresences.set(userId, presence)

    // Notify other users in the ticket
    this.broadcastTicketPresence(userId, ticketId, 'left')
  }

  public getTicketViewers(ticketId: number): number[] {
    const viewers: number[] = []

    for (const [userId, presence] of this.userPresences.entries()) {
      if (presence.activity?.currentPage === `/tickets/${ticketId}` &&
          (presence.status === 'online' || presence.status === 'busy')) {
        viewers.push(userId)
      }
    }

    return viewers
  }

  private setupAutoAwayTimer(userId: number): void {
    // Clear existing timer
    const existingTimer = this.presenceTimers.get(userId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const settings = this.getUserSettings(userId)
    if (!settings.autoAway.enabled) return

    const timer = setTimeout(() => {
      const presence = this.userPresences.get(userId)
      if (presence && presence.status === 'online') {
        this.setUserPresence(userId, 'away')
      }
    }, settings.autoAway.idleMinutes * 60 * 1000)

    this.presenceTimers.set(userId, timer)
  }

  private shouldBeOffline(presence: UserPresence): boolean {
    const now = new Date()
    const timeSinceLastSeen = now.getTime() - presence.lastSeen.getTime()
    const offlineThreshold = 5 * 60 * 1000 // 5 minutes

    return timeSinceLastSeen > offlineThreshold
  }

  private broadcastPresenceChange(userId: number, status: string): void {
    if (!this.realtimeEngine) return

    const presenceUpdate = {
      userId,
      status,
      timestamp: new Date().toISOString()
    }

    // Broadcast to all connected users
    this.realtimeEngine.getIO().emit('presence:update', presenceUpdate)
  }

  private broadcastTicketPresence(userId: number, ticketId: number, action: 'joined' | 'left'): void {
    if (!this.realtimeEngine) return

    const ticketPresence = {
      userId,
      ticketId,
      action,
      timestamp: new Date().toISOString()
    }

    // Broadcast to users in the ticket room
    this.realtimeEngine.getIO().to(`ticket_${ticketId}`).emit('ticket:presence', ticketPresence)
  }

  private logPresenceEvent(userId: number, event: string, metadata?: any): void {
    try {
      this.db.prepare(`
        INSERT INTO presence_events (user_id, event, metadata, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(
        userId,
        event,
        metadata ? JSON.stringify(metadata) : null,
        new Date().toISOString()
      )
    } catch (error) {
      logger.error('Error logging presence event', error)
    }
  }

  private persistUserPresence(presence: UserPresence): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO user_presence (
          user_id, status, last_seen, device_info, location_info,
          activity_info, status_message, available_until
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        presence.userId,
        presence.status,
        presence.lastSeen.toISOString(),
        presence.deviceInfo ? JSON.stringify(presence.deviceInfo) : null,
        presence.location ? JSON.stringify(presence.location) : null,
        presence.activity ? JSON.stringify(presence.activity) : null,
        presence.statusMessage || null,
        presence.availableUntil?.toISOString() || null
      )
    } catch (error) {
      logger.error('Error persisting user presence', error)
    }
  }

  private getUserSettings(userId: number): PresenceSettings {
    let settings = this.presenceSettings.get(userId)
    if (!settings) {
      settings = { ...this.DEFAULT_SETTINGS, userId }
      this.presenceSettings.set(userId, settings)
    }
    return settings
  }

  private getUserRole(userId: number): string {
    try {
      const user = this.db.prepare(`
        SELECT role FROM users WHERE id = ?
      `).get(userId) as { role: string } | undefined

      return user?.role || 'user'
    } catch (error) {
      logger.error('Error getting user role', error)
      return 'user'
    }
  }

  private convertToUserTimezone(date: Date, timezone: string): Date {
    try {
      return new Date(date.toLocaleString('en-US', { timeZone: timezone }))
    } catch (error) {
      logger.error(`Invalid timezone: ${timezone}`, error)
      return date
    }
  }

  private setupPresenceTracking(): void {
    // Update presence states every minute
    setInterval(() => {
      this.updatePresenceStates()
    }, 60000)

    // Cleanup old presence events daily
    setInterval(() => {
      this.cleanupPresenceEvents()
    }, 24 * 60 * 60 * 1000)

    // Check for users that should be auto-away every 30 seconds
    setInterval(() => {
      this.checkAutoAway()
    }, 30000)
  }

  private updatePresenceStates(): void {
    const now = new Date()

    for (const [userId, presence] of this.userPresences.entries()) {
      // Check if user should be marked as offline
      if (this.shouldBeOffline(presence) && presence.status !== 'offline') {
        this.setUserPresence(userId, 'offline')
        continue
      }

      // Update idle time
      if (presence.activity && presence.status !== 'offline') {
        const timeSinceActivity = now.getTime() - presence.activity.lastActivity.getTime()
        presence.activity.idleTime = Math.floor(timeSinceActivity / 1000)
        this.userPresences.set(userId, presence)
      }

      // Check for temporary status expiration
      if (presence.availableUntil && now > presence.availableUntil) {
        presence.availableUntil = undefined
        if (presence.status === 'busy' || presence.status === 'away') {
          this.setUserPresence(userId, 'online')
        }
      }
    }
  }

  private checkAutoAway(): void {
    const now = new Date()

    for (const [userId, presence] of this.userPresences.entries()) {
      if (presence.status !== 'online' || !presence.activity) continue

      const settings = this.getUserSettings(userId)
      if (!settings.autoAway.enabled) continue

      const idleTime = now.getTime() - presence.activity.lastActivity.getTime()
      const idleMinutes = idleTime / (60 * 1000)

      if (idleMinutes >= settings.autoAway.idleMinutes) {
        this.setUserPresence(userId, 'away')
      }
    }
  }

  private cleanupPresenceEvents(): void {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

      const deleted = this.db.prepare(`
        DELETE FROM presence_events
        WHERE timestamp < ?
      `).run(cutoffDate.toISOString())

      if (deleted.changes > 0) {
        logger.info(`Cleaned up ${deleted.changes} old presence events`)
      }
    } catch (error) {
      logger.error('Error cleaning up presence events', error)
    }
  }

  // Public API methods
  public updateUserSettings(userId: number, settings: Partial<PresenceSettings>): void {
    const currentSettings = this.getUserSettings(userId)
    const newSettings = { ...currentSettings, ...settings, userId }

    this.presenceSettings.set(userId, newSettings)

    // Save to database
    try {
      this.db.prepare(`
        UPDATE users
        SET presence_settings = ?
        WHERE id = ?
      `).run(JSON.stringify(newSettings), userId)

      logger.info(`Updated presence settings for user ${userId}`)
    } catch (error) {
      logger.error('Error saving presence settings', error)
    }

    // Restart auto-away timer if settings changed
    if (settings.autoAway) {
      this.setupAutoAwayTimer(userId)
    }
  }

  public getPresenceStats(): any {
    const stats = {
      totalUsers: this.userPresences.size,
      online: 0,
      busy: 0,
      away: 0,
      offline: 0,
      inWorkingHours: 0,
      activeTimers: this.presenceTimers.size
    }

    for (const [userId, presence] of this.userPresences.entries()) {
      stats[presence.status]++

      if (this.isUserInWorkingHours(userId)) {
        stats.inWorkingHours++
      }
    }

    return stats
  }

  public getPresenceHistory(userId: number, days: number = 7): PresenceEvent[] {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const events = this.db.prepare(`
        SELECT * FROM presence_events
        WHERE user_id = ? AND timestamp > ?
        ORDER BY timestamp DESC
        LIMIT 100
      `).all(userId, startDate.toISOString()) as any[]

      return events.map(event => ({
        userId: event.user_id,
        event: event.event,
        timestamp: new Date(event.timestamp),
        metadata: event.metadata ? JSON.parse(event.metadata) : undefined
      }))
    } catch (error) {
      logger.error('Error getting presence history', error)
      return []
    }
  }

  public getTeamAvailability(teamUserIds: number[]): any {
    const availability = {
      available: [],
      busy: [],
      away: [],
      offline: [],
      workingHours: []
    } as any

    for (const userId of teamUserIds) {
      const presence = this.getUserPresence(userId)
      const inWorkingHours = this.isUserInWorkingHours(userId)

      const userInfo = { userId, inWorkingHours }

      if (!presence || presence.status === 'offline') {
        availability.offline.push(userInfo)
      } else {
        availability[presence.status].push(userInfo)
        if (inWorkingHours) {
          availability.workingHours.push(userInfo)
        }
      }
    }

    return availability
  }

  public getUsersInTicket(ticketId: number): Array<{ userId: number; presence: Partial<UserPresence> }> {
    const viewers = this.getTicketViewers(ticketId)
    const usersInTicket: Array<{ userId: number; presence: Partial<UserPresence> }> = []

    for (const userId of viewers) {
      const presence = this.getUserPresence(userId)
      if (presence) {
        usersInTicket.push({
          userId,
          presence: {
            userId: presence.userId,
            status: presence.status,
            lastSeen: presence.lastSeen,
            statusMessage: presence.statusMessage
          }
        })
      }
    }

    return usersInTicket
  }

  public setTemporaryStatus(
    userId: number,
    status: UserPresence['status'],
    durationMinutes: number,
    statusMessage?: string
  ): void {
    const availableUntil = new Date(Date.now() + durationMinutes * 60 * 1000)
    this.setUserPresence(userId, status, { statusMessage, availableUntil })
  }

  public clearUserTimers(userId: number): void {
    // Limpar timer de presença
    const timer = this.presenceTimers.get(userId)
    if (timer) {
      clearTimeout(timer)
      this.presenceTimers.delete(userId)
    }

    // Limpar timer de atividade
    const activityTimer = this.activityTrackers.get(userId)
    if (activityTimer) {
      clearTimeout(activityTimer)
      this.activityTrackers.delete(userId)
    }

    // Remover presença do usuário
    this.userPresences.delete(userId)
  }
}
