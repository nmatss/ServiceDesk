/**
 * Predictive Analytics Engine
 *
 * ML-based predictions for:
 * - SLA violation prediction
 * - Demand forecasting
 * - Anomaly detection
 * - Resource optimization recommendations
 */

import db from '@/lib/db/connection';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface TicketRecord {
  id: number;
  category_id: number;
  priority_id: number;
  status_id: number;
  assigned_to: number | null;
  created_at: string;
  updated_at: string;
  category_name: string;
  priority_name: string;
  status_name: string;
  agent_name: string | null;
  response_time_target: number;
  resolution_time_target: number;
  is_violated: number;
  age_hours: number;
}

interface HistoricalPerformance {
  avg_resolution_hours: number;
  total_tickets: number;
  violated_count: number;
}

interface AgentWorkload {
  active_tickets: number;
}

interface HistoricalDataRecord {
  date: string;
  count: number;
  priority: string;
  category: string;
}

interface VolumeDataRecord {
  date: string;
  count: number;
}

interface ResolutionTimeData {
  avg_hours: number;
}

interface SLATrackingData {
  total: number;
  violated: number;
}

interface WorkloadData {
  total_active: number;
  agent_count: number;
}

interface AgentPerformanceRecord {
  id: number;
  name: string;
  resolved_tickets: number;
  avg_resolution_time: number;
  sla_violations: number;
}

interface WorkloadDistribution {
  id: number;
  name: string;
  active_tickets: number;
}

export interface SLAPrediction {
  ticket_id: number;
  predicted_violation_probability: number; // 0-1
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  estimated_resolution_time: number; // hours
  recommended_actions: string[];
  contributing_factors: {
    factor: string;
    impact: number; // 0-1
  }[];
}

export interface DemandForecast {
  date: string;
  predicted_tickets: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  predicted_by_priority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  predicted_by_category: Record<string, number>;
  seasonality_factor: number;
  trend_factor: number;
}

export interface AnomalyDetection {
  timestamp: Date;
  metric_name: string;
  actual_value: number;
  expected_value: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  anomaly_type: 'spike' | 'drop' | 'drift' | 'outlier';
  description: string;
  suggested_investigation: string[];
}

export interface ResourceOptimization {
  recommendation_type: 'staffing' | 'training' | 'redistribution' | 'automation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expected_impact: {
    metric: string;
    improvement_percentage: number;
  }[];
  implementation_effort: 'low' | 'medium' | 'high';
  estimated_cost_savings: number;
  affected_agents?: number[];
  affected_categories?: string[];
}

// ============================================================================
// SLA Violation Prediction
// ============================================================================

export class SLAViolationPredictor {
  /**
   * Predict probability of SLA violation for active tickets
   */
  async predictViolations(ticketIds?: number[]): Promise<SLAPrediction[]> {
    const tickets = await this.getActiveTickets(ticketIds);
    const predictions: SLAPrediction[] = [];

    for (const ticket of tickets) {
      const prediction = await this.predictTicketViolation(ticket);
      predictions.push(prediction);
    }

    return predictions.sort((a, b) => b.predicted_violation_probability - a.predicted_violation_probability);
  }

  /**
   * Predict violation for a single ticket
   */
  private async predictTicketViolation(ticket: TicketRecord): Promise<SLAPrediction> {
    const features = await this.extractFeatures(ticket);
    const probability = this.calculateViolationProbability(features);
    const riskLevel = this.getRiskLevel(probability);
    const estimatedTime = this.estimateResolutionTime(features);
    const contributingFactors = this.identifyContributingFactors(features);
    const recommendations = this.generateRecommendations(riskLevel, contributingFactors);

    return {
      ticket_id: ticket.id,
      predicted_violation_probability: probability,
      risk_level: riskLevel,
      estimated_resolution_time: estimatedTime,
      recommended_actions: recommendations,
      contributing_factors: contributingFactors,
    };
  }

  /**
   * Get active tickets from database
   */
  private async getActiveTickets(ticketIds?: number[]): Promise<TicketRecord[]> {
    let query = `
      SELECT
        t.*,
        c.name as category_name,
        p.name as priority_name,
        s.name as status_name,
        u.name as agent_name,
        sla.response_time_target,
        sla.resolution_time_target,
        st.is_violated,
        CAST((julianday('now') - julianday(t.created_at)) * 24 AS INTEGER) as age_hours
      FROM tickets t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN sla_policies sla ON sla.priority_id = t.priority_id
      LEFT JOIN sla_tracking st ON st.ticket_id = t.id
      WHERE s.name IN ('open', 'in_progress')
    `;

    if (ticketIds && ticketIds.length > 0) {
      query += ` AND t.id IN (${ticketIds.join(',')})`;
    }

    return db.prepare(query).all() as TicketRecord[];
  }

  /**
   * Extract features for ML model
   */
  private async extractFeatures(ticket: TicketRecord): Promise<Record<string, number>> {
    // Calculate historical performance for this category/priority combination
    const historicalPerformance = db.prepare(`
      SELECT
        AVG(CAST((julianday(updated_at) - julianday(created_at)) * 24 AS INTEGER)) as avg_resolution_hours,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN st.is_violated = 1 THEN 1 ELSE 0 END) as violated_count
      FROM tickets t
      LEFT JOIN sla_tracking st ON st.ticket_id = t.id
      WHERE t.category_id = ?
        AND t.priority_id = ?
        AND t.status_id = (SELECT id FROM statuses WHERE name = 'resolved')
    `).get(ticket.category_id, ticket.priority_id) as HistoricalPerformance | undefined;

    // Agent workload
    const agentWorkload = ticket.assigned_to ? db.prepare(`
      SELECT COUNT(*) as active_tickets
      FROM tickets
      WHERE assigned_to = ?
        AND status_id IN (SELECT id FROM statuses WHERE name IN ('open', 'in_progress'))
    `).get(ticket.assigned_to) as AgentWorkload : { active_tickets: 0 };

    // Time-based features
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    const isBusinessHours = currentHour >= 9 && currentHour < 18 && currentDay >= 1 && currentDay <= 5;

    return {
      age_hours: ticket.age_hours || 0,
      priority_level: this.getPriorityLevel(ticket.priority_name),
      category_complexity: this.getCategoryComplexity(ticket.category_name),
      agent_workload: agentWorkload.active_tickets || 0,
      historical_violation_rate: historicalPerformance
        ? (historicalPerformance.violated_count / historicalPerformance.total_tickets) || 0
        : 0,
      historical_avg_resolution: historicalPerformance?.avg_resolution_hours || 24,
      response_time_target: ticket.response_time_target || 4,
      resolution_time_target: ticket.resolution_time_target || 24,
      is_business_hours: isBusinessHours ? 1 : 0,
      has_agent_assigned: ticket.assigned_to ? 1 : 0,
      is_already_violated: ticket.is_violated ? 1 : 0,
    };
  }

  /**
   * Calculate violation probability using weighted features
   */
  private calculateViolationProbability(features: Record<string, number>): number {
    // Simple weighted model (in production, this would be a trained ML model)
    let score = 0;

    // Age factor (exponential growth)
    const ageRatio = (features.age_hours ?? 0) / (features.resolution_time_target ?? 24);
    score += Math.min(ageRatio * 0.3, 0.4);

    // Priority factor
    score += (features.priority_level ?? 0.5) * 0.15;

    // Agent workload factor
    const agentWorkload = features.agent_workload ?? 0;
    if (agentWorkload > 10) score += 0.15;
    else if (agentWorkload > 5) score += 0.08;

    // Historical violation rate
    score += (features.historical_violation_rate ?? 0) * 0.2;

    // Business hours (lower risk during business hours)
    if (!features.is_business_hours) score += 0.1;

    // No agent assigned
    if (!features.has_agent_assigned) score += 0.15;

    // Already violated
    if (features.is_already_violated) score += 0.3;

    // Category complexity
    score += (features.category_complexity ?? 0.5) * 0.1;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Get risk level from probability
   */
  private getRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability >= 0.8) return 'critical';
    if (probability >= 0.6) return 'high';
    if (probability >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Estimate resolution time
   */
  private estimateResolutionTime(features: Record<string, number>): number {
    let baseTime = features.historical_avg_resolution ?? 24;

    // Adjust for current workload
    const workloadFactor = 1 + ((features.agent_workload ?? 0) * 0.05);
    baseTime *= workloadFactor;

    // Adjust for business hours
    if (!features.is_business_hours) {
      baseTime *= 1.5;
    }

    return Math.round(baseTime);
  }

  /**
   * Identify contributing factors
   */
  private identifyContributingFactors(features: Record<string, number>): { factor: string; impact: number }[] {
    const factors: { factor: string; impact: number }[] = [];

    const ageHours = features.age_hours ?? 0;
    const resolutionTarget = features.resolution_time_target ?? 24;

    if (ageHours > resolutionTarget * 0.7) {
      factors.push({ factor: 'Approaching deadline', impact: 0.3 });
    }

    if ((features.agent_workload ?? 0) > 8) {
      factors.push({ factor: 'High agent workload', impact: 0.25 });
    }

    if ((features.historical_violation_rate ?? 0) > 0.3) {
      factors.push({ factor: 'Category has high violation rate', impact: 0.2 });
    }

    if (!features.has_agent_assigned) {
      factors.push({ factor: 'No agent assigned', impact: 0.35 });
    }

    if (!features.is_business_hours) {
      factors.push({ factor: 'Outside business hours', impact: 0.15 });
    }

    if ((features.category_complexity ?? 0) > 0.6) {
      factors.push({ factor: 'Complex category', impact: 0.2 });
    }

    return factors.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Generate recommendations based on risk level
   */
  private generateRecommendations(riskLevel: string, factors: { factor: string; impact: number }[]): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Escalate to senior agent immediately');
      recommendations.push('Notify team lead');
    }

    factors.forEach(factor => {
      if (factor.factor === 'No agent assigned') {
        recommendations.push('Assign agent immediately');
      }
      if (factor.factor === 'High agent workload') {
        recommendations.push('Consider reassigning to less loaded agent');
      }
      if (factor.factor === 'Complex category') {
        recommendations.push('Assign to specialist with expertise in this category');
      }
    });

    if (riskLevel !== 'low') {
      recommendations.push('Add internal note with progress update');
      recommendations.push('Contact customer for status check');
    }

    return recommendations;
  }

  /**
   * Helper: Get priority level (0-1)
   */
  private getPriorityLevel(priorityName: string): number {
    const levels: Record<string, number> = {
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1.0,
    };
    return levels[priorityName?.toLowerCase()] || 0.5;
  }

  /**
   * Helper: Get category complexity (0-1)
   */
  private getCategoryComplexity(categoryName: string): number {
    // In production, this would be based on historical data
    const complexityMap: Record<string, number> = {
      'technical issue': 0.8,
      'bug report': 0.7,
      'feature request': 0.6,
      'general inquiry': 0.3,
      'billing': 0.4,
    };
    return complexityMap[categoryName?.toLowerCase()] || 0.5;
  }
}

// ============================================================================
// Demand Forecasting
// ============================================================================

export class DemandForecaster {
  /**
   * Forecast ticket volume for next N days
   */
  async forecastDemand(days: number = 7): Promise<DemandForecast[]> {
    const historicalData = await this.getHistoricalData();
    const forecasts: DemandForecast[] = [];

    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + i);

      const forecast = this.generateForecast(forecastDate, historicalData);
      forecasts.push(forecast);
    }

    return forecasts;
  }

  /**
   * Get historical ticket data
   */
  private async getHistoricalData(): Promise<HistoricalDataRecord[]> {
    const data = db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as count,
        p.name as priority,
        c.name as category
      FROM tickets t
      LEFT JOIN priorities p ON t.priority_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE created_at >= date('now', '-90 days')
      GROUP BY date(created_at), p.name, c.name
      ORDER BY date(created_at)
    `).all();

    return data as HistoricalDataRecord[];
  }

  /**
   * Generate forecast for a specific date
   */
  private generateForecast(date: Date, historicalData: HistoricalDataRecord[]): DemandForecast {
    const dayOfWeek = date.getDay();

    // Calculate base trend
    const recentAvg = this.calculateMovingAverage(historicalData, 7);
    const seasonalityFactor = this.getSeasonalityFactor(dayOfWeek);
    const trendFactor = this.getTrendFactor(historicalData);

    const predictedTickets = Math.round(recentAvg * seasonalityFactor * trendFactor);

    // Calculate confidence interval (±20%)
    const confidence_interval = {
      lower: Math.round(predictedTickets * 0.8),
      upper: Math.round(predictedTickets * 1.2),
    };

    // Predict by priority (typical distribution)
    const predicted_by_priority = {
      low: Math.round(predictedTickets * 0.3),
      medium: Math.round(predictedTickets * 0.45),
      high: Math.round(predictedTickets * 0.2),
      critical: Math.round(predictedTickets * 0.05),
    };

    // Predict by category
    const categoryDistribution = this.getCategoryDistribution(historicalData);
    const predicted_by_category: Record<string, number> = {};
    Object.entries(categoryDistribution).forEach(([category, ratio]) => {
      predicted_by_category[category] = Math.round(predictedTickets * (ratio as number));
    });

    return {
      date: date.toISOString().split('T')[0] || '',
      predicted_tickets: predictedTickets,
      confidence_interval,
      predicted_by_priority,
      predicted_by_category,
      seasonality_factor: seasonalityFactor,
      trend_factor: trendFactor,
    };
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(data: HistoricalDataRecord[], window: number): number {
    const dailyTotals = data.reduce((acc: Record<string, number>, item) => {
      acc[item.date] = (acc[item.date] || 0) + item.count;
      return acc;
    }, {});

    const values = Object.values(dailyTotals);
    const recent = values.slice(-window);
    return recent.reduce((sum, val) => sum + (val as number), 0) / recent.length;
  }

  /**
   * Get seasonality factor based on day of week
   */
  private getSeasonalityFactor(dayOfWeek: number): number {
    // 0 = Sunday, 6 = Saturday
    const factors = [0.6, 1.1, 1.2, 1.15, 1.1, 1.0, 0.5]; // Mon-Fri higher
    return factors[dayOfWeek] || 1.0;
  }

  /**
   * Calculate trend factor
   */
  private getTrendFactor(data: HistoricalDataRecord[]): number {
    const dailyTotals = data.reduce((acc: Record<string, number>, item) => {
      acc[item.date] = (acc[item.date] || 0) + item.count;
      return acc;
    }, {});

    const values = Object.values(dailyTotals).map(v => v as number);
    if (values.length < 14) return 1.0;

    const firstWeek = values.slice(0, 7).reduce((sum, v) => sum + v, 0) / 7;
    const lastWeek = values.slice(-7).reduce((sum, v) => sum + v, 0) / 7;

    return lastWeek / firstWeek;
  }

  /**
   * Get category distribution
   */
  private getCategoryDistribution(data: HistoricalDataRecord[]): Record<string, number> {
    const categoryTotals = data.reduce((acc: Record<string, number>, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.count;
      return acc;
    }, {});

    const total = Object.values(categoryTotals).reduce((sum, val) => sum + (val as number), 0);

    const distribution: Record<string, number> = {};
    Object.entries(categoryTotals).forEach(([category, count]) => {
      distribution[category] = (count as number) / total;
    });

    return distribution;
  }
}

// ============================================================================
// Anomaly Detection
// ============================================================================

export class AnomalyDetector {
  /**
   * Detect anomalies in ticket metrics
   */
  async detectAnomalies(): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    // Check volume anomalies
    const volumeAnomalies = await this.detectVolumeAnomalies();
    anomalies.push(...volumeAnomalies);

    // Check resolution time anomalies
    const resolutionAnomalies = await this.detectResolutionTimeAnomalies();
    anomalies.push(...resolutionAnomalies);

    // Check SLA anomalies
    const slaAnomalies = await this.detectSLAAnomalies();
    anomalies.push(...slaAnomalies);

    return anomalies;
  }

  /**
   * Detect volume anomalies
   */
  private async detectVolumeAnomalies(): Promise<AnomalyDetection[]> {
    const data = db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as count
      FROM tickets
      WHERE created_at >= date('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date
    `).all() as VolumeDataRecord[];

    const values = data.map(d => d.count);
    const stats = this.calculateStatistics(values);
    const anomalies: AnomalyDetection[] = [];

    const today = data[data.length - 1];
    if (today) {
      const deviation = (today.count - stats.mean) / stats.stdDev;

      if (Math.abs(deviation) > 2) {
        anomalies.push({
          timestamp: new Date(),
          metric_name: 'ticket_volume',
          actual_value: today.count,
          expected_value: Math.round(stats.mean),
          deviation: Math.round(deviation * 100) / 100,
          severity: Math.abs(deviation) > 3 ? 'high' : 'medium',
          anomaly_type: deviation > 0 ? 'spike' : 'drop',
          description: `Ticket volume ${deviation > 0 ? 'spike' : 'drop'} detected: ${today.count} vs expected ${Math.round(stats.mean)}`,
          suggested_investigation: [
            'Check for system issues or outages',
            'Review recent product changes',
            'Analyze ticket categories for unusual patterns',
          ],
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect resolution time anomalies
   */
  private async detectResolutionTimeAnomalies(): Promise<AnomalyDetection[]> {
    const data = db.prepare(`
      SELECT
        AVG(CAST((julianday(updated_at) - julianday(created_at)) * 24 AS INTEGER)) as avg_hours
      FROM tickets
      WHERE status_id = (SELECT id FROM statuses WHERE name = 'resolved')
        AND date(updated_at) >= date('now', '-7 days')
    `).get() as ResolutionTimeData | undefined;

    const historical = db.prepare(`
      SELECT
        AVG(CAST((julianday(updated_at) - julianday(created_at)) * 24 AS INTEGER)) as avg_hours
      FROM tickets
      WHERE status_id = (SELECT id FROM statuses WHERE name = 'resolved')
        AND date(updated_at) >= date('now', '-30 days')
        AND date(updated_at) < date('now', '-7 days')
    `).get() as ResolutionTimeData | undefined;

    const anomalies: AnomalyDetection[] = [];

    if (data && data.avg_hours && historical && historical.avg_hours) {
      const change = ((data.avg_hours - historical.avg_hours) / historical.avg_hours) * 100;

      if (Math.abs(change) > 30) {
        anomalies.push({
          timestamp: new Date(),
          metric_name: 'resolution_time',
          actual_value: data.avg_hours,
          expected_value: historical.avg_hours,
          deviation: change,
          severity: Math.abs(change) > 50 ? 'high' : 'medium',
          anomaly_type: change > 0 ? 'drift' : 'outlier',
          description: `Resolution time ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}%`,
          suggested_investigation: [
            'Review agent performance metrics',
            'Check for complex ticket influx',
            'Analyze resource allocation',
          ],
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect SLA anomalies
   */
  private async detectSLAAnomalies(): Promise<AnomalyDetection[]> {
    const data = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_violated = 1 THEN 1 ELSE 0 END) as violated
      FROM sla_tracking
      WHERE created_at >= date('now', '-7 days')
    `).get() as SLATrackingData | undefined;

    const historical = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_violated = 1 THEN 1 ELSE 0 END) as violated
      FROM sla_tracking
      WHERE created_at >= date('now', '-30 days')
        AND created_at < date('now', '-7 days')
    `).get() as SLATrackingData | undefined;

    const anomalies: AnomalyDetection[] = [];

    if (data && data.total > 0 && historical && historical.total > 0) {
      const currentRate = (data.violated / data.total) * 100;
      const historicalRate = (historical.violated / historical.total) * 100;
      const change = currentRate - historicalRate;

      if (Math.abs(change) > 10) {
        anomalies.push({
          timestamp: new Date(),
          metric_name: 'sla_violation_rate',
          actual_value: currentRate,
          expected_value: historicalRate,
          deviation: change,
          severity: Math.abs(change) > 20 ? 'high' : 'medium',
          anomaly_type: 'drift',
          description: `SLA violation rate ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}%`,
          suggested_investigation: [
            'Review SLA policy settings',
            'Analyze ticket complexity trends',
            'Check staffing levels',
          ],
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate basic statistics
   */
  private calculateStatistics(values: number[]): { mean: number; stdDev: number } {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
  }
}

// ============================================================================
// Resource Optimization
// ============================================================================

export class ResourceOptimizer {
  /**
   * Generate resource optimization recommendations
   */
  async generateRecommendations(): Promise<ResourceOptimization[]> {
    const recommendations: ResourceOptimization[] = [];

    // Staffing recommendations
    const staffingRecs = await this.analyzeStaffingNeeds();
    recommendations.push(...staffingRecs);

    // Training recommendations
    const trainingRecs = await this.identifyTrainingNeeds();
    recommendations.push(...trainingRecs);

    // Redistribution recommendations
    const redistributionRecs = await this.analyzeWorkloadDistribution();
    recommendations.push(...redistributionRecs);

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Analyze staffing needs
   */
  private async analyzeStaffingNeeds(): Promise<ResourceOptimization[]> {
    const recommendations: ResourceOptimization[] = [];

    const workload = db.prepare(`
      SELECT
        COUNT(*) as total_active,
        (SELECT COUNT(*) FROM users WHERE role IN ('admin', 'agent')) as agent_count
      FROM tickets
      WHERE status_id IN (SELECT id FROM statuses WHERE name IN ('open', 'in_progress'))
    `).get() as WorkloadData | undefined;

    if (!workload || workload.agent_count === 0) {
      return recommendations;
    }

    const ticketsPerAgent = workload.total_active / workload.agent_count;

    if (ticketsPerAgent > 15) {
      recommendations.push({
        recommendation_type: 'staffing',
        priority: ticketsPerAgent > 20 ? 'critical' : 'high',
        title: 'Increase staffing levels',
        description: `Current workload is ${ticketsPerAgent.toFixed(1)} tickets per agent, exceeding optimal capacity`,
        expected_impact: [
          { metric: 'avg_resolution_time', improvement_percentage: -25 },
          { metric: 'sla_compliance', improvement_percentage: 15 },
        ],
        implementation_effort: 'high',
        estimated_cost_savings: 50000,
      });
    }

    return recommendations;
  }

  /**
   * Identify training needs
   */
  private async identifyTrainingNeeds(): Promise<ResourceOptimization[]> {
    const recommendations: ResourceOptimization[] = [];

    const agentPerformance = db.prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(t.id) as resolved_tickets,
        AVG(CAST((julianday(t.updated_at) - julianday(t.created_at)) * 24 AS INTEGER)) as avg_resolution_time,
        SUM(CASE WHEN st.is_violated = 1 THEN 1 ELSE 0 END) as sla_violations
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id AND t.status_id = (SELECT id FROM statuses WHERE name = 'resolved')
      LEFT JOIN sla_tracking st ON st.ticket_id = t.id
      WHERE u.role IN ('admin', 'agent')
        AND t.created_at >= date('now', '-30 days')
      GROUP BY u.id, u.name
      HAVING COUNT(t.id) > 5
    `).all() as AgentPerformanceRecord[];

    const avgResolutionTime = agentPerformance.reduce((sum, a) => sum + a.avg_resolution_time, 0) / agentPerformance.length;

    const underperformingAgents = agentPerformance.filter(
      a => a.avg_resolution_time > avgResolutionTime * 1.3 || (a.sla_violations / a.resolved_tickets) > 0.2
    );

    if (underperformingAgents.length > 0) {
      recommendations.push({
        recommendation_type: 'training',
        priority: 'medium',
        title: 'Targeted agent training program',
        description: `${underperformingAgents.length} agents showing below-average performance metrics`,
        expected_impact: [
          { metric: 'avg_resolution_time', improvement_percentage: -15 },
          { metric: 'agent_efficiency', improvement_percentage: 20 },
        ],
        implementation_effort: 'medium',
        estimated_cost_savings: 20000,
        affected_agents: underperformingAgents.map(a => a.id),
      });
    }

    return recommendations;
  }

  /**
   * Analyze workload distribution
   */
  private async analyzeWorkloadDistribution(): Promise<ResourceOptimization[]> {
    const recommendations: ResourceOptimization[] = [];

    const distribution = db.prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(t.id) as active_tickets
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id
        AND t.status_id IN (SELECT id FROM statuses WHERE name IN ('open', 'in_progress'))
      WHERE u.role IN ('admin', 'agent')
      GROUP BY u.id, u.name
    `).all() as WorkloadDistribution[];

    const maxWorkload = Math.max(...distribution.map(d => d.active_tickets));
    const minWorkload = Math.min(...distribution.map(d => d.active_tickets));

    if (maxWorkload - minWorkload > 10) {
      recommendations.push({
        recommendation_type: 'redistribution',
        priority: 'high',
        title: 'Rebalance ticket assignments',
        description: `Significant workload imbalance detected (${maxWorkload} vs ${minWorkload} tickets)`,
        expected_impact: [
          { metric: 'team_efficiency', improvement_percentage: 18 },
          { metric: 'agent_satisfaction', improvement_percentage: 12 },
        ],
        implementation_effort: 'low',
        estimated_cost_savings: 10000,
      });
    }

    return recommendations;
  }
}

// ============================================================================
// Export Singleton Instances
// ============================================================================

export const slaPredictor = new SLAViolationPredictor();
export const demandForecaster = new DemandForecaster();
export const anomalyDetector = new AnomalyDetector();
export const resourceOptimizer = new ResourceOptimizer();
