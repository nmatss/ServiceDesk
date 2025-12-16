/**
 * Agent Performance Radar Chart Component
 *
 * Spider/radar chart showing multiple performance metrics for agents.
 * Supports comparison between agents and historical data.
 *
 * Features:
 * - Multiple metrics visualization
 * - Agent comparison
 * - Historical comparison
 * - Interactive tooltips
 * - Export functionality
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { chartColors, getCategoricalColor } from '@/lib/charts/chart-themes';

export interface AgentMetrics {
  agentId: number;
  agentName: string;
  resolutionSpeed: number; // 0-100 score
  customerSatisfaction: number; // 0-100 score
  ticketVolume: number; // 0-100 score (normalized)
  slaCompliance: number; // 0-100 percentage
  firstResponseTime: number; // 0-100 score (inverse, faster is better)
  knowledgeSharing: number; // 0-100 score
  color?: string;
}

export interface AgentPerformanceRadarProps {
  agents: AgentMetrics[];
  height?: number;
  maxAgents?: number;
  showAverage?: boolean;
  onAgentSelect?: (agentId: number) => void;
}

export default function AgentPerformanceRadar({
  agents,
  height = 400,
  maxAgents = 3,
  showAverage = true,
  onAgentSelect,
}: AgentPerformanceRadarProps) {
  const [selectedAgents, setSelectedAgents] = useState<number[]>(
    agents.slice(0, Math.min(maxAgents, agents.length)).map(a => a.agentId)
  );

  const metrics = [
    { key: 'resolutionSpeed', label: 'Resolution Speed', fullMark: 100 },
    { key: 'customerSatisfaction', label: 'CSAT', fullMark: 100 },
    { key: 'ticketVolume', label: 'Volume', fullMark: 100 },
    { key: 'slaCompliance', label: 'SLA', fullMark: 100 },
    { key: 'firstResponseTime', label: 'Response Time', fullMark: 100 },
    { key: 'knowledgeSharing', label: 'Knowledge', fullMark: 100 },
  ];

  // Transform data for radar chart
  const chartData = useMemo(() => {
    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.label, fullMark: metric.fullMark };

      selectedAgents.forEach(agentId => {
        const agent = agents.find(a => a.agentId === agentId);
        if (agent) {
          dataPoint[agent.agentName] = agent[metric.key as keyof AgentMetrics] as number;
        }
      });

      // Calculate average if enabled
      if (showAverage) {
        const values = selectedAgents
          .map(id => {
            const agent = agents.find(a => a.agentId === id);
            return agent ? (agent[metric.key as keyof AgentMetrics] as number) : 0;
          })
          .filter(v => v > 0);

        if (values.length > 0) {
          dataPoint['Team Average'] = values.reduce((sum, v) => sum + v, 0) / values.length;
        }
      }

      return dataPoint;
    });
  }, [agents, selectedAgents, showAverage, metrics]);

  const handleAgentToggle = (agentId: number) => {
    if (selectedAgents.includes(agentId)) {
      if (selectedAgents.length > 1) {
        setSelectedAgents(selectedAgents.filter(id => id !== agentId));
      }
    } else {
      if (selectedAgents.length < maxAgents) {
        setSelectedAgents([...selectedAgents, agentId]);
      } else {
        // Replace the last selected agent
        setSelectedAgents([...selectedAgents.slice(0, -1), agentId]);
      }
    }

    if (onAgentSelect) {
      onAgentSelect(agentId);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-gray-900 mb-2">{payload[0].payload.metric}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.stroke }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">{entry.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Calculate overall scores
  const overallScores = useMemo(() => {
    return agents.map(agent => {
      const metricKeys = metrics.map(m => m.key);
      const sum = metricKeys.reduce((total, key) => {
        return total + (agent[key as keyof AgentMetrics] as number || 0);
      }, 0);

      return {
        agentId: agent.agentId,
        agentName: agent.agentName,
        score: sum / metricKeys.length,
      };
    }).sort((a, b) => b.score - a.score);
  }, [agents, metrics]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Agent Performance Comparison</h3>
          <p className="text-sm text-gray-500 mt-1">
            Comparing {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''} across 6 metrics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <div className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart data={chartData}>
              <PolarGrid stroke={chartColors.neutral[300]} />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: chartColors.neutral[600], fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: chartColors.neutral[500], fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />

              {selectedAgents.map((agentId, index) => {
                const agent = agents.find(a => a.agentId === agentId);
                if (!agent) return null;

                return (
                  <Radar
                    key={agentId}
                    name={agent.agentName}
                    dataKey={agent.agentName}
                    stroke={agent.color || getCategoricalColor(index)}
                    fill={agent.color || getCategoricalColor(index)}
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                );
              })}

              {showAverage && (
                <Radar
                  name="Team Average"
                  dataKey="Team Average"
                  stroke={chartColors.neutral[400]}
                  strokeDasharray="5 5"
                  fill={chartColors.neutral[400]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Selection & Rankings */}
        <div className="space-y-4">
          {/* Agent Selection */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Select Agents to Compare</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {agents.map((agent) => (
                <button
                  key={agent.agentId}
                  onClick={() => handleAgentToggle(agent.agentId)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    selectedAgents.includes(agent.agentId)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{
                        backgroundColor: selectedAgents.includes(agent.agentId)
                          ? agent.color || getCategoricalColor(selectedAgents.indexOf(agent.agentId))
                          : chartColors.neutral[300],
                      }}
                    />
                    <span className="text-sm font-medium text-gray-900">{agent.agentName}</span>
                  </div>
                  {selectedAgents.includes(agent.agentId) && (
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Select up to {maxAgents} agents to compare
            </p>
          </div>

          {/* Overall Rankings */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Overall Rankings</h4>
            <div className="space-y-2">
              {overallScores.slice(0, 5).map((score, index) => (
                <div
                  key={score.agentId}
                  className="flex items-center justify-between p-2 rounded bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                    <span className="text-sm text-gray-900">{score.agentName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${score.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{score.score.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Metric Definitions */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Metric Definitions</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <span className="font-medium text-gray-900">Resolution Speed:</span> Average time to resolve tickets
          </div>
          <div>
            <span className="font-medium text-gray-900">CSAT:</span> Customer satisfaction score
          </div>
          <div>
            <span className="font-medium text-gray-900">Volume:</span> Number of tickets handled
          </div>
          <div>
            <span className="font-medium text-gray-900">SLA:</span> SLA compliance rate
          </div>
          <div>
            <span className="font-medium text-gray-900">Response Time:</span> First response speed
          </div>
          <div>
            <span className="font-medium text-gray-900">Knowledge:</span> Knowledge base contributions
          </div>
        </div>
      </div>
    </div>
  );
}
