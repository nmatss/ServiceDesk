/**
 * Kanban Board Component
 *
 * Drag-and-drop kanban board for ticket management.
 *
 * @module src/components/tickets/KanbanBoard
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  PlusIcon,
  EllipsisHorizontalIcon,
  UserCircleIcon,
  ClockIcon,
  TagIcon,
  ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline';

interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description?: string;
  status_id: number;
  status_name: string;
  priority_id: number;
  priority_name: string;
  category_name?: string;
  assigned_to?: number;
  assigned_to_name?: string;
  created_at: string;
  updated_at: string;
  comments_count?: number;
  tags?: { id: number; name: string; color: string }[];
}

interface Status {
  id: number;
  name: string;
  color: string;
  order: number;
}

interface KanbanBoardProps {
  organizationId?: number;
  userId?: number;
  onTicketClick?: (ticket: Ticket) => void;
  onStatusChange?: (ticketId: number, newStatusId: number) => void;
  className?: string;
}

// Sortable Ticket Card
function SortableTicketCard({
  ticket,
  onClick,
}: {
  ticket: Ticket;
  onClick?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-mono text-gray-500">
          #{ticket.ticket_number}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded border ${
            priorityColors[ticket.priority_name?.toLowerCase()] ||
            'bg-gray-100 text-gray-700 border-gray-200'
          }`}
        >
          {ticket.priority_name}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
        {ticket.title}
      </h4>

      {/* Tags */}
      {ticket.tags && ticket.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {ticket.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
          {ticket.tags.length > 3 && (
            <span className="text-xs text-gray-400">
              +{ticket.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {ticket.assigned_to_name ? (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <UserCircleIcon className="h-4 w-4" />
              <span className="truncate max-w-16">{ticket.assigned_to_name}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">Unassigned</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-gray-400">
          {ticket.comments_count !== undefined && ticket.comments_count > 0 && (
            <div className="flex items-center gap-0.5 text-xs">
              <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
              <span>{ticket.comments_count}</span>
            </div>
          )}
          <div className="flex items-center gap-0.5 text-xs">
            <ClockIcon className="h-3.5 w-3.5" />
            <span>{formatTimeAgo(ticket.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Kanban Column
function KanbanColumn({
  status,
  tickets,
  onTicketClick,
  onAddTicket,
}: {
  status: Status;
  tickets: Ticket[];
  onTicketClick?: (ticket: Ticket) => void;
  onAddTicket?: (statusId: number) => void;
}) {
  const statusColors: Record<string, { bg: string; border: string; text: string }> = {
    open: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    'in-progress': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
    pending: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
    resolved: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    closed: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
  };

  const colors = statusColors[status.name.toLowerCase()] || statusColors.open;
  const bgClass = colors?.bg || 'bg-blue-50';
  const borderClass = colors?.border || 'border-blue-200';
  const textClass = colors?.text || 'text-blue-700';

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-t-2 ${bgClass} ${borderClass}`}
        style={{ borderTopColor: status.color || '#3b82f6' }}
      >
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-semibold ${textClass}`}>
            {status.name}
          </h3>
          <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded-full">
            {tickets.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onAddTicket && (
            <button
              onClick={() => onAddTicket(status.id)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-white/50 transition-colors"
              title="Add ticket"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          )}
          <button
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-white/50 transition-colors"
            title="Column options"
          >
            <EllipsisHorizontalIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Column Content */}
      <div
        className={`flex-1 p-2 space-y-2 rounded-b-lg border border-t-0 ${borderClass} ${bgClass} min-h-96 overflow-y-auto`}
      >
        <SortableContext
          items={tickets.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tickets.map((ticket) => (
            <SortableTicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick?.(ticket)}
            />
          ))}
        </SortableContext>

        {tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-2">
              <TagIcon className="h-6 w-6" />
            </div>
            <p className="text-sm">No tickets</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Ticket Preview for DragOverlay
function TicketPreview({ ticket }: { ticket: Ticket }) {
  return (
    <div className="bg-white rounded-lg border-2 border-blue-400 p-3 shadow-xl w-72 rotate-3">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-mono text-gray-500">
          #{ticket.ticket_number}
        </span>
      </div>
      <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
        {ticket.title}
      </h4>
    </div>
  );
}

// Main Kanban Board
export function KanbanBoard({
  organizationId = 1,
  onTicketClick,
  onStatusChange,
  className = '',
}: KanbanBoardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch data
  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch statuses and tickets in parallel
      const [statusesRes, ticketsRes] = await Promise.all([
        fetch('/api/statuses'),
        fetch(`/api/tickets?organizationId=${organizationId}&limit=200`),
      ]);

      if (statusesRes.ok) {
        const statusData = await statusesRes.json();
        setStatuses(statusData.sort((a: Status, b: Status) => a.order - b.order));
      }

      if (ticketsRes.ok) {
        const ticketData = await ticketsRes.json();
        setTickets(ticketData.tickets || ticketData);
      }
    } catch (error) {
      console.error('Error fetching kanban data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group tickets by status
  const ticketsByStatus = useCallback(() => {
    const grouped: Record<number, Ticket[]> = {};
    statuses.forEach((status) => {
      grouped[status.id] = [];
    });
    tickets.forEach((ticket) => {
      const statusGroup = grouped[ticket.status_id];
      if (statusGroup !== undefined) {
        statusGroup.push(ticket);
      }
    });
    return grouped;
  }, [tickets, statuses]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    if (ticket) {
      setActiveTicket(ticket);
    }
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over logic if needed
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);

    if (!over) return;

    const activeTicket = tickets.find((t) => t.id === active.id);
    if (!activeTicket) return;

    // Find the target status
    let targetStatusId: number | null = null;

    // Check if dropped over another ticket
    const overTicket = tickets.find((t) => t.id === over.id);
    if (overTicket) {
      targetStatusId = overTicket.status_id;
    } else {
      // Check if dropped over a column
      const statusId = parseInt(over.id.toString());
      if (statuses.some((s) => s.id === statusId)) {
        targetStatusId = statusId;
      }
    }

    if (targetStatusId && targetStatusId !== activeTicket.status_id) {
      // Update ticket status
      try {
        const response = await fetch(`/api/tickets/${activeTicket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status_id: targetStatusId }),
        });

        if (response.ok) {
          // Update local state
          setTickets((prev) =>
            prev.map((t) =>
              t.id === activeTicket.id
                ? {
                    ...t,
                    status_id: targetStatusId!,
                    status_name: statuses.find((s) => s.id === targetStatusId)?.name || t.status_name,
                  }
                : t
            )
          );
          onStatusChange?.(activeTicket.id, targetStatusId);
        }
      } catch (error) {
        console.error('Error updating ticket status:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className={`flex gap-4 p-4 overflow-x-auto ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-72 flex-shrink-0 animate-pulse">
            <div className="h-10 bg-gray-200 rounded-t-lg" />
            <div className="h-96 bg-gray-100 rounded-b-lg p-2 space-y-2">
              <div className="h-24 bg-gray-200 rounded-lg" />
              <div className="h-24 bg-gray-200 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const grouped = ticketsByStatus();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex gap-4 p-4 overflow-x-auto ${className}`}>
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tickets={grouped[status.id] || []}
            onTicketClick={onTicketClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket ? <TicketPreview ticket={activeTicket} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Helper function
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export default KanbanBoard;
