'use client'

import React from 'react'
import { Tooltip as HeadlessTooltip, TooltipButton, TooltipPanel } from '@headlessui/react'

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
        return 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l-transparent border-r-transparent border-b-transparent border-t-neutral-900 dark:border-t-neutral-100'
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l-transparent border-r-transparent border-t-transparent border-b-neutral-900 dark:border-b-neutral-100'
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t-transparent border-b-transparent border-r-transparent border-l-neutral-900 dark:border-l-neutral-100'
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 -mr-1 border-t-transparent border-b-transparent border-l-transparent border-r-neutral-900 dark:border-r-neutral-100'
      default:
        return 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l-transparent border-r-transparent border-b-transparent border-t-neutral-900 dark:border-t-neutral-100'
    }
  }

  return (
    <HeadlessTooltip>
      <TooltipButton as="span" className="inline-flex">
        {children}
      </TooltipButton>
      <TooltipPanel
        style={{ transitionDelay: `${delay}ms` }}
        className={`
          absolute z-[9999] pointer-events-none
          ${getPlacementClasses()}
          ${className}
        `}
      >
        {({ open }) => (
          <div
            className={`
              relative px-3 py-2 bg-neutral-900 dark:bg-neutral-100
              text-white dark:text-neutral-900 text-sm rounded-lg shadow-lg
              whitespace-nowrap transition-all duration-200
              ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
            `}
          >
            {content}
            {/* Arrow */}
            <div
              className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`}
              aria-hidden="true"
            />
          </div>
        )}
      </TooltipPanel>
    </HeadlessTooltip>
  )
}

// IconButton with integrated tooltip
interface IconButtonWithTooltipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>
  tooltip: string
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right'
  label: string // for aria-label
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
        return 'bg-brand-600 hover:bg-brand-700 text-white'
      case 'secondary':
        return 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600'
      case 'ghost':
      default:
        return 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
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
