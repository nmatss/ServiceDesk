'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'

// ========================================
// PAGE LOADING BAR (Top Progress Bar)
// ========================================
interface PageLoadingBarProps {
  isLoading?: boolean
  progress?: number
  className?: string
}

export function PageLoadingBar({ isLoading = false, progress, className }: PageLoadingBarProps) {
  if (!isLoading && progress === undefined) return null

  return (
    <div className={cn('fixed top-0 left-0 right-0 z-50 h-1', className)}>
      <div
        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out"
        style={{
          width: progress !== undefined ? `${progress}%` : '100%',
          animation: progress === undefined ? 'progress-indeterminate 2s ease-in-out infinite' : undefined,
        }}
      />
      <style jsx>{`
        @keyframes progress-indeterminate {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}

// ========================================
// SKELETON TABLE
// ========================================
interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTable({ rows = 5, columns = 4, className }: SkeletonTableProps) {
  return (
    <div className={cn('w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700', className)}>
      {/* Table Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-4 w-24" />
          ))}
        </div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ========================================
// SKELETON FORM
// ========================================
interface SkeletonFormProps {
  fields?: number
  includeButton?: boolean
  className?: string
}

export function SkeletonForm({ fields = 4, includeButton = true, className }: SkeletonFormProps) {
  return (
    <div className={cn('space-y-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={`field-${i}`} className="space-y-2">
          <Skeleton className="h-4 w-32" /> {/* Label */}
          <Skeleton className="h-10 w-full" /> {/* Input */}
        </div>
      ))}

      {includeButton && (
        <div className="flex gap-3 pt-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      )}
    </div>
  )
}

// ========================================
// BUTTON LOADING STATE
// ========================================
interface ButtonLoadingProps {
  isLoading?: boolean
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  className?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
}

export function ButtonLoading({
  isLoading = false,
  children,
  disabled = false,
  onClick,
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
}: ButtonLoadingProps) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white disabled:bg-gray-400',
    outline: 'border-2 border-gray-300 hover:border-gray-400 text-gray-700 dark:text-gray-300 disabled:border-gray-200',
    danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-400',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <InlineSpinner size={size === 'sm' ? 'sm' : 'md'} />
        </div>
      )}
      <span className={cn(isLoading && 'invisible')}>{children}</span>
    </button>
  )
}

// ========================================
// INLINE SPINNER
// ========================================
interface InlineSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  color?: string
}

export function InlineSpinner({ size = 'md', className, color = 'currentColor' }: InlineSpinnerProps) {
  const sizes = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  }

  return (
    <svg
      className={cn('animate-spin', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke={color} strokeWidth="4" />
      <path
        className="opacity-75"
        fill={color}
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// ========================================
// FULL PAGE LOADING
// ========================================
interface FullPageLoadingProps {
  message?: string
  className?: string
}

export function FullPageLoading({ message = 'Carregando...', className }: FullPageLoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900', className)}>
      <InlineSpinner size="lg" className="text-blue-600 mb-4" />
      <p className="text-gray-600 dark:text-gray-400 text-lg">{message}</p>
    </div>
  )
}

// ========================================
// CARD LOADING (Skeleton Card with Image)
// ========================================
export function SkeletonCardWithImage({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-white dark:bg-gray-800 overflow-hidden', className)}>
      <Skeleton className="h-48 w-full rounded-none" /> {/* Image */}
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" /> {/* Title */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  )
}

// ========================================
// LIST ITEM LOADING
// ========================================
export function SkeletonListItem({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border', className)}>
      <Skeleton className="h-12 w-12 rounded-full" /> {/* Avatar */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-8 w-24" /> {/* Action button */}
    </div>
  )
}

// ========================================
// IMAGE LOADING (with blur placeholder)
// ========================================
interface ImageWithLoadingProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
}

export function ImageWithLoading({ src, alt, className, width, height }: ImageWithLoadingProps) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasError, setHasError] = React.useState(false)

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isLoading && <Skeleton className="absolute inset-0" />}
      {hasError ? (
        <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 h-full w-full">
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false)
            setHasError(true)
          }}
          className={cn('transition-opacity duration-300', isLoading ? 'opacity-0' : 'opacity-100')}
        />
      )}
    </div>
  )
}

// Add React import for ImageWithLoading component
import React from 'react'
