/**
 * Command Palette Component
 *
 * Global search and command interface with Cmd+K shortcut support.
 * Provides quick access to actions, navigation, and global search across the system.
 */

'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { logger } from '@/lib/monitoring/logger';
import {
  MagnifyingGlassIcon,
  CommandLineIcon,
  DocumentTextIcon,
  UserIcon,
  CogIcon,
  ChatBubbleLeftRightIcon,
  FolderIcon,
  BookOpenIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  StarIcon,
  TagIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { PersonaType } from '../../../lib/design-system/tokens';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  persona?: PersonaType;
  className?: string;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  keywords: string[];
  action: () => void;
  shortcut?: string;
  recent?: boolean;
  starred?: boolean;
}

interface CommandCategory {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export function CommandPalette({ isOpen, onClose, persona = 'agent', className = '' }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Command categories
  const categories: Record<string, CommandCategory> = {
    navigation: {
      name: 'Navigation',
      icon: FolderIcon,
      color: 'text-blue-600'
    },
    tickets: {
      name: 'Tickets',
      icon: ChatBubbleLeftRightIcon,
      color: 'text-green-600'
    },
    users: {
      name: 'Users',
      icon: UserIcon,
      color: 'text-purple-600'
    },
    settings: {
      name: 'Settings',
      icon: CogIcon,
      color: 'text-gray-600'
    },
    knowledge: {
      name: 'Knowledge',
      icon: BookOpenIcon,
      color: 'text-amber-600'
    },
    actions: {
      name: 'Actions',
      icon: BoltIcon,
      color: 'text-red-600'
    }
  };

  // Mock command data - in real app, this would come from props or context
  const allCommands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      subtitle: 'View main dashboard',
      icon: FolderIcon,
      category: 'navigation',
      keywords: ['dashboard', 'home', 'main'],
      action: () => logger.info('Navigate to dashboard'),
      shortcut: 'G D',
      recent: true
    },
    {
      id: 'nav-tickets',
      title: 'Go to Tickets',
      subtitle: 'View all tickets',
      icon: ChatBubbleLeftRightIcon,
      category: 'navigation',
      keywords: ['tickets', 'support', 'requests'],
      action: () => logger.info('Navigate to tickets'),
      shortcut: 'G T'
    },
    {
      id: 'nav-kb',
      title: 'Go to Knowledge Base',
      subtitle: 'Browse articles and documentation',
      icon: BookOpenIcon,
      category: 'navigation',
      keywords: ['knowledge', 'kb', 'articles', 'docs'],
      action: () => logger.info('Navigate to KB'),
      shortcut: 'G K'
    },

    // Tickets
    {
      id: 'ticket-new',
      title: 'Create New Ticket',
      subtitle: 'Start a new support request',
      icon: ChatBubbleLeftRightIcon,
      category: 'tickets',
      keywords: ['new', 'create', 'ticket', 'support'],
      action: () => logger.info('Create ticket'),
      shortcut: 'N T',
      starred: true
    },
    {
      id: 'ticket-search',
      title: 'Search Tickets',
      subtitle: 'Find specific tickets',
      icon: MagnifyingGlassIcon,
      category: 'tickets',
      keywords: ['search', 'find', 'tickets'],
      action: () => logger.info('Search tickets'),
      shortcut: '/ T'
    },
    {
      id: 'ticket-assign',
      title: 'Bulk Assign Tickets',
      subtitle: 'Assign multiple tickets at once',
      icon: UserIcon,
      category: 'tickets',
      keywords: ['assign', 'bulk', 'tickets'],
      action: () => logger.info('Bulk assign'),
      recent: true
    },

    // Users
    {
      id: 'user-search',
      title: 'Search Users',
      subtitle: 'Find customers and agents',
      icon: MagnifyingGlassIcon,
      category: 'users',
      keywords: ['users', 'customers', 'agents', 'search'],
      action: () => logger.info('Search users'),
      shortcut: '/ U'
    },
    {
      id: 'user-new',
      title: 'Create New User',
      subtitle: 'Add new customer or agent',
      icon: UserIcon,
      category: 'users',
      keywords: ['new', 'user', 'customer', 'agent'],
      action: () => logger.info('Create user'),
      shortcut: 'N U'
    },

    // Knowledge Base
    {
      id: 'kb-search',
      title: 'Search Knowledge Base',
      subtitle: 'Find articles and solutions',
      icon: MagnifyingGlassIcon,
      category: 'knowledge',
      keywords: ['search', 'kb', 'knowledge', 'articles'],
      action: () => logger.info('Search KB'),
      shortcut: '/ K',
      recent: true
    },
    {
      id: 'kb-new',
      title: 'Create New Article',
      subtitle: 'Add knowledge base article',
      icon: DocumentTextIcon,
      category: 'knowledge',
      keywords: ['new', 'article', 'kb', 'knowledge'],
      action: () => logger.info('Create article'),
      shortcut: 'N A'
    },

    // Actions
    {
      id: 'action-refresh',
      title: 'Refresh Data',
      subtitle: 'Update all data views',
      icon: BoltIcon,
      category: 'actions',
      keywords: ['refresh', 'update', 'reload'],
      action: () => logger.info('Refresh'),
      shortcut: 'R R'
    },
    {
      id: 'action-export',
      title: 'Export Data',
      subtitle: 'Download current view as CSV',
      icon: DocumentTextIcon,
      category: 'actions',
      keywords: ['export', 'download', 'csv'],
      action: () => logger.info('Export'),
      shortcut: 'E X'
    },

    // Settings
    {
      id: 'settings-profile',
      title: 'Profile Settings',
      subtitle: 'Manage your account',
      icon: UserIcon,
      category: 'settings',
      keywords: ['profile', 'account', 'settings'],
      action: () => logger.info('Profile settings'),
      shortcut: ', P'
    },
    {
      id: 'settings-notifications',
      title: 'Notification Settings',
      subtitle: 'Configure alerts and notifications',
      icon: CogIcon,
      category: 'settings',
      keywords: ['notifications', 'alerts', 'settings'],
      action: () => logger.info('Notification settings'),
      shortcut: ', N'
    }
  ];

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent and starred when no query
      const recent = allCommands.filter(cmd => cmd.recent).slice(0, 5);
      const starred = allCommands.filter(cmd => cmd.starred).slice(0, 3);
      return [...starred, ...recent];
    }

    const queryLower = query.toLowerCase();
    return allCommands.filter(command => {
      return (
        command.title.toLowerCase().includes(queryLower) ||
        command.subtitle?.toLowerCase().includes(queryLower) ||
        command.keywords.some(keyword => keyword.toLowerCase().includes(queryLower))
      );
    }).slice(0, 10);
  }, [query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(command => {
      if (!groups[command.category]) {
        groups[command.category] = [];
      }
      groups[command.category].push(command);
    });
    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Would trigger opening from parent component
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleCommandSelect = (command: CommandItem) => {
    command.action();
    onClose();
  };

  const getPersonaClasses = () => {
    switch (persona) {
      case 'enduser':
        return 'max-w-2xl';
      case 'agent':
        return 'max-w-xl';
      case 'manager':
        return 'max-w-3xl';
      default:
        return 'max-w-xl';
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* Command palette */}
      <div
        className={`relative w-full ${getPersonaClasses()} bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden`}
        role="search"
        aria-label="Buscar comandos e ações"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, tickets, users..."
            className="flex-1 text-lg bg-transparent border-none outline-none placeholder-gray-400"
            aria-label="Campo de busca de comandos"
            aria-autocomplete="list"
            aria-controls="command-results"
            aria-activedescendant={filteredCommands[selectedIndex] ? `command-${filteredCommands[selectedIndex].id}` : undefined}
          />
          <div className="flex items-center gap-1 text-xs text-gray-400" aria-label="Atalho de teclado">
            <kbd className="px-2 py-1 bg-gray-100 rounded border" aria-hidden="true">⌘K</kbd>
          </div>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-results"
          className="max-h-80 overflow-y-auto"
          role="listbox"
          aria-label="Resultados de comandos"
        >
          {!query.trim() && (
            <div className="p-3 border-b border-gray-100 bg-gray-50" role="presentation">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recent & Starred
              </div>
            </div>
          )}

          {Object.entries(groupedCommands).map(([categoryKey, commands]) => {
            const category = categories[categoryKey];
            return (
              <div key={categoryKey} role="group" aria-label={category.name}>
                {query.trim() && (
                  <div className="p-3 border-b border-gray-100 bg-gray-50" role="presentation">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <category.icon className={`h-3 w-3 ${category.color}`} aria-hidden="true" />
                      {category.name}
                    </div>
                  </div>
                )}

                {commands.map((command, commandIndex) => {
                  const globalIndex = filteredCommands.indexOf(command);
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <button
                      key={command.id}
                      id={`command-${command.id}`}
                      data-index={globalIndex}
                      onClick={() => handleCommandSelect(command)}
                      className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                        isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : 'hover:bg-gray-50'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                      aria-label={`${command.title}${command.subtitle ? `, ${command.subtitle}` : ''}${command.shortcut ? `, atalho ${command.shortcut}` : ''}`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`} aria-hidden="true">
                        <command.icon className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} aria-hidden="true" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {command.title}
                          </span>
                          {command.recent && (
                            <ClockIcon className="h-3 w-3 text-amber-500" aria-label="Recente" />
                          )}
                          {command.starred && (
                            <StarIcon className="h-3 w-3 text-yellow-500 fill-yellow-500" aria-label="Favorito" />
                          )}
                        </div>
                        {command.subtitle && (
                          <div className={`text-sm ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                            {command.subtitle}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2" aria-hidden="true">
                        {command.shortcut && (
                          <div className="flex items-center gap-1">
                            {command.shortcut.split(' ').map((key, index) => (
                              <kbd
                                key={index}
                                className={`px-1.5 py-0.5 text-xs rounded border ${
                                  isSelected
                                    ? 'bg-blue-100 border-blue-200 text-blue-700'
                                    : 'bg-gray-100 border-gray-200 text-gray-600'
                                }`}
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                        <ArrowRightIcon className={`h-3 w-3 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {filteredCommands.length === 0 && (
            <div className="p-8 text-center" role="status" aria-live="polite">
              <MagnifyingGlassIcon className="h-8 w-8 text-gray-300 mx-auto mb-3" aria-hidden="true" />
              <div className="text-gray-500 font-medium">No commands found</div>
              <div className="text-sm text-gray-400 mt-1">
                Try searching for tickets, users, or actions
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50" role="region" aria-label="Atalhos de teclado">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <ArrowUpIcon className="h-3 w-3" aria-hidden="true" />
                <ArrowDownIcon className="h-3 w-3" aria-hidden="true" />
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white rounded border text-xs" aria-hidden="true">↵</kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white rounded border text-xs" aria-hidden="true">esc</kbd>
                <span>Close</span>
              </div>
            </div>
            <div className="text-gray-400" role="status" aria-live="polite">
              {filteredCommands.length} {filteredCommands.length === 1 ? 'command' : 'commands'}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Hook for command palette
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  };
}