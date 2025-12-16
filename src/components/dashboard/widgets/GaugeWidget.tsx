'use client';

import React from 'react';
import { Widget } from '../Widget';
import { WidgetHeader } from '../WidgetHeader';
import { WidgetBody } from '../WidgetBody';

export interface GaugeWidgetProps {
  id: string;
  title: string;
  subtitle?: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  target?: number;
  thresholds?: Array<{ value: number; color: string; label?: string }>;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GaugeWidget({
  id,
  title,
  subtitle,
  value,
  min = 0,
  max = 100,
  unit = '%',
  target,
  thresholds = [
    { value: 0, color: '#EF4444', label: 'Critical' },
    { value: 50, color: '#F59E0B', label: 'Warning' },
    { value: 75, color: '#10B981', label: 'Good' }
  ],
  isLoading = false,
  error = null,
  onRefresh,
  onConfigure,
  onRemove,
  size = 'md',
  className = ''
}: GaugeWidgetProps) {
  const sizes = {
    sm: { width: 120, height: 120, strokeWidth: 8 },
    md: { width: 180, height: 180, strokeWidth: 12 },
    lg: { width: 240, height: 240, strokeWidth: 16 }
  };

  const { width, height, strokeWidth } = sizes[size];
  const radius = (width / 2) - (strokeWidth / 2) - 5;
  const circumference = 2 * Math.PI * radius;
  const percentage = ((value - min) / (max - min)) * 100;
  const offset = circumference - (percentage / 100) * circumference;

  const getCurrentColor = () => {
    const sortedThresholds = [...thresholds].sort((a, b) => b.value - a.value);
    for (const threshold of sortedThresholds) {
      if (value >= threshold.value) {
        return threshold.color;
      }
    }
    return thresholds[0]?.color || '#3B82F6';
  };

  const getCurrentLabel = () => {
    const sortedThresholds = [...thresholds].sort((a, b) => b.value - a.value);
    for (const threshold of sortedThresholds) {
      if (value >= threshold.value) {
        return threshold.label;
      }
    }
    return thresholds[0]?.label || '';
  };

  return (
    <Widget id={id} className={className}>
      <WidgetHeader
        title={title}
        subtitle={subtitle}
        onRefresh={onRefresh}
        onConfigure={onConfigure}
        onRemove={onRemove}
        isLoading={isLoading}
        isDraggable={true}
      />
      <WidgetBody
        isLoading={isLoading}
        error={error}
        padding="md"
      >
        <div className="flex flex-col items-center justify-center">
          {/* Gauge SVG */}
          <div className="relative" style={{ width, height }}>
            <svg width={width} height={height} className="transform -rotate-90">
              {/* Background Circle */}
              <circle
                cx={width / 2}
                cy={height / 2}
                r={radius}
                fill="none"
                stroke="#E5E7EB"
                strokeWidth={strokeWidth}
                className="dark:stroke-gray-700"
              />

              {/* Progress Circle */}
              <circle
                cx={width / 2}
                cy={height / 2}
                r={radius}
                fill="none"
                stroke={getCurrentColor()}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />

              {/* Target Indicator */}
              {target !== undefined && (
                <circle
                  cx={width / 2}
                  cy={height / 2}
                  r={radius + 3}
                  fill="none"
                  stroke="#6B7280"
                  strokeWidth={2}
                  strokeDasharray={`${(target / max) * circumference} ${circumference}`}
                  strokeLinecap="round"
                  className="opacity-50"
                />
              )}
            </svg>

            {/* Center Value */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {value.toFixed(0)}
                <span className="text-lg text-gray-500 dark:text-gray-400 ml-1">
                  {unit}
                </span>
              </div>
              {getCurrentLabel() && (
                <div className="text-sm font-medium mt-1" style={{ color: getCurrentColor() }}>
                  {getCurrentLabel()}
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 w-full">
            <div className="flex items-center justify-center space-x-4 text-xs">
              <div className="flex items-center space-x-1">
                <span className="text-gray-500 dark:text-gray-400">Min:</span>
                <span className="font-medium text-gray-900 dark:text-white">{min}</span>
              </div>
              {target !== undefined && (
                <div className="flex items-center space-x-1">
                  <span className="text-gray-500 dark:text-gray-400">Target:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{target}</span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <span className="text-gray-500 dark:text-gray-400">Max:</span>
                <span className="font-medium text-gray-900 dark:text-white">{max}</span>
              </div>
            </div>

            {/* Threshold Labels */}
            <div className="mt-3 flex items-center justify-center space-x-3">
              {thresholds.map((threshold, index) => (
                <div key={index} className="flex items-center space-x-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: threshold.color }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {threshold.label || `≥${threshold.value}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WidgetBody>
    </Widget>
  );
}
