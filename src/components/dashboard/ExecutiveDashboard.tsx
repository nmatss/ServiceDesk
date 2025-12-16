'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { ChartBarIcon, CogIcon, DocumentChartBarIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';
import { useRealtimeEngine } from '@/lib/hooks/useRealtimeEngine';
import { WidgetLibrary } from './WidgetLibrary';
import { DashboardBuilder } from './DashboardBuilder';
import { exportToPDF, exportToExcel } from '@/lib/dashboard/export-engine';
import { KPISummaryWidget } from './widgets/KPISummaryWidget';
import { SLAPerformanceWidget } from './widgets/SLAPerformanceWidget';
import { AgentPerformanceWidget } from './widgets/AgentPerformanceWidget';
import { TicketVolumeWidget } from './widgets/TicketVolumeWidget';
import { RealtimeAlertsWidget } from './widgets/RealtimeAlertsWidget';
import { CompanyLogoWidget } from './widgets/CompanyLogoWidget';
import { CustomMetricsWidget } from './widgets/CustomMetricsWidget';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { logger } from '@/lib/monitoring/logger';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardConfig {
  layouts: { [key: string]: Layout[] };
  widgets: WidgetConfig[];
  theme: 'light' | 'dark' | 'auto';
  refreshInterval: number;
  autoExport?: {
    enabled: boolean;
    format: 'pdf' | 'excel';
    schedule: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
}

interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  config: any;
  permissions?: string[];
}

interface KPIMetrics {
  tickets_today: number;
  tickets_this_week: number;
  tickets_this_month: number;
  total_tickets: number;
  sla_response_met: number;
  sla_resolution_met: number;
  total_sla_tracked: number;
  avg_response_time: number;
  avg_resolution_time: number;
  fcr_rate: number;
  csat_score: number;
  csat_responses: number;
  active_agents: number;
  open_tickets: number;
  resolved_today: number;
}

const DEFAULT_LAYOUT = [
  { i: 'kpi-summary', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 },
  { i: 'sla-performance', x: 0, y: 3, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'agent-performance', x: 6, y: 3, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'ticket-volume', x: 0, y: 7, w: 8, h: 4, minW: 6, minH: 3 },
  { i: 'realtime-alerts', x: 8, y: 7, w: 4, h: 4, minW: 3, minH: 3 },
];

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'kpi-summary',
    type: 'kpi_summary',
    title: 'KPI Summary',
    config: { showTrends: true, compactMode: false }
  },
  {
    id: 'sla-performance',
    type: 'sla_performance',
    title: 'SLA Performance',
    config: { period: 'month', showTargets: true }
  },
  {
    id: 'agent-performance',
    type: 'agent_performance',
    title: 'Agent Performance',
    config: { period: 'month', showTop: 10 }
  },
  {
    id: 'ticket-volume',
    type: 'volume_trends',
    title: 'Ticket Volume Trends',
    config: { period: 'month', showForecasting: true }
  },
  {
    id: 'realtime-alerts',
    type: 'realtime_alerts',
    title: 'Real-time Alerts',
    config: { maxAlerts: 10, autoRefresh: true }
  }
];

export function ExecutiveDashboard() {
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>({
    layouts: { lg: DEFAULT_LAYOUT },
    widgets: DEFAULT_WIDGETS,
    theme: 'auto',
    refreshInterval: 30000 // 30 seconds
  });

  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false);
  const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Real-time data engine
  const {
    metrics,
    isConnected,
    connectionQuality,
    subscribe,
    unsubscribe
  } = useRealtimeEngine({
    refreshInterval: dashboardConfig.refreshInterval,
    autoReconnect: true
  });

  useEffect(() => {
    // Subscribe to real-time updates for all widget types
    const subscriptions = dashboardConfig.widgets.map(widget => widget.type);
    subscriptions.forEach(type => subscribe(type));

    return () => {
      subscriptions.forEach(type => unsubscribe(type));
    };
  }, [dashboardConfig.widgets, subscribe, unsubscribe]);

  useEffect(() => {
    // Load saved dashboard configuration
    loadDashboardConfig();
  }, []);

  useEffect(() => {
    // Auto-save dashboard configuration
    const timeoutId = setTimeout(() => {
      saveDashboardConfig();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [dashboardConfig]);

  const loadDashboardConfig = async () => {
    try {
      const response = await fetch('/api/dashboard/config');
      if (response.ok) {
        const config = await response.json();
        setDashboardConfig(prev => ({ ...prev, ...config }));
      }
    } catch (error) {
      logger.error('Failed to load dashboard config', error);
    }
  };

  const saveDashboardConfig = async () => {
    try {
      await fetch('/api/dashboard/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dashboardConfig)
      });
      setLastUpdated(new Date());
    } catch (error) {
      logger.error('Failed to save dashboard config', error);
    }
  };

  const handleLayoutChange = (layout: Layout[], layouts: { [key: string]: Layout[] }) => {
    setDashboardConfig(prev => ({
      ...prev,
      layouts
    }));
  };

  const handleBreakpointChange = (breakpoint: string) => {
    setCurrentBreakpoint(breakpoint);
  };

  const addWidget = (widgetConfig: WidgetConfig) => {
    const newLayout = {
      i: widgetConfig.id,
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      minW: 3,
      minH: 2
    };

    setDashboardConfig(prev => ({
      ...prev,
      widgets: [...prev.widgets, widgetConfig],
      layouts: {
        ...prev.layouts,
        [currentBreakpoint]: [...(prev.layouts[currentBreakpoint] || []), newLayout]
      }
    }));
  };

  const removeWidget = (widgetId: string) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId),
      layouts: Object.keys(prev.layouts).reduce((acc, breakpoint) => ({
        ...acc,
        [breakpoint]: prev.layouts[breakpoint].filter(l => l.i !== widgetId)
      }), {})
    }));
  };

  const updateWidget = (widgetId: string, updates: Partial<WidgetConfig>) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map(w =>
        w.id === widgetId ? { ...w, ...updates } : w
      )
    }));
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF({
        title: 'Executive Dashboard Report',
        subtitle: `Generated on ${new Date().toLocaleDateString()}`,
        widgets: dashboardConfig.widgets,
        metrics
      });
    } catch (error) {
      logger.error('Failed to export PDF', error);
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportToExcel({
        title: 'Executive Dashboard Data',
        widgets: dashboardConfig.widgets,
        metrics,
        includeCharts: true
      });
    } catch (error) {
      logger.error('Failed to export Excel', error);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const renderWidget = (widget: WidgetConfig) => {
    const baseProps = {
      key: widget.id,
      id: widget.id,
      title: widget.title,
      config: widget.config,
      onRemove: () => removeWidget(widget.id),
      onUpdate: (updates: any) => updateWidget(widget.id, { config: { ...widget.config, ...updates } }),
      isConnected,
      lastUpdated
    };

    switch (widget.type) {
      case 'kpi_summary':
        return <KPISummaryWidget {...baseProps} metrics={metrics as KPIMetrics} />;

      case 'sla_performance':
        return <SLAPerformanceWidget {...baseProps} data={metrics?.slaData} />;

      case 'agent_performance':
        return <AgentPerformanceWidget {...baseProps} data={metrics?.agentData} />;

      case 'volume_trends':
        return <TicketVolumeWidget {...baseProps} data={metrics?.volumeData} />;

      case 'realtime_alerts':
        return <RealtimeAlertsWidget {...baseProps} alerts={metrics?.alerts} />;

      case 'company_logo':
        return <CompanyLogoWidget {...baseProps} />;

      case 'custom_metrics':
        return <CustomMetricsWidget {...baseProps} data={metrics?.customData} />;

      default:
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Unknown Widget: {widget.type}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Widget type not implemented
            </p>
          </div>
        );
    }
  };

  const connectionStatus = useMemo(() => {
    if (!isConnected) return { color: 'red', text: 'Disconnected' };
    if (connectionQuality === 'excellent') return { color: 'green', text: 'Excellent' };
    if (connectionQuality === 'good') return { color: 'yellow', text: 'Good' };
    return { color: 'orange', text: 'Poor' };
  }, [isConnected, connectionQuality]);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <DocumentChartBarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Executive Dashboard
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full bg-${connectionStatus.color}-500`} />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {connectionStatus.text}
                </span>
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => setIsWidgetLibraryOpen(true)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <ChartBarIcon className="w-4 h-4 mr-2" />
                Add Widget
              </button>

              <button
                onClick={() => setIsBuilderOpen(true)}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <CogIcon className="w-4 h-4 mr-2" />
                Customize
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportPDF}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Export PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                >
                  Export Excel
                </button>
              </div>

              <button
                onClick={toggleFullscreen}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="p-4">
        <ResponsiveGridLayout
          className="layout"
          layouts={dashboardConfig.layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          onLayoutChange={handleLayoutChange}
          onBreakpointChange={handleBreakpointChange}
          isDraggable={true}
          isResizable={true}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          useCSSTransforms={true}
        >
          {dashboardConfig.widgets.map(renderWidget)}
        </ResponsiveGridLayout>
      </div>

      {/* Widget Library Modal */}
      <WidgetLibrary
        isOpen={isWidgetLibraryOpen}
        onClose={() => setIsWidgetLibraryOpen(false)}
        onAddWidget={addWidget}
        existingWidgets={dashboardConfig.widgets}
      />

      {/* Dashboard Builder Modal */}
      <DashboardBuilder
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        config={dashboardConfig}
        onConfigChange={setDashboardConfig}
      />
    </div>
  );
}