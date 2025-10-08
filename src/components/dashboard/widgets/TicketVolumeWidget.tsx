'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import {
  ChartBarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { VolumeData } from '@/lib/analytics/realtime-engine';

interface TicketVolumeWidgetProps {
  id: string;
  title: string;
  data: VolumeData[];
  config: {
    period: 'week' | 'month' | 'quarter';
    showForecasting: boolean;
    showTrendLine: boolean;
    chartType: 'composed' | 'area' | 'bar';
    includeHighPriority: boolean;
  };
  onUpdate: (updates: any) => void;
  isConnected: boolean;
  lastUpdated: Date;
}

export function TicketVolumeWidget({
  data = [],
  config,
  onUpdate,
  isConnected
}: TicketVolumeWidgetProps) {
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('pt-BR', {
        month: 'short',
        day: 'numeric'
      }),
      net_change: item.resolved - item.created,
      backlog_trend: item.created - item.resolved,
      forecasted_created: config.showForecasting ? item.forecasted_created || null : null,
      forecasted_resolved: config.showForecasting ? item.forecasted_resolved || null : null
    }));
  }, [data, config.showForecasting]);

  const metrics = useMemo(() => {
    if (!data.length) return null;

    const totalCreated = data.reduce((sum, item) => sum + item.created, 0);
    const totalResolved = data.reduce((sum, item) => sum + item.resolved, 0);
    const totalHighPriority = data.reduce((sum, item) => sum + item.high_priority, 0);

    const avgDaily = totalCreated / data.length;
    const resolutionRate = totalCreated > 0 ? (totalResolved / totalCreated) * 100 : 0;
    const highPriorityRate = totalCreated > 0 ? (totalHighPriority / totalCreated) * 100 : 0;

    // Calculate trend
    const recentData = data.slice(-7); // Last 7 days
    const olderData = data.slice(-14, -7); // Previous 7 days

    const recentAvg = recentData.reduce((sum, item) => sum + item.created, 0) / recentData.length;
    const olderAvg = olderData.reduce((sum, item) => sum + item.created, 0) / (olderData.length || 1);

    const trend = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    // Forecasting accuracy (if available)
    const forecastAccuracy = data
      .filter(item => item.forecasted_created)
      .reduce((acc, item) => {
        const accuracy = 100 - Math.abs((item.created - (item.forecasted_created || 0)) / item.created) * 100;
        return acc + Math.max(0, accuracy);
      }, 0) / data.filter(item => item.forecasted_created).length || 0;

    return {
      totalCreated,
      totalResolved,
      totalHighPriority,
      avgDaily,
      resolutionRate,
      highPriorityRate,
      trend,
      forecastAccuracy,
      backlog: totalCreated - totalResolved
    };
  }, [data]);

  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };

    switch (config.chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(31 41 55)',
                border: 'none',
                borderRadius: '8px',
                color: 'white'
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="created"
              stackId="1"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.6}
              name="Created"
            />
            <Area
              type="monotone"
              dataKey="resolved"
              stackId="2"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.6}
              name="Resolved"
            />
            {config.includeHighPriority && (
              <Area
                type="monotone"
                dataKey="high_priority"
                stackId="3"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.4}
                name="High Priority"
              />
            )}
            {config.showForecasting && (
              <>
                <Area
                  type="monotone"
                  dataKey="forecasted_created"
                  stroke="#3B82F6"
                  fill="none"
                  strokeDasharray="5 5"
                  name="Forecasted Created"
                />
                <Area
                  type="monotone"
                  dataKey="forecasted_resolved"
                  stroke="#10B981"
                  fill="none"
                  strokeDasharray="5 5"
                  name="Forecasted Resolved"
                />
              </>
            )}
          </AreaChart>
        );

      case 'bar':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(31 41 55)',
                border: 'none',
                borderRadius: '8px',
                color: 'white'
              }}
            />
            <Legend />
            <Bar dataKey="created" fill="#3B82F6" name="Created" />
            <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
            {config.includeHighPriority && (
              <Bar dataKey="high_priority" fill="#EF4444" name="High Priority" />
            )}
            {config.showTrendLine && (
              <Line
                type="monotone"
                dataKey="net_change"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                name="Net Change"
              />
            )}
          </ComposedChart>
        );

      default: // composed
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(31 41 55)',
                border: 'none',
                borderRadius: '8px',
                color: 'white'
              }}
              formatter={(value: any, name: string) => [
                typeof value === 'number' ? value.toFixed(0) : value,
                name
              ]}
            />
            <Legend />
            <Bar dataKey="created" fill="#3B82F6" name="Created" />
            <Bar dataKey="resolved" fill="#10B981" name="Resolved" />
            {config.includeHighPriority && (
              <Bar dataKey="high_priority" fill="#EF4444" name="High Priority" />
            )}
            <Line
              type="monotone"
              dataKey="net_change"
              stroke="#F59E0B"
              strokeWidth={3}
              dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="Net Change"
            />
            {config.showForecasting && (
              <>
                <Line
                  type="monotone"
                  dataKey="forecasted_created"
                  stroke="#3B82F6"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Forecasted Created"
                />
                <Line
                  type="monotone"
                  dataKey="forecasted_resolved"
                  stroke="#10B981"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Forecasted Resolved"
                />
              </>
            )}
            <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
          </ComposedChart>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ticket Volume Trends
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Daily ticket creation and resolution patterns
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={config.period}
            onChange={(e) => onUpdate({ period: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
          </select>

          <select
            value={config.chartType}
            onChange={(e) => onUpdate({ chartType: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="composed">Combined Chart</option>
            <option value="area">Area Chart</option>
            <option value="bar">Bar Chart</option>
          </select>

          <button
            onClick={() => onUpdate({ showForecasting: !config.showForecasting })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              config.showForecasting
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Forecast
          </button>

          <button
            onClick={() => onUpdate({ includeHighPriority: !config.includeHighPriority })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              config.includeHighPriority
                ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            High Priority
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <ChartBarIcon className="w-5 h-5 text-blue-500 mr-1" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Daily Average
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {metrics.avgDaily.toFixed(0)}
            </div>
            <div className={`text-sm font-medium flex items-center justify-center ${
              metrics.trend >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {metrics.trend >= 0 ? (
                <TrendingUpIcon className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDownIcon className="w-4 h-4 mr-1" />
              )}
              {Math.abs(metrics.trend).toFixed(1)}%
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Resolution Rate
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {metrics.resolutionRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {metrics.totalResolved}/{metrics.totalCreated}
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-1" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                High Priority
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {metrics.highPriorityRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {metrics.totalHighPriority} tickets
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Current Backlog
              </span>
            </div>
            <div className={`text-2xl font-bold ${
              metrics.backlog > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {metrics.backlog}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {metrics.backlog > 0 ? 'pending' : 'resolved'}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-80 mb-6">
        {processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {isConnected ? 'Loading volume data...' : 'No data available'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Forecasting Accuracy */}
      {config.showForecasting && metrics && metrics.forecastAccuracy > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center">
            <InformationCircleIcon className="w-5 h-5 text-blue-500 mr-2" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Forecasting Accuracy: {metrics.forecastAccuracy.toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
            Machine learning predictions based on historical patterns and trends
          </p>
        </div>
      )}

      {/* Volume Alerts */}
      {metrics && (
        <div className="space-y-3">
          {metrics.trend > 20 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUpIcon className="w-5 h-5 text-yellow-500 mr-2" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  High Volume Alert
                </span>
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">
                Ticket volume has increased by {metrics.trend.toFixed(1)}% - consider additional resources
              </p>
            </div>
          )}

          {metrics.backlog > 50 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-sm font-medium text-red-800 dark:text-red-200">
                  Backlog Alert
                </span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                Current backlog of {metrics.backlog} tickets requires immediate attention
              </p>
            </div>
          )}

          {metrics.highPriorityRate > 30 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 mr-2" />
                <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  High Priority Volume Alert
                </span>
              </div>
              <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                {metrics.highPriorityRate.toFixed(1)}% of tickets are high priority - review prioritization process
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}