'use client'

import { useCallback } from 'react'

export type VibrationPattern = number | number[]

/**
 * Hook to provide haptic feedback through vibration
 */
export function useVibrate() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

  const vibrate = useCallback((pattern: VibrationPattern) => {
    if (!isSupported) {
      console.warn('Vibration API is not supported')
      return false
    }

    try {
      return navigator.vibrate(pattern)
    } catch (error) {
      console.error('Vibration error:', error)
      return false
    }
  }, [isSupported])

  const cancel = useCallback(() => {
    if (isSupported) {
      navigator.vibrate(0)
    }
  }, [isSupported])

  // Predefined haptic patterns
  const patterns = {
    light: () => vibrate(10),
    medium: () => vibrate(20),
    heavy: () => vibrate(50),
    success: () => vibrate([10, 50, 10]),
    warning: () => vibrate([10, 50, 10, 50, 10]),
    error: () => vibrate([50, 100, 50]),
    notification: () => vibrate([100, 50, 100]),
    click: () => vibrate(5),
    doubleClick: () => vibrate([5, 50, 5]),
    longPress: () => vibrate(30),
    selection: () => vibrate(3)
  }

  return {
    vibrate,
    cancel,
    patterns,
    isSupported
  }
}

/**
 * Simple vibration hook for one-off usage
 */
export function useSimpleVibrate(pattern: VibrationPattern) {
  const { vibrate } = useVibrate()
  return () => vibrate(pattern)
}

/**
 * Hook for haptic feedback on user interactions
 */
export function useHaptic() {
  const { patterns, isSupported } = useVibrate()

  return {
    onTap: patterns.light,
    onClick: patterns.click,
    onDoubleClick: patterns.doubleClick,
    onLongPress: patterns.longPress,
    onSelect: patterns.selection,
    onSuccess: patterns.success,
    onError: patterns.error,
    onWarning: patterns.warning,
    onNotification: patterns.notification,
    isSupported
  }
}
