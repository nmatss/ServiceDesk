/**
 * Manager Components
 *
 * Executive-focused components for strategic insights and KPI monitoring.
 * Focus: High-level insights, executive reporting, strategic decision making
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  ChartBarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ClockIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  DocumentChartBarIcon,
  CogIcon,
  CalendarDaysIcon,
  FunnelIcon,
  ArrowTopRightOnSquareIcon,
  CubeTransparentIcon,
  BoltIcon,
  ShieldCheckIcon,
  ChatBubbleBottomCenterTextIcon
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { PersonaType } from '../../../lib/design-system/tokens';

interface ManagerComponentProps {
  className?: string;
  persona?: PersonaType;
}

// Executive dashboard with key metrics
export function ManagerExecutiveDashboard({ className = '', ...props }: ManagerComponentProps) {
  const [timeRange, setTimeRange] = useState('7d');

  const kpiData = [
    {
      title: 'Total Tickets',
      value: '2,847',
      change: '+12.5%',
      trend: 'up',
      icon: DocumentChartBarIcon,
      color: 'blue',
      target: '3,000',
      period: 'vs last week'
    },
    {
      title: 'Avg Resolution Time',
      value: '4.2h',
      change: '-15.3%',
      trend: 'down',
      icon: ClockIcon,
      color: 'green',
      target: '4h',
      period: 'vs last week'
    },
    {
      title: 'Customer Satisfaction',
      value: '94.2%',
      change: '+2.1%',
      trend: 'up',
      icon: CheckCircleIcon,
      color: 'emerald',
      target: '95%',
      period: 'vs last week'
    },
    {
      title: 'SLA Compliance',
      value: '97.8%',
      change: '+0.8%',
      trend: 'up',
      icon: ShieldCheckIcon,
      color: 'purple',
      target: '98%',
      period: 'vs last week'
    },
    {
      title: 'Active Agents',
      value: '24',
      change: '+8.3%',
      trend: 'up',
      icon: UserGroupIcon,
      color: 'amber',
      target: '25',
      period: 'vs last week'
    },
    {
      title: 'Escalations',
      value: '43',
      change: '-23.2%',
      trend: 'down',
      icon: ExclamationTriangleIcon,
      color: 'red',
      target: '< 50',
      period: 'vs last week'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-500 text-blue-50',
      green: 'bg-green-500 text-green-50',
      emerald: 'bg-emerald-500 text-emerald-50',
      purple: 'bg-purple-500 text-purple-50',
      amber: 'bg-amber-500 text-amber-50',
      red: 'bg-red-500 text-red-50'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-persona-primary tracking-wide">
            Executive Dashboard
          </h1>
          <p className="text-persona-secondary mt-2">
            Strategic insights and performance overview
          </p>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="input-persona-manager w-32"
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          <button className="btn-persona-manager">
            <DocumentChartBarIcon className="h-5 w-5 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {kpiData.map((kpi, index) => (
          <div key={index} className="card-persona-manager group hover:shadow-2xl transition-smooth">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${getColorClasses(kpi.color)} group-hover:scale-110 transition-smooth`}>
                <kpi.icon className="h-6 w-6" />
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {kpi.trend === 'up' ? (
                  <ArrowUpIcon className="h-4 w-4" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4" />
                )}
                {kpi.change}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-medium text-persona-secondary uppercase tracking-wider">
                {kpi.title}
              </h3>
              <p className="text-3xl font-bold text-persona-primary">
                {kpi.value}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-persona-muted">{kpi.period}</span>
                <span className="text-persona-secondary">Target: {kpi.target}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Performance analytics charts
export function ManagerPerformanceCharts({ className = '', ...props }: ManagerComponentProps) {
  const ticketVolumeData = [
    { name: 'Mon', tickets: 65, resolved: 58 },
    { name: 'Tue', tickets: 78, resolved: 72 },
    { name: 'Wed', tickets: 92, resolved: 85 },
    { name: 'Thu', tickets: 87, resolved: 91 },
    { name: 'Fri', tickets: 94, resolved: 89 },
    { name: 'Sat', tickets: 45, resolved: 52 },
    { name: 'Sun', tickets: 32, resolved: 38 }
  ];

  const resolutionTimeData = [
    { name: 'Week 1', avgTime: 5.2 },
    { name: 'Week 2', avgTime: 4.8 },
    { name: 'Week 3', avgTime: 4.1 },
    { name: 'Week 4', avgTime: 4.2 }
  ];

  const categoryDistribution = [
    { name: 'Software', value: 35, color: '#3B82F6' },
    { name: 'Hardware', value: 25, color: '#10B981' },
    { name: 'Account', value: 20, color: '#F59E0B' },
    { name: 'Network', value: 12, color: '#EF4444' },
    { name: 'Other', value: 8, color: '#8B5CF6' }
  ];

  const satisfactionTrend = [
    { name: 'Jan', satisfaction: 92.1 },
    { name: 'Feb', satisfaction: 93.2 },
    { name: 'Mar', satisfaction: 91.8 },
    { name: 'Apr', satisfaction: 94.5 },
    { name: 'May', satisfaction: 93.9 },
    { name: 'Jun', satisfaction: 94.2 }
  ];

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* Ticket Volume Chart */}
      <div className="card-persona-manager">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-persona-primary">
            Daily Ticket Volume
          </h3>
          <button className="text-sm text-persona-secondary hover:text-persona-primary transition-smooth">
            <EyeIcon className="h-4 w-4 inline mr-1" />
            View Details
          </button>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ticketVolumeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fill: '#6B7280' }} />
            <YAxis tick={{ fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }}
            />
            <Bar dataKey="tickets" fill="#3B82F6" name="New Tickets" radius={[4, 4, 0, 0]} />
            <Bar dataKey="resolved" fill="#10B981" name="Resolved" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Resolution Time Trend */}
      <div className="card-persona-manager">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-persona-primary">
            Average Resolution Time
          </h3>
          <div className="text-sm text-green-600 font-medium">
            <TrendingDownIcon className="h-4 w-4 inline mr-1" />
            Improving 15.3%
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={resolutionTimeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fill: '#6B7280' }} />
            <YAxis tick={{ fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }}
            />
            <Line
              type="monotone"
              dataKey="avgTime"
              stroke="#F59E0B"
              strokeWidth={3}
              dot={{ fill: '#F59E0B', strokeWidth: 2, r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Distribution */}
      <div className="card-persona-manager">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-persona-primary">
            Ticket Categories
          </h3>
          <button className="text-sm text-persona-secondary hover:text-persona-primary transition-smooth">
            <CogIcon className="h-4 w-4 inline mr-1" />
            Configure
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {categoryDistribution.map((category, index) => (
              <div key={index} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm text-persona-primary font-medium">
                  {category.name}
                </span>
                <span className="text-sm text-persona-secondary">
                  {category.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Satisfaction Trend */}
      <div className="card-persona-manager">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-persona-primary">
            Customer Satisfaction
          </h3>
          <div className="text-sm text-green-600 font-medium">
            <TrendingUpIcon className="h-4 w-4 inline mr-1" />
            94.2% (+2.1%)
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={satisfactionTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fill: '#6B7280' }} />
            <YAxis domain={[88, 96]} tick={{ fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px'
              }}
            />
            <Area
              type="monotone"
              dataKey="satisfaction"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Team performance overview
export function ManagerTeamOverview({ className = '', ...props }: ManagerComponentProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const teamMembers = [
    {
      name: 'Sarah Johnson',
      role: 'Senior Agent',
      avatar: '/avatars/sarah.jpg',
      ticketsResolved: 127,
      avgResolutionTime: '3.2h',
      satisfactionScore: 4.8,
      slaCompliance: 98.5,
      status: 'online',
      trend: 'up'
    },
    {
      name: 'Mike Davis',
      role: 'Agent',
      avatar: '/avatars/mike.jpg',
      ticketsResolved: 98,
      avgResolutionTime: '4.1h',
      satisfactionScore: 4.6,
      slaCompliance: 96.2,
      status: 'online',
      trend: 'up'
    },
    {
      name: 'Emily Chen',
      role: 'Agent',
      avatar: '/avatars/emily.jpg',
      ticketsResolved: 89,
      avgResolutionTime: '4.8h',
      satisfactionScore: 4.4,
      slaCompliance: 94.1,
      status: 'away',
      trend: 'down'
    },
    {
      name: 'David Wilson',
      role: 'Junior Agent',
      avatar: '/avatars/david.jpg',
      ticketsResolved: 67,
      avgResolutionTime: '5.5h',
      satisfactionScore: 4.3,
      slaCompliance: 91.8,
      status: 'online',
      trend: 'up'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-amber-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-persona-primary tracking-wide">
          Team Performance
        </h2>

        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="input-persona-manager w-32"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>

          <button className="btn-persona-manager">
            <UserGroupIcon className="h-5 w-5 mr-2" />
            Manage Team
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {teamMembers.map((member, index) => (
          <div key={index} className="card-persona-manager hover:shadow-xl transition-smooth">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(member.status)} rounded-full border-2 border-white`} />
                </div>

                <div>
                  <h3 className="font-bold text-persona-primary text-lg">
                    {member.name}
                  </h3>
                  <p className="text-persona-secondary font-medium">
                    {member.role}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold text-persona-primary">
                    {member.ticketsResolved}
                  </p>
                  <p className="text-sm text-persona-secondary">
                    Tickets Resolved
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-bold text-persona-primary">
                    {member.avgResolutionTime}
                  </p>
                  <p className="text-sm text-persona-secondary">
                    Avg Resolution
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-2xl font-bold text-persona-primary">
                      {member.satisfactionScore}
                    </p>
                    <div className="flex text-amber-400">
                      {'★'.repeat(Math.floor(member.satisfactionScore))}
                    </div>
                  </div>
                  <p className="text-sm text-persona-secondary">
                    Satisfaction
                  </p>
                </div>

                <div>
                  <p className="text-2xl font-bold text-persona-primary">
                    {member.slaCompliance}%
                  </p>
                  <p className="text-sm text-persona-secondary">
                    SLA Compliance
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  member.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {member.trend === 'up' ? (
                    <TrendingUpIcon className="h-4 w-4" />
                  ) : (
                    <TrendingDownIcon className="h-4 w-4" />
                  )}
                  Performance
                </div>

                <button className="btn-persona-manager">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Strategic insights and recommendations
export function ManagerInsights({ className = '', ...props }: ManagerComponentProps) {
  const insights = [
    {
      type: 'optimization',
      priority: 'high',
      title: 'Reduce Resolution Time',
      description: 'Software category tickets take 23% longer to resolve than average. Consider knowledge base expansion.',
      impact: 'Could reduce avg resolution time by 0.8h',
      action: 'Review knowledge base gaps',
      icon: BoltIcon,
      color: 'amber'
    },
    {
      type: 'resource',
      priority: 'medium',
      title: 'Team Capacity Planning',
      description: 'Current team utilization is at 87%. Consider hiring 2 additional agents for Q4.',
      impact: 'Improve response times by 25%',
      action: 'Plan recruitment',
      icon: UserGroupIcon,
      color: 'blue'
    },
    {
      type: 'quality',
      priority: 'high',
      title: 'Customer Satisfaction Opportunity',
      description: 'Network-related tickets show lower satisfaction scores. Enhanced training recommended.',
      impact: 'Potential 3% satisfaction increase',
      action: 'Schedule training session',
      icon: ChatBubbleBottomCenterTextIcon,
      color: 'green'
    },
    {
      type: 'automation',
      priority: 'low',
      title: 'Automation Opportunity',
      description: '43% of password reset tickets could be automated with self-service portal.',
      impact: 'Save 12h per week',
      action: 'Implement self-service',
      icon: CubeTransparentIcon,
      color: 'purple'
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-amber-200 bg-amber-50';
      case 'low': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getIconColor = (color: string) => {
    const colors = {
      amber: 'text-amber-600',
      blue: 'text-blue-600',
      green: 'text-green-600',
      purple: 'text-purple-600'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-persona-primary tracking-wide">
          Strategic Insights
        </h2>

        <button className="btn-persona-manager">
          <DocumentChartBarIcon className="h-5 w-5 mr-2" />
          Generate Report
        </button>
      </div>

      <div className="grid gap-4">
        {insights.map((insight, index) => (
          <div key={index} className={`border-2 rounded-xl p-6 ${getPriorityColor(insight.priority)} transition-smooth hover:shadow-lg`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <insight.icon className={`h-6 w-6 ${getIconColor(insight.color)}`} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-persona-primary">
                      {insight.title}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                      insight.priority === 'high' ? 'bg-red-200 text-red-800' :
                      insight.priority === 'medium' ? 'bg-amber-200 text-amber-800' :
                      'bg-green-200 text-green-800'
                    }`}>
                      {insight.priority} Priority
                    </span>
                  </div>

                  <p className="text-persona-primary mb-3 leading-relaxed">
                    {insight.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-persona-secondary font-medium">Impact:</span>
                      <p className="text-green-700 font-semibold">{insight.impact}</p>
                    </div>
                    <div>
                      <span className="text-persona-secondary font-medium">Recommended Action:</span>
                      <p className="text-persona-primary font-semibold">{insight.action}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="btn-persona-manager">
                  Take Action
                </button>
                <button className="p-2 text-persona-muted hover:text-persona-primary transition-smooth">
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Export all components
export {
  ManagerExecutiveDashboard,
  ManagerPerformanceCharts,
  ManagerTeamOverview,
  ManagerInsights
};