'use client';

import React, { useState } from 'react';
import {
  ChartBarIcon,
  CircleStackIcon,
  TableCellsIcon,
  BellAlertIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/solid';

export interface WidgetType {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'kpi' | 'charts' | 'tables' | 'alerts' | 'custom';
  defaultSize: { w: number; h: number };
  defaultConfig: any;
}

export const WIDGET_TYPES: WidgetType[] = [
  {
    id: 'metric-card',
    type: 'metric_card',
    name: 'Metric Card',
    description: 'Display a single KPI with trend indicator',
    icon: <ChartBarIcon className="w-6 h-6" />,
    category: 'kpi',
    defaultSize: { w: 3, h: 3 },
    defaultConfig: { format: 'number', showTrend: true }
  },
  {
    id: 'kpi-summary',
    type: 'kpi_summary',
    name: 'KPI Summary',
    description: 'Multiple KPIs at a glance',
    icon: <CircleStackIcon className="w-6 h-6" />,
    category: 'kpi',
    defaultSize: { w: 12, h: 3 },
    defaultConfig: { showTrends: true, compactMode: false }
  },
  {
    id: 'chart',
    type: 'chart',
    name: 'Chart',
    description: 'Line, bar, area, or pie chart',
    icon: <ChartBarIcon className="w-6 h-6" />,
    category: 'charts',
    defaultSize: { w: 6, h: 4 },
    defaultConfig: { chartType: 'line', showLegend: true, showGrid: true }
  },
  {
    id: 'gauge',
    type: 'gauge',
    name: 'Gauge',
    description: 'Circular gauge for single metrics',
    icon: <ChartBarIcon className="w-6 h-6" />,
    category: 'kpi',
    defaultSize: { w: 4, h: 4 },
    defaultConfig: { min: 0, max: 100, target: 80 }
  },
  {
    id: 'table',
    type: 'table',
    name: 'Data Table',
    description: 'Tabular data display with sorting and search',
    icon: <TableCellsIcon className="w-6 h-6" />,
    category: 'tables',
    defaultSize: { w: 8, h: 5 },
    defaultConfig: { searchable: true, pageSize: 10 }
  },
  {
    id: 'sla-performance',
    type: 'sla_performance',
    name: 'SLA Performance',
    description: 'SLA compliance tracking',
    icon: <ChartBarIcon className="w-6 h-6" />,
    category: 'charts',
    defaultSize: { w: 6, h: 4 },
    defaultConfig: { period: 'month', showTargets: true }
  },
  {
    id: 'agent-performance',
    type: 'agent_performance',
    name: 'Agent Performance',
    description: 'Team productivity metrics',
    icon: <ChartBarIcon className="w-6 h-6" />,
    category: 'charts',
    defaultSize: { w: 6, h: 4 },
    defaultConfig: { period: 'month', showTop: 10 }
  },
  {
    id: 'ticket-volume',
    type: 'volume_trends',
    name: 'Ticket Volume',
    description: 'Volume trends and forecasting',
    icon: <ChartBarIcon className="w-6 h-6" />,
    category: 'charts',
    defaultSize: { w: 8, h: 4 },
    defaultConfig: { period: 'month', showForecasting: true }
  },
  {
    id: 'realtime-alerts',
    type: 'realtime_alerts',
    name: 'Real-time Alerts',
    description: 'System notifications and alerts',
    icon: <BellAlertIcon className="w-6 h-6" />,
    category: 'alerts',
    defaultSize: { w: 4, h: 4 },
    defaultConfig: { maxAlerts: 10, autoRefresh: true }
  }
];

export interface WidgetPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widgetType: WidgetType) => void;
}

export function WidgetPalette({ isOpen, onClose, onAddWidget }: WidgetPaletteProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', name: 'All Widgets' },
    { id: 'kpi', name: 'KPIs' },
    { id: 'charts', name: 'Charts' },
    { id: 'tables', name: 'Tables' },
    { id: 'alerts', name: 'Alerts' },
    { id: 'custom', name: 'Custom' }
  ];

  const filteredWidgets = WIDGET_TYPES.filter(widget => {
    const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      widget.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const handleAddWidget = (widgetType: WidgetType) => {
    onAddWidget(widgetType);
    onClose();
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
              <DialogPanel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <DialogTitle className="text-lg font-medium text-neutral-900 dark:text-white">
                    Widget Palette
                  </DialogTitle>
                  <button
                    onClick={onClose}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Search */}
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Buscar widgets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>

                {/* Category Tabs */}
                <div className="border-b border-neutral-200 dark:border-neutral-700 mb-6">
                  <nav className="-mb-px flex space-x-4">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          selectedCategory === category.id
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-300'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Widget Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {filteredWidgets.map((widget) => (
                    <button
                      key={widget.id}
                      onClick={() => handleAddWidget(widget)}
                      className="p-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {widget.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
                            {widget.name}
                          </h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            {widget.description}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                            Size: {widget.defaultSize.w}×{widget.defaultSize.h}
                          </p>
                        </div>
                        <PlusCircleIcon className="w-5 h-5 text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>

                {filteredWidgets.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-neutral-500 dark:text-neutral-400">
                      No widgets found matching your criteria
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-200 rounded-md hover:bg-neutral-300 dark:bg-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-500"
                  >
                    Close
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
