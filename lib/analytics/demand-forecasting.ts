// Enterprise Demand Forecasting with Seasonality Analysis
// Predicts ticket volume, resource requirements, and capacity planning with advanced time series analysis

import { mlPipeline, MLModel } from './ml-pipeline';
import { logger } from '../monitoring/logger';

export interface DemandForecast {
  forecast_id: string;
  forecast_type: 'tickets' | 'workload' | 'resources' | 'capacity';
  time_horizon: 'hourly' | 'daily' | 'weekly' | 'monthly';
  forecast_period_start: Date;
  forecast_period_end: Date;
  predictions: ForecastPrediction[];
  confidence_intervals: ConfidenceInterval[];
  seasonality_components: SeasonalityComponent[];
  trend_analysis: TrendAnalysis;
  model_performance: ForecastMetrics;
  generated_at: Date;
}

export interface ForecastPrediction {
  timestamp: Date;
  predicted_value: number;
  confidence: number;
  lower_bound: number;
  upper_bound: number;
  contributing_factors: Record<string, number>;
  seasonality_impact: number;
  trend_impact: number;
  external_factors_impact: number;
}

export interface ConfidenceInterval {
  timestamp: Date;
  confidence_level: number; // 0.8, 0.9, 0.95
  lower_bound: number;
  upper_bound: number;
}

export interface SeasonalityComponent {
  type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'holiday';
  strength: number; // 0-1
  phase: number; // phase shift
  amplitude: number;
  period_length: number;
  detected_patterns: DetectedPattern[];
}

export interface DetectedPattern {
  pattern_name: string;
  description: string;
  frequency: number;
  significance: number;
  last_occurrence: Date;
  next_predicted_occurrence: Date;
}

export interface TrendAnalysis {
  overall_trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  trend_strength: number;
  growth_rate_per_period: number;
  volatility_score: number;
  changepoints: Changepoint[];
  trend_decomposition: TrendDecomposition;
}

export interface Changepoint {
  timestamp: Date;
  magnitude: number;
  direction: 'increase' | 'decrease';
  confidence: number;
  probable_cause: string;
}

export interface TrendDecomposition {
  linear_component: number;
  exponential_component: number;
  polynomial_component: number;
  seasonal_component: number;
  noise_component: number;
}

export interface ForecastMetrics {
  mae: number; // Mean Absolute Error
  mape: number; // Mean Absolute Percentage Error
  rmse: number; // Root Mean Square Error
  mase: number; // Mean Absolute Scaled Error
  smape: number; // Symmetric Mean Absolute Percentage Error
  coverage_probability: number; // Confidence interval coverage
  forecast_bias: number;
  seasonal_naive_comparison: number;
}

export interface ExternalFactor {
  factor_name: string;
  factor_type: 'calendar' | 'economic' | 'weather' | 'event' | 'business';
  impact_strength: number;
  lead_time_hours: number;
  correlation_coefficient: number;
  data_source: string;
}

export interface CapacityRecommendation {
  timestamp: Date;
  recommended_agents: number;
  predicted_workload: number;
  service_level_target: number;
  predicted_service_level: number;
  cost_impact: number;
  confidence: number;
  recommendation_reason: string;
}

export class DemandForecastingEngine {
  private forecastModels: Map<string, string> = new Map();
  private historicalData: Map<string, TimeSeriesData[]> = new Map();
  private externalFactors: ExternalFactor[] = [];
  private lastModelUpdate: Date = new Date();

  constructor() {
    this.initializeModels();
    this.loadExternalFactors();
  }

  // ========================================
  // MAIN FORECASTING METHODS
  // ========================================

  async generateDemandForecast(
    forecastType: DemandForecast['forecast_type'],
    timeHorizon: DemandForecast['time_horizon'],
    forecastPeriods: number,
    filters?: ForecastFilters
  ): Promise<DemandForecast> {
    const startTime = Date.now();
    logger.info(`[Demand Forecasting] Generating ${forecastType} forecast for ${forecastPeriods} ${timeHorizon} periods`);

    try {
      // Prepare historical data
      const historicalData = await this.prepareHistoricalData(forecastType, timeHorizon, filters);

      // Detect seasonality patterns
      const seasonalityComponents = await this.detectSeasonality(historicalData, timeHorizon);

      // Perform trend analysis
      const trendAnalysis = await this.analyzeTrend(historicalData);

      // Generate base predictions
      const predictions = await this.generatePredictions(
        historicalData,
        forecastPeriods,
        timeHorizon,
        seasonalityComponents,
        trendAnalysis
      );

      // Apply external factors
      const adjustedPredictions = await this.applyExternalFactors(predictions, timeHorizon);

      // Calculate confidence intervals
      const confidenceIntervals = this.calculateConfidenceIntervals(adjustedPredictions);

      // Evaluate model performance
      const modelPerformance = await this.evaluateForecastPerformance(historicalData, forecastType);

      const forecast: DemandForecast = {
        forecast_id: `${forecastType}_${timeHorizon}_${Date.now()}`,
        forecast_type: forecastType,
        time_horizon: timeHorizon,
        forecast_period_start: adjustedPredictions[0]?.timestamp || new Date(),
        forecast_period_end: adjustedPredictions[adjustedPredictions.length - 1]?.timestamp || new Date(),
        predictions: adjustedPredictions,
        confidence_intervals: confidenceIntervals,
        seasonality_components: seasonalityComponents,
        trend_analysis: trendAnalysis,
        model_performance: modelPerformance,
        generated_at: new Date()
      };

      logger.info(`[Demand Forecasting] Forecast generated in ${Date.now() - startTime}ms`);
      return forecast;

    } catch (error) {
      logger.error('[Demand Forecasting] Error generating forecast', error);
      throw error;
    }
  }

  async generateCapacityRecommendations(
    forecastHorizonDays: number,
    serviceLevelTarget: number = 0.8
  ): Promise<CapacityRecommendation[]> {
    // Generate workload forecast
    const workloadForecast = await this.generateDemandForecast('workload', 'hourly', forecastHorizonDays * 24);

    const recommendations: CapacityRecommendation[] = [];

    for (const prediction of workloadForecast.predictions) {
      const recommendation = await this.calculateCapacityRequirement(
        prediction,
        serviceLevelTarget
      );
      recommendations.push(recommendation);
    }

    return recommendations;
  }

  async detectAnomalies(
    dataType: string,
    timeWindow: 'last_24h' | 'last_week' | 'last_month'
  ): Promise<AnomalyDetection[]> {
    const historicalData = await this.getHistoricalData(dataType, timeWindow);
    const forecast = await this.generateDemandForecast('tickets', 'hourly', 24);

    const anomalies: AnomalyDetection[] = [];

    // Compare actual vs predicted values
    for (let i = 0; i < Math.min(historicalData.length, forecast.predictions.length); i++) {
      const actual = historicalData[i];
      const predicted = forecast.predictions[i];

      const deviation = Math.abs(actual.value - predicted.predicted_value);
      const threshold = predicted.upper_bound - predicted.predicted_value;

      if (deviation > threshold) {
        anomalies.push({
          timestamp: actual.timestamp,
          actual_value: actual.value,
          predicted_value: predicted.predicted_value,
          deviation_score: deviation / threshold,
          anomaly_type: actual.value > predicted.predicted_value ? 'spike' : 'drop',
          confidence: predicted.confidence,
          possible_causes: await this.identifyAnomalyCauses(actual, predicted)
        });
      }
    }

    return anomalies;
  }

  // ========================================
  // SEASONALITY DETECTION
  // ========================================

  private async detectSeasonality(
    data: TimeSeriesData[],
    timeHorizon: string
  ): Promise<SeasonalityComponent[]> {
    const components: SeasonalityComponent[] = [];

    // Hourly patterns (within day)
    if (['hourly', 'daily'].includes(timeHorizon)) {
      const hourlyPattern = this.detectHourlySeasonality(data);
      if (hourlyPattern.strength > 0.1) {
        components.push(hourlyPattern);
      }
    }

    // Daily patterns (within week)
    if (['hourly', 'daily', 'weekly'].includes(timeHorizon)) {
      const weeklyPattern = this.detectWeeklySeasonality(data);
      if (weeklyPattern.strength > 0.1) {
        components.push(weeklyPattern);
      }
    }

    // Monthly patterns
    if (['daily', 'weekly', 'monthly'].includes(timeHorizon)) {
      const monthlyPattern = this.detectMonthlySeasonality(data);
      if (monthlyPattern.strength > 0.1) {
        components.push(monthlyPattern);
      }
    }

    // Holiday patterns
    const holidayPattern = await this.detectHolidaySeasonality(data);
    if (holidayPattern.strength > 0.1) {
      components.push(holidayPattern);
    }

    return components;
  }

  private detectHourlySeasonality(data: TimeSeriesData[]): SeasonalityComponent {
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    // Calculate average for each hour
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

    // Calculate strength and patterns
    const overallMean = hourlyAverages.reduce((sum, val) => sum + val, 0) / 24;
    const variance = hourlyAverages.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / 24;
    const strength = Math.sqrt(variance) / overallMean;

    // Find peak hours
    const maxHour = hourlyAverages.indexOf(Math.max(...hourlyAverages));
    const minHour = hourlyAverages.indexOf(Math.min(...hourlyAverages));

    const patterns: DetectedPattern[] = [
      {
        pattern_name: 'Peak Hours',
        description: `Highest demand typically occurs around ${maxHour}:00`,
        frequency: 1, // daily
        significance: strength,
        last_occurrence: new Date(),
        next_predicted_occurrence: this.getNextOccurrence(maxHour, 'hour')
      },
      {
        pattern_name: 'Low Hours',
        description: `Lowest demand typically occurs around ${minHour}:00`,
        frequency: 1, // daily
        significance: strength,
        last_occurrence: new Date(),
        next_predicted_occurrence: this.getNextOccurrence(minHour, 'hour')
      }
    ];

    return {
      type: 'hourly',
      strength: strength,
      phase: maxHour,
      amplitude: Math.max(...hourlyAverages) - Math.min(...hourlyAverages),
      period_length: 24,
      detected_patterns: patterns
    };
  }

  private detectWeeklySeasonality(data: TimeSeriesData[]): SeasonalityComponent {
    const dailyAverages = new Array(7).fill(0);
    const dailyCounts = new Array(7).fill(0);

    // Calculate average for each day of week (0 = Sunday)
    for (const point of data) {
      const dayOfWeek = point.timestamp.getDay();
      dailyAverages[dayOfWeek] += point.value;
      dailyCounts[dayOfWeek]++;
    }

    for (let i = 0; i < 7; i++) {
      if (dailyCounts[i] > 0) {
        dailyAverages[i] /= dailyCounts[i];
      }
    }

    const overallMean = dailyAverages.reduce((sum, val) => sum + val, 0) / 7;
    const variance = dailyAverages.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / 7;
    const strength = Math.sqrt(variance) / overallMean;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const maxDay = dailyAverages.indexOf(Math.max(...dailyAverages));
    const minDay = dailyAverages.indexOf(Math.min(...dailyAverages));

    const patterns: DetectedPattern[] = [
      {
        pattern_name: 'Peak Day',
        description: `Highest demand typically occurs on ${dayNames[maxDay]}`,
        frequency: 1/7, // weekly
        significance: strength,
        last_occurrence: new Date(),
        next_predicted_occurrence: this.getNextOccurrence(maxDay, 'day')
      },
      {
        pattern_name: 'Weekend Effect',
        description: 'Different demand patterns during weekends',
        frequency: 2/7, // twice per week
        significance: this.calculateWeekendEffect(dailyAverages),
        last_occurrence: new Date(),
        next_predicted_occurrence: this.getNextWeekend()
      }
    ];

    return {
      type: 'weekly',
      strength: strength,
      phase: maxDay,
      amplitude: Math.max(...dailyAverages) - Math.min(...dailyAverages),
      period_length: 7,
      detected_patterns: patterns
    };
  }

  private detectMonthlySeasonality(data: TimeSeriesData[]): SeasonalityComponent {
    const monthlyAverages = new Array(12).fill(0);
    const monthlyCounts = new Array(12).fill(0);

    for (const point of data) {
      const month = point.timestamp.getMonth();
      monthlyAverages[month] += point.value;
      monthlyCounts[month]++;
    }

    for (let i = 0; i < 12; i++) {
      if (monthlyCounts[i] > 0) {
        monthlyAverages[i] /= monthlyCounts[i];
      }
    }

    const overallMean = monthlyAverages.reduce((sum, val) => sum + val, 0) / 12;
    const variance = monthlyAverages.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / 12;
    const strength = Math.sqrt(variance) / overallMean;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const maxMonth = monthlyAverages.indexOf(Math.max(...monthlyAverages));

    const patterns: DetectedPattern[] = [
      {
        pattern_name: 'Peak Month',
        description: `Highest demand typically occurs in ${monthNames[maxMonth]}`,
        frequency: 1/12, // yearly
        significance: strength,
        last_occurrence: new Date(),
        next_predicted_occurrence: this.getNextOccurrence(maxMonth, 'month')
      }
    ];

    return {
      type: 'monthly',
      strength: strength,
      phase: maxMonth,
      amplitude: Math.max(...monthlyAverages) - Math.min(...monthlyAverages),
      period_length: 12,
      detected_patterns: patterns
    };
  }

  private async detectHolidaySeasonality(data: TimeSeriesData[]): Promise<SeasonalityComponent> {
    // Brazilian holidays and their impact
    const brazilianHolidays = [
      { name: 'New Year', month: 0, day: 1 },
      { name: 'Independence Day', month: 8, day: 7 },
      { name: 'Christmas', month: 11, day: 25 },
      { name: 'Labor Day', month: 4, day: 1 }
    ];

    let totalHolidayImpact = 0;
    let holidayCount = 0;

    for (const holiday of brazilianHolidays) {
      const impact = this.calculateHolidayImpact(data, holiday);
      totalHolidayImpact += Math.abs(impact);
      holidayCount++;
    }

    const averageImpact = holidayCount > 0 ? totalHolidayImpact / holidayCount : 0;

    const patterns: DetectedPattern[] = brazilianHolidays.map(holiday => ({
      pattern_name: holiday.name,
      description: `Special demand pattern during ${holiday.name}`,
      frequency: 1/365, // yearly
      significance: averageImpact,
      last_occurrence: this.getLastHolidayOccurrence(holiday),
      next_predicted_occurrence: this.getNextHolidayOccurrence(holiday)
    }));

    return {
      type: 'holiday',
      strength: averageImpact,
      phase: 0,
      amplitude: averageImpact,
      period_length: 365,
      detected_patterns: patterns
    };
  }

  // ========================================
  // TREND ANALYSIS
  // ========================================

  private async analyzeTrend(data: TimeSeriesData[]): Promise<TrendAnalysis> {
    const values = data.map(d => d.value);
    const timestamps = data.map(d => d.timestamp.getTime());

    // Linear regression for overall trend
    const linearTrend = this.calculateLinearRegression(timestamps, values);

    // Detect changepoints
    const changepoints = this.detectChangepoints(data);

    // Calculate volatility
    const volatility = this.calculateVolatility(values);

    // Decompose trend components
    const trendDecomposition = this.decomposeTrend(data);

    // Determine overall trend direction
    const overallTrend = this.classifyTrend(linearTrend.slope, volatility);

    return {
      overall_trend: overallTrend,
      trend_strength: Math.abs(linearTrend.slope),
      growth_rate_per_period: linearTrend.slope,
      volatility_score: volatility,
      changepoints: changepoints,
      trend_decomposition: trendDecomposition
    };
  }

  private calculateLinearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const r2 = 1 - (residualSumSquares / totalSumSquares);

    return { slope, intercept, r2 };
  }

  private detectChangepoints(data: TimeSeriesData[]): Changepoint[] {
    const changepoints: Changepoint[] = [];
    const windowSize = Math.min(20, Math.floor(data.length / 10));

    for (let i = windowSize; i < data.length - windowSize; i++) {
      const beforeWindow = data.slice(i - windowSize, i);
      const afterWindow = data.slice(i, i + windowSize);

      const beforeMean = beforeWindow.reduce((sum, d) => sum + d.value, 0) / beforeWindow.length;
      const afterMean = afterWindow.reduce((sum, d) => sum + d.value, 0) / afterWindow.length;

      const magnitude = Math.abs(afterMean - beforeMean);
      const threshold = this.calculateChangePointThreshold(data, i);

      if (magnitude > threshold) {
        changepoints.push({
          timestamp: data[i].timestamp,
          magnitude: magnitude,
          direction: afterMean > beforeMean ? 'increase' : 'decrease',
          confidence: Math.min(magnitude / threshold, 1),
          probable_cause: this.identifyChangePointCause(data[i].timestamp, magnitude)
        });
      }
    }

    return changepoints;
  }

  // ========================================
  // PREDICTION GENERATION
  // ========================================

  private async generatePredictions(
    historicalData: TimeSeriesData[],
    forecastPeriods: number,
    timeHorizon: string,
    seasonalityComponents: SeasonalityComponent[],
    trendAnalysis: TrendAnalysis
  ): Promise<ForecastPrediction[]> {
    const predictions: ForecastPrediction[] = [];
    const lastDataPoint = historicalData[historicalData.length - 1];
    const timeIncrement = this.getTimeIncrement(timeHorizon);

    for (let i = 1; i <= forecastPeriods; i++) {
      const predictionTime = new Date(lastDataPoint.timestamp.getTime() + i * timeIncrement);

      // Base prediction using trend
      const trendValue = this.calculateTrendValue(lastDataPoint, i, trendAnalysis);

      // Apply seasonality
      const seasonalityAdjustment = this.calculateSeasonalityAdjustment(
        predictionTime,
        seasonalityComponents
      );

      const baseValue = trendValue * (1 + seasonalityAdjustment);

      // Calculate confidence based on historical accuracy
      const confidence = this.calculatePredictionConfidence(i, trendAnalysis.volatility_score);

      // Calculate prediction bounds
      const errorMargin = baseValue * (0.1 + trendAnalysis.volatility_score * 0.3) * Math.sqrt(i);

      predictions.push({
        timestamp: predictionTime,
        predicted_value: Math.max(0, baseValue),
        confidence: confidence,
        lower_bound: Math.max(0, baseValue - errorMargin),
        upper_bound: baseValue + errorMargin,
        contributing_factors: {
          trend: trendValue,
          seasonality: seasonalityAdjustment,
          base_level: lastDataPoint.value
        },
        seasonality_impact: seasonalityAdjustment,
        trend_impact: (trendValue - lastDataPoint.value) / lastDataPoint.value,
        external_factors_impact: 0 // Will be filled by applyExternalFactors
      });
    }

    return predictions;
  }

  private calculateTrendValue(
    lastPoint: TimeSeriesData,
    periodsAhead: number,
    trendAnalysis: TrendAnalysis
  ): number {
    // Simple linear trend projection
    return lastPoint.value + (trendAnalysis.growth_rate_per_period * periodsAhead);
  }

  private calculateSeasonalityAdjustment(
    timestamp: Date,
    components: SeasonalityComponent[]
  ): number {
    let totalAdjustment = 0;

    for (const component of components) {
      const adjustment = this.getSeasonalityValueForTime(timestamp, component);
      totalAdjustment += adjustment * component.strength;
    }

    return totalAdjustment;
  }

  private getSeasonalityValueForTime(timestamp: Date, component: SeasonalityComponent): number {
    switch (component.type) {
      case 'hourly':
        const hour = timestamp.getHours();
        return Math.sin(2 * Math.PI * hour / 24) * component.amplitude;

      case 'weekly':
        const dayOfWeek = timestamp.getDay();
        return Math.sin(2 * Math.PI * dayOfWeek / 7) * component.amplitude;

      case 'monthly':
        const month = timestamp.getMonth();
        return Math.sin(2 * Math.PI * month / 12) * component.amplitude;

      default:
        return 0;
    }
  }

  // ========================================
  // EXTERNAL FACTORS
  // ========================================

  private async applyExternalFactors(
    predictions: ForecastPrediction[],
    timeHorizon: string
  ): Promise<ForecastPrediction[]> {
    const adjustedPredictions = [...predictions];

    for (let i = 0; i < adjustedPredictions.length; i++) {
      const prediction = adjustedPredictions[i];
      let totalAdjustment = 0;

      for (const factor of this.externalFactors) {
        const adjustment = await this.calculateExternalFactorImpact(
          prediction.timestamp,
          factor,
          timeHorizon
        );
        totalAdjustment += adjustment;
      }

      // Apply external factor adjustment
      prediction.predicted_value *= (1 + totalAdjustment);
      prediction.lower_bound *= (1 + totalAdjustment);
      prediction.upper_bound *= (1 + totalAdjustment);
      prediction.external_factors_impact = totalAdjustment;
    }

    return adjustedPredictions;
  }

  private async calculateExternalFactorImpact(
    timestamp: Date,
    factor: ExternalFactor,
    timeHorizon: string
  ): Promise<number> {
    switch (factor.factor_type) {
      case 'calendar':
        return this.calculateCalendarImpact(timestamp, factor);
      case 'economic':
        return await this.calculateEconomicImpact(timestamp, factor);
      case 'weather':
        return await this.calculateWeatherImpact(timestamp, factor);
      case 'event':
        return await this.calculateEventImpact(timestamp, factor);
      case 'business':
        return this.calculateBusinessImpact(timestamp, factor);
      default:
        return 0;
    }
  }

  // ========================================
  // CAPACITY PLANNING
  // ========================================

  private async calculateCapacityRequirement(
    workloadPrediction: ForecastPrediction,
    serviceLevelTarget: number
  ): Promise<CapacityRecommendation> {
    // Erlang C formula for call center staffing
    const avgHandleTime = 15; // minutes
    const targetAnswerTime = 3; // minutes

    const traffic = workloadPrediction.predicted_value * avgHandleTime / 60; // Erlangs
    const requiredAgents = this.calculateErlangCStaffing(traffic, serviceLevelTarget, targetAnswerTime);

    // Calculate cost impact
    const currentAgents = await this.getCurrentAgentCount();
    const agentDifference = requiredAgents - currentAgents;
    const costPerAgent = 50; // hourly cost
    const costImpact = agentDifference * costPerAgent;

    // Predict service level with recommended staffing
    const predictedServiceLevel = this.calculateServiceLevel(traffic, requiredAgents, targetAnswerTime);

    return {
      timestamp: workloadPrediction.timestamp,
      recommended_agents: Math.ceil(requiredAgents),
      predicted_workload: workloadPrediction.predicted_value,
      service_level_target: serviceLevelTarget,
      predicted_service_level: predictedServiceLevel,
      cost_impact: costImpact,
      confidence: workloadPrediction.confidence,
      recommendation_reason: this.generateRecommendationReason(agentDifference, predictedServiceLevel, serviceLevelTarget)
    };
  }

  private calculateErlangCStaffing(traffic: number, serviceLevel: number, targetTime: number): number {
    // Simplified Erlang C calculation
    let agents = Math.ceil(traffic);
    let currentServiceLevel = 0;

    while (currentServiceLevel < serviceLevel && agents < traffic * 3) {
      agents++;
      currentServiceLevel = this.calculateServiceLevel(traffic, agents, targetTime);
    }

    return agents;
  }

  private calculateServiceLevel(traffic: number, agents: number, targetTime: number): number {
    if (agents <= traffic) return 0;

    // Simplified service level calculation
    const utilization = traffic / agents;
    const waitProbability = this.calculateErlangC(traffic, agents);
    const avgWaitTime = waitProbability / (agents - traffic);

    return avgWaitTime <= targetTime ? 0.95 : 0.95 * Math.exp(-avgWaitTime / targetTime);
  }

  private calculateErlangC(traffic: number, agents: number): number {
    // Simplified Erlang C formula
    const rho = traffic / agents;
    if (rho >= 1) return 1;

    return (Math.pow(traffic, agents) / this.factorial(agents)) /
           (this.erlangBSum(traffic, agents) + Math.pow(traffic, agents) / (this.factorial(agents) * (1 - rho)));
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private getTimeIncrement(timeHorizon: string): number {
    switch (timeHorizon) {
      case 'hourly': return 60 * 60 * 1000; // 1 hour in ms
      case 'daily': return 24 * 60 * 60 * 1000; // 1 day in ms
      case 'weekly': return 7 * 24 * 60 * 60 * 1000; // 1 week in ms
      case 'monthly': return 30 * 24 * 60 * 60 * 1000; // 30 days in ms
      default: return 60 * 60 * 1000;
    }
  }

  private calculatePredictionConfidence(periodsAhead: number, volatility: number): number {
    // Confidence decreases with distance and volatility
    const baseConfidence = 0.9;
    const decayFactor = 0.05;
    const volatilityPenalty = volatility * 0.3;

    return Math.max(0.5, baseConfidence - periodsAhead * decayFactor - volatilityPenalty);
  }

  private calculateConfidenceIntervals(predictions: ForecastPrediction[]): ConfidenceInterval[] {
    const intervals: ConfidenceInterval[] = [];
    const confidenceLevels = [0.8, 0.9, 0.95];

    for (const prediction of predictions) {
      for (const level of confidenceLevels) {
        const zScore = this.getZScore(level);
        const standardError = (prediction.upper_bound - prediction.lower_bound) / 2;

        intervals.push({
          timestamp: prediction.timestamp,
          confidence_level: level,
          lower_bound: prediction.predicted_value - zScore * standardError,
          upper_bound: prediction.predicted_value + zScore * standardError
        });
      }
    }

    return intervals;
  }

  private getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      0.8: 1.28,
      0.9: 1.64,
      0.95: 1.96,
      0.99: 2.58
    };
    return zScores[confidenceLevel] || 1.96;
  }

  // Mock implementations for data access and calculations
  private async initializeModels(): Promise<void> {
    logger.info('[Demand Forecasting] Initializing forecasting models');
  }

  private loadExternalFactors(): void {
    this.externalFactors = [
      {
        factor_name: 'Brazilian Holidays',
        factor_type: 'calendar',
        impact_strength: 0.3,
        lead_time_hours: 24,
        correlation_coefficient: -0.6,
        data_source: 'calendar_api'
      },
      {
        factor_name: 'Economic Indicators',
        factor_type: 'economic',
        impact_strength: 0.2,
        lead_time_hours: 168,
        correlation_coefficient: 0.4,
        data_source: 'economic_api'
      }
    ];
  }

  private async prepareHistoricalData(
    forecastType: string,
    timeHorizon: string,
    filters?: ForecastFilters
  ): Promise<TimeSeriesData[]> {
    // Mock implementation
    return [];
  }

  private async evaluateForecastPerformance(
    historicalData: TimeSeriesData[],
    forecastType: string
  ): Promise<ForecastMetrics> {
    return {
      mae: 5.2,
      mape: 0.15,
      rmse: 7.8,
      mase: 0.85,
      smape: 0.12,
      coverage_probability: 0.92,
      forecast_bias: 0.02,
      seasonal_naive_comparison: 1.2
    };
  }

  // Additional utility methods
  private calculateVolatility(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  private classifyTrend(slope: number, volatility: number): TrendAnalysis['overall_trend'] {
    if (volatility > 0.5) return 'volatile';
    if (Math.abs(slope) < 0.1) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  private decomposeTrend(data: TimeSeriesData[]): TrendDecomposition {
    return {
      linear_component: 0.6,
      exponential_component: 0.1,
      polynomial_component: 0.1,
      seasonal_component: 0.15,
      noise_component: 0.05
    };
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
  }

  private erlangBSum(traffic: number, agents: number): number {
    let sum = 0;
    for (let k = 0; k < agents; k++) {
      sum += Math.pow(traffic, k) / this.factorial(k);
    }
    return sum;
  }

  // Additional helper methods (simplified implementations)
  private getNextOccurrence(value: number, type: string): Date { return new Date(); }
  private getNextWeekend(): Date { return new Date(); }
  private calculateWeekendEffect(dailyAverages: number[]): number { return 0.2; }
  private calculateHolidayImpact(data: TimeSeriesData[], holiday: any): number { return 0.1; }
  private getLastHolidayOccurrence(holiday: any): Date { return new Date(); }
  private getNextHolidayOccurrence(holiday: any): Date { return new Date(); }
  private calculateChangePointThreshold(data: TimeSeriesData[], index: number): number { return 10; }
  private identifyChangePointCause(timestamp: Date, magnitude: number): string { return 'Unknown'; }
  private calculateCalendarImpact(timestamp: Date, factor: ExternalFactor): number { return 0; }
  private async calculateEconomicImpact(timestamp: Date, factor: ExternalFactor): Promise<number> { return 0; }
  private async calculateWeatherImpact(timestamp: Date, factor: ExternalFactor): Promise<number> { return 0; }
  private async calculateEventImpact(timestamp: Date, factor: ExternalFactor): Promise<number> { return 0; }
  private calculateBusinessImpact(timestamp: Date, factor: ExternalFactor): number { return 0; }
  private async getCurrentAgentCount(): Promise<number> { return 10; }
  private generateRecommendationReason(agentDifference: number, predictedSL: number, targetSL: number): string {
    return `Recommended ${agentDifference > 0 ? 'increase' : 'decrease'} in staffing to maintain service level`;
  }
  private async getHistoricalData(dataType: string, timeWindow: string): Promise<TimeSeriesData[]> { return []; }
  private async identifyAnomalyCauses(actual: TimeSeriesData, predicted: ForecastPrediction): Promise<string[]> {
    return ['System overload', 'Unexpected event'];
  }
}

// ========================================
// SUPPORTING INTERFACES
// ========================================

interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

interface ForecastFilters {
  category_ids?: number[];
  priority_levels?: number[];
  agent_ids?: number[];
  department_ids?: number[];
}

interface AnomalyDetection {
  timestamp: Date;
  actual_value: number;
  predicted_value: number;
  deviation_score: number;
  anomaly_type: 'spike' | 'drop';
  confidence: number;
  possible_causes: string[];
}

// Export singleton instance
export const demandForecastingEngine = new DemandForecastingEngine();