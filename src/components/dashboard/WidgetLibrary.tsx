'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild
} from '@headlessui/react';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface WidgetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widget: any) => void;
  existingWidgets: any[];
}

interface WidgetTemplate {
  id: string;
  type: string;
  name: string;
  description: string;
  longDescription: string;
  icon: string;
  preview: string;
  category: 'kpi' | 'charts' | 'tables' | 'alerts' | 'custom' | 'advanced';
  tags: string[];
  defaultConfig: any;
  defaultSize: { w: number; h: number };
  requiresData?: string[];
  premium?: boolean;
}

const WIDGET_LIBRARY: WidgetTemplate[] = [
  {
    id: 'kpi-summary',
    type: 'kpi_summary',
    name: 'KPI Summary Cards',
    description: 'Real-time key performance indicators with trend indicators',
    longDescription: 'Comprehensive KPI dashboard showing tickets created, SLA compliance, response times, customer satisfaction, and more. Includes trend indicators and target comparisons.',
    icon: '📊',
    preview: '/images/widgets/kpi-summary.png',
    category: 'kpi',
    tags: ['metrics', 'kpi', 'performance', 'real-time'],
    defaultConfig: { showTrends: true, compactMode: false },
    defaultSize: { w: 12, h: 3 },
    requiresData: ['tickets', 'sla_tracking', 'satisfaction_surveys']
  },
  {
    id: 'sla-performance',
    type: 'sla_performance',
    name: 'SLA Performance Chart',
    description: 'Service level agreement tracking and compliance',
    longDescription: 'Track SLA compliance over time with detailed metrics for response and resolution times. Includes breach alerts and target comparison.',
    icon: '⏱️',
    preview: '/images/widgets/sla-performance.png',
    category: 'charts',
    tags: ['sla', 'performance', 'compliance', 'time-series'],
    defaultConfig: { period: 'month', showTargets: true, chartType: 'line' },
    defaultSize: { w: 6, h: 4 },
    requiresData: ['sla_tracking', 'sla_policies']
  },
  {
    id: 'agent-performance',
    type: 'agent_performance',
    name: 'Agent Performance Analysis',
    description: 'Team productivity and efficiency metrics',
    longDescription: 'Comprehensive agent performance dashboard with resolution rates, response times, customer satisfaction scores, and workload analysis.',
    icon: '👥',
    preview: '/images/widgets/agent-performance.png',
    category: 'charts',
    tags: ['agents', 'performance', 'productivity', 'team'],
    defaultConfig: { period: 'month', showTop: 10, viewType: 'bar', sortBy: 'resolution_rate' },
    defaultSize: { w: 6, h: 4 },
    requiresData: ['users', 'tickets', 'satisfaction_surveys']
  },
  {
    id: 'ticket-volume',
    type: 'volume_trends',
    name: 'Ticket Volume Trends',
    description: 'Volume trends with forecasting capabilities',
    longDescription: 'Analyze ticket volume patterns over time with machine learning-powered forecasting, seasonal trend detection, and anomaly alerts.',
    icon: '📈',
    preview: '/images/widgets/ticket-volume.png',
    category: 'charts',
    tags: ['volume', 'trends', 'forecasting', 'analytics'],
    defaultConfig: { period: 'month', showForecasting: true, chartType: 'composed' },
    defaultSize: { w: 8, h: 4 },
    requiresData: ['tickets'],
    premium: true
  },
  {
    id: 'realtime-alerts',
    type: 'realtime_alerts',
    name: 'Real-time Alert Center',
    description: 'System notifications and critical alerts',
    longDescription: 'Monitor critical system events, SLA breaches, high-priority tickets, and system issues in real-time with customizable alert thresholds.',
    icon: '🚨',
    preview: '/images/widgets/realtime-alerts.png',
    category: 'alerts',
    tags: ['alerts', 'real-time', 'notifications', 'monitoring'],
    defaultConfig: { maxAlerts: 10, autoRefresh: true, soundEnabled: false },
    defaultSize: { w: 4, h: 4 },
    requiresData: ['notifications', 'sla_tracking']
  },
  {
    id: 'category-distribution',
    type: 'category_distribution',
    name: 'Category Distribution',
    description: 'Ticket distribution analysis by category',
    longDescription: 'Visualize ticket distribution across different categories with pie charts, bar charts, and trend analysis. Identify category-specific patterns.',
    icon: '🥧',
    preview: '/images/widgets/category-distribution.png',
    category: 'charts',
    tags: ['categories', 'distribution', 'analysis'],
    defaultConfig: { period: 'month', chartType: 'pie', showTrends: true },
    defaultSize: { w: 6, h: 4 },
    requiresData: ['tickets', 'categories']
  },
  {
    id: 'priority-matrix',
    type: 'priority_matrix',
    name: 'Priority Matrix',
    description: 'Priority distribution and urgency analysis',
    longDescription: 'Analyze ticket priority distribution, escalation patterns, and urgency trends with matrix visualization and priority-based metrics.',
    icon: '🎯',
    preview: '/images/widgets/priority-matrix.png',
    category: 'charts',
    tags: ['priority', 'urgency', 'matrix', 'escalation'],
    defaultConfig: { period: 'month', showMatrix: true },
    defaultSize: { w: 6, h: 4 },
    requiresData: ['tickets', 'priorities']
  },
  {
    id: 'satisfaction-trends',
    type: 'satisfaction_trends',
    name: 'Customer Satisfaction',
    description: 'CSAT trends and customer feedback analysis',
    longDescription: 'Track customer satisfaction over time with detailed trend analysis, rating distribution, and feedback sentiment analysis.',
    icon: '⭐',
    preview: '/images/widgets/satisfaction-trends.png',
    category: 'charts',
    tags: ['satisfaction', 'csat', 'feedback', 'trends'],
    defaultConfig: { period: 'month', showTargets: true, includeSentiment: true },
    defaultSize: { w: 8, h: 4 },
    requiresData: ['satisfaction_surveys']
  },
  {
    id: 'response-time-heatmap',
    type: 'response_time_heatmap',
    name: 'Response Time Heatmap',
    description: 'Response times visualized by hour and day',
    longDescription: 'Interactive heatmap showing response time patterns across different hours and days of the week. Identify peak periods and optimization opportunities.',
    icon: '🗓️',
    preview: '/images/widgets/response-time-heatmap.png',
    category: 'advanced',
    tags: ['heatmap', 'response-time', 'patterns', 'schedule'],
    defaultConfig: { period: 'month', granularity: 'hourly' },
    defaultSize: { w: 8, h: 5 },
    requiresData: ['tickets', 'sla_tracking']
  },
  {
    id: 'workflow-sankey',
    type: 'workflow_sankey',
    name: 'Workflow Analysis',
    description: 'Ticket flow visualization with Sankey diagrams',
    longDescription: 'Visualize ticket workflow and status transitions using interactive Sankey diagrams. Identify bottlenecks and process improvements.',
    icon: '🔄',
    preview: '/images/widgets/workflow-sankey.png',
    category: 'advanced',
    tags: ['workflow', 'sankey', 'process', 'flow'],
    defaultConfig: { period: 'month', showTransitions: true },
    defaultSize: { w: 10, h: 5 },
    requiresData: ['tickets', 'statuses'],
    premium: true
  },
  {
    id: 'agent-network',
    type: 'agent_network',
    name: 'Collaboration Network',
    description: 'Agent collaboration and communication patterns',
    longDescription: 'Interactive network graph showing collaboration patterns between team members, escalation paths, and communication flows.',
    icon: '🕸️',
    preview: '/images/widgets/agent-network.png',
    category: 'advanced',
    tags: ['network', 'collaboration', 'team', 'relationships'],
    defaultConfig: { type: 'collaboration', showLabels: true },
    defaultSize: { w: 8, h: 6 },
    requiresData: ['users', 'tickets', 'comments'],
    premium: true
  },
  {
    id: 'custom-metrics',
    type: 'custom_metrics',
    name: 'Custom Metrics',
    description: 'Configurable custom business metrics',
    longDescription: 'Create custom metrics dashboard with configurable KPIs, targets, and calculations. Perfect for specific business requirements.',
    icon: '📋',
    preview: '/images/widgets/custom-metrics.png',
    category: 'custom',
    tags: ['custom', 'metrics', 'configurable', 'business'],
    defaultConfig: { selectedMetrics: [], showTargets: true, compactView: false },
    defaultSize: { w: 6, h: 4 },
    requiresData: ['custom_metrics']
  },
  {
    id: 'knowledge-base-stats',
    type: 'knowledge_base_stats',
    name: 'Knowledge Base Analytics',
    description: 'KB usage, helpfulness, and content metrics',
    longDescription: 'Track knowledge base performance with article views, helpfulness ratings, search analytics, and content gap analysis.',
    icon: '📚',
    preview: '/images/widgets/kb-stats.png',
    category: 'charts',
    tags: ['knowledge-base', 'analytics', 'content', 'usage'],
    defaultConfig: { period: 'month', showTopArticles: true },
    defaultSize: { w: 6, h: 4 },
    requiresData: ['kb_articles', 'kb_analytics']
  },
  {
    id: 'cost-analysis',
    type: 'cost_analysis',
    name: 'Cost Center Analysis',
    description: 'Operational costs and ROI tracking',
    longDescription: 'Analyze operational costs, resource allocation, and ROI metrics with detailed breakdowns by department, agent, and ticket type.',
    icon: '💰',
    preview: '/images/widgets/cost-analysis.png',
    category: 'advanced',
    tags: ['cost', 'roi', 'financial', 'resources'],
    defaultConfig: { period: 'month', currency: 'USD', showBreakdown: true },
    defaultSize: { w: 8, h: 4 },
    requiresData: ['cost_tracking', 'users', 'tickets'],
    premium: true
  },
  {
    id: 'predictive-analytics',
    type: 'predictive_analytics',
    name: 'Predictive Analytics',
    description: 'ML-powered predictions and forecasting',
    longDescription: 'Advanced machine learning analytics including volume forecasting, escalation prediction, and resource planning recommendations.',
    icon: '🔮',
    preview: '/images/widgets/predictive-analytics.png',
    category: 'advanced',
    tags: ['ml', 'prediction', 'forecasting', 'ai'],
    defaultConfig: { model: 'auto', confidence: 95, horizon: 30 },
    defaultSize: { w: 10, h: 5 },
    requiresData: ['tickets', 'users', 'historical_data'],
    premium: true
  }
];

export function WidgetLibrary({
  isOpen,
  onClose,
  onAddWidget,
  existingWidgets
}: WidgetLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedWidget, setSelectedWidget] = useState<WidgetTemplate | null>(null);

  const categories = [
    { id: 'all', name: 'All Widgets', count: WIDGET_LIBRARY.length },
    { id: 'kpi', name: 'KPI & Metrics', count: WIDGET_LIBRARY.filter(w => w.category === 'kpi').length },
    { id: 'charts', name: 'Charts & Graphs', count: WIDGET_LIBRARY.filter(w => w.category === 'charts').length },
    { id: 'tables', name: 'Tables & Lists', count: WIDGET_LIBRARY.filter(w => w.category === 'tables').length },
    { id: 'alerts', name: 'Alerts & Notifications', count: WIDGET_LIBRARY.filter(w => w.category === 'alerts').length },
    { id: 'advanced', name: 'Advanced Analytics', count: WIDGET_LIBRARY.filter(w => w.category === 'advanced').length },
    { id: 'custom', name: 'Custom Widgets', count: WIDGET_LIBRARY.filter(w => w.category === 'custom').length }
  ];

  const filteredWidgets = WIDGET_LIBRARY.filter(widget => {
    const matchesSearch = widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         widget.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         widget.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleAddWidget = (template: WidgetTemplate) => {
    const newWidget = {
      id: `${template.type}-${Date.now()}`,
      type: template.type,
      title: template.name,
      config: { ...template.defaultConfig }
    };

    onAddWidget(newWidget);
  };

  const isWidgetAdded = (templateType: string) => {
    return existingWidgets.some(widget => widget.type === templateType);
  };

  return (
    <Transition appear show={isOpen}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 text-left align-middle shadow-xl transition-all">
                <div className="flex h-[80vh]">
                  {/* Sidebar */}
                  <div className="w-64 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 p-6">
                    <DialogTitle className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-6">
                      Widget Library
                    </DialogTitle>

                    {/* Search */}
                    <div className="relative mb-6">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Buscar widgets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md text-sm bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400"
                      />
                    </div>

                    {/* Categories */}
                    <div className="space-y-1">
                      {categories.map(category => (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            selectedCategory === category.id
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{category.name}</span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              {category.count}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                            {categories.find(c => c.id === selectedCategory)?.name || 'All Widgets'}
                          </h3>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                            {filteredWidgets.length} widgets available
                          </p>
                        </div>
                        <button
                          onClick={onClose}
                          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        >
                          <XMarkIcon className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    {/* Widget Grid */}
                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredWidgets.map(widget => (
                          <div
                            key={widget.id}
                            className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => setSelectedWidget(widget)}
                          >
                            {/* Widget Preview */}
                            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                              <div className="flex items-center space-x-3 mb-3">
                                <span className="text-2xl">{widget.icon}</span>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                      {widget.name}
                                    </h4>
                                    {widget.premium && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                                        Premium
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                                    {widget.description}
                                  </p>
                                </div>
                              </div>

                              {/* Preview Image Placeholder */}
                              <div className="w-full h-24 bg-neutral-100 dark:bg-neutral-700 rounded mb-3 flex items-center justify-center">
                                <span className="text-neutral-400 text-xs">Widget Preview</span>
                              </div>

                              {/* Tags */}
                              <div className="flex flex-wrap gap-1 mb-3">
                                {widget.tags.slice(0, 3).map(tag => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {widget.tags.length > 3 && (
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                    +{widget.tags.length - 3} more
                                  </span>
                                )}
                              </div>

                              {/* Size Info */}
                              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
                                Size: {widget.defaultSize.w}×{widget.defaultSize.h} grid units
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="p-4">
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedWidget(widget);
                                  }}
                                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  <InformationCircleIcon className="w-4 h-4 mr-1" />
                                  Details
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddWidget(widget);
                                  }}
                                  disabled={isWidgetAdded(widget.type)}
                                  className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    isWidgetAdded(widget.type)
                                      ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed dark:bg-neutral-700 dark:text-neutral-400'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  <PlusIcon className="w-4 h-4 mr-1" />
                                  {isWidgetAdded(widget.type) ? 'Added' : 'Add'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {filteredWidgets.length === 0 && (
                        <div className="text-center py-12">
                          <div className="text-neutral-400 text-4xl mb-4">🔍</div>
                          <p className="text-neutral-500 dark:text-neutral-400">
                            No widgets found matching your criteria
                          </p>
                          <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
                            Try adjusting your search or category filter
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Widget Detail Modal */}
                {selectedWidget && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <span className="text-3xl">{selectedWidget.icon}</span>
                            <div>
                              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                                {selectedWidget.name}
                              </h3>
                              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                {selectedWidget.description}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedWidget(null)}
                            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                          >
                            <XMarkIcon className="w-6 h-6" />
                          </button>
                        </div>

                        {/* Detailed Description */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                              Description
                            </h4>
                            <p className="text-sm text-description">
                              {selectedWidget.longDescription}
                            </p>
                          </div>

                          {/* Requirements */}
                          {selectedWidget.requiresData && (
                            <div>
                              <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                                Data Requirements
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {selectedWidget.requiresData.map(req => (
                                  <span
                                    key={req}
                                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                  >
                                    {req}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tags */}
                          <div>
                            <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                              Tags
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedWidget.tags.map(tag => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Configuration Preview */}
                          <div>
                            <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                              Default Configuration
                            </h4>
                            <div className="bg-neutral-50 dark:bg-neutral-700 rounded-md p-3">
                              <pre className="text-xs text-description">
                                {JSON.stringify(selectedWidget.defaultConfig, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex justify-end space-x-3">
                          <button
                            onClick={() => setSelectedWidget(null)}
                            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-200 rounded-md hover:bg-neutral-300 dark:bg-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-500"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => {
                              handleAddWidget(selectedWidget);
                              setSelectedWidget(null);
                            }}
                            disabled={isWidgetAdded(selectedWidget.type)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              isWidgetAdded(selectedWidget.type)
                                ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed dark:bg-neutral-700 dark:text-neutral-400'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {isWidgetAdded(selectedWidget.type) ? 'Already Added' : 'Add Widget'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}