import { Skeleton } from './skeleton'

export function DashboardCardSkeleton() {
  return (
    <div className="rounded-lg border bg-white dark:bg-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

export function DashboardStatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <DashboardCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function DashboardChartSkeleton() {
  return (
    <div className="rounded-lg border bg-white dark:bg-gray-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-12" />
            <Skeleton
              className="h-8"
              style={{ width: `${Math.random() * 60 + 20}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardFullSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      <DashboardStatsSkeleton />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardChartSkeleton />
        <DashboardChartSkeleton />
      </div>
    </div>
  )
}
