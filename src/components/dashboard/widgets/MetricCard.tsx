'use client';

import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from '@heroicons/react/24/solid';
import { Widget } from '../Widget';
import { WidgetHeader } from '../WidgetHeader';
import { WidgetBody } from '../WidgetBody';

export interface MetricCardProps {
  id: string;
  title: string;
  value: number | string;
  previousValue?: number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  target?: number;
  format?: 'number' | 'percentage' | 'currency' | 'time';
  isLoading?: boolean;
  onRefresh?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function MetricCard({
  id,
  title,
  value,
  previousValue,
  unit,
  icon,
  trend,
  trendValue,
  target,
  format = 'number',
  isLoading = false,
  onRefresh,
  onRemove,
  className = ''
}: MetricCardProps) {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(val);
      case 'time':
        if (val < 60) return `${val.toFixed(0)}m`;
        const hours = Math.floor(val / 60);
        const minutes = val % 60;
        return `${hours}h ${minutes.toFixed(0)}m`;
      default:
        return val.toLocaleString('pt-BR');
    }
  };

  const calculateTrend = (): { direction: 'up' | 'down' | 'neutral'; value: number } => {
    if (trend && trendValue !== undefined) {
      return { direction: trend, value: trendValue };
    }

    if (previousValue !== undefined && typeof value === 'number') {
      const change = ((value - previousValue) / previousValue) * 100;
      if (Math.abs(change) < 0.1) return { direction: 'neutral', value: 0 };
      return {
        direction: change > 0 ? 'up' : 'down',
        value: Math.abs(change)
      };
    }

    return { direction: 'neutral', value: 0 };
  };

  const trendData = calculateTrend();
  const progress = target && typeof value === 'number' ? (value / target) * 100 : undefined;

  const getTrendColor = () => {
    if (trendData.direction === 'up') return 'text-green-600 dark:text-green-400';
    if (trendData.direction === 'down') return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getTrendIcon = () => {
    if (trendData.direction === 'up') return <ArrowUpIcon className="w-3 h-3" />;
    if (trendData.direction === 'down') return <ArrowDownIcon className="w-3 h-3" />;
    return <MinusIcon className="w-3 h-3" />;
  };

  return (
    <Widget id={id} className={className}>
      <WidgetHeader
        title={title}
        icon={icon}
        onRefresh={onRefresh}
        onRemove={onRemove}
        isLoading={isLoading}
        isDraggable={true}
      />
      <WidgetBody isLoading={isLoading} padding="md">
        <div className="flex flex-col h-full">
          {/* Main Value */}
          <div className="flex items-baseline space-x-2 mb-2">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatValue(value)}
            </div>
            {unit && !['percentage', 'currency', 'time'].includes(format) && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {unit}
              </div>
            )}
          </div>

          {/* Trend Indicator */}
          {trendData.value > 0 && (
            <div className={`flex items-center space-x-1 text-sm font-medium ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>
                {trendData.value.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                vs previous
              </span>
            </div>
          )}

          {/* Progress Bar (if target is set) */}
          {progress !== undefined && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>Progress</span>
                <span className="font-medium">{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress >= 100
                      ? 'bg-green-500'
                      : progress >= 75
                      ? 'bg-blue-500'
                      : progress >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </WidgetBody>
    </Widget>
  );
}
