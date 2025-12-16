/**
 * Performance Optimization Examples
 * Practical examples of using performance optimizations
 */

'use client'

import React, { useState } from 'react'

// ===========================
// EXAMPLE 1: Lazy Loading Components
// ===========================

import {
  LazyRichTextEditor,
  LazyLineChart,
  LazyBarChart,
  LazyModal,
  LazyOnVisible,
} from '@/components/LazyComponents'

export function LazyLoadingExample() {
  const [showEditor, setShowEditor] = useState(false)

  return (
    <div>
      {/* Only load editor when button is clicked */}
      <button onClick={() => setShowEditor(true)}>
        Edit Content
      </button>

      {showEditor && (
        <LazyRichTextEditor
          value=""
          onChange={(value) => console.log(value)}
        />
      )}

      {/* Load chart only when visible in viewport */}
      <LazyOnVisible rootMargin="200px">
        <LazyLineChart
          data={[/* chart data */]}
          width={600}
          height={300}
        />
      </LazyOnVisible>
    </div>
  )
}

// ===========================
// EXAMPLE 2: Optimized Images
// ===========================

import OptimizedImage, {
  OptimizedAvatar,
  OptimizedThumbnail,
  OptimizedLogo,
} from '@/components/OptimizedImage'

export function OptimizedImagesExample() {
  return (
    <div>
      {/* Hero image with priority loading */}
      <OptimizedImage
        src="/images/hero.jpg"
        alt="Hero"
        width={1920}
        height={1080}
        priority={true} // Load immediately
        quality={90}
      />

      {/* User avatar */}
      <OptimizedAvatar
        src="/uploads/avatar.jpg"
        alt="User"
        size={64}
      />

      {/* Thumbnail in list */}
      <OptimizedThumbnail
        src="/uploads/ticket-123.jpg"
        alt="Ticket"
        size={80}
      />

      {/* Logo with priority */}
      <OptimizedLogo
        src="/images/logo.svg"
        alt="ServiceDesk"
        width={120}
        height={40}
      />

      {/* Lazy loaded image below fold */}
      <OptimizedImage
        src="/images/screenshot.jpg"
        alt="Screenshot"
        width={800}
        height={600}
        priority={false} // Lazy load
        showPlaceholder={true}
      />
    </div>
  )
}

// ===========================
// EXAMPLE 3: API Client with Caching
// ===========================

import { get, post, prefetch, clearCachePattern } from '@/lib/api/client'

export function ApiClientExample() {
  const [tickets, setTickets] = useState([])

  // Fetch with caching
  const fetchTickets = async () => {
    const data = await get('/api/tickets', {
      cache: true,
      cacheTTL: 60000, // 1 minute
      retry: true,
      retryAttempts: 3,
    })
    setTickets(data)
  }

  // Create ticket (no cache)
  const createTicket = async (ticketData: any) => {
    const newTicket = await post('/api/tickets', ticketData, {
      retry: true,
      onSuccess: () => {
        // Clear tickets cache to force refetch
        clearCachePattern('/api/tickets')
      },
    })
    return newTicket
  }

  // Prefetch next page
  const prefetchNextPage = () => {
    prefetch('/api/tickets?page=2')
  }

  return (
    <div>
      <button onClick={fetchTickets}>Load Tickets</button>
      <button onClick={prefetchNextPage}>Prefetch Next Page</button>
    </div>
  )
}

// ===========================
// EXAMPLE 4: Debounced Search
// ===========================

import { useDebounce, useThrottle } from '@/lib/hooks/useOptimized'

export function DebouncedSearchExample() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 500)

  // Only search after 500ms of no typing
  React.useEffect(() => {
    if (debouncedSearch) {
      // Perform search
      console.log('Searching for:', debouncedSearch)
    }
  }, [debouncedSearch])

  return (
    <input
      type="text"
      placeholder="Search..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  )
}

// ===========================
// EXAMPLE 5: Throttled Scroll
// ===========================

export function ThrottledScrollExample() {
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    console.log('Scroll position:', e.currentTarget.scrollTop)
  }

  const throttledScroll = useThrottle(handleScroll, 100)

  return (
    <div
      style={{ height: '500px', overflow: 'auto' }}
      onScroll={throttledScroll}
    >
      <div style={{ height: '2000px' }}>Long content...</div>
    </div>
  )
}

// ===========================
// EXAMPLE 6: Intersection Observer
// ===========================

import { useIntersectionObserver } from '@/lib/hooks/useOptimized'

export function IntersectionObserverExample() {
  const [ref, isVisible] = useIntersectionObserver({
    threshold: 0.5,
    rootMargin: '100px',
  })

  return (
    <div ref={ref}>
      {isVisible ? (
        <div>Content is visible!</div>
      ) : (
        <div>Content is not visible</div>
      )}
    </div>
  )
}

// ===========================
// EXAMPLE 7: Lazy Load on Scroll
// ===========================

import { useLazyLoad } from '@/lib/hooks/useOptimized'

export function LazyLoadOnScrollExample() {
  const [ref, shouldLoad] = useLazyLoad('200px')

  return (
    <div ref={ref}>
      {shouldLoad ? (
        <HeavyComponent />
      ) : (
        <div style={{ height: '400px' }}>Loading...</div>
      )}
    </div>
  )
}

function HeavyComponent() {
  return <div>Heavy component loaded!</div>
}

// ===========================
// EXAMPLE 8: Pagination
// ===========================

import { usePagination } from '@/lib/hooks/useOptimized'

export function PaginationExample() {
  const mockData = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
  }))

  const {
    paginatedData,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev,
  } = usePagination(mockData, 10)

  return (
    <div>
      <div>
        {paginatedData.map((item) => (
          <div key={item.id}>{item.name}</div>
        ))}
      </div>

      <div>
        <button onClick={prevPage} disabled={!canGoPrev}>
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button onClick={nextPage} disabled={!canGoNext}>
          Next
        </button>
      </div>
    </div>
  )
}

// ===========================
// EXAMPLE 9: Virtual Scroll
// ===========================

import { useVirtualScroll } from '@/lib/hooks/useOptimized'

export function VirtualScrollExample() {
  const items = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    text: `Item ${i}`,
  }))

  const { visibleItems, containerProps, scrollProps } = useVirtualScroll(
    items,
    50 // Item height
  )

  return (
    <div {...containerProps}>
      <div {...scrollProps}>
        {visibleItems.map(({ item, index }) => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              top: index * 50,
              height: 50,
              width: '100%',
            }}
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ===========================
// EXAMPLE 10: Memoized Component
// ===========================

interface TicketCardProps {
  id: number
  title: string
  status: string
}

// Memoize to prevent re-renders
const TicketCard = React.memo(({ id, title, status }: TicketCardProps) => {
  console.log('Rendering ticket:', id)

  return (
    <div>
      <h3>{title}</h3>
      <p>Status: {status}</p>
    </div>
  )
})

TicketCard.displayName = 'TicketCard'

export function MemoizedListExample() {
  const [filter, setFilter] = useState('')
  const tickets = [
    { id: 1, title: 'Bug #1', status: 'open' },
    { id: 2, title: 'Feature #2', status: 'closed' },
    { id: 3, title: 'Task #3', status: 'open' },
  ]

  // Only re-render filtered tickets
  const filteredTickets = React.useMemo(
    () => tickets.filter((t) => t.title.includes(filter)),
    [filter, tickets]
  )

  return (
    <div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter tickets..."
      />

      {filteredTickets.map((ticket) => (
        <TicketCard key={ticket.id} {...ticket} />
      ))}
    </div>
  )
}

// ===========================
// EXAMPLE 11: Stable Callback
// ===========================

import { useStableCallback } from '@/lib/hooks/useOptimized'

export function StableCallbackExample() {
  const [count, setCount] = useState(0)

  // This callback never changes reference
  const handleClick = useStableCallback(() => {
    console.log('Current count:', count)
    setCount((c) => c + 1)
  })

  return (
    <div>
      <p>Count: {count}</p>
      <MemoizedButton onClick={handleClick} />
    </div>
  )
}

const MemoizedButton = React.memo(
  ({ onClick }: { onClick: () => void }) => {
    console.log('Button rendered')
    return <button onClick={onClick}>Increment</button>
  }
)

MemoizedButton.displayName = 'MemoizedButton'

// ===========================
// EXAMPLE 12: Media Query Hook
// ===========================

import { useMediaQuery } from '@/lib/hooks/useOptimized'

export function ResponsiveExample() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  const isDesktop = useMediaQuery('(min-width: 1025px)')

  return (
    <div>
      {isMobile && <MobileView />}
      {isTablet && <TabletView />}
      {isDesktop && <DesktopView />}
    </div>
  )
}

function MobileView() {
  return <div>Mobile View</div>
}

function TabletView() {
  return <div>Tablet View</div>
}

function DesktopView() {
  return <div>Desktop View</div>
}

// ===========================
// EXAMPLE 13: Complete Optimized Page
// ===========================

export function CompleteOptimizedPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 500)
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Fetch tickets with caching
  const [tickets, setTickets] = useState([])
  React.useEffect(() => {
    const fetchTickets = async () => {
      const data = await get('/api/tickets', {
        cache: true,
        cacheTTL: 60000,
      })
      setTickets(data)
    }
    fetchTickets()
  }, [])

  // Paginate tickets
  const {
    paginatedData,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev,
  } = usePagination(tickets, isMobile ? 5 : 10)

  return (
    <div>
      {/* Hero with optimized image */}
      <OptimizedImage
        src="/images/hero.jpg"
        alt="Hero"
        width={1920}
        height={400}
        priority={true}
      />

      {/* Search with debounce */}
      <input
        type="text"
        placeholder="Search tickets..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* Paginated list */}
      <div>
        {paginatedData.map((ticket: any) => (
          <TicketCard key={ticket.id} {...ticket} />
        ))}
      </div>

      {/* Pagination */}
      <div>
        <button onClick={prevPage} disabled={!canGoPrev}>
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button onClick={nextPage} disabled={!canGoNext}>
          Next
        </button>
      </div>

      {/* Lazy loaded chart */}
      <LazyOnVisible rootMargin="200px">
        <LazyBarChart data={[]} width={600} height={300} />
      </LazyOnVisible>
    </div>
  )
}

export default {
  LazyLoadingExample,
  OptimizedImagesExample,
  ApiClientExample,
  DebouncedSearchExample,
  ThrottledScrollExample,
  IntersectionObserverExample,
  LazyLoadOnScrollExample,
  PaginationExample,
  VirtualScrollExample,
  MemoizedListExample,
  StableCallbackExample,
  ResponsiveExample,
  CompleteOptimizedPage,
}
