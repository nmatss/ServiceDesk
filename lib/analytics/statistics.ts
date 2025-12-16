/**
 * Statistical Analysis Functions
 *
 * Comprehensive statistical utilities for analytics and predictive modeling.
 * Includes moving averages, trend detection, correlation analysis, and more.
 *
 * @module lib/analytics/statistics
 */

export interface TimeSeriesPoint {
  timestamp: Date | string;
  value: number;
}

export interface StatisticalSummary {
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
}

export interface TrendAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  rSquared: number;
  forecast: number[];
  confidence: number;
}

export interface CorrelationResult {
  coefficient: number;
  strength: 'very weak' | 'weak' | 'moderate' | 'strong' | 'very strong';
  direction: 'positive' | 'negative' | 'none';
  pValue?: number;
}

/**
 * Calculate mean (average)
 */
export function mean(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, val) => sum + val, 0) / data.length;
}

/**
 * Calculate median
 */
export function median(data: number[]): number {
  if (data.length === 0) return 0;

  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/**
 * Calculate mode (most frequent value)
 */
export function mode(data: number[]): number {
  if (data.length === 0) return 0;

  const frequency = new Map<number, number>();
  data.forEach(val => {
    frequency.set(val, (frequency.get(val) || 0) + 1);
  });

  let maxFreq = 0;
  let modeValue = data[0] ?? 0;

  frequency.forEach((freq, val) => {
    if (freq > maxFreq) {
      maxFreq = freq;
      modeValue = val;
    }
  });

  return modeValue;
}

/**
 * Calculate variance
 */
export function variance(data: number[]): number {
  if (data.length === 0) return 0;

  const avg = mean(data);
  const squaredDiffs = data.map(val => Math.pow(val - avg, 2));
  return mean(squaredDiffs);
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(data: number[]): number {
  return Math.sqrt(variance(data));
}

/**
 * Calculate percentile
 */
export function percentile(data: number[], p: number): number {
  if (data.length === 0) return 0;
  if (p < 0 || p > 100) throw new Error('Percentile must be between 0 and 100');

  const sorted = [...data].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower] ?? 0;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

/**
 * Calculate quartiles
 */
export function quartiles(data: number[]): { q1: number; q2: number; q3: number; iqr: number } {
  return {
    q1: percentile(data, 25),
    q2: percentile(data, 50),
    q3: percentile(data, 75),
    iqr: percentile(data, 75) - percentile(data, 25),
  };
}

/**
 * Calculate skewness (measure of asymmetry)
 */
export function skewness(data: number[]): number {
  if (data.length < 3) return 0;

  const avg = mean(data);
  const stdDev = standardDeviation(data);
  const n = data.length;

  if (stdDev === 0) return 0;

  const sumCubes = data.reduce((sum, val) => sum + Math.pow((val - avg) / stdDev, 3), 0);
  return (n / ((n - 1) * (n - 2))) * sumCubes;
}

/**
 * Calculate kurtosis (measure of tail heaviness)
 */
export function kurtosis(data: number[]): number {
  if (data.length < 4) return 0;

  const avg = mean(data);
  const stdDev = standardDeviation(data);
  const n = data.length;

  if (stdDev === 0) return 0;

  const sumFourths = data.reduce((sum, val) => sum + Math.pow((val - avg) / stdDev, 4), 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sumFourths - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
}

/**
 * Get comprehensive statistical summary
 */
export function getStatisticalSummary(data: number[]): StatisticalSummary {
  const q = quartiles(data);

  return {
    mean: mean(data),
    median: median(data),
    mode: mode(data),
    stdDev: standardDeviation(data),
    variance: variance(data),
    min: Math.min(...data),
    max: Math.max(...data),
    range: Math.max(...data) - Math.min(...data),
    q1: q.q1,
    q3: q.q3,
    iqr: q.iqr,
    skewness: skewness(data),
    kurtosis: kurtosis(data),
  };
}

/**
 * Simple Moving Average (SMA)
 */
export function simpleMovingAverage(data: number[], window: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
  }

  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function exponentialMovingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (window + 1);

  result[0] = data[0] ?? 0;

  for (let i = 1; i < data.length; i++) {
    const prevResult = result[i - 1] ?? 0;
    const currentData = data[i] ?? 0;
    result[i] = (currentData - prevResult) * multiplier + prevResult;
  }

  return result;
}

/**
 * Weighted Moving Average (WMA)
 */
export function weightedMovingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  const weights = Array.from({ length: window }, (_, i) => i + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(NaN);
    } else {
      const values = data.slice(i - window + 1, i + 1);
      const weightedSum = values.reduce((sum, val, idx) => sum + val * (weights[idx] ?? 0), 0);
      result.push(weightedSum / weightSum);
    }
  }

  return result;
}

/**
 * Linear regression
 */
export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  if (x.length !== y.length || x.length === 0) {
    throw new Error('Invalid input data for linear regression');
  }

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * (y[i] ?? 0), 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = mean(y);
  const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssResidual = y.reduce((sum, yi, i) => {
    const predicted = slope * (x[i] ?? 0) + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const rSquared = 1 - (ssResidual / ssTotal);

  return { slope, intercept, rSquared };
}

/**
 * Detect trend in time series
 */
export function detectTrend(data: number[], threshold = 0.1): TrendAnalysis {
  const x = Array.from({ length: data.length }, (_, i) => i);
  const regression = linearRegression(x, data);

  let trend: 'increasing' | 'decreasing' | 'stable';
  if (Math.abs(regression.slope) < threshold) {
    trend = 'stable';
  } else if (regression.slope > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }

  // Generate forecast for next 5 periods
  const forecast = Array.from({ length: 5 }, (_, i) => {
    const nextX = data.length + i;
    return regression.slope * nextX + regression.intercept;
  });

  return {
    trend,
    slope: regression.slope,
    rSquared: regression.rSquared,
    forecast,
    confidence: regression.rSquared * 100,
  };
}

/**
 * Calculate Pearson correlation coefficient
 */
export function correlationPearson(x: number[], y: number[]): CorrelationResult {
  if (x.length !== y.length || x.length === 0) {
    throw new Error('Invalid input data for correlation');
  }

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * (y[i] ?? 0), 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

  const coefficient = denominator === 0 ? 0 : numerator / denominator;

  // Interpret strength
  const absCoeff = Math.abs(coefficient);
  let strength: CorrelationResult['strength'];
  if (absCoeff >= 0.8) strength = 'very strong';
  else if (absCoeff >= 0.6) strength = 'strong';
  else if (absCoeff >= 0.4) strength = 'moderate';
  else if (absCoeff >= 0.2) strength = 'weak';
  else strength = 'very weak';

  const direction = coefficient > 0.1 ? 'positive' : coefficient < -0.1 ? 'negative' : 'none';

  return { coefficient, strength, direction };
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliers(data: number[], multiplier = 1.5): { outliers: number[]; indices: number[] } {
  const q = quartiles(data);
  const lowerBound = q.q1 - multiplier * q.iqr;
  const upperBound = q.q3 + multiplier * q.iqr;

  const outliers: number[] = [];
  const indices: number[] = [];

  data.forEach((val, idx) => {
    if (val < lowerBound || val > upperBound) {
      outliers.push(val);
      indices.push(idx);
    }
  });

  return { outliers, indices };
}

/**
 * Calculate Z-score
 */
export function zScore(data: number[]): number[] {
  const avg = mean(data);
  const stdDev = standardDeviation(data);

  if (stdDev === 0) return data.map(() => 0);

  return data.map(val => (val - avg) / stdDev);
}

/**
 * Detect anomalies using Z-score
 */
export function detectAnomaliesZScore(data: number[], threshold = 3): { anomalies: number[]; indices: number[] } {
  const zScores = zScore(data);
  const anomalies: number[] = [];
  const indices: number[] = [];

  zScores.forEach((z, idx) => {
    if (Math.abs(z) > threshold) {
      anomalies.push(data[idx] ?? 0);
      indices.push(idx);
    }
  });

  return { anomalies, indices };
}

/**
 * Calculate seasonal decomposition (simple additive model)
 */
export function seasonalDecomposition(data: number[], period: number): {
  trend: number[];
  seasonal: number[];
  residual: number[];
} {
  // Calculate trend using moving average
  const trend = simpleMovingAverage(data, period);

  // Calculate seasonal component
  const seasonal: number[] = Array(data.length).fill(0);
  const seasonalAverages: number[] = Array(period).fill(0);
  const counts: number[] = Array(period).fill(0);

  data.forEach((val, i) => {
    const trendValue = trend[i];
    if (trendValue !== undefined && !isNaN(trendValue)) {
      const detrended = val - trendValue;
      const seasonalIndex = i % period;
      const currentAvg = seasonalAverages[seasonalIndex];
      const currentCount = counts[seasonalIndex];
      if (currentAvg !== undefined && currentCount !== undefined) {
        seasonalAverages[seasonalIndex] = currentAvg + detrended;
        counts[seasonalIndex] = currentCount + 1;
      }
    }
  });

  seasonalAverages.forEach((sum, i) => {
    const count = counts[i];
    if (count !== undefined) {
      seasonalAverages[i] = count > 0 ? sum / count : 0;
    }
  });

  // Assign seasonal values
  data.forEach((_, i) => {
    const seasonalValue = seasonalAverages[i % period];
    seasonal[i] = seasonalValue ?? 0;
  });

  // Calculate residual
  const residual = data.map((val, i) => {
    const trendValue = trend[i];
    const seasonalValue = seasonal[i];
    if (trendValue === undefined || isNaN(trendValue)) return NaN;
    return val - trendValue - (seasonalValue ?? 0);
  });

  return { trend, seasonal, residual };
}

/**
 * Calculate confidence interval
 */
export function confidenceInterval(
  data: number[],
  _confidenceLevel = 0.95
): { lower: number; upper: number; margin: number } {
  const avg = mean(data);
  const stdDev = standardDeviation(data);
  const n = data.length;

  // Using t-distribution critical value (approximated for large n)
  const tValue = 1.96; // for 95% confidence (can be extended to use _confidenceLevel)
  const margin = tValue * (stdDev / Math.sqrt(n));

  return {
    lower: avg - margin,
    upper: avg + margin,
    margin,
  };
}

/**
 * Calculate rate of change
 */
export function rateOfChange(data: number[]): number[] {
  const result: number[] = [NaN];

  for (let i = 1; i < data.length; i++) {
    const prevValue = data[i - 1];
    const currentValue = data[i];
    if (prevValue === undefined || prevValue === 0 || currentValue === undefined) {
      result.push(NaN);
    } else {
      result.push(((currentValue - prevValue) / prevValue) * 100);
    }
  }

  return result;
}

/**
 * Normalize data to 0-1 range
 */
export function normalize(data: number[]): number[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) return data.map(() => 0.5);

  return data.map(val => (val - min) / range);
}

/**
 * Standardize data (Z-score normalization)
 */
export function standardize(data: number[]): number[] {
  return zScore(data);
}
