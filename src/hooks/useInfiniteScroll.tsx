'use client'

import { useEffect, useCallback, useRef, useState } from 'react'

export interface InfiniteScrollOptions<T> {
  fetchMore: (page: number) => Promise<{
    data: T[]
    hasMore: boolean
    total?: number
  }>
  initialData?: T[]
  threshold?: number // Distance from bottom to trigger loading
  enabled?: boolean
  resetDeps?: React.DependencyList // Dependencies that should reset the scroll
}

export interface InfiniteScrollResult<T> {
  data: T[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: Error | null
  total?: number
  currentPage: number
  refetch: () => void
  reset: () => void
  loadMore: () => void
}

export const useInfiniteScroll = <T,>(
  options: InfiniteScrollOptions<T>
): InfiniteScrollResult<T> => {
  const {
    fetchMore,
    initialData = [],
    threshold = 200,
    enabled = true,
    resetDeps = []
  } = options

  const [data, setData] = useState<T[]>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadingElementRef = useRef<HTMLDivElement | null>(null)
  const isInitialLoadRef = useRef(true)

  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore || !hasMore) return

    try {
      setIsLoadingMore(true)
      setError(null)

      const result = await fetchMore(currentPage)

      setData(prevData => [...prevData, ...result.data])
      setHasMore(result.hasMore)
      setCurrentPage(prev => prev + 1)

      if (result.total !== undefined) {
        setTotal(result.total)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more data'))
    } finally {
      setIsLoadingMore(false)
    }
  }, [enabled, isLoadingMore, hasMore, currentPage, fetchMore])

  const refetch = useCallback(async () => {
    if (!enabled) return

    try {
      setIsLoading(true)
      setError(null)
      setCurrentPage(1)

      const result = await fetchMore(1)

      setData(result.data)
      setHasMore(result.hasMore)
      setCurrentPage(2)

      if (result.total !== undefined) {
        setTotal(result.total)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'))
    } finally {
      setIsLoading(false)
    }
  }, [enabled, fetchMore])

  const reset = useCallback(() => {
    setData(initialData)
    setIsLoading(false)
    setIsLoadingMore(false)
    setHasMore(true)
    setError(null)
    setTotal(undefined)
    setCurrentPage(1)
    isInitialLoadRef.current = true
  }, [initialData])

  // Initial load
  useEffect(() => {
    if (enabled && isInitialLoadRef.current && data.length === 0) {
      isInitialLoadRef.current = false
      refetch()
    }
  }, [enabled, data.length, refetch])

  // Reset when dependencies change
  useEffect(() => {
    if (resetDeps.length > 0) {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps)

  // Set up intersection observer for automatic loading
  useEffect(() => {
    if (!enabled || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !isLoadingMore) {
          loadMore()
        }
      },
      {
        rootMargin: `${threshold}px`,
        threshold: 0.1
      }
    )

    observerRef.current = observer

    if (loadingElementRef.current) {
      observer.observe(loadingElementRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [enabled, hasMore, isLoadingMore, loadMore, threshold])

  return {
    data,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    total,
    currentPage,
    refetch,
    reset,
    loadMore
  }
}

// Component for the loading indicator
export const InfiniteScrollLoader: React.FC<{
  isLoading: boolean
  hasMore: boolean
  error: Error | null
  onRetry?: () => void
  className?: string
}> = ({ isLoading, hasMore, error, onRetry, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null)

  if (!hasMore && !error) {
    return (
      <div className={`text-center py-8 text-neutral-500 dark:text-neutral-400 ${className}`}>
        <p>Não há mais itens para carregar</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-error-600 dark:text-error-400 mb-4">
          Erro ao carregar dados: {error.message}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-secondary"
          >
            Tentar novamente
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className={`text-center py-8 ${className}`}>
      {isLoading && (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-6 h-6 loading-spinner" />
          <span className="text-neutral-600 dark:text-neutral-400">
            Carregando...
          </span>
        </div>
      )}
    </div>
  )
}

// Hook specifically for virtual scrolling with windowing
export const useVirtualizedInfiniteScroll = <T,>(
  options: InfiniteScrollOptions<T> & {
    itemHeight: number
    containerHeight: number
    overscan?: number
  }
) => {
  const {
    itemHeight,
    containerHeight,
    overscan = 5,
    ...infiniteOptions
  } = options

  const infiniteResult = useInfiniteScroll(infiniteOptions)
  const [scrollTop, setScrollTop] = useState(0)

  const visibleItemCount = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    infiniteResult.data.length - 1,
    startIndex + visibleItemCount + overscan * 2
  )

  const visibleItems = infiniteResult.data.slice(startIndex, endIndex + 1)
  const totalHeight = infiniteResult.data.length * itemHeight
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    ...infiniteResult,
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    handleScroll
  }
}