/**
 * Chart Theming System
 *
 * Centralized theme configuration for all charts in the application.
 * Provides consistent colors, fonts, and styling across all visualizations.
 *
 * @module lib/charts/chart-themes
 */

export const chartColors = {
  // Primary color palette
  primary: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'],

  // Status colors
  status: {
    open: '#3B82F6',
    in_progress: '#F59E0B',
    resolved: '#10B981',
    closed: '#6B7280',
  },

  // Priority colors
  priority: {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#F97316',
    critical: '#EF4444',
  },

  // SLA compliance colors
  sla: {
    compliant: '#10B981',
    warning: '#F59E0B',
    breached: '#EF4444',
    unknown: '#6B7280',
  },

  // Performance rating colors
  performance: {
    excellent: '#10B981',
    good: '#84CC16',
    fair: '#F59E0B',
    poor: '#EF4444',
  },

  // Sequential color schemes for heatmaps
  sequential: {
    blues: ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB'],
    greens: ['#F0FDF4', '#DCFCE7', '#BBF7D0', '#86EFAC', '#4ADE80', '#22C55E', '#16A34A'],
    reds: ['#FEF2F2', '#FEE2E2', '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626'],
    purples: ['#FAF5FF', '#F3E8FF', '#E9D5FF', '#D8B4FE', '#C084FC', '#A855F7', '#9333EA'],
  },

  // Diverging color schemes
  diverging: {
    redGreen: ['#DC2626', '#F87171', '#FCA5A5', '#F3F4F6', '#86EFAC', '#4ADE80', '#16A34A'],
    blueRed: ['#2563EB', '#60A5FA', '#93C5FD', '#F3F4F6', '#FCA5A5', '#F87171', '#DC2626'],
  },

  // Category color schemes (for categorical data)
  categorical: [
    '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B',
    '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ],

  // Neutral colors
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
};

export const chartFonts = {
  title: {
    family: 'Inter, system-ui, -apple-system, sans-serif',
    size: 16,
    weight: 600,
    color: chartColors.neutral[900],
  },
  subtitle: {
    family: 'Inter, system-ui, -apple-system, sans-serif',
    size: 14,
    weight: 500,
    color: chartColors.neutral[600],
  },
  label: {
    family: 'Inter, system-ui, -apple-system, sans-serif',
    size: 12,
    weight: 400,
    color: chartColors.neutral[700],
  },
  tooltip: {
    family: 'Inter, system-ui, -apple-system, sans-serif',
    size: 13,
    weight: 500,
    color: chartColors.neutral[900],
  },
  axis: {
    family: 'Inter, system-ui, -apple-system, sans-serif',
    size: 11,
    weight: 400,
    color: chartColors.neutral[600],
  },
};

export const chartDimensions = {
  default: {
    width: 800,
    height: 400,
  },
  small: {
    width: 400,
    height: 300,
  },
  large: {
    width: 1200,
    height: 600,
  },
  margin: {
    top: 20,
    right: 30,
    bottom: 40,
    left: 50,
  },
  marginLarge: {
    top: 30,
    right: 50,
    bottom: 60,
    left: 70,
  },
};

export const chartStyles = {
  grid: {
    strokeDasharray: '3,3',
    stroke: chartColors.neutral[200],
    strokeOpacity: 0.5,
  },
  axis: {
    stroke: chartColors.neutral[300],
    strokeWidth: 1,
  },
  tooltip: {
    backgroundColor: chartColors.neutral[900],
    borderRadius: 6,
    padding: 12,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  legend: {
    fontSize: 12,
    fontWeight: 500,
    color: chartColors.neutral[700],
    spacing: 20,
  },
};

/**
 * Get color for a given priority level
 */
export function getPriorityColor(priority: string | number): string {
  if (typeof priority === 'number') {
    const levels = ['low', 'medium', 'high', 'critical'];
    priority = levels[Math.min(priority - 1, 3)] || 'low';
  }
  return chartColors.priority[priority as keyof typeof chartColors.priority] || chartColors.priority.low;
}

/**
 * Get color for a given status
 */
export function getStatusColor(status: string): string {
  const normalized = status.toLowerCase().replace(/[_\s-]/g, '_');
  return chartColors.status[normalized as keyof typeof chartColors.status] || chartColors.neutral[500];
}

/**
 * Get color for SLA compliance
 */
export function getSLAColor(compliance: number): string {
  if (compliance >= 95) return chartColors.sla.compliant;
  if (compliance >= 85) return chartColors.sla.warning;
  return chartColors.sla.breached;
}

/**
 * Get color from sequential palette
 */
export function getSequentialColor(value: number, min: number, max: number, palette: keyof typeof chartColors.sequential = 'blues'): string {
  const colors = chartColors.sequential[palette];
  const normalized = (value - min) / (max - min);
  const index = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
  return colors[index];
}

/**
 * Get categorical color by index
 */
export function getCategoricalColor(index: number): string {
  return chartColors.categorical[index % chartColors.categorical.length];
}

/**
 * Generate gradient for area charts
 */
export function generateGradient(id: string, color: string): { id: string; stops: Array<{ offset: string; color: string; opacity: number }> } {
  return {
    id,
    stops: [
      { offset: '0%', color, opacity: 0.8 },
      { offset: '100%', color, opacity: 0.1 },
    ],
  };
}

/**
 * Recharts theme configuration
 */
export const rechartsTheme = {
  // Default props for common components
  CartesianGrid: {
    strokeDasharray: chartStyles.grid.strokeDasharray,
    stroke: chartStyles.grid.stroke,
    opacity: chartStyles.grid.strokeOpacity,
  },
  XAxis: {
    tick: { fill: chartFonts.axis.color, fontSize: chartFonts.axis.size },
    axisLine: { stroke: chartStyles.axis.stroke },
  },
  YAxis: {
    tick: { fill: chartFonts.axis.color, fontSize: chartFonts.axis.size },
    axisLine: { stroke: chartStyles.axis.stroke },
  },
  Tooltip: {
    contentStyle: {
      backgroundColor: chartColors.neutral[50],
      border: `1px solid ${chartColors.neutral[200]}`,
      borderRadius: chartStyles.tooltip.borderRadius,
      padding: chartStyles.tooltip.padding,
      boxShadow: chartStyles.tooltip.boxShadow,
    },
    labelStyle: {
      color: chartFonts.tooltip.color,
      fontWeight: chartFonts.tooltip.weight,
      fontSize: chartFonts.tooltip.size,
    },
  },
  Legend: {
    iconSize: 12,
    wrapperStyle: {
      fontSize: chartStyles.legend.fontSize,
      fontWeight: chartStyles.legend.fontWeight,
      color: chartStyles.legend.color,
    },
  },
};

export default {
  colors: chartColors,
  fonts: chartFonts,
  dimensions: chartDimensions,
  styles: chartStyles,
  recharts: rechartsTheme,
  getPriorityColor,
  getStatusColor,
  getSLAColor,
  getSequentialColor,
  getCategoricalColor,
  generateGradient,
};
