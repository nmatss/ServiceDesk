/**
 * Quick Actions Component
 *
 * Configurable toolbar for common actions with persona-specific layouts.
 * Provides contextual actions based on current view and user role.
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { logger } from '@/lib/monitoring/logger';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowsUpDownIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  ViewColumnsIcon,
  Share2Icon,
  BookmarkIcon,
  ClockIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  TagIcon,
  PrinterIcon,
  EllipsisHorizontalIcon,
  ChevronDownIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { PersonaType } from '../../../lib/design-system/tokens';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  category?: string;
  tooltip?: string;
  badge?: number;
  dropdown?: QuickAction[];
}

interface QuickActionsProps {
  actions: QuickAction[];
  persona?: PersonaType;
  context?: 'tickets' | 'users' | 'dashboard' | 'reports' | 'settings';
  className?: string;
  compact?: boolean;
  showLabels?: boolean;
  maxVisible?: number;
}

export function QuickActions({
  actions,
  persona = 'agent',
  context = 'tickets',
  className = '',
  compact = false,
  showLabels = true,
  maxVisible = 6
}: QuickActionsProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Split actions into visible and overflow
  const visibleActions = actions.slice(0, maxVisible);
  const overflowActions = actions.slice(maxVisible);

  // Get persona-specific button classes
  const getButtonClasses = (action: QuickAction) => {
    const baseClasses = compact
      ? 'inline-flex items-center gap-1 px-2 py-1.5 text-sm font-medium rounded-md transition-all duration-150'
      : 'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200';

    const personaClasses = {
      enduser: 'min-target-enduser focus-ring-enduser',
      agent: 'min-target-agent focus-ring-agent',
      manager: 'min-target-manager focus-ring-manager'
    };

    const variantClasses = {
      primary: persona === 'enduser'
        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
        : persona === 'agent'
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md',
      secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300',
      ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
    };

    return `${baseClasses} ${personaClasses[persona]} ${variantClasses[action.variant || 'secondary']} ${
      action.disabled ? 'opacity-50 cursor-not-allowed' : ''
    }`;
  };

  // Handle action execution with loading state
  const executeAction = async (action: QuickAction) => {
    if (action.disabled || loadingActions.has(action.id)) return;

    setLoadingActions(prev => new Set(prev).add(action.id));

    try {
      await action.action();
    } catch (error) {
      logger.error('Action failed', error);
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(action.id);
        return newSet;
      });
    }
  };

  // Handle dropdown toggle
  const toggleDropdown = (actionId: string) => {
    setActiveDropdown(activeDropdown === actionId ? null : actionId);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(event.target as Node)
      ) {
        setIsMoreOpen(false);
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render action button
  const renderActionButton = (action: QuickAction, isInDropdown = false) => {
    const isLoading = loadingActions.has(action.id);
    const hasDropdown = action.dropdown && action.dropdown.length > 0;

    const button = (
      <button
        onClick={() => hasDropdown ? toggleDropdown(action.id) : executeAction(action)}
        className={`${getButtonClasses(action)} ${isInDropdown ? 'w-full justify-start' : ''}`}
        disabled={action.disabled || isLoading}
        title={action.tooltip || action.label}
      >
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-shrink-0">
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
            ) : (
              <action.icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            )}
          </div>

          {showLabels && (
            <span className="truncate">{action.label}</span>
          )}

          {action.badge && action.badge > 0 && (
            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {action.badge > 99 ? '99+' : action.badge}
            </span>
          )}

          {action.shortcut && !compact && (
            <div className="hidden lg:flex items-center gap-0.5 ml-auto">
              {action.shortcut.split(' ').map((key, index) => (
                <kbd
                  key={index}
                  className="px-1 py-0.5 text-xs bg-gray-200 text-gray-600 rounded border"
                >
                  {key}
                </kbd>
              ))}
            </div>
          )}

          {hasDropdown && (
            <ChevronDownIcon className={`h-3 w-3 transition-transform ${
              activeDropdown === action.id ? 'rotate-180' : ''
            }`} />
          )}
        </div>
      </button>
    );

    if (hasDropdown) {
      return (
        <div key={action.id} className="relative">
          {button}
          {activeDropdown === action.id && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="py-1">
                {action.dropdown!.map((dropdownAction) => (
                  <button
                    key={dropdownAction.id}
                    onClick={() => {
                      executeAction(dropdownAction);
                      setActiveDropdown(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    disabled={dropdownAction.disabled}
                  >
                    <dropdownAction.icon className="h-4 w-4" />
                    <span>{dropdownAction.label}</span>
                    {dropdownAction.shortcut && (
                      <div className="ml-auto text-xs text-gray-400">
                        {dropdownAction.shortcut}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={action.id}>
        {button}
      </div>
    );
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Visible actions */}
      {visibleActions.map(action => renderActionButton(action))}

      {/* More actions dropdown */}
      {overflowActions.length > 0 && (
        <div className="relative">
          <button
            ref={moreButtonRef}
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={getButtonClasses({
              id: 'more',
              label: 'More',
              icon: EllipsisHorizontalIcon,
              action: () => {},
              variant: 'ghost'
            })}
            title="More actions"
          >
            <EllipsisHorizontalIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            {showLabels && !compact && <span>More</span>}
            <ChevronDownIcon className={`h-3 w-3 transition-transform ${
              isMoreOpen ? 'rotate-180' : ''
            }`} />
          </button>

          {isMoreOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
            >
              <div className="py-1">
                {overflowActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      executeAction(action);
                      setIsMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={action.disabled || loadingActions.has(action.id)}
                    title={action.tooltip}
                  >
                    <div className="flex-shrink-0">
                      {loadingActions.has(action.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600" />
                      ) : (
                        <action.icon className="h-4 w-4" />
                      )}
                    </div>

                    <span className="flex-1 text-left">{action.label}</span>

                    {action.badge && action.badge > 0 && (
                      <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {action.badge > 99 ? '99+' : action.badge}
                      </span>
                    )}

                    {action.shortcut && (
                      <div className="text-xs text-gray-400">
                        {action.shortcut}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Predefined action sets for different contexts
export const createTicketActions = (persona: PersonaType): QuickAction[] => [
  {
    id: 'new-ticket',
    label: 'New Ticket',
    icon: PlusIcon,
    action: () => logger.info('Create new ticket'),
    variant: 'primary',
    shortcut: 'N T',
    tooltip: 'Create a new support ticket'
  },
  {
    id: 'search',
    label: 'Search',
    icon: MagnifyingGlassIcon,
    action: () => logger.info('Search tickets'),
    shortcut: '/',
    tooltip: 'Search tickets'
  },
  {
    id: 'filter',
    label: 'Filter',
    icon: FunnelIcon,
    action: () => logger.info('Filter tickets'),
    shortcut: 'F',
    tooltip: 'Filter ticket list',
    dropdown: [
      {
        id: 'filter-open',
        label: 'Open Tickets',
        icon: CheckIcon,
        action: () => logger.info('Filter open'),
      },
      {
        id: 'filter-assigned',
        label: 'Assigned to Me',
        icon: UserPlusIcon,
        action: () => logger.info('Filter assigned'),
      },
      {
        id: 'filter-high-priority',
        label: 'High Priority',
        icon: ExclamationTriangleIcon,
        action: () => logger.info('Filter high priority'),
      }
    ]
  },
  {
    id: 'sort',
    label: 'Sort',
    icon: ArrowsUpDownIcon,
    action: () => logger.info('Sort tickets'),
    tooltip: 'Sort ticket list',
    dropdown: [
      {
        id: 'sort-priority',
        label: 'By Priority',
        icon: ExclamationTriangleIcon,
        action: () => logger.info('Sort by priority'),
      },
      {
        id: 'sort-date',
        label: 'By Date',
        icon: ClockIcon,
        action: () => logger.info('Sort by date'),
      },
      {
        id: 'sort-status',
        label: 'By Status',
        icon: TagIcon,
        action: () => logger.info('Sort by status'),
      }
    ]
  },
  {
    id: 'refresh',
    label: 'Refresh',
    icon: ArrowPathIcon,
    action: () => logger.info('Refresh tickets'),
    shortcut: 'R',
    tooltip: 'Refresh ticket list'
  },
  {
    id: 'export',
    label: 'Export',
    icon: DocumentArrowDownIcon,
    action: () => logger.info('Export tickets'),
    tooltip: 'Export to CSV',
    dropdown: [
      {
        id: 'export-csv',
        label: 'Export as CSV',
        icon: DocumentArrowDownIcon,
        action: () => logger.info('Export CSV'),
      },
      {
        id: 'export-pdf',
        label: 'Export as PDF',
        icon: PrinterIcon,
        action: () => logger.info('Export PDF'),
      }
    ]
  },
  ...(persona === 'agent' || persona === 'manager' ? [
    {
      id: 'bulk-actions',
      label: 'Bulk Actions',
      icon: AdjustmentsHorizontalIcon,
      action: () => logger.info('Bulk actions'),
      tooltip: 'Perform bulk operations',
      dropdown: [
        {
          id: 'bulk-assign',
          label: 'Bulk Assign',
          icon: UserPlusIcon,
          action: () => logger.info('Bulk assign'),
        },
        {
          id: 'bulk-close',
          label: 'Bulk Close',
          icon: XMarkIcon,
          action: () => logger.info('Bulk close'),
        },
        {
          id: 'bulk-priority',
          label: 'Change Priority',
          icon: ExclamationTriangleIcon,
          action: () => logger.info('Bulk priority'),
        }
      ]
    }
  ] : []),
  {
    id: 'view-options',
    label: 'View',
    icon: ViewColumnsIcon,
    action: () => logger.info('View options'),
    tooltip: 'Customize view'
  }
];

export const createUserActions = (persona: PersonaType): QuickAction[] => [
  {
    id: 'new-user',
    label: 'New User',
    icon: UserPlusIcon,
    action: () => logger.info('Create new user'),
    variant: 'primary',
    shortcut: 'N U',
    tooltip: 'Add new user'
  },
  {
    id: 'search-users',
    label: 'Search',
    icon: MagnifyingGlassIcon,
    action: () => logger.info('Search users'),
    shortcut: '/',
    tooltip: 'Search users'
  },
  {
    id: 'import-users',
    label: 'Import',
    icon: DocumentArrowUpIcon,
    action: () => logger.info('Import users'),
    tooltip: 'Import users from CSV'
  },
  {
    id: 'export-users',
    label: 'Export',
    icon: DocumentArrowDownIcon,
    action: () => logger.info('Export users'),
    tooltip: 'Export user list'
  },
  {
    id: 'user-permissions',
    label: 'Permissions',
    icon: AdjustmentsHorizontalIcon,
    action: () => logger.info('Manage permissions'),
    tooltip: 'Manage user permissions'
  }
];

export const createDashboardActions = (persona: PersonaType): QuickAction[] => [
  {
    id: 'refresh-dashboard',
    label: 'Refresh',
    icon: ArrowPathIcon,
    action: () => logger.info('Refresh dashboard'),
    shortcut: 'R',
    tooltip: 'Refresh all widgets'
  },
  {
    id: 'customize-dashboard',
    label: 'Customize',
    icon: AdjustmentsHorizontalIcon,
    action: () => logger.info('Customize dashboard'),
    tooltip: 'Customize dashboard layout'
  },
  {
    id: 'share-dashboard',
    label: 'Share',
    icon: Share2Icon,
    action: () => logger.info('Share dashboard'),
    tooltip: 'Share dashboard view'
  },
  {
    id: 'bookmark-view',
    label: 'Bookmark',
    icon: BookmarkIcon,
    action: () => logger.info('Bookmark view'),
    tooltip: 'Save current view'
  },
  {
    id: 'export-report',
    label: 'Export Report',
    icon: DocumentArrowDownIcon,
    action: () => logger.info('Export report'),
    tooltip: 'Export dashboard as report'
  }
];

// Context-aware action factory
export function getContextActions(context: string, persona: PersonaType): QuickAction[] {
  switch (context) {
    case 'tickets':
      return createTicketActions(persona);
    case 'users':
      return createUserActions(persona);
    case 'dashboard':
      return createDashboardActions(persona);
    default:
      return createTicketActions(persona);
  }
}