'use client';

import React from 'react';
import { Dialog, Combobox, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Hash,
  User,
  Clock,
  Tag,
  FileText,
  Settings,
  HelpCircle,
  ArrowRight,
  Command,
  Zap,
  Star,
  Calendar,
  Plus,
  Edit,
  Trash2,
  Eye,
  Send,
  Archive,
  Filter,
  Sort,
  Download,
  Upload,
  Refresh,
  Bell,
  UserPlus,
  Users,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  X,
  BookOpen,
  MessageSquare,
  Paperclip,
  Phone,
  Mail,
  Globe,
  Home,
  Folder,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/design-system/utils';
import Fuse from 'fuse.js';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: CommandCategory;
  keywords?: string[];
  shortcut?: string;
  disabled?: boolean;
  badge?: string;
  href?: string;
  priority?: number;
  recent?: boolean;
  favorite?: boolean;
}

export type CommandCategory =
  | 'tickets'
  | 'users'
  | 'navigation'
  | 'actions'
  | 'settings'
  | 'help'
  | 'analytics'
  | 'knowledge-base'
  | 'recent'
  | 'favorites';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  placeholder?: string;
  emptyText?: string;
  persona?: 'enduser' | 'agent' | 'manager';
  enableCategories?: boolean;
  enableRecents?: boolean;
  enableFavorites?: boolean;
  enableKeyboardNavigation?: boolean;
  maxResults?: number;
  className?: string;
}

const categoryIcons: Record<CommandCategory, React.ReactNode> = {
  tickets: <Hash className="h-4 w-4" />,
  users: <User className="h-4 w-4" />,
  navigation: <Home className="h-4 w-4" />,
  actions: <Zap className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  help: <HelpCircle className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  'knowledge-base': <BookOpen className="h-4 w-4" />,
  recent: <Clock className="h-4 w-4" />,
  favorites: <Star className="h-4 w-4" />,
};

const categoryLabels: Record<CommandCategory, string> = {
  tickets: 'Tickets',
  users: 'Users',
  navigation: 'Navigation',
  actions: 'Actions',
  settings: 'Settings',
  help: 'Help',
  analytics: 'Analytics',
  'knowledge-base': 'Knowledge Base',
  recent: 'Recent',
  favorites: 'Favorites',
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  placeholder = 'Type a command or search...',
  emptyText = 'No results found.',
  persona = 'agent',
  enableCategories = true,
  enableRecents = true,
  enableFavorites = true,
  enableKeyboardNavigation = true,
  maxResults = 50,
  className,
}) => {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [recentCommands, setRecentCommands] = React.useState<string[]>([]);
  const [favoriteCommands, setFavoriteCommands] = React.useState<string[]>([]);

  // Initialize Fuse.js for fuzzy search
  const fuse = React.useMemo(() => {
    return new Fuse(commands, {
      keys: ['title', 'subtitle', 'description', 'keywords'],
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
    });
  }, [commands]);

  // Filter and search commands
  const filteredCommands = React.useMemo(() => {
    if (!query.trim()) {
      // Show recent and favorites when no query
      const results: CommandItem[] = [];

      if (enableRecents && recentCommands.length > 0) {
        const recentItems = recentCommands
          .map(id => commands.find(cmd => cmd.id === id))
          .filter(Boolean)
          .slice(0, 5) as CommandItem[];

        results.push(...recentItems.map(item => ({ ...item, recent: true })));
      }

      if (enableFavorites && favoriteCommands.length > 0) {
        const favoriteItems = favoriteCommands
          .map(id => commands.find(cmd => cmd.id === id))
          .filter(Boolean)
          .slice(0, 5) as CommandItem[];

        results.push(...favoriteItems.map(item => ({ ...item, favorite: true })));
      }

      // Add popular commands if no recents/favorites
      if (results.length === 0) {
        results.push(...commands.slice(0, 10));
      }

      return results.slice(0, maxResults);
    }

    // Fuzzy search
    const searchResults = fuse.search(query);
    return searchResults
      .map(result => result.item)
      .filter(cmd => !cmd.disabled)
      .slice(0, maxResults);
  }, [query, commands, recentCommands, favoriteCommands, enableRecents, enableFavorites, maxResults, fuse]);

  // Group commands by category
  const groupedCommands = React.useMemo(() => {
    if (!enableCategories) {
      return { all: filteredCommands };
    }

    const groups: Record<string, CommandItem[]> = {};

    filteredCommands.forEach(command => {
      const category = command.recent ? 'recent' : command.favorite ? 'favorites' : command.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(command);
    });

    // Sort groups by priority
    const sortedGroups: Record<string, CommandItem[]> = {};
    const categoryOrder: CommandCategory[] = ['recent', 'favorites', 'tickets', 'actions', 'navigation', 'users', 'analytics', 'knowledge-base', 'settings', 'help'];

    categoryOrder.forEach(category => {
      if (groups[category]) {
        sortedGroups[category] = groups[category];
      }
    });

    // Add any remaining categories
    Object.keys(groups).forEach(category => {
      if (!sortedGroups[category]) {
        sortedGroups[category] = groups[category];
      }
    });

    return sortedGroups;
  }, [filteredCommands, enableCategories]);

  // Calculate total items for keyboard navigation
  const totalItems = filteredCommands.length;

  // Handle command execution
  const executeCommand = React.useCallback((command: CommandItem) => {
    // Add to recent commands
    if (enableRecents) {
      setRecentCommands(prev => {
        const updated = [command.id, ...prev.filter(id => id !== command.id)].slice(0, 10);
        localStorage.setItem('commandPalette.recent', JSON.stringify(updated));
        return updated;
      });
    }

    // Execute the command
    command.action();
    onClose();
  }, [enableRecents, onClose]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!enableKeyboardNavigation || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardNavigation, isOpen, selectedIndex, totalItems, filteredCommands, executeCommand, onClose]);

  // Load recent and favorite commands from localStorage
  React.useEffect(() => {
    if (enableRecents) {
      const stored = localStorage.getItem('commandPalette.recent');
      if (stored) {
        setRecentCommands(JSON.parse(stored));
      }
    }

    if (enableFavorites) {
      const stored = localStorage.getItem('commandPalette.favorites');
      if (stored) {
        setFavoriteCommands(JSON.parse(stored));
      }
    }
  }, [enableRecents, enableFavorites]);

  // Reset state when opened
  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const toggleFavorite = (commandId: string) => {
    setFavoriteCommands(prev => {
      const updated = prev.includes(commandId)
        ? prev.filter(id => id !== commandId)
        : [...prev, commandId];
      localStorage.setItem('commandPalette.favorites', JSON.stringify(updated));
      return updated;
    });
  };

  const renderCommandItem = (command: CommandItem, index: number) => {
    const isSelected = index === selectedIndex;
    const isFavorite = favoriteCommands.includes(command.id);

    return (
      <Combobox.Option
        key={command.id}
        value={command}
        className={({ active }) =>
          cn(
            'relative cursor-pointer select-none px-4 py-3 transition-colors',
            active || isSelected
              ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/20 dark:text-brand-100'
              : 'text-neutral-900 dark:text-neutral-100'
          )
        }
      >
        {({ active, selected }) => (
          <motion.div
            layout
            className="flex items-center gap-3"
            whileHover={{ x: 2 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className={cn(
              'flex-shrink-0 p-2 rounded-lg',
              active || selected
                ? 'bg-brand-100 text-brand-600 dark:bg-brand-800/50 dark:text-brand-400'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
            )}>
              {command.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-sm font-medium truncate',
                  command.disabled && 'opacity-50'
                )}>
                  {command.title}
                </p>

                {command.badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300">
                    {command.badge}
                  </span>
                )}

                {command.recent && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Recent
                  </span>
                )}
              </div>

              {command.subtitle && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {command.subtitle}
                </p>
              )}

              {command.description && !command.subtitle && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {command.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {enableFavorites && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(command.id);
                  }}
                  className={cn(
                    'p-1 rounded transition-colors',
                    isFavorite
                      ? 'text-warning-500 hover:text-warning-600'
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                  )}
                >
                  <Star className={cn('h-3 w-3', isFavorite && 'fill-current')} />
                </button>
              )}

              {command.shortcut && (
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
                  {command.shortcut}
                </kbd>
              )}

              <ArrowRight className="h-3 w-3 text-neutral-400" />
            </div>
          </motion.div>
        )}
      </Combobox.Option>
    );
  };

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-modal" onClose={onClose}>
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4 pt-[10vh]">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={cn(
                'w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all',
                'dark:bg-neutral-800 dark:ring-1 dark:ring-neutral-700',
                className
              )}>
                <Combobox onChange={executeCommand}>
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <Combobox.Input
                      className="w-full border-0 bg-transparent py-4 pl-12 pr-12 text-neutral-900 placeholder-neutral-500 focus:ring-0 dark:text-neutral-100 dark:placeholder-neutral-400"
                      placeholder={placeholder}
                      onChange={(e) => setQuery(e.target.value)}
                      value={query}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
                        <Command className="h-3 w-3" />
                        K
                      </kbd>
                      <button
                        onClick={onClose}
                        className="rounded p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Results */}
                  {filteredCommands.length > 0 ? (
                    <Combobox.Options
                      static
                      className="max-h-96 scroll-py-2 overflow-y-auto border-t border-neutral-200 dark:border-neutral-700"
                    >
                      <AnimatePresence mode="wait">
                        {enableCategories ? (
                          Object.entries(groupedCommands).map(([category, items]) => (
                            <motion.div
                              key={category}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.15 }}
                            >
                              {items.length > 0 && (
                                <>
                                  <div className="sticky top-0 z-10 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700 dark:bg-neutral-700/50 dark:text-neutral-300">
                                    <div className="flex items-center gap-2">
                                      {categoryIcons[category as CommandCategory]}
                                      {categoryLabels[category as CommandCategory] || category}
                                    </div>
                                  </div>
                                  {items.map((command, index) => {
                                    const globalIndex = filteredCommands.indexOf(command);
                                    return renderCommandItem(command, globalIndex);
                                  })}
                                </>
                              )}
                            </motion.div>
                          ))
                        ) : (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            {filteredCommands.map((command, index) => renderCommandItem(command, index))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Combobox.Options>
                  ) : (
                    <div className="border-t border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                      {emptyText}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span>
                          {filteredCommands.length} {filteredCommands.length === 1 ? 'result' : 'results'}
                        </span>
                        {query && (
                          <span>
                            for "{query}"
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-xs font-medium dark:bg-neutral-700">
                          ↵
                        </kbd>
                        <span>to select</span>
                        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-xs font-medium dark:bg-neutral-700">
                          ↑↓
                        </kbd>
                        <span>to navigate</span>
                      </div>
                    </div>
                  </div>
                </Combobox>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

// Hook for command palette
export function useCommandPalette() {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}

// Predefined command sets
export const createTicketCommands = (persona: 'enduser' | 'agent' | 'manager'): CommandItem[] => {
  const baseCommands: CommandItem[] = [
    {
      id: 'create-ticket',
      title: 'Create New Ticket',
      subtitle: 'Submit a new support request',
      icon: <Plus />,
      action: () => {},
      category: 'tickets',
      keywords: ['new', 'create', 'add', 'submit'],
      shortcut: 'Ctrl+N',
    },
    {
      id: 'search-tickets',
      title: 'Search Tickets',
      subtitle: 'Find tickets by ID, title, or content',
      icon: <Search />,
      action: () => {},
      category: 'tickets',
      keywords: ['search', 'find', 'lookup'],
      shortcut: 'Ctrl+F',
    },
    {
      id: 'my-tickets',
      title: 'My Tickets',
      subtitle: 'View tickets assigned to me',
      icon: <User />,
      action: () => {},
      category: 'tickets',
      keywords: ['my', 'assigned', 'mine'],
    },
  ];

  if (persona === 'agent') {
    baseCommands.push(
      {
        id: 'assign-ticket',
        title: 'Assign Ticket',
        subtitle: 'Assign ticket to agent',
        icon: <UserPlus />,
        action: () => {},
        category: 'actions',
        keywords: ['assign', 'delegate'],
      },
      {
        id: 'escalate-ticket',
        title: 'Escalate Ticket',
        subtitle: 'Escalate to higher priority',
        icon: <TrendingUp />,
        action: () => {},
        category: 'actions',
        keywords: ['escalate', 'priority', 'urgent'],
      }
    );
  }

  if (persona === 'manager') {
    baseCommands.push(
      {
        id: 'team-performance',
        title: 'Team Performance',
        subtitle: 'View team metrics and KPIs',
        icon: <BarChart3 />,
        action: () => {},
        category: 'analytics',
        keywords: ['team', 'performance', 'metrics', 'kpi'],
      },
      {
        id: 'sla-report',
        title: 'SLA Report',
        subtitle: 'Service level agreement status',
        icon: <Clock />,
        action: () => {},
        category: 'analytics',
        keywords: ['sla', 'service', 'level', 'agreement'],
      }
    );
  }

  return baseCommands;
};

export default CommandPalette;