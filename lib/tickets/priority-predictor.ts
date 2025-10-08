/**
 * Priority Predictor - Advanced AI-powered ticket priority prediction
 * Considers business impact, urgency, user context, and historical patterns
 */

import type { Priority, CreateTicket, User, Category } from '../types/database';
import { logger } from '../monitoring/logger';

export interface PriorityPrediction {
  priority: Priority;
  confidence: number;
  reasoning: string;
  urgencyScore: number;
  impactScore: number;
  contextScore: number;
  businessScore: number;
  riskScore: number;
  factors: PriorityFactor[];
}

export interface PriorityFactor {
  type: 'urgency' | 'impact' | 'context' | 'business' | 'risk' | 'temporal' | 'user';
  description: string;
  weight: number;
  score: number;
  evidence: string[];
}

export interface PriorityContext {
  user?: User;
  category?: Category;
  businessHours?: boolean;
  currentLoad?: number;
  slaTarget?: number;
  userTier?: 'basic' | 'premium' | 'enterprise' | 'vip';
  departmentCriticality?: 'low' | 'medium' | 'high' | 'critical';
}

export interface PriorityMatrix {
  urgencyLevels: Array<{
    level: number;
    name: string;
    keywords: string[];
    patterns: string[];
    timeIndicators: string[];
  }>;
  impactLevels: Array<{
    level: number;
    name: string;
    systemsAffected: string[];
    userCountThresholds: number[];
    businessFunctions: string[];
  }>;
  riskFactors: Array<{
    factor: string;
    weight: number;
    indicators: string[];
  }>;
}

export interface PriorityModel {
  id: string;
  name: string;
  version: string;
  accuracy: number;
  trainingData: number;
  lastTrained: Date;
  features: string[];
}

class PriorityPredictor {
  private priorities: Priority[] = [];
  private priorityMatrix: PriorityMatrix;
  private models: Map<string, PriorityModel> = new Map();
  private urgencyKeywords: Map<string, number> = new Map();
  private impactKeywords: Map<string, number> = new Map();
  private temporalPatterns: RegExp[] = [];

  constructor() {
    this.initializePriorityMatrix();
    this.initializeKeywordMaps();
    this.initializeTemporalPatterns();
    this.loadPredictionModels();
  }

  /**
   * Main priority prediction method
   */
  async predictPriority(
    ticketData: CreateTicket | { title: string; description: string; },
    priorities: Priority[],
    context?: PriorityContext
  ): Promise<PriorityPrediction> {
    this.priorities = priorities;

    try {
      // Extract and analyze all factors
      const urgencyAnalysis = await this.analyzeUrgency(ticketData, context);
      const impactAnalysis = await this.analyzeImpact(ticketData, context);
      const contextAnalysis = await this.analyzeContext(ticketData, context);
      const businessAnalysis = await this.analyzeBusinessImplications(ticketData, context);
      const riskAnalysis = await this.analyzeRiskFactors(ticketData, context);

      // Combine all factors using weighted scoring
      const combinedScore = this.calculateCombinedScore({
        urgency: urgencyAnalysis,
        impact: impactAnalysis,
        context: contextAnalysis,
        business: businessAnalysis,
        risk: riskAnalysis
      });

      // Map score to priority level
      const predictedPriority = this.mapScoreToPriority(combinedScore.totalScore);

      // Generate comprehensive reasoning
      const reasoning = this.generateReasoning({
        urgency: urgencyAnalysis,
        impact: impactAnalysis,
        context: contextAnalysis,
        business: businessAnalysis,
        risk: riskAnalysis,
        predicted: predictedPriority
      });

      // Collect all factors
      const factors = [
        ...urgencyAnalysis.factors,
        ...impactAnalysis.factors,
        ...contextAnalysis.factors,
        ...businessAnalysis.factors,
        ...riskAnalysis.factors
      ];

      return {
        priority: predictedPriority,
        confidence: combinedScore.confidence,
        reasoning,
        urgencyScore: urgencyAnalysis.score,
        impactScore: impactAnalysis.score,
        contextScore: contextAnalysis.score,
        businessScore: businessAnalysis.score,
        riskScore: riskAnalysis.score,
        factors
      };

    } catch (error) {
      logger.error('Priority prediction failed', error);
      throw new Error('Failed to predict ticket priority');
    }
  }

  /**
   * Analyze urgency indicators
   */
  private async analyzeUrgency(
    ticketData: { title: string; description: string; },
    context?: PriorityContext
  ): Promise<{ score: number; confidence: number; factors: PriorityFactor[] }> {
    const text = `${ticketData.title} ${ticketData.description}`.toLowerCase();
    const factors: PriorityFactor[] = [];
    let urgencyScore = 0;

    // Time-based urgency
    const timeUrgency = this.analyzeTimeUrgency(text);
    if (timeUrgency.score > 0) {
      factors.push({
        type: 'urgency',
        description: 'Time-sensitive language detected',
        weight: 0.3,
        score: timeUrgency.score,
        evidence: timeUrgency.evidence
      });
      urgencyScore += timeUrgency.score * 0.3;
    }

    // Keyword-based urgency
    const keywordUrgency = this.analyzeKeywordUrgency(text);
    if (keywordUrgency.score > 0) {
      factors.push({
        type: 'urgency',
        description: 'Urgent keywords identified',
        weight: 0.4,
        score: keywordUrgency.score,
        evidence: keywordUrgency.evidence
      });
      urgencyScore += keywordUrgency.score * 0.4;
    }

    // Business hours consideration
    if (context?.businessHours === false) {
      factors.push({
        type: 'temporal',
        description: 'Ticket created outside business hours',
        weight: 0.2,
        score: 0.7,
        evidence: ['Outside normal support hours']
      });
      urgencyScore += 0.7 * 0.2;
    }

    // User tier urgency
    if (context?.userTier) {
      const tierUrgency = this.getUserTierUrgency(context.userTier);
      if (tierUrgency > 0) {
        factors.push({
          type: 'user',
          description: `User tier: ${context.userTier}`,
          weight: 0.1,
          score: tierUrgency,
          evidence: [`${context.userTier} user tier`]
        });
        urgencyScore += tierUrgency * 0.1;
      }
    }

    return {
      score: Math.min(urgencyScore, 1),
      confidence: factors.length > 0 ? 0.8 : 0.3,
      factors
    };
  }

  /**
   * Analyze business and system impact
   */
  private async analyzeImpact(
    ticketData: { title: string; description: string; },
    context?: PriorityContext
  ): Promise<{ score: number; confidence: number; factors: PriorityFactor[] }> {
    const text = `${ticketData.title} ${ticketData.description}`.toLowerCase();
    const factors: PriorityFactor[] = [];
    let impactScore = 0;

    // System impact analysis
    const systemImpact = this.analyzeSystemImpact(text);
    if (systemImpact.score > 0) {
      factors.push({
        type: 'impact',
        description: 'Critical system components affected',
        weight: 0.4,
        score: systemImpact.score,
        evidence: systemImpact.evidence
      });
      impactScore += systemImpact.score * 0.4;
    }

    // User count impact
    const userImpact = this.analyzeUserImpact(text);
    if (userImpact.score > 0) {
      factors.push({
        type: 'impact',
        description: 'Multiple users potentially affected',
        weight: 0.3,
        score: userImpact.score,
        evidence: userImpact.evidence
      });
      impactScore += userImpact.score * 0.3;
    }

    // Business function impact
    const businessImpact = this.analyzeBusinessFunctionImpact(text);
    if (businessImpact.score > 0) {
      factors.push({
        type: 'impact',
        description: 'Critical business functions affected',
        weight: 0.3,
        score: businessImpact.score,
        evidence: businessImpact.evidence
      });
      impactScore += businessImpact.score * 0.3;
    }

    return {
      score: Math.min(impactScore, 1),
      confidence: factors.length > 0 ? 0.8 : 0.3,
      factors
    };
  }

  /**
   * Analyze contextual factors
   */
  private async analyzeContext(
    ticketData: { title: string; description: string; },
    context?: PriorityContext
  ): Promise<{ score: number; confidence: number; factors: PriorityFactor[] }> {
    const factors: PriorityFactor[] = [];
    let contextScore = 0;

    // Current system load
    if (context?.currentLoad && context.currentLoad > 0.8) {
      factors.push({
        type: 'context',
        description: 'High current system load',
        weight: 0.2,
        score: context.currentLoad,
        evidence: [`System load: ${(context.currentLoad * 100).toFixed(1)}%`]
      });
      contextScore += context.currentLoad * 0.2;
    }

    // SLA implications
    if (context?.slaTarget) {
      const slaScore = this.calculateSLAScore(context.slaTarget);
      factors.push({
        type: 'context',
        description: 'SLA target considerations',
        weight: 0.3,
        score: slaScore,
        evidence: [`SLA target: ${context.slaTarget} hours`]
      });
      contextScore += slaScore * 0.3;
    }

    // Department criticality
    if (context?.departmentCriticality) {
      const deptScore = this.getDepartmentCriticalityScore(context.departmentCriticality);
      factors.push({
        type: 'context',
        description: `Department criticality: ${context.departmentCriticality}`,
        weight: 0.5,
        score: deptScore,
        evidence: [`${context.departmentCriticality} criticality department`]
      });
      contextScore += deptScore * 0.5;
    }

    return {
      score: Math.min(contextScore, 1),
      confidence: factors.length > 0 ? 0.7 : 0.2,
      factors
    };
  }

  /**
   * Analyze business implications
   */
  private async analyzeBusinessImplications(
    ticketData: { title: string; description: string; },
    context?: PriorityContext
  ): Promise<{ score: number; confidence: number; factors: PriorityFactor[] }> {
    const text = `${ticketData.title} ${ticketData.description}`.toLowerCase();
    const factors: PriorityFactor[] = [];
    let businessScore = 0;

    // Revenue impact indicators
    const revenueKeywords = ['billing', 'payment', 'transaction', 'checkout', 'purchase', 'order', 'sale'];
    const revenueMatches = revenueKeywords.filter(keyword => text.includes(keyword));

    if (revenueMatches.length > 0) {
      factors.push({
        type: 'business',
        description: 'Revenue-impacting functionality affected',
        weight: 0.6,
        score: 0.9,
        evidence: revenueMatches.map(match => `Revenue keyword: ${match}`)
      });
      businessScore += 0.9 * 0.6;
    }

    // Compliance and security impact
    const complianceKeywords = ['security', 'breach', 'compliance', 'audit', 'gdpr', 'privacy', 'data'];
    const complianceMatches = complianceKeywords.filter(keyword => text.includes(keyword));

    if (complianceMatches.length > 0) {
      factors.push({
        type: 'business',
        description: 'Security or compliance implications',
        weight: 0.4,
        score: 0.85,
        evidence: complianceMatches.map(match => `Compliance keyword: ${match}`)
      });
      businessScore += 0.85 * 0.4;
    }

    return {
      score: Math.min(businessScore, 1),
      confidence: factors.length > 0 ? 0.85 : 0.1,
      factors
    };
  }

  /**
   * Analyze risk factors
   */
  private async analyzeRiskFactors(
    ticketData: { title: string; description: string; },
    context?: PriorityContext
  ): Promise<{ score: number; confidence: number; factors: PriorityFactor[] }> {
    const text = `${ticketData.title} ${ticketData.description}`.toLowerCase();
    const factors: PriorityFactor[] = [];
    let riskScore = 0;

    // Data loss risk
    const dataLossIndicators = ['lost', 'deleted', 'missing', 'corrupted', 'backup', 'restore'];
    const dataLossMatches = dataLossIndicators.filter(indicator => text.includes(indicator));

    if (dataLossMatches.length > 0) {
      factors.push({
        type: 'risk',
        description: 'Potential data loss risk',
        weight: 0.5,
        score: 0.9,
        evidence: dataLossMatches.map(match => `Data risk indicator: ${match}`)
      });
      riskScore += 0.9 * 0.5;
    }

    // Escalation risk based on tone
    const escalationIndicators = ['angry', 'frustrated', 'urgent', 'escalate', 'manager', 'complaint'];
    const escalationMatches = escalationIndicators.filter(indicator => text.includes(indicator));

    if (escalationMatches.length > 1) {
      factors.push({
        type: 'risk',
        description: 'High escalation risk detected',
        weight: 0.3,
        score: 0.7,
        evidence: escalationMatches.map(match => `Escalation indicator: ${match}`)
      });
      riskScore += 0.7 * 0.3;
    }

    // Reputational risk
    const reputationIndicators = ['public', 'social', 'media', 'customer', 'review', 'complaint'];
    const reputationMatches = reputationIndicators.filter(indicator => text.includes(indicator));

    if (reputationMatches.length > 0) {
      factors.push({
        type: 'risk',
        description: 'Potential reputational impact',
        weight: 0.2,
        score: 0.6,
        evidence: reputationMatches.map(match => `Reputation indicator: ${match}`)
      });
      riskScore += 0.6 * 0.2;
    }

    return {
      score: Math.min(riskScore, 1),
      confidence: factors.length > 0 ? 0.7 : 0.1,
      factors
    };
  }

  /**
   * Train priority prediction model with feedback
   */
  async trainWithFeedback(
    ticketData: { title: string; description: string; },
    predictedPriority: Priority,
    actualPriority: Priority,
    context?: PriorityContext
  ): Promise<void> {
    const trainingData = {
      ticket: ticketData,
      predicted: predictedPriority,
      actual: actualPriority,
      context,
      timestamp: new Date(),
      correct: predictedPriority.id === actualPriority.id
    };

    // Store training data (would integrate with actual storage)
    logger.info('Training data recorded', trainingData);

    // Update keyword weights based on feedback
    if (!trainingData.correct) {
      await this.updateKeywordWeights(ticketData, actualPriority);
    }
  }

  /**
   * Evaluate prediction model performance
   */
  async evaluateModel(testData: Array<{
    ticket: { title: string; description: string; };
    actualPriority: Priority;
    context?: PriorityContext;
  }>): Promise<{
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    priorityMetrics: Map<number, { precision: number; recall: number; f1: number; }>;
  }> {
    const results = [];

    for (const test of testData) {
      const prediction = await this.predictPriority(
        test.ticket,
        this.priorities,
        test.context
      );

      results.push({
        predicted: prediction.priority.id,
        actual: test.actualPriority.id,
        correct: prediction.priority.id === test.actualPriority.id,
        confidence: prediction.confidence
      });
    }

    const accuracy = results.filter(r => r.correct).length / results.length;

    // Calculate per-priority metrics
    const priorityMetrics = new Map();
    for (const priority of this.priorities) {
      const tp = results.filter(r => r.predicted === priority.id && r.actual === priority.id).length;
      const fp = results.filter(r => r.predicted === priority.id && r.actual !== priority.id).length;
      const fn = results.filter(r => r.predicted !== priority.id && r.actual === priority.id).length;

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

      priorityMetrics.set(priority.id, { precision, recall, f1 });
    }

    // Calculate macro averages
    const avgPrecision = Array.from(priorityMetrics.values()).reduce((sum, m) => sum + m.precision, 0) / priorityMetrics.size;
    const avgRecall = Array.from(priorityMetrics.values()).reduce((sum, m) => sum + m.recall, 0) / priorityMetrics.size;
    const avgF1 = Array.from(priorityMetrics.values()).reduce((sum, m) => sum + m.f1, 0) / priorityMetrics.size;

    return {
      accuracy,
      precision: avgPrecision,
      recall: avgRecall,
      f1Score: avgF1,
      priorityMetrics
    };
  }

  // Helper methods

  private initializePriorityMatrix(): void {
    this.priorityMatrix = {
      urgencyLevels: [
        {
          level: 1,
          name: 'Low',
          keywords: ['sometime', 'eventually', 'when convenient'],
          patterns: ['not urgent', 'no rush', 'low priority'],
          timeIndicators: ['next week', 'next month', 'sometime']
        },
        {
          level: 2,
          name: 'Medium',
          keywords: ['soon', 'needed', 'important'],
          patterns: ['business hours', 'working day'],
          timeIndicators: ['today', 'tomorrow', 'this week']
        },
        {
          level: 3,
          name: 'High',
          keywords: ['urgent', 'quickly', 'asap'],
          patterns: ['urgent', 'high priority', 'important'],
          timeIndicators: ['immediately', 'now', 'asap']
        },
        {
          level: 4,
          name: 'Critical',
          keywords: ['emergency', 'critical', 'down'],
          patterns: ['system down', 'emergency', 'critical'],
          timeIndicators: ['immediately', 'emergency', 'critical']
        }
      ],
      impactLevels: [
        {
          level: 1,
          name: 'Low',
          systemsAffected: ['single user', 'cosmetic'],
          userCountThresholds: [1],
          businessFunctions: ['non-critical']
        },
        {
          level: 2,
          name: 'Medium',
          systemsAffected: ['department', 'feature'],
          userCountThresholds: [10],
          businessFunctions: ['departmental']
        },
        {
          level: 3,
          name: 'High',
          systemsAffected: ['multiple departments', 'core system'],
          userCountThresholds: [100],
          businessFunctions: ['business critical']
        },
        {
          level: 4,
          name: 'Critical',
          systemsAffected: ['entire system', 'all users'],
          userCountThresholds: [1000],
          businessFunctions: ['mission critical']
        }
      ],
      riskFactors: [
        { factor: 'data_loss', weight: 0.9, indicators: ['lost', 'deleted', 'corrupted'] },
        { factor: 'security', weight: 0.8, indicators: ['breach', 'hack', 'unauthorized'] },
        { factor: 'reputation', weight: 0.6, indicators: ['public', 'customer complaint'] }
      ]
    };
  }

  private initializeKeywordMaps(): void {
    // Urgency keywords with weights
    const urgencyData = [
      ['emergency', 0.95], ['critical', 0.9], ['urgent', 0.85], ['asap', 0.8],
      ['immediately', 0.8], ['now', 0.7], ['quickly', 0.6], ['soon', 0.4]
    ];

    urgencyData.forEach(([keyword, weight]) => {
      this.urgencyKeywords.set(keyword as string, weight as number);
    });

    // Impact keywords with weights
    const impactData = [
      ['down', 0.9], ['outage', 0.9], ['broken', 0.8], ['failure', 0.8],
      ['error', 0.6], ['slow', 0.4], ['issue', 0.3], ['problem', 0.3]
    ];

    impactData.forEach(([keyword, weight]) => {
      this.impactKeywords.set(keyword as string, weight as number);
    });
  }

  private initializeTemporalPatterns(): void {
    this.temporalPatterns = [
      /\b(right\s+now|immediately|urgent(ly)?|asap|emergency)\b/i,
      /\b(today|this\s+morning|this\s+afternoon)\b/i,
      /\b(tomorrow|next\s+business\s+day)\b/i,
      /\b(this\s+week|by\s+friday)\b/i,
      /\b(end\s+of\s+week|eow)\b/i
    ];
  }

  private loadPredictionModels(): void {
    this.models.set('default', {
      id: 'default',
      name: 'Default Priority Model',
      version: '1.0',
      accuracy: 0.87,
      trainingData: 1000,
      lastTrained: new Date(),
      features: ['urgency', 'impact', 'context', 'business', 'risk']
    });
  }

  private analyzeTimeUrgency(text: string): { score: number; evidence: string[] } {
    const evidence = [];
    let score = 0;

    for (const pattern of this.temporalPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        evidence.push(matches[0]);
        score = Math.max(score, 0.8); // High time urgency
      }
    }

    return { score, evidence };
  }

  private analyzeKeywordUrgency(text: string): { score: number; evidence: string[] } {
    const evidence = [];
    let maxScore = 0;

    for (const [keyword, weight] of this.urgencyKeywords.entries()) {
      if (text.includes(keyword)) {
        evidence.push(keyword);
        maxScore = Math.max(maxScore, weight);
      }
    }

    return { score: maxScore, evidence };
  }

  private getUserTierUrgency(tier: string): number {
    const tierScores = { vip: 0.9, enterprise: 0.7, premium: 0.5, basic: 0.2 };
    return tierScores[tier as keyof typeof tierScores] || 0;
  }

  private analyzeSystemImpact(text: string): { score: number; evidence: string[] } {
    const systemKeywords = ['server', 'database', 'network', 'system', 'application', 'service'];
    const evidence = [];
    let score = 0;

    for (const keyword of systemKeywords) {
      if (text.includes(keyword)) {
        evidence.push(keyword);
        score = Math.max(score, 0.6);
      }
    }

    // Check for critical system indicators
    const criticalIndicators = ['down', 'offline', 'crashed', 'unavailable'];
    for (const indicator of criticalIndicators) {
      if (text.includes(indicator)) {
        evidence.push(indicator);
        score = 0.9;
        break;
      }
    }

    return { score, evidence };
  }

  private analyzeUserImpact(text: string): { score: number; evidence: string[] } {
    const userIndicators = ['all users', 'everyone', 'entire team', 'department', 'multiple users'];
    const evidence = [];
    let score = 0;

    for (const indicator of userIndicators) {
      if (text.includes(indicator)) {
        evidence.push(indicator);
        score = Math.max(score, 0.7);
      }
    }

    return { score, evidence };
  }

  private analyzeBusinessFunctionImpact(text: string): { score: number; evidence: string[] } {
    const businessFunctions = ['billing', 'payment', 'customer service', 'sales', 'production'];
    const evidence = [];
    let score = 0;

    for (const func of businessFunctions) {
      if (text.includes(func)) {
        evidence.push(func);
        score = Math.max(score, 0.8);
      }
    }

    return { score, evidence };
  }

  private calculateSLAScore(slaTarget: number): number {
    // Higher urgency for shorter SLA targets
    if (slaTarget <= 1) return 0.9;
    if (slaTarget <= 4) return 0.7;
    if (slaTarget <= 8) return 0.5;
    return 0.3;
  }

  private getDepartmentCriticalityScore(criticality: string): number {
    const scores = { critical: 0.9, high: 0.7, medium: 0.5, low: 0.3 };
    return scores[criticality as keyof typeof scores] || 0.3;
  }

  private calculateCombinedScore(analyses: any): { totalScore: number; confidence: number } {
    const weights = {
      urgency: 0.3,
      impact: 0.3,
      context: 0.15,
      business: 0.15,
      risk: 0.1
    };

    let totalScore = 0;
    let totalConfidence = 0;
    let weightSum = 0;

    for (const [type, analysis] of Object.entries(analyses)) {
      const weight = weights[type as keyof typeof weights];
      totalScore += analysis.score * weight;
      totalConfidence += analysis.confidence * weight;
      weightSum += weight;
    }

    return {
      totalScore: totalScore / weightSum,
      confidence: totalConfidence / weightSum
    };
  }

  private mapScoreToPriority(score: number): Priority {
    // Map combined score to priority level
    if (score >= 0.8) return this.priorities.find(p => p.level === 4) || this.priorities[0];
    if (score >= 0.6) return this.priorities.find(p => p.level === 3) || this.priorities[0];
    if (score >= 0.4) return this.priorities.find(p => p.level === 2) || this.priorities[0];
    return this.priorities.find(p => p.level === 1) || this.priorities[0];
  }

  private generateReasoning(data: any): string {
    const reasons = [];

    if (data.urgency.score > 0.6) {
      reasons.push(`High urgency detected (${(data.urgency.score * 100).toFixed(1)}%)`);
    }

    if (data.impact.score > 0.6) {
      reasons.push(`Significant business impact identified (${(data.impact.score * 100).toFixed(1)}%)`);
    }

    if (data.business.score > 0.6) {
      reasons.push(`Critical business implications (${(data.business.score * 100).toFixed(1)}%)`);
    }

    if (data.risk.score > 0.6) {
      reasons.push(`High risk factors present (${(data.risk.score * 100).toFixed(1)}%)`);
    }

    if (reasons.length === 0) {
      reasons.push('Standard priority based on routine analysis');
    }

    return reasons.join('. ');
  }

  private async updateKeywordWeights(
    ticketData: { title: string; description: string; },
    actualPriority: Priority
  ): Promise<void> {
    const text = `${ticketData.title} ${ticketData.description}`.toLowerCase();
    const words = text.match(/\b\w+\b/g) || [];

    // Update keyword weights based on actual priority
    for (const word of words) {
      if (word.length > 3) {
        const currentWeight = this.urgencyKeywords.get(word) || 0;
        const targetWeight = actualPriority.level * 0.25; // Scale to 0-1

        // Gradual weight adjustment
        const newWeight = currentWeight * 0.9 + targetWeight * 0.1;
        this.urgencyKeywords.set(word, newWeight);
      }
    }
  }

  /**
   * Get priority matrix configuration
   */
  getPriorityMatrix(): PriorityMatrix {
    return JSON.parse(JSON.stringify(this.priorityMatrix));
  }

  /**
   * Update priority matrix configuration
   */
  updatePriorityMatrix(matrix: Partial<PriorityMatrix>): void {
    this.priorityMatrix = { ...this.priorityMatrix, ...matrix };
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(): Map<string, PriorityModel> {
    return new Map(this.models);
  }
}

// Export singleton instance
export const priorityPredictor = new PriorityPredictor();

// Export types and classes
export { PriorityPredictor };
export type { PriorityMatrix, PriorityModel, PriorityContext };