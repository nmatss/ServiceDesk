/**
 * Persona Layout Component
 *
 * Main layout component that adapts to specific user personas.
 * Provides persona-specific navigation, spacing, and visual hierarchy.
 */

'use client';

import React, { useState, useEffect, useContext, createContext } from 'react';
import {
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  HomeIcon,
  TicketIcon,
  UsersIcon,
  ChartBarIcon,
  BookOpenIcon,
  BuildingOfficeIcon,
  CommandLineIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline';
import { PersonaType, getPersonaTokens } from '../../../lib/design-system/tokens';
import { Theme, ThemeMode, getTheme, generateCSSVariables } from '../../../lib/design-system/themes';
import { getPersonaVariants } from '../../../lib/design-system/persona-variants';

// Context for persona and theme management
interface PersonaContextType {
  persona: PersonaType;
  theme: Theme;
  themeMode: ThemeMode;
  setPersona: (persona: PersonaType) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const PersonaContext = createContext<PersonaContextType | null>(null);

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within a PersonaLayout');
  }
  return context;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
  children?: NavigationItem[];
  permissions?: string[];
}

interface PersonaLayoutProps {
  children: React.ReactNode;
  persona?: PersonaType;
  initialThemeMode?: ThemeMode;
  className?: string;
}

export function PersonaLayout({
  children,
  persona: initialPersona = 'agent',
  initialThemeMode = 'light',
  className = ''
}: PersonaLayoutProps) {
  const [persona, setPersona] = useState<PersonaType>(initialPersona);
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const theme = getTheme(themeMode, persona);
  const personaTokens = getPersonaTokens(persona);
  const variants = getPersonaVariants(persona);

  // Apply CSS variables to document root
  useEffect(() => {
    const root = document.documentElement;
    const cssVars = generateCSSVariables(theme);

    Object.entries(cssVars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Add persona class to body
    document.body.className = document.body.className
      .replace(/persona-\w+/g, '')
      .concat(` persona-${persona}`);

    // Add theme mode class
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => {
      Object.keys(cssVars).forEach(property => {
        root.style.removeProperty(property);
      });
    };
  }, [theme, persona, themeMode]);

  // Navigation configuration based on persona
  const getNavigationItems = (): NavigationItem[] => {
    const baseItems: NavigationItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: HomeIcon,
        href: '/dashboard'
      },
      {
        id: 'tickets',
        label: 'Tickets',
        icon: TicketIcon,
        href: '/tickets',
        badge: 23
      }
    ];

    switch (persona) {
      case 'enduser':
        return [
          ...baseItems,
          {
            id: 'knowledge',
            label: 'Help Center',
            icon: BookOpenIcon,
            href: '/kb'
          },
          {
            id: 'profile',
            label: 'My Profile',
            icon: UserCircleIcon,
            href: '/profile'
          }
        ];

      case 'agent':
        return [
          ...baseItems,
          {
            id: 'users',
            label: 'Users',
            icon: UsersIcon,
            href: '/users'
          },
          {
            id: 'knowledge',
            label: 'Knowledge Base',
            icon: BookOpenIcon,
            href: '/kb'
          },
          {
            id: 'reports',
            label: 'Reports',
            icon: ChartBarIcon,
            href: '/reports'
          }
        ];

      case 'manager':
        return [
          ...baseItems,
          {
            id: 'users',
            label: 'Users',
            icon: UsersIcon,
            href: '/users'
          },
          {
            id: 'analytics',
            label: 'Analytics',
            icon: ChartBarIcon,
            href: '/analytics'
          },
          {
            id: 'admin',
            label: 'Administration',
            icon: BuildingOfficeIcon,
            href: '/admin',
            children: [
              {
                id: 'settings',
                label: 'Settings',
                icon: Cog6ToothIcon,
                href: '/admin/settings'
              },
              {
                id: 'users-admin',
                label: 'User Management',
                icon: UsersIcon,
                href: '/admin/users'
              }
            ]
          }
        ];

      default:
        return baseItems;
    }
  };

  const navigationItems = getNavigationItems();

  // Get persona-specific layout dimensions
  const getLayoutDimensions = () => {
    switch (persona) {
      case 'enduser':
        return {
          sidebarWidth: sidebarCollapsed ? 'w-16' : 'w-72',
          headerHeight: 'h-20',
          contentPadding: 'p-8'
        };
      case 'agent':
        return {
          sidebarWidth: sidebarCollapsed ? 'w-14' : 'w-60',
          headerHeight: 'h-16',
          contentPadding: 'p-6'
        };
      case 'manager':
        return {
          sidebarWidth: sidebarCollapsed ? 'w-16' : 'w-76',
          headerHeight: 'h-18',
          contentPadding: 'p-8'
        };
      default:
        return {
          sidebarWidth: sidebarCollapsed ? 'w-14' : 'w-60',
          headerHeight: 'h-16',
          contentPadding: 'p-6'
        };
    }
  };

  const dimensions = getLayoutDimensions();

  // Context value
  const contextValue: PersonaContextType = {
    persona,
    theme,
    themeMode,
    setPersona,
    setThemeMode
  };

  return (
    <PersonaContext.Provider value={contextValue}>
      <div className={`min-h-screen bg-persona-primary ${className}`}>
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 ${dimensions.sidebarWidth} bg-persona-elevated border-r border-persona-primary transition-all duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <div className="flex flex-col h-full">
            {/* Logo/Brand */}
            <div className={`flex items-center ${dimensions.headerHeight} px-6 border-b border-persona-secondary`}>
              {!sidebarCollapsed ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-700 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">SD</span>
                  </div>
                  <div>
                    <h1 className="font-bold text-persona-primary text-lg">
                      ServiceDesk
                    </h1>
                    <p className="text-xs text-persona-secondary capitalize">
                      {persona} Portal
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-700 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-white font-bold text-sm">SD</span>
                </div>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
              {navigationItems.map((item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  collapsed={sidebarCollapsed}
                  persona={persona}
                />
              ))}
            </nav>

            {/* Bottom section */}
            <div className="p-4 border-t border-persona-secondary">
              <div className="flex items-center gap-3">
                {!sidebarCollapsed ? (
                  <>
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCircleIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-persona-primary">
                        John Doe
                      </p>
                      <p className="text-xs text-persona-secondary capitalize">
                        {persona}
                      </p>
                    </div>
                    <button
                      onClick={() => setSidebarCollapsed(true)}
                      className="p-1 text-persona-muted hover:text-persona-primary transition-colors lg:block hidden"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto"
                  >
                    <UserCircleIcon className="w-5 h-5 text-blue-600" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className={`lg:${dimensions.sidebarWidth} ml-0 lg:ml-0 transition-all duration-300`}>
          {/* Header */}
          <header className={`${dimensions.headerHeight} bg-persona-elevated border-b border-persona-primary px-6 flex items-center justify-between sticky top-0 z-40`}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-persona-muted hover:text-persona-primary transition-colors"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>

              {persona === 'agent' && (
                <button
                  className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm bg-persona-secondary rounded-lg hover:bg-persona-tertiary transition-colors"
                  title="Command Palette (⌘K)"
                >
                  <CommandLineIcon className="w-4 h-4" />
                  <span>Quick Actions</span>
                  <kbd className="px-1 py-0.5 text-xs bg-persona-primary rounded">⌘K</kbd>
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Search - varies by persona */}
              {persona !== 'manager' && (
                <div className="relative hidden md:block">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-persona-muted" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="pl-9 pr-4 py-2 w-64 text-sm bg-persona-secondary border border-persona-primary rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}

              {/* Theme toggle */}
              <button
                onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
                className="p-2 text-persona-muted hover:text-persona-primary transition-colors rounded-lg"
                title="Toggle theme"
              >
                {themeMode === 'light' ? (
                  <MoonIcon className="w-5 h-5" />
                ) : (
                  <SunIcon className="w-5 h-5" />
                )}
              </button>

              {/* Notifications */}
              <button className="relative p-2 text-persona-muted hover:text-persona-primary transition-colors">
                <BellIcon className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>

              {/* Help */}
              {persona === 'enduser' && (
                <button className="p-2 text-persona-muted hover:text-persona-primary transition-colors">
                  <QuestionMarkCircleIcon className="w-5 h-5" />
                </button>
              )}

              {/* Settings */}
              <button className="p-2 text-persona-muted hover:text-persona-primary transition-colors">
                <Cog6ToothIcon className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className={`${dimensions.contentPadding} min-h-[calc(100vh-${dimensions.headerHeight})]`}>
            {children}
          </main>
        </div>
      </div>
    </PersonaContext.Provider>
  );
}

// Navigation item component
interface NavigationItemProps {
  item: NavigationItem;
  collapsed: boolean;
  persona: PersonaType;
  depth?: number;
}

function NavigationItem({ item, collapsed, persona, depth = 0 }: NavigationItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  const getItemClasses = () => {
    const baseClasses = 'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium';

    switch (persona) {
      case 'enduser':
        return `${baseClasses} hover:bg-persona-secondary text-persona-secondary hover:text-persona-primary min-target-enduser`;
      case 'agent':
        return `${baseClasses} hover:bg-persona-secondary text-persona-secondary hover:text-persona-primary min-target-agent`;
      case 'manager':
        return `${baseClasses} hover:bg-persona-secondary text-persona-secondary hover:text-persona-primary min-target-manager`;
      default:
        return `${baseClasses} hover:bg-persona-secondary text-persona-secondary hover:text-persona-primary`;
    }
  };

  if (collapsed && depth === 0) {
    return (
      <div className="relative">
        <button
          className={`${getItemClasses()} justify-center w-full`}
          title={item.label}
        >
          <item.icon className="w-5 h-5" />
          {item.badge && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={depth > 0 ? 'ml-6' : ''}>
      <button
        onClick={() => hasChildren ? setIsOpen(!isOpen) : undefined}
        className={`${getItemClasses()} w-full justify-between ${depth > 0 ? 'text-xs' : ''}`}
      >
        <div className="flex items-center gap-3">
          <item.icon className={`${depth > 0 ? 'w-4 h-4' : 'w-5 h-5'}`} />
          <span>{item.label}</span>
        </div>

        <div className="flex items-center gap-2">
          {item.badge && (
            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
          {hasChildren && (
            <svg
              className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {hasChildren && isOpen && (
        <div className="mt-2 space-y-1">
          {item.children!.map((child) => (
            <NavigationItem
              key={child.id}
              item={child}
              collapsed={false}
              persona={persona}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PersonaLayout;