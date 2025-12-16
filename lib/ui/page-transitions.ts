'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// ========================================
// PAGE TRANSITION HOOK
// ========================================
export function usePageTransition() {
  const pathname = usePathname()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setIsTransitioning(true)
    setProgress(0)

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    // Complete transition
    const timeout = setTimeout(() => {
      setProgress(100)
      setTimeout(() => {
        setIsTransitioning(false)
        setProgress(0)
      }, 300)
    }, 500)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pathname])

  return { isTransitioning, progress }
}

// ========================================
// LOADING PROGRESS HOOK
// ========================================
export function useLoadingProgress(isLoading: boolean) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (isLoading) {
      setProgress(0)

      const interval = setInterval(() => {
        setProgress((prev) => {
          // Slow down as we approach 90%
          if (prev >= 90) return prev
          if (prev >= 70) return prev + 2
          if (prev >= 50) return prev + 5
          return prev + 10
        })
      }, 300)

      return () => clearInterval(interval)
    } else {
      // Complete the progress
      setProgress(100)
      const timeout = setTimeout(() => setProgress(0), 300)
      return () => clearTimeout(timeout)
    }
  }, [isLoading])

  return progress
}

// ========================================
// ROUTE CHANGE DETECTOR
// ========================================
export function useRouteChange(onRouteChange: () => void) {
  const pathname = usePathname()

  useEffect(() => {
    onRouteChange()
  }, [pathname, onRouteChange])
}

// ========================================
// SCROLL RESTORATION
// ========================================
export function useScrollRestoration() {
  const pathname = usePathname()
  const [scrollPositions, setScrollPositions] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    // Save current scroll position before route change
    const handleRouteChange = () => {
      setScrollPositions((prev) => {
        const next = new Map(prev)
        next.set(pathname, window.scrollY)
        return next
      })
    }

    window.addEventListener('beforeunload', handleRouteChange)

    // Restore scroll position
    const savedPosition = scrollPositions.get(pathname)
    if (savedPosition !== undefined) {
      window.scrollTo(0, savedPosition)
    } else {
      window.scrollTo(0, 0)
    }

    return () => {
      window.removeEventListener('beforeunload', handleRouteChange)
    }
  }, [pathname, scrollPositions])
}

// ========================================
// PAGE LOAD PERFORMANCE
// ========================================
export function usePageLoadPerformance() {
  const [metrics, setMetrics] = useState<{
    loadTime: number
    domContentLoaded: number
    firstPaint: number
    firstContentfulPaint: number
  } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return

    const measurePerformance = () => {
      const perfData = window.performance.timing
      const perfEntries = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paintEntries = performance.getEntriesByType('paint')

      setMetrics({
        loadTime: perfData.loadEventEnd - perfData.navigationStart,
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
        firstPaint: paintEntries.find((entry) => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find((entry) => entry.name === 'first-contentful-paint')?.startTime || 0,
      })
    }

    if (document.readyState === 'complete') {
      measurePerformance()
    } else {
      window.addEventListener('load', measurePerformance)
      return () => window.removeEventListener('load', measurePerformance)
    }
  }, [])

  return metrics
}

// ========================================
// PREFETCH ROUTES
// ========================================
export function usePrefetch() {
  const prefetch = (url: string) => {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    document.head.appendChild(link)
  }

  const prefetchOnHover = (url: string) => {
    return {
      onMouseEnter: () => prefetch(url),
    }
  }

  return { prefetch, prefetchOnHover }
}

// ========================================
// VISIBILITY STATE
// ========================================
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isVisible
}

// ========================================
// NETWORK STATUS
// ========================================
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [connectionType, setConnectionType] = useState<string>('unknown')

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine)

    const updateConnectionType = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      if (connection) {
        setConnectionType(connection.effectiveType || 'unknown')
      }
    }

    updateOnlineStatus()
    updateConnectionType()

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      connection.addEventListener('change', updateConnectionType)
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
      if (connection) {
        connection.removeEventListener('change', updateConnectionType)
      }
    }
  }, [])

  return { isOnline, connectionType }
}

// ========================================
// IDLE DETECTION
// ========================================
export function useIdleDetection(timeout: number = 60000) {
  const [isIdle, setIsIdle] = useState(false)

  useEffect(() => {
    let idleTimer: NodeJS.Timeout

    const resetTimer = () => {
      setIsIdle(false)
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => setIsIdle(true), timeout)
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']

    events.forEach((event) => {
      document.addEventListener(event, resetTimer)
    })

    resetTimer()

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer)
      })
      clearTimeout(idleTimer)
    }
  }, [timeout])

  return isIdle
}

// ========================================
// ANIMATION FRAME
// ========================================
export function useAnimationFrame(callback: (deltaTime: number) => void, isRunning: boolean = true) {
  useEffect(() => {
    if (!isRunning) return

    let animationFrameId: number
    let lastTime = performance.now()

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime
      lastTime = currentTime

      callback(deltaTime)
      animationFrameId = requestAnimationFrame(animate)
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [callback, isRunning])
}

// ========================================
// TRANSITION UTILITIES
// ========================================
export const transitionConfig = {
  // Page transitions
  page: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 },
  },

  // Fade
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },

  // Slide up
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3 },
  },

  // Slide down
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 },
  },

  // Scale
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2 },
  },

  // Blur
  blur: {
    initial: { opacity: 0, filter: 'blur(10px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(10px)' },
    transition: { duration: 0.3 },
  },
}
