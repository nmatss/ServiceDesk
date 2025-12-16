/**
 * Skeleton Component
 *
 * Loading placeholder with various shapes and animation styles.
 *
 * @module components/ui/skeleton
 */

import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  /** Animation type */
  animation?: 'pulse' | 'shimmer' | 'none'
}

export function Skeleton({ className, animation = 'pulse', ...props }: SkeletonProps) {
  const animationClasses = {
    pulse: 'animate-pulse',
    shimmer: 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
    none: '',
  }

  return (
    <div
      className={cn(
        'rounded-md bg-gray-200 dark:bg-gray-700',
        animationClasses[animation],
        className
      )}
      {...props}
    />
  )
}

export function SkeletonText({
  lines = 3,
  className,
  size = 'base'
}: {
  lines?: number
  className?: string
  size?: 'xs' | 'sm' | 'base' | 'lg'
}) {
  const sizeClasses = {
    xs: 'h-3',
    sm: 'h-3.5',
    base: 'h-4',
    lg: 'h-5',
  }

  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            sizeClasses[size],
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          )}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-white dark:bg-gray-800 p-6', className)}>
      <div className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <SkeletonText lines={3} />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeClasses = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  }

  return <Skeleton className={cn('rounded-full', sizeClasses[size])} />
}

// ========================================
// Ticket Skeleton
// ========================================

export function SkeletonTicketCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-white dark:bg-gray-800 p-4', className)}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        {/* Title */}
        <Skeleton className="h-5 w-4/5" />

        {/* Description */}
        <SkeletonText lines={2} size="sm" />

        {/* Tags */}
        <div className="flex gap-1">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-18 rounded-full" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <SkeletonAvatar size="sm" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

// ========================================
// List Skeleton
// ========================================

export function SkeletonListItem({
  hasAvatar = true,
  hasSubtitle = true,
  className
}: {
  hasAvatar?: boolean
  hasSubtitle?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 p-3', className)}>
      {hasAvatar && <SkeletonAvatar size="md" />}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        {hasSubtitle && <Skeleton className="h-3 w-1/2" />}
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  )
}

export function SkeletonList({
  items = 5,
  hasAvatar = true,
  hasSubtitle = true
}: {
  items?: number
  hasAvatar?: boolean
  hasSubtitle?: boolean
}) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} hasAvatar={hasAvatar} hasSubtitle={hasSubtitle} />
      ))}
    </div>
  )
}

// ========================================
// Table Skeleton
// ========================================

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true
}: {
  rows?: number
  columns?: number
  showHeader?: boolean
}) {
  return (
    <div className="w-full">
      {showHeader && (
        <div className="flex gap-4 pb-3 border-b border-gray-200 dark:border-gray-700 mb-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-4 flex-1" />
          ))}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-4 items-center">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-4 flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ========================================
// Dashboard Widget Skeleton
// ========================================

export function SkeletonWidget({
  type = 'stat'
}: {
  type?: 'stat' | 'chart' | 'list' | 'table'
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      {type === 'stat' && (
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )}

      {type === 'chart' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {type === 'list' && (
        <div className="space-y-4">
          <Skeleton className="h-5 w-1/3" />
          <SkeletonList items={4} />
        </div>
      )}

      {type === 'table' && (
        <div className="space-y-4">
          <Skeleton className="h-5 w-1/3" />
          <SkeletonTable rows={4} columns={3} />
        </div>
      )}
    </div>
  )
}

// ========================================
// Dashboard Skeleton
// ========================================

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonWidget key={i} type="stat" />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonWidget type="chart" />
        <SkeletonWidget type="chart" />
      </div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonWidget type="list" />
        <SkeletonWidget type="list" />
        <SkeletonWidget type="table" />
      </div>
    </div>
  )
}

// ========================================
// Kanban Skeleton
// ========================================

export function SkeletonKanbanColumn() {
  return (
    <div className="w-72 flex-shrink-0">
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-t-lg animate-pulse" />
      <div className="min-h-96 bg-gray-100 dark:bg-gray-800 rounded-b-lg p-2 space-y-2 border border-t-0 border-gray-200 dark:border-gray-700">
        <SkeletonTicketCard />
        <SkeletonTicketCard />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  )
}

export function SkeletonKanbanBoard() {
  return (
    <div className="flex gap-4 overflow-x-auto p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonKanbanColumn key={i} />
      ))}
    </div>
  )
}
