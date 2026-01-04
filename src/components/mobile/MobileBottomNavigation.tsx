'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  HomeIcon,
  TicketIcon,
  PlusIcon,
  ChartBarIcon,
  UserIcon,
  Cog6ToothIcon,
  BellIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  TicketIcon as TicketIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  UserIcon as UserIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  BellIcon as BellIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid
} from '@heroicons/react/24/solid'

export interface NavigationItem {
  id: string
  label: string
  path: string
  icon: React.ReactNode
  iconActive: React.ReactNode
  badge?: number
  roles?: ('admin' | 'agent' | 'user')[]
  exact?: boolean
}

export interface MobileBottomNavigationProps {
  userRole?: 'admin' | 'agent' | 'user'
  notificationCount?: number
  onQuickActionPress?: () => void
  customItems?: NavigationItem[]
  showQuickAction?: boolean
  className?: string
}

const defaultNavigationItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Início',
    path: '/dashboard',
    icon: <HomeIcon className="h-6 w-6" />,
    iconActive: <HomeIconSolid className="h-6 w-6" />
  },
  {
    id: 'tickets',
    label: 'Tickets',
    path: '/tickets',
    icon: <TicketIcon className="h-6 w-6" />,
    iconActive: <TicketIconSolid className="h-6 w-6" />
  },
  {
    id: 'search',
    label: 'Buscar',
    path: '/search',
    icon: <MagnifyingGlassIcon className="h-6 w-6" />,
    iconActive: <MagnifyingGlassIconSolid className="h-6 w-6" />
  },
  {
    id: 'notifications',
    label: 'Avisos',
    path: '/notifications',
    icon: <BellIcon className="h-6 w-6" />,
    iconActive: <BellIconSolid className="h-6 w-6" />
  },
  {
    id: 'profile',
    label: 'Perfil',
    path: '/profile',
    icon: <UserIcon className="h-6 w-6" />,
    iconActive: <UserIconSolid className="h-6 w-6" />
  }
]

const adminNavigationItems: NavigationItem[] = [
  {
    id: 'admin',
    label: 'Admin',
    path: '/admin',
    icon: <HomeIcon className="h-6 w-6" />,
    iconActive: <HomeIconSolid className="h-6 w-6" />,
    roles: ['admin']
  },
  {
    id: 'tickets',
    label: 'Tickets',
    path: '/admin/tickets',
    icon: <TicketIcon className="h-6 w-6" />,
    iconActive: <TicketIconSolid className="h-6 w-6" />,
    roles: ['admin', 'agent']
  },
  {
    id: 'analytics',
    label: 'Relatórios',
    path: '/admin/reports',
    icon: <ChartBarIcon className="h-6 w-6" />,
    iconActive: <ChartBarIconSolid className="h-6 w-6" />,
    roles: ['admin', 'agent']
  },
  {
    id: 'settings',
    label: 'Config',
    path: '/admin/settings',
    icon: <Cog6ToothIcon className="h-6 w-6" />,
    iconActive: <Cog6ToothIconSolid className="h-6 w-6" />,
    roles: ['admin']
  },
  {
    id: 'profile',
    label: 'Perfil',
    path: '/profile',
    icon: <UserIcon className="h-6 w-6" />,
    iconActive: <UserIconSolid className="h-6 w-6" />
  }
]

export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  userRole = 'user',
  notificationCount = 0,
  onQuickActionPress,
  customItems,
  showQuickAction = true,
  className = ''
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Choose navigation items based on user role
  const navigationItems = customItems || (userRole === 'admin' ? adminNavigationItems : defaultNavigationItems)

  // Filter items by user role
  const filteredItems = navigationItems.filter(item =>
    !item.roles || item.roles.includes(userRole)
  )

  // Auto-hide on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down - hide navigation
        setIsVisible(false)
      } else {
        // Scrolling up - show navigation
        setIsVisible(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const isItemActive = (item: NavigationItem): boolean => {
    if (item.exact) {
      return pathname === item.path
    }
    return pathname.startsWith(item.path)
  }

  const handleItemPress = (item: NavigationItem) => {
    // Add haptic feedback for mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    router.push(item.path)
  }

  const handleQuickAction = () => {
    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(20)
    }

    onQuickActionPress?.()
  }

  return (
    <>
      {/* Bottom navigation bar */}
      <nav
        className={`
          fixed bottom-0 left-0 right-0 z-40
          bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700
          safe-bottom transition-transform duration-300 ease-in-out
          ${isVisible ? 'translate-y-0' : 'translate-y-full'}
          ${className}
        `}
        role="navigation"
        aria-label="Navegação inferior móvel"
      >
        <div className="flex items-center justify-around px-2 py-1">
          {filteredItems.map((item, index) => {
            const isActive = isItemActive(item)
            const isMiddle = showQuickAction && index === Math.floor(filteredItems.length / 2)

            return (
              <React.Fragment key={item.id}>
                {/* Quick Action Button in the middle */}
                {isMiddle && showQuickAction && (
                  <button
                    onClick={handleQuickAction}
                    className="
                      relative flex items-center justify-center w-14 h-14 -mt-6
                      bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg
                      transition-all duration-200 active:scale-95
                      focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2
                    "
                    aria-label="Criar novo item - Ação rápida"
                  >
                    <PlusIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                )}

                {/* Navigation Item */}
                <button
                  onClick={() => handleItemPress(item)}
                  className={`
                    relative flex flex-col items-center justify-center px-3 py-2 min-h-[60px]
                    transition-all duration-200 active:scale-95 touch-target
                    ${isActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-muted-content hover:text-neutral-700 dark:hover:text-neutral-300'
                    }
                  `}
                  aria-label={`${item.label}${
                    item.id === 'notifications' && notificationCount > 0
                      ? `, ${notificationCount} notificações não lidas`
                      : item.badge && item.badge > 0
                      ? `, ${item.badge} itens`
                      : ''
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Icon */}
                  <div className="relative mb-1">
                    <span aria-hidden="true">{isActive ? item.iconActive : item.icon}</span>

                    {/* Badge for notifications */}
                    {item.id === 'notifications' && notificationCount > 0 && (
                      <div
                        className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-error-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                        aria-label={`${notificationCount} notificações`}
                      >
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </div>
                    )}

                    {/* Custom badge */}
                    {item.badge && item.badge > 0 && (
                      <div
                        className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-error-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
                        aria-label={`${item.badge} itens`}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <span className="text-xs font-medium leading-none">
                    {item.label}
                  </span>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-brand-500 rounded-b-full" aria-hidden="true" />
                  )}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      </nav>

      {/* Bottom spacing to prevent content overlap */}
      <div className="h-16 safe-bottom" aria-hidden="true" />
    </>
  )
}

// Hook for managing bottom navigation state
export const useMobileBottomNavigation = () => {
  const [isVisible, setIsVisible] = useState(true)
  const [quickActionPressed, setQuickActionPressed] = useState(false)

  const hideNavigation = () => setIsVisible(false)
  const showNavigation = () => setIsVisible(true)
  const toggleNavigation = () => setIsVisible(prev => !prev)

  const triggerQuickAction = () => {
    setQuickActionPressed(true)
    setTimeout(() => setQuickActionPressed(false), 200)
  }

  return {
    isVisible,
    quickActionPressed,
    hideNavigation,
    showNavigation,
    toggleNavigation,
    triggerQuickAction
  }
}

// Component for quick action sheet triggered by FAB
export interface QuickActionItem {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
  color?: 'primary' | 'success' | 'warning' | 'error'
}

export interface QuickActionMenuProps {
  isOpen: boolean
  onClose: () => void
  actions: QuickActionItem[]
}

export const QuickActionMenu: React.FC<QuickActionMenuProps> = ({
  isOpen,
  onClose,
  actions
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de ações rápidas"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* Quick actions */}
      <div className="relative mb-20 space-y-3 p-4" role="menu">
        {actions.map((action, index) => {
          const colorClasses = {
            primary: 'bg-brand-500 hover:bg-brand-600',
            success: 'bg-success-500 hover:bg-success-600',
            warning: 'bg-warning-500 hover:bg-warning-600',
            error: 'bg-error-500 hover:bg-error-600'
          }

          return (
            <div
              key={action.id}
              className="flex items-center space-x-3 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span
                className="text-white text-sm font-medium bg-black bg-opacity-60 px-3 py-1 rounded-full"
                aria-hidden="true"
              >
                {action.label}
              </span>
              <button
                onClick={() => {
                  action.action()
                  onClose()
                }}
                className={`
                  flex items-center justify-center w-12 h-12 rounded-full text-white shadow-lg
                  transition-all duration-200 active:scale-95
                  ${colorClasses[action.color || 'primary']}
                `}
                role="menuitem"
                aria-label={action.label}
              >
                <span aria-hidden="true">{action.icon}</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}