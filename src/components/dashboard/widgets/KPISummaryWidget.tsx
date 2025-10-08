'use client';

import React from 'react';
import {
  TicketIcon,
  ClockIcon,
  ChartBarIcon,
  StarIcon,
  UsersIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { KPISummaryData } from '@/lib/analytics/realtime-engine';

interface KPISummaryWidgetProps {
  id: string;
  title: string;
  metrics: KPISummaryData;
  config: {
    showTrends: boolean;
    compactMode: boolean;
  };
  onRemove: () => void;
  onUpdate: (updates: any) => void;
  isConnected: boolean;
  lastUpdated: Date;
}

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ComponentType<any>;
  color: string;
  subtitle?: string;
  target?: number;
  unit?: string;
  compact?: boolean;
}

function KPICard({ title, value, change, icon: Icon, color, subtitle, target, unit, compact }: KPICardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (unit === 'percentage') return `${val.toFixed(1)}%`;
      if (unit === 'time') {
        if (val < 60) return `${val.toFixed(0)}min`;
        const hours = Math.floor(val / 60);
        const mins = val % 60;
        return `${hours}h ${mins.toFixed(0)}m`;
      }
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toString();
    }
    return val;
  };

  const getTrendIcon = () => {
    if (change === undefined) return null;
    if (change > 0) return <ArrowUpIcon className="w-4 h-4 text-green-500" />;
    if (change < 0) return <ArrowDownIcon className="w-4 h-4 text-red-500" />;
    return <div className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (change === undefined) return '';
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const getProgressPercentage = () => {
    if (!target || typeof value !== 'number') return null;
    return Math.min((value / target) * 100, 100);
  };

  const progressPercentage = getProgressPercentage();

  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700
      ${compact ? 'p-3' : 'p-4'} transition-all duration-200 hover:shadow-md
    `}>
      <div className="flex items-center justify-between">
        <div className={`flex items-center space-x-${compact ? '2' : '3'}`}>
          <div className={`
            p-${compact ? '2' : '3'} rounded-lg bg-${color}-100 dark:bg-${color}-900/20
          `}>
            <Icon className={`w-${compact ? '5' : '6'} h-${compact ? '5' : '6'} text-${color}-600 dark:text-${color}-400`} />
          </div>
          <div>
            <p className={`text-${compact ? 'sm' : 'base'} font-medium text-gray-900 dark:text-white`}>
              {title}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>
        </div>
        {change !== undefined && (
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {Math.abs(change).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className={`mt-${compact ? '2' : '3'}`}>
        <div className="flex items-baseline space-x-2">
          <span className={`text-${compact ? '2xl' : '3xl'} font-bold text-gray-900 dark:text-white`}>
            {formatValue(value)}
          </span>
          {target && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              / {formatValue(target)}
            </span>
          )}
        </div>

        {progressPercentage !== null && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Progress</span>
              <span>{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full bg-${color}-500 transition-all duration-300`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function KPISummaryWidget({
  metrics,
  config,
  onUpdate,
  isConnected,
  lastUpdated
}: KPISummaryWidgetProps) {
  const kpis = [
    {
      title: 'Tickets Today',
      value: metrics?.tickets_today || 0,
      change: metrics?.trends?.tickets_change,
      icon: TicketIcon,
      color: 'blue',
      subtitle: 'Created today'
    },
    {
      title: 'Open Tickets',
      value: metrics?.open_tickets || 0,
      icon: ExclamationTriangleIcon,
      color: 'orange',
      subtitle: 'Pending resolution'
    },
    {
      title: 'SLA Compliance',
      value: metrics?.total_sla_tracked ?
        ((metrics.sla_response_met / metrics.total_sla_tracked) * 100) : 0,
      change: metrics?.trends?.sla_change,
      icon: CheckCircleIcon,
      color: 'green',
      unit: 'percentage',
      target: 95,
      subtitle: 'Response SLA'
    },
    {
      title: 'Avg Response Time',
      value: metrics?.avg_response_time || 0,
      change: metrics?.trends?.response_time_change,
      icon: ClockIcon,
      color: 'purple',
      unit: 'time',
      target: 60,
      subtitle: 'Minutes'
    },
    {
      title: 'Customer Satisfaction',
      value: metrics?.csat_score || 0,
      change: metrics?.trends?.satisfaction_change,
      icon: StarIcon,
      color: 'yellow',
      subtitle: `${metrics?.csat_responses || 0} responses`,
      target: 4.5
    },
    {
      title: 'Active Agents',
      value: metrics?.active_agents || 0,
      icon: UsersIcon,
      color: 'indigo',
      subtitle: 'Currently assigned'
    },
    {
      title: 'First Call Resolution',
      value: metrics?.fcr_rate || 0,
      icon: ChartBarIcon,
      color: 'teal',
      unit: 'percentage',
      target: 70,
      subtitle: 'FCR Rate'
    },
    {
      title: 'Resolved Today',
      value: metrics?.resolved_today || 0,
      icon: CheckCircleIcon,
      color: 'green',
      subtitle: 'Completed tickets'
    }
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            KPI Summary
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time performance metrics
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs font-medium">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          <button
            onClick={() => onUpdate({ showTrends: !config.showTrends })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              config.showTrends
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Trends
          </button>

          <button
            onClick={() => onUpdate({ compactMode: !config.compactMode })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              config.compactMode
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            Compact
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={`grid gap-4 ${
        config.compactMode
          ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-4'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      }`}>
        {kpis.map((kpi, index) => (
          <KPICard
            key={index}
            title={kpi.title}
            value={kpi.value}
            change={config.showTrends ? kpi.change : undefined}
            icon={kpi.icon}
            color={kpi.color}
            subtitle={kpi.subtitle}
            target={kpi.target}
            unit={kpi.unit}
            compact={config.compactMode}
          />
        ))}
      </div>

      {/* Summary Stats */}
      {!config.compactMode && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Volume Summary
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">This Week:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metrics?.tickets_this_week || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">This Month:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metrics?.tickets_this_month || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {metrics?.total_tickets || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              SLA Performance
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Response SLA:</span>
                <span className="font-medium text-green-600">
                  {metrics?.total_sla_tracked ?
                    ((metrics.sla_response_met / metrics.total_sla_tracked) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Resolution SLA:</span>
                <span className="font-medium text-green-600">
                  {metrics?.total_sla_tracked ?
                    ((metrics.sla_resolution_met / metrics.total_sla_tracked) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              System Health
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Connection:</span>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {isConnected ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Last Update:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}