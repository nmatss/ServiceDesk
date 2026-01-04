'use client'

import React, { useEffect, useRef, useCallback, useState } from 'react'

export interface InfiniteScrollProps {
  children: React.ReactNode
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void | Promise<void>
  threshold?: number
  loader?: React.ReactNode
  endMessage?: React.ReactNode
  className?: string
}

export const InfiniteScroll: React.FC<InfiniteScrollProps> = ({
  children,
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 300,
  loader,
  endMessage,
  className = ''
}) => {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const handleLoadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    try {
      await onLoadMore()
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoading, isLoadingMore, hasMore, onLoadMore])

  useEffect(() => {
    const loadMoreElement = loadMoreRef.current
    if (!loadMoreElement) return

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry && entry.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          handleLoadMore()
        }
      },
      {
        rootMargin: `${threshold}px`,
        threshold: 0.1
      }
    )

    observerRef.current.observe(loadMoreElement)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, isLoading, isLoadingMore, threshold, handleLoadMore])

  const defaultLoader = (
    <div className="flex items-center justify-center py-8">
      <div className="flex flex-col items-center space-y-2">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-description">Loading more...</p>
      </div>
    </div>
  )

  const defaultEndMessage = (
    <div className="flex items-center justify-center py-8">
      <p className="text-sm text-muted-content">
        No more items to load
      </p>
    </div>
  )

  return (
    <div className={className}>
      {children}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="w-full">
        {(isLoading || isLoadingMore) && (loader || defaultLoader)}
        {!hasMore && !isLoading && (endMessage || defaultEndMessage)}
      </div>
    </div>
  )
}
