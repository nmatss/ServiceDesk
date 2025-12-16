/**
 * Quick Replies / Macros Component
 *
 * Display and select macros (quick reply templates) for tickets.
 *
 * @module src/components/tickets/QuickReplies
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BoltIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  CheckIcon,
  ClockIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';

interface MacroAction {
  type: 'set_status' | 'set_priority' | 'assign' | 'add_tag' | 'remove_tag' | 'add_comment';
  value: string | number;
  is_internal?: boolean;
}

interface Macro {
  id: number;
  name: string;
  description?: string;
  content: string;
  actions: MacroAction[];
  category_id?: number;
  category_name?: string;
  usage_count?: number;
  is_shared: boolean;
  created_by: number;
  created_by_name?: string;
}

interface QuickRepliesProps {
  ticketId: number;
  userId: number;
  categoryId?: number;
  onMacroApplied?: (macro: Macro, result: any) => void;
  onContentSelect?: (content: string) => void;
  triggerButton?: React.ReactNode;
  className?: string;
}

export function QuickReplies({
  ticketId,
  userId,
  categoryId,
  onMacroApplied,
  onContentSelect,
  triggerButton,
  className = '',
}: QuickRepliesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [previewMacro, setPreviewMacro] = useState<Macro | null>(null);

  // Fetch macros
  useEffect(() => {
    if (isOpen) {
      fetchMacros();
    }
  }, [isOpen, userId, categoryId]);

  const fetchMacros = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('userId', userId.toString());
      if (categoryId) params.set('categoryId', categoryId.toString());
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/macros?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setMacros(data);
      }
    } catch (error) {
      console.error('Error fetching macros:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchMacros();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Group macros by category - available for future use if needed
  /*
  const groupedMacros = useMemo(() => {
    const groups: Record<string, Macro[]> = {};

    macros.forEach((macro) => {
      const category = macro.category_name || 'General';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(macro);
    });

    return groups;
  }, [macros]);
  */

  // Filter by selected category
  const filteredMacros = useMemo(() => {
    if (selectedCategory === null) return macros;
    return macros.filter((m) => m.category_id === selectedCategory);
  }, [macros, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Map<number, string>();
    macros.forEach((m) => {
      if (m.category_id && m.category_name) {
        cats.set(m.category_id, m.category_name);
      }
    });
    return Array.from(cats.entries());
  }, [macros]);

  const applyMacro = async (macro: Macro) => {
    setIsApplying(true);
    try {
      const response = await fetch(`/api/macros/${macro.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          userId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onMacroApplied?.(macro, result);
        setIsOpen(false);
      } else {
        const error = await response.json();
        console.error('Error applying macro:', error);
      }
    } catch (error) {
      console.error('Error applying macro:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const insertContent = (macro: Macro) => {
    onContentSelect?.(macro.content);
    setIsOpen(false);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'set_status':
        return '📊';
      case 'set_priority':
        return '🔥';
      case 'assign':
        return '👤';
      case 'add_tag':
        return '🏷️';
      case 'remove_tag':
        return '🗑️';
      case 'add_comment':
        return '💬';
      default:
        return '⚙️';
    }
  };

  const formatActionDescription = (action: MacroAction) => {
    switch (action.type) {
      case 'set_status':
        return `Set status to ${action.value}`;
      case 'set_priority':
        return `Set priority to ${action.value}`;
      case 'assign':
        return `Assign to user ${action.value}`;
      case 'add_tag':
        return `Add tag "${action.value}"`;
      case 'remove_tag':
        return `Remove tag "${action.value}"`;
      case 'add_comment':
        return `Add ${action.is_internal ? 'internal ' : ''}comment`;
      default:
        return action.type;
    }
  };

  return (
    <>
      {/* Trigger Button */}
      {triggerButton ? (
        <div onClick={() => setIsOpen(true)} className={className}>
          {triggerButton}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${className}`}
        >
          <BoltIcon className="h-4 w-4" />
          Quick Replies
        </button>
      )}

      {/* Modal */}
      <Transition appear show={isOpen} as={React.Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsOpen(false)}
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
                <Dialog.Panel className="w-full max-w-2xl transform rounded-xl bg-white shadow-2xl transition-all">
                  {/* Header */}
                  <div className="border-b border-gray-200 px-6 py-4">
                    <Dialog.Title className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <BoltIcon className="h-5 w-5 text-amber-500" />
                      Quick Replies
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-500">
                      Select a macro to apply actions or insert content
                    </p>
                  </div>

                  {/* Search */}
                  <div className="border-b border-gray-200 px-6 py-3">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search macros..."
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Category Filter */}
                    {categories.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                        <button
                          onClick={() => setSelectedCategory(null)}
                          className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                            selectedCategory === null
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          All
                        </button>
                        {categories.map(([id, name]) => (
                          <button
                            key={id}
                            onClick={() => setSelectedCategory(id)}
                            className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                              selectedCategory === id
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex max-h-96 min-h-64">
                    {/* Macros List */}
                    <div className={`flex-1 overflow-y-auto ${previewMacro ? 'border-r border-gray-200' : ''}`}>
                      {isLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-500" />
                        </div>
                      ) : filteredMacros.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                          <BoltIcon className="h-8 w-8 mb-2" />
                          <p className="text-sm">No macros found</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {filteredMacros.map((macro) => (
                            <div
                              key={macro.id}
                              className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                                previewMacro?.id === macro.id ? 'bg-blue-50' : ''
                              }`}
                              onClick={() => setPreviewMacro(macro)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-gray-900 truncate">
                                    {macro.name}
                                  </h4>
                                  {macro.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                      {macro.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-1.5">
                                    {macro.category_name && (
                                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                        <FolderIcon className="h-3 w-3" />
                                        {macro.category_name}
                                      </span>
                                    )}
                                    {macro.usage_count !== undefined && macro.usage_count > 0 && (
                                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                        <ClockIcon className="h-3 w-3" />
                                        Used {macro.usage_count}x
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <ChevronRightIcon className="h-4 w-4 text-gray-400 ml-2 flex-shrink-0" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Preview Panel */}
                    {previewMacro && (
                      <div className="w-72 p-4 overflow-y-auto bg-gray-50">
                        <h4 className="font-medium text-gray-900 mb-2">
                          {previewMacro.name}
                        </h4>

                        {/* Content Preview */}
                        {previewMacro.content && (
                          <div className="mb-4">
                            <h5 className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                              Content
                            </h5>
                            <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 max-h-32 overflow-y-auto">
                              {previewMacro.content}
                            </div>
                          </div>
                        )}

                        {/* Actions Preview */}
                        {previewMacro.actions.length > 0 && (
                          <div className="mb-4">
                            <h5 className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                              Actions
                            </h5>
                            <ul className="space-y-1">
                              {previewMacro.actions.map((action, idx) => (
                                <li
                                  key={idx}
                                  className="text-xs text-gray-600 flex items-center gap-2"
                                >
                                  <span>{getActionIcon(action.type)}</span>
                                  <span>{formatActionDescription(action)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => applyMacro(previewMacro)}
                            disabled={isApplying}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isApplying ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                Applying...
                              </>
                            ) : (
                              <>
                                <CheckIcon className="h-4 w-4" />
                                Apply Macro
                              </>
                            )}
                          </button>

                          {previewMacro.content && onContentSelect && (
                            <button
                              onClick={() => insertContent(previewMacro)}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                            >
                              Insert Content Only
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 rounded-b-xl">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {filteredMacros.length} macro{filteredMacros.length !== 1 ? 's' : ''} available
                      </p>
                      <button
                        onClick={() => setIsOpen(false)}
                        className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
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
    </>
  );
}

export default QuickReplies;
