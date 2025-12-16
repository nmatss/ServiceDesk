'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Widget } from '../Widget';
import { WidgetHeader } from '../WidgetHeader';
import { WidgetBody } from '../WidgetBody';

export type ChartType = 'line' | 'bar' | 'area' | 'pie';

export interface ChartWidgetProps {
  id: string;
  title: string;
  subtitle?: string;
  data: any[];
  chartType?: ChartType;
  dataKeys?: string[];
  xAxisKey?: string;
  colors?: string[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onConfigure?: () => void;
  onRemove?: () => void;
  onExpand?: () => void;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  className?: string;
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export function ChartWidget({
  id,
  title,
  subtitle,
  data,
  chartType = 'line',
  dataKeys = [],
  xAxisKey = 'date',
  colors = DEFAULT_COLORS,
  isLoading = false,
  error = null,
  onRefresh,
  onConfigure,
  onRemove,
  onExpand,
  height = 300,
  showLegend = true,
  showGrid = true,
  className = ''
}: ChartWidgetProps) {
  const [activeChartType, setActiveChartType] = useState<ChartType>(chartType);

  const chartTypeActions = [
    {
      label: 'Line Chart',
      onClick: () => setActiveChartType('line'),
      variant: 'default' as const
    },
    {
      label: 'Bar Chart',
      onClick: () => setActiveChartType('bar'),
      variant: 'default' as const
    },
    {
      label: 'Area Chart',
      onClick: () => setActiveChartType('area'),
      variant: 'default' as const
    },
    {
      label: 'Pie Chart',
      onClick: () => setActiveChartType('pie'),
      variant: 'default' as const
    }
  ];

  const renderChart = () => {
    if (!data || data.length === 0) {
      return null;
    }

    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (activeChartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart {...commonProps}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />}
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #E5E7EB',
                  borderRadius: '0.375rem'
                }}
              />
              {showLegend && <Legend />}
              {dataKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart {...commonProps}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />}
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #E5E7EB',
                  borderRadius: '0.375rem'
                }}
              />
              {showLegend && <Legend />}
              {dataKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[index % colors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart {...commonProps}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />}
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #E5E7EB',
                  borderRadius: '0.375rem'
                }}
              />
              {showLegend && <Legend />}
              {dataKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                dataKey={dataKeys[0] || 'value'}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={Math.min(height / 3, 80)}
                label
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #E5E7EB',
                  borderRadius: '0.375rem'
                }}
              />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Widget id={id} className={className}>
      <WidgetHeader
        title={title}
        subtitle={subtitle}
        onRefresh={onRefresh}
        onConfigure={onConfigure}
        onRemove={onRemove}
        onExpand={onExpand}
        isLoading={isLoading}
        isDraggable={true}
        actions={chartTypeActions}
      />
      <WidgetBody
        isLoading={isLoading}
        error={error}
        isEmpty={!data || data.length === 0}
        emptyMessage="No chart data available"
        padding="md"
      >
        {renderChart()}
      </WidgetBody>
    </Widget>
  );
}
