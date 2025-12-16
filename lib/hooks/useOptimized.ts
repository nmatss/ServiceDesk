/**
 * Optimized React Hooks
 * Performance-optimized custom hooks for common patterns
 */

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

// ===========================
// DEBOUNCE HOOK
// ===========================

/**
 * Debounced value hook
 * Delays updating the value until after the delay period
 *
 * @example
 * const debouncedSearch = useDebounce(searchTerm, 500)
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// ===========================
// THROTTLE HOOK
// ===========================

/**
 * Throttled callback hook
 * Limits how often a function can be called
 *
 * @example
 * const throttledScroll = useThrottle(handleScroll, 100)
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 100
): T {
  const lastRun = useRef(Date.now())

  return useCallback(
    ((...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args)
        lastRun.current = Date.now()
      }
    }) as T,
    [callback, delay]
  )
}

// ===========================
// INTERSECTION OBSERVER HOOK
// ===========================

/**
 * Intersection Observer hook
 * Detect when element enters viewport
 *
 * @example
 * const [ref, isVisible] = useIntersectionObserver({ threshold: 0.5 })
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) {
        setIsVisible(entry.isIntersecting)
      }
    }, options)

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
    }
  }, [options])

  return [ref, isVisible]
}

// ===========================
// LAZY LOAD HOOK
// ===========================

/**
 * Lazy load hook
 * Load content only when visible in viewport
 *
 * @example
 * const shouldLoad = useLazyLoad()
 */
export function useLazyLoad(
  rootMargin: string = '200px'
): [React.RefObject<HTMLDivElement>, boolean] {
  const [shouldLoad, setShouldLoad] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          setShouldLoad(true)
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

  return [ref, shouldLoad]
}

// ===========================
// WINDOW SIZE HOOK
// ===========================

interface WindowSize {
  width: number
  height: number
}

/**
 * Window size hook (debounced for performance)
 *
 * @example
 * const { width, height } = useWindowSize()
 */
export function useWindowSize(delay: number = 100): WindowSize {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  })

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }, delay)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
    }
  }, [delay])

  return windowSize
}

// ===========================
// MEDIA QUERY HOOK
// ===========================

/**
 * Media query hook
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    // Set initial value
    setMatches(media.matches)

    // Create listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern browsers
    if (media.addEventListener) {
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    }
    // Legacy browsers
    else if (media.addListener) {
      media.addListener(listener)
      return () => media.removeListener(listener)
    }
  }, [query])

  return matches
}

// ===========================
// PREVIOUS VALUE HOOK
// ===========================

/**
 * Previous value hook
 * Keep track of previous value
 *
 * @example
 * const previousValue = usePrevious(value)
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

// ===========================
// MOUNTED HOOK
// ===========================

/**
 * Mounted hook
 * Check if component is mounted
 *
 * @example
 * const isMounted = useMounted()
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
}

// ===========================
// OPTIMIZED STATE HOOK
// ===========================

/**
 * Optimized state hook with debounce
 *
 * @example
 * const [value, setValue, debouncedValue] = useOptimizedState('', 500)
 */
export function useOptimizedState<T>(
  initialValue: T,
  delay: number = 500
): [T, React.Dispatch<React.SetStateAction<T>>, T] {
  const [value, setValue] = useState<T>(initialValue)
  const debouncedValue = useDebounce(value, delay)

  return [value, setValue, debouncedValue]
}

// ===========================
// MEMOIZED CALLBACK
// ===========================

/**
 * Stable callback that never changes reference
 * Useful for preventing unnecessary re-renders
 *
 * @example
 * const stableCallback = useStableCallback((value) => {
 *   console.log(value)
 * })
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  })

  return useCallback(((...args: Parameters<T>) => {
    return callbackRef.current(...args)
  }) as T, [])
}

// ===========================
// ASYNC EFFECT HOOK
// ===========================

/**
 * Async effect hook
 * Safely handle async operations in useEffect
 *
 * @example
 * useAsyncEffect(async () => {
 *   const data = await fetchData()
 *   setData(data)
 * }, [])
 */
export function useAsyncEffect(
  effect: () => Promise<void>,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    let cancelled = false

    const execute = async () => {
      try {
        await effect()
      } catch (error) {
        if (!cancelled) {
          console.error('[useAsyncEffect] Error:', error)
        }
      }
    }

    execute()

    return () => {
      cancelled = true
    }
  }, deps)
}

// ===========================
// PAGINATION HOOK
// ===========================

interface UsePaginationResult {
  currentPage: number
  totalPages: number
  pageSize: number
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  canGoNext: boolean
  canGoPrev: boolean
  paginatedData: any[]
}

/**
 * Pagination hook
 *
 * @example
 * const pagination = usePagination(data, 10)
 */
export function usePagination<T>(
  data: T[],
  pageSize: number = 10
): UsePaginationResult {
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = useMemo(
    () => Math.ceil(data.length / pageSize),
    [data.length, pageSize]
  )

  const paginatedData = useMemo(
    () => {
      const start = (currentPage - 1) * pageSize
      const end = start + pageSize
      return data.slice(start, end)
    },
    [data, currentPage, pageSize]
  )

  const goToPage = useCallback(
    (page: number) => {
      const pageNumber = Math.max(1, Math.min(page, totalPages))
      setCurrentPage(pageNumber)
    },
    [totalPages]
  )

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1)
  }, [currentPage, goToPage])

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1)
  }, [currentPage, goToPage])

  return {
    currentPage,
    totalPages,
    pageSize,
    goToPage,
    nextPage,
    prevPage,
    canGoNext: currentPage < totalPages,
    canGoPrev: currentPage > 1,
    paginatedData,
  }
}

// ===========================
// VIRTUAL SCROLL HOOK
// ===========================

interface UseVirtualScrollResult {
  visibleItems: any[]
  containerProps: {
    ref: React.RefObject<HTMLDivElement>
    style: React.CSSProperties
  }
  scrollProps: {
    style: React.CSSProperties
  }
}

/**
 * Virtual scroll hook
 * Render only visible items for large lists
 *
 * @example
 * const { visibleItems, containerProps, scrollProps } = useVirtualScroll(items, 50)
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  overscan: number = 3
): UseVirtualScrollResult {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const { height: containerHeight } = useWindowSize()

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    return { start, end }
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan])

  const visibleItems = useMemo(
    () => items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index,
    })),
    [items, visibleRange]
  )

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, 50)

  return {
    visibleItems,
    containerProps: {
      ref: containerRef,
      style: {
        height: containerHeight,
        overflow: 'auto',
      },
    },
    scrollProps: {
      style: {
        height: items.length * itemHeight,
        position: 'relative',
      },
    },
  }
}

export default {
  useDebounce,
  useThrottle,
  useIntersectionObserver,
  useLazyLoad,
  useWindowSize,
  useMediaQuery,
  usePrevious,
  useMounted,
  useOptimizedState,
  useStableCallback,
  useAsyncEffect,
  usePagination,
  useVirtualScroll,
}
