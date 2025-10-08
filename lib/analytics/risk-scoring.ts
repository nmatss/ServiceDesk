// Enterprise Risk Scoring Engine
// Calculates comprehensive risk scores for tickets, agents, customers, and business operations

import { mlPipeline, MLModel } from './ml-pipeline';
import { logger } from '../monitoring/logger';

export interface RiskScore {
  entity_id: string;
  entity_type: 'ticket' | 'agent' | 'customer' | 'department' | 'category' | 'system';
  risk_level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | 'critical';
  overall_score: number; // 0-100
  confidence: number; // 0-1
  risk_components: RiskComponent[];
  contributing_factors: RiskFactor[];
  mitigation_strategies: MitigationStrategy[];
  trend_analysis: RiskTrend;
  last_calculated: Date;
  expires_at: Date;
  escalation_required: boolean;
  metadata: Record<string, any>;
}

export interface RiskComponent {
  component_name: string;
  component_type: 'operational' | 'financial' | 'reputation' | 'compliance' | 'technical' | 'strategic';
  weight: number; // 0-1 (contribution to overall score)
  score: number; // 0-100
  confidence: number; // 0-1
  description: string;
  sub_factors: SubRiskFactor[];
}

export interface SubRiskFactor {
  factor_name: string;
  current_value: number;
  threshold_value: number;
  impact_score: number; // 0-1
  trend: 'improving' | 'stable' | 'worsening';
  historical_data: HistoricalDataPoint[];
}

export interface RiskFactor {
  factor_id: string;
  factor_name: string;
  factor_category: 'internal' | 'external' | 'systemic' | 'contextual';
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-1
  impact_magnitude: number; // 0-100
  controllability: 'fully_controllable' | 'partially_controllable' | 'uncontrollable';
  time_sensitivity: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  description: string;
  evidence: Evidence[];
}

export interface Evidence {
  evidence_type: 'metric' | 'event' | 'pattern' | 'correlation';
  source: string;
  value: any;
  timestamp: Date;
  reliability_score: number; // 0-1
  weight: number; // 0-1
}

export interface MitigationStrategy {
  strategy_id: string;
  strategy_name: string;
  strategy_type: 'preventive' | 'detective' | 'corrective' | 'recovery';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  effectiveness_score: number; // 0-1
  implementation_effort: 'low' | 'medium' | 'high';
  cost_estimate: number;
  time_to_implement: string;
  responsible_team: string;
  success_probability: number; // 0-1
  description: string;
  action_items: ActionItem[];
  dependencies: string[];
}

export interface ActionItem {
  action_id: string;
  description: string;
  owner: string;
  due_date: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  completion_percentage: number;
}

export interface RiskTrend {
  trend_direction: 'improving' | 'stable' | 'deteriorating';
  trend_strength: number; // 0-1
  volatility: number; // 0-1
  prediction_accuracy: number; // 0-1
  projected_scores: ProjectedScore[];
  change_points: ChangePoint[];
}

export interface ProjectedScore {
  timestamp: Date;
  projected_score: number;
  confidence_interval: [number, number];
  key_assumptions: string[];
}

export interface ChangePoint {
  timestamp: Date;
  score_before: number;
  score_after: number;
  change_magnitude: number;
  probable_cause: string;
  confidence: number;
}

export interface HistoricalDataPoint {
  timestamp: Date;
  value: number;
  context?: Record<string, any>;
}

export interface RiskMatrix {
  matrix_id: string;
  matrix_name: string;
  entity_type: string;
  risk_dimensions: RiskDimension[];
  scoring_rules: ScoringRule[];
  weight_configuration: WeightConfiguration;
  validation_rules: ValidationRule[];
  last_updated: Date;
  version: string;
}

export interface RiskDimension {
  dimension_name: string;
  dimension_type: 'quantitative' | 'qualitative' | 'composite';
  data_source: string;
  calculation_method: string;
  normalization_method: 'min_max' | 'z_score' | 'percentile';
  weight: number;
  thresholds: RiskThreshold[];
}

export interface RiskThreshold {
  level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | 'critical';
  min_value: number;
  max_value: number;
  color_code: string;
  alert_required: boolean;
}

export interface ScoringRule {
  rule_id: string;
  condition: string; // Logic expression
  score_modifier: number;
  weight_modifier: number;
  description: string;
  active: boolean;
}

export interface WeightConfiguration {
  base_weights: Record<string, number>;
  conditional_weights: ConditionalWeight[];
  dynamic_adjustment: boolean;
}

export interface ConditionalWeight {
  condition: string;
  weight_adjustments: Record<string, number>;
  description: string;
}

export interface ValidationRule {
  rule_id: string;
  rule_type: 'completeness' | 'consistency' | 'accuracy' | 'timeliness';
  validation_logic: string;
  severity: 'warning' | 'error' | 'critical';
  description: string;
}

export class RiskScoringEngine {
  private riskModels: Map<string, string> = new Map(); // Entity type -> Model ID
  private riskMatrices: Map<string, RiskMatrix> = new Map();
  private riskCache: Map<string, RiskScore> = new Map();
  private historicalRisks: Map<string, RiskScore[]> = new Map();

  constructor() {
    this.initializeRiskModels();
    this.loadRiskMatrices();
  }

  // ========================================
  // MAIN RISK SCORING METHODS
  // ========================================

  async calculateRiskScore(
    entityType: RiskScore['entity_type'],
    entityId: string,
    forceRecalculation: boolean = false
  ): Promise<RiskScore> {
    const cacheKey = `${entityType}_${entityId}`;

    // Check cache first
    if (!forceRecalculation && this.riskCache.has(cacheKey)) {
      const cachedScore = this.riskCache.get(cacheKey)!;
      if (cachedScore.expires_at > new Date()) {
        return cachedScore;
      }
    }

    logger.info(`[Risk Scoring] Calculating risk score for ${entityType}:${entityId}`);

    try {
      // Get risk matrix for entity type
      const riskMatrix = this.riskMatrices.get(entityType);
      if (!riskMatrix) {
        throw new Error(`No risk matrix found for entity type: ${entityType}`);
      }

      // Collect raw data for all risk dimensions
      const rawData = await this.collectRiskData(entityType, entityId, riskMatrix);

      // Calculate component scores
      const riskComponents = await this.calculateRiskComponents(rawData, riskMatrix);

      // Calculate overall risk score
      const overallScore = this.calculateOverallScore(riskComponents, riskMatrix);

      // Identify contributing factors
      const contributingFactors = await this.identifyRiskFactors(rawData, riskComponents);

      // Generate mitigation strategies
      const mitigationStrategies = await this.generateMitigationStrategies(
        entityType,
        entityId,
        riskComponents,
        contributingFactors
      );

      // Analyze risk trend
      const trendAnalysis = await this.analyzeRiskTrend(entityType, entityId, overallScore);

      // Determine risk level
      const riskLevel = this.determineRiskLevel(overallScore);

      // Calculate confidence
      const confidence = this.calculateConfidence(riskComponents, rawData);

      const riskScore: RiskScore = {
        entity_id: entityId,
        entity_type: entityType,
        risk_level: riskLevel,
        overall_score: overallScore,
        confidence: confidence,
        risk_components: riskComponents,
        contributing_factors: contributingFactors,
        mitigation_strategies: mitigationStrategies,
        trend_analysis: trendAnalysis,
        last_calculated: new Date(),
        expires_at: new Date(Date.now() + this.getCacheExpirationTime(entityType)),
        escalation_required: this.shouldEscalate(riskLevel, overallScore, confidence),
        metadata: await this.gatherRiskMetadata(entityType, entityId)
      };

      // Cache the result
      this.riskCache.set(cacheKey, riskScore);

      // Store in history
      this.storeRiskHistory(riskScore);

      logger.info(`[Risk Scoring] Risk score calculated: ${overallScore} (${riskLevel})`);
      return riskScore;

    } catch (error) {
      logger.error(`[Risk Scoring] Error calculating risk score for ${entityType}:${entityId}:`, error);
      throw error;
    }
  }

  async calculateBulkRiskScores(
    requests: Array<{ entityType: RiskScore['entity_type']; entityId: string }>
  ): Promise<RiskScore[]> {
    const results: RiskScore[] = [];
    const batchSize = 10;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(req =>
        this.calculateRiskScore(req.entityType, req.entityId)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('[Risk Scoring] Batch calculation failed', result.reason);
        }
      }
    }

    return results;
  }

  async getHighRiskEntities(
    entityType?: RiskScore['entity_type'],
    minimumRiskLevel: RiskScore['risk_level'] = 'high'
  ): Promise<RiskScore[]> {
    const riskLevelOrder = ['very_low', 'low', 'medium', 'high', 'very_high', 'critical'];
    const minimumIndex = riskLevelOrder.indexOf(minimumRiskLevel);

    return Array.from(this.riskCache.values())
      .filter(risk => {
        if (entityType && risk.entity_type !== entityType) return false;
        return riskLevelOrder.indexOf(risk.risk_level) >= minimumIndex;
      })
      .sort((a, b) => b.overall_score - a.overall_score);
  }

  async getRiskTrends(
    entityType: RiskScore['entity_type'],
    timeRange: 'last_24h' | 'last_week' | 'last_month'
  ): Promise<RiskTrendReport> {
    const startTime = this.getStartTimeForRange(timeRange);
    const trends: EntityRiskTrend[] = [];

    for (const [entityId, history] of this.historicalRisks.entries()) {
      if (!entityId.startsWith(entityType)) continue;

      const recentHistory = history.filter(r => r.last_calculated >= startTime);
      if (recentHistory.length < 2) continue;

      const trend = this.calculateEntityTrend(entityId, recentHistory);
      trends.push(trend);
    }

    return {
      entity_type: entityType,
      time_range: timeRange,
      summary_statistics: this.calculateTrendSummaryStats(trends),
      entity_trends: trends.sort((a, b) => b.risk_velocity - a.risk_velocity),
      risk_distribution: this.calculateRiskDistribution(trends),
      emerging_risks: this.identifyEmergingRisks(trends),
      recommendations: this.generateTrendRecommendations(trends)
    };
  }

  // ========================================
  // TICKET RISK SCORING
  // ========================================

  async calculateTicketRiskScore(ticketId: string): Promise<RiskScore> {
    const ticketData = await this.getTicketData(ticketId);
    const slaData = await this.getSLAData(ticketId);
    const customerData = await this.getCustomerData(ticketData.user_id);
    const agentData = ticketData.assigned_to ? await this.getAgentData(ticketData.assigned_to) : null;

    const riskFactors: RiskFactor[] = [];

    // SLA Risk Factors
    const slaRisk = this.calculateSLARisk(slaData);
    if (slaRisk.impact_magnitude > 30) {
      riskFactors.push(slaRisk);
    }

    // Priority & Escalation Risk
    const escalationRisk = this.calculateEscalationRisk(ticketData);
    if (escalationRisk.impact_magnitude > 20) {
      riskFactors.push(escalationRisk);
    }

    // Customer Risk Factors
    const customerRisk = this.calculateCustomerRisk(customerData, ticketData);
    if (customerRisk.impact_magnitude > 25) {
      riskFactors.push(customerRisk);
    }

    // Agent Workload Risk
    if (agentData) {
      const workloadRisk = this.calculateAgentWorkloadRisk(agentData);
      if (workloadRisk.impact_magnitude > 20) {
        riskFactors.push(workloadRisk);
      }
    }

    // Complexity Risk
    const complexityRisk = await this.calculateComplexityRisk(ticketData);
    if (complexityRisk.impact_magnitude > 30) {
      riskFactors.push(complexityRisk);
    }

    // Calculate components
    const components: RiskComponent[] = [
      {
        component_name: 'SLA Compliance Risk',
        component_type: 'operational',
        weight: 0.3,
        score: slaRisk.impact_magnitude,
        confidence: 0.9,
        description: 'Risk of SLA violation based on current progress',
        sub_factors: []
      },
      {
        component_name: 'Customer Impact Risk',
        component_type: 'reputation',
        weight: 0.25,
        score: customerRisk.impact_magnitude,
        confidence: 0.85,
        description: 'Potential impact on customer satisfaction and retention',
        sub_factors: []
      },
      {
        component_name: 'Escalation Risk',
        component_type: 'operational',
        weight: 0.2,
        score: escalationRisk.impact_magnitude,
        confidence: 0.8,
        description: 'Likelihood of requiring escalation or management intervention',
        sub_factors: []
      },
      {
        component_name: 'Resolution Complexity Risk',
        component_type: 'technical',
        weight: 0.15,
        score: complexityRisk.impact_magnitude,
        confidence: 0.75,
        description: 'Technical difficulty and resource requirements for resolution',
        sub_factors: []
      },
      {
        component_name: 'Resource Availability Risk',
        component_type: 'operational',
        weight: 0.1,
        score: agentData ? workloadRisk.impact_magnitude : 50,
        confidence: agentData ? 0.8 : 0.5,
        description: 'Risk related to agent availability and workload',
        sub_factors: []
      }
    ];

    const overallScore = components.reduce((sum, comp) => sum + comp.score * comp.weight, 0);
    const confidence = components.reduce((sum, comp) => sum + comp.confidence * comp.weight, 0);

    return {
      entity_id: ticketId,
      entity_type: 'ticket',
      risk_level: this.determineRiskLevel(overallScore),
      overall_score: overallScore,
      confidence: confidence,
      risk_components: components,
      contributing_factors: riskFactors,
      mitigation_strategies: await this.generateTicketMitigationStrategies(ticketData, riskFactors),
      trend_analysis: await this.analyzeRiskTrend('ticket', ticketId, overallScore),
      last_calculated: new Date(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes for tickets
      escalation_required: this.shouldEscalate(this.determineRiskLevel(overallScore), overallScore, confidence),
      metadata: {
        ticket_priority: ticketData.priority_id,
        ticket_category: ticketData.category_id,
        customer_tier: customerData.tier,
        agent_experience: agentData?.experience_level
      }
    };
  }

  // ========================================
  // AGENT RISK SCORING
  // ========================================

  async calculateAgentRiskScore(agentId: string): Promise<RiskScore> {
    const agentData = await this.getAgentData(agentId);
    const performanceData = await this.getAgentPerformanceData(agentId);
    const workloadData = await this.getAgentWorkloadData(agentId);
    const wellnessData = await this.getAgentWellnessData(agentId);

    const components: RiskComponent[] = [
      {
        component_name: 'Performance Risk',
        component_type: 'operational',
        weight: 0.35,
        score: this.calculatePerformanceRiskScore(performanceData),
        confidence: 0.9,
        description: 'Risk based on performance metrics and SLA compliance',
        sub_factors: this.getPerformanceSubFactors(performanceData)
      },
      {
        component_name: 'Workload Risk',
        component_type: 'operational',
        weight: 0.25,
        score: this.calculateWorkloadRiskScore(workloadData),
        confidence: 0.85,
        description: 'Risk related to current workload and capacity',
        sub_factors: this.getWorkloadSubFactors(workloadData)
      },
      {
        component_name: 'Wellness Risk',
        component_type: 'operational',
        weight: 0.2,
        score: this.calculateWellnessRiskScore(wellnessData),
        confidence: 0.7,
        description: 'Risk indicators from wellness and engagement metrics',
        sub_factors: this.getWellnessSubFactors(wellnessData)
      },
      {
        component_name: 'Skill Gap Risk',
        component_type: 'strategic',
        weight: 0.15,
        score: await this.calculateSkillGapRiskScore(agentId),
        confidence: 0.75,
        description: 'Risk from skill gaps relative to assigned work',
        sub_factors: []
      },
      {
        component_name: 'Attrition Risk',
        component_type: 'strategic',
        weight: 0.05,
        score: await this.calculateAttritionRiskScore(agentData, performanceData, wellnessData),
        confidence: 0.6,
        description: 'Risk of agent leaving the organization',
        sub_factors: []
      }
    ];

    const overallScore = components.reduce((sum, comp) => sum + comp.score * comp.weight, 0);
    const confidence = components.reduce((sum, comp) => sum + comp.confidence * comp.weight, 0);

    return {
      entity_id: agentId,
      entity_type: 'agent',
      risk_level: this.determineRiskLevel(overallScore),
      overall_score: overallScore,
      confidence: confidence,
      risk_components: components,
      contributing_factors: await this.identifyAgentRiskFactors(agentData, performanceData, workloadData),
      mitigation_strategies: await this.generateAgentMitigationStrategies(agentId, components),
      trend_analysis: await this.analyzeRiskTrend('agent', agentId, overallScore),
      last_calculated: new Date(),
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours for agents
      escalation_required: this.shouldEscalate(this.determineRiskLevel(overallScore), overallScore, confidence),
      metadata: {
        agent_level: agentData.level,
        team: agentData.team,
        hire_date: agentData.hire_date
      }
    };
  }

  // ========================================
  // SYSTEM RISK SCORING
  // ========================================

  async calculateSystemRiskScore(): Promise<RiskScore> {
    const systemMetrics = await this.getSystemMetrics();
    const performanceData = await this.getSystemPerformanceData();
    const capacityData = await this.getSystemCapacityData();
    const securityData = await this.getSystemSecurityData();

    const components: RiskComponent[] = [
      {
        component_name: 'Performance Risk',
        component_type: 'technical',
        weight: 0.3,
        score: this.calculateSystemPerformanceRisk(performanceData),
        confidence: 0.95,
        description: 'Risk from system performance degradation',
        sub_factors: []
      },
      {
        component_name: 'Capacity Risk',
        component_type: 'operational',
        weight: 0.25,
        score: this.calculateSystemCapacityRisk(capacityData),
        confidence: 0.9,
        description: 'Risk from capacity constraints and resource limits',
        sub_factors: []
      },
      {
        component_name: 'Security Risk',
        component_type: 'compliance',
        weight: 0.25,
        score: this.calculateSystemSecurityRisk(securityData),
        confidence: 0.85,
        description: 'Security vulnerabilities and compliance risks',
        sub_factors: []
      },
      {
        component_name: 'Availability Risk',
        component_type: 'operational',
        weight: 0.2,
        score: this.calculateSystemAvailabilityRisk(systemMetrics),
        confidence: 0.9,
        description: 'Risk of system downtime and service interruption',
        sub_factors: []
      }
    ];

    const overallScore = components.reduce((sum, comp) => sum + comp.score * comp.weight, 0);
    const confidence = components.reduce((sum, comp) => sum + comp.confidence * comp.weight, 0);

    return {
      entity_id: 'system',
      entity_type: 'system',
      risk_level: this.determineRiskLevel(overallScore),
      overall_score: overallScore,
      confidence: confidence,
      risk_components: components,
      contributing_factors: await this.identifySystemRiskFactors(systemMetrics, performanceData),
      mitigation_strategies: await this.generateSystemMitigationStrategies(components),
      trend_analysis: await this.analyzeRiskTrend('system', 'system', overallScore),
      last_calculated: new Date(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes for system
      escalation_required: this.shouldEscalate(this.determineRiskLevel(overallScore), overallScore, confidence),
      metadata: {
        version: systemMetrics.version,
        environment: systemMetrics.environment
      }
    };
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private calculateOverallScore(components: RiskComponent[], matrix: RiskMatrix): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const component of components) {
      totalScore += component.score * component.weight;
      totalWeight += component.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private determineRiskLevel(score: number): RiskScore['risk_level'] {
    if (score >= 90) return 'critical';
    if (score >= 75) return 'very_high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'very_low';
  }

  private calculateConfidence(components: RiskComponent[], rawData: any): number {
    const avgComponentConfidence = components.reduce((sum, comp) => sum + comp.confidence, 0) / components.length;
    const dataQualityScore = this.assessDataQuality(rawData);

    return (avgComponentConfidence + dataQualityScore) / 2;
  }

  private shouldEscalate(riskLevel: RiskScore['risk_level'], score: number, confidence: number): boolean {
    if (riskLevel === 'critical') return true;
    if (riskLevel === 'very_high' && confidence > 0.8) return true;
    if (riskLevel === 'high' && score > 70 && confidence > 0.85) return true;
    return false;
  }

  private getCacheExpirationTime(entityType: string): number {
    const expirationTimes = {
      'ticket': 30 * 60 * 1000,      // 30 minutes
      'agent': 4 * 60 * 60 * 1000,   // 4 hours
      'customer': 24 * 60 * 60 * 1000, // 24 hours
      'department': 12 * 60 * 60 * 1000, // 12 hours
      'category': 24 * 60 * 60 * 1000,   // 24 hours
      'system': 15 * 60 * 1000       // 15 minutes
    };

    return expirationTimes[entityType] || 60 * 60 * 1000; // Default 1 hour
  }

  private storeRiskHistory(riskScore: RiskScore): void {
    const key = `${riskScore.entity_type}_${riskScore.entity_id}`;

    if (!this.historicalRisks.has(key)) {
      this.historicalRisks.set(key, []);
    }

    const history = this.historicalRisks.get(key)!;
    history.push(riskScore);

    // Keep only last 100 records
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  // Mock implementations for data access and calculations
  private async initializeRiskModels(): Promise<void> {
    logger.info('[Risk Scoring] Initializing risk models');
  }

  private loadRiskMatrices(): void {
    // Load default risk matrices for each entity type
    logger.info('[Risk Scoring] Risk matrices loaded');
  }

  private async collectRiskData(entityType: string, entityId: string, matrix: RiskMatrix): Promise<any> {
    // Mock implementation - collect raw data for risk calculation
    return {};
  }

  private async calculateRiskComponents(rawData: any, matrix: RiskMatrix): Promise<RiskComponent[]> {
    // Mock implementation - calculate risk components based on matrix
    return [];
  }

  private async identifyRiskFactors(rawData: any, components: RiskComponent[]): Promise<RiskFactor[]> {
    // Mock implementation - identify contributing risk factors
    return [];
  }

  private async generateMitigationStrategies(
    entityType: string,
    entityId: string,
    components: RiskComponent[],
    factors: RiskFactor[]
  ): Promise<MitigationStrategy[]> {
    // Mock implementation - generate mitigation strategies
    return [];
  }

  private async analyzeRiskTrend(entityType: string, entityId: string, currentScore: number): Promise<RiskTrend> {
    // Mock implementation - analyze risk trend
    return {
      trend_direction: 'stable',
      trend_strength: 0.1,
      volatility: 0.2,
      prediction_accuracy: 0.8,
      projected_scores: [],
      change_points: []
    };
  }

  private async gatherRiskMetadata(entityType: string, entityId: string): Promise<Record<string, any>> {
    return {};
  }

  // Additional helper methods with mock implementations
  private calculateSLARisk(slaData: any): RiskFactor { return this.createMockRiskFactor('SLA Risk'); }
  private calculateEscalationRisk(ticketData: any): RiskFactor { return this.createMockRiskFactor('Escalation Risk'); }
  private calculateCustomerRisk(customerData: any, ticketData: any): RiskFactor { return this.createMockRiskFactor('Customer Risk'); }
  private calculateAgentWorkloadRisk(agentData: any): RiskFactor { return this.createMockRiskFactor('Workload Risk'); }
  private async calculateComplexityRisk(ticketData: any): Promise<RiskFactor> { return this.createMockRiskFactor('Complexity Risk'); }

  private createMockRiskFactor(name: string): RiskFactor {
    return {
      factor_id: `${name.toLowerCase().replace(' ', '_')}_${Date.now()}`,
      factor_name: name,
      factor_category: 'internal',
      impact_level: 'medium',
      probability: 0.5,
      impact_magnitude: 50,
      controllability: 'partially_controllable',
      time_sensitivity: 'medium_term',
      description: `Mock ${name} factor`,
      evidence: []
    };
  }

  // Data access methods (mock implementations)
  private async getTicketData(ticketId: string): Promise<any> { return {}; }
  private async getSLAData(ticketId: string): Promise<any> { return {}; }
  private async getCustomerData(customerId: string): Promise<any> { return { tier: 'standard' }; }
  private async getAgentData(agentId: string): Promise<any> { return { level: 'senior', team: 'support' }; }
  private async getAgentPerformanceData(agentId: string): Promise<any> { return {}; }
  private async getAgentWorkloadData(agentId: string): Promise<any> { return {}; }
  private async getAgentWellnessData(agentId: string): Promise<any> { return {}; }
  private async getSystemMetrics(): Promise<any> { return { version: '1.0', environment: 'production' }; }
  private async getSystemPerformanceData(): Promise<any> { return {}; }
  private async getSystemCapacityData(): Promise<any> { return {}; }
  private async getSystemSecurityData(): Promise<any> { return {}; }

  // Additional calculation methods (mock implementations)
  private calculatePerformanceRiskScore(data: any): number { return 50; }
  private calculateWorkloadRiskScore(data: any): number { return 30; }
  private calculateWellnessRiskScore(data: any): number { return 20; }
  private async calculateSkillGapRiskScore(agentId: string): Promise<number> { return 25; }
  private async calculateAttritionRiskScore(agentData: any, performanceData: any, wellnessData: any): Promise<number> { return 15; }

  private getPerformanceSubFactors(data: any): SubRiskFactor[] { return []; }
  private getWorkloadSubFactors(data: any): SubRiskFactor[] { return []; }
  private getWellnessSubFactors(data: any): SubRiskFactor[] { return []; }

  private calculateSystemPerformanceRisk(data: any): number { return 25; }
  private calculateSystemCapacityRisk(data: any): number { return 35; }
  private calculateSystemSecurityRisk(data: any): number { return 20; }
  private calculateSystemAvailabilityRisk(data: any): number { return 15; }

  private async generateTicketMitigationStrategies(ticketData: any, factors: RiskFactor[]): Promise<MitigationStrategy[]> { return []; }
  private async generateAgentMitigationStrategies(agentId: string, components: RiskComponent[]): Promise<MitigationStrategy[]> { return []; }
  private async generateSystemMitigationStrategies(components: RiskComponent[]): Promise<MitigationStrategy[]> { return []; }

  private async identifyAgentRiskFactors(agentData: any, performanceData: any, workloadData: any): Promise<RiskFactor[]> { return []; }
  private async identifySystemRiskFactors(systemMetrics: any, performanceData: any): Promise<RiskFactor[]> { return []; }

  private assessDataQuality(rawData: any): number { return 0.85; }

  private getStartTimeForRange(range: string): Date {
    const now = new Date();
    switch (range) {
      case 'last_24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'last_week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'last_month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private calculateEntityTrend(entityId: string, history: RiskScore[]): EntityRiskTrend {
    const scores = history.map(h => h.overall_score);
    const latest = scores[scores.length - 1];
    const earliest = scores[0];

    return {
      entity_id: entityId,
      current_score: latest,
      previous_score: earliest,
      score_change: latest - earliest,
      risk_velocity: (latest - earliest) / history.length,
      trend_direction: latest > earliest ? 'increasing' : latest < earliest ? 'decreasing' : 'stable',
      confidence: 0.8
    };
  }

  private calculateTrendSummaryStats(trends: EntityRiskTrend[]): TrendSummaryStatistics {
    const scores = trends.map(t => t.current_score);

    return {
      average_risk_score: scores.reduce((sum, s) => sum + s, 0) / scores.length,
      median_risk_score: this.calculateMedian(scores),
      risk_score_std_dev: this.calculateStandardDeviation(scores),
      entities_improving: trends.filter(t => t.trend_direction === 'decreasing').length,
      entities_deteriorating: trends.filter(t => t.trend_direction === 'increasing').length,
      entities_stable: trends.filter(t => t.trend_direction === 'stable').length
    };
  }

  private calculateRiskDistribution(trends: EntityRiskTrend[]): Record<string, number> {
    const distribution: Record<string, number> = {
      'very_low': 0, 'low': 0, 'medium': 0, 'high': 0, 'very_high': 0, 'critical': 0
    };

    for (const trend of trends) {
      const level = this.determineRiskLevel(trend.current_score);
      distribution[level]++;
    }

    return distribution;
  }

  private identifyEmergingRisks(trends: EntityRiskTrend[]): EmergingRisk[] {
    return trends
      .filter(t => t.risk_velocity > 5 && t.current_score > 60)
      .map(t => ({
        entity_id: t.entity_id,
        risk_type: 'escalating',
        velocity: t.risk_velocity,
        current_score: t.current_score,
        projected_score: t.current_score + t.risk_velocity * 7, // 7 days projection
        confidence: t.confidence
      }));
  }

  private generateTrendRecommendations(trends: EntityRiskTrend[]): string[] {
    const recommendations: string[] = [];

    const highRiskCount = trends.filter(t => t.current_score > 70).length;
    const deterioratingCount = trends.filter(t => t.trend_direction === 'increasing').length;

    if (highRiskCount > trends.length * 0.2) {
      recommendations.push('High risk entity concentration detected - review risk management processes');
    }

    if (deterioratingCount > trends.length * 0.3) {
      recommendations.push('Significant number of entities showing deteriorating risk trends - investigate systemic issues');
    }

    return recommendations;
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculateStandardDeviation(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }
}

// ========================================
// SUPPORTING INTERFACES
// ========================================

interface RiskTrendReport {
  entity_type: string;
  time_range: string;
  summary_statistics: TrendSummaryStatistics;
  entity_trends: EntityRiskTrend[];
  risk_distribution: Record<string, number>;
  emerging_risks: EmergingRisk[];
  recommendations: string[];
}

interface EntityRiskTrend {
  entity_id: string;
  current_score: number;
  previous_score: number;
  score_change: number;
  risk_velocity: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

interface TrendSummaryStatistics {
  average_risk_score: number;
  median_risk_score: number;
  risk_score_std_dev: number;
  entities_improving: number;
  entities_deteriorating: number;
  entities_stable: number;
}

interface EmergingRisk {
  entity_id: string;
  risk_type: string;
  velocity: number;
  current_score: number;
  projected_score: number;
  confidence: number;
}

// Export singleton instance
export const riskScoringEngine = new RiskScoringEngine();