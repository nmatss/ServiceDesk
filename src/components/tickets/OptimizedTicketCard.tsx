'use client';

/**
 * OptimizedTicketCard - Performance-Optimized Ticket Card Component
 *
 * Uses React.memo and useCallback to prevent unnecessary re-renders.
 * Implements proper accessibility (a11y) with keyboard navigation and ARIA labels.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ClockIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  PaperClipIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Types
export interface TicketCardData {
  id: number;
  title: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  user_name?: string;
  assigned_agent_name?: string;
  category_name?: string;
  category_color?: string;
  priority_name?: string;
  priority_level?: number;
  priority_color?: string;
  status_name?: string;
  status_color?: string;
  status_is_final?: boolean;
  comments_count?: number;
  attachments_count?: number;
  sla_breached?: boolean;
}

export interface TicketCardProps {
  ticket: TicketCardData;
  onClick?: (ticketId: number) => void;
  onAssign?: (ticketId: number) => void;
  selected?: boolean;
  showDescription?: boolean;
  className?: string;
}

// Priority color mapping (memoized outside component)
const PRIORITY_CLASSES: Record<number, string> = {
  1: 'bg-green-100 text-green-800 border-green-200',
  2: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  3: 'bg-orange-100 text-orange-800 border-orange-200',
  4: 'bg-red-100 text-red-800 border-red-200'
};

// Memoized sub-components
const PriorityBadge = memo(function PriorityBadge({
  name,
  level
}: {
  name?: string;
  level?: number;
}) {
  const className = useMemo(() => {
    return PRIORITY_CLASSES[level || 1] || PRIORITY_CLASSES[1];
  }, [level]);

  if (!name) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
      aria-label={`Prioridade: ${name}`}
    >
      {name}
    </span>
  );
});

const StatusBadge = memo(function StatusBadge({
  name,
  color,
  isFinal
}: {
  name?: string;
  color?: string;
  isFinal?: boolean;
}) {
  const style = useMemo(() => ({
    backgroundColor: color ? `${color}20` : undefined,
    color: color || undefined,
    borderColor: color ? `${color}40` : undefined
  }), [color]);

  if (!name) return null;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
      style={style}
      aria-label={`Status: ${name}${isFinal ? ' (Finalizado)' : ''}`}
    >
      {name}
      {isFinal && (
        <span className="ml-1" aria-hidden="true">✓</span>
      )}
    </span>
  );
});

const CategoryBadge = memo(function CategoryBadge({
  name,
  color
}: {
  name?: string;
  color?: string;
}) {
  const style = useMemo(() => ({
    backgroundColor: color ? `${color}15` : undefined,
    color: color || undefined
  }), [color]);

  if (!name) return null;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={style}
      aria-label={`Categoria: ${name}`}
    >
      {name}
    </span>
  );
});

// Main component
function TicketCardComponent({
  ticket,
  onClick,
  onAssign,
  selected = false,
  showDescription = false,
  className = ''
}: TicketCardProps) {
  // Memoized date formatting
  const formattedDate = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(ticket.created_at), {
        addSuffix: true,
        locale: ptBR
      });
    } catch {
      return 'Data inválida';
    }
  }, [ticket.created_at]);

  // Memoized click handler
  const handleClick = useCallback(() => {
    onClick?.(ticket.id);
  }, [onClick, ticket.id]);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(ticket.id);
    }
  }, [onClick, ticket.id]);

  // Memoized assign handler
  const handleAssign = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onAssign?.(ticket.id);
  }, [onAssign, ticket.id]);

  // Memoized class names
  const cardClassName = useMemo(() => {
    return [
      'group relative bg-white dark:bg-gray-800 rounded-lg border p-4 transition-all duration-200',
      'hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600',
      'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
      selected ? 'ring-2 ring-primary-500 border-primary-500' : 'border-gray-200 dark:border-gray-700',
      onClick ? 'cursor-pointer' : '',
      className
    ].filter(Boolean).join(' ');
  }, [selected, onClick, className]);

  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : -1}
      className={cardClassName}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Ticket #${ticket.id}: ${ticket.title}`}
      aria-pressed={selected}
    >
      {/* SLA Breach Warning */}
      {ticket.sla_breached && (
        <div
          className="absolute top-2 right-2 text-red-500"
          title="SLA Ultrapassado"
          aria-label="Alerta: SLA ultrapassado"
        >
          <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            <span className="text-gray-500 dark:text-gray-400 mr-1">#{ticket.id}</span>
            {ticket.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <PriorityBadge name={ticket.priority_name} level={ticket.priority_level} />
          <StatusBadge
            name={ticket.status_name}
            color={ticket.status_color}
            isFinal={ticket.status_is_final}
          />
        </div>
      </div>

      {/* Description (optional) */}
      {showDescription && ticket.description && (
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
          {ticket.description}
        </p>
      )}

      {/* Category */}
      {ticket.category_name && (
        <div className="mb-3">
          <CategoryBadge name={ticket.category_name} color={ticket.category_color} />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          {/* User */}
          {ticket.user_name && (
            <div className="flex items-center gap-1" title={`Criado por: ${ticket.user_name}`}>
              <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate max-w-[100px]">{ticket.user_name}</span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-1" title={`Criado: ${ticket.created_at}`}>
            <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{formattedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Comments count */}
          {(ticket.comments_count ?? 0) > 0 && (
            <div
              className="flex items-center gap-1"
              title={`${ticket.comments_count} comentário(s)`}
              aria-label={`${ticket.comments_count} comentários`}
            >
              <ChatBubbleLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{ticket.comments_count}</span>
            </div>
          )}

          {/* Attachments count */}
          {(ticket.attachments_count ?? 0) > 0 && (
            <div
              className="flex items-center gap-1"
              title={`${ticket.attachments_count} anexo(s)`}
              aria-label={`${ticket.attachments_count} anexos`}
            >
              <PaperClipIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{ticket.attachments_count}</span>
            </div>
          )}

          {/* Assigned agent */}
          {ticket.assigned_agent_name ? (
            <div
              className="flex items-center gap-1 text-primary-600 dark:text-primary-400"
              title={`Atribuído a: ${ticket.assigned_agent_name}`}
            >
              <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate max-w-[80px]">{ticket.assigned_agent_name}</span>
            </div>
          ) : onAssign && (
            <button
              type="button"
              onClick={handleAssign}
              className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              title="Atribuir ticket"
              aria-label="Atribuir ticket"
            >
              <UserIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Atribuir</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Export memoized component
export const OptimizedTicketCard = memo(TicketCardComponent, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.ticket.id === nextProps.ticket.id &&
    prevProps.ticket.title === nextProps.ticket.title &&
    prevProps.ticket.status_name === nextProps.ticket.status_name &&
    prevProps.ticket.priority_name === nextProps.ticket.priority_name &&
    prevProps.ticket.assigned_agent_name === nextProps.ticket.assigned_agent_name &&
    prevProps.ticket.comments_count === nextProps.ticket.comments_count &&
    prevProps.ticket.attachments_count === nextProps.ticket.attachments_count &&
    prevProps.ticket.sla_breached === nextProps.ticket.sla_breached &&
    prevProps.selected === nextProps.selected &&
    prevProps.showDescription === nextProps.showDescription &&
    prevProps.className === nextProps.className
  );
});

export default OptimizedTicketCard;
