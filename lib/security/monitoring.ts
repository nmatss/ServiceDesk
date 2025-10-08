/**
 * Security Monitoring and Logging Foundation
 * Comprehensive security event tracking and anomaly detection
 */

import { getSecurityConfig } from './config';
import { logger } from '../monitoring/logger';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  data: Record<string, any>;
  metadata?: SecurityEventMetadata;
}

export interface SecurityEventMetadata {
  geolocation?: {
    country: string;
    region: string;
    city: string;
  };
  deviceInfo?: {
    os: string;
    browser: string;
    device: string;
  };
  riskScore?: number;
  correlationId?: string;
  tags?: string[];
}

export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGED = 'password_changed',
  ACCOUNT_LOCKED = 'account_locked',
  SUSPICIOUS_LOGIN = 'suspicious_login',

  // Authorization events
  ACCESS_DENIED = 'access_denied',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  UNAUTHORIZED_API_ACCESS = 'unauthorized_api_access',

  // Data protection events
  PII_ACCESS = 'pii_access',
  DATA_EXPORT = 'data_export',
  DATA_MODIFICATION = 'data_modification',
  DATA_DELETION = 'data_deletion',

  // Application security events
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  CSRF_ATTEMPT = 'csrf_attempt',
  DIRECTORY_TRAVERSAL = 'directory_traversal',
  FILE_UPLOAD_SUSPICIOUS = 'file_upload_suspicious',

  // Infrastructure events
  UNUSUAL_TRAFFIC = 'unusual_traffic',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  BRUTE_FORCE_ATTACK = 'brute_force_attack',
  DDoS_ATTEMPT = 'ddos_attempt',

  // Compliance events
  LGPD_VIOLATION = 'lgpd_violation',
  CONSENT_REVOKED = 'consent_revoked',
  DATA_RETENTION_VIOLATION = 'data_retention_violation',

  // System events
  CONFIGURATION_CHANGED = 'configuration_changed',
  SECURITY_SCAN_COMPLETED = 'security_scan_completed',
  VULNERABILITY_DETECTED = 'vulnerability_detected',
  SECURITY_ALERT = 'security_alert'
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  events: SecurityEvent[];
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedAt?: Date;
  actions: SecurityAction[];
}

export interface SecurityAction {
  id: string;
  timestamp: Date;
  type: 'manual' | 'automated';
  action: string;
  performer?: string;
  result: 'success' | 'failed' | 'pending';
  details: string;
}

/**
 * Security Event Logger
 */
export class SecurityLogger {
  private config = getSecurityConfig();
  private eventBuffer: SecurityEvent[] = [];
  private readonly bufferSize = 100;

  /**
   * Log security event
   */
  public async logEvent(
    type: SecurityEventType,
    data: Record<string, any>,
    options?: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      userId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      source?: string;
    }
  ): Promise<void> {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type,
      severity: options?.severity || this.calculateSeverity(type),
      source: options?.source || 'application',
      userId: options?.userId,
      sessionId: options?.sessionId,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      data,
      metadata: await this.enrichEventMetadata(options)
    };

    // Add to buffer
    this.eventBuffer.push(event);

    // Flush buffer if full
    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flushEvents();
    }

    // Immediate processing for high-severity events
    if (event.severity === 'high' || event.severity === 'critical') {
      await this.processHighSeverityEvent(event);
    }

    // Console logging based on configuration
    if (this.shouldLogToConsole(event.severity)) {
      this.logToConsole(event);
    }
  }

  /**
   * Flush buffered events to storage
   */
  public async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.persistEvents(events);
    } catch (error) {
      logger.error('Failed to persist security events', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * Calculate event severity based on type
   */
  private calculateSeverity(type: SecurityEventType): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<SecurityEventType, 'low' | 'medium' | 'high' | 'critical'> = {
      [SecurityEventType.LOGIN_SUCCESS]: 'low',
      [SecurityEventType.LOGIN_FAILED]: 'medium',
      [SecurityEventType.LOGOUT]: 'low',
      [SecurityEventType.PASSWORD_CHANGED]: 'medium',
      [SecurityEventType.ACCOUNT_LOCKED]: 'high',
      [SecurityEventType.SUSPICIOUS_LOGIN]: 'high',
      [SecurityEventType.ACCESS_DENIED]: 'medium',
      [SecurityEventType.PRIVILEGE_ESCALATION]: 'critical',
      [SecurityEventType.UNAUTHORIZED_API_ACCESS]: 'high',
      [SecurityEventType.PII_ACCESS]: 'medium',
      [SecurityEventType.DATA_EXPORT]: 'high',
      [SecurityEventType.DATA_MODIFICATION]: 'medium',
      [SecurityEventType.DATA_DELETION]: 'high',
      [SecurityEventType.SQL_INJECTION_ATTEMPT]: 'critical',
      [SecurityEventType.XSS_ATTEMPT]: 'high',
      [SecurityEventType.CSRF_ATTEMPT]: 'high',
      [SecurityEventType.DIRECTORY_TRAVERSAL]: 'high',
      [SecurityEventType.FILE_UPLOAD_SUSPICIOUS]: 'medium',
      [SecurityEventType.UNUSUAL_TRAFFIC]: 'medium',
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: 'medium',
      [SecurityEventType.BRUTE_FORCE_ATTACK]: 'high',
      [SecurityEventType.DDoS_ATTEMPT]: 'critical',
      [SecurityEventType.LGPD_VIOLATION]: 'high',
      [SecurityEventType.CONSENT_REVOKED]: 'medium',
      [SecurityEventType.DATA_RETENTION_VIOLATION]: 'high',
      [SecurityEventType.CONFIGURATION_CHANGED]: 'medium',
      [SecurityEventType.SECURITY_SCAN_COMPLETED]: 'low',
      [SecurityEventType.VULNERABILITY_DETECTED]: 'high',
      [SecurityEventType.SECURITY_ALERT]: 'high'
    };

    return severityMap[type] || 'medium';
  }

  /**
   * Enrich event with additional metadata
   */
  private async enrichEventMetadata(options?: any): Promise<SecurityEventMetadata> {
    const metadata: SecurityEventMetadata = {};

    // Add geolocation if IP address is available
    if (options?.ipAddress) {
      metadata.geolocation = await this.getGeolocation(options.ipAddress);
    }

    // Parse user agent for device info
    if (options?.userAgent) {
      metadata.deviceInfo = this.parseUserAgent(options.userAgent);
    }

    // Calculate risk score
    metadata.riskScore = this.calculateRiskScore(options);

    // Generate correlation ID for related events
    metadata.correlationId = this.generateCorrelationId();

    return metadata;
  }

  /**
   * Get geolocation from IP address
   */
  private async getGeolocation(ipAddress: string): Promise<any> {
    // Skip for private IPs
    if (this.isPrivateIP(ipAddress)) {
      return { country: 'Private', region: 'Private', city: 'Private' };
    }

    try {
      // TODO: Integrate with geolocation service (MaxMind, IP-API, etc.)
      return { country: 'Unknown', region: 'Unknown', city: 'Unknown' };
    } catch (error) {
      return { country: 'Unknown', region: 'Unknown', city: 'Unknown' };
    }
  }

  /**
   * Parse user agent for device information
   */
  private parseUserAgent(userAgent: string): any {
    // Simple user agent parsing - in production, use a proper library
    const deviceInfo = {
      os: 'Unknown',
      browser: 'Unknown',
      device: 'Unknown'
    };

    if (userAgent.includes('Windows')) deviceInfo.os = 'Windows';
    else if (userAgent.includes('Mac')) deviceInfo.os = 'macOS';
    else if (userAgent.includes('Linux')) deviceInfo.os = 'Linux';
    else if (userAgent.includes('Android')) deviceInfo.os = 'Android';
    else if (userAgent.includes('iOS')) deviceInfo.os = 'iOS';

    if (userAgent.includes('Chrome')) deviceInfo.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) deviceInfo.browser = 'Firefox';
    else if (userAgent.includes('Safari')) deviceInfo.browser = 'Safari';
    else if (userAgent.includes('Edge')) deviceInfo.browser = 'Edge';

    if (userAgent.includes('Mobile')) deviceInfo.device = 'Mobile';
    else if (userAgent.includes('Tablet')) deviceInfo.device = 'Tablet';
    else deviceInfo.device = 'Desktop';

    return deviceInfo;
  }

  /**
   * Calculate risk score for event
   */
  private calculateRiskScore(options?: any): number {
    let score = 0;

    // Base score factors
    if (options?.ipAddress && !this.isPrivateIP(options.ipAddress)) score += 10;
    if (options?.userAgent && this.isSuspiciousUserAgent(options.userAgent)) score += 20;

    // TODO: Add more sophisticated risk scoring logic
    // - Known bad IPs
    // - Unusual access patterns
    // - Device fingerprinting
    // - Time-based analysis

    return Math.min(score, 100);
  }

  /**
   * Check if IP is private
   */
  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^localhost$/
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /python/i,
      /curl/i,
      /wget/i,
      /postman/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Process high-severity events immediately
   */
  private async processHighSeverityEvent(event: SecurityEvent): Promise<void> {
    // Create security alert
    await this.createSecurityAlert(event);

    // Send immediate notifications
    await this.sendImmediateAlert(event);

    // Trigger automated responses
    await this.triggerAutomatedResponse(event);
  }

  /**
   * Create security alert from event
   */
  private async createSecurityAlert(event: SecurityEvent): Promise<void> {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      title: this.generateAlertTitle(event),
      description: this.generateAlertDescription(event),
      severity: event.severity,
      category: this.getCategoryFromEventType(event.type),
      events: [event],
      status: 'open',
      actions: []
    };

    // TODO: Store alert in database
    logger.info('Security alert created', alert.id);
  }

  /**
   * Send immediate alert notification
   */
  private async sendImmediateAlert(event: SecurityEvent): Promise<void> {
    if (!this.config.monitoring.alerting.enabled) return;

    const alertMessage = {
      title: `Security Alert: ${event.type}`,
      severity: event.severity,
      timestamp: event.timestamp,
      source: event.source,
      userId: event.userId,
      ipAddress: event.ipAddress,
      data: event.data
    };

    // Send to configured alert channels
    for (const webhook of this.config.monitoring.alerting.webhooks) {
      await this.sendWebhookAlert(webhook, alertMessage);
    }

    for (const email of this.config.monitoring.alerting.emailAlerts) {
      await this.sendEmailAlert(email, alertMessage);
    }
  }

  /**
   * Trigger automated security responses
   */
  private async triggerAutomatedResponse(event: SecurityEvent): Promise<void> {
    switch (event.type) {
      case SecurityEventType.BRUTE_FORCE_ATTACK:
        await this.blockIPAddress(event.ipAddress);
        break;
      case SecurityEventType.SQL_INJECTION_ATTEMPT:
        await this.quarantineSession(event.sessionId);
        break;
      case SecurityEventType.SUSPICIOUS_LOGIN:
        await this.requireMFA(event.userId);
        break;
      // Add more automated responses as needed
    }
  }

  /**
   * Automated response methods
   */
  private async blockIPAddress(ipAddress?: string): Promise<void> {
    if (!ipAddress) return;
    // TODO: Implement IP blocking
    logger.info(`Automated response: Blocking IP ${ipAddress}`);
  }

  private async quarantineSession(sessionId?: string): Promise<void> {
    if (!sessionId) return;
    // TODO: Implement session quarantine
    logger.info(`Automated response: Quarantining session ${sessionId}`);
  }

  private async requireMFA(userId?: string): Promise<void> {
    if (!userId) return;
    // TODO: Implement MFA requirement
    logger.info(`Automated response: Requiring MFA for user ${userId}`);
  }

  /**
   * Helper methods
   */
  private generateEventId(): string {
    return `sec_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `sec_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertTitle(event: SecurityEvent): string {
    const titleMap: Record<SecurityEventType, string> = {
      [SecurityEventType.SQL_INJECTION_ATTEMPT]: 'SQL Injection Attack Detected',
      [SecurityEventType.XSS_ATTEMPT]: 'Cross-Site Scripting Attack Detected',
      [SecurityEventType.BRUTE_FORCE_ATTACK]: 'Brute Force Attack Detected',
      [SecurityEventType.SUSPICIOUS_LOGIN]: 'Suspicious Login Activity',
      [SecurityEventType.PRIVILEGE_ESCALATION]: 'Privilege Escalation Attempt',
      [SecurityEventType.DDoS_ATTEMPT]: 'DDoS Attack Detected',
      // Add more mappings as needed
    } as any;

    return titleMap[event.type] || `Security Event: ${event.type}`;
  }

  private generateAlertDescription(event: SecurityEvent): string {
    return `Security event of type ${event.type} detected from ${event.source}. ${
      event.ipAddress ? `Source IP: ${event.ipAddress}. ` : ''
    }${event.userId ? `User ID: ${event.userId}. ` : ''}Event data: ${JSON.stringify(event.data)}`;
  }

  private getCategoryFromEventType(type: SecurityEventType): string {
    if (type.includes('login') || type.includes('auth')) return 'Authentication';
    if (type.includes('access') || type.includes('privilege')) return 'Authorization';
    if (type.includes('injection') || type.includes('xss')) return 'Injection';
    if (type.includes('data') || type.includes('pii')) return 'Data Protection';
    if (type.includes('lgpd') || type.includes('consent')) return 'Compliance';
    return 'General';
  }

  private shouldLogToConsole(severity: string): boolean {
    const configLevel = this.config.monitoring.securityEvents.logLevel;
    const levels = ['debug', 'info', 'warn', 'error'];
    const eventLevelMap = { low: 'info', medium: 'warn', high: 'error', critical: 'error' };

    const configIndex = levels.indexOf(configLevel);
    const eventIndex = levels.indexOf(eventLevelMap[severity as keyof typeof eventLevelMap]);

    return eventIndex >= configIndex;
  }

  private logToConsole(event: SecurityEvent): void {
    const logMessage = `[SECURITY] ${event.severity.toUpperCase()} - ${event.type}: ${JSON.stringify(event.data)}`;

    switch (event.severity) {
      case 'low':
        logger.info(logMessage);
        break;
      case 'medium':
        logger.warn(logMessage);
        break;
      case 'high':
      case 'critical':
        logger.error(logMessage);
        break;
    }
  }

  private async persistEvents(events: SecurityEvent[]): Promise<void> {
    // TODO: Implement event persistence (database, SIEM, etc.)
    logger.info(`Persisting ${events.length} security events`);
  }

  private async sendWebhookAlert(webhook: string, alert: any): Promise<void> {
    try {
      // TODO: Implement webhook sending
      logger.info(`Sending webhook alert to ${webhook}`);
    } catch (error) {
      logger.error(`Failed to send webhook alert: ${error}`);
    }
  }

  private async sendEmailAlert(email: string, alert: any): Promise<void> {
    try {
      // TODO: Implement email sending
      logger.info(`Sending email alert to ${email}`);
    } catch (error) {
      logger.error(`Failed to send email alert: ${error}`);
    }
  }
}

/**
 * Anomaly Detection Engine
 */
export class AnomalyDetector {
  private config = getSecurityConfig();
  private eventHistory: Map<string, SecurityEvent[]> = new Map();

  /**
   * Analyze event for anomalies
   */
  public async analyzeEvent(event: SecurityEvent): Promise<{
    isAnomalous: boolean;
    anomalyScore: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let anomalyScore = 0;

    // Add to history
    this.addToHistory(event);

    // Check various anomaly patterns
    anomalyScore += await this.checkFrequencyAnomaly(event, reasons);
    anomalyScore += await this.checkTimeAnomaly(event, reasons);
    anomalyScore += await this.checkLocationAnomaly(event, reasons);
    anomalyScore += await this.checkPatternAnomaly(event, reasons);

    return {
      isAnomalous: anomalyScore > 50,
      anomalyScore: Math.min(anomalyScore, 100),
      reasons
    };
  }

  private addToHistory(event: SecurityEvent): void {
    const key = `${event.userId || 'anonymous'}_${event.type}`;
    const history = this.eventHistory.get(key) || [];
    history.push(event);

    // Keep only last 100 events
    if (history.length > 100) {
      history.shift();
    }

    this.eventHistory.set(key, history);
  }

  private async checkFrequencyAnomaly(event: SecurityEvent, reasons: string[]): Promise<number> {
    const key = `${event.userId || 'anonymous'}_${event.type}`;
    const history = this.eventHistory.get(key) || [];

    // Check events in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = history.filter(e => e.timestamp > oneHourAgo);

    const threshold = this.config.monitoring.anomalyDetection.thresholds.requestsPerMinute || 10;

    if (recentEvents.length > threshold) {
      reasons.push(`High frequency: ${recentEvents.length} events in last hour`);
      return 30;
    }

    return 0;
  }

  private async checkTimeAnomaly(event: SecurityEvent, reasons: string[]): Promise<number> {
    // Check for unusual time patterns (e.g., activity during off-hours)
    const hour = event.timestamp.getHours();

    // Define normal business hours (9 AM to 6 PM)
    if (hour < 9 || hour > 18) {
      reasons.push(`Off-hours activity: ${hour}:00`);
      return 15;
    }

    return 0;
  }

  private async checkLocationAnomaly(event: SecurityEvent, reasons: string[]): Promise<number> {
    if (!event.metadata?.geolocation || !event.userId) return 0;

    const userHistory = this.eventHistory.get(`${event.userId}_${event.type}`) || [];
    const recentLocations = userHistory
      .filter(e => e.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .map(e => e.metadata?.geolocation?.country)
      .filter(Boolean);

    const currentCountry = event.metadata.geolocation.country;

    if (recentLocations.length > 0 && !recentLocations.includes(currentCountry)) {
      reasons.push(`New location: ${currentCountry}`);
      return 25;
    }

    return 0;
  }

  private async checkPatternAnomaly(event: SecurityEvent, reasons: string[]): Promise<number> {
    // Check for unusual patterns in event data
    let score = 0;

    // Check for suspicious user agent patterns
    if (event.userAgent && this.isSuspiciousUserAgent(event.userAgent)) {
      reasons.push('Suspicious user agent detected');
      score += 20;
    }

    // Check for unusual data access patterns
    if (event.type === SecurityEventType.PII_ACCESS && event.data.recordCount > 100) {
      reasons.push('Large-scale data access detected');
      score += 25;
    }

    return score;
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /python/i,
      /curl/i,
      /wget/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }
}

/**
 * Export singleton instances
 */
export const securityLogger = new SecurityLogger();
export const anomalyDetector = new AnomalyDetector();