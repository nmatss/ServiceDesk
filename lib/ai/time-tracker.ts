import { executeQuery, executeQueryOne, executeRun, sqlDatetimeSub, sqlColAddMinutes, sqlCastDate } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
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
      const activeSession = await this.getActiveSession(userId);

      if (activeSession) {
        // Auto-stop the previous session
        await this.stopTracking(activeSession.id, userId, 'auto_stopped');
      }

      // Create new tracking entry
      const result = await executeRun(
        `INSERT INTO time_tracking (
          ticket_id, user_id, activity_type, started_at, is_active, created_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)`,
        [ticketId, userId, activityType]
      );

      // Log the start event
      await this.logTimeEvent(ticketId, userId, 'tracking_started', {
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
      const session = await executeQueryOne<any>(
        `SELECT * FROM time_tracking WHERE id = ? AND user_id = ? AND is_active = 1`,
        [trackingId, userId]
      );

      if (!session) {
        return {
          success: false,
          message: 'Active tracking session not found'
        };
      }

      // Calculate duration
      const totalMinutes = this.calculateDuration(session.started_at);

      // Update the tracking session
      await executeRun(
        `UPDATE time_tracking
        SET ended_at = CURRENT_TIMESTAMP,
            total_minutes = ?,
            is_active = 0,
            stop_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [totalMinutes, stopReason, trackingId]
      );

      // Add to ticket's total time
      await this.updateTicketTotalTime(session.ticket_id);

      // Log the stop event
      await this.logTimeEvent(session.ticket_id, userId, 'tracking_stopped', {
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
      const user = await executeQueryOne<User>(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!user || !['admin', 'agent'].includes(user.role)) {
        return; // Only track time for agents and admins
      }

      const activeSession = await this.getActiveSession(userId);
      const ticket = await executeQueryOne<any>(
        `SELECT t.*, s.is_final
        FROM tickets t
        LEFT JOIN statuses s ON t.status_id = s.id
        WHERE t.id = ?`,
        [ticketId]
      );

      if (!ticket) return;

      // Auto-start tracking on meaningful activities
      if (['comment_added', 'status_changed', 'attachment_uploaded'].includes(activity)) {
        if (!activeSession || activeSession.ticket_id !== ticketId) {
          await this.startTracking(ticketId, userId, 'work');
        } else {
          // Update last activity to prevent auto-stop
          await this.updateLastActivity(activeSession.id);
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
      const inactiveSessions = await executeQuery<any>(
        `SELECT * FROM time_tracking
        WHERE is_active = 1
        AND ${sqlColAddMinutes('last_activity', 30)} < CURRENT_TIMESTAMP`,
        []
      );

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
  async getTicketTimeAnalytics(ticketId: number): Promise<{
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
  }> {
    // Get total time statistics
    const totalStats = await executeQueryOne<any>(
      `SELECT
        COALESCE(SUM(total_minutes), 0) as total_minutes,
        COUNT(*) as session_count,
        ROUND(AVG(total_minutes), 2) as avg_session_minutes
      FROM time_tracking
      WHERE ticket_id = ? AND total_minutes IS NOT NULL`,
      [ticketId]
    );

    // Get time by user
    const timeByUser = await executeQuery<any>(
      `SELECT
        u.id as userId,
        u.name as userName,
        COALESCE(SUM(tt.total_minutes), 0) as totalMinutes,
        COUNT(tt.id) as sessionCount
      FROM users u
      LEFT JOIN time_tracking tt ON u.id = tt.user_id AND tt.ticket_id = ? AND tt.total_minutes IS NOT NULL
      WHERE u.id IN (SELECT DISTINCT user_id FROM time_tracking WHERE ticket_id = ?)
      GROUP BY u.id, u.name
      ORDER BY totalMinutes DESC`,
      [ticketId, ticketId]
    );

    // Get time by activity type
    const timeByActivity = await executeQuery<any>(
      `SELECT
        activity_type as activityType,
        COALESCE(SUM(total_minutes), 0) as totalMinutes,
        COUNT(*) as sessionCount
      FROM time_tracking
      WHERE ticket_id = ? AND total_minutes IS NOT NULL
      GROUP BY activity_type
      ORDER BY totalMinutes DESC`,
      [ticketId]
    );

    // Get daily breakdown
    const dailyBreakdown = await executeQuery<any>(
      `SELECT
        ${sqlCastDate('started_at')} as date,
        COALESCE(SUM(total_minutes), 0) as totalMinutes,
        COUNT(*) as sessionCount
      FROM time_tracking
      WHERE ticket_id = ? AND total_minutes IS NOT NULL
      GROUP BY ${sqlCastDate('started_at')}
      ORDER BY ${sqlCastDate('started_at')}`,
      [ticketId]
    );

    return {
      totalMinutes: totalStats?.total_minutes || 0,
      totalHours: Math.round((totalStats?.total_minutes || 0) / 60 * 100) / 100,
      sessionCount: totalStats?.session_count || 0,
      averageSessionMinutes: totalStats?.avg_session_minutes || 0,
      timeByUser: timeByUser || [],
      timeByActivity: timeByActivity || [],
      dailyBreakdown: dailyBreakdown || []
    };
  }

  /**
   * Get agent productivity analytics
   */
  async getAgentProductivityAnalytics(userId: number, period: 'week' | 'month' | 'quarter' = 'month'): Promise<{
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
  }> {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const periodFilter = sqlDatetimeSub(periodDays);

    // Get total work statistics
    const workStats = await executeQueryOne<any>(
      `SELECT
        COALESCE(SUM(total_minutes), 0) as total_work_minutes,
        COUNT(DISTINCT ticket_id) as tickets_worked_on,
        ROUND(AVG(total_minutes), 2) as avg_time_per_session
      FROM time_tracking
      WHERE user_id = ?
        AND started_at >= ${periodFilter}
        AND total_minutes IS NOT NULL`,
      [userId]
    );

    // Get time distribution by activity
    const timeDistribution = await executeQuery<any>(
      `SELECT
        activity_type,
        COALESCE(SUM(total_minutes), 0) as total_minutes
      FROM time_tracking
      WHERE user_id = ?
        AND started_at >= ${periodFilter}
        AND total_minutes IS NOT NULL
      GROUP BY activity_type`,
      [userId]
    );

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
    const dailyPattern = await executeQuery<any>(
      `SELECT
        ${sqlCastDate('started_at')} as date,
        COALESCE(SUM(total_minutes), 0) as totalMinutes,
        COUNT(DISTINCT ticket_id) as ticketsWorkedOn
      FROM time_tracking
      WHERE user_id = ?
        AND started_at >= ${periodFilter}
        AND total_minutes IS NOT NULL
      GROUP BY ${sqlCastDate('started_at')}
      ORDER BY ${sqlCastDate('started_at')}`,
      [userId]
    );

    // Calculate efficiency metrics
    const efficiency = await this.calculateEfficiencyMetrics(userId, periodDays);

    const totalWorkMinutes = workStats?.total_work_minutes || 0;
    const ticketsWorkedOn = workStats?.tickets_worked_on || 0;
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
  async getTeamTimeAnalytics(departmentId?: number, period: 'week' | 'month' | 'quarter' = 'month'): Promise<{
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
  }> {
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const periodFilter = sqlDatetimeSub(periodDays);

    let userFilter = "u.role IN ('admin', 'agent')";
    const params: any[] = [];

    if (departmentId) {
      userFilter += " AND u.id IN (SELECT user_id FROM user_departments WHERE department_id = ?)";
      params.push(departmentId);
    }

    // Get team statistics
    const teamStatsRows = await executeQuery<any>(
      `SELECT
        COUNT(DISTINCT u.id) as agent_count,
        COALESCE(SUM(tt.total_minutes), 0) / 60.0 as total_team_hours
      FROM users u
      LEFT JOIN time_tracking tt ON u.id = tt.user_id
        AND tt.started_at >= ${periodFilter}
        AND tt.total_minutes IS NOT NULL
      WHERE ${userFilter}`,
      params
    );
    const teamStats = teamStatsRows[0] || { agent_count: 0, total_team_hours: 0 };

    // Get top performers
    const topPerformers = await executeQuery<any>(
      `SELECT
        u.id as userId,
        u.name as userName,
        COALESCE(SUM(tt.total_minutes), 0) / 60.0 as totalHours,
        COUNT(DISTINCT tt.ticket_id) as ticketsWorkedOn
      FROM users u
      LEFT JOIN time_tracking tt ON u.id = tt.user_id
        AND tt.started_at >= ${periodFilter}
        AND tt.total_minutes IS NOT NULL
      WHERE ${userFilter}
      GROUP BY u.id, u.name
      HAVING COALESCE(SUM(tt.total_minutes), 0) > 0
      ORDER BY totalHours DESC
      LIMIT 10`,
      params
    );

    // Calculate productivity scores for each performer
    const topPerformersWithScores = [];
    for (const performer of topPerformers) {
      const efficiency = await this.calculateEfficiencyMetrics(performer.userId, periodDays);
      const productivityScore = this.calculateProductivityScore({
        totalWorkMinutes: performer.totalHours * 60,
        ticketsWorkedOn: performer.ticketsWorkedOn,
        averageTimePerTicket: performer.ticketsWorkedOn > 0 ? (performer.totalHours * 60) / performer.ticketsWorkedOn : 0,
        efficiency
      });

      topPerformersWithScores.push({
        ...performer,
        productivityScore: Math.round(productivityScore)
      });
    }

    const teamEfficiency = await this.calculateTeamEfficiency(params, periodDays, userFilter);

    return {
      totalTeamHours: Math.round(teamStats.total_team_hours * 100) / 100,
      agentCount: teamStats.agent_count,
      averageHoursPerAgent: teamStats.agent_count > 0 ? Math.round((teamStats.total_team_hours / teamStats.agent_count) * 100) / 100 : 0,
      topPerformers: topPerformersWithScores,
      teamEfficiency
    };
  }

  // Private helper methods

  private async getActiveSession(userId: number): Promise<any> {
    return await executeQueryOne<any>(
      `SELECT * FROM time_tracking
      WHERE user_id = ? AND is_active = 1
      ORDER BY started_at DESC
      LIMIT 1`,
      [userId]
    );
  }

  private calculateDuration(startTime: string): number {
    const start = new Date(startTime);
    const end = new Date();
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Minutes
  }

  private async updateTicketTotalTime(ticketId: number): Promise<void> {
    const totalMinutes = await executeQueryOne<any>(
      `SELECT COALESCE(SUM(total_minutes), 0) as total
      FROM time_tracking
      WHERE ticket_id = ? AND total_minutes IS NOT NULL`,
      [ticketId]
    );

    await executeRun(
      `UPDATE tickets
      SET total_time_minutes = ?
      WHERE id = ?`,
      [totalMinutes?.total || 0, ticketId]
    );
  }

  private async updateLastActivity(trackingId: number): Promise<void> {
    await executeRun(
      `UPDATE time_tracking
      SET last_activity = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [trackingId]
    );
  }

  private async logTimeEvent(ticketId: number, userId: number, eventType: string, data: any): Promise<void> {
    await executeRun(
      `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, new_values)
      VALUES (?, 'ticket', ?, ?, ?)`,
      [userId, ticketId, eventType, JSON.stringify(data)]
    );
  }

  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  private async calculateEfficiencyMetrics(userId: number, periodDays: number): Promise<any> {
    const periodFilter = sqlDatetimeSub(periodDays);

    // Calculate time to first response
    const firstResponseTime = await executeQueryOne<any>(
      `SELECT AVG(st.response_time_minutes) as avg_response_time
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      WHERE t.assigned_to = ?
        AND t.created_at >= ${periodFilter}
        AND st.response_time_minutes IS NOT NULL`,
      [userId]
    );

    // Calculate time to resolution
    const resolutionTime = await executeQueryOne<any>(
      `SELECT AVG(st.resolution_time_minutes) as avg_resolution_time
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      WHERE t.assigned_to = ?
        AND t.created_at >= ${periodFilter}
        AND st.resolution_time_minutes IS NOT NULL`,
      [userId]
    );

    // Calculate multitasking index (how many tickets worked on simultaneously)
    const multitaskingIndex = await executeQueryOne<any>(
      `SELECT AVG(concurrent_tickets) as avg_multitasking
      FROM (
        SELECT
          ${sqlCastDate('started_at')} as work_date,
          COUNT(DISTINCT ticket_id) as concurrent_tickets
        FROM time_tracking
        WHERE user_id = ?
          AND started_at >= ${periodFilter}
        GROUP BY ${sqlCastDate('started_at')}
      ) sub`,
      [userId]
    );

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

  private async calculateTeamEfficiency(params: any[], periodDays: number, userFilter: string): Promise<any> {
    const periodFilter = sqlDatetimeSub(periodDays);

    // Average team response time
    const teamResponseTimeRows = await executeQuery<any>(
      `SELECT AVG(st.response_time_minutes) as avg_response_time
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE ${userFilter}
        AND t.created_at >= ${periodFilter}
        AND st.response_time_minutes IS NOT NULL`,
      params
    );
    const teamResponseTime = teamResponseTimeRows[0];

    // Average team resolution time
    const teamResolutionTimeRows = await executeQuery<any>(
      `SELECT AVG(st.resolution_time_minutes) as avg_resolution_time
      FROM sla_tracking st
      LEFT JOIN tickets t ON st.ticket_id = t.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE ${userFilter}
        AND t.created_at >= ${periodFilter}
        AND st.resolution_time_minutes IS NOT NULL`,
      params
    );
    const teamResolutionTime = teamResolutionTimeRows[0];

    // Team collaboration index (tickets with multiple agents working)
    const collaborationIndexRows = await executeQuery<any>(
      `SELECT
        COUNT(CASE WHEN agent_count > 1 THEN 1 END) * 1.0 / NULLIF(COUNT(*), 0) as collaboration_rate
      FROM (
        SELECT
          ticket_id,
          COUNT(DISTINCT tt.user_id) as agent_count
        FROM time_tracking tt
        LEFT JOIN users u ON tt.user_id = u.id
        WHERE ${userFilter}
          AND tt.started_at >= ${periodFilter}
          AND tt.total_minutes IS NOT NULL
        GROUP BY ticket_id
      ) sub`,
      params
    );
    const collaborationIndex = collaborationIndexRows[0];

    return {
      averageTimeToFirstResponse: teamResponseTime?.avg_response_time || 0,
      averageTimeToResolution: teamResolutionTime?.avg_resolution_time || 0,
      teamCollaborationIndex: collaborationIndex?.collaboration_rate || 0
    };
  }
}

export const timeTracker = new TimeTracker();
