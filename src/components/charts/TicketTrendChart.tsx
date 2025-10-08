/**
 * Ticket Trend Chart Component
 *
 * Interactive time-series chart with drill-down capability, time range selection,
 * and export functionality (image/CSV)
 */

'use client';

import { useState, useRef, useMemo } from 'react';
import { logger } from '@/lib/monitoring/logger';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import html2canvas from 'html2canvas';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TicketTrendData {
  date: string;
  created: number;
  resolved: number;
  open: number;
  in_progress: number;
  high_priority: number;
  critical: number;
  avg_resolution_time?: number;
  sla_compliance?: number;
}

export type ChartType = 'line' | 'area' | 'bar';
export type TimeRange = '7d' | '30d' | '90d' | '12m' | 'custom';

export interface TicketTrendChartProps {
  data: TicketTrendData[];
  height?: number;
  showControls?: boolean;
  showExport?: boolean;
  onDrillDown?: (date: string) => void;
  onRangeChange?: (range: TimeRange, customStart?: Date, customEnd?: Date) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function TicketTrendChart({
  data,
  height = 400,
  showControls = true,
  showExport = true,
  onDrillDown,
  onRangeChange,
}: TicketTrendChartProps) {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(['created', 'resolved', 'open'])
  );
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [customDateRange, setCustomDateRange] = useState<{ start?: Date; end?: Date }>({});

  const chartRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // Metric Configuration
  // ============================================================================

  const metricConfig: Record<string, { label: string; color: string; strokeWidth?: number }> = {
    created: { label: 'Created', color: '#3b82f6', strokeWidth: 2 },
    resolved: { label: 'Resolved', color: '#10b981', strokeWidth: 2 },
    open: { label: 'Open', color: '#f59e0b', strokeWidth: 2 },
    in_progress: { label: 'In Progress', color: '#8b5cf6', strokeWidth: 2 },
    high_priority: { label: 'High Priority', color: '#ef4444', strokeWidth: 2 },
    critical: { label: 'Critical', color: '#dc2626', strokeWidth: 3 },
    avg_resolution_time: { label: 'Avg Resolution (hrs)', color: '#06b6d4', strokeWidth: 2 },
    sla_compliance: { label: 'SLA Compliance %', color: '#84cc16', strokeWidth: 2 },
  };

  // ============================================================================
  // Data Processing
  // ============================================================================

  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Apply time range filter
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '12m':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        startDate = customDateRange.start || new Date(0);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    filtered = filtered.filter(item => {
      const itemDate = new Date(item.date);
      const inRange = itemDate >= startDate;

      if (timeRange === 'custom' && customDateRange.end) {
        return inRange && itemDate <= customDateRange.end;
      }

      return inRange;
    });

    return filtered;
  }, [data, timeRange, customDateRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const totals = filteredData.reduce(
      (acc, item) => ({
        created: acc.created + item.created,
        resolved: acc.resolved + item.resolved,
        open: acc.open + item.open,
      }),
      { created: 0, resolved: 0, open: 0 }
    );

    const avgResolutionTime =
      filteredData.reduce((sum, item) => sum + (item.avg_resolution_time || 0), 0) /
      filteredData.filter(item => item.avg_resolution_time).length;

    const avgSLACompliance =
      filteredData.reduce((sum, item) => sum + (item.sla_compliance || 0), 0) /
      filteredData.filter(item => item.sla_compliance).length;

    return {
      ...totals,
      avgResolutionTime: avgResolutionTime || 0,
      avgSLACompliance: avgSLACompliance || 0,
      trend: totals.created > totals.resolved ? 'increasing' : 'decreasing',
    };
  }, [filteredData]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleMetricToggle = (metric: string) => {
    const newMetrics = new Set(selectedMetrics);
    if (newMetrics.has(metric)) {
      newMetrics.delete(metric);
    } else {
      newMetrics.add(metric);
    }
    setSelectedMetrics(newMetrics);
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    if (range !== 'custom') {
      setCustomDateRange({});
    }
    onRangeChange?.(range);
  };

  const handleChartClick = (data: any) => {
    if (data && data.activeLabel && onDrillDown) {
      onDrillDown(data.activeLabel);
    }
  };

  // ============================================================================
  // Export Functions
  // ============================================================================

  const exportToImage = async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      const link = document.createElement('a');
      link.download = `ticket-trends-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      logger.error('Failed to export chart as image', error);
      alert('Failed to export chart. Please try again.');
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', ...Array.from(selectedMetrics).map(m => metricConfig[m]?.label || m)];
    const rows = filteredData.map(item =>
      [
        item.date,
        ...Array.from(selectedMetrics).map(metric => (item as any)[metric] || 0),
      ].join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = `ticket-trends-${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  // ============================================================================
  // Render Chart
  // ============================================================================

  const renderChart = () => {
    const commonProps = {
      data: filteredData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
      onClick: handleChartClick,
    };

    const chartMetrics = Array.from(selectedMetrics).map(metric => {
      const config = metricConfig[metric];
      if (!config) return null;

      const props = {
        key: metric,
        type: 'monotone' as const,
        dataKey: metric,
        stroke: config.color,
        strokeWidth: config.strokeWidth || 2,
        name: config.label,
        dot: filteredData.length <= 31,
      };

      if (chartType === 'line') {
        return <Line {...props} activeDot={{ r: 6 }} />;
      } else if (chartType === 'area') {
        return (
          <Area
            {...props}
            fill={config.color}
            fillOpacity={0.2}
          />
        );
      } else {
        return (
          <Bar
            key={metric}
            dataKey={metric}
            fill={config.color}
            name={config.label}
          />
        );
      }
    });

    const ChartComponent =
      chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart;

    return (
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
          )}
          {chartMetrics}
          {filteredData.length > 30 && (
            <Brush
              dataKey="date"
              height={30}
              stroke="#3b82f6"
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short' });
              }}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  // ============================================================================
  // Render Component
  // ============================================================================

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Ticket Trends</h3>
          <p className="text-sm text-gray-500 mt-1">
            {stats && `${filteredData.length} data points • ${stats.created} created • ${stats.resolved} resolved`}
          </p>
        </div>

        {showExport && (
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={exportToImage}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Export Image
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="mb-6 space-y-4">
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(['7d', '30d', '90d', '12m'] as TimeRange[]).map(range => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === '7d' && 'Last 7 Days'}
                {range === '30d' && 'Last 30 Days'}
                {range === '90d' && 'Last 90 Days'}
                {range === '12m' && 'Last 12 Months'}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="flex gap-4">
            <div className="flex gap-2">
              <span className="text-sm font-medium text-gray-700">Chart Type:</span>
              {(['line', 'area', 'bar'] as ChartType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    chartType === type
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={() => setShowGrid(!showGrid)}
                  className="rounded border-gray-300"
                />
                Grid
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={() => setShowLegend(!showLegend)}
                  className="rounded border-gray-300"
                />
                Legend
              </label>
            </div>
          </div>

          {/* Metric Selector */}
          <div>
            <span className="text-sm font-medium text-gray-700 mb-2 block">Metrics:</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metricConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleMetricToggle(key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    selectedMetrics.has(key)
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={
                    selectedMetrics.has(key)
                      ? { backgroundColor: config.color }
                      : undefined
                  }
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div ref={chartRef} className="mt-4">
        {filteredData.length > 0 ? (
          renderChart()
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No data available for the selected time range
          </div>
        )}
      </div>

      {/* Statistics Footer */}
      {stats && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
          <div>
            <p className="text-xs text-gray-500">Total Created</p>
            <p className="text-lg font-semibold text-gray-900">{stats.created.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Resolved</p>
            <p className="text-lg font-semibold text-green-600">{stats.resolved.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg Resolution Time</p>
            <p className="text-lg font-semibold text-gray-900">
              {stats.avgResolutionTime.toFixed(1)}h
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg SLA Compliance</p>
            <p className="text-lg font-semibold text-blue-600">
              {stats.avgSLACompliance.toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
