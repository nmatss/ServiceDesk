/**
 * React Component Performance Optimizations
 *
 * Provides utilities and patterns for optimizing React component performance:
 * - Memoization hooks
 * - Virtualization for large lists
 * - Code splitting utilities
 * - Performance monitoring
 */

import { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';

/**
 * Performance Monitoring Hook
 *
 * Measures component render time and logs slow renders
 */
export function useRenderPerformance(componentName: string, threshold = 16) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  useEffect(() => {
    renderCountRef.current++;
    const now = performance.now();
    const renderTime = now - lastRenderTimeRef.current;

    if (renderTime > threshold && renderCountRef.current > 1) {
      console.warn(
        `[SLOW RENDER] ${componentName} took ${renderTime.toFixed(2)}ms (threshold: ${threshold}ms)`
      );
    }

    lastRenderTimeRef.current = now;
  });

  return {
    renderCount: renderCountRef.current,
    lastRenderTime: lastRenderTimeRef.current,
  };
}

/**
 * Stable Callback Hook
 *
 * Creates a stable callback reference that doesn't change between renders
 * Better than useCallback for frequently changing dependencies
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}

/**
 * Debounced Value Hook
 *
 * Debounces a value to reduce re-renders
 * Useful for search inputs, filters, etc.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttled Value Hook
 *
 * Throttles a value to limit update frequency
 */
export function useThrottledValue<T>(value: T, interval = 100): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdated = useRef<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdated.current;

    if (timeSinceLastUpdate >= interval) {
      setThrottledValue(value);
      lastUpdated.current = now;
    } else {
      const timeoutId = setTimeout(() => {
        setThrottledValue(value);
        lastUpdated.current = Date.now();
      }, interval - timeSinceLastUpdate);

      return () => clearTimeout(timeoutId);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * Memoized Component Factory
 *
 * Creates a memoized component with custom comparison
 */
export function createMemoizedComponent<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  displayName?: string,
  areEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean
): React.MemoExoticComponent<ComponentType<P>> {
  const MemoizedComponent = memo(Component, areEqual);
  MemoizedComponent.displayName = displayName || Component.displayName || Component.name;
  return MemoizedComponent;
}

/**
 * Virtual List Hook
 *
 * Implements basic virtualization for large lists
 * Only renders visible items for better performance
 */
interface VirtualListOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function useVirtualList({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 3,
}: VirtualListOptions) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleEnd = Math.min(
    itemCount,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const totalHeight = itemCount * itemHeight;
  const offsetY = visibleStart * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const visibleItems = useMemo(() => {
    return Array.from({ length: visibleEnd - visibleStart }, (_, i) => visibleStart + i);
  }, [visibleStart, visibleEnd]);

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
  };
}

/**
 * Intersection Observer Hook
 *
 * Lazy load components when they enter viewport
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true);
      }
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options, hasIntersected]);

  return { isIntersecting, hasIntersected };
}

/**
 * Lazy Component Wrapper
 *
 * Wraps a component for lazy loading with intersection observer
 */
interface LazyComponentProps {
  children: ReactNode;
  placeholder?: ReactNode;
  rootMargin?: string;
}

export function LazyComponent({
  children,
  placeholder = <div>Loading...</div>,
  rootMargin = '100px',
}: LazyComponentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { hasIntersected } = useIntersectionObserver(ref, { rootMargin });

  return <div ref={ref}>{hasIntersected ? children : placeholder}</div>;
}

/**
 * Data Fetching with Cache Hook
 *
 * Fetches data with built-in caching and deduplication
 */
interface FetchOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  cacheTime?: number;
  staleTime?: number;
}

const dataCache = new Map<string, { data: unknown; timestamp: number }>();

export function useCachedData<T>({
  key,
  fetcher,
  cacheTime = 5 * 60 * 1000, // 5 minutes
  staleTime = 1 * 60 * 1000, // 1 minute
}: FetchOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const cached = dataCache.get(key);
      const now = Date.now();

      // Return cached data if fresh
      if (cached && now - cached.timestamp < cacheTime) {
        setData(cached.data as T);

        // Refetch in background if stale
        if (now - cached.timestamp > staleTime) {
          setIsLoading(true);
          try {
            const fresh = await fetcher();
            dataCache.set(key, { data: fresh, timestamp: now });
            setData(fresh);
          } catch (err) {
            setError(err as Error);
          } finally {
            setIsLoading(false);
          }
        }
        return;
      }

      // Fetch fresh data
      setIsLoading(true);
      try {
        const fresh = await fetcher();
        dataCache.set(key, { data: fresh, timestamp: now });
        setData(fresh);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [key, fetcher, cacheTime, staleTime]);

  const invalidate = useCallback(() => {
    dataCache.delete(key);
  }, [key]);

  return { data, isLoading, error, invalidate };
}

/**
 * Optimized Dashboard Stats Component Example
 */
interface DashboardStatsProps {
  organizationId: number;
}

export const OptimizedDashboardStats = memo(function OptimizedDashboardStats({
  organizationId,
}: DashboardStatsProps) {
  useRenderPerformance('DashboardStats', 16);

  const { data: stats, isLoading } = useCachedData({
    key: `dashboard-stats-${organizationId}`,
    fetcher: async () => {
      const response = await fetch(`/api/analytics/kpis?organizationId=${organizationId}`);
      return response.json();
    },
    cacheTime: 5 * 60 * 1000, // Cache for 5 minutes
    staleTime: 1 * 60 * 1000, // Refetch if older than 1 minute
  });

  if (isLoading && !stats) {
    return <div>Loading stats...</div>;
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Render stats */}
    </div>
  );
});

/**
 * Optimized Ticket List Component Example
 */
interface OptimizedTicketListProps {
  tickets: Array<{ id: number; title: string }>;
}

export const OptimizedTicketList = memo(function OptimizedTicketList({
  tickets,
}: OptimizedTicketListProps) {
  useRenderPerformance('TicketList', 16);

  const { visibleItems, totalHeight, offsetY, handleScroll } = useVirtualList({
    itemCount: tickets.length,
    itemHeight: 80,
    containerHeight: 600,
    overscan: 5,
  });

  return (
    <div
      className="overflow-auto"
      style={{ height: '600px' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((index) => (
            <div key={tickets[index].id} style={{ height: 80 }}>
              {tickets[index].title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/**
 * Performance Budget Monitor
 *
 * Monitors component render performance against budget
 */
interface PerformanceBudget {
  maxRenderTime: number;
  maxRenderCount: number;
}

export function usePerformanceBudget(
  componentName: string,
  budget: PerformanceBudget
) {
  const renderTimeRef = useRef<number[]>([]);
  const renderCountRef = useRef(0);

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;

      renderTimeRef.current.push(renderTime);
      renderCountRef.current++;

      // Check budget violations
      if (renderTime > budget.maxRenderTime) {
        console.warn(
          `[BUDGET VIOLATION] ${componentName} render time ${renderTime.toFixed(2)}ms exceeds budget ${budget.maxRenderTime}ms`
        );
      }

      if (renderCountRef.current > budget.maxRenderCount) {
        console.warn(
          `[BUDGET VIOLATION] ${componentName} render count ${renderCountRef.current} exceeds budget ${budget.maxRenderCount}`
        );
      }

      // Calculate average render time
      if (renderTimeRef.current.length > 0) {
        const avgRenderTime =
          renderTimeRef.current.reduce((a, b) => a + b, 0) / renderTimeRef.current.length;

        if (avgRenderTime > budget.maxRenderTime * 0.8) {
          console.warn(
            `[BUDGET WARNING] ${componentName} average render time ${avgRenderTime.toFixed(2)}ms approaching budget`
          );
        }
      }
    };
  });

  return {
    renderCount: renderCountRef.current,
    averageRenderTime:
      renderTimeRef.current.length > 0
        ? renderTimeRef.current.reduce((a, b) => a + b, 0) / renderTimeRef.current.length
        : 0,
  };
}

export default {
  useRenderPerformance,
  useStableCallback,
  useDebouncedValue,
  useThrottledValue,
  createMemoizedComponent,
  useVirtualList,
  useIntersectionObserver,
  LazyComponent,
  useCachedData,
  usePerformanceBudget,
};
