// Enterprise Trend Analysis Engine
// Automatically analyzes trends across all ServiceDesk metrics and provides actionable insights

// Removed unused import: mlPipeline
import logger from '../monitoring/structured-logger';

export interface TrendAnalysis {
  analysis_id: string;
  entity_type: 'tickets' | 'agents' | 'customers' | 'categories' | 'system' | 'business';
  entity_id?: string;
  metric_name: string;
  time_period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  analysis_window: TimeWindow;
  trend_direction: TrendDirection;
  trend_strength: number; // 0-1
  statistical_significance: number; // 0-1
  confidence_level: number; // 0-1
  trend_components: TrendComponent[];
  change_points: ChangePoint[];
  seasonal_patterns: SeasonalPattern[];
  outliers: OutlierPoint[];
  forecasted_values: ForecastedPoint[];
  insights: TrendInsight[];
  recommendations: TrendRecommendation[];
  created_at: Date;
  expires_at: Date;
  metadata: Record<string, unknown>;
}

export type TrendDirection =
  | 'increasing'
  | 'decreasing'
  | 'stable'
  | 'volatile'
  | 'cyclical'
  | 'seasonal'
  | 'trending_up_with_seasonality'
  | 'trending_down_with_seasonality';

export interface TimeWindow {
  start_date: Date;
  end_date: Date;
  total_periods: number;
  period_length: string;
  data_completeness: number; // 0-1
}

export interface TrendComponent {
  component_type: 'linear' | 'exponential' | 'polynomial' | 'seasonal' | 'cyclical' | 'noise';
  strength: number; // 0-1
  equation?: string;
  r_squared: number;
  contribution_percentage: number;
  description: string;
}

export interface ChangePoint {
  timestamp: Date;
  change_type: 'level_shift' | 'trend_change' | 'variance_change' | 'regime_change';
  magnitude: number;
  direction: 'increase' | 'decrease';
  confidence: number; // 0-1
  probable_causes: ProbableCause[];
  impact_assessment: ChangePointImpact;
}

export interface ProbableCause {
  cause_type: 'external_event' | 'process_change' | 'seasonal_effect' | 'system_change' | 'business_decision';
  description: string;
  likelihood: number; // 0-1
  evidence: Evidence[];
}

export interface Evidence {
  evidence_type: 'correlation' | 'timing' | 'domain_knowledge' | 'user_feedback';
  description: string;
  strength: number; // 0-1
  source: string;
}

export interface ChangePointImpact {
  immediate_impact: number;
  long_term_impact: number;
  affected_metrics: string[];
  business_significance: 'low' | 'medium' | 'high' | 'critical';
  requires_action: boolean;
}

export interface SeasonalPattern {
  pattern_type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  strength: number; // 0-1
  phase: number; // Phase shift
  amplitude: number;
  period_length: number;
  reliability: number; // 0-1
  next_peak: Date;
  next_trough: Date;
  pattern_stability: number; // 0-1
}

export interface OutlierPoint {
  timestamp: Date;
  value: number;
  expected_value: number;
  deviation_score: number;
  outlier_type: 'additive' | 'innovative' | 'level_shift' | 'temporary_change';
  impact_on_trend: number;
  investigation_priority: 'low' | 'medium' | 'high' | 'critical';
  possible_explanations: string[];
}

export interface ForecastedPoint {
  timestamp: Date;
  predicted_value: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  prediction_interval_lower: number;
  prediction_interval_upper: number;
  contributing_factors: Record<string, number>;
}

export interface TrendInsight {
  insight_id: string;
  insight_type: 'pattern_discovery' | 'anomaly_detection' | 'performance_change' | 'business_impact' | 'correlation_finding';
  title: string;
  description: string;
  significance: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  supporting_evidence: Evidence[];
  business_context: string;
  actionability_score: number; // 0-1
  related_metrics: string[];
}

export interface TrendRecommendation {
  recommendation_id: string;
  recommendation_type: 'investigate' | 'monitor' | 'take_action' | 'alert_stakeholders' | 'automate_response';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  rationale: string;
  expected_outcome: string;
  implementation_effort: 'low' | 'medium' | 'high';
  timeline: string;
  responsible_team: string;
  success_metrics: string[];
  risks: string[];
}

export interface TrendComparisonAnalysis {
  comparison_id: string;
  comparison_type: 'period_over_period' | 'cohort_analysis' | 'segment_comparison' | 'benchmark_comparison';
  entities_compared: ComparisonEntity[];
  comparison_metrics: ComparisonMetric[];
  key_differences: KeyDifference[];
  statistical_tests: StatisticalTest[];
  insights: TrendInsight[];
  recommendations: TrendRecommendation[];
  created_at: Date;
}

export interface ComparisonEntity {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  time_period: TimeWindow;
  baseline_metrics: Record<string, number>;
}

export interface ComparisonMetric {
  metric_name: string;
  values: Record<string, number>; // entity_id -> value
  percentage_changes: Record<string, number>;
  absolute_changes: Record<string, number>;
  statistical_significance: Record<string, number>;
  trend_directions: Record<string, TrendDirection>;
}

export interface KeyDifference {
  metric_name: string;
  difference_type: 'significant_improvement' | 'significant_decline' | 'structural_change' | 'volatility_change';
  magnitude: number;
  entities_affected: string[];
  confidence: number;
  business_impact: string;
}

export interface StatisticalTest {
  test_name: string;
  test_type: 't_test' | 'chi_square' | 'mann_whitney' | 'kruskal_wallis' | 'kolmogorov_smirnov';
  null_hypothesis: string;
  alternative_hypothesis: string;
  test_statistic: number;
  p_value: number;
  effect_size: number;
  conclusion: string;
  confidence_level: number;
}

export interface TrendAlerts {
  alert_id: string;
  alert_type: 'trend_reversal' | 'acceleration' | 'deceleration' | 'anomaly' | 'threshold_breach';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  metric_name: string;
  entity_type: string;
  entity_id?: string;
  current_value: number;
  expected_value: number;
  deviation_percentage: number;
  trend_change_score: number;
  alert_message: string;
  recommended_actions: string[];
  stakeholders_to_notify: string[];
  escalation_required: boolean;
  auto_resolution_possible: boolean;
  created_at: Date;
  acknowledged_at?: Date;
  resolved_at?: Date;
}

export class TrendAnalyzerEngine {
  private trendCache: Map<string, TrendAnalysis> = new Map();
  // Removed unused property: alertsHistory
  private analysisConfig: TrendAnalysisConfig;

  constructor() {
    this.analysisConfig = this.loadAnalysisConfiguration();
  }

  // ========================================
  // MAIN ANALYSIS METHODS
  // ========================================

  async analyzeTrend(
    entityType: string,
    entityId: string | undefined,
    metricName: string,
    timePeriod: TrendAnalysis['time_period'] = 'daily',
    analysisDepth: 'basic' | 'advanced' | 'comprehensive' = 'advanced'
  ): Promise<TrendAnalysis> {
    const cacheKey = `${entityType}_${entityId}_${metricName}_${timePeriod}`;

    // Check cache first
    if (this.trendCache.has(cacheKey)) {
      const cached = this.trendCache.get(cacheKey)!;
      if (cached.expires_at > new Date()) {
        return cached;
      }
    }

    logger.info(`[Trend Analyzer] Analyzing trend for ${metricName} (${entityType})`);

    try {
      // Get historical data
      const timeWindow = this.calculateAnalysisWindow(timePeriod, analysisDepth);
      const historicalData = await this.getHistoricalData(
        entityType,
        entityId,
        metricName,
        timeWindow
      );

      if (historicalData.length < this.getMinimumDataPoints(timePeriod)) {
        throw new Error(`Insufficient data points for trend analysis: ${historicalData.length}`);
      }

      // Perform trend decomposition
      const trendComponents = await this.decomposeTrend(historicalData, timePeriod);

      // Detect change points
      const changePoints = await this.detectChangePoints(historicalData, metricName);

      // Identify seasonal patterns
      const seasonalPatterns = await this.identifySeasonalPatterns(historicalData, timePeriod);

      // Detect outliers
      const outliers = await this.detectOutliers(historicalData, trendComponents);

      // Generate forecasts
      const forecasts = await this.generateForecasts(
        historicalData,
        trendComponents,
        seasonalPatterns,
        14 // 14 periods ahead
      );

      // Determine overall trend direction
      const trendDirection = this.determineTrendDirection(trendComponents, seasonalPatterns);

      // Calculate trend strength and significance
      const trendStrength = this.calculateTrendStrength(trendComponents);
      const statisticalSignificance = this.calculateStatisticalSignificance(historicalData, trendComponents);
      const confidenceLevel = this.calculateConfidenceLevel(trendComponents, historicalData.length);

      // Generate insights
      const insights = await this.generateTrendInsights(
        entityType,
        metricName,
        trendComponents,
        changePoints,
        seasonalPatterns,
        outliers
      );

      // Generate recommendations
      const recommendations = await this.generateTrendRecommendations(
        entityType,
        metricName,
        trendDirection,
        trendStrength,
        insights
      );

      const validEntityTypes = ['tickets', 'agents', 'customers', 'categories', 'system', 'business'];
      const validatedEntityType = validEntityTypes.includes(entityType)
        ? (entityType as TrendAnalysis['entity_type'])
        : 'system';

      const trendAnalysis: TrendAnalysis = {
        analysis_id: `trend_${entityType}_${metricName}_${Date.now()}`,
        entity_type: validatedEntityType,
        entity_id: entityId,
        metric_name: metricName,
        time_period: timePeriod,
        analysis_window: timeWindow,
        trend_direction: trendDirection,
        trend_strength: trendStrength,
        statistical_significance: statisticalSignificance,
        confidence_level: confidenceLevel,
        trend_components: trendComponents,
        change_points: changePoints,
        seasonal_patterns: seasonalPatterns,
        outliers: outliers,
        forecasted_values: forecasts,
        insights: insights,
        recommendations: recommendations,
        created_at: new Date(),
        expires_at: new Date(Date.now() + this.getCacheExpirationTime(timePeriod)),
        metadata: {
          data_points: historicalData.length,
          analysis_depth: analysisDepth,
          processing_time_ms: Date.now()
        }
      };

      // Cache the result
      this.trendCache.set(cacheKey, trendAnalysis);

      // Check for alerts
      await this.checkForTrendAlerts(trendAnalysis);

      logger.info(`[Trend Analyzer] Trend analysis completed for ${metricName}`);
      return trendAnalysis;

    } catch (error) {
      logger.error(`[Trend Analyzer] Error analyzing trend for ${metricName}:`, error);
      throw error;
    }
  }

  async analyzeBulkTrends(
    requests: Array<{
      entityType: string;
      entityId?: string;
      metricName: string;
      timePeriod?: TrendAnalysis['time_period'];
    }>
  ): Promise<TrendAnalysis[]> {
    logger.info(`[Trend Analyzer] Starting bulk trend analysis for ${requests.length} requests`);

    const results: TrendAnalysis[] = [];
    const batchSize = 5; // Process in batches to avoid overwhelming the system

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(req =>
        this.analyzeTrend(
          req.entityType,
          req.entityId,
          req.metricName,
          req.timePeriod || 'daily'
        ).catch(error => {
          logger.error(`[Trend Analyzer] Batch analysis failed for ${req.metricName}:`, error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (result) {
          results.push(result);
        }
      }

      // Small delay between batches
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info(`[Trend Analyzer] Bulk analysis completed: ${results.length}/${requests.length} successful`);
    return results;
  }

  async compareEntities(
    entityType: string,
    entityIds: string[],
    metricNames: string[],
    comparisonType: TrendComparisonAnalysis['comparison_type'] = 'segment_comparison',
    timePeriod: TrendAnalysis['time_period'] = 'daily'
  ): Promise<TrendComparisonAnalysis> {
    logger.info(`[Trend Analyzer] Comparing ${entityIds.length} entities across ${metricNames.length} metrics`);

    // Get trend analyses for all entities and metrics
    const comparisonEntities: ComparisonEntity[] = [];
    const comparisonMetrics: ComparisonMetric[] = [];

    for (const entityId of entityIds) {
      const entityData = await this.getEntityData(entityType, entityId);
      const timeWindow = this.calculateAnalysisWindow(timePeriod, 'advanced');
      const baselineMetrics: Record<string, number> = {};

      for (const metricName of metricNames) {
        const trend = await this.analyzeTrend(entityType, entityId, metricName, timePeriod);
        baselineMetrics[metricName] = this.calculateBaselineValue(trend);
      }

      comparisonEntities.push({
        entity_id: entityId,
        entity_name: entityData.name || entityId,
        entity_type: entityType,
        time_period: timeWindow,
        baseline_metrics: baselineMetrics
      });
    }

    // Calculate comparison metrics
    for (const metricName of metricNames) {
      const metricValues: Record<string, number> = {};
      const percentageChanges: Record<string, number> = {};
      const absoluteChanges: Record<string, number> = {};
      const statisticalSignificance: Record<string, number> = {};
      const trendDirections: Record<string, TrendDirection> = {};

      for (const entity of comparisonEntities) {
        const trend = await this.analyzeTrend(entityType, entity.entity_id, metricName, timePeriod);
        const baselineValue = entity.baseline_metrics[metricName] ?? 0;
        metricValues[entity.entity_id] = baselineValue;
        trendDirections[entity.entity_id] = trend.trend_direction;

        // Calculate changes (simplified)
        const previousValue = baselineValue * 0.9; // Mock previous value
        percentageChanges[entity.entity_id] = ((baselineValue - previousValue) / previousValue) * 100;
        absoluteChanges[entity.entity_id] = baselineValue - previousValue;
        statisticalSignificance[entity.entity_id] = trend.statistical_significance;
      }

      comparisonMetrics.push({
        metric_name: metricName,
        values: metricValues,
        percentage_changes: percentageChanges,
        absolute_changes: absoluteChanges,
        statistical_significance: statisticalSignificance,
        trend_directions: trendDirections
      });
    }

    // Identify key differences
    const keyDifferences = this.identifyKeyDifferences(comparisonMetrics, comparisonEntities);

    // Perform statistical tests
    const statisticalTests = await this.performStatisticalTests(comparisonMetrics, comparisonType);

    // Generate insights and recommendations
    const insights = await this.generateComparisonInsights(
      comparisonEntities,
      comparisonMetrics,
      keyDifferences
    );

    const recommendations = await this.generateComparisonRecommendations(
      comparisonType,
      keyDifferences,
      insights
    );

    return {
      comparison_id: `comparison_${entityType}_${Date.now()}`,
      comparison_type: comparisonType,
      entities_compared: comparisonEntities,
      comparison_metrics: comparisonMetrics,
      key_differences: keyDifferences,
      statistical_tests: statisticalTests,
      insights: insights,
      recommendations: recommendations,
      created_at: new Date()
    };
  }

  // ========================================
  // TREND DECOMPOSITION
  // ========================================

  private async decomposeTrend(
    data: TimeSeriesDataPoint[],
    timePeriod: string
  ): Promise<TrendComponent[]> {
    const components: TrendComponent[] = [];

    // Extract values and timestamps
    const values = data.map(d => d.value);
    const timestamps = data.map(d => d.timestamp.getTime());

    // Linear trend component
    const linearComponent = this.calculateLinearTrend(timestamps, values);
    if (linearComponent.r_squared > 0.1) {
      components.push({
        component_type: 'linear',
        strength: linearComponent.r_squared,
        equation: `y = ${linearComponent.slope.toFixed(4)}x + ${linearComponent.intercept.toFixed(2)}`,
        r_squared: linearComponent.r_squared,
        contribution_percentage: linearComponent.r_squared * 100,
        description: `Linear trend with slope ${linearComponent.slope > 0 ? 'positive' : 'negative'}`
      });
    }

    // Seasonal component
    const seasonalComponent = await this.extractSeasonalComponent(data, timePeriod);
    if (seasonalComponent.strength > 0.1) {
      components.push(seasonalComponent);
    }

    // Cyclical component
    const cyclicalComponent = await this.extractCyclicalComponent(data);
    if (cyclicalComponent.strength > 0.05) {
      components.push(cyclicalComponent);
    }

    // Noise component
    const noiseLevel = this.calculateNoiseLevel(data, components);
    components.push({
      component_type: 'noise',
      strength: noiseLevel,
      r_squared: 1 - components.reduce((sum, comp) => sum + comp.r_squared, 0),
      contribution_percentage: noiseLevel * 100,
      description: 'Random variation and unexplained variance'
    });

    return components;
  }

  private calculateLinearTrend(timestamps: number[], values: number[]): {
    slope: number;
    intercept: number;
    r_squared: number;
  } {
    const n = timestamps.length;
    const sumX = timestamps.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = timestamps.reduce((sum, x, i) => sum + x * (values[i] ?? 0), 0);
    const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const totalSumSquares = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const residualSumSquares = values.reduce((sum, y, i) => {
      const predicted = slope * (timestamps[i] ?? 0) + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);

    const r_squared = 1 - (residualSumSquares / totalSumSquares);

    return { slope, intercept, r_squared };
  }

  // ========================================
  // CHANGE POINT DETECTION
  // ========================================

  private async detectChangePoints(
    data: TimeSeriesDataPoint[],
    metricName: string
  ): Promise<ChangePoint[]> {
    const changePoints: ChangePoint[] = [];
    const windowSize = Math.min(10, Math.floor(data.length / 5));

    for (let i = windowSize; i < data.length - windowSize; i++) {
      const beforeWindow = data.slice(i - windowSize, i);
      const afterWindow = data.slice(i, i + windowSize);

      const beforeMean = beforeWindow.reduce((sum, d) => sum + d.value, 0) / beforeWindow.length;
      const afterMean = afterWindow.reduce((sum, d) => sum + d.value, 0) / afterWindow.length;

      const changeScore = Math.abs(afterMean - beforeMean);
      const threshold = this.calculateChangePointThreshold(data, i);

      if (changeScore > threshold) {
        const dataPoint = data[i];
        if (!dataPoint) continue;

        const probableCauses = await this.identifyProbableCauses(
          dataPoint.timestamp,
          metricName,
          changeScore
        );

        changePoints.push({
          timestamp: dataPoint.timestamp,
          change_type: 'level_shift',
          magnitude: changeScore,
          direction: afterMean > beforeMean ? 'increase' : 'decrease',
          confidence: Math.min(changeScore / threshold, 1),
          probable_causes: probableCauses,
          impact_assessment: {
            immediate_impact: changeScore,
            long_term_impact: changeScore * 0.8,
            affected_metrics: [metricName],
            business_significance: this.assessBusinessSignificance(changeScore, metricName),
            requires_action: changeScore > threshold * 1.5
          }
        });
      }
    }

    return changePoints;
  }

  // ========================================
  // SEASONAL PATTERN DETECTION
  // ========================================

  private async identifySeasonalPatterns(
    data: TimeSeriesDataPoint[],
    timePeriod: string
  ): Promise<SeasonalPattern[]> {
    const patterns: SeasonalPattern[] = [];

    // Hourly patterns (for daily/hourly data)
    if (['hourly', 'daily'].includes(timePeriod)) {
      const hourlyPattern = this.detectHourlyPattern(data);
      if (hourlyPattern.strength > 0.1) {
        patterns.push(hourlyPattern);
      }
    }

    // Weekly patterns
    if (['hourly', 'daily', 'weekly'].includes(timePeriod)) {
      const weeklyPattern = this.detectWeeklyPattern(data);
      if (weeklyPattern.strength > 0.1) {
        patterns.push(weeklyPattern);
      }
    }

    // Monthly patterns
    if (['daily', 'weekly', 'monthly'].includes(timePeriod)) {
      const monthlyPattern = this.detectMonthlyPattern(data);
      if (monthlyPattern.strength > 0.1) {
        patterns.push(monthlyPattern);
      }
    }

    return patterns;
  }

  private detectHourlyPattern(data: TimeSeriesDataPoint[]): SeasonalPattern {
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    for (const point of data) {
      const hour = point.timestamp.getHours();
      hourlyAverages[hour] += point.value;
      hourlyCounts[hour]++;
    }

    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAverages[i] /= hourlyCounts[i];
      }
    }

    const overallMean = hourlyAverages.reduce((sum, val) => sum + val, 0) / 24;
    const variance = hourlyAverages.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / 24;
    const strength = Math.sqrt(variance) / overallMean;

    const maxHour = hourlyAverages.indexOf(Math.max(...hourlyAverages));
    const minHour = hourlyAverages.indexOf(Math.min(...hourlyAverages));

    return {
      pattern_type: 'hourly',
      strength: Math.min(strength, 1),
      phase: maxHour,
      amplitude: Math.max(...hourlyAverages) - Math.min(...hourlyAverages),
      period_length: 24,
      reliability: 0.8,
      next_peak: this.calculateNextPeak(maxHour, 'hour'),
      next_trough: this.calculateNextTrough(minHour, 'hour'),
      pattern_stability: 0.7
    };
  }

  // ========================================
  // INSIGHT GENERATION
  // ========================================

  private async generateTrendInsights(
    entityType: string,
    metricName: string,
    components: TrendComponent[],
    changePoints: ChangePoint[],
    seasonalPatterns: SeasonalPattern[],
    outliers: OutlierPoint[]
  ): Promise<TrendInsight[]> {
    const insights: TrendInsight[] = [];

    // Strong trend insight
    const strongestComponent = components.reduce((max, comp) =>
      comp.strength > max.strength ? comp : max
    );

    if (strongestComponent.strength > 0.7) {
      insights.push({
        insight_id: `strong_trend_${Date.now()}`,
        insight_type: 'pattern_discovery',
        title: `Strong ${strongestComponent.component_type} trend detected`,
        description: `${metricName} shows a strong ${strongestComponent.component_type} pattern explaining ${strongestComponent.contribution_percentage.toFixed(1)}% of variance`,
        significance: strongestComponent.strength > 0.8 ? 'high' : 'medium',
        confidence: strongestComponent.strength,
        supporting_evidence: [{
          evidence_type: 'correlation',
          description: `R² = ${strongestComponent.r_squared.toFixed(3)}`,
          strength: strongestComponent.r_squared,
          source: 'trend_decomposition'
        }],
        business_context: this.getBusinessContext(entityType, metricName),
        actionability_score: 0.8,
        related_metrics: []
      });
    }

    // Change point insights
    for (const changePoint of changePoints.slice(0, 3)) { // Top 3 change points
      if (changePoint.confidence > 0.7) {
        insights.push({
          insight_id: `change_point_${changePoint.timestamp.getTime()}`,
          insight_type: 'performance_change',
          title: `Significant change detected on ${changePoint.timestamp.toDateString()}`,
          description: `${metricName} experienced a ${changePoint.direction} of ${changePoint.magnitude.toFixed(2)} on ${changePoint.timestamp.toDateString()}`,
          significance: changePoint.impact_assessment.business_significance,
          confidence: changePoint.confidence,
          supporting_evidence: changePoint.probable_causes.map(cause => ({
            evidence_type: 'timing' as const,
            description: cause.description,
            strength: cause.likelihood,
            source: 'change_point_analysis'
          })),
          business_context: 'Change points often indicate external events or process modifications',
          actionability_score: changePoint.impact_assessment.requires_action ? 0.9 : 0.6,
          related_metrics: changePoint.impact_assessment.affected_metrics
        });
      }
    }

    // Seasonal insights
    for (const pattern of seasonalPatterns) {
      if (pattern.strength > 0.3) {
        insights.push({
          insight_id: `seasonal_${pattern.pattern_type}_${Date.now()}`,
          insight_type: 'pattern_discovery',
          title: `${pattern.pattern_type} seasonal pattern identified`,
          description: `${metricName} shows predictable ${pattern.pattern_type} variations with ${(pattern.strength * 100).toFixed(1)}% reliability`,
          significance: pattern.strength > 0.5 ? 'high' : 'medium',
          confidence: pattern.reliability,
          supporting_evidence: [{
            evidence_type: 'correlation',
            description: `Pattern strength: ${(pattern.strength * 100).toFixed(1)}%`,
            strength: pattern.strength,
            source: 'seasonal_analysis'
          }],
          business_context: 'Seasonal patterns can be leveraged for capacity planning and resource optimization',
          actionability_score: 0.7,
          related_metrics: []
        });
      }
    }

    // Outlier insights
    const criticalOutliers = outliers.filter(o => o.investigation_priority === 'critical');
    if (criticalOutliers.length > 0) {
      insights.push({
        insight_id: `outliers_${Date.now()}`,
        insight_type: 'anomaly_detection',
        title: `${criticalOutliers.length} critical outliers detected`,
        description: `${metricName} has ${criticalOutliers.length} data points requiring immediate investigation`,
        significance: 'critical',
        confidence: 0.85,
        supporting_evidence: criticalOutliers.map(outlier => ({
          evidence_type: 'correlation',
          description: `Outlier on ${outlier.timestamp.toDateString()} with deviation score ${outlier.deviation_score.toFixed(2)}`,
          strength: Math.min(outlier.deviation_score / 3, 1),
          source: 'outlier_detection'
        })),
        business_context: 'Critical outliers may indicate system issues or exceptional events',
        actionability_score: 0.95,
        related_metrics: []
      });
    }

    return insights;
  }

  private async generateTrendRecommendations(
    entityType: string,
    metricName: string,
    trendDirection: TrendDirection,
    trendStrength: number,
    insights: TrendInsight[]
  ): Promise<TrendRecommendation[]> {
    const recommendations: TrendRecommendation[] = [];

    // Trend-based recommendations
    if (trendDirection === 'decreasing' && trendStrength > 0.6) {
      recommendations.push({
        recommendation_id: `declining_trend_${Date.now()}`,
        recommendation_type: 'take_action',
        priority: trendStrength > 0.8 ? 'urgent' : 'high',
        title: `Address declining trend in ${metricName}`,
        description: `${metricName} shows a strong declining trend that requires immediate attention`,
        rationale: `Declining trends in ${metricName} can lead to reduced performance and customer satisfaction`,
        expected_outcome: 'Stabilization or reversal of the declining trend',
        implementation_effort: 'medium',
        timeline: '2-4 weeks',
        responsible_team: this.getResponsibleTeam(entityType, metricName),
        success_metrics: [`${metricName} stabilization`, 'Trend reversal indicators'],
        risks: ['Delayed action may worsen the decline', 'Resource allocation challenges']
      });
    }

    // Seasonal pattern recommendations
    const seasonalInsights = insights.filter(i => i.insight_type === 'pattern_discovery' && i.title.includes('seasonal'));
    if (seasonalInsights.length > 0) {
      recommendations.push({
        recommendation_id: `seasonal_planning_${Date.now()}`,
        recommendation_type: 'take_action',
        priority: 'medium',
        title: 'Leverage seasonal patterns for resource planning',
        description: 'Implement capacity planning based on identified seasonal patterns',
        rationale: 'Predictable seasonal variations can be used to optimize resource allocation',
        expected_outcome: 'Improved resource utilization and service quality during peak periods',
        implementation_effort: 'medium',
        timeline: '4-6 weeks',
        responsible_team: 'Operations & Planning',
        success_metrics: ['Resource utilization optimization', 'Service level maintenance during peaks'],
        risks: ['Pattern changes over time', 'External factors affecting seasonality']
      });
    }

    // Change point recommendations
    const changePointInsights = insights.filter(i => i.insight_type === 'performance_change');
    if (changePointInsights.length > 0) {
      recommendations.push({
        recommendation_id: `investigate_changes_${Date.now()}`,
        recommendation_type: 'investigate',
        priority: 'high',
        title: 'Investigate detected performance changes',
        description: 'Conduct thorough investigation of significant change points',
        rationale: 'Understanding change points helps identify root causes and prevent recurrence',
        expected_outcome: 'Clear understanding of change drivers and preventive measures',
        implementation_effort: 'high',
        timeline: '1-2 weeks',
        responsible_team: 'Analytics & Operations',
        success_metrics: ['Root cause identification', 'Preventive action plan'],
        risks: ['Inconclusive investigation', 'Resource intensity']
      });
    }

    // Monitoring recommendations
    if (trendStrength > 0.4) {
      recommendations.push({
        recommendation_id: `enhanced_monitoring_${Date.now()}`,
        recommendation_type: 'monitor',
        priority: 'medium',
        title: `Implement enhanced monitoring for ${metricName}`,
        description: 'Set up automated monitoring and alerting for trend changes',
        rationale: 'Proactive monitoring enables early detection of trend changes',
        expected_outcome: 'Earlier detection of issues and faster response times',
        implementation_effort: 'low',
        timeline: '1-2 weeks',
        responsible_team: 'Technical Operations',
        success_metrics: ['Alert response time', 'Issue detection speed'],
        risks: ['Alert fatigue', 'False positives']
      });
    }

    return recommendations;
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private determineTrendDirection(
    components: TrendComponent[],
    seasonalPatterns: SeasonalPattern[]
  ): TrendDirection {
    const linearComponent = components.find(c => c.component_type === 'linear');
    const seasonalComponent = components.find(c => c.component_type === 'seasonal');

    if (!linearComponent) {
      if (seasonalPatterns.length > 0) return 'seasonal';
      return 'stable';
    }

    const slope = this.extractSlopeFromEquation(linearComponent.equation || '');

    if (Math.abs(slope) < 0.01) {
      return seasonalPatterns.length > 0 ? 'seasonal' : 'stable';
    }

    if (seasonalPatterns.length > 0 && seasonalComponent && seasonalComponent.strength > 0.3) {
      return slope > 0 ? 'trending_up_with_seasonality' : 'trending_down_with_seasonality';
    }

    if (slope > 0) return 'increasing';
    return 'decreasing';
  }

  private calculateTrendStrength(components: TrendComponent[]): number {
    const nonNoiseComponents = components.filter(c => c.component_type !== 'noise');
    if (nonNoiseComponents.length === 0) return 0;

    return nonNoiseComponents.reduce((sum, comp) => sum + comp.strength, 0) / nonNoiseComponents.length;
  }

  private calculateStatisticalSignificance(
    data: TimeSeriesDataPoint[],
    components: TrendComponent[]
  ): number {
    // Simplified significance calculation based on trend strength and data size
    const linearComponent = components.find(c => c.component_type === 'linear');
    if (!linearComponent) return 0.5;

    const sampleSize = data.length;
    const effectSize = linearComponent.strength;

    // Simple significance approximation
    return Math.min(0.99, effectSize * Math.sqrt(sampleSize / 30));
  }

  private calculateConfidenceLevel(components: TrendComponent[], dataSize: number): number {
    const avgRSquared = components.reduce((sum, comp) => sum + comp.r_squared, 0) / components.length;
    const sizeBonus = Math.min(0.2, dataSize / 100);

    return Math.min(0.95, avgRSquared + sizeBonus);
  }

  // ========================================
  // MOCK IMPLEMENTATIONS (to be implemented with real data)
  // ========================================

  private loadAnalysisConfiguration(): TrendAnalysisConfig {
    return {
      min_data_points: {
        hourly: 48,
        daily: 30,
        weekly: 12,
        monthly: 6,
        quarterly: 4
      },
      cache_expiration_hours: {
        hourly: 1,
        daily: 6,
        weekly: 24,
        monthly: 72,
        quarterly: 168
      },
      change_point_sensitivity: 0.8,
      outlier_threshold: 3.0,
      seasonal_min_strength: 0.1
    };
  }

  private calculateAnalysisWindow(timePeriod: string, depth: string): TimeWindow {
    const endDate = new Date();
    const periodLengths = {
      hourly: { basic: 7, advanced: 14, comprehensive: 30 },
      daily: { basic: 30, advanced: 90, comprehensive: 365 },
      weekly: { basic: 12, advanced: 26, comprehensive: 104 },
      monthly: { basic: 6, advanced: 12, comprehensive: 36 },
      quarterly: { basic: 4, advanced: 8, comprehensive: 16 }
    };

    const days = periodLengths[timePeriod as keyof typeof periodLengths][depth as keyof typeof periodLengths.hourly];
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    return {
      start_date: startDate,
      end_date: endDate,
      total_periods: days,
      period_length: timePeriod,
      data_completeness: 0.95
    };
  }

  private getMinimumDataPoints(timePeriod: string): number {
    return this.analysisConfig.min_data_points[timePeriod as keyof typeof this.analysisConfig.min_data_points] || 10;
  }

  private getCacheExpirationTime(timePeriod: string): number {
    const hours = this.analysisConfig.cache_expiration_hours[timePeriod as keyof typeof this.analysisConfig.cache_expiration_hours] || 24;
    return hours * 60 * 60 * 1000;
  }

  private async getHistoricalData(
    _entityType: string,
    _entityId: string | undefined,
    _metricName: string,
    _timeWindow: TimeWindow
  ): Promise<TimeSeriesDataPoint[]> {
    // TODO: Implement actual data retrieval
    return [];
  }

  private async extractSeasonalComponent(
    _data: TimeSeriesDataPoint[],
    _timePeriod: string
  ): Promise<TrendComponent> {
    return {
      component_type: 'seasonal',
      strength: 0.3,
      r_squared: 0.2,
      contribution_percentage: 20,
      description: 'Seasonal component'
    };
  }

  private async extractCyclicalComponent(_data: TimeSeriesDataPoint[]): Promise<TrendComponent> {
    return {
      component_type: 'cyclical',
      strength: 0.1,
      r_squared: 0.05,
      contribution_percentage: 5,
      description: 'Cyclical component'
    };
  }

  private calculateNoiseLevel(_data: TimeSeriesDataPoint[], _components: TrendComponent[]): number {
    return 0.2;
  }

  private calculateChangePointThreshold(_data: TimeSeriesDataPoint[], _index: number): number {
    return 10;
  }

  private async identifyProbableCauses(
    _timestamp: Date,
    _metricName: string,
    _magnitude: number
  ): Promise<ProbableCause[]> {
    return [];
  }

  private assessBusinessSignificance(
    changeScore: number,
    _metricName: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    return changeScore > 50 ? 'high' : 'medium';
  }

  private detectWeeklyPattern(_data: TimeSeriesDataPoint[]): SeasonalPattern {
    return {
      pattern_type: 'weekly',
      strength: 0.2,
      phase: 0,
      amplitude: 10,
      period_length: 7,
      reliability: 0.7,
      next_peak: new Date(),
      next_trough: new Date(),
      pattern_stability: 0.6
    };
  }

  private detectMonthlyPattern(_data: TimeSeriesDataPoint[]): SeasonalPattern {
    return {
      pattern_type: 'monthly',
      strength: 0.15,
      phase: 0,
      amplitude: 15,
      period_length: 30,
      reliability: 0.6,
      next_peak: new Date(),
      next_trough: new Date(),
      pattern_stability: 0.5
    };
  }

  private calculateNextPeak(_hour: number, _type: string): Date {
    return new Date();
  }

  private calculateNextTrough(_hour: number, _type: string): Date {
    return new Date();
  }

  private async detectOutliers(
    _data: TimeSeriesDataPoint[],
    _components: TrendComponent[]
  ): Promise<OutlierPoint[]> {
    return [];
  }

  private async generateForecasts(
    _data: TimeSeriesDataPoint[],
    _components: TrendComponent[],
    _patterns: SeasonalPattern[],
    _periods: number
  ): Promise<ForecastedPoint[]> {
    return [];
  }

  private getBusinessContext(_entityType: string, _metricName: string): string {
    return 'Business context for trend analysis';
  }

  private getResponsibleTeam(_entityType: string, _metricName: string): string {
    return 'Operations Team';
  }

  private extractSlopeFromEquation(equation: string): number {
    const match = equation.match(/y = ([+-]?\d*\.?\d+)x/);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }

  private async getEntityData(_entityType: string, entityId: string): Promise<{ name: string }> {
    return { name: `Entity ${entityId}` };
  }

  private calculateBaselineValue(_trend: TrendAnalysis): number {
    return 100;
  }

  private identifyKeyDifferences(
    _metrics: ComparisonMetric[],
    _entities: ComparisonEntity[]
  ): KeyDifference[] {
    return [];
  }

  private async performStatisticalTests(
    _metrics: ComparisonMetric[],
    _comparisonType: string
  ): Promise<StatisticalTest[]> {
    return [];
  }

  private async generateComparisonInsights(
    _entities: ComparisonEntity[],
    _metrics: ComparisonMetric[],
    _differences: KeyDifference[]
  ): Promise<TrendInsight[]> {
    return [];
  }

  private async generateComparisonRecommendations(
    _type: string,
    _differences: KeyDifference[],
    _insights: TrendInsight[]
  ): Promise<TrendRecommendation[]> {
    return [];
  }

  private async checkForTrendAlerts(_analysis: TrendAnalysis): Promise<void> {
    // Alert checking logic would go here
  }
}

// ========================================
// SUPPORTING INTERFACES
// ========================================

interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

interface TrendAnalysisConfig {
  min_data_points: Record<string, number>;
  cache_expiration_hours: Record<string, number>;
  change_point_sensitivity: number;
  outlier_threshold: number;
  seasonal_min_strength: number;
}

// Export singleton instance
export const trendAnalyzerEngine = new TrendAnalyzerEngine();