'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  Clock,
  User,
  MessageSquare,
  Paperclip,
  Circle,
  Calendar,
  Tag,
  MoreVertical,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/design-system/utils';
import { Button } from './Button';
import { StatusBadge } from './Table';

const ticketCardVariants = cva(
  [
    'relative overflow-hidden bg-white border transition-all duration-200',
    'dark:bg-neutral-800 dark:border-neutral-700',
    'hover:shadow-md hover:-translate-y-0.5',
    'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
  ],
  {
    variants: {
      priority: {
        low: 'border-l-4 border-l-success-500',
        medium: 'border-l-4 border-l-warning-500',
        high: 'border-l-4 border-l-orange-500',
        critical: 'border-l-4 border-l-error-500',
      },
      persona: {
        enduser: 'rounded-xl shadow-soft p-6 space-y-4',
        agent: 'rounded-lg shadow-sm p-4 space-y-3',
        manager: 'rounded-2xl shadow-md p-6 space-y-4',
      },
      layout: {
        compact: 'p-3 space-y-2',
        normal: 'p-4 space-y-3',
        comfortable: 'p-6 space-y-4',
      },
      status: {
        open: 'bg-blue-50/30 dark:bg-blue-900/5',
        'in-progress': 'bg-warning-50/30 dark:bg-warning-900/5',
        resolved: 'bg-success-50/30 dark:bg-success-900/5',
        closed: 'bg-neutral-50/30 dark:bg-neutral-800/50',
        cancelled: 'bg-error-50/30 dark:bg-error-900/5',
      },
    },
    defaultVariants: {
      priority: 'medium',
      persona: 'agent',
      layout: 'normal',
      status: 'open',
    },
  }
);

export interface TicketData {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  requester?: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt?: Date | string | number | null;
  updatedAt?: Date | string | number | null;
  dueDate?: Date | string | number | null;
  commentsCount?: number;
  attachmentsCount?: number;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
  slaStatus?: 'on-track' | 'at-risk' | 'breached';
}

// Safe date parser that never throws
function safeParseDate(input: unknown): Date | null {
  if (!input) return null;
  try {
    if (input instanceof Date) {
      return Number.isNaN(input.getTime()) ? null : input;
    }
    if (typeof input === 'string' || typeof input === 'number') {
      const d = new Date(input);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const obj = input as { toDate?: () => Date };
    if (typeof obj.toDate === 'function') {
      const d = obj.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    return null;
  } catch {
    return null;
  }
}

export interface TicketCardProps extends VariantProps<typeof ticketCardVariants> {
  ticket: TicketData;
  onClick?: (ticket: TicketData) => void;
  onEdit?: (ticket: TicketData) => void;
  onDelete?: (ticket: TicketData) => void;
  onAssign?: (ticket: TicketData) => void;
  showActions?: boolean;
  showDetails?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (ticket: TicketData, selected: boolean) => void;
  className?: string;
  compact?: boolean;
}

// Memoized TicketCard to prevent unnecessary re-renders in lists
export const TicketCard = React.memo(React.forwardRef<HTMLDivElement, TicketCardProps>(
  ({
    ticket,
    onClick,
    onEdit,
    onDelete,
    onAssign,
    showActions = true,
    showDetails = true,
    selectable = false,
    selected = false,
    onSelect,
    priority,
    persona = 'agent',
    layout,
    status,
    className,
    compact = false,
    ...props
  }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [showActionsMenu, setShowActionsMenu] = React.useState(false);

    // Memoize callbacks to prevent child re-renders
    const handleClick = React.useCallback((e: React.MouseEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('[data-action]')) {
        return;
      }
      onClick?.(ticket);
    }, [onClick, ticket]);

    const handleSelect = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onSelect?.(ticket, e.target.checked);
    }, [onSelect, ticket]);

    const actualLayout = compact ? 'compact' : layout;
    const dueDate = safeParseDate(ticket.dueDate);
    const isOverdue = !!(
      dueDate
      && new Date() > dueDate
      && ticket.status !== 'resolved'
      && ticket.status !== 'closed'
    );
    const isUrgent = ticket.priority === 'critical' || ticket.priority === 'high';

    const formatTimeAgo = (input: unknown): string => {
      const date = safeParseDate(input);
      if (!date) return 'N/A';
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
      return date.toLocaleDateString();
    };

    const getSlaStatusColor = () => {
      switch (ticket.slaStatus) {
        case 'on-track': return 'text-success-600';
        case 'at-risk': return 'text-warning-600';
        case 'breached': return 'text-error-600';
        default: return 'text-neutral-500';
      }
    };

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={cn(
          ticketCardVariants({
            priority: ticket.priority,
            persona,
            layout: actualLayout,
            status: ticket.status,
          }),
          selectable && 'cursor-pointer',
          selected && 'ring-2 ring-brand-500 ring-offset-2',
          isOverdue && 'border-error-300 bg-error-50/20 dark:bg-error-900/10',
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {/* Selection checkbox */}
        {selectable && (
          <div className="absolute top-3 left-3 z-10" data-action>
            <input
              type="checkbox"
              checked={selected}
              onChange={handleSelect}
              className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            />
          </div>
        )}

        {/* Actions menu */}
        {showActions && (
          <div className="absolute top-3 right-3 z-10" data-action>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActionsMenu(!showActionsMenu);
                }}
                className={cn(
                  'opacity-0 transition-opacity',
                  (isHovered || showActionsMenu) && 'opacity-100'
                )}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>

              {showActionsMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowActionsMenu(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-neutral-800 dark:ring-neutral-700">
                    <div className="py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClick?.(ticket);
                          setShowActionsMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                      {onEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(ticket);
                            setShowActionsMenu(false);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </button>
                      )}
                      {onAssign && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssign(ticket);
                            setShowActionsMenu(false);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700"
                        >
                          <User className="h-4 w-4" />
                          Assign
                        </button>
                      )}
                      {onDelete && (
                        <>
                          <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(ticket);
                              setShowActionsMenu(false);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className={cn('flex items-start justify-between', selectable && 'ml-6')}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-content">
                #{ticket.id}
              </span>
              <StatusBadge status={ticket.status} variant="status" />
              <StatusBadge status={ticket.priority} variant="priority" />
              {isOverdue && (
                <span className="text-xs text-error-600 dark:text-error-400 font-medium">
                  Overdue
                </span>
              )}
            </div>

            <h3 className={cn(
              'font-semibold text-neutral-900 dark:text-neutral-100 leading-tight',
              compact ? 'text-sm' : 'text-base',
              'line-clamp-2'
            )}>
              {ticket.title}
            </h3>

            {showDetails && ticket.description && !compact && (
              <p className="mt-2 text-sm text-description line-clamp-2">
                {ticket.description}
              </p>
            )}
          </div>
        </div>

        {/* Details */}
        {showDetails && (
          <div className="space-y-3">
            {/* Assignee and Requester */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                {ticket.assignee && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-neutral-400" />
                    <span className="text-neutral-700 dark:text-neutral-300">
                      {ticket.assignee.name}
                    </span>
                  </div>
                )}
                {ticket.requester && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-neutral-400" />
                    <span className="text-description">
                      {ticket.requester.name}
                    </span>
                  </div>
                )}
              </div>

              {ticket.category && (
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3 text-neutral-400" />
                  <span className="text-xs text-muted-content">
                    {ticket.category}
                  </span>
                </div>
              )}
            </div>

            {/* Meta information */}
            <div className="flex items-center justify-between text-xs text-muted-content">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeAgo(ticket.updatedAt)}</span>
                </div>

                {dueDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span className={isOverdue ? 'text-error-600' : ''}>
                      Due {formatTimeAgo(ticket.dueDate)}
                    </span>
                  </div>
                )}

                {ticket.slaStatus && (
                  <div className={cn('flex items-center gap-1', getSlaStatusColor())}>
                    <Circle className="h-2 w-2 fill-current" />
                    <span className="capitalize">{ticket.slaStatus.replace('-', ' ')}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {ticket.commentsCount !== undefined && ticket.commentsCount > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{ticket.commentsCount}</span>
                  </div>
                )}

                {ticket.attachmentsCount !== undefined && ticket.attachmentsCount > 0 && (
                  <div className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    <span>{ticket.attachmentsCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {ticket.tags && ticket.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ticket.tags.slice(0, compact ? 2 : 4).map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                  >
                    {tag}
                  </span>
                ))}
                {ticket.tags.length > (compact ? 2 : 4) && (
                  <span className="text-xs text-muted-content">
                    +{ticket.tags.length - (compact ? 2 : 4)} more
                  </span>
                )}
              </div>
            )}

            {/* Time tracking */}
            {(ticket.estimatedHours || ticket.actualHours) && !compact && (
              <div className="flex items-center gap-4 text-xs text-muted-content">
                {ticket.estimatedHours && (
                  <span>Est: {ticket.estimatedHours}h</span>
                )}
                {ticket.actualHours && (
                  <span>Actual: {ticket.actualHours}h</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Urgent indicator */}
        {isUrgent && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-error-500 rounded-full"
          />
        )}
      </motion.div>
    );
  }
));

TicketCard.displayName = 'TicketCard';

// Ticket List component
export interface TicketListProps {
  tickets: TicketData[];
  persona?: 'enduser' | 'agent' | 'manager';
  layout?: 'grid' | 'list';
  compact?: boolean;
  selectable?: boolean;
  selectedTickets?: string[];
  onTicketClick?: (ticket: TicketData) => void;
  onTicketEdit?: (ticket: TicketData) => void;
  onTicketDelete?: (ticket: TicketData) => void;
  onTicketAssign?: (ticket: TicketData) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  loading?: boolean;
  emptyText?: string;
  className?: string;
}

// Memoized TicketList for better performance with large lists
export const TicketList: React.FC<TicketListProps> = React.memo(({
  tickets,
  persona = 'agent',
  layout = 'grid',
  compact = false,
  selectable = false,
  selectedTickets = [],
  onTicketClick,
  onTicketEdit,
  onTicketDelete,
  onTicketAssign,
  onSelectionChange,
  loading = false,
  emptyText = 'No tickets found',
  className,
}) => {
  // Memoize selection handler
  const handleTicketSelect = React.useCallback((ticket: TicketData, selected: boolean) => {
    if (!onSelectionChange) return;

    const newSelection = selected
      ? [...selectedTickets, ticket.id]
      : selectedTickets.filter(id => id !== ticket.id);

    onSelectionChange(newSelection);
  }, [onSelectionChange, selectedTickets]);

  if (loading) {
    return (
      <div className={cn(
        layout === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
          : 'space-y-4',
        className
      )}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 animate-pulse"
          >
            <div className="space-y-3">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4" />
              <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
              <div className="space-y-2">
                <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded" />
                <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded w-5/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-content text-lg">
          {emptyText}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      layout === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
        : 'space-y-4',
      className
    )}>
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          persona={persona}
          compact={compact}
          selectable={selectable}
          selected={selectedTickets.includes(ticket.id)}
          onClick={onTicketClick}
          onEdit={onTicketEdit}
          onDelete={onTicketDelete}
          onAssign={onTicketAssign}
          onSelect={handleTicketSelect}
        />
      ))}
    </div>
  );
});

TicketList.displayName = 'TicketList';

export default TicketCard;
