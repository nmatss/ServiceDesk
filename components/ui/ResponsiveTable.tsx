'use client'

import React from 'react'
import { cn } from '@/lib/design-system/utils'

/**
 * ResponsiveTable - Mobile-optimized table component
 *
 * Automatically transforms into card layout on mobile devices
 * while maintaining table layout on desktop
 */

export interface ResponsiveTableProps {
  children: React.ReactNode
  className?: string
  /** Headers to display in mobile card view */
  headers?: string[]
  /** Show table on mobile instead of cards */
  forceTableOnMobile?: boolean
}

export function ResponsiveTable({
  children,
  className,
  headers = [],
  forceTableOnMobile = false
}: ResponsiveTableProps) {
  return (
    <div className={cn('responsive-table-container', className)}>
      {/* Desktop: Full table */}
      <div className={cn(
        'overflow-x-auto',
        !forceTableOnMobile && 'hidden md:block'
      )}>
        <table className="table w-full">
          {children}
        </table>
      </div>

      {/* Mobile: Card layout (only if not forced to show table) */}
      {!forceTableOnMobile && (
        <div className="md:hidden space-y-3">
          {/* Cards will be rendered by MobileTableCard component */}
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * MobileTableCard - Card representation for mobile table rows
 */
export interface MobileTableCardProps {
  data: Array<{
    label: string
    value: React.ReactNode
    className?: string
  }>
  onClick?: () => void
  className?: string
}

export function MobileTableCard({ data, onClick, className }: MobileTableCardProps) {
  return (
    <div
      className={cn(
        'card p-4 space-y-3 md:hidden',
        onClick && 'cursor-pointer hover:shadow-medium active:scale-[0.98] transition-all',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyPress={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {data.map((item, index) => (
        <div key={index} className="flex justify-between items-start gap-3">
          <span className="text-sm font-medium text-description flex-shrink-0">
            {item.label}:
          </span>
          <span className={cn(
            'text-sm text-neutral-900 dark:text-neutral-100 text-right',
            item.className
          )}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * ScrollableTable - Horizontal scrollable table wrapper for complex tables
 * Use this when you need to maintain table layout on mobile with horizontal scroll
 */
export interface ScrollableTableProps {
  children: React.ReactNode
  className?: string
  /** Show scroll indicator hint */
  showScrollHint?: boolean
}

export function ScrollableTable({
  children,
  className,
  showScrollHint = true
}: ScrollableTableProps) {
  const [showHint, setShowHint] = React.useState(showScrollHint)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current && scrollRef.current.scrollLeft > 0) {
        setShowHint(false)
      }
    }

    const ref = scrollRef.current
    ref?.addEventListener('scroll', handleScroll)
    return () => ref?.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className={cn(
          'overflow-x-auto scrollbar-thin scroll-smooth-mobile',
          className
        )}
      >
        <table className="table w-full">
          {children}
        </table>
      </div>

      {/* Scroll hint for mobile */}
      {showHint && (
        <div className="md:hidden absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white dark:from-neutral-900 to-transparent pointer-events-none flex items-center justify-end pr-2">
          <div className="text-xs text-muted-content rotate-90 animate-pulse">
            Deslize
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ResponsiveTableRow - Helper component for building responsive table rows
 */
export interface ResponsiveTableRowProps {
  /** Data for mobile card view */
  mobileData?: Array<{
    label: string
    value: React.ReactNode
    className?: string
  }>
  /** Desktop table row content */
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function ResponsiveTableRow({
  mobileData,
  children,
  onClick,
  className
}: ResponsiveTableRowProps) {
  return (
    <>
      {/* Desktop */}
      <tr
        className={cn(
          'hidden md:table-row table-row',
          onClick && 'cursor-pointer',
          className
        )}
        onClick={onClick}
      >
        {children}
      </tr>

      {/* Mobile */}
      {mobileData && (
        <MobileTableCard
          data={mobileData}
          onClick={onClick}
          className={className}
        />
      )}
    </>
  )
}
