'use client';

import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/monitoring/logger';
import {
  ExclamationTriangleIcon,
  ClockIcon,
  FireIcon,
  ShieldExclamationIcon,
  BellIcon,
  XMarkIcon,
  ChevronRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { AlertData } from '@/lib/analytics/realtime-engine';

interface RealtimeAlertsWidgetProps {
  id: string;
  title: string;
  alerts: AlertData[];
  config: {
    maxAlerts: number;
    autoRefresh: boolean;
    showDismissed: boolean;
    filterBySeverity: 'all' | 'high' | 'critical';
    soundEnabled: boolean;
  };
  onUpdate: (updates: any) => void;
  isConnected: boolean;
  lastUpdated: Date;
}

interface AlertItemProps {
  alert: AlertData;
  onDismiss: (alertId: string) => void;
  onView: (alert: AlertData) => void;
}

function AlertItem({ alert, onDismiss, onView }: AlertItemProps) {
  const getSeverityColor = () => {
    switch (alert.severity) {
      case 'critical': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'medium': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default: return 'border-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getSeverityIcon = () => {
    switch (alert.type) {
      case 'sla_breach':
        return <ClockIcon className="w-5 h-5" />;
      case 'high_volume':
        return <ExclamationTriangleIcon className="w-5 h-5" />;
      case 'agent_overload':
        return <FireIcon className="w-5 h-5" />;
      case 'system_issue':
        return <ShieldExclamationIcon className="w-5 h-5" />;
      case 'anomaly':
        return <ExclamationTriangleIcon className="w-5 h-5" />;
      default:
        return <BellIcon className="w-5 h-5" />;
    }
  };

  const getSeverityTextColor = () => {
    switch (alert.severity) {
      case 'critical': return 'text-red-600 dark:text-red-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getTimeAgo = () => {
    const now = new Date();
    const alertTime = new Date(alert.timestamp);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className={`border-l-4 ${getSeverityColor()} p-3 mb-3 rounded-r-lg transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className={`${getSeverityTextColor()} mt-0.5`}>
            {getSeverityIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {alert.title}
              </h4>
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                alert.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                alert.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' :
                alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
              }`}>
                {alert.severity}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {alert.description}
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {getTimeAgo()}
              </span>
              <div className="flex items-center space-x-2">
                {alert.affected_tickets && alert.affected_tickets.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {alert.affected_tickets.length} tickets affected
                  </span>
                )}
                {alert.auto_actions && alert.auto_actions.length > 0 && (
                  <span className="inline-flex items-center text-xs text-green-600 dark:text-green-400">
                    <CheckCircleIcon className="w-3 h-3 mr-1" />
                    Auto-resolved
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1 ml-2">
          <button
            onClick={() => onView(alert)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="View details"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
          {alert.dismissible && (
            <button
              onClick={() => onDismiss(alert.id)}
              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Dismiss alert"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RealtimeAlertsWidget({
  alerts = [],
  config,
  onUpdate,
  isConnected
}: RealtimeAlertsWidgetProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<AlertData | null>(null);
  const [lastAlertCount, setLastAlertCount] = useState(0);

  // Sound notification for new alerts
  useEffect(() => {
    if (config.soundEnabled && alerts.length > lastAlertCount) {
      const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
      const highAlerts = alerts.filter(a => a.severity === 'high').length;

      if (criticalAlerts > 0) {
        // Play critical alert sound
        try {
          const audio = new Audio('/sounds/critical-alert.mp3');
          audio.play().catch(() => {}); // Ignore if audio fails
        } catch (error) {
          logger.info('Critical alert sound not available');
        }
      } else if (highAlerts > 0) {
        // Play high priority alert sound
        try {
          const audio = new Audio('/sounds/high-alert.mp3');
          audio.play().catch(() => {});
        } catch (error) {
          logger.info('High alert sound not available');
        }
      }
    }
    setLastAlertCount(alerts.length);
  }, [alerts.length, config.soundEnabled, lastAlertCount]);

  const filteredAlerts = alerts
    .filter(alert => {
      // Filter by severity
      if (config.filterBySeverity !== 'all') {
        if (config.filterBySeverity === 'critical' && alert.severity !== 'critical') return false;
        if (config.filterBySeverity === 'high' && !['critical', 'high'].includes(alert.severity)) return false;
      }

      // Filter dismissed alerts
      if (!config.showDismissed && dismissedAlerts.has(alert.id)) return false;

      return true;
    })
    .slice(0, config.maxAlerts);

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set(prev.add(alertId)));
  };

  const handleViewAlert = (alert: AlertData) => {
    setSelectedAlert(alert);
  };

  const getSeverityCount = (severity: string) => {
    return alerts.filter(alert => alert.severity === severity).length;
  };

  const getUnreadCount = () => {
    return alerts.filter(alert => !dismissedAlerts.has(alert.id)).length;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Real-time Alerts
            </h3>
            {getUnreadCount() > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {getUnreadCount()}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            System alerts and notifications
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={config.filterBySeverity}
            onChange={(e) => onUpdate({ filterBySeverity: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">All Alerts</option>
            <option value="high">High & Critical</option>
            <option value="critical">Critical Only</option>
          </select>

          <button
            onClick={() => onUpdate({ soundEnabled: !config.soundEnabled })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              config.soundEnabled
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            {config.soundEnabled ? 'Sound On' : 'Sound Off'}
          </button>

          <button
            onClick={() => onUpdate({ showDismissed: !config.showDismissed })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              config.showDismissed
                ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
            }`}
          >
            {config.showDismissed ? 'Hide Dismissed' : 'Show Dismissed'}
          </button>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {getSeverityCount('critical')}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Critical</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {getSeverityCount('high')}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">High</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {getSeverityCount('medium')}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Medium</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {getSeverityCount('low')}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Low</div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map(alert => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onDismiss={handleDismissAlert}
              onView={handleViewAlert}
            />
          ))
        ) : (
          <div className="text-center py-8">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {isConnected ? 'No alerts at this time' : 'Offline - unable to check for alerts'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {isConnected ? 'All systems operating normally' : 'Check connection status'}
            </p>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-600 dark:text-gray-400">
              {isConnected ? 'Real-time monitoring active' : 'Connection lost'}
            </span>
          </div>
          <span className="text-gray-500 dark:text-gray-400">
            {filteredAlerts.length} of {alerts.length} alerts shown
          </span>
        </div>
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Alert Details
                </h3>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                  <p className="text-gray-900 dark:text-white">{selectedAlert.title}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <p className="text-gray-600 dark:text-gray-400">{selectedAlert.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                    <p className="text-gray-900 dark:text-white capitalize">{selectedAlert.type.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Severity</label>
                    <p className={`capitalize font-medium ${
                      selectedAlert.severity === 'critical' ? 'text-red-600' :
                      selectedAlert.severity === 'high' ? 'text-orange-600' :
                      selectedAlert.severity === 'medium' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`}>
                      {selectedAlert.severity}
                    </p>
                  </div>
                </div>

                {selectedAlert.affected_tickets && selectedAlert.affected_tickets.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Affected Tickets</label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedAlert.affected_tickets.join(', ')}
                    </p>
                  </div>
                )}

                {selectedAlert.auto_actions && selectedAlert.auto_actions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Auto Actions Taken</label>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
                      {selectedAlert.auto_actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Timestamp</label>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(selectedAlert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                >
                  Close
                </button>
                {selectedAlert.dismissible && (
                  <button
                    onClick={() => {
                      handleDismissAlert(selectedAlert.id);
                      setSelectedAlert(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Dismiss Alert
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}