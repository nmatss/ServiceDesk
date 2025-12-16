'use client';

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from '@heroicons/react/24/outline';
import { CustomMetricsData } from '@/lib/analytics/realtime-engine';

interface CustomMetricsWidgetProps {
  id: string;
  title: string;
  data: CustomMetricsData;
  config: {
    selectedMetrics: string[];
    showTargets: boolean;
    compactView: boolean;
  };
  onUpdate: (updates: any) => void;
}

export function CustomMetricsWidget({
  data = {},
  config
}: CustomMetricsWidgetProps) {
  const metrics = config.selectedMetrics
    .filter(key => data[key])
    .map(key => ({ key, ...data[key] }));

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUpIcon className="w-4 h-4 text-green-500" />;
      case 'down': return <ArrowDownIcon className="w-4 h-4 text-red-500" />;
      default: return <MinusIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatValue = (value: number | undefined, unit?: string): string => {
    if (value === undefined) return 'N/A';
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'currency') return `$${value.toLocaleString()}`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Custom Metrics
      </h3>

      <div className={`grid gap-4 ${
        config.compactView ? 'grid-cols-2' : 'grid-cols-1'
      }`}>
        {metrics.map(metric => (
          <div key={metric.key} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {metric.label}
              </span>
              {metric.trend && getTrendIcon(metric.trend)}
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatValue(metric.value, metric.unit)}
              </span>
              {config.showTargets && metric.target && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  / {formatValue(metric.target, metric.unit)}
                </span>
              )}
            </div>
            {metric.change !== undefined && (
              <div className={`text-sm font-medium ${
                metric.change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}