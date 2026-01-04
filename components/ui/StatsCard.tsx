'use client'

import React from 'react'
import {
  ChartBarIcon,
  UserGroupIcon,
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon
} from '@heroicons/react/24/outline'

/**
 * IconComponent type that accepts both regular components and forward refs from Heroicons
 */
type IconComponent = React.ComponentType<{ className?: string }> | React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>

/**
 * StatsCard component props
 * @property {string} title - The title of the stat card (alias: label)
 * @property {string} label - Alternative prop name for title
 * @property {string | number} value - The main value to display
 * @property {object} change - Optional change indicator with value, type, and period
 * @property {string} trend - Alternative way to specify trend direction (up/down/neutral)
 * @property {string} trendValue - Alternative way to specify trend percentage
 * @property {string} trendLabel - Alternative way to specify trend period label
 * @property {IconComponent | React.ReactNode | string} icon - Icon as component, element, or preset key
 * @property {string} color - Color theme for the card
 * @property {string} variant - Card style variant (default/glass)
 * @property {string} size - Size variant (sm, md, lg)
 * @property {boolean} loading - Loading state indicator
 * @property {function} onClick - Optional click handler
 * @property {string} description - Optional description text
 * @property {string} valueColor - Custom color class for the value
 * @property {string} className - Additional CSS classes
 */
interface StatsCardProps {
  title?: string
  label?: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
    period?: string
  }
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  trendLabel?: string
  icon?: IconComponent | React.ReactNode | 'tickets' | 'users' | 'time' | 'resolved' | 'pending' | 'chart'
  color?: 'brand' | 'success' | 'warning' | 'error' | 'neutral' | 'info'
  variant?: 'default' | 'glass'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  onClick?: () => void
  description?: string
  valueColor?: string
  className?: string
}

const iconMap = {
  tickets: TicketIcon,
  users: UserGroupIcon,
  time: ClockIcon,
  resolved: CheckCircleIcon,
  pending: ExclamationTriangleIcon,
  chart: ChartBarIcon
}

const colorConfig = {
  brand: {
    bg: 'bg-brand-500',
    bgLight: 'bg-brand-50 dark:bg-brand-900/20',
    text: 'text-brand-600 dark:text-brand-400',
    gradient: 'bg-gradient-brand'
  },
  success: {
    bg: 'bg-success-500',
    bgLight: 'bg-success-50 dark:bg-success-900/20',
    text: 'text-success-600 dark:text-success-400',
    gradient: 'bg-gradient-success'
  },
  warning: {
    bg: 'bg-warning-500',
    bgLight: 'bg-warning-50 dark:bg-warning-900/20',
    text: 'text-warning-600 dark:text-warning-400',
    gradient: 'bg-gradient-warning'
  },
  error: {
    bg: 'bg-error-500',
    bgLight: 'bg-error-50 dark:bg-error-900/20',
    text: 'text-error-600 dark:text-error-400',
    gradient: 'bg-gradient-error'
  },
  info: {
    bg: 'bg-brand-500',
    bgLight: 'bg-brand-50 dark:bg-brand-900/20',
    text: 'text-brand-600 dark:text-brand-400',
    gradient: 'bg-gradient-brand'
  },
  neutral: {
    bg: 'bg-neutral-500',
    bgLight: 'bg-neutral-50 dark:bg-neutral-800',
    text: 'text-description',
    gradient: 'bg-gradient-to-r from-neutral-500 to-neutral-400'
  }
}

const sizeConfig = {
  sm: {
    container: 'p-4',
    icon: 'h-5 w-5',
    iconContainer: 'p-2',
    title: 'text-xs',
    value: 'text-lg',
    change: 'text-xs'
  },
  md: {
    container: 'p-5',
    icon: 'h-6 w-6',
    iconContainer: 'p-3',
    title: 'text-sm',
    value: 'text-2xl',
    change: 'text-sm'
  },
  lg: {
    container: 'p-6',
    icon: 'h-8 w-8',
    iconContainer: 'p-4',
    title: 'text-base',
    value: 'text-3xl',
    change: 'text-base'
  }
}

export function StatsCard({
  title,
  label,
  value,
  change,
  trend,
  trendValue,
  trendLabel,
  icon,
  color = 'brand',
  variant = 'default',
  size = 'md',
  loading = false,
  onClick,
  description,
  valueColor,
  className = ''
}: StatsCardProps) {
  const colors = colorConfig[color]
  const sizes = sizeConfig[size]

  // Support both title and label props
  const displayTitle = title || label || ''

  // Convert trend props to change object if provided
  const displayChange = change || (trend && trendValue ? {
    value: parseFloat(trendValue.replace('%', '')),
    type: trend === 'up' ? 'increase' as const : trend === 'down' ? 'decrease' as const : 'neutral' as const,
    period: trendLabel
  } : undefined)

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      // Format large numbers
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}k`
      }
      return val.toLocaleString()
    }
    return val
  }

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'increase':
        return ArrowTrendingUpIcon
      case 'decrease':
        return ArrowTrendingDownIcon
      default:
        return MinusIcon
    }
  }

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'increase':
        return 'text-success-600 dark:text-success-400'
      case 'decrease':
        return 'text-error-600 dark:text-error-400'
      default:
        return 'text-description'
    }
  }

  const ChangeIcon = displayChange ? getChangeIcon(displayChange.type) : null

  // Render icon - handles React elements, component types, and string keys
  const renderIcon = () => {
    // Handle React elements (JSX icons)
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon as React.ReactElement, {
        className: `${sizes.icon} ${colors.text}`
      })
    }

    // Handle string keys from iconMap
    if (typeof icon === 'string' && iconMap[icon as keyof typeof iconMap]) {
      const IconComponent = iconMap[icon as keyof typeof iconMap]
      return <IconComponent className={`${sizes.icon} ${colors.text}`} aria-hidden="true" />
    }

    // Handle icon as a component (ComponentType or ForwardRefExoticComponent)
    if (typeof icon === 'function' || (icon && typeof icon === 'object' && '$$typeof' in icon)) {
      const IconComponent = icon as IconComponent
      return <IconComponent className={`${sizes.icon} ${colors.text}`} aria-hidden="true" />
    }

    // Default icon if none provided
    return <ChartBarIcon className={`${sizes.icon} ${colors.text}`} aria-hidden="true" />
  }

  // Determine value color class
  const valueColorClass = valueColor || 'text-neutral-900 dark:text-neutral-100'

  // Determine card variant classes
  const variantClasses = variant === 'glass'
    ? 'glass-panel'
    : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm'

  return (
    <div
      className={`
        ${variantClasses} group relative overflow-hidden
        transition-all duration-300 hover:shadow-large hover:-translate-y-1
        ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}
        ${loading ? 'animate-pulse' : 'animate-slide-up'}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={sizes.container}>
        <div className="flex items-center justify-between">
          {/* Icon and Title Section */}
          <div className="flex items-center space-x-4">
            <div className={`${colors.bgLight} ${sizes.iconContainer} rounded-xl transition-all duration-300 group-hover:scale-110`}>
              {loading ? (
                <div className={`${sizes.icon} bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse`} />
              ) : (
                renderIcon()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <dt className={`${sizes.title} font-medium text-muted-content truncate`}>
                {displayTitle}
              </dt>
              <dd className="flex items-baseline space-x-2">
                <div className={`${sizes.value} font-bold ${valueColorClass}`}>
                  {loading ? (
                    <div className="w-16 h-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
                  ) : (
                    formatValue(value)
                  )}
                </div>
              </dd>
              {description && !loading && (
                <p className="text-xs text-muted-content mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Change Indicator */}
          {displayChange && !loading && (
            <div className={`flex items-center space-x-1 ${sizes.change} font-semibold ${getChangeColor(displayChange.type)}`}>
              {ChangeIcon && <ChangeIcon className="h-4 w-4" />}
              <span>{Math.abs(displayChange.value)}%</span>
            </div>
          )}
        </div>

        {/* Bottom Section with Change Details */}
        {displayChange && !loading && !description && (
          <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <div className={`text-xs ${getChangeColor(displayChange.type)}`}>
                <span className="font-medium">
                  {displayChange.type === 'increase' ? 'Aumento' :
                   displayChange.type === 'decrease' ? 'Diminuição' :
                   'Sem mudança'}
                </span>
                <span className="text-muted-content ml-1">
                  {displayChange.period || 'vs período anterior'}
                </span>
              </div>

              {/* Optional: Progress bar for visual change representation */}
              <div className="flex items-center space-x-2">
                <div className="w-16 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors.bg} transition-all duration-1000 ease-out`}
                    style={{
                      width: `${Math.min(Math.abs(displayChange.value), 100)}%`,
                      transform: displayChange.type === 'decrease' ? 'scaleX(-1)' : 'none'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hover effect gradient overlay */}
      {onClick && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-xl pointer-events-none">
          <div className={`w-full h-full ${colors.gradient} rounded-xl`} />
        </div>
      )}
    </div>
  )
}

// Loading skeleton variant
export function StatsCardSkeleton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = sizeConfig[size]

  return (
    <div className="glass-panel animate-pulse">
      <div className={sizes.container}>
        <div className="flex items-center space-x-4">
          <div className={`${sizes.iconContainer} bg-neutral-200 dark:bg-neutral-700 rounded-xl`}>
            <div className={`${sizes.icon} bg-neutral-200 dark:bg-neutral-700 rounded`} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="w-24 h-4 bg-neutral-200 dark:bg-neutral-700 rounded" />
            <div className="w-16 h-8 bg-neutral-200 dark:bg-neutral-700 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Grid container for stats cards
export function StatsGrid({
  children,
  cols = 4,
  className = ''
}: {
  children: React.ReactNode
  cols?: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
}) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  }

  return (
    <div className={`grid gap-4 sm:gap-6 ${gridCols[cols]} ${className}`}>
      {children}
    </div>
  )
}

export default StatsCard