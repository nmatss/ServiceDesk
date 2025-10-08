// Enterprise Anomaly Detection System
// Detects patterns, outliers, and statistical anomalies in ServiceDesk operations using advanced ML techniques

import { mlPipeline, MLModel } from './ml-pipeline';
import { logger } from '../monitoring/logger';

export interface AnomalyDetection {
  anomaly_id: string;
  entity_type: 'ticket' | 'agent' | 'system' | 'customer' | 'workflow';
  entity_id: string;
  anomaly_type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  detected_at: Date;
  detection_method: DetectionMethod;
  anomaly_score: number;
  baseline_value: number;
  actual_value: number;
  deviation_percentage: number;
  contributing_factors: AnomalyFactor[];
  impact_assessment: ImpactAssessment;
  recommended_actions: AnomalyAction[];
  resolution_status: 'detected' | 'investigating' | 'resolved' | 'false_positive';
  resolved_at?: Date;
  metadata: Record<string, any>;
}

export type AnomalyType =
  | 'statistical_outlier'
  | 'trend_change'
  | 'seasonal_deviation'
  | 'volume_spike'
  | 'volume_drop'
  | 'performance_degradation'
  | 'pattern_break'
  | 'behavioral_anomaly'
  | 'correlation_break'
  | 'fraud_indicator';

export type DetectionMethod =
  | 'statistical_threshold'
  | 'isolation_forest'
  | 'lstm_autoencoder'
  | 'z_score'
  | 'modified_z_score'
  | 'iqr_method'
  | 'dbscan_clustering'
  | 'one_class_svm'
  | 'ensemble';

export interface AnomalyFactor {
  factor_name: string;
  contribution_score: number;
  factor_type: 'temporal' | 'contextual' | 'behavioral' | 'systemic';
  description: string;
  current_value: any;
  expected_range: [number, number];
}

export interface ImpactAssessment {
  business_impact_score: number; // 0-1
  operational_impact_score: number; // 0-1
  customer_impact_score: number; // 0-1
  financial_impact_estimate: number; // monetary value
  affected_services: string[];
  estimated_affected_users: number;
  sla_breach_risk: number; // 0-1
  escalation_required: boolean;
}

export interface AnomalyAction {
  action_type: 'investigate' | 'alert' | 'auto_resolve' | 'escalate' | 'monitor';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  estimated_effort: string;
  automation_available: boolean;
  responsible_team: string;
  deadline?: Date;
}

export interface DetectionModel {
  model_id: string;
  model_type: DetectionMethod;
  entity_types: string[];
  feature_config: AnomalyFeatureConfig;
  threshold_config: ThresholdConfig;
  performance_metrics: AnomalyModelMetrics;
  last_trained: Date;
  is_active: boolean;
}

export interface AnomalyFeatureConfig {
  time_window_minutes: number;
  feature_aggregations: string[]; // 'mean', 'std', 'min', 'max', 'count'
  lag_features: number[]; // [1, 7, 30] for 1h, 7h, 30h lags
  rolling_windows: number[]; // [24, 168] for 24h, 168h rolling averages
  contextual_features: string[];
  behavioral_features: string[];
}

export interface ThresholdConfig {
  sensitivity: 'low' | 'medium' | 'high';
  z_score_threshold: number;
  percentile_threshold: number;
  isolation_contamination: number;
  dynamic_threshold: boolean;
  business_hours_adjustment: boolean;
}

export interface AnomalyModelMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
  mean_time_to_detection: number;
  detection_latency_minutes: number;
}

export interface AnomalyPattern {
  pattern_id: string;
  pattern_name: string;
  pattern_type: 'recurring' | 'emerging' | 'disappearing';
  frequency: number;
  typical_conditions: Record<string, any>;
  historical_occurrences: Date[];
  prediction_confidence: number;
  next_predicted_occurrence?: Date;
}

export class AnomalyDetectionEngine {
  private detectionModels: Map<string, DetectionModel> = new Map();
  private anomalyHistory: Map<string, AnomalyDetection[]> = new Map();
  private knownPatterns: Map<string, AnomalyPattern> = new Map();
  private alertThresholds: Map<string, number> = new Map();
  private lastDetectionRun: Date = new Date();

  constructor() {
    this.initializeDetectionModels();
    this.loadKnownPatterns();
    this.setupAlertThresholds();
  }

  // ========================================
  // MAIN DETECTION METHODS
  // ========================================

  async detectAnomalies(
    entityType?: string,
    lookbackHours: number = 24,
    realTimeMode: boolean = false
  ): Promise<AnomalyDetection[]> {
    const startTime = Date.now();
    logger.info(`[Anomaly Detection] Starting detection run for ${entityType || 'all entities'}`);

    try {
      const detectedAnomalies: AnomalyDetection[] = [];

      // Get active detection models
      const activeModels = Array.from(this.detectionModels.values())
        .filter(model => model.is_active)
        .filter(model => !entityType || model.entity_types.includes(entityType));

      // Run detection for each model
      for (const model of activeModels) {
        const modelAnomalies = await this.runDetectionModel(model, lookbackHours, realTimeMode);
        detectedAnomalies.push(...modelAnomalies);
      }

      // Remove duplicates and merge similar anomalies
      const uniqueAnomalies = this.deduplicateAnomalies(detectedAnomalies);

      // Enrich anomalies with impact assessment and actions
      const enrichedAnomalies = await this.enrichAnomalies(uniqueAnomalies);

      // Filter by severity and confidence
      const filteredAnomalies = this.filterAnomalies(enrichedAnomalies);

      // Store in history
      for (const anomaly of filteredAnomalies) {
        this.storeAnomalyInHistory(anomaly);
      }

      this.lastDetectionRun = new Date();

      logger.info(`[Anomaly Detection] Completed detection in ${Date.now() - startTime}ms. Found ${filteredAnomalies.length} anomalies.`);

      return filteredAnomalies;

    } catch (error) {
      logger.error('[Anomaly Detection] Error during detection run', error);
      throw error;
    }
  }

  async detectRealTimeAnomaly(
    entityType: string,
    entityId: string,
    currentData: Record<string, any>
  ): Promise<AnomalyDetection | null> {
    const relevantModels = Array.from(this.detectionModels.values())
      .filter(model => model.is_active && model.entity_types.includes(entityType));

    for (const model of relevantModels) {
      const anomaly = await this.checkSingleEntityAnomaly(model, entityType, entityId, currentData);
      if (anomaly) {
        const enrichedAnomaly = await this.enrichSingleAnomaly(anomaly);
        this.storeAnomalyInHistory(enrichedAnomaly);
        return enrichedAnomaly;
      }
    }

    return null;
  }

  async getAnomalyTrends(
    timeRange: 'last_24h' | 'last_week' | 'last_month',
    entityType?: string
  ): Promise<AnomalyTrendAnalysis> {
    const endTime = new Date();
    const startTime = this.getStartTimeForRange(timeRange, endTime);

    const anomalies = await this.getAnomaliesInTimeRange(startTime, endTime, entityType);

    return {
      time_range: timeRange,
      total_anomalies: anomalies.length,
      anomalies_by_type: this.groupAnomaliesByType(anomalies),
      anomalies_by_severity: this.groupAnomaliesBySeverity(anomalies),
      trend_direction: this.calculateTrendDirection(anomalies),
      peak_anomaly_hours: this.findPeakAnomalyHours(anomalies),
      most_affected_entities: this.findMostAffectedEntities(anomalies),
      detection_accuracy: await this.calculateDetectionAccuracy(anomalies),
      recommendations: this.generateTrendRecommendations(anomalies)
    };
  }

  // ========================================
  // DETECTION MODEL EXECUTION
  // ========================================

  private async runDetectionModel(
    model: DetectionModel,
    lookbackHours: number,
    realTimeMode: boolean
  ): Promise<AnomalyDetection[]> {
    const detectedAnomalies: AnomalyDetection[] = [];

    switch (model.model_type) {
      case 'statistical_threshold':
        detectedAnomalies.push(...await this.runStatisticalThresholdDetection(model, lookbackHours));
        break;
      case 'isolation_forest':
        detectedAnomalies.push(...await this.runIsolationForestDetection(model, lookbackHours));
        break;
      case 'lstm_autoencoder':
        detectedAnomalies.push(...await this.runLSTMAutoencoderDetection(model, lookbackHours));
        break;
      case 'z_score':
        detectedAnomalies.push(...await this.runZScoreDetection(model, lookbackHours));
        break;
      case 'modified_z_score':
        detectedAnomalies.push(...await this.runModifiedZScoreDetection(model, lookbackHours));
        break;
      case 'iqr_method':
        detectedAnomalies.push(...await this.runIQRDetection(model, lookbackHours));
        break;
      case 'dbscan_clustering':
        detectedAnomalies.push(...await this.runDBSCANDetection(model, lookbackHours));
        break;
      case 'one_class_svm':
        detectedAnomalies.push(...await this.runOneClassSVMDetection(model, lookbackHours));
        break;
      case 'ensemble':
        detectedAnomalies.push(...await this.runEnsembleDetection(model, lookbackHours));
        break;
    }

    return detectedAnomalies;
  }

  private async runStatisticalThresholdDetection(
    model: DetectionModel,
    lookbackHours: number
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    for (const entityType of model.entity_types) {
      const entities = await this.getEntitiesForDetection(entityType, lookbackHours);

      for (const entity of entities) {
        const features = await this.extractAnomalyFeatures(entity, model.feature_config);
        const historicalBaseline = await this.getHistoricalBaseline(entity.id, entityType);

        for (const [featureName, value] of Object.entries(features)) {
          if (typeof value === 'number') {
            const baseline = historicalBaseline[featureName];
            const threshold = this.calculateDynamicThreshold(baseline, model.threshold_config);

            if (Math.abs(value - baseline.mean) > threshold) {
              const anomaly = this.createAnomalyDetection(
                entityType,
                entity.id,
                'statistical_outlier',
                model.model_type,
                value,
                baseline.mean,
                Math.abs(value - baseline.mean) / threshold
              );

              anomaly.contributing_factors = [{
                factor_name: featureName,
                contribution_score: 1.0,
                factor_type: 'statistical',
                description: `${featureName} exceeded statistical threshold`,
                current_value: value,
                expected_range: [baseline.mean - threshold, baseline.mean + threshold]
              }];

              anomalies.push(anomaly);
            }
          }
        }
      }
    }

    return anomalies;
  }

  private async runIsolationForestDetection(
    model: DetectionModel,
    lookbackHours: number
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    // Use ML pipeline for isolation forest
    const modelId = await this.getOrCreateMLModel('isolation_forest', model);

    for (const entityType of model.entity_types) {
      const entities = await this.getEntitiesForDetection(entityType, lookbackHours);

      for (const entity of entities) {
        const features = await this.extractAnomalyFeatures(entity, model.feature_config);

        const prediction = await mlPipeline.predict({
          model_id: modelId,
          features,
          confidence_threshold: 0.7
        });

        if (prediction.prediction === 'anomaly' && prediction.confidence > 0.7) {
          const anomaly = this.createAnomalyDetection(
            entityType,
            entity.id,
            'pattern_break',
            'isolation_forest',
            0, // No specific value for isolation forest
            0,
            prediction.confidence
          );

          anomaly.contributing_factors = this.convertFeatureImportanceToFactors(
            prediction.feature_importance || {},
            features
          );

          anomalies.push(anomaly);
        }
      }
    }

    return anomalies;
  }

  private async runLSTMAutoencoderDetection(
    model: DetectionModel,
    lookbackHours: number
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    // LSTM Autoencoder for sequence anomaly detection
    const modelId = await this.getOrCreateMLModel('lstm_autoencoder', model);

    for (const entityType of model.entity_types) {
      const entities = await this.getEntitiesForDetection(entityType, lookbackHours);

      for (const entity of entities) {
        const sequenceData = await this.getSequenceData(entity.id, entityType, model.feature_config);

        const prediction = await mlPipeline.predict({
          model_id: modelId,
          features: { sequence: sequenceData },
          confidence_threshold: 0.6
        });

        // Reconstruction error indicates anomaly
        const reconstructionError = prediction.prediction as number;
        const threshold = await this.getReconstructionErrorThreshold(modelId);

        if (reconstructionError > threshold) {
          const anomaly = this.createAnomalyDetection(
            entityType,
            entity.id,
            'behavioral_anomaly',
            'lstm_autoencoder',
            reconstructionError,
            threshold,
            prediction.confidence
          );

          anomalies.push(anomaly);
        }
      }
    }

    return anomalies;
  }

  private async runZScoreDetection(
    model: DetectionModel,
    lookbackHours: number
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    for (const entityType of model.entity_types) {
      const entities = await this.getEntitiesForDetection(entityType, lookbackHours);

      for (const entity of entities) {
        const features = await this.extractAnomalyFeatures(entity, model.feature_config);
        const historicalStats = await this.getHistoricalStatistics(entity.id, entityType);

        for (const [featureName, value] of Object.entries(features)) {
          if (typeof value === 'number') {
            const stats = historicalStats[featureName];
            const zScore = Math.abs((value - stats.mean) / stats.std);

            if (zScore > model.threshold_config.z_score_threshold) {
              const anomaly = this.createAnomalyDetection(
                entityType,
                entity.id,
                'statistical_outlier',
                'z_score',
                value,
                stats.mean,
                zScore / model.threshold_config.z_score_threshold
              );

              anomaly.contributing_factors = [{
                factor_name: featureName,
                contribution_score: zScore / model.threshold_config.z_score_threshold,
                factor_type: 'statistical',
                description: `Z-score of ${zScore.toFixed(2)} exceeds threshold`,
                current_value: value,
                expected_range: [stats.mean - 2 * stats.std, stats.mean + 2 * stats.std]
              }];

              anomalies.push(anomaly);
            }
          }
        }
      }
    }

    return anomalies;
  }

  // ========================================
  // ANOMALY ENRICHMENT
  // ========================================

  private async enrichAnomalies(anomalies: AnomalyDetection[]): Promise<AnomalyDetection[]> {
    const enrichedAnomalies: AnomalyDetection[] = [];

    for (const anomaly of anomalies) {
      const enriched = await this.enrichSingleAnomaly(anomaly);
      enrichedAnomalies.push(enriched);
    }

    return enrichedAnomalies;
  }

  private async enrichSingleAnomaly(anomaly: AnomalyDetection): Promise<AnomalyDetection> {
    // Calculate impact assessment
    anomaly.impact_assessment = await this.assessAnomalyImpact(anomaly);

    // Generate recommended actions
    anomaly.recommended_actions = await this.generateAnomalyActions(anomaly);

    // Determine severity based on impact and confidence
    anomaly.severity = this.calculateAnomalySeverity(anomaly);

    // Add contextual metadata
    anomaly.metadata = await this.gatherAnomalyContext(anomaly);

    return anomaly;
  }

  private async assessAnomalyImpact(anomaly: AnomalyDetection): Promise<ImpactAssessment> {
    const businessImpact = await this.calculateBusinessImpact(anomaly);
    const operationalImpact = await this.calculateOperationalImpact(anomaly);
    const customerImpact = await this.calculateCustomerImpact(anomaly);

    return {
      business_impact_score: businessImpact.score,
      operational_impact_score: operationalImpact.score,
      customer_impact_score: customerImpact.score,
      financial_impact_estimate: businessImpact.financial_estimate,
      affected_services: operationalImpact.affected_services,
      estimated_affected_users: customerImpact.affected_users,
      sla_breach_risk: await this.calculateSLABreachRisk(anomaly),
      escalation_required: this.shouldEscalate(anomaly)
    };
  }

  private async generateAnomalyActions(anomaly: AnomalyDetection): Promise<AnomalyAction[]> {
    const actions: AnomalyAction[] = [];

    // Always investigate high-confidence anomalies
    if (anomaly.confidence > 0.8) {
      actions.push({
        action_type: 'investigate',
        priority: anomaly.severity as any,
        description: 'Investigate root cause of detected anomaly',
        estimated_effort: '1-2 hours',
        automation_available: false,
        responsible_team: 'operations'
      });
    }

    // Auto-resolve known patterns
    const knownPattern = await this.findKnownPattern(anomaly);
    if (knownPattern && knownPattern.prediction_confidence > 0.9) {
      actions.push({
        action_type: 'auto_resolve',
        priority: 'medium',
        description: `Apply known resolution for pattern: ${knownPattern.pattern_name}`,
        estimated_effort: '5-10 minutes',
        automation_available: true,
        responsible_team: 'automation'
      });
    }

    // Escalate critical anomalies
    if (anomaly.severity === 'critical') {
      actions.push({
        action_type: 'escalate',
        priority: 'critical',
        description: 'Escalate to senior management due to critical impact',
        estimated_effort: 'immediate',
        automation_available: true,
        responsible_team: 'management',
        deadline: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      });
    }

    // Monitor for emerging patterns
    if (anomaly.anomaly_type === 'trend_change') {
      actions.push({
        action_type: 'monitor',
        priority: 'low',
        description: 'Monitor trend for potential pattern emergence',
        estimated_effort: 'ongoing',
        automation_available: true,
        responsible_team: 'analytics'
      });
    }

    return actions;
  }

  // ========================================
  // PATTERN LEARNING
  // ========================================

  async learnAnomalyPatterns(): Promise<void> {
    logger.info('[Anomaly Detection] Learning new patterns from historical anomalies');

    const recentAnomalies = await this.getRecentAnomalies(30); // Last 30 days
    const clusteredAnomalies = this.clusterSimilarAnomalies(recentAnomalies);

    for (const cluster of clusteredAnomalies) {
      if (cluster.length >= 3) { // Minimum occurrences to form a pattern
        const pattern = this.extractPatternFromCluster(cluster);
        this.knownPatterns.set(pattern.pattern_id, pattern);

        logger.info(`[Anomaly Detection] Learned new pattern: ${pattern.pattern_name}`);
      }
    }
  }

  private clusterSimilarAnomalies(anomalies: AnomalyDetection[]): AnomalyDetection[][] {
    const clusters: AnomalyDetection[][] = [];
    const visited = new Set<string>();

    for (const anomaly of anomalies) {
      if (visited.has(anomaly.anomaly_id)) continue;

      const cluster = [anomaly];
      visited.add(anomaly.anomaly_id);

      for (const other of anomalies) {
        if (visited.has(other.anomaly_id)) continue;

        const similarity = this.calculateAnomalySimilarity(anomaly, other);
        if (similarity > 0.8) {
          cluster.push(other);
          visited.add(other.anomaly_id);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private calculateAnomalySimilarity(a1: AnomalyDetection, a2: AnomalyDetection): number {
    let similarity = 0;
    let factors = 0;

    // Type similarity
    if (a1.anomaly_type === a2.anomaly_type) similarity += 0.3;
    factors++;

    // Entity type similarity
    if (a1.entity_type === a2.entity_type) similarity += 0.2;
    factors++;

    // Severity similarity
    if (a1.severity === a2.severity) similarity += 0.1;
    factors++;

    // Time pattern similarity
    const timeSimilarity = this.calculateTimePatternSimilarity(a1.detected_at, a2.detected_at);
    similarity += timeSimilarity * 0.2;
    factors++;

    // Contributing factors similarity
    const factorSimilarity = this.calculateFactorSimilarity(
      a1.contributing_factors,
      a2.contributing_factors
    );
    similarity += factorSimilarity * 0.2;
    factors++;

    return similarity / factors;
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private createAnomalyDetection(
    entityType: string,
    entityId: string,
    anomalyType: AnomalyType,
    detectionMethod: DetectionMethod,
    actualValue: number,
    baselineValue: number,
    confidence: number
  ): AnomalyDetection {
    const deviationPercentage = baselineValue !== 0
      ? Math.abs((actualValue - baselineValue) / baselineValue) * 100
      : 0;

    return {
      anomaly_id: `${entityType}_${entityId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entity_type: entityType as any,
      entity_id: entityId,
      anomaly_type: anomalyType,
      severity: 'medium', // Will be updated during enrichment
      confidence: confidence,
      detected_at: new Date(),
      detection_method: detectionMethod,
      anomaly_score: confidence,
      baseline_value: baselineValue,
      actual_value: actualValue,
      deviation_percentage: deviationPercentage,
      contributing_factors: [],
      impact_assessment: {
        business_impact_score: 0,
        operational_impact_score: 0,
        customer_impact_score: 0,
        financial_impact_estimate: 0,
        affected_services: [],
        estimated_affected_users: 0,
        sla_breach_risk: 0,
        escalation_required: false
      },
      recommended_actions: [],
      resolution_status: 'detected',
      metadata: {}
    };
  }

  private calculateAnomalySeverity(anomaly: AnomalyDetection): 'low' | 'medium' | 'high' | 'critical' {
    const impactScore = (
      anomaly.impact_assessment.business_impact_score +
      anomaly.impact_assessment.operational_impact_score +
      anomaly.impact_assessment.customer_impact_score
    ) / 3;

    const confidenceWeight = anomaly.confidence;
    const finalScore = impactScore * confidenceWeight;

    if (finalScore > 0.8) return 'critical';
    if (finalScore > 0.6) return 'high';
    if (finalScore > 0.3) return 'medium';
    return 'low';
  }

  private deduplicateAnomalies(anomalies: AnomalyDetection[]): AnomalyDetection[] {
    const unique = new Map<string, AnomalyDetection>();

    for (const anomaly of anomalies) {
      const key = `${anomaly.entity_type}_${anomaly.entity_id}_${anomaly.anomaly_type}`;

      if (!unique.has(key) || unique.get(key)!.confidence < anomaly.confidence) {
        unique.set(key, anomaly);
      }
    }

    return Array.from(unique.values());
  }

  private filterAnomalies(anomalies: AnomalyDetection[]): AnomalyDetection[] {
    return anomalies.filter(anomaly => {
      // Filter by minimum confidence
      if (anomaly.confidence < 0.6) return false;

      // Filter by severity
      if (anomaly.severity === 'low' && anomaly.confidence < 0.8) return false;

      // Filter known false positives
      if (this.isKnownFalsePositive(anomaly)) return false;

      return true;
    });
  }

  // Mock implementations for data access and calculations
  private async initializeDetectionModels(): Promise<void> {
    // Initialize default detection models
    this.detectionModels.set('statistical_tickets', {
      model_id: 'statistical_tickets',
      model_type: 'statistical_threshold',
      entity_types: ['ticket'],
      feature_config: {
        time_window_minutes: 60,
        feature_aggregations: ['count', 'mean', 'std'],
        lag_features: [1, 24, 168],
        rolling_windows: [24, 168],
        contextual_features: ['priority', 'category'],
        behavioral_features: ['response_time', 'resolution_time']
      },
      threshold_config: {
        sensitivity: 'medium',
        z_score_threshold: 3.0,
        percentile_threshold: 0.95,
        isolation_contamination: 0.1,
        dynamic_threshold: true,
        business_hours_adjustment: true
      },
      performance_metrics: {
        precision: 0.85,
        recall: 0.78,
        f1_score: 0.81,
        false_positive_rate: 0.05,
        mean_time_to_detection: 15,
        detection_latency_minutes: 5
      },
      last_trained: new Date(),
      is_active: true
    });

    logger.info('[Anomaly Detection] Detection models initialized');
  }

  private loadKnownPatterns(): void {
    // Load known anomaly patterns
    logger.info('[Anomaly Detection] Known patterns loaded');
  }

  private setupAlertThresholds(): void {
    this.alertThresholds.set('critical', 0.9);
    this.alertThresholds.set('high', 0.7);
    this.alertThresholds.set('medium', 0.5);
    this.alertThresholds.set('low', 0.3);
  }

  // Additional helper methods (simplified implementations)
  private async getEntitiesForDetection(entityType: string, lookbackHours: number): Promise<any[]> { return []; }
  private async extractAnomalyFeatures(entity: any, config: AnomalyFeatureConfig): Promise<Record<string, any>> { return {}; }
  private async getHistoricalBaseline(entityId: string, entityType: string): Promise<any> { return { mean: 100, std: 20 }; }
  private calculateDynamicThreshold(baseline: any, config: ThresholdConfig): number { return baseline.std * 2; }
  private async getOrCreateMLModel(type: string, model: DetectionModel): Promise<string> { return 'model_id'; }
  private convertFeatureImportanceToFactors(importance: Record<string, number>, features: Record<string, any>): AnomalyFactor[] { return []; }
  private async getSequenceData(entityId: string, entityType: string, config: AnomalyFeatureConfig): Promise<number[]> { return []; }
  private async getReconstructionErrorThreshold(modelId: string): Promise<number> { return 0.5; }
  private async getHistoricalStatistics(entityId: string, entityType: string): Promise<any> { return {}; }
  private async checkSingleEntityAnomaly(model: DetectionModel, entityType: string, entityId: string, data: Record<string, any>): Promise<AnomalyDetection | null> { return null; }
  private storeAnomalyInHistory(anomaly: AnomalyDetection): void { }
  private async calculateBusinessImpact(anomaly: AnomalyDetection): Promise<any> { return { score: 0.5, financial_estimate: 1000 }; }
  private async calculateOperationalImpact(anomaly: AnomalyDetection): Promise<any> { return { score: 0.3, affected_services: [] }; }
  private async calculateCustomerImpact(anomaly: AnomalyDetection): Promise<any> { return { score: 0.2, affected_users: 10 }; }
  private async calculateSLABreachRisk(anomaly: AnomalyDetection): Promise<number> { return 0.3; }
  private shouldEscalate(anomaly: AnomalyDetection): boolean { return anomaly.severity === 'critical'; }
  private async findKnownPattern(anomaly: AnomalyDetection): Promise<AnomalyPattern | null> { return null; }
  private async gatherAnomalyContext(anomaly: AnomalyDetection): Promise<Record<string, any>> { return {}; }
  private getStartTimeForRange(range: string, endTime: Date): Date { return new Date(endTime.getTime() - 24 * 60 * 60 * 1000); }
  private async getAnomaliesInTimeRange(start: Date, end: Date, entityType?: string): Promise<AnomalyDetection[]> { return []; }
  private groupAnomaliesByType(anomalies: AnomalyDetection[]): Record<string, number> { return {}; }
  private groupAnomaliesBySeverity(anomalies: AnomalyDetection[]): Record<string, number> { return {}; }
  private calculateTrendDirection(anomalies: AnomalyDetection[]): string { return 'stable'; }
  private findPeakAnomalyHours(anomalies: AnomalyDetection[]): number[] { return []; }
  private findMostAffectedEntities(anomalies: AnomalyDetection[]): string[] { return []; }
  private async calculateDetectionAccuracy(anomalies: AnomalyDetection[]): Promise<number> { return 0.85; }
  private generateTrendRecommendations(anomalies: AnomalyDetection[]): string[] { return []; }
  private async getRecentAnomalies(days: number): Promise<AnomalyDetection[]> { return []; }
  private extractPatternFromCluster(cluster: AnomalyDetection[]): AnomalyPattern {
    return {
      pattern_id: 'pattern_' + Date.now(),
      pattern_name: 'Detected Pattern',
      pattern_type: 'recurring',
      frequency: cluster.length,
      typical_conditions: {},
      historical_occurrences: cluster.map(a => a.detected_at),
      prediction_confidence: 0.8
    };
  }
  private calculateTimePatternSimilarity(date1: Date, date2: Date): number { return 0.5; }
  private calculateFactorSimilarity(factors1: AnomalyFactor[], factors2: AnomalyFactor[]): number { return 0.5; }
  private isKnownFalsePositive(anomaly: AnomalyDetection): boolean { return false; }

  // Additional detection method implementations (simplified)
  private async runModifiedZScoreDetection(model: DetectionModel, lookbackHours: number): Promise<AnomalyDetection[]> { return []; }
  private async runIQRDetection(model: DetectionModel, lookbackHours: number): Promise<AnomalyDetection[]> { return []; }
  private async runDBSCANDetection(model: DetectionModel, lookbackHours: number): Promise<AnomalyDetection[]> { return []; }
  private async runOneClassSVMDetection(model: DetectionModel, lookbackHours: number): Promise<AnomalyDetection[]> { return []; }
  private async runEnsembleDetection(model: DetectionModel, lookbackHours: number): Promise<AnomalyDetection[]> { return []; }
}

// ========================================
// SUPPORTING INTERFACES
// ========================================

interface AnomalyTrendAnalysis {
  time_range: string;
  total_anomalies: number;
  anomalies_by_type: Record<string, number>;
  anomalies_by_severity: Record<string, number>;
  trend_direction: string;
  peak_anomaly_hours: number[];
  most_affected_entities: string[];
  detection_accuracy: number;
  recommendations: string[];
}

// Export singleton instance
export const anomalyDetectionEngine = new AnomalyDetectionEngine();