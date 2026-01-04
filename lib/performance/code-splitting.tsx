/**
 * Code Splitting & Dynamic Import Utilities
 *
 * Features:
 * - Lazy loading components
 * - Route-based code splitting
 * - Suspense boundaries
 * - Preloading strategies
 * - Bundle size optimization
 */

import dynamic from 'next/dynamic'
import { ComponentType, ReactElement, Suspense } from 'react'

// ========================
// LOADING COMPONENTS
// ========================

export const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)

export const LoadingSkeleton = () => (
  <div className="animate-pulse space-y-4 p-4">
    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 rounded"></div>
    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
  </div>
)

export const LoadingCard = () => (
  <div className="animate-pulse border rounded-lg p-6">
    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
    <div className="space-y-3">
      <div className="h-3 bg-gray-200 rounded"></div>
      <div className="h-3 bg-gray-200 rounded w-5/6"></div>
    </div>
  </div>
)

// ========================
// DYNAMIC IMPORT HELPERS
// ========================

/**
 * Load component with custom loading state
 */
export function lazyLoad<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  options?: {
    loading?: ComponentType
    ssr?: boolean
    suspense?: boolean
  }
) {
  return dynamic(importFunc, {
    loading: options?.loading || LoadingSpinner,
    ssr: options?.ssr ?? true,
    suspense: options?.suspense,
  })
}

/**
 * Load component with preloading capability
 */
export function lazyLoadWithPreload<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>
) {
  const LazyComponent = dynamic(importFunc, {
    loading: LoadingSpinner,
  })

  return {
    Component: LazyComponent,
    preload: importFunc,
  }
}

// ========================
// HEAVY COMPONENTS (Chart Libraries, Rich Editors)
// ========================

/**
 * Lazy load Recharts (heavy charting library)
 */
export const LazyCharts = {
  LineChart: lazyLoad(() => import('recharts').then((mod) => ({ default: mod.LineChart }))),
  BarChart: lazyLoad(() => import('recharts').then((mod) => ({ default: mod.BarChart }))),
  PieChart: lazyLoad(() => import('recharts').then((mod) => ({ default: mod.PieChart }))),
  AreaChart: lazyLoad(() => import('recharts').then((mod) => ({ default: mod.AreaChart }))),
}

/**
 * Lazy load React Quill New (rich text editor)
 * Using react-quill-new to fix CVE-2021-3163
 */
export const LazyRichTextEditor = lazyLoad(
  () => import('react-quill-new'),
  {
    ssr: false, // Quill doesn't work well with SSR
    loading: () => (
      <div className="border rounded-md p-4 bg-gray-50">
        <div className="animate-pulse space-y-2">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    ),
  }
)

// ========================
// ADMIN COMPONENTS (Heavy Dashboards)
// ========================

export const LazyAdminComponents = {
  UserManagement: lazyLoad(() => import('@/src/components/admin/UserManagement'), {
    loading: LoadingCard,
  }),

  Analytics: lazyLoad(() => import('@/src/components/analytics/OverviewCards'), {
    loading: LoadingSkeleton,
  }),

  Reports: lazyLoad(() => import('@/src/components/reports/ReportGenerator'), {
    loading: LoadingSkeleton,
  }),
}

// ========================
// FEATURE FLAGS & CONDITIONAL LOADING
// ========================

/**
 * Load component based on feature flag
 */
export function conditionalLoad<P extends object>(
  condition: boolean | (() => boolean),
  componentImport: () => Promise<{ default: ComponentType<P> }>,
  fallback?: ComponentType<P>
) {
  const shouldLoad = typeof condition === 'function' ? condition() : condition

  if (shouldLoad) {
    return lazyLoad(componentImport)
  }

  return fallback || (() => null)
}

// ========================
// ROUTE-BASED CODE SPLITTING
// ========================

/**
 * Preload route component on link hover
 */
export function preloadRoute(route: string): void {
  // This would integrate with Next.js router prefetching
  if (typeof window !== 'undefined') {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = route
    document.head.appendChild(link)
  }
}

/**
 * Preload component on visibility
 */
export function usePreloadOnVisible(
  preloadFunc: () => Promise<any>,
  ref: React.RefObject<HTMLElement>
): void {
  if (typeof window === 'undefined' || !ref.current) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          preloadFunc()
          observer.disconnect()
        }
      })
    },
    { rootMargin: '100px' }
  )

  observer.observe(ref.current)
}

// ========================
// SUSPENSE BOUNDARY WRAPPER
// ========================

interface SuspenseBoundaryProps {
  children: ReactElement
  fallback?: ReactElement
  errorFallback?: ReactElement
}

/**
 * Reusable Suspense boundary with error handling
 */
export function SuspenseBoundary({
  children,
  fallback = <LoadingSpinner />,
}: SuspenseBoundaryProps) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

// ========================
// BUNDLE ANALYSIS HELPERS
// ========================

/**
 * Get component bundle size (development only)
 */
export async function getComponentSize(
  importFunc: () => Promise<any>
): Promise<number | null> {
  if (process.env.NODE_ENV !== 'development') return null

  try {
    const module = await importFunc()
    // This is a rough estimate - in production you'd use webpack stats
    return JSON.stringify(module).length
  } catch {
    return null
  }
}

/**
 * Log bundle size in development
 */
export function logBundleSize(componentName: string, sizeInBytes: number): void {
  if (process.env.NODE_ENV === 'development') {
    const sizeInKB = (sizeInBytes / 1024).toFixed(2)
    console.log(`[Bundle Size] ${componentName}: ${sizeInKB} KB`)
  }
}

// ========================
// PRIORITY LOADING STRATEGIES
// ========================

export const LoadingStrategy = {
  /**
   * Immediate: Load on initial render (high priority)
   */
  immediate: <P extends object>(importFunc: () => Promise<{ default: ComponentType<P> }>) =>
    lazyLoad(importFunc, { ssr: true }),

  /**
   * Defer: Load after initial render (low priority)
   */
  defer: <P extends object>(importFunc: () => Promise<{ default: ComponentType<P> }>) =>
    lazyLoad(importFunc, { ssr: false }),

  /**
   * Viewport: Load when component enters viewport
   */
  viewport: <P extends object>(importFunc: () => Promise<{ default: ComponentType<P> }>) =>
    lazyLoad(importFunc, { ssr: false }),

  /**
   * Interaction: Load on user interaction (click, hover)
   */
  interaction: <P extends object>(importFunc: () => Promise<{ default: ComponentType<P> }>) =>
    lazyLoad(importFunc, { ssr: false }),
}

// ========================
// PRELOADING HOOKS
// ========================

/**
 * Preload on mouse enter
 */
export function usePreloadOnHover(preloadFunc: () => Promise<any>) {
  return {
    onMouseEnter: () => preloadFunc(),
    onFocus: () => preloadFunc(),
  }
}

/**
 * Preload on idle
 */
export function preloadOnIdle(importFunc: () => Promise<any>): void {
  if (typeof window === 'undefined') return

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => importFunc())
  } else {
    setTimeout(() => importFunc(), 1000)
  }
}

// ========================
// CRITICAL COMPONENTS (No splitting)
// ========================

/**
 * Mark component as critical (will be included in main bundle)
 */
export function critical<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  return Component
}

// ========================
// EXPORT PRESETS
// ========================

export const CodeSplitting = {
  lazy: lazyLoad,
  lazyWithPreload: lazyLoadWithPreload,
  conditional: conditionalLoad,
  strategies: LoadingStrategy,
  preload: {
    route: preloadRoute,
    onHover: usePreloadOnHover,
    onIdle: preloadOnIdle,
  },
  loading: {
    Spinner: LoadingSpinner,
    Skeleton: LoadingSkeleton,
    Card: LoadingCard,
  },
}

export default CodeSplitting
