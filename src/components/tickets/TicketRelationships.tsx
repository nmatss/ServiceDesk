/**
 * Ticket Relationships Component
 *
 * Display and manage relationships between tickets.
 *
 * @module src/components/tickets/TicketRelationships
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  LinkIcon,
  PlusIcon,
  XMarkIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
  DocumentDuplicateIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';

type RelationshipType = 'parent' | 'child' | 'related' | 'duplicate' | 'blocks' | 'blocked_by';

interface RelatedTicket {
  id: number;
  ticket_number: string;
  title: string;
  status_id: number;
  status_name?: string;
  priority_id: number;
  priority_name?: string;
  relationship_type: RelationshipType;
  relationship_id: number;
}

interface RelationshipCounts {
  parents: number;
  children: number;
  related: number;
  duplicates: number;
  blocking: number;
  blockedBy: number;
  total: number;
}

interface TicketRelationshipsProps {
  ticketId: number;
  userId?: number;
  readOnly?: boolean;
  onRelationshipChange?: () => void;
  className?: string;
}

const RELATIONSHIP_CONFIG: Record<RelationshipType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}> = {
  parent: {
    label: 'Parent',
    icon: ArrowUpIcon,
    color: 'blue',
    description: 'This ticket is a subtask of',
  },
  child: {
    label: 'Child',
    icon: ArrowDownIcon,
    color: 'blue',
    description: 'This ticket has subtask',
  },
  related: {
    label: 'Related',
    icon: ArrowsRightLeftIcon,
    color: 'gray',
    description: 'Related to',
  },
  duplicate: {
    label: 'Duplicate',
    icon: DocumentDuplicateIcon,
    color: 'amber',
    description: 'Duplicate of',
  },
  blocks: {
    label: 'Blocks',
    icon: NoSymbolIcon,
    color: 'red',
    description: 'Blocks',
  },
  blocked_by: {
    label: 'Blocked by',
    icon: ExclamationTriangleIcon,
    color: 'orange',
    description: 'Blocked by',
  },
};

export function TicketRelationships({
  ticketId,
  userId,
  readOnly = false,
  onRelationshipChange,
  className = '',
}: TicketRelationshipsProps) {
  const [relationships, setRelationships] = useState<Record<RelationshipType, RelatedTicket[]>>({
    parent: [],
    child: [],
    related: [],
    duplicate: [],
    blocks: [],
    blocked_by: [],
  });
  const [counts, setCounts] = useState<RelationshipCounts>({
    parents: 0,
    children: 0,
    related: 0,
    duplicates: 0,
    blocking: 0,
    blockedBy: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<RelationshipType>('related');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchRelationships();
  }, [ticketId]);

  const fetchRelationships = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/relationships`);
      if (response.ok) {
        const data = await response.json();
        setRelationships(data.relationships);
        setCounts(data.counts);
      }
    } catch (error) {
      console.error('Error fetching relationships:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchTickets = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}&type=tickets&limit=10`);
      if (response.ok) {
        const data = await response.json();
        // Filter out current ticket and already related tickets
        const allRelatedIds = Object.values(relationships).flat().map(r => r.id);
        const filtered = (data.tickets || data).filter(
          (t: any) => t.id !== ticketId && !allRelatedIds.includes(t.id)
        );
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Error searching tickets:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchTickets(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const addRelationship = async (targetTicketId: number) => {
    if (!userId) return;

    setIsAdding(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTicketId,
          relationshipType: selectedType,
          userId,
        }),
      });

      if (response.ok) {
        await fetchRelationships();
        onRelationshipChange?.();
        setIsAddModalOpen(false);
        setSearchTerm('');
        setSearchResults([]);
      } else {
        const error = await response.json();
        console.error('Error adding relationship:', error);
      }
    } catch (error) {
      console.error('Error adding relationship:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const removeRelationship = async (relationshipId: number) => {
    if (!userId) return;

    try {
      const response = await fetch(
        `/api/tickets/${ticketId}/relationships?relationshipId=${relationshipId}&userId=${userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await fetchRelationships();
        onRelationshipChange?.();
      }
    } catch (error) {
      console.error('Error removing relationship:', error);
    }
  };

  const getStatusColor = (statusName?: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-100 text-blue-700',
      'in-progress': 'bg-yellow-100 text-yellow-700',
      pending: 'bg-pink-100 text-pink-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700',
    };
    return colors[statusName?.toLowerCase() || ''] || 'bg-gray-100 text-gray-700';
  };

  const hasRelationships = counts.total > 0;

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-gray-400" />
          Relationships
          {counts.total > 0 && (
            <span className="text-xs text-gray-400">({counts.total})</span>
          )}
        </h3>
        {!readOnly && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            <PlusIcon className="h-3 w-3" />
            Add Link
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-500" />
        </div>
      ) : !hasRelationships ? (
        <p className="text-xs text-gray-400 italic py-2">No linked tickets</p>
      ) : (
        <div className="space-y-3">
          {(Object.entries(RELATIONSHIP_CONFIG) as [RelationshipType, typeof RELATIONSHIP_CONFIG[RelationshipType]][]).map(
            ([type, config]) => {
              const items = relationships[type];
              if (!items || items.length === 0) return null;

              const Icon = config.icon;

              return (
                <div key={type}>
                  <h4 className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    {config.label} ({items.length})
                  </h4>
                  <div className="space-y-1">
                    {items.map((ticket) => (
                      <div
                        key={ticket.relationship_id}
                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <a
                            href={`/tickets/${ticket.id}`}
                            className="text-xs font-mono text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            #{ticket.ticket_number}
                          </a>
                          <span className="text-xs text-gray-700 truncate max-w-48">
                            {ticket.title}
                          </span>
                          {ticket.status_name && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(ticket.status_name)}`}>
                              {ticket.status_name}
                            </span>
                          )}
                        </div>
                        {!readOnly && (
                          <button
                            onClick={() => removeRelationship(ticket.relationship_id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                            title="Remove link"
                          >
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Add Relationship Modal */}
      <Transition appear show={isAddModalOpen} as={React.Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsAddModalOpen(false)}
        >
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={React.Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-white shadow-2xl transition-all">
                  {/* Header */}
                  <div className="border-b border-gray-200 px-6 py-4">
                    <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <LinkIcon className="h-5 w-5 text-blue-500" />
                      Link Ticket
                    </Dialog.Title>
                  </div>

                  {/* Content */}
                  <div className="px-6 py-4 space-y-4">
                    {/* Relationship Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Link Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(RELATIONSHIP_CONFIG) as [RelationshipType, typeof RELATIONSHIP_CONFIG[RelationshipType]][]).map(
                          ([type, config]) => {
                            const Icon = config.icon;
                            return (
                              <button
                                key={type}
                                onClick={() => setSelectedType(type)}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                                  selectedType === type
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                                <span className="text-sm font-medium">{config.label}</span>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Search Ticket
                      </label>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by number or title..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Search Results */}
                    <div className="max-h-48 overflow-y-auto">
                      {isSearching ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-500" />
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="space-y-1">
                          {searchResults.map((ticket) => (
                            <button
                              key={ticket.id}
                              onClick={() => addRelationship(ticket.id)}
                              disabled={isAdding}
                              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50"
                            >
                              <span className="text-xs font-mono text-blue-600">
                                #{ticket.ticket_number}
                              </span>
                              <span className="text-sm text-gray-700 truncate flex-1">
                                {ticket.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : searchTerm.trim() ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No tickets found
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-4">
                          Type to search for tickets
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 rounded-b-xl">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setIsAddModalOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

export default TicketRelationships;
