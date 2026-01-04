'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { ClockIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { SLAPerformanceData } from '@/lib/analytics/realtime-engine';

interface SLAPerformanceWidgetProps {
  id: string;
  title: string;
  data: SLAPerformanceData[];
  config: {
    period: 'week' | 'month' | 'quarter';
    showTargets: boolean;
    chartType: 'line' | 'area' | 'bar';
  };
  onUpdate: (updates: any) => void;
  isConnected: boolean;
  lastUpdated: Date;
}

export function SLAPerformanceWidget({
  data = [],
  config,
  onUpdate,
  isConnected
}: SLAPerformanceWidgetProps) {
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      date: new Date(item.date).toLocaleDateString('pt-BR', {
        month: 'short',
        day: 'numeric'
      }),
      response_target: 95,
      resolution_target: 90
    }));
  }, [data]);

  const currentMetrics = useMemo(() => {
    if (!data.length) return null;

    const latest = data[data.length - 1];
    const previous = data[data.length - 2];

    if (!latest) return null;

    // Safe division helper to avoid NaN
    const safePercentChange = (current: number | undefined, prev: number | undefined): number => {
      const curr = current ?? 0;
      const p = prev ?? 0;
      if (p === 0) return curr > 0 ? 100 : 0;
      return ((curr - p) / p) * 100;
    };

    return {
      responseRate: latest.response_sla_rate ?? 0,
      resolutionRate: latest.resolution_sla_rate ?? 0,
      avgResponseTime: latest.avg_response_time ?? 0,
      avgResolutionTime: latest.avg_resolution_time ?? 0,
      responseChange: previous ? safePercentChange(latest.response_sla_rate, previous.response_sla_rate) : 0,
      resolutionChange: previous ? safePercentChange(latest.resolution_sla_rate, previous.resolution_sla_rate) : 0
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
              className="text-description"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              className="text-description"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(31 41 55)',
                border: 'none',
                borderRadius: '8px',
                color: 'white'
              }}
              formatter={(value: any, name: string) => [
                `${value.toFixed(1)}%`,
                name === 'response_sla_rate' ? 'Response SLA' :
                name === 'resolution_sla_rate' ? 'Resolution SLA' : name
              ]}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="response_sla_rate"
              stackId="1"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.6}
              name="Response SLA"
            />
            <Area
              type="monotone"
              dataKey="resolution_sla_rate"
              stackId="2"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.6}
              name="Resolution SLA"
            />
            {config.showTargets && (
              <>
                <Line
                  type="monotone"
                  dataKey="response_target"
                  stroke="#EF4444"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Response Target"
                />
                <Line
                  type="monotone"
                  dataKey="resolution_target"
                  stroke="#F59E0B"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Resolution Target"
                />
              </>
            )}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-description"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              className="text-description"
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
            <Bar dataKey="response_sla_rate" fill="#3B82F6" name="Response SLA" />
            <Bar dataKey="resolution_sla_rate" fill="#10B981" name="Resolution SLA" />
          </BarChart>
        );

      default: // line
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-description"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              className="text-description"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(31 41 55)',
                border: 'none',
                borderRadius: '8px',
                color: 'white'
              }}
              formatter={(value: any, name: string) => [
                `${value.toFixed(1)}%`,
                name === 'response_sla_rate' ? 'Response SLA' :
                name === 'resolution_sla_rate' ? 'Resolution SLA' : name
              ]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="response_sla_rate"
              stroke="#3B82F6"
              strokeWidth={3}
              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="Response SLA"
            />
            <Line
              type="monotone"
              dataKey="resolution_sla_rate"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="Resolution SLA"
            />
            {config.showTargets && (
              <>
                <Line
                  type="monotone"
                  dataKey="response_target"
                  stroke="#EF4444"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Response Target (95%)"
                />
                <Line
                  type="monotone"
                  dataKey="resolution_target"
                  stroke="#F59E0B"
                  strokeDasharray="5 5"
                  dot={false}
                  name="Resolution Target (90%)"
                />
              </>
            )}
          </LineChart>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            SLA Performance
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Service level agreement compliance trends
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
            <option value="line">Line Chart</option>
            <option value="area">Area Chart</option>
            <option value="bar">Bar Chart</option>
          </select>

          <button
            onClick={() => onUpdate({ showTargets: !config.showTargets })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              config.showTargets
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Targets
          </button>
        </div>
      </div>

      {/* Current Metrics */}
      {currentMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircleIcon className="w-5 h-5 text-blue-500 mr-1" />
              <span className="text-sm font-medium text-description">
                Response SLA
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentMetrics.responseRate.toFixed(1)}%
            </div>
            <div className={`text-sm font-medium ${
              currentMetrics.responseChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {currentMetrics.responseChange >= 0 ? '+' : ''}
              {currentMetrics.responseChange.toFixed(1)}%
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-green-500 mr-1" />
              <span className="text-sm font-medium text-description">
                Resolution SLA
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentMetrics.resolutionRate.toFixed(1)}%
            </div>
            <div className={`text-sm font-medium ${
              currentMetrics.resolutionChange >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {currentMetrics.resolutionChange >= 0 ? '+' : ''}
              {currentMetrics.resolutionChange.toFixed(1)}%
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <ClockIcon className="w-5 h-5 text-purple-500 mr-1" />
              <span className="text-sm font-medium text-description">
                Avg Response
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentMetrics.avgResponseTime.toFixed(0)}m
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              minutes
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <ClockIcon className="w-5 h-5 text-orange-500 mr-1" />
              <span className="text-sm font-medium text-description">
                Avg Resolution
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {(currentMetrics.avgResolutionTime / 60).toFixed(1)}h
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              hours
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-80">
        {processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {isConnected ? 'Loading SLA data...' : 'No data available'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SLA Breach Alerts */}
      {currentMetrics && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentMetrics.responseRate < 95 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-sm font-medium text-red-800 dark:text-red-200">
                  Response SLA Below Target
                </span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                Current: {currentMetrics.responseRate.toFixed(1)}% (Target: 95%)
              </p>
            </div>
          )}

          {currentMetrics.resolutionRate < 90 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 mr-2" />
                <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Resolution SLA Below Target
                </span>
              </div>
              <p className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                Current: {currentMetrics.resolutionRate.toFixed(1)}% (Target: 90%)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}