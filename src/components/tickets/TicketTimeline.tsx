'use client';

/**
 * TicketTimeline - Comprehensive visual timeline component for ticket history
 * Shows all events, changes, comments, and interactions in chronological order
 */

import React, { useState, useMemo } from 'react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import type { Ticket, Comment, User, Category, Priority, Status } from '../../../lib/types/database';

// Icons
import {
  ChatBubbleLeftRightIcon,
  UserIcon,
  PencilIcon,
  ClockIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  PaperClipIcon,
  BellIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  UserGroupIcon,
  CalendarIcon,
  FlagIcon
} from '@heroicons/react/24/outline';

interface TimelineEvent {
  id: string;
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'category_change' |
        'attachment' | 'view' | 'escalation' | 'sla_breach' | 'notification' | 'system' | 'custom';
  timestamp: Date;
  user?: User;
  title: string;
  description?: string;
  metadata?: any;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  isInternal?: boolean;
  isSystemGenerated?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  relatedItems?: Array<{
    type: 'comment' | 'attachment' | 'ticket' | 'user';
    id: number;
    name: string;
  }>;
}

interface TicketTimelineProps {
  ticket: Ticket;
  comments: Comment[];
  users: User[];
  categories: Category[];
  priorities: Priority[];
  statuses: Status[];
  currentUser: User;
  onEventClick?: (event: TimelineEvent) => void;
  showInternal?: boolean;
  showSystemEvents?: boolean;
  groupByDate?: boolean;
  maxEvents?: number;
  className?: string;
}

interface EventFilter {
  types: Set<string>;
  users: Set<number>;
  dateRange: { start?: Date; end?: Date };
  severity: Set<string>;
  searchTerm: string;
}

export function TicketTimeline({
  ticket,
  comments,
  users,
  categories,
  priorities,
  statuses,
  currentUser,
  onEventClick,
  showInternal = currentUser.role === 'admin' || currentUser.role === 'agent',
  showSystemEvents = true,
  groupByDate = true,
  maxEvents = 100,
  className = ''
}: TicketTimelineProps) {
  const [filter, setFilter] = useState<EventFilter>({
    types: new Set(),
    users: new Set(),
    dateRange: {},
    severity: new Set(),
    searchTerm: ''
  });
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Helper function to get user by ID
  const getUserById = (id: number): User | undefined => {
    return users.find(u => u.id === id);
  };

  // Helper function to get category by ID
  const getCategoryById = (id: number): Category | undefined => {
    return categories.find(c => c.id === id);
  };

  // Helper function to get priority by ID
  const getPriorityById = (id: number): Priority | undefined => {
    return priorities.find(p => p.id === id);
  };

  // Helper function to get status by ID
  const getStatusById = (id: number): Status | undefined => {
    return statuses.find(s => s.id === id);
  };

  // Generate timeline events from ticket data
  const timelineEvents = useMemo((): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Ticket creation event
    events.push({
      id: `ticket-created-${ticket.id}`,
      type: 'system',
      timestamp: parseISO(ticket.created_at),
      user: getUserById(ticket.user_id),
      title: 'Ticket Created',
      description: `Ticket #${ticket.id} was created`,
      icon: DocumentTextIcon,
      iconColor: 'text-blue-500',
      isSystemGenerated: true,
      severity: 'low',
      metadata: {
        action: 'created',
        ticketId: ticket.id,
        initialData: {
          title: ticket.title,
          description: ticket.description,
          category_id: ticket.category_id,
          priority_id: ticket.priority_id,
          status_id: ticket.status_id
        }
      }
    });

    // Assignment events
    if (ticket.assigned_to) {
      const assignedUser = getUserById(ticket.assigned_to);
      events.push({
        id: `ticket-assigned-${ticket.id}`,
        type: 'assignment',
        timestamp: parseISO(ticket.created_at), // Would be actual assignment time in real system
        user: assignedUser,
        title: 'Ticket Assigned',
        description: `Assigned to ${assignedUser?.name || 'Unknown User'}`,
        icon: UserGroupIcon,
        iconColor: 'text-green-500',
        isSystemGenerated: false,
        severity: 'medium',
        metadata: {
          action: 'assigned',
          assignedTo: ticket.assigned_to,
          assignedUser: assignedUser
        }
      });
    }

    // Comment events
    comments.forEach((comment) => {
      const commentUser = getUserById(comment.user_id);
      events.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        timestamp: parseISO(comment.created_at),
        user: commentUser,
        title: comment.is_internal ? 'Internal Note Added' : 'Comment Added',
        description: comment.content.length > 100
          ? comment.content.substring(0, 100) + '...'
          : comment.content,
        icon: ChatBubbleLeftRightIcon,
        iconColor: comment.is_internal ? 'text-orange-500' : 'text-blue-500',
        isInternal: comment.is_internal,
        isSystemGenerated: false,
        severity: 'low',
        metadata: {
          action: 'comment_added',
          commentId: comment.id,
          fullContent: comment.content,
          isInternal: comment.is_internal
        }
      });
    });

    // Resolution event
    if (ticket.resolved_at) {
      events.push({
        id: `ticket-resolved-${ticket.id}`,
        type: 'status_change',
        timestamp: parseISO(ticket.resolved_at),
        title: 'Ticket Resolved',
        description: 'Ticket has been marked as resolved',
        icon: CheckCircleIcon,
        iconColor: 'text-green-500',
        isSystemGenerated: true,
        severity: 'medium',
        metadata: {
          action: 'resolved',
          resolvedAt: ticket.resolved_at
        }
      });
    }

    // Mock additional events (in real system, these would come from audit logs)
    const mockEvents = generateMockEvents(ticket);
    events.push(...mockEvents);

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [ticket, comments, users, categories, priorities, statuses]);

  // Generate mock events for demonstration
  const generateMockEvents = (ticket: Ticket): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    const now = new Date();
    const ticketAge = now.getTime() - parseISO(ticket.created_at).getTime();

    // Only generate events for tickets that are a few minutes old
    if (ticketAge < 5 * 60 * 1000) return events; // Less than 5 minutes

    // Mock priority change
    if (Math.random() > 0.7) {
      events.push({
        id: `priority-change-${Date.now()}`,
        type: 'priority_change',
        timestamp: new Date(parseISO(ticket.created_at).getTime() + Math.random() * ticketAge),
        user: getUserById(ticket.assigned_to || ticket.user_id),
        title: 'Priority Updated',
        description: `Priority changed to ${getPriorityById(ticket.priority_id)?.name || 'Unknown'}`,
        icon: ExclamationTriangleIcon,
        iconColor: 'text-orange-500',
        isSystemGenerated: false,
        severity: 'medium',
        metadata: {
          action: 'priority_changed',
          oldPriority: 'Low',
          newPriority: getPriorityById(ticket.priority_id)?.name
        }
      });
    }

    // Mock status changes
    if (Math.random() > 0.6) {
      events.push({
        id: `status-change-${Date.now()}`,
        type: 'status_change',
        timestamp: new Date(parseISO(ticket.created_at).getTime() + Math.random() * ticketAge),
        user: getUserById(ticket.assigned_to || ticket.user_id),
        title: 'Status Updated',
        description: `Status changed to ${getStatusById(ticket.status_id)?.name || 'Unknown'}`,
        icon: ClockIcon,
        iconColor: 'text-blue-500',
        isSystemGenerated: false,
        severity: 'low',
        metadata: {
          action: 'status_changed',
          oldStatus: 'Open',
          newStatus: getStatusById(ticket.status_id)?.name
        }
      });
    }

    // Mock view events
    if (Math.random() > 0.5) {
      events.push({
        id: `view-${Date.now()}`,
        type: 'view',
        timestamp: new Date(parseISO(ticket.created_at).getTime() + Math.random() * ticketAge),
        user: getUserById(ticket.assigned_to || users[1]?.id || ticket.user_id),
        title: 'Ticket Viewed',
        description: 'Ticket was opened for review',
        icon: EyeIcon,
        iconColor: 'text-gray-500',
        isSystemGenerated: true,
        severity: 'low',
        metadata: {
          action: 'viewed',
          viewDuration: Math.floor(Math.random() * 300) + 30 // 30-330 seconds
        }
      });
    }

    // Mock SLA warning
    if (Math.random() > 0.8) {
      events.push({
        id: `sla-warning-${Date.now()}`,
        type: 'sla_breach',
        timestamp: new Date(parseISO(ticket.created_at).getTime() + Math.random() * ticketAge),
        title: 'SLA Warning',
        description: 'Ticket is approaching SLA breach deadline',
        icon: BellIcon,
        iconColor: 'text-red-500',
        isSystemGenerated: true,
        severity: 'high',
        metadata: {
          action: 'sla_warning',
          slaType: 'response_time',
          timeRemaining: '2 hours'
        }
      });
    }

    return events;
  };

  // Filter events based on current filter settings
  const filteredEvents = useMemo(() => {
    let filtered = timelineEvents;

    // Filter by type
    if (filter.types.size > 0) {
      filtered = filtered.filter(event => filter.types.has(event.type));
    }

    // Filter by user
    if (filter.users.size > 0) {
      filtered = filtered.filter(event => event.user && filter.users.has(event.user.id));
    }

    // Filter by internal/external
    if (!showInternal) {
      filtered = filtered.filter(event => !event.isInternal);
    }

    // Filter by system events
    if (!showSystemEvents) {
      filtered = filtered.filter(event => !event.isSystemGenerated);
    }

    // Filter by search term
    if (filter.searchTerm) {
      const searchLower = filter.searchTerm.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchLower) ||
        (event.description && event.description.toLowerCase().includes(searchLower)) ||
        (event.user && event.user.name.toLowerCase().includes(searchLower))
      );
    }

    // Filter by severity
    if (filter.severity.size > 0) {
      filtered = filtered.filter(event => event.severity && filter.severity.has(event.severity));
    }

    // Limit number of events
    return filtered.slice(0, maxEvents);
  }, [timelineEvents, filter, showInternal, showSystemEvents, maxEvents]);

  // Group events by date if enabled
  const groupedEvents = useMemo(() => {
    if (!groupByDate) return { ungrouped: filteredEvents };

    const groups: Record<string, TimelineEvent[]> = {};
    filteredEvents.forEach(event => {
      const dateKey = format(event.timestamp, 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    });

    return groups;
  }, [filteredEvents, groupByDate]);

  // Toggle event expansion
  const toggleEventExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // Handle event click
  const handleEventClick = (event: TimelineEvent) => {
    if (onEventClick) {
      onEventClick(event);
    } else {
      toggleEventExpansion(event.id);
    }
  };

  // Render individual event
  const renderEvent = (event: TimelineEvent, isFirst: boolean = false, isLast: boolean = false) => {
    const isExpanded = expandedEvents.has(event.id);
    const EventIcon = event.icon;

    return (
      <div key={event.id} className="relative">
        {/* Timeline line */}
        {!isLast && (
          <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
        )}

        {/* Event container */}
        <div className="relative flex items-start space-x-3">
          {/* Icon */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            event.severity === 'critical' ? 'bg-red-100 dark:bg-red-900' :
            event.severity === 'high' ? 'bg-orange-100 dark:bg-orange-900' :
            event.severity === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900' :
            'bg-gray-100 dark:bg-gray-800'
          }`}>
            <EventIcon className={`h-5 w-5 ${event.iconColor}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div
              className="cursor-pointer"
              onClick={() => handleEventClick(event)}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {event.title}
                  </h4>
                  {event.isInternal && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      Internal
                    </span>
                  )}
                  {event.isSystemGenerated && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      System
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                  <span title={format(event.timestamp, 'PPpp')}>
                    {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                  </span>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {event.description}
                </p>
              )}

              {/* User info */}
              {event.user && (
                <div className="mt-1 flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                  <UserIcon className="h-3 w-3" />
                  <span>{event.user.name}</span>
                  {event.user.role !== 'user' && (
                    <span className="text-gray-400">({event.user.role})</span>
                  )}
                </div>
              )}
            </div>

            {/* Expanded content */}
            {isExpanded && event.metadata && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Event Details
                </h5>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-right">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Related items */}
                {event.relatedItems && event.relatedItems.length > 0 && (
                  <div className="mt-3">
                    <h6 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Related Items
                    </h6>
                    <div className="space-y-1">
                      {event.relatedItems.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                          <span className="capitalize">{item.type}:</span>
                          <span className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render filter controls
  const renderFilters = () => (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Filter Timeline
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search events..."
            value={filter.searchTerm}
            onChange={(e) => setFilter(prev => ({ ...prev, searchTerm: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* Event types */}
        <div>
          <select
            multiple
            value={Array.from(filter.types)}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value);
              setFilter(prev => ({ ...prev, types: new Set(values) }));
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="comment">Comments</option>
            <option value="status_change">Status Changes</option>
            <option value="assignment">Assignments</option>
            <option value="priority_change">Priority Changes</option>
            <option value="system">System Events</option>
          </select>
        </div>

        {/* Severity */}
        <div>
          <select
            multiple
            value={Array.from(filter.severity)}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value);
              setFilter(prev => ({ ...prev, severity: new Set(values) }));
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Clear filters */}
      {(filter.types.size > 0 || filter.users.size > 0 || filter.severity.size > 0 || filter.searchTerm) && (
        <button
          onClick={() => setFilter({
            types: new Set(),
            users: new Set(),
            dateRange: {},
            severity: new Set(),
            searchTerm: ''
          })}
          className="mt-3 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Timeline ({filteredEvents.length} events)
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setExpandedEvents(new Set())}
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Collapse All
          </button>
          <button
            onClick={() => setExpandedEvents(new Set(filteredEvents.map(e => e.id)))}
            className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            Expand All
          </button>
        </div>
      </div>

      {/* Filters */}
      {renderFilters()}

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          {Object.keys(groupedEvents).length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No events found matching your filters</p>
            </div>
          ) : groupByDate ? (
            // Grouped by date
            <div className="space-y-8">
              {Object.entries(groupedEvents)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .map(([date, events]) => (
                  <div key={date}>
                    <div className="flex items-center mb-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                      </h4>
                      <div className="flex-1 ml-4 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                    <div className="space-y-6">
                      {events.map((event, index) =>
                        renderEvent(event, index === 0, index === events.length - 1)
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Ungrouped
            <div className="space-y-6">
              {filteredEvents.map((event, index) =>
                renderEvent(event, index === 0, index === filteredEvents.length - 1)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Load more */}
      {timelineEvents.length > maxEvents && filteredEvents.length === maxEvents && (
        <div className="text-center">
          <button
            onClick={() => {/* Implement load more logic */}}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Load more events ({timelineEvents.length - maxEvents} remaining)
          </button>
        </div>
      )}
    </div>
  );
}