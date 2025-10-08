/**
 * Notification Center Component
 *
 * Advanced notification system with real-time updates, categorization,
 * and persona-specific customization. Supports multiple notification types
 * and provides rich interaction capabilities.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { logger } from '@/lib/monitoring/logger';
import {
  BellIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  BoltIcon,
  ShieldExclamationIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { PersonaType } from '../../../lib/design-system/tokens';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'ticket' | 'user' | 'system' | 'sla';
  category: string;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: () => void;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  persona?: PersonaType;
  className?: string;
}

interface NotificationFilter {
  type?: string;
  category?: string;
  priority?: string;
  read?: boolean;
  starred?: boolean;
}

export function NotificationCenter({ isOpen, onClose, persona = 'agent', className = '' }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'sla',
      category: 'SLA Alert',
      title: 'SLA Breach Warning',
      message: 'Ticket REQ-001 will breach SLA in 30 minutes',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false,
      starred: false,
      priority: 'critical',
      actions: [
        { id: 'view', label: 'View Ticket', type: 'primary', action: () => logger.info('View ticket') },
        { id: 'escalate', label: 'Escalate', type: 'secondary', action: () => logger.info('Escalate') }
      ],
      metadata: { ticketId: 'REQ-001', timeRemaining: 30 }
    },
    {
      id: '2',
      type: 'ticket',
      category: 'New Assignment',
      title: 'New Ticket Assigned',
      message: 'High priority ticket has been assigned to you',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      read: false,
      starred: true,
      priority: 'high',
      actions: [
        { id: 'accept', label: 'Accept', type: 'primary', action: () => logger.info('Accept ticket') },
        { id: 'reassign', label: 'Reassign', type: 'secondary', action: () => logger.info('Reassign') }
      ],
      metadata: { ticketId: 'REQ-002', assignedBy: 'John Manager' }
    },
    {
      id: '3',
      type: 'user',
      category: 'Customer Update',
      title: 'Customer Reply',
      message: 'Sarah Johnson replied to ticket REQ-003',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: true,
      starred: false,
      priority: 'medium',
      actions: [
        { id: 'reply', label: 'Reply', type: 'primary', action: () => logger.info('Reply') }
      ],
      metadata: { ticketId: 'REQ-003', customerId: 'sarah-johnson' }
    },
    {
      id: '4',
      type: 'system',
      category: 'System Update',
      title: 'Maintenance Scheduled',
      message: 'System maintenance scheduled for tonight at 2 AM',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: true,
      starred: false,
      priority: 'low',
      metadata: { maintenanceWindow: '2023-12-15T02:00:00Z' }
    },
    {
      id: '5',
      type: 'success',
      category: 'Goal Achievement',
      title: 'SLA Target Met',
      message: 'Your team achieved 98% SLA compliance this week',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      read: false,
      starred: true,
      priority: 'medium',
      metadata: { slaPercentage: 98, period: 'week' }
    }
  ]);

  const [filter, setFilter] = useState<NotificationFilter>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      // Apply filters
      if (filter.type && notification.type !== filter.type) return false;
      if (filter.category && notification.category !== filter.category) return false;
      if (filter.priority && notification.priority !== filter.priority) return false;
      if (filter.read !== undefined && notification.read !== filter.read) return false;
      if (filter.starred !== undefined && notification.starred !== filter.starred) return false;

      // Apply search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query) ||
          notification.category.toLowerCase().includes(query)
        );
      }

      return true;
    }).sort((a, b) => {
      // Sort by priority and timestamp
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [notifications, filter, searchQuery]);

  // Notification counts
  const counts = useMemo(() => {
    const unread = notifications.filter(n => !n.read).length;
    const starred = notifications.filter(n => n.starred).length;
    const critical = notifications.filter(n => n.priority === 'critical').length;

    return { unread, starred, critical, total: notifications.length };
  }, [notifications]);

  // Get notification icon
  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = `h-5 w-5 ${getIconColor(type, priority)}`;

    switch (type) {
      case 'sla':
        return <ExclamationTriangleIcon className={iconClass} />;
      case 'ticket':
        return <ChatBubbleLeftRightIcon className={iconClass} />;
      case 'user':
        return <UserIcon className={iconClass} />;
      case 'system':
        return <CogIcon className={iconClass} />;
      case 'success':
        return <CheckIcon className={iconClass} />;
      case 'warning':
        return <ExclamationTriangleIcon className={iconClass} />;
      case 'error':
        return <ShieldExclamationIcon className={iconClass} />;
      default:
        return <InformationCircleIcon className={iconClass} />;
    }
  };

  const getIconColor = (type: string, priority: string) => {
    if (priority === 'critical') return 'text-red-600';
    if (priority === 'high') return 'text-orange-600';

    switch (type) {
      case 'sla':
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-amber-600';
      case 'success':
        return 'text-green-600';
      case 'ticket':
        return 'text-blue-600';
      case 'user':
        return 'text-purple-600';
      case 'system':
        return 'text-gray-600';
      default:
        return 'text-blue-600';
    }
  };

  const getBorderColor = (priority: string, read: boolean) => {
    if (read) return '';

    switch (priority) {
      case 'critical':
        return 'border-l-4 border-red-500';
      case 'high':
        return 'border-l-4 border-orange-500';
      case 'medium':
        return 'border-l-4 border-blue-500';
      default:
        return 'border-l-4 border-gray-300';
    }
  };

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Notification actions
  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const markAsUnread = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: false } : n)
    );
  };

  const toggleStar = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, starred: !n.starred } : n)
    );
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Handle bulk actions
  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'markRead':
        setNotifications(prev =>
          prev.map(n => selectedNotifications.includes(n.id) ? { ...n, read: true } : n)
        );
        break;
      case 'markUnread':
        setNotifications(prev =>
          prev.map(n => selectedNotifications.includes(n.id) ? { ...n, read: false } : n)
        );
        break;
      case 'delete':
        setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
        break;
    }
    setSelectedNotifications([]);
  };

  const toggleSelection = (notificationId: string) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const selectAll = () => {
    setSelectedNotifications(filteredNotifications.map(n => n.id));
  };

  const clearSelection = () => {
    setSelectedNotifications([]);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Get persona-specific classes
  const getPersonaClasses = () => {
    switch (persona) {
      case 'enduser':
        return 'w-96 max-h-[32rem]';
      case 'agent':
        return 'w-80 max-h-96';
      case 'manager':
        return 'w-[28rem] max-h-[36rem]';
      default:
        return 'w-80 max-h-96';
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div ref={containerRef} className={`fixed top-16 right-4 z-50 ${getPersonaClasses()} bg-white rounded-lg shadow-2xl border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BellIcon className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {counts.unread > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {counts.unread}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <FunnelIcon className="h-4 w-4" />
            </button>

            <button
              onClick={markAllAsRead}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              title="Mark all as read"
            >
              <CheckIcon className="h-4 w-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <span>{counts.total} total</span>
          <span>{counts.unread} unread</span>
          <span>{counts.critical} critical</span>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filter.type || ''}
              onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value || undefined }))}
              className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="sla">SLA</option>
              <option value="ticket">Tickets</option>
              <option value="user">Users</option>
              <option value="system">System</option>
            </select>

            <select
              value={filter.priority || ''}
              onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value || undefined }))}
              className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter(prev => ({ ...prev, read: false }))}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                filter.read === false ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Unread Only
            </button>
            <button
              onClick={() => setFilter(prev => ({ ...prev, starred: true }))}
              className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                filter.starred === true ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Starred Only
            </button>
            <button
              onClick={() => setFilter({})}
              className="px-2 py-1 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedNotifications.length > 0 && (
        <div className="p-3 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">
              {selectedNotifications.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('markRead')}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Mark Read
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={clearSelection}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications list */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <BellIcon className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500 font-medium">No notifications</div>
            <div className="text-sm text-gray-400">
              {searchQuery ? 'No notifications match your search' : 'You\'re all caught up!'}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 hover:bg-gray-50 transition-colors ${getBorderColor(notification.priority, notification.read)} ${
                  !notification.read ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.includes(notification.id)}
                    onChange={() => toggleSelection(notification.id)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />

                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-sm font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                            {notification.title}
                          </h4>
                          {notification.starred && (
                            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${notification.read ? 'text-gray-500' : 'text-gray-700'}`}>
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {notification.category}
                          </span>
                          {notification.priority === 'critical' && (
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                              Critical
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => toggleStar(notification.id)}
                          className={`p-1 rounded transition-colors ${
                            notification.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                          }`}
                        >
                          ★
                        </button>

                        <button
                          onClick={() => notification.read ? markAsUnread(notification.id) : markAsRead(notification.id)}
                          className="p-1 text-gray-300 hover:text-gray-600 transition-colors"
                          title={notification.read ? 'Mark as unread' : 'Mark as read'}
                        >
                          {notification.read ? <EyeSlashIcon className="h-3 w-3" /> : <EyeIcon className="h-3 w-3" />}
                        </button>

                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete notification"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    {notification.actions && notification.actions.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        {notification.actions.map((action) => (
                          <button
                            key={action.id}
                            onClick={action.action}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              action.type === 'primary'
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : action.type === 'danger'
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {filteredNotifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <button
              onClick={selectAll}
              className="hover:text-gray-700 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="hover:text-red-600 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

// Hook for notification center
export function useNotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  };
}