import { Skeleton, SkeletonAvatar } from './skeleton'

export function TicketSkeleton() {
  return (
    <div className="rounded-lg border bg-white dark:bg-gray-800 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="flex items-center gap-3">
        <SkeletonAvatar size="sm" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  )
}

export function TicketListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <TicketSkeleton key={i} />
      ))}
    </div>
  )
}

export function TicketTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-white dark:bg-gray-800">
      <div className="border-b bg-gray-50 dark:bg-gray-900/50 p-4">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b last:border-b-0 p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
