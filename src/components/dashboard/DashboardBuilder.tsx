'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/monitoring/logger';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild
} from '@headlessui/react';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  Cog6ToothIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { saveDashboardTemplate, loadDashboardTemplate } from '@/lib/dashboard/template-engine';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  config: any;
  onConfigChange: (config: any) => void;
}

interface WidgetTemplate {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  defaultConfig: any;
  defaultSize: { w: number; h: number };
  category: 'kpi' | 'charts' | 'tables' | 'alerts' | 'custom';
}

const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    id: 'kpi-summary',
    type: 'kpi_summary',
    name: 'KPI Summary',
    description: 'Real-time key performance indicators',
    icon: '📊',
    defaultConfig: { showTrends: true, compactMode: false },
    defaultSize: { w: 12, h: 3 },
    category: 'kpi'
  },
  {
    id: 'sla-performance',
    type: 'sla_performance',
    name: 'SLA Performance',
    description: 'Service level agreement tracking',
    icon: '⏱️',
    defaultConfig: { period: 'month', showTargets: true },
    defaultSize: { w: 6, h: 4 },
    category: 'charts'
  },
  {
    id: 'agent-performance',
    type: 'agent_performance',
    name: 'Agent Performance',
    description: 'Team productivity metrics',
    icon: '👥',
    defaultConfig: { period: 'month', showTop: 10, viewType: 'bar' },
    defaultSize: { w: 6, h: 4 },
    category: 'charts'
  },
  {
    id: 'ticket-volume',
    type: 'volume_trends',
    name: 'Ticket Volume',
    description: 'Volume trends and forecasting',
    icon: '📈',
    defaultConfig: { period: 'month', showForecasting: true },
    defaultSize: { w: 8, h: 4 },
    category: 'charts'
  },
  {
    id: 'realtime-alerts',
    type: 'realtime_alerts',
    name: 'Real-time Alerts',
    description: 'System notifications and alerts',
    icon: '🚨',
    defaultConfig: { maxAlerts: 10, autoRefresh: true },
    defaultSize: { w: 4, h: 4 },
    category: 'alerts'
  },
  {
    id: 'category-distribution',
    type: 'category_distribution',
    name: 'Category Distribution',
    description: 'Ticket distribution by category',
    icon: '🥧',
    defaultConfig: { period: 'month', chartType: 'pie' },
    defaultSize: { w: 6, h: 4 },
    category: 'charts'
  },
  {
    id: 'priority-matrix',
    type: 'priority_matrix',
    name: 'Priority Matrix',
    description: 'Priority distribution analysis',
    icon: '🎯',
    defaultConfig: { period: 'month' },
    defaultSize: { w: 6, h: 4 },
    category: 'charts'
  },
  {
    id: 'satisfaction-trends',
    type: 'satisfaction_trends',
    name: 'Satisfaction Trends',
    description: 'Customer satisfaction over time',
    icon: '⭐',
    defaultConfig: { period: 'month', showTargets: true },
    defaultSize: { w: 8, h: 4 },
    category: 'charts'
  },
  {
    id: 'response-time-heatmap',
    type: 'response_time_heatmap',
    name: 'Response Time Heatmap',
    description: 'Response times by hour and day',
    icon: '🗓️',
    defaultConfig: { period: 'month' },
    defaultSize: { w: 8, h: 5 },
    category: 'charts'
  },
  {
    id: 'workflow-sankey',
    type: 'workflow_sankey',
    name: 'Workflow Analysis',
    description: 'Ticket flow visualization',
    icon: '🔄',
    defaultConfig: { period: 'month' },
    defaultSize: { w: 10, h: 5 },
    category: 'charts'
  },
  {
    id: 'agent-network',
    type: 'agent_network',
    name: 'Collaboration Network',
    description: 'Agent collaboration patterns',
    icon: '🕸️',
    defaultConfig: { type: 'collaboration' },
    defaultSize: { w: 8, h: 6 },
    category: 'charts'
  },
  {
    id: 'custom-metrics',
    type: 'custom_metrics',
    name: 'Custom Metrics',
    description: 'Configurable custom metrics',
    icon: '📋',
    defaultConfig: { selectedMetrics: [], showTargets: true },
    defaultSize: { w: 6, h: 4 },
    category: 'custom'
  }
];

export function DashboardBuilder({
  isOpen,
  onClose,
  config,
  onConfigChange
}: DashboardBuilderProps) {
  const [activeTab, setActiveTab] = useState<'layout' | 'widgets' | 'settings' | 'templates'>('layout');
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSavedTemplates();
    }
  }, [isOpen]);

  const loadSavedTemplates = async () => {
    try {
      const templates = await loadDashboardTemplate();
      setSavedTemplates(templates || []);
    } catch (error) {
      logger.error('Failed to load templates', error);
    }
  };

  const handleLayoutChange = (layout: Layout[], layouts: { [key: string]: Layout[] }) => {
    onConfigChange({
      ...config,
      layouts
    });
  };

  const addWidget = (template: WidgetTemplate) => {
    const newWidget = {
      id: `${template.type}-${Date.now()}`,
      type: template.type,
      title: template.name,
      config: { ...template.defaultConfig }
    };

    const newLayout = {
      i: newWidget.id,
      x: 0,
      y: 0,
      w: template.defaultSize.w,
      h: template.defaultSize.h,
      minW: Math.floor(template.defaultSize.w / 2),
      minH: Math.floor(template.defaultSize.h / 2)
    };

    onConfigChange({
      ...config,
      widgets: [...config.widgets, newWidget],
      layouts: {
        ...config.layouts,
        lg: [...(config.layouts.lg || []), newLayout]
      }
    });
  };

  const removeWidget = (widgetId: string) => {
    onConfigChange({
      ...config,
      widgets: config.widgets.filter((w: any) => w.id !== widgetId),
      layouts: Object.keys(config.layouts).reduce((acc, breakpoint) => ({
        ...acc,
        [breakpoint]: config.layouts[breakpoint].filter((l: any) => l.i !== widgetId)
      }), {})
    });
  };

  const duplicateWidget = (widget: any) => {
    const newWidget = {
      ...widget,
      id: `${widget.type}-${Date.now()}`,
      title: `${widget.title} (Copy)`
    };

    const originalLayout = config.layouts.lg?.find((l: any) => l.i === widget.id);
    const newLayout = originalLayout ? {
      ...originalLayout,
      i: newWidget.id,
      x: Math.min(originalLayout.x + originalLayout.w, 12 - originalLayout.w),
      y: originalLayout.y + originalLayout.h
    } : {
      i: newWidget.id,
      x: 0,
      y: 0,
      w: 6,
      h: 4
    };

    onConfigChange({
      ...config,
      widgets: [...config.widgets, newWidget],
      layouts: {
        ...config.layouts,
        lg: [...(config.layouts.lg || []), newLayout]
      }
    });
  };

  const updateWidgetConfig = (widgetId: string, updates: any) => {
    onConfigChange({
      ...config,
      widgets: config.widgets.map((w: any) =>
        w.id === widgetId ? { ...w, ...updates } : w
      )
    });
  };

  const saveTemplate = async () => {
    if (!newTemplateName.trim()) return;

    try {
      await saveDashboardTemplate({
        name: newTemplateName,
        config: config,
        createdAt: new Date().toISOString()
      });

      setNewTemplateName('');
      loadSavedTemplates();
    } catch (error) {
      logger.error('Failed to save template', error);
    }
  };

  const loadTemplate = (template: any) => {
    onConfigChange(template.config);
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `dashboard-config-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedConfig = JSON.parse(e.target?.result as string);
        onConfigChange(importedConfig);
      } catch (error) {
        logger.error('Failed to import config', error);
      }
    };
    reader.readAsText(file);
  };

  const renderLayoutTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Dashboard Layout
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              previewMode
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {previewMode ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            {previewMode ? 'Edit Mode' : 'Preview Mode'}
          </button>
        </div>
      </div>

      {/* Layout Grid */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 min-h-96">
        <ResponsiveGridLayout
          className="layout"
          layouts={config.layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30}
          onLayoutChange={handleLayoutChange}
          isDraggable={!previewMode}
          isResizable={!previewMode}
          margin={[8, 8]}
          containerPadding={[0, 0]}
        >
          {config.widgets.map((widget: any) => (
            <div
              key={widget.id}
              className={`bg-white dark:bg-gray-700 rounded border-2 transition-all ${
                selectedWidget === widget.id
                  ? 'border-blue-500'
                  : 'border-gray-200 dark:border-gray-600'
              }`}
              onClick={() => setSelectedWidget(widget.id)}
            >
              <div className="p-3 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {widget.title}
                  </span>
                  {!previewMode && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateWidget(widget);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Duplicate widget"
                      >
                        <DocumentDuplicateIcon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWidget(widget.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Remove widget"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 bg-gray-100 dark:bg-gray-600 rounded text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center">
                  {widget.type}
                </div>
              </div>
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      {/* Widget Configuration Panel */}
      {selectedWidget && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
            Widget Configuration
          </h4>
          {(() => {
            const widget = config.widgets.find((w: any) => w.id === selectedWidget);
            if (!widget) return null;

            return (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={widget.title}
                    onChange={(e) => updateWidgetConfig(selectedWidget, { title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Dynamic config based on widget type */}
                  {widget.type === 'kpi_summary' && (
                    <>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={widget.config.showTrends}
                          onChange={(e) => updateWidgetConfig(selectedWidget, {
                            config: { ...widget.config, showTrends: e.target.checked }
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Show Trends</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={widget.config.compactMode}
                          onChange={(e) => updateWidgetConfig(selectedWidget, {
                            config: { ...widget.config, compactMode: e.target.checked }
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Compact Mode</span>
                      </label>
                    </>
                  )}

                  {(widget.type === 'sla_performance' || widget.type === 'agent_performance') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Period
                      </label>
                      <select
                        value={widget.config.period}
                        onChange={(e) => updateWidgetConfig(selectedWidget, {
                          config: { ...widget.config, period: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="quarter">Quarter</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );

  const renderWidgetsTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        Widget Library
      </h3>

      {/* Widget Categories */}
      {['kpi', 'charts', 'tables', 'alerts', 'custom'].map(category => (
        <div key={category}>
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 capitalize">
            {category} Widgets
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {WIDGET_TEMPLATES
              .filter(template => template.category === category)
              .map(template => (
                <div
                  key={template.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => addWidget(template)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{template.icon}</span>
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {template.description}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {template.defaultSize.w}×{template.defaultSize.h} grid
                      </p>
                    </div>
                    <PlusIcon className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        Dashboard Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Theme
          </label>
          <select
            value={config.theme}
            onChange={(e) => onConfigChange({ ...config, theme: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Refresh Interval (seconds)
          </label>
          <input
            type="number"
            value={config.refreshInterval / 1000}
            onChange={(e) => onConfigChange({
              ...config,
              refreshInterval: parseInt(e.target.value) * 1000
            })}
            min="5"
            max="300"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Auto Export Settings */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          Auto Export Settings
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={config.autoExport?.enabled || false}
              onChange={(e) => onConfigChange({
                ...config,
                autoExport: { ...config.autoExport, enabled: e.target.checked }
              })}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enable Auto Export</span>
          </label>

          {config.autoExport?.enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Format
                </label>
                <select
                  value={config.autoExport.format}
                  onChange={(e) => onConfigChange({
                    ...config,
                    autoExport: { ...config.autoExport, format: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="pdf">PDF</option>
                  <option value="excel">Excel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Schedule
                </label>
                <select
                  value={config.autoExport.schedule}
                  onChange={(e) => onConfigChange({
                    ...config,
                    autoExport: { ...config.autoExport, schedule: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderTemplatesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Dashboard Templates
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportConfig}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export
          </button>
          <label className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 cursor-pointer">
            <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={importConfig}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Save New Template */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          Save Current Configuration
        </h4>
        <div className="flex items-center space-x-3">
          <input
            type="text"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="Template name..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={saveTemplate}
            disabled={!newTemplateName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Template
          </button>
        </div>
      </div>

      {/* Saved Templates */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          Saved Templates
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedTemplates.map((template, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                    {template.name}
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Created: {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {template.config.widgets?.length || 0} widgets
                  </p>
                </div>
                <button
                  onClick={() => loadTemplate(template)}
                  className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Load
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'layout', name: 'Layout', icon: Cog6ToothIcon },
    { id: 'widgets', name: 'Widgets', icon: PlusIcon },
    { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
    { id: 'templates', name: 'Templates', icon: DocumentDuplicateIcon }
  ];

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
              <DialogPanel className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <DialogTitle className="text-lg font-medium text-gray-900 dark:text-white">
                    Dashboard Builder
                  </DialogTitle>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                  <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === tab.id
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {tab.name}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="max-h-[70vh] overflow-y-auto">
                  {activeTab === 'layout' && renderLayoutTab()}
                  {activeTab === 'widgets' && renderWidgetsTab()}
                  {activeTab === 'settings' && renderSettingsTab()}
                  {activeTab === 'templates' && renderTemplatesTab()}
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Apply Changes
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