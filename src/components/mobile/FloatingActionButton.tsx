'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

export interface FABAction {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  disabled?: boolean
  badge?: number
}

export interface FloatingActionButtonProps {
  actions?: FABAction[]
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center'
  size?: 'sm' | 'md' | 'lg'
  mainIcon?: React.ReactNode
  mainAction?: () => void
  autoHide?: boolean
  className?: string
  style?: 'standard' | 'extended' | 'mini'
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  actions = [],
  position = 'bottom-right',
  size = 'md',
  mainIcon = <PlusIcon className="h-6 w-6" />,
  mainAction,
  autoHide = true,
  className = '',
  style = 'standard'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const fabRef = useRef<HTMLDivElement>(null)

  // Auto-hide on scroll
  useEffect(() => {
    if (!autoHide) return

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
        setIsOpen(false)
      } else {
        setIsVisible(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY, autoHide])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false)
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
  }, [isOpen])

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 transform -translate-x-1/2'
  }

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  }

  const iconSizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7'
  }

  const getActionColorClasses = (color: string = 'primary') => {
    const colors = {
      primary: 'bg-brand-500 hover:bg-brand-600 text-white',
      secondary: 'bg-neutral-500 hover:bg-neutral-600 text-white',
      success: 'bg-success-500 hover:bg-success-600 text-white',
      warning: 'bg-warning-500 hover:bg-warning-600 text-white',
      error: 'bg-error-500 hover:bg-error-600 text-white'
    }
    return colors[color as keyof typeof colors] || colors.primary
  }

  const handleMainAction = () => {
    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(15)
    }

    if (actions.length > 0) {
      setIsOpen(!isOpen)
    } else if (mainAction) {
      mainAction()
    }
  }

  const handleActionClick = (action: FABAction) => {
    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    action.onClick()
    setIsOpen(false)
  }

  return (
    <div
      ref={fabRef}
      className={`
        fixed z-50 ${positionClasses[position]}
        transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}
        ${className}
      `}
    >
      {/* Speed Dial Actions */}
      {actions.length > 0 && isOpen && (
        <div className="absolute bottom-16 right-0 space-y-3 mb-2">
          {actions.map((action, index) => (
            <div
              key={action.id}
              className="flex items-center space-x-3 animate-scale-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Action Label */}
              <div className="bg-black bg-opacity-80 text-white text-sm px-3 py-1 rounded-full whitespace-nowrap">
                {action.label}
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
                className={`
                  relative flex items-center justify-center w-12 h-12 rounded-full shadow-lg
                  transition-all duration-200 hover:scale-110 active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${getActionColorClasses(action.color)}
                `}
                aria-label={action.label}
              >
                {React.cloneElement(action.icon as React.ReactElement, {
                  className: iconSizeClasses.sm
                })}

                {/* Badge */}
                {action.badge && action.badge > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-error-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {action.badge > 99 ? '99+' : action.badge}
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={handleMainAction}
        className={`
          ${sizeClasses[size]} bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg
          flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95
          focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2
          ${isOpen ? 'rotate-45' : 'rotate-0'}
        `}
        aria-label={actions.length > 0 ? 'Abrir menu de ações' : 'Ação principal'}
      >
        {isOpen ? (
          <XMarkIcon className={iconSizeClasses[size]} />
        ) : (
          React.cloneElement(mainIcon as React.ReactElement, {
            className: iconSizeClasses[size]
          })
        )}
      </button>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

// Extended FAB with text
export interface ExtendedFABProps {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  autoHide?: boolean
  className?: string
}

export const ExtendedFloatingActionButton: React.FC<ExtendedFABProps> = ({
  label,
  icon = <PlusIcon className="h-5 w-5" />,
  onClick,
  position = 'bottom-right',
  color = 'primary',
  autoHide = true,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Auto-hide on scroll
  useEffect(() => {
    if (!autoHide) return

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY, autoHide])

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 transform -translate-x-1/2'
  }

  const colorClasses = {
    primary: 'bg-brand-500 hover:bg-brand-600',
    secondary: 'bg-neutral-500 hover:bg-neutral-600',
    success: 'bg-success-500 hover:bg-success-600',
    warning: 'bg-warning-500 hover:bg-warning-600',
    error: 'bg-error-500 hover:bg-error-600'
  }

  const handleClick = () => {
    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(15)
    }

    onClick()
  }

  return (
    <button
      onClick={handleClick}
      className={`
        fixed z-50 ${positionClasses[position]}
        ${colorClasses[color]} text-white px-4 py-3 rounded-full shadow-lg
        flex items-center space-x-2 transition-all duration-300 ease-out
        hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-400
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}
        ${className}
      `}
      aria-label={label}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </button>
  )
}

// Mini FAB for compact spaces
export interface MiniFABProps {
  icon: React.ReactNode
  onClick: () => void
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  className?: string
  ariaLabel?: string
}

export const MiniFloatingActionButton: React.FC<MiniFABProps> = ({
  icon,
  onClick,
  color = 'primary',
  className = '',
  ariaLabel = 'Ação'
}) => {
  const colorClasses = {
    primary: 'bg-brand-500 hover:bg-brand-600',
    secondary: 'bg-neutral-500 hover:bg-neutral-600',
    success: 'bg-success-500 hover:bg-success-600',
    warning: 'bg-warning-500 hover:bg-warning-600',
    error: 'bg-error-500 hover:bg-error-600'
  }

  const handleClick = () => {
    // Add haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10)
    }

    onClick()
  }

  return (
    <button
      onClick={handleClick}
      className={`
        w-10 h-10 ${colorClasses[color]} text-white rounded-full shadow-md
        flex items-center justify-center transition-all duration-200
        hover:scale-110 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-400
        ${className}
      `}
      aria-label={ariaLabel}
    >
      {React.cloneElement(icon as React.ReactElement, {
        className: 'h-5 w-5'
      })}
    </button>
  )
}

// Hook for managing FAB state
export const useFloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  const open = () => setIsOpen(true)
  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen(prev => !prev)

  const show = () => setIsVisible(true)
  const hide = () => setIsVisible(false)
  const toggleVisibility = () => setIsVisible(prev => !prev)

  return {
    isOpen,
    isVisible,
    open,
    close,
    toggle,
    show,
    hide,
    toggleVisibility
  }
}