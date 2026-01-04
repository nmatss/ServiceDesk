'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  Plus,
  Search,
  Filter,
  SortAsc,
  MoreHorizontal,
  Download,
  Upload,
  RefreshCw,
  Settings,
  User,
  Clock,
  Trash2,
  Edit,
  Send,
  Calendar,
  Tag,
  Users,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/design-system/utils';
import { Button } from './Button';

const quickActionsVariants = cva(
  'flex items-center gap-2',
  {
    variants: {
      layout: {
        horizontal: 'flex-row flex-wrap',
        vertical: 'flex-col items-stretch',
        floating: 'fixed bottom-6 right-6 flex-col-reverse z-50',
        toolbar: 'justify-between bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3',
      },
      size: {
        sm: 'gap-1',
        md: 'gap-2',
        lg: 'gap-3',
      },
      persona: {
        enduser: 'p-2',
        agent: 'p-1',
        manager: 'p-2',
      },
    },
    defaultVariants: {
      layout: 'horizontal',
      size: 'md',
      persona: 'agent',
    },
  }
);

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'destructive' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  badge?: string | number;
  tooltip?: string;
  shortcut?: string;
  group?: string;
  hidden?: boolean;
  confirmMessage?: string;
}

export interface QuickActionsProps extends VariantProps<typeof quickActionsVariants> {
  actions: QuickAction[];
  className?: string;
  maxVisible?: number;
  showLabels?: boolean;
  groupActions?: boolean;
  searchable?: boolean;
  onSearch?: (query: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  actions,
  layout = 'horizontal',
  size = 'md',
  persona = 'agent',
  className,
  maxVisible,
  showLabels = true,
  groupActions = false,
  searchable = false,
  onSearch,
}) => {
  const [showOverflow, setShowOverflow] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [confirmAction, setConfirmAction] = React.useState<QuickAction | null>(null);

  const visibleActions = actions.filter(action => !action.hidden);
  const displayActions = maxVisible
    ? visibleActions.slice(0, maxVisible)
    : visibleActions;
  const overflowActions = maxVisible
    ? visibleActions.slice(maxVisible)
    : [];

  const filteredActions = searchQuery
    ? visibleActions.filter(action =>
        action.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : visibleActions;

  const groupedActions = groupActions
    ? filteredActions.reduce((groups, action) => {
        const group = action.group || 'General';
        if (!groups[group]) groups[group] = [];
        groups[group].push(action);
        return groups;
      }, {} as Record<string, QuickAction[]>)
    : { All: filteredActions };

  const handleActionClick = (action: QuickAction) => {
    if (action.confirmMessage) {
      setConfirmAction(action);
    } else {
      action.onClick();
    }
  };

  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction.onClick();
      setConfirmAction(null);
    }
  };

  const renderAction = (action: QuickAction, isOverflow = false) => {
    const buttonSize = isOverflow ? 'sm' : (action.size || size);
    const showLabel = showLabels && (layout !== 'floating' || isOverflow);

    return (
      <motion.div
        key={action.id}
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        whileTap={{ scale: 0.95 }}
        className="relative"
      >
        <Button
          variant={action.variant || 'secondary'}
          size={showLabel ? buttonSize : 'icon'}
          disabled={action.disabled}
          loading={action.loading}
          onClick={() => handleActionClick(action)}
          className={cn(
            'relative',
            layout === 'vertical' && 'w-full justify-start',
            isOverflow && 'w-full justify-start'
          )}
          title={action.tooltip || action.label}
        >
          {action.icon}
          {showLabel && <span>{action.label}</span>}
          {action.shortcut && (
            <kbd className="ml-auto text-xs text-neutral-500">
              {action.shortcut}
            </kbd>
          )}
        </Button>

        {/* Badge */}
        {action.badge && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-error-500 text-white text-xs flex items-center justify-center font-medium"
          >
            {action.badge}
          </motion.span>
        )}
      </motion.div>
    );
  };

  const renderFloatingActions = () => (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {showOverflow && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-4 space-y-2"
          >
            {overflowActions.map(action => renderAction(action, true))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col-reverse gap-2">
        {displayActions.map(action => renderAction(action))}

        {overflowActions.length > 0 && (
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setShowOverflow(!showOverflow)}
            className="shadow-lg"
          >
            <motion.div
              animate={{ rotate: showOverflow ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <Plus className="h-5 w-5" />
            </motion.div>
          </Button>
        )}
      </div>
    </div>
  );

  const renderGroupedActions = () => (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onSearch?.(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>
      )}

      {Object.entries(groupedActions).map(([groupName, groupActions]) => (
        <div key={groupName} className="space-y-2">
          {groupActions && Object.keys(groupedActions).length > 1 && (
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {groupName}
            </h3>
          )}
          <div className={cn(quickActionsVariants({ layout, size, persona }))}>
            {groupActions.map(action => renderAction(action))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderHorizontalActions = () => (
    <div className={cn(quickActionsVariants({ layout, size, persona }), className)}>
      {displayActions.map(action => renderAction(action))}

      {overflowActions.length > 0 && (
        <div className="relative">
          <Button
            variant="ghost"
            size={size === 'lg' ? 'md' : 'sm'}
            onClick={() => setShowOverflow(!showOverflow)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>

          <AnimatePresence>
            {showOverflow && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-10"
                  onClick={() => setShowOverflow(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-neutral-800 dark:ring-neutral-700 z-20"
                >
                  <div className="py-1">
                    {overflowActions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => {
                          handleActionClick(action);
                          setShowOverflow(false);
                        }}
                        disabled={action.disabled}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {action.icon}
                        <span>{action.label}</span>
                        {action.shortcut && (
                          <kbd className="ml-auto text-xs text-neutral-500">
                            {action.shortcut}
                          </kbd>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  if (layout === 'floating') {
    return renderFloatingActions();
  }

  if (groupActions || searchable) {
    return renderGroupedActions();
  }

  return (
    <>
      {renderHorizontalActions()}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-lg shadow-xl dark:bg-neutral-800"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="h-6 w-6 text-warning-600" />
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    Confirm Action
                  </h3>
                </div>
                <p className="text-description mb-6">
                  {confirmAction.confirmMessage}
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmAction(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={confirmAction.variant === 'destructive' ? 'destructive' : 'primary'}
                    onClick={handleConfirmAction}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Predefined action sets for different contexts
export const ticketActions: QuickAction[] = [
  {
    id: 'create-ticket',
    label: 'New Ticket',
    icon: <Plus />,
    onClick: () => {},
    variant: 'primary',
    group: 'Create',
    shortcut: 'Ctrl+N',
  },
  {
    id: 'assign-ticket',
    label: 'Assign',
    icon: <User />,
    onClick: () => {},
    group: 'Actions',
  },
  {
    id: 'edit-ticket',
    label: 'Edit',
    icon: <Edit />,
    onClick: () => {},
    group: 'Actions',
  },
  {
    id: 'close-ticket',
    label: 'Close',
    icon: <CheckCircle />,
    onClick: () => {},
    variant: 'success',
    group: 'Actions',
  },
  {
    id: 'delete-ticket',
    label: 'Delete',
    icon: <Trash2 />,
    onClick: () => {},
    variant: 'destructive',
    group: 'Actions',
    confirmMessage: 'Are you sure you want to delete this ticket? This action cannot be undone.',
  },
];

export const dashboardActions: QuickAction[] = [
  {
    id: 'refresh',
    label: 'Refresh',
    icon: <RefreshCw />,
    onClick: () => {},
    shortcut: 'F5',
  },
  {
    id: 'filter',
    label: 'Filter',
    icon: <Filter />,
    onClick: () => {},
  },
  {
    id: 'sort',
    label: 'Sort',
    icon: <SortAsc />,
    onClick: () => {},
  },
  {
    id: 'export',
    label: 'Export',
    icon: <Download />,
    onClick: () => {},
    group: 'Data',
  },
  {
    id: 'import',
    label: 'Import',
    icon: <Upload />,
    onClick: () => {},
    group: 'Data',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings />,
    onClick: () => {},
    group: 'System',
  },
];

export const agentActions: QuickAction[] = [
  {
    id: 'quick-reply',
    label: 'Quick Reply',
    icon: <Send />,
    onClick: () => {},
    variant: 'primary',
    shortcut: 'Ctrl+R',
  },
  {
    id: 'escalate',
    label: 'Escalate',
    icon: <TrendingUp />,
    onClick: () => {},
    variant: 'secondary',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: <Calendar />,
    onClick: () => {},
  },
  {
    id: 'tag',
    label: 'Add Tag',
    icon: <Tag />,
    onClick: () => {},
  },
  {
    id: 'timer',
    label: 'Start Timer',
    icon: <Clock />,
    onClick: () => {},
  },
];

export const managerActions: QuickAction[] = [
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 />,
    onClick: () => {},
    variant: 'primary',
  },
  {
    id: 'team-performance',
    label: 'Team Performance',
    icon: <Users />,
    onClick: () => {},
  },
  {
    id: 'sla-report',
    label: 'SLA Report',
    icon: <Clock />,
    onClick: () => {},
  },
  {
    id: 'trend-analysis',
    label: 'Trends',
    icon: <TrendingUp />,
    onClick: () => {},
  },
];

// Quick Action Bar Component
export interface QuickActionBarProps {
  actions: QuickAction[];
  title?: string;
  description?: string;
  className?: string;
  persona?: 'enduser' | 'agent' | 'manager';
}

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  actions,
  title,
  description,
  className,
  persona = 'agent',
}) => {
  return (
    <div className={cn(
      'bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700',
      className
    )}>
      <div className="px-6 py-4">
        {(title || description) && (
          <div className="mb-4">
            {title && (
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-description">
                {description}
              </p>
            )}
          </div>
        )}

        <QuickActions
          actions={actions}
          layout="horizontal"
          persona={persona}
          showLabels={true}
          maxVisible={persona === 'agent' ? 8 : 6}
        />
      </div>
    </div>
  );
};

// Floating Action Button
export interface FloatingActionButtonProps {
  actions: QuickAction[];
  primaryAction?: QuickAction;
  className?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  actions,
  primaryAction,
  className,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mb-4 space-y-3"
          >
            {actions.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3"
              >
                <span className="bg-neutral-900 text-white px-3 py-1 rounded-md text-sm whitespace-nowrap">
                  {action.label}
                </span>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  className="shadow-lg"
                >
                  {action.icon}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="primary"
        size="icon-lg"
        onClick={primaryAction ? primaryAction.onClick : () => setIsOpen(!isOpen)}
        className="shadow-lg h-14 w-14"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {primaryAction?.icon || <Plus className="h-6 w-6" />}
        </motion.div>
      </Button>
    </div>
  );
};

export default QuickActions;