'use client';

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  UserIcon,
  ChartBarIcon,
  StarIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { AgentPerformanceData } from '@/lib/analytics/realtime-engine';

interface AgentPerformanceWidgetProps {
  id: string;
  title: string;
  data: AgentPerformanceData[];
  config: {
    period: 'week' | 'month' | 'quarter';
    showTop: number;
    viewType: 'bar' | 'scatter' | 'radar' | 'table';
    sortBy: 'resolution_rate' | 'efficiency_score' | 'satisfaction' | 'tickets';
  };
  onUpdate: (updates: any) => void;
  isConnected: boolean;
  lastUpdated: Date;
}

interface AgentCardProps {
  agent: AgentPerformanceData;
  rank: number;
  isTopPerformer: boolean;
}

function AgentCard({ agent, rank, isTopPerformer }: AgentCardProps) {
  const getWorkloadColor = () => {
    switch (agent.workload_status) {
      case 'overloaded': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'optimal': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'underutilized': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getEfficiencyColor = () => {
    const score = agent.efficiency_score || 0;
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4
      ${isTopPerformer ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''}
      transition-all duration-200 hover:shadow-md
    `}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center
            ${isTopPerformer ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-gray-100 dark:bg-gray-700'}
          `}>
            {isTopPerformer ? (
              <TrophyIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            ) : (
              <UserIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {agent.name}
              </h4>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                #{rank}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-32">
              {agent.email}
            </p>
          </div>
        </div>

        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getWorkloadColor()}`}>
          {agent.workload_status || 'unknown'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {agent.assigned_tickets}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Assigned</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {agent.resolved_tickets}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Resolved</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Resolution Rate</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {agent.resolution_rate.toFixed(1)}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Efficiency Score</span>
          <span className={`text-sm font-medium ${getEfficiencyColor()}`}>
            {(agent.efficiency_score || 0).toFixed(0)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Avg Response</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {agent.avg_response_time.toFixed(0)}m
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">Satisfaction</span>
          <div className="flex items-center space-x-1">
            <StarIcon className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {(agent.avg_satisfaction || 0).toFixed(1)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({agent.satisfaction_responses})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentPerformanceWidget({
  data = [],
  config,
  onUpdate,
  isConnected
}: AgentPerformanceWidgetProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentPerformanceData | null>(null);

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      switch (config.sortBy) {
        case 'resolution_rate':
          return b.resolution_rate - a.resolution_rate;
        case 'efficiency_score':
          return (b.efficiency_score || 0) - (a.efficiency_score || 0);
        case 'satisfaction':
          return (b.avg_satisfaction || 0) - (a.avg_satisfaction || 0);
        case 'tickets':
          return b.resolved_tickets - a.resolved_tickets;
        default:
          return b.resolution_rate - a.resolution_rate;
      }
    });

    return sorted.slice(0, config.showTop);
  }, [data, config.sortBy, config.showTop]);

  const chartData = useMemo(() => {
    return sortedData.map(agent => ({
      ...agent,
      name: agent.name.split(' ')[0], // First name only for charts
      efficiency: agent.efficiency_score || 0
    }));
  }, [sortedData]);

  const radarData = useMemo(() => {
    if (!selectedAgent) return [];

    return [
      {
        metric: 'Resolution Rate',
        value: selectedAgent.resolution_rate,
        fullMark: 100
      },
      {
        metric: 'Efficiency',
        value: selectedAgent.efficiency_score || 0,
        fullMark: 100
      },
      {
        metric: 'Satisfaction',
        value: (selectedAgent.avg_satisfaction || 0) * 20, // Scale to 100
        fullMark: 100
      },
      {
        metric: 'Response Time',
        value: Math.max(0, 100 - (selectedAgent.avg_response_time / 60) * 10), // Inverse scale
        fullMark: 100
      },
      {
        metric: 'Volume',
        value: Math.min(100, (selectedAgent.resolved_tickets / 50) * 100), // Scale based on 50 as high
        fullMark: 100
      }
    ];
  }, [selectedAgent]);

  const renderChart = () => {
    switch (config.viewType) {
      case 'scatter':
        return (
          <ScatterChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              type="number"
              dataKey="avg_response_time"
              name="Response Time"
              unit="m"
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <YAxis
              type="number"
              dataKey="resolution_rate"
              name="Resolution Rate"
              unit="%"
              tick={{ fontSize: 12 }}
              className="text-gray-600 dark:text-gray-400"
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gray-800 text-white p-3 rounded-lg shadow-lg">
                      <p className="font-medium">{data.name}</p>
                      <p>Resolution Rate: {data.resolution_rate.toFixed(1)}%</p>
                      <p>Response Time: {data.avg_response_time.toFixed(0)}m</p>
                      <p>Satisfaction: {(data.avg_satisfaction || 0).toFixed(1)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter
              dataKey="resolution_rate"
              fill="#3B82F6"
              onClick={(data) => setSelectedAgent(data)}
            />
          </ScatterChart>
        );

      case 'radar':
        return selectedAgent ? (
          <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis
              angle={45}
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
            />
            <Radar
              name={selectedAgent.name}
              dataKey="value"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Tooltip />
          </RadarChart>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">
              Select an agent to view radar chart
            </p>
          </div>
        );

      default: // bar
        return (
          <BarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="name"
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
            <Bar dataKey="resolution_rate" fill="#3B82F6" name="Resolution Rate %" />
            <Bar dataKey="efficiency" fill="#10B981" name="Efficiency Score" />
          </BarChart>
        );
    }
  };

  const topPerformers = useMemo(() => {
    return sortedData.slice(0, 3);
  }, [sortedData]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Agent Performance
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Team productivity and efficiency metrics
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
            value={config.viewType}
            onChange={(e) => onUpdate({ viewType: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="bar">Bar Chart</option>
            <option value="scatter">Scatter Plot</option>
            <option value="radar">Radar Chart</option>
            <option value="table">Table View</option>
          </select>

          <select
            value={config.sortBy}
            onChange={(e) => onUpdate({ sortBy: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="resolution_rate">Resolution Rate</option>
            <option value="efficiency_score">Efficiency</option>
            <option value="satisfaction">Satisfaction</option>
            <option value="tickets">Tickets Resolved</option>
          </select>
        </div>
      </div>

      {config.viewType === 'table' ? (
        /* Table View */
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tickets
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Resolution Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Avg Response
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Satisfaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedData.map((agent, _index) => (
                <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {agent.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {agent.resolved_tickets}/{agent.assigned_tickets}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {agent.resolution_rate.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {agent.avg_response_time.toFixed(0)}m
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <StarIcon className="w-4 h-4 text-yellow-500 mr-1" />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {(agent.avg_satisfaction || 0).toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      agent.workload_status === 'optimal' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                      agent.workload_status === 'overloaded' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {agent.workload_status || 'unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chart */}
          <div className="h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {isConnected ? 'Loading agent data...' : 'No data available'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Top Performers Cards */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              Top Performers
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topPerformers.map((agent, index) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  rank={index + 1}
                  isTopPerformer={index === 0}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}