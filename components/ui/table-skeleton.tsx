import { Skeleton } from './skeleton'

interface TableSkeletonProps {
  columns?: number
  rows?: number
  showHeader?: boolean
  showPagination?: boolean
}

export function TableSkeleton({
  columns = 5,
  rows = 10,
  showHeader = true,
  showPagination = true
}: TableSkeletonProps) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border bg-white dark:bg-gray-800">
        {showHeader && (
          <div className="border-b bg-gray-50 dark:bg-gray-900/50 p-4">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-4"
                  style={{ width: `${100 / columns}%` }}
                />
              ))}
            </div>
          </div>
        )}

        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="border-b last:border-b-0 p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className="h-4"
                  style={{
                    width: colIndex === 0
                      ? '20%'
                      : colIndex === columns - 1
                        ? '10%'
                        : `${80 / (columns - 2)}%`
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {showPagination && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function UserTableSkeleton() {
  return <TableSkeleton columns={5} rows={10} showHeader showPagination />
}

export function AdminTableSkeleton() {
  return <TableSkeleton columns={6} rows={15} showHeader showPagination />
}

/**
 * CMDB Grid Skeleton - For Configuration Items grid view
 */
export function CMDBGridSkeleton({ items = 12 }: { items?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="glass-panel p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Knowledge Article List Skeleton
 */
export function ArticleListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="glass-panel p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="space-y-2 mb-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Team Card Skeleton
 */
export function TeamCardSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Page Skeleton with Stats and Table
 */
export function PageSkeleton({
  showStats = false,
  statsCount = 4
}: {
  showStats?: boolean
  statsCount?: number
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${statsCount} gap-6`}>
          {Array.from({ length: statsCount }).map((_, i) => (
            <div key={i} className="glass-panel p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel p-4 flex items-center gap-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Table */}
      <div className="glass-panel p-6">
        <TableSkeleton />
      </div>
    </div>
  )
}
