'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to track media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handler)
      return () => mediaQuery.removeListener(handler)
    }
  }, [query])

  return matches
}

/**
 * Predefined breakpoint hooks
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)')
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1025px)')
}

export function useIsSmallMobile(): boolean {
  return useMediaQuery('(max-width: 475px)')
}

export function useIsLargeMobile(): boolean {
  return useMediaQuery('(min-width: 476px) and (max-width: 768px)')
}

/**
 * Check if device prefers dark mode
 */
export function usePrefersColorSchemeDark(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)')
}

/**
 * Check if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * Check if device is touch-capable
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    )
  }, [])

  return isTouch
}

/**
 * Get current breakpoint name
 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

export function useBreakpoint(): Breakpoint {
  const isXs = useMediaQuery('(max-width: 475px)')
  const isSm = useMediaQuery('(min-width: 476px) and (max-width: 640px)')
  const isMd = useMediaQuery('(min-width: 641px) and (max-width: 768px)')
  const isLg = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')
  const isXl = useMediaQuery('(min-width: 1025px) and (max-width: 1280px)')
  const is2xl = useMediaQuery('(min-width: 1281px) and (max-width: 1536px)')

  if (isXs) return 'xs'
  if (isSm) return 'sm'
  if (isMd) return 'md'
  if (isLg) return 'lg'
  if (isXl) return 'xl'
  if (is2xl) return '2xl'
  return '3xl'
}
