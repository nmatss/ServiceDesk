import db from '../db/connection';
import type { User } from '../types/database';
import logger from '../monitoring/structured-logger';

// Automatic Time Tracking System
export class TimeTracker {
  /**
   * Start automatic time tracking for a ticket
   */
  async startTracking(ticketId: number, userId: number, activityType: 'work' | 'research' | 'collaboration' | 'break' = 'work'): Promise<{
    success: boolean;
    trackingId?: number;
    message: string;
  }> {
    try {
      // Check if there's already an active tracking session
      const activeSession = this.getActiveSession(userId);

      if (activeSession) {
        // Auto-stop the previous session
        await this.stopTracking(activeSession.id, userId, 'auto_stopped');
      }

      // Create new tracking entry
      const stmt = db.prepare(`
        INSERT INTO time_tracking (
          ticket_id, user_id, activity_type, started_at, is_active, created_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
      `);

      const result = stmt.run(ticketId, userId, activityType);

      // Log the start event
      this.logTimeEvent(ticketId, userId, 'tracking_started', {
        trackingId: result.lastInsertRowid,
        activityType
      });

      return {
        success: true,
        trackingId: result.lastInsertRowid as number,
        message: 'Time tracking started successfully'
      };

    } catch (error) {
      logger.error('Time tracking start error', error);
      return {
        success: false,
        message: 'Failed to start time tracking'
      };
    }
  }

  /**
   * Stop time tracking for a ticket
   */
  async stopTracking(trackingId: number, userId: number, stopReason: 'manual' | 'auto_stopped' | 'ticket_resolved' = 'manual'): Promise<{
    success: boolean;
    totalMinutes?: number;
    message: string;
  }> {
    try {
      // Get the tracking session
      const session = db.prepare(`
        SELECT * FROM time_tracking WHERE id = ? AND user_id = ? AND is_active = 1
      `).get(trackingId, userId) as any;

      if (!session) {
        return {
          success: false,
          message: 'Active tracking session not found'
        };
      }

      // Calculate duration
      const totalMinutes = this.calculateDuration(session.started_at);

      // Update the tracking session
      const updateStmt = db.prepare(`
        UPDATE time_tracking
        SET ended_at = CURRENT_TIMESTAMP,
            total_minutes = ?,
            is_active = 0,
            stop_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      updateStmt.run(totalMinutes, stopReason, trackingId);

      // Add to ticket's total time
      this.updateTicketTotalTime(session.ticket_id);

      // Log the stop event
      this.logTimeEvent(session.ticket_id, userId, 'tracking_stopped', {
        trackingId,
        totalMinutes,
        stopReason
      });

      return {
        success: true,
        totalMinutes,
        message: `Time tracking stopped. Total: ${this.formatDuration(totalMinutes)}`
      };

    } catch (error) {
      logger.error('Time tracking stop error', error);
      return {
        success: false,
        message: 'Failed to stop time tracking'
      };
    }
  }

  /**
   * Automatically detect work patterns and start/stop tracking
   */
  async autoDetectActivity(userId: number, activity: 'comment_added' | 'status_changed' | 'assignment_changed' | 'attachment_uploaded' | 'view_ticket', ticketId: number): Promise<void> {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;

      if (!user || !['admin', 'agent'].includes(user.role)) {
        return; // Only track time for agents and admins
      }

      const activeSession = this.getActiveSession(userId);
      const ticket = db.prepare(`
        SELECT t.*, s.is_final
        FROM tickets t
        LEFT JOIN statuses s ON t.status_id = s.id
        WHERE t.id = ?
      `).get(ticketId) as any;

      if (!ticket) return;

      // Auto-start tracking on meaningful activities
      if (['comment_added', 'status_changed', 'attachment_uploaded'].includes(activity)) {
        if (!activeSession || activeSession.ticket_id !== ticketId) {
          await this.startTracking(ticketId, userId, 'work');
        } else {
          // Update last activity to prevent auto-stop
          this.updateLastActivity(activeSession.id);
        }
      }

      // Auto-stop tracking when ticket is resolved
      if (activity === 'status_changed' && ticket.is_final) {
        if (activeSession && activeSession.ticket_id === ticketId) {
          await this.stopTracking(activeSession.id, userId, 'ticket_resolved');
        }
      }

    } catch (error) {
      logger.error('Auto-detect activity error', error);
    }
  }

  /**
   * Auto-stop inactive tracking sessions (after 30 minutes of inactivity)
   */
  async autoStopInactiveSessions(): Promise<void> {
    try {
      const inactiveSessions = db.prepare(`
        SELECT * FROM time_tracking
        WHERE is_active = 1
        AND datetime(last_activity, '+30 minutes') < CURRENT_TIMESTAMP
      `).all() as any[];

      for (const session of inactiveSessions) {
        await this.stopTracking(session.id, session.user_id, 'auto_stopped');
      }

    } catch (error) {
      logger.error('Auto-stop inactive sessions error', error);
    }
  }

  /**
   * Get comprehensive time analytics for a ticket
   */
  getTicketTimeAnalytics(ticketId: number): {
    totalMinutes: number;
    totalHours: number;
    sessionCount: number;
    averageSessionMinutes: number;
    timeByUser: Array<{
      userId: number;
      userName: string;
      totalMinutes: number;
      sessionCount: number;
    }>;
    timeByActivity: Array<{
      activityType: string;
      totalMinutes: number;
      sessionCount: number;
    }>;
    dailyBreakdown: Array<{
      date: string;
      totalMinutes: number;
      sessionCount: number;
    }>;
  } {
    // Get total time statistics
    const totalStats = db.prepare(`
      SELECT
        COALESCE(SUM(total_minutes), 0) as total_minutes,
        COUNT(*) as session_count,
        ROUND(AVG(total_minutes), 2) as avg_session_minutes
      FROM time_tracking
      WHERE ticket_id = ? AND total_minutes IS NOT NULL
    `).get(ticketId) as any;

    // Get time by user
    const timeByUser = db.prepare(`
      SELECT
        u.id as userId,
        u.name as userName,
        COALESCE(SUM(tt.total_minutes), 0) as totalMinutes,
        COUNT(tt.id) as sessionCount
      FROM users u
      LEFT JOIN time_tracking tt ON u.id = tt.user_id AND tt.ticket_id = ? AND tt.total_minutes IS NOT NULL
      WHERE u.id IN (SELECT DISTINCT user_id FROM time_tracking WHERE ticket_id = ?)
      GROUP BY u.id, u.name
      ORDER BY totalMinutes DESC
    `).all(ticketId, ticketId) as any[];

    // Get time by activity type
    const timeByActivity = db.prepare(`
      SELECT
        activity_type as activityType,
        COALESCE(SUM(total_minutes), 0) as totalMinutes,
        COUNT(*) as sessionCount
      FROM time_tracking
      WHERE ticket_id = ? AND total_minutes IS NOT NULL
      GROUP BY activity_type
      ORDER BY totalMinutes DESC
    `).all(ticketId) as any[];

    // Get daily breakdown
    const dailyBreakdown = db.prepare(`
      SELECT
        date(started_at) as date,
        COALESCE(SUM(total_minutes), 0) as totalMinutes,
        COUNT(*) as sessionCount
      FROM time_tracking
      WHERE ticket_id = ? AND total_minutes IS NOT NULL
      GROUP BY date(started_at)
      ORDER BY date(started_at)
    `).all(ticketId) as any[];

    return {
      totalMinutes: totalStats.total_minutes || 0,
      totalHours: Math.round((totalStats.total_minutes || 0) / 60 * 100) / 100,
      sessionCount: totalStats.session_count || 0,
      averageSessionMinutes: totalStats.avg_session_minutes || 0,
      timeByUser: timeByUser || [],
      timeByActivity: timeByActivity || [],
      dailyBreakdown: dailyBreakdown || []
    };
  }

  /**
   * Get agent productivity analytics
   */
  getAgentProductivityAnalytics(userId: number, period: 'week' | 'month' | 'quarter' = 'month'): {
    totalWorkMinutes: number;
    totalWorkHours: number;
    ticketsWorkedOn: number;
    averageTimePerTicket: number;
    productivityScore: number;
    timeDistribution: {
      work: number;
      research: number;
      collaboration: number;
      break: number;
    };
    dailyPattern: Array<{
      date: string;
      totalMinutes: number;
      ticketsWorkedOn: number;
      averageTimePerTicket: number;
    }>;
    efficiency: {
      timeToFirstResponse: number;
      timeToResolution: number;
      multitaskingIndex: number;
    };
  } {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    // Get total work statistics
    const workStats = db.prepare(`
      SELECT
        COALESCE(SUM(total_minutes), 0) as total_work_minutes,
        COUNT(DISTINCT ticket_id) as tickets_worked_on,
        ROUND(AVG(total_minutes), 2) as avg_time_per_session
      FROM time_tracking
      WHERE user_id = ?
        AND datetime(started_at) >= ${periodFilter}
        AND total_minutes IS NOT NULL
    `).get(userId) as any;

    // Get time distribution by activity
    const timeDistribution = db.prepare(`
      SELECT
        activity_type,
        COALESCE(SUM(total_minutes), 0) as total_minutes
      FROM time_tracking
      WHERE user_id = ?
        AND datetime(started_at) >= ${periodFilter}
        AND total_minutes IS NOT NULL
      GROUP BY activity_type
    `).all(userId) as any[];

    const distribution = {
      work: 0,
      research: 0,
      collaboration: 0,
      break: 0
    };

    timeDistribution.forEach(item => {
      distribution[item.activity_type as keyof typeof distribution] = item.total_minutes;
    });

    // Get daily breakdown
    const dailyPattern = db.prepare(`
      SELECT
        date(started_at) as date,
        COALESCE(SUM(total_minutes), 0) as totalMinutes,
        COUNT(DISTINCT ticket_id) as ticketsWorkedOn
      FROM time_tracking
      WHERE user_id = ?
        AND datetime(started_at) >= ${periodFilter}
        AND total_minutes IS NOT NULL
      GROUP BY date(started_at)
      ORDER BY date(started_at)
    `).all(userId) as any[];

    // Calculate efficiency metrics
    const efficiency = this.calculateEfficiencyMetrics(userId, periodFilter);

    const totalWorkMinutes = workStats.total_work_minutes || 0;
    const ticketsWorkedOn = workStats.tickets_worked_on || 0;
    const averageTimePerTicket = ticketsWorkedOn > 0 ? totalWorkMinutes / ticketsWorkedOn : 0;

    // Calculate productivity score (0-100)
    const productivityScore = this.calculateProductivityScore({
      totalWorkMinutes,
      ticketsWorkedOn,
      averageTimePerTicket,
      efficiency
    });

    return {
      totalWorkMinutes,
      totalWorkHours: Math.round(totalWorkMinutes / 60 * 100) / 100,
      ticketsWorkedOn,
      averageTimePerTicket: Math.round(averageTimePerTicket * 100) / 100,
      productivityScore,
      timeDistribution: distribution,
      dailyPattern: dailyPattern.map(day => ({
        ...day,
        averageTimePerTicket: day.ticketsWorkedOn > 0 ? Math.round(day.totalMinutes / day.ticketsWorkedOn * 100) / 100 : 0
      })),
      efficiency
    };
  }

  /**
   * Get team time analytics
   */
  getTeamTimeAnalytics(departmentId?: number, period: 'week' | 'month' | 'quarter' = 'month'): {
    totalTeamHours: number;
    agentCount: number;
    averageHoursPerAgent: number;
    topPerformers: Array<{
      userId: number;
      userName: string;
      totalHours: number;
      ticketsWorkedOn: number;
      productivityScore: number;
    }>;
    teamEfficiency: {
      averageTimeToFirstResponse: number;
      averageTimeToResolution: number;
      teamCollaborationIndex: number;
    };
  } {
    const periodFilter = period === 'week' ? "datetime('now', '-7 days')" :
                        period === 'month' ? "datetime('now', '-30 days')" :
                        "datetime('now', '-90 days')";

    let userFilter = "u.role IN ('admin', 'agent')";
    const params: any[] = [];

    if (departmentId) {
      userFilter += " AND u.id IN (SELECT user_id FROM user_departments WHERE department_id = ?)";
      params.push(departmentId);
    }

    // Get team statistics
    const teamStats = db.prepare(`
      SELECT
        COUNT(DISTINCT u.id) as agent_count,
        COALESCE(SUM(tt.total_minutes), 0) / 60.0 as total_team_hours
      FROM users u
      LEFT JOIN time_tracking tt ON u.id = tt.user_id
        AND datetime(tt.started_at) >= ${periodFilter}
        AND tt.total_minutes IS NOT NULL
      WHERE ${userFilter}
    `).all(...params)[0] as any;

    // Get top performers
    const topPerformers = db.prepare(`
      SELECT
        u.id as userId,
        u.name as userName,
        COALESCE(SUM(tt.total_minutes), 0) / 60.0 as totalHours,
        COUNT(DISTINCT tt.ticket_id) as ticketsWorkedOn
      FROM users u
      LEFT JOIN time_tracking tt ON u.id = tt.user_id
        AND datetime(tt.started_at) >= ${periodFilter}
        AND tt.total_minutes IS NOT NULL
      WHERE ${userFilter}
      GROUP BY u.id, u.name
      HAVING totalHours > 0
      ORDER BY totalHours DESC
      LIMIT 10
    `).all(...params) as any[];

    // Calculate productivity scores for each performer
    const topPerformersWithScores = topPerformers.map(performer => {
      const efficiency = this.calculateEfficiencyMetrics(performer.userId, periodFilter);
      const productivityScore = this.calculateProductivityScore({
        totalWorkMinutes: performer.totalHours * 60,
        ticketsWorkedOn: performer.ticketsWorkedOn,
        averageTimePerTicket: performer.ticketsWorkedOn > 0 ? (performer.totalHours * 60) / performer.ticketsWorkedOn : 0,
        efficiency
      });

      return {
        ...performer,
        productivityScore: Math.round(productivityScore)
      };
    });

    const teamEfficiency = this.calculateTeamEfficiency(params, periodFilter, userFilter);

    return {
      totalTeamHours: Math.round(teamStats.total_team_hours * 100) / 100,
      agentCount: teamStats.agent_count,
      averageHoursPerAgent: teamStats.agent_count > 0 ? Math.round((teamStats.total_team_hours / teamStats.agent_count) * 100) / 100 : 0,
      topPerformers: topPerformersWithScores,
      teamEfficiency
    };
  }

  // Private helper methods

  private getActiveSession(userId: number): any {
    return db.prepare(`
      SELECT * FROM time_tracking
      WHERE user_id = ? AND is_active = 1
      ORDER BY started_at DESC
      LIMIT 1
    `).get(userId);
  }

  private calculateDuration(startTime: string): number {
    const start = new Date(startTime);
    const end = new Date();
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Minutes
  }

  private updateTicketTotalTime(ticketId: number): void {
    const totalMinutes = db.prepare(`
      SELECT COALESCE(SUM(total_minutes), 0) as total
      FROM time_tracking
      WHERE ticket_id = ? AND total_minutes IS NOT NULL
    `).get(ticketId) as any;

    db.prepare(`
      UPDATE tickets
      SET total_time_minutes = ?
      WHERE id = ?
    `).run(totalMinutes.total, ticketId);
  }

  private updateLastActivity(trackingId: number): void {
    db.prepare(`
      UPDATE time_tracking
      SET last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(trackingId);
  }

  private logTimeEvent(ticketId: number, userId: number, eventType: string, data: any): void {
    db.prepare(`
      INSERT INTO audit_logs (user_id, entity_type, entity_id, action, new_values)
      VALUES (?, 'ticket', ?, ?, ?)
    `).run(userId, ticketId, eventType, JSON.stringify(data));
  }

  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  private calculateEfficiencyMetrics(userId: number, periodFilter: string): any {
    // Calculate time to first response
    const firstResponseTime = db.prepare(`
      SELECT AVG(st.response_time_minutes) as avg_response_time
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      WHERE t.assigned_to = ?
        AND datetime(t.created_at) >= ${periodFilter}
        AND st.response_time_minutes IS NOT NULL
    `).get(userId) as any;

    // Calculate time to resolution
    const resolutionTime = db.prepare(`
      SELECT AVG(st.resolution_time_minutes) as avg_resolution_time
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      WHERE t.assigned_to = ?
        AND datetime(t.created_at) >= ${periodFilter}
        AND st.resolution_time_minutes IS NOT NULL
    `).get(userId) as any;

    // Calculate multitasking index (how many tickets worked on simultaneously)
    const multitaskingIndex = db.prepare(`
      SELECT AVG(concurrent_tickets) as avg_multitasking
      FROM (
        SELECT
          date(started_at) as work_date,
          COUNT(DISTINCT ticket_id) as concurrent_tickets
        FROM time_tracking
        WHERE user_id = ?
          AND datetime(started_at) >= ${periodFilter}
        GROUP BY date(started_at)
      )
    `).get(userId) as any;

    return {
      timeToFirstResponse: firstResponseTime?.avg_response_time || 0,
      timeToResolution: resolutionTime?.avg_resolution_time || 0,
      multitaskingIndex: multitaskingIndex?.avg_multitasking || 1
    };
  }

  private calculateProductivityScore(metrics: {
    totalWorkMinutes: number;
    ticketsWorkedOn: number;
    averageTimePerTicket: number;
    efficiency: any;
  }): number {
    // Productivity score based on multiple factors (0-100)
    let score = 0;

    // Time worked component (0-30 points)
    const hoursWorked = metrics.totalWorkMinutes / 60;
    score += Math.min(30, (hoursWorked / 40) * 30); // Assuming 40h/week as baseline

    // Tickets handled component (0-25 points)
    score += Math.min(25, (metrics.ticketsWorkedOn / 20) * 25); // Assuming 20 tickets as good baseline

    // Efficiency component (0-25 points)
    if (metrics.efficiency.timeToFirstResponse > 0) {
      const responseEfficiency = Math.max(0, 100 - (metrics.efficiency.timeToFirstResponse / 60)); // Penalty for slow response
      score += (responseEfficiency / 100) * 12.5;
    }

    if (metrics.efficiency.timeToResolution > 0) {
      const resolutionEfficiency = Math.max(0, 100 - (metrics.efficiency.timeToResolution / (24 * 60))); // Penalty for slow resolution
      score += (resolutionEfficiency / 100) * 12.5;
    }

    // Multitasking balance component (0-20 points)
    const multitaskingOptimal = 3; // Optimal number of concurrent tickets
    const multitaskingScore = Math.max(0, 20 - Math.abs(metrics.efficiency.multitaskingIndex - multitaskingOptimal) * 5);
    score += multitaskingScore;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  private calculateTeamEfficiency(params: any[], periodFilter: string, userFilter: string): any {
    // Average team response time
    const teamResponseTime = db.prepare(`
      SELECT AVG(st.response_time_minutes) as avg_response_time
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE ${userFilter}
        AND datetime(t.created_at) >= ${periodFilter}
        AND st.response_time_minutes IS NOT NULL
    `).all(...params)[0] as any;

    // Average team resolution time
    const teamResolutionTime = db.prepare(`
      SELECT AVG(st.resolution_time_minutes) as avg_resolution_time
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE ${userFilter}
        AND datetime(t.created_at) >= ${periodFilter}
        AND st.resolution_time_minutes IS NOT NULL
    `).all(...params)[0] as any;

    // Team collaboration index (tickets with multiple agents working)
    const collaborationIndex = db.prepare(`
      SELECT
        COUNT(CASE WHEN agent_count > 1 THEN 1 END) * 1.0 / COUNT(*) as collaboration_rate
      FROM (
        SELECT
          ticket_id,
          COUNT(DISTINCT user_id) as agent_count
        FROM time_tracking tt
        LEFT JOIN users u ON tt.user_id = u.id
        WHERE ${userFilter}
          AND datetime(tt.started_at) >= ${periodFilter}
          AND tt.total_minutes IS NOT NULL
        GROUP BY ticket_id
      )
    `).all(...params)[0] as any;

    return {
      averageTimeToFirstResponse: teamResponseTime?.avg_response_time || 0,
      averageTimeToResolution: teamResolutionTime?.avg_resolution_time || 0,
      teamCollaborationIndex: collaborationIndex?.collaboration_rate || 0
    };
  }
}

export const timeTracker = new TimeTracker();