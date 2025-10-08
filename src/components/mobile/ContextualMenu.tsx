'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisVerticalIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTouchGestures } from '@/src/hooks/useTouchGestures'

export interface ContextMenuAction {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger' | 'success' | 'warning'
  disabled?: boolean
  divider?: boolean
}

export interface ContextualMenuProps {
  actions: ContextMenuAction[]
  trigger?: 'click' | 'long-press' | 'custom'
  position?: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  children?: React.ReactNode
  className?: string
  menuClassName?: string
  disabled?: boolean
  longPressDuration?: number
}

export const ContextualMenu: React.FC<ContextualMenuProps> = ({
  actions,
  trigger = 'click',
  position = 'auto',
  children,
  className = '',
  menuClassName = '',
  disabled = false,
  longPressDuration = 500
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')

  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isLongPressRef = useRef(false)

  // Calculate menu position
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    let top = 0
    let left = 0
    let finalPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom'

    if (position === 'auto') {
      // Auto-position based on available space
      const spaceBelow = viewport.height - triggerRect.bottom
      const spaceAbove = triggerRect.top
      const spaceRight = viewport.width - triggerRect.right
      const spaceLeft = triggerRect.left

      if (spaceBelow > 200) {
        // Position below
        top = triggerRect.bottom + 8
        left = triggerRect.left
        finalPosition = 'bottom'
      } else if (spaceAbove > 200) {
        // Position above
        top = triggerRect.top - 8
        left = triggerRect.left
        finalPosition = 'top'
      } else if (spaceRight > 200) {
        // Position to the right
        top = triggerRect.top
        left = triggerRect.right + 8
        finalPosition = 'right'
      } else {
        // Position to the left
        top = triggerRect.top
        left = triggerRect.left - 8
        finalPosition = 'left'
      }

      // Ensure menu stays within viewport
      if (left + 200 > viewport.width) {
        left = viewport.width - 200 - 16
      }
      if (left < 16) {
        left = 16
      }
      if (top + 300 > viewport.height) {
        top = viewport.height - 300 - 16
      }
      if (top < 16) {
        top = 16
      }
    } else {
      // Fixed position
      switch (position) {
        case 'top':
          top = triggerRect.top - 8
          left = triggerRect.left
          finalPosition = 'top'
          break
        case 'bottom':
          top = triggerRect.bottom + 8
          left = triggerRect.left
          finalPosition = 'bottom'
          break
        case 'left':
          top = triggerRect.top
          left = triggerRect.left - 8
          finalPosition = 'left'
          break
        case 'right':
          top = triggerRect.top
          left = triggerRect.right + 8
          finalPosition = 'right'
          break
      }
    }

    setMenuPosition({ top, left })
    setActualPosition(finalPosition)
  }, [position])

  // Touch gestures for long press
  const { ref: touchRef } = useTouchGestures({
    onTouchStart: () => {
      if (trigger === 'long-press' && !disabled) {
        isLongPressRef.current = false
        longPressTimerRef.current = setTimeout(() => {
          isLongPressRef.current = true
          openMenu()
        }, longPressDuration)
      }
    },
    onTouchEnd: () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    },
    onTouchMove: () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  })

  const openMenu = useCallback(() => {
    if (disabled) return

    calculatePosition()
    setIsOpen(true)

    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(20)
    }
  }, [disabled, calculatePosition])

  const closeMenu = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Handle click trigger
  const handleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    if (trigger === 'click') {
      if (isOpen) {
        closeMenu()
      } else {
        openMenu()
      }
    } else if (trigger === 'long-press' && !isLongPressRef.current) {
      // Regular click on long-press trigger - don't open menu
      return
    }
  }, [trigger, isOpen, openMenu, closeMenu])

  // Handle action click
  const handleActionClick = useCallback((action: ContextMenuAction) => {
    if (action.disabled) return

    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    action.onClick()
    closeMenu()
  }, [closeMenu])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        closeMenu()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen, closeMenu])

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeMenu()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeMenu])

  const getActionVariantClasses = (variant: string = 'default') => {
    const variants = {
      default: 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800',
      danger: 'text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20',
      success: 'text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20',
      warning: 'text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/20'
    }
    return variants[variant as keyof typeof variants] || variants.default
  }

  const menu = isOpen && (
    <div
      ref={menuRef}
      className={`
        fixed z-50 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700
        min-w-[200px] max-w-[280px] py-2 animate-scale-in
        ${menuClassName}
      `}
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        transformOrigin: actualPosition === 'top' ? 'bottom left' : 'top left'
      }}
    >
      {actions.map((action, index) => (
        <React.Fragment key={action.id}>
          {action.divider && index > 0 && (
            <div className="h-px bg-neutral-200 dark:bg-neutral-700 my-1" />
          )}

          <button
            onClick={() => handleActionClick(action)}
            disabled={action.disabled}
            className={`
              w-full flex items-center space-x-3 px-4 py-3 text-left text-sm font-medium
              transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
              ${getActionVariantClasses(action.variant)}
            `}
          >
            {action.icon && (
              <div className="flex-shrink-0 w-5 h-5">
                {action.icon}
              </div>
            )}
            <span className="flex-1">{action.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  )

  return (
    <>
      <div
        ref={(el) => {
          if (triggerRef.current !== el) {
            triggerRef.current = el
            if (touchRef.current !== el) {
              touchRef.current = el
            }
          }
        }}
        onClick={handleClick}
        className={`${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className}`}
      >
        {children || (
          <button
            className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            aria-label="Menu de opções"
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {typeof window !== 'undefined' && createPortal(menu, document.body)}
    </>
  )
}

// Bottom sheet contextual menu for mobile
export interface MobileContextMenuProps {
  isOpen: boolean
  onClose: () => void
  actions: ContextMenuAction[]
  title?: string
}

export const MobileContextMenu: React.FC<MobileContextMenuProps> = ({
  isOpen,
  onClose,
  actions,
  title
}) => {
  if (!isOpen) return null

  const handleActionClick = (action: ContextMenuAction) => {
    if (action.disabled) return

    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    action.onClick()
    onClose()
  }

  const getActionVariantClasses = (variant: string = 'default') => {
    const variants = {
      default: 'text-neutral-700 dark:text-neutral-300',
      danger: 'text-error-600 dark:text-error-400',
      success: 'text-success-600 dark:text-success-400',
      warning: 'text-warning-600 dark:text-warning-400'
    }
    return variants[variant as keyof typeof variants] || variants.default
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Menu */}
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-xl shadow-xl animate-slide-up safe-bottom">
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 pb-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 pb-6 space-y-1">
          {actions.map((action, index) => (
            <React.Fragment key={action.id}>
              {action.divider && index > 0 && (
                <div className="h-px bg-neutral-200 dark:bg-neutral-700 my-3" />
              )}

              <button
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
                className={`
                  w-full flex items-center space-x-3 px-4 py-4 text-left rounded-lg
                  transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                  hover:bg-neutral-100 dark:hover:bg-neutral-800
                  ${getActionVariantClasses(action.variant)}
                `}
              >
                {action.icon && (
                  <div className="flex-shrink-0 w-6 h-6">
                    {action.icon}
                  </div>
                )}
                <span className="flex-1 font-medium">{action.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

// Hook for managing contextual menu state
export const useContextualMenu = () => {
  const [isOpen, setIsOpen] = useState(false)

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen(prev => !prev)

  return {
    isOpen,
    open,
    close,
    toggle
  }
}

// Swipe-to-reveal contextual actions
export interface SwipeActionsProps {
  leftActions?: ContextMenuAction[]
  rightActions?: ContextMenuAction[]
  children: React.ReactNode
  threshold?: number
  className?: string
}

export const SwipeActions: React.FC<SwipeActionsProps> = ({
  leftActions = [],
  rightActions = [],
  children,
  threshold = 80,
  className = ''
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isRevealed, setIsRevealed] = useState<'left' | 'right' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { ref: gestureRef } = useTouchGestures({
    onSwipe: (gesture) => {
      if (Math.abs(gesture.distance) > threshold) {
        if (gesture.direction === 'left' && rightActions.length > 0) {
          setIsRevealed('right')
          setSwipeOffset(-80)
        } else if (gesture.direction === 'right' && leftActions.length > 0) {
          setIsRevealed('left')
          setSwipeOffset(80)
        }
      } else {
        setIsRevealed(null)
        setSwipeOffset(0)
      }
    },
    onTouchMove: (event) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0]
        const startX = touch.clientX
        // Calculate offset during swipe for visual feedback
        // This would need more sophisticated tracking
      }
    },
    onTouchEnd: () => {
      // Snap to position or reset
      if (Math.abs(swipeOffset) < threshold / 2) {
        setSwipeOffset(0)
        setIsRevealed(null)
      }
    }
  })

  const handleActionClick = (action: ContextMenuAction) => {
    action.onClick()
    setSwipeOffset(0)
    setIsRevealed(null)
  }

  const renderActions = (actions: ContextMenuAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null

    return (
      <div
        className={`
          absolute top-0 ${side === 'left' ? 'left-0' : 'right-0'} h-full
          flex items-center ${side === 'left' ? 'justify-start' : 'justify-end'}
        `}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action)}
            className={`
              h-full px-4 flex items-center justify-center min-w-[80px]
              ${action.variant === 'danger'
                ? 'bg-error-500 text-white'
                : action.variant === 'success'
                ? 'bg-success-500 text-white'
                : 'bg-neutral-500 text-white'
              }
            `}
          >
            {action.icon || <span className="text-sm font-medium">{action.label}</span>}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left actions */}
      {renderActions(leftActions, 'left')}

      {/* Right actions */}
      {renderActions(rightActions, 'right')}

      {/* Main content */}
      <div
        ref={(el) => {
          if (containerRef.current !== el) {
            containerRef.current = el
            if (gestureRef.current !== el) {
              gestureRef.current = el
            }
          }
        }}
        className="relative z-10 bg-white dark:bg-neutral-900 transition-transform duration-200"
        style={{ transform: `translateX(${swipeOffset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}