/**
 * Agent Components
 *
 * Information-dense, productivity-focused components for support agents.
 * Focus: Efficiency, multi-tasking, workflow optimization
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  PaperClipIcon,
  EllipsisVerticalIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ChevronDownIcon,
  BoltIcon,
  AdjustmentsHorizontalIcon,
  ViewColumnsIcon,
  ArrowPathIcon,
  BellIcon
} from '@heroicons/react/24/outline';
import { PersonaType } from '../../../lib/design-system/tokens';

interface AgentComponentProps {
  className?: string;
  persona?: PersonaType;
}

// Compact, efficient ticket list with filtering and sorting
export function AgentTicketQueue({ className = '', ...props }: AgentComponentProps) {
  const [tickets, setTickets] = useState([
    {
      id: 'REQ-001',
      title: 'Email sync issues with Outlook',
      customer: 'John Smith',
      priority: 'high',
      status: 'open',
      category: 'Email',
      assignee: 'Me',
      created: '2h ago',
      sla: '4h remaining',
      lastActivity: '30m ago'
    },
    {
      id: 'REQ-002',
      title: 'Password reset not working',
      customer: 'Sarah Johnson',
      priority: 'medium',
      status: 'in-progress',
      category: 'Account',
      assignee: 'Me',
      created: '4h ago',
      sla: '20h remaining',
      lastActivity: '5m ago'
    },
    {
      id: 'REQ-003',
      title: 'Software installation error',
      customer: 'Mike Davis',
      priority: 'low',
      status: 'pending',
      category: 'Software',
      assignee: 'Unassigned',
      created: '1d ago',
      sla: '2d remaining',
      lastActivity: '1h ago'
    }
  ]);

  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    assignee: 'all'
  });

  const [sortBy, setSortBy] = useState('priority');
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600 bg-blue-50';
      case 'in-progress': return 'text-amber-600 bg-amber-50';
      case 'pending': return 'text-gray-600 bg-gray-50';
      case 'resolved': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  return (
    <div className={`bg-persona-elevated border border-persona-primary rounded-lg ${className}`}>
      {/* Header with controls */}
      <div className="p-4 border-b border-persona-secondary">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-persona-primary">
            Ticket Queue ({tickets.length})
          </h2>
          <div className="flex items-center gap-2">
            <button className="btn-persona-agent">
              <ArrowPathIcon className="h-4 w-4 mr-1" />
              Refresh
            </button>
            <button className="btn-persona-agent">
              <ViewColumnsIcon className="h-4 w-4 mr-1" />
              Columns
            </button>
          </div>
        </div>

        {/* Quick filters */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-persona-muted" />
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="input-persona-agent w-32"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            className="input-persona-agent w-32"
          >
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-persona-agent w-32"
          >
            <option value="priority">Priority</option>
            <option value="created">Created</option>
            <option value="sla">SLA</option>
            <option value="status">Status</option>
          </select>

          {selectedTickets.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-persona-secondary">
                {selectedTickets.length} selected
              </span>
              <button className="btn-persona-agent">Bulk Actions</button>
            </div>
          )}
        </div>
      </div>

      {/* Ticket list */}
      <div className="divide-y divide-persona-secondary">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className={`p-3 hover:bg-persona-secondary transition-subtle cursor-pointer ${
              selectedTickets.includes(ticket.id) ? 'bg-blue-50' : ''
            }`}
            onClick={() => toggleTicketSelection(ticket.id)}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedTickets.includes(ticket.id)}
                onChange={() => toggleTicketSelection(ticket.id)}
                className="rounded border-persona-secondary focus-ring-agent"
                onClick={(e) => e.stopPropagation()}
              />

              <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center text-sm">
                {/* Ticket ID and Priority */}
                <div className="col-span-2">
                  <div className="font-mono font-semibold text-persona-primary">
                    {ticket.id}
                  </div>
                  <div className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </div>
                </div>

                {/* Title and Customer */}
                <div className="col-span-4">
                  <div className="font-medium text-persona-primary truncate">
                    {ticket.title}
                  </div>
                  <div className="text-persona-secondary flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    {ticket.customer}
                  </div>
                </div>

                {/* Status and Category */}
                <div className="col-span-2">
                  <div className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </div>
                  <div className="text-persona-muted text-xs mt-0.5">
                    {ticket.category}
                  </div>
                </div>

                {/* Assignee */}
                <div className="col-span-2">
                  <div className="text-persona-primary font-medium">
                    {ticket.assignee}
                  </div>
                </div>

                {/* SLA and Timing */}
                <div className="col-span-2 text-right">
                  <div className="text-persona-primary font-medium">
                    {ticket.sla}
                  </div>
                  <div className="text-persona-muted text-xs">
                    {ticket.lastActivity}
                  </div>
                </div>
              </div>

              <button className="p-1 text-persona-muted hover:text-persona-primary transition-subtle">
                <EllipsisVerticalIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Productivity-focused quick actions bar
export function AgentQuickActions({ className = '', ...props }: AgentComponentProps) {
  const [activeTimer, setActiveTimer] = useState<string | null>('REQ-002');
  const [timerDuration, setTimerDuration] = useState(1847); // seconds

  const quickActions = [
    { icon: BoltIcon, label: 'Quick Reply', shortcut: 'Q', color: 'text-blue-600' },
    { icon: ChatBubbleLeftRightIcon, label: 'New Ticket', shortcut: 'N', color: 'text-green-600' },
    { icon: DocumentTextIcon, label: 'Knowledge Base', shortcut: 'K', color: 'text-purple-600' },
    { icon: AdjustmentsHorizontalIcon, label: 'Bulk Edit', shortcut: 'B', color: 'text-orange-600' },
    { icon: ArrowPathIcon, label: 'Refresh All', shortcut: 'R', color: 'text-gray-600' }
  ];

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (activeTimer) {
      const interval = setInterval(() => {
        setTimerDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTimer]);

  return (
    <div className={`bg-persona-elevated border border-persona-primary rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Quick actions */}
        <div className="flex items-center gap-1">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-persona-secondary transition-subtle focus-ring-agent"
              title={`${action.label} (${action.shortcut})`}
            >
              <action.icon className={`h-4 w-4 ${action.color}`} />
              <span className="text-persona-primary font-medium hidden sm:inline">
                {action.label}
              </span>
              <span className="text-xs text-persona-muted bg-persona-secondary px-1 rounded hidden lg:inline">
                {action.shortcut}
              </span>
            </button>
          ))}
        </div>

        {/* Time tracker */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <ClockIcon className="h-4 w-4 text-persona-muted" />
            <span className="text-persona-secondary">
              Active on REQ-002:
            </span>
            <span className="font-mono font-semibold text-persona-primary">
              {formatTime(timerDuration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {activeTimer ? (
              <>
                <button
                  onClick={() => setActiveTimer(null)}
                  className="p-1 text-amber-600 hover:text-amber-700 transition-subtle"
                  title="Pause timer"
                >
                  <PauseIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setActiveTimer(null);
                    setTimerDuration(0);
                  }}
                  className="p-1 text-red-600 hover:text-red-700 transition-subtle"
                  title="Stop timer"
                >
                  <StopIcon className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveTimer('REQ-002')}
                className="p-1 text-green-600 hover:text-green-700 transition-subtle"
                title="Start timer"
              >
                <PlayIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact notification center for agents
export function AgentNotificationCenter({ className = '', ...props }: AgentComponentProps) {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'ticket_assigned',
      title: 'New ticket assigned',
      message: 'REQ-004 has been assigned to you',
      time: '2m ago',
      read: false,
      priority: 'high'
    },
    {
      id: 2,
      type: 'sla_warning',
      title: 'SLA warning',
      message: 'REQ-001 SLA expires in 1 hour',
      time: '5m ago',
      read: false,
      priority: 'critical'
    },
    {
      id: 3,
      type: 'customer_reply',
      title: 'Customer replied',
      message: 'Sarah Johnson replied to REQ-002',
      time: '15m ago',
      read: true,
      priority: 'medium'
    }
  ]);

  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'sla_warning':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      case 'customer_reply':
        return <ChatBubbleLeftRightIcon className="h-4 w-4 text-blue-500" />;
      default:
        return <InformationCircleIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-persona-muted hover:text-persona-primary transition-subtle focus-ring-agent rounded"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-persona-elevated border border-persona-secondary rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-persona-secondary">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-persona-primary">Notifications</h3>
              <button
                onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                className="text-xs text-persona-secondary hover:text-persona-primary transition-subtle"
              >
                Mark all read
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 border-b border-persona-secondary hover:bg-persona-secondary transition-subtle cursor-pointer ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start gap-3">
                  {getNotificationIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-persona-primary">
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                    <p className="text-sm text-persona-secondary mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-persona-muted mt-1">
                      {notification.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-persona-secondary">
            <button className="w-full text-sm text-persona-secondary hover:text-persona-primary transition-subtle">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Multi-tab workspace for handling multiple tickets
export function AgentWorkspace({ className = '', ...props }: AgentComponentProps) {
  const [tabs, setTabs] = useState([
    { id: 'REQ-001', title: 'Email sync issues', active: true, modified: false },
    { id: 'REQ-002', title: 'Password reset', active: false, modified: true },
    { id: 'REQ-003', title: 'Software installation', active: false, modified: false }
  ]);

  const activeTab = tabs.find(tab => tab.active);

  const switchTab = (tabId: string) => {
    setTabs(prev => prev.map(tab => ({ ...tab, active: tab.id === tabId })));
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      if (newTabs.length > 0 && prev.find(tab => tab.id === tabId)?.active) {
        newTabs[0].active = true;
      }
      return newTabs;
    });
  };

  return (
    <div className={`bg-persona-elevated border border-persona-primary rounded-lg ${className}`}>
      {/* Tab bar */}
      <div className="flex border-b border-persona-secondary">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border-r border-persona-secondary last:border-r-0 transition-subtle ${
              tab.active
                ? 'bg-persona-secondary text-persona-primary'
                : 'text-persona-secondary hover:text-persona-primary hover:bg-persona-secondary'
            }`}
          >
            <span className="font-mono text-xs">{tab.id}</span>
            <span className="truncate max-w-32">{tab.title}</span>
            {tab.modified && (
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            )}
            <button
              onClick={(e) => closeTab(tab.id, e)}
              className="ml-1 p-0.5 hover:bg-persona-tertiary rounded transition-subtle"
            >
              <XCircleIcon className="h-3 w-3" />
            </button>
          </button>
        ))}

        <button className="px-3 py-2 text-persona-muted hover:text-persona-primary transition-subtle">
          <span className="text-lg">+</span>
        </button>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-persona-primary">
                {activeTab.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                  High Priority
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  In Progress
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ticket details */}
              <div className="space-y-3">
                <div className="card-persona-agent">
                  <h4 className="font-medium text-persona-primary mb-2">Customer Information</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-persona-secondary">Name:</span>
                      <span className="text-persona-primary">John Smith</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-persona-secondary">Email:</span>
                      <span className="text-persona-primary">john.smith@company.com</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-persona-secondary">Department:</span>
                      <span className="text-persona-primary">IT</span>
                    </div>
                  </div>
                </div>

                <div className="card-persona-agent">
                  <h4 className="font-medium text-persona-primary mb-2">Ticket Details</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-persona-secondary">Created:</span>
                      <span className="text-persona-primary">2 hours ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-persona-secondary">SLA Deadline:</span>
                      <span className="text-red-600 font-medium">4h remaining</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-persona-secondary">Category:</span>
                      <span className="text-persona-primary">Email</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions and quick responses */}
              <div className="space-y-3">
                <div className="card-persona-agent">
                  <h4 className="font-medium text-persona-primary mb-2">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-persona-agent">Escalate</button>
                    <button className="btn-persona-agent">Reassign</button>
                    <button className="btn-persona-agent">Set Pending</button>
                    <button className="btn-persona-agent">Close Ticket</button>
                  </div>
                </div>

                <div className="card-persona-agent">
                  <h4 className="font-medium text-persona-primary mb-2">Templates</h4>
                  <select className="input-persona-agent w-full">
                    <option>Select template...</option>
                    <option>Email troubleshooting steps</option>
                    <option>Password reset instructions</option>
                    <option>Escalation notice</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export all components
export {
  AgentTicketQueue,
  AgentQuickActions,
  AgentNotificationCenter,
  AgentWorkspace
};