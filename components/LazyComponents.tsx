/**
 * Lazy-loaded Components
 * Dynamic imports for heavy components to reduce initial bundle size
 */

'use client'

import React, { Suspense } from 'react'
import dynamic from 'next/dynamic'

// ===========================
// LOADING SKELETONS
// ===========================

import {
  DashboardFullSkeleton,
} from './ui/dashboard-skeleton'
import { TicketSkeleton } from './ui/ticket-skeleton'
import { Spinner } from './ui/spinner'

/**
 * Generic loading component
 */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner size="lg" />
    </div>
  )
}

/**
 * Modal loading skeleton
 */
function ModalSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-3/4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>
    </div>
  )
}

/**
 * Chart loading skeleton
 */
function ChartSkeleton() {
  return (
    <div className="glass-panel p-6 h-96 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-2"></div>
        <p className="text-sm text-description">Carregando gráfico...</p>
      </div>
    </div>
  )
}

/**
 * Rich text editor skeleton
 */
function EditorSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-10 bg-gray-200 rounded" />
      <div className="h-32 bg-gray-200 rounded" />
    </div>
  )
}

// ===========================
// LAZY-LOADED CHART COMPONENTS
// ===========================

/**
 * Recharts components (heavy library ~200KB)
 * Only load when needed
 */
export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false, // Charts don't need SSR
  }
)

export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

export const LazyAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
)

// ===========================
// LAZY-LOADED RICH TEXT EDITOR
// ===========================

/**
 * React Quill New (heavy library ~150KB)
 * Only load when user needs to edit
 * Using react-quill-new to fix CVE-2021-3163
 */
export const LazyRichTextEditor = dynamic(
  () => import('./ui/RichTextFallback').then((mod) => mod.default),
  {
    loading: () => <EditorSkeleton />,
    ssr: false,
  }
)

// ===========================
// LAZY-LOADED REACT FLOW
// ===========================

/**
 * ReactFlow for workflow builder (heavy library ~300KB)
 */
export const LazyReactFlow = dynamic(
  () => import('reactflow').then((mod) => mod.default),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
)

export const LazyBackground = dynamic(
  () => import('@reactflow/background').then((mod) => mod.Background),
  {
    loading: () => null,
    ssr: false,
  }
)

export const LazyControls = dynamic(
  () => import('@reactflow/controls').then((mod) => mod.Controls),
  {
    loading: () => null,
    ssr: false,
  }
)

export const LazyMiniMap = dynamic(
  () => import('@reactflow/minimap').then((mod) => mod.MiniMap),
  {
    loading: () => null,
    ssr: false,
  }
)

// ===========================
// LAZY-LOADED MODAL COMPONENTS
// ===========================

/**
 * Modal component (load only when opened)
 */
export const LazyModal = dynamic(
  () => import('./ui/Modal').then((mod) => ({ default: mod.Modal })),
  {
    loading: () => <ModalSkeleton />,
    ssr: true, // Modals can be SSR'd
  }
)

/**
 * Dialog component
 */
export const LazyDialog = dynamic(
  () => import('./ui/dialog').then((mod) => ({ default: mod.Dialog })),
  {
    loading: () => <ModalSkeleton />,
    ssr: true,
  }
)

// ===========================
// LAZY-LOADED ADMIN COMPONENTS
// ===========================

/**
 * Analytics dashboard (heavy component with charts)
 */
export const LazyAnalyticsDashboard = dynamic(
  () => import('@/app/analytics/page'),
  {
    loading: () => <DashboardFullSkeleton />,
    ssr: false, // Analytics don't need SSR
  }
)

/**
 * Reports page (heavy component with charts)
 */
export const LazyReportsPage = dynamic(
  () => import('@/app/reports/page'),
  {
    loading: () => <DashboardFullSkeleton />,
    ssr: false,
  }
)

// ===========================
// LAZY-LOADED KNOWLEDGE BASE
// ===========================

/**
 * Knowledge base article viewer
 */
export const LazyKnowledgeArticle = dynamic(
  () => import('@/app/knowledge/article/[slug]/page'),
  {
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-3/4" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/6" />
        </div>
      </div>
    ),
    ssr: true,
  }
)

// ===========================
// LAZY-LOADED TICKET COMPONENTS
// ===========================

/**
 * Ticket details component
 */
export const LazyTicketDetails = dynamic(
  () => import('@/app/tickets/[id]/page'),
  {
    loading: () => <TicketSkeleton />,
    ssr: true,
  }
)

// ===========================
// LAZY-LOADED FILE UPLOAD
// ===========================

/**
 * File upload component (load only when needed)
 */
export const LazyFileUpload = dynamic(() => import('./ui/file-upload'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
})

// ===========================
// LAZY-LOADED COMMAND PALETTE
// ===========================

/**
 * Command palette (load only when triggered)
 */
export const LazyCommandPalette = dynamic(() => import('./ui/CommandPalette'), {
  loading: () => null, // No loading state (opens instantly)
  ssr: false,
})

// ===========================
// LAZY-LOADED COMMUNITY BUILDER
// ===========================

/**
 * Community builder (heavy component)
 */
export const LazyComunidadeBuilder = dynamic(
  () => import('./ui/comunidade-builder'),
  {
    loading: () => <LoadingSpinner />,
    ssr: false,
  }
)

// ===========================
// WRAPPER COMPONENTS
// ===========================

/**
 * Lazy wrapper with Suspense fallback
 */
export function LazyWrapper({
  children,
  fallback = <LoadingSpinner />,
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

/**
 * Conditional lazy loader
 * Only renders children when condition is true
 */
export function ConditionalLazy({
  condition,
  children,
  fallback = null,
}: {
  condition: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  if (!condition) return <>{fallback}</>
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
}

// ===========================
// INTERSECTION OBSERVER LAZY LOADER
// ===========================

/**
 * Load component only when visible in viewport
 */
export function LazyOnVisible({
  children,
  rootMargin = '200px',
  fallback = <LoadingSpinner />,
}: {
  children: React.ReactNode
  rootMargin?: string
  fallback?: React.ReactNode
}) {
  const [isVisible, setIsVisible] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={fallback}>{children}</Suspense>
      ) : (
        fallback
      )}
    </div>
  )
}

// ===========================
// LAZY-LOADED ADMIN PAGES
// ===========================

/**
 * Heavy admin pages with tables and charts
 */
export const LazyCMDBPage = dynamic(
  () => import('@/app/admin/cmdb/page'),
  {
    loading: () => (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-description">Carregando CMDB...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
)

export const LazyKnowledgePage = dynamic(
  () => import('@/app/admin/knowledge/page'),
  {
    loading: () => (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-description">Carregando Base de Conhecimento...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
)

export const LazyTeamsPage = dynamic(
  () => import('@/app/admin/teams/page'),
  {
    loading: () => (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-description">Carregando Equipes...</p>
        </div>
      </div>
    ),
    ssr: false,
  }
)

// PERF: No default export — use named imports for tree-shaking.
// e.g., import { LazyLineChart } from '@/components/LazyComponents'
