'use client'

import { useState, useEffect } from 'react'

export type OrientationType = 'portrait' | 'landscape'

// Screen Orientation API types
export type OrientationLockType =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary'

export interface OrientationState {
  type: OrientationType
  angle: number
}

/**
 * Hook to track device orientation
 */
export function useOrientation(): OrientationState {
  const [orientation, setOrientation] = useState<OrientationState>({
    type: 'portrait',
    angle: 0
  })

  useEffect(() => {
    const updateOrientation = () => {
      // Try to use Screen Orientation API first
      if (window.screen?.orientation) {
        const type = window.screen.orientation.type.includes('portrait')
          ? 'portrait'
          : 'landscape'
        setOrientation({
          type,
          angle: window.screen.orientation.angle
        })
      } else {
        // Fallback to window dimensions
        const type = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
        setOrientation({
          type,
          angle: window.orientation || 0
        })
      }
    }

    updateOrientation()

    // Listen for orientation changes
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', updateOrientation)
      return () => {
        window.screen.orientation.removeEventListener('change', updateOrientation)
      }
    } else {
      window.addEventListener('orientationchange', updateOrientation)
      window.addEventListener('resize', updateOrientation)
      return () => {
        window.removeEventListener('orientationchange', updateOrientation)
        window.removeEventListener('resize', updateOrientation)
      }
    }
  }, [])

  return orientation
}

/**
 * Check if device is in portrait mode
 */
export function useIsPortrait(): boolean {
  const orientation = useOrientation()
  return orientation.type === 'portrait'
}

/**
 * Check if device is in landscape mode
 */
export function useIsLandscape(): boolean {
  const orientation = useOrientation()
  return orientation.type === 'landscape'
}

/**
 * Lock orientation (if supported)
 */
export async function lockOrientation(type: OrientationLockType): Promise<boolean> {
  try {
    const orientation = window.screen?.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> }
    if (orientation?.lock) {
      await orientation.lock(type)
      return true
    }
    return false
  } catch (error) {
    console.error('Failed to lock orientation:', error)
    return false
  }
}

/**
 * Unlock orientation
 */
export function unlockOrientation(): void {
  try {
    if (window.screen?.orientation?.unlock) {
      window.screen.orientation.unlock()
    }
  } catch (error) {
    console.error('Failed to unlock orientation:', error)
  }
}
