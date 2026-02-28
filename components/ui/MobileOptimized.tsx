'use client'

import React, { useState, useEffect } from 'react'
import {
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'

/**
 * IconComponent type that accepts both regular components and forward refs from Heroicons
 */
type IconComponent = React.ComponentType<{ className?: string }> | React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>

// Mobile-optimized collapsible section
interface MobileCollapsibleProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export function MobileCollapsible({
  title,
  children,
  defaultOpen = false,
  className = ''
}: MobileCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      >
        <span className="font-medium text-left">{title}</span>
        {isOpen ? (
          <ChevronUpIcon className="h-5 w-5 text-neutral-500" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-neutral-500" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 animate-slide-down">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Mobile tab configuration
 * @property {string} key - Unique identifier for the tab
 * @property {string} label - Tab label text
 * @property {number} count - Optional count badge
 * @property {IconComponent} icon - Optional icon component
 */
interface MobileTab {
  key: string
  label: string
  count?: number
  icon?: IconComponent
}

interface MobileTabsProps {
  tabs: MobileTab[]
  activeTab: string
  onTabChange: (tab: string) => void
  className?: string
}

export function MobileTabs({
  tabs,
  activeTab,
  onTabChange,
  className = ''
}: MobileTabsProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const activeTabData = tabs.find(tab => tab.key === activeTab)

  // For mobile (sm and below), show dropdown. For larger screens, show full tabs
  return (
    <div className={className}>
      {/* Mobile Dropdown (small screens) */}
      <div className="sm:hidden">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center justify-between p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              {activeTabData?.icon && (
                <activeTabData.icon className="h-4 w-4" />
              )}
              <span className="font-medium">{activeTabData?.label}</span>
              {activeTabData?.count !== undefined && (
                <span className="badge badge-sm">{activeTabData.count}</span>
              )}
            </div>
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    onTabChange(tab.key)
                    setShowDropdown(false)
                  }}
                  className={`w-full flex items-center space-x-2 p-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    tab.key === activeTab ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' : ''
                  }`}
                >
                  {tab.icon && <tab.icon className="h-4 w-4" />}
                  <span className="flex-1">{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="badge badge-sm">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Tabs (medium screens and up) */}
      <div className="hidden sm:block">
        <div className="flex space-x-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab.key === activeTab
                  ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-description hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="badge badge-sm">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Mobile-optimized bottom action bar
interface MobileActionBarProps {
  children: React.ReactNode
  className?: string
}

export function MobileActionBar({
  children,
  className = ''
}: MobileActionBarProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 p-4 pb-[env(safe-area-inset-bottom)] safe-bottom z-40 ${className}`}>
      <div className="flex items-center space-x-3">
        {children}
      </div>
    </div>
  )
}

// Mobile-optimized list item
interface MobileListItemProps {
  children: React.ReactNode
  onClick?: () => void
  rightAction?: React.ReactNode
  subtitle?: string
  className?: string
}

export function MobileListItem({
  children,
  onClick,
  rightAction,
  subtitle,
  className = ''
}: MobileListItemProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {children}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-content mt-1">
            {subtitle}
          </div>
        )}
      </div>
      {rightAction && (
        <div className="ml-4 flex-shrink-0">
          {rightAction}
        </div>
      )}
    </div>
  )
}

// Mobile-optimized swipe actions (placeholder for future implementation)
interface MobileSwipeActionsProps {
  children: React.ReactNode
  leftActions?: Array<{
    label: string
    color: 'success' | 'warning' | 'error'
    action: () => void
  }>
  rightActions?: Array<{
    label: string
    color: 'success' | 'warning' | 'error'
    action: () => void
  }>
}

export function MobileSwipeActions({
  children
}: MobileSwipeActionsProps) {
  // Placeholder for swipe gesture implementation
  // In a real app, you would implement touch handlers here
  // leftActions and rightActions would be used here
  return (
    <div className="relative">
      {children}
    </div>
  )
}

// Touch-friendly button sizes
export const touchButtonClasses = {
  sm: 'min-h-[44px] min-w-[44px] px-4 py-2',
  md: 'min-h-[48px] min-w-[48px] px-6 py-3',
  lg: 'min-h-[56px] min-w-[56px] px-8 py-4'
}

// Mobile breakpoint hook
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640) // sm breakpoint
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  return isMobile
}

// Mobile-optimized modal
interface MobileModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footerActions?: React.ReactNode
}

export function MobileModal({
  isOpen,
  onClose,
  title,
  children,
  footerActions
}: MobileModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:w-auto sm:min-w-[400px] sm:max-w-lg">
        {/* Mobile: Full height modal from bottom */}
        <div className="sm:hidden bg-white dark:bg-neutral-900 rounded-t-xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>

          {/* Footer */}
          {footerActions && (
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 safe-bottom">
              {footerActions}
            </div>
          )}
        </div>

        {/* Desktop: Standard modal */}
        <div className="hidden sm:block bg-white dark:bg-neutral-900 rounded-xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {children}
          </div>

          {/* Footer */}
          {footerActions && (
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-700">
              {footerActions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}