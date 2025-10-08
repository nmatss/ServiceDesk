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
