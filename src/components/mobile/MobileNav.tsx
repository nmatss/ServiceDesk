'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  TicketIcon,
  PlusCircleIcon,
  BellIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  TicketIcon as TicketIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  BellIcon as BellIconSolid,
  UserCircleIcon as UserCircleIconSolid
} from '@heroicons/react/24/solid'

export interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  activeIcon: React.ReactNode
  badge?: number
}

export interface MobileNavProps {
  onCreateClick?: () => void
  notificationCount?: number
  className?: string
}

export const MobileNav: React.FC<MobileNavProps> = ({
  onCreateClick,
  notificationCount = 0,
  className = ''
}) => {
  const pathname = usePathname()
  const [lastTapTime, setLastTapTime] = useState<number>(0)

  const navItems: NavItem[] = [
    {
      label: 'Home',
      href: '/dashboard',
      icon: <HomeIcon className="w-6 h-6" />,
      activeIcon: <HomeIconSolid className="w-6 h-6" />
    },
    {
      label: 'Tickets',
      href: '/tickets',
      icon: <TicketIcon className="w-6 h-6" />,
      activeIcon: <TicketIconSolid className="w-6 h-6" />
    },
    {
      label: 'Create',
      href: '#',
      icon: <PlusCircleIcon className="w-6 h-6" />,
      activeIcon: <PlusCircleIconSolid className="w-6 h-6" />
    },
    {
      label: 'Notifications',
      href: '/notifications',
      icon: <BellIcon className="w-6 h-6" />,
      activeIcon: <BellIconSolid className="w-6 h-6" />,
      badge: notificationCount
    },
    {
      label: 'Profile',
      href: '/profile',
      icon: <UserCircleIcon className="w-6 h-6" />,
      activeIcon: <UserCircleIconSolid className="w-6 h-6" />
    }
  ]

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    // Handle double-tap to scroll to top
    const now = Date.now()
    if (pathname === item.href && now - lastTapTime < 300) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setLastTapTime(now)

    // Handle create button
    if (item.label === 'Create') {
      e.preventDefault()
      onCreateClick?.()

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
    }
  }

  return (
    <nav
      className={`
        fixed bottom-0 left-0 right-0 z-50
        bg-white dark:bg-neutral-900
        border-t border-neutral-200 dark:border-neutral-800
        shadow-lg
        safe-area-bottom
        ${className}
      `}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const isCreateButton = item.label === 'Create'

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={(e) => handleNavClick(item, e)}
              className={`
                relative flex flex-col items-center justify-center
                min-w-[64px] h-full px-3
                transition-all duration-200
                ${isCreateButton ? 'transform hover:scale-110' : ''}
                ${isActive && !isCreateButton
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }
              `}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Icon */}
              <div className={`relative ${isCreateButton ? 'mb-0' : 'mb-1'}`}>
                {isActive ? item.activeIcon : item.icon}

                {/* Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center
                             min-w-[18px] h-[18px] px-1
                             text-[10px] font-bold text-white
                             bg-red-600 rounded-full
                             ring-2 ring-white dark:ring-neutral-900"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              {!isCreateButton && (
                <span
                  className={`
                    text-[10px] font-medium
                    ${isActive ? 'scale-105' : 'scale-100'}
                    transition-transform duration-200
                  `}
                >
                  {item.label}
                </span>
              )}

              {/* Active Indicator */}
              {isActive && !isCreateButton && (
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
