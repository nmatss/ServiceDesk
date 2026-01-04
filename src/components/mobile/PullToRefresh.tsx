'use client'

import React from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { usePullToRefresh } from '@/lib/hooks/useGestures'

export interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>
  children: React.ReactNode
  threshold?: number
  className?: string
  refreshingText?: string
  pullText?: string
  releaseText?: string
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 100,
  className = '',
  refreshingText = 'Refreshing...',
  pullText = 'Pull to refresh',
  releaseText = 'Release to refresh'
}) => {
  const { ref, isRefreshing, pullDistance, progress } = usePullToRefresh(onRefresh, threshold)

  const isPulling = pullDistance > 0
  const shouldRelease = pullDistance >= threshold

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`relative overflow-y-auto overscroll-contain ${className}`}
      style={{ height: '100%' }}
    >
      {/* Pull Indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 z-10"
        style={{
          height: `${Math.min(pullDistance, threshold)}px`,
          opacity: isPulling ? 1 : 0,
          transform: `translateY(${isPulling ? 0 : '-100%'})`
        }}
      >
        <div className="flex flex-col items-center space-y-2">
          {/* Spinner/Icon */}
          <div
            className={`w-8 h-8 ${
              isRefreshing ? 'animate-spin' : ''
            } transition-transform duration-200`}
            style={{
              transform: `rotate(${progress * 3.6}deg)`
            }}
          >
            <ArrowPathIcon
              className={`w-8 h-8 ${
                shouldRelease
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-icon-muted'
              }`}
            />
          </div>

          {/* Text */}
          <p className="text-xs font-medium text-description">
            {isRefreshing ? refreshingText : shouldRelease ? releaseText : pullText}
          </p>

          {/* Progress Bar */}
          <div className="w-16 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="min-h-full"
        style={{
          paddingTop: isPulling ? `${Math.min(pullDistance, threshold)}px` : 0,
          transition: isPulling ? 'none' : 'padding-top 0.2s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  )
}
