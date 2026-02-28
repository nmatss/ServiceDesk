'use client'

import React, { useState } from 'react'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'

/**
 * IconComponent type that accepts both regular components and forward refs from Heroicons
 */
type IconComponent = React.ComponentType<{ className?: string }> | React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>

interface TooltipProps {
  content: string | React.ReactNode
  children: React.ReactElement
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
  disabled?: boolean
}

export default function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 200,
  className = '',
  disabled = false
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  if (disabled || !content) {
    return children
  }

  const getPlacementClasses = () => {
    switch (placement) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2'
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2'
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2'
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
    }
  }

  const getArrowClasses = () => {
    switch (placement) {
      case 'top':
        return 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l-transparent border-r-transparent border-b-transparent border-t-neutral-900 dark:border-t-neutral-700'
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l-transparent border-r-transparent border-t-transparent border-b-neutral-900 dark:border-b-neutral-700'
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t-transparent border-b-transparent border-r-transparent border-l-neutral-900 dark:border-l-neutral-700'
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 -mr-1 border-t-transparent border-b-transparent border-l-transparent border-r-neutral-900 dark:border-r-neutral-700'
      default:
        return 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l-transparent border-r-transparent border-b-transparent border-t-neutral-900 dark:border-t-neutral-700'
    }
  }

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setIsVisible(false)
  }

  return (
    <Popover className="relative inline-flex">
      <PopoverButton
        as="span"
        className="inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </PopoverButton>
      {isVisible && (
        <PopoverPanel
          static
          className={`
            absolute z-[9999] pointer-events-none
            ${getPlacementClasses()}
            ${className}
          `}
        >
          <div
            className={`
              relative px-3 py-2 bg-neutral-900 dark:bg-neutral-700
              text-white dark:text-neutral-100 text-sm rounded-lg shadow-lg
              whitespace-nowrap transition-all duration-200
              opacity-100 scale-100
            `}
          >
            {content}
            {/* Arrow */}
            <div
              className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`}
              aria-hidden="true"
            />
          </div>
        </PopoverPanel>
      )}
    </Popover>
  )
}

/**
 * IconButton with integrated tooltip props
 * @property {IconComponent} icon - Icon component to display
 * @property {string} tooltip - Tooltip text to show on hover
 * @property {string} tooltipPlacement - Tooltip position
 * @property {string} label - Accessible label for screen readers
 * @property {string} variant - Button style variant
 * @property {number | string} badge - Optional badge value
 */
interface IconButtonWithTooltipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconComponent
  tooltip: string
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right'
  label: string
  variant?: 'ghost' | 'primary' | 'secondary'
  badge?: number | string
}

export function IconButtonWithTooltip({
  icon: Icon,
  tooltip,
  tooltipPlacement = 'bottom',
  label,
  variant = 'ghost',
  badge,
  className = '',
  ...buttonProps
}: IconButtonWithTooltipProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-brand-600 hover:bg-brand-700 text-white dark:bg-brand-500 dark:hover:bg-brand-600'
      case 'secondary':
        return 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white'
      case 'ghost':
      default:
        return 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
    }
  }

  return (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      <button
        className={`
          relative p-2 rounded-lg transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
          active:scale-95
          ${getVariantClasses()}
          ${className}
        `}
        aria-label={label}
        {...buttonProps}
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs font-medium rounded-full min-w-[1.25rem] flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>
    </Tooltip>
  )
}
