/**
 * Chart Utilities
 *
 * Common utility functions for chart rendering, data transformation,
 * and export functionality.
 *
 * @module lib/charts/chart-utils
 */

import { format, parseISO, startOfDay, startOfWeek, startOfMonth, endOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  category?: string;
  [key: string]: any;
}

export interface GroupedData {
  [key: string]: number | string | any[];
}

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export function formatNumber(num: number, decimals = 1): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format duration in minutes to human-readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/**
 * Format date for chart labels
 */
export function formatChartDate(date: string | Date, granularity: 'hour' | 'day' | 'week' | 'month' = 'day'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  switch (granularity) {
    case 'hour':
      return format(dateObj, 'HH:mm');
    case 'day':
      return format(dateObj, 'MMM d');
    case 'week':
      return format(dateObj, 'MMM d');
    case 'month':
      return format(dateObj, 'MMM yyyy');
    default:
      return format(dateObj, 'MMM d');
  }
}

/**
 * Group time series data by time period
 */
export function groupByTimePeriod(
  data: Array<{ date: string; value: number; [key: string]: any }>,
  period: 'day' | 'week' | 'month'
): TimeSeriesDataPoint[] {
  const grouped = new Map<string, number>();

  data.forEach(item => {
    const date = parseISO(item.date);
    let key: string;

    switch (period) {
      case 'day':
        key = format(startOfDay(date), 'yyyy-MM-dd');
        break;
      case 'week':
        key = format(startOfWeek(date), 'yyyy-MM-dd');
        break;
      case 'month':
        key = format(startOfMonth(date), 'yyyy-MM-dd');
        break;
      default:
        key = format(startOfDay(date), 'yyyy-MM-dd');
    }

    grouped.set(key, (grouped.get(key) || 0) + item.value);
  });

  return Array.from(grouped.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fill gaps in time series data
 */
export function fillTimeSeriesGaps(
  data: TimeSeriesDataPoint[],
  startDate: Date,
  endDate: Date,
  period: 'day' | 'week' | 'month' = 'day',
  defaultValue = 0
): TimeSeriesDataPoint[] {
  const dataMap = new Map(data.map(d => [d.date, d]));
  let intervals: Date[];

  switch (period) {
    case 'day':
      intervals = eachDayOfInterval({ start: startDate, end: endDate });
      break;
    case 'week':
      intervals = eachWeekOfInterval({ start: startDate, end: endDate });
      break;
    case 'month':
      intervals = eachMonthOfInterval({ start: startDate, end: endDate });
      break;
    default:
      intervals = eachDayOfInterval({ start: startDate, end: endDate });
  }

  return intervals.map(date => {
    const key = format(date, 'yyyy-MM-dd');
    return dataMap.get(key) || { date: key, value: defaultValue };
  });
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(data: number[], window: number): number[] {
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
 * Group data by category
 */
export function groupByCategory<T extends Record<string, any>>(
  data: T[],
  categoryKey: keyof T
): Record<string, T[]> {
  return data.reduce((acc, item) => {
    const category = String(item[categoryKey]);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Calculate percentile
 */
export function calculatePercentile(data: number[], percentile: number): number {
  const sorted = [...data].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower] ?? 0;
  }

  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(data: number[]): number {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length;
  return Math.sqrt(variance);
}

/**
 * Normalize data to 0-1 range
 */
export function normalizeData(data: number[]): number[] {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) return data.map(() => 0.5);

  return data.map(val => (val - min) / range);
}

/**
 * Create histogram bins
 */
export function createHistogramBins(data: number[], binCount: number): Array<{ start: number; end: number; count: number }> {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const binSize = (max - min) / binCount;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * binSize,
    end: min + (i + 1) * binSize,
    count: 0,
  }));

  data.forEach(value => {
    const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
    if (bins[binIndex]) {
      bins[binIndex].count++;
    }
  });

  return bins;
}

/**
 * Aggregate data by multiple dimensions
 */
export function aggregateByDimensions<T extends Record<string, any>>(
  data: T[],
  dimensions: (keyof T)[],
  valueKey: keyof T,
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' = 'sum'
): Array<Record<string, any>> {
  const grouped = new Map<string, T[]>();

  data.forEach(item => {
    const key = dimensions.map(dim => String(item[dim])).join('|');
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  });

  return Array.from(grouped.entries()).map(([key, items]) => {
    const keyParts = key.split('|');
    const result: Record<string, any> = {};

    dimensions.forEach((dim, index) => {
      result[String(dim)] = keyParts[index];
    });

    const values = items.map(item => Number(item[valueKey]));

    switch (aggregation) {
      case 'sum':
        result.value = values.reduce((sum, val) => sum + val, 0);
        break;
      case 'avg':
        result.value = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      case 'count':
        result.value = values.length;
        break;
      case 'min':
        result.value = Math.min(...values);
        break;
      case 'max':
        result.value = Math.max(...values);
        break;
    }

    return result;
  });
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get responsive chart dimensions based on container width
 */
export function getResponsiveDimensions(containerWidth: number): { width: number; height: number } {
  const aspectRatio = 2; // width:height ratio
  const width = Math.min(containerWidth, 1200);
  const height = width / aspectRatio;

  return { width, height };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Lighten or darken a hex color
 */
export function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const adjust = (val: number) => Math.max(0, Math.min(255, val + amount));

  return rgbToHex(adjust(r), adjust(g), adjust(b));
}

/**
 * Generate tick values for axis
 */
export function generateTicks(min: number, max: number, count: number): number[] {
  const range = max - min;
  const step = range / (count - 1);

  return Array.from({ length: count }, (_, i) => min + i * step);
}
