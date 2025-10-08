'use client'

import { useRef, useEffect, useCallback } from 'react'

export interface TouchPosition {
  x: number
  y: number
}

export interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down'
  distance: number
  velocity: number
  duration: number
}

export interface PinchGesture {
  scale: number
  center: TouchPosition
}

export interface TouchGestureOptions {
  onSwipe?: (gesture: SwipeGesture) => void
  onPinch?: (gesture: PinchGesture) => void
  onTouchStart?: (event: TouchEvent) => void
  onTouchMove?: (event: TouchEvent) => void
  onTouchEnd?: (event: TouchEvent) => void
  swipeThreshold?: number
  pinchThreshold?: number
  preventScroll?: boolean
}

export interface TouchGestureState {
  isSwipingLeft: boolean
  isSwipingRight: boolean
  isSwipingUp: boolean
  isSwipingDown: boolean
  isPinching: boolean
  currentScale: number
}

export const useTouchGestures = (options: TouchGestureOptions = {}) => {
  const elementRef = useRef<HTMLElement>(null)
  const touchStartRef = useRef<TouchPosition[]>([])
  const touchStartTimeRef = useRef<number>(0)
  const lastPinchDistanceRef = useRef<number>(0)
  const stateRef = useRef<TouchGestureState>({
    isSwipingLeft: false,
    isSwipingRight: false,
    isSwipingUp: false,
    isSwipingDown: false,
    isPinching: false,
    currentScale: 1
  })

  const {
    onSwipe,
    onPinch,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipeThreshold = 50,
    pinchThreshold = 0.1,
    preventScroll = false
  } = options

  const getDistance = useCallback((touch1: TouchPosition, touch2: TouchPosition): number => {
    return Math.sqrt(
      Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2)
    )
  }, [])

  const getCenter = useCallback((touch1: TouchPosition, touch2: TouchPosition): TouchPosition => {
    return {
      x: (touch1.x + touch2.x) / 2,
      y: (touch1.y + touch2.y) / 2
    }
  }, [])

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touches = Array.from(event.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY
    }))

    touchStartRef.current = touches
    touchStartTimeRef.current = Date.now()

    if (touches.length === 2) {
      lastPinchDistanceRef.current = getDistance(touches[0], touches[1])
      stateRef.current.isPinching = true
    } else {
      stateRef.current.isPinching = false
    }

    // Reset swipe states
    stateRef.current.isSwipingLeft = false
    stateRef.current.isSwipingRight = false
    stateRef.current.isSwipingUp = false
    stateRef.current.isSwipingDown = false

    if (preventScroll) {
      event.preventDefault()
    }

    onTouchStart?.(event)
  }, [getDistance, onTouchStart, preventScroll])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (touchStartRef.current.length === 0) return

    const currentTouches = Array.from(event.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY
    }))

    // Handle pinch gesture
    if (currentTouches.length === 2 && touchStartRef.current.length === 2) {
      const currentDistance = getDistance(currentTouches[0], currentTouches[1])
      const scale = currentDistance / lastPinchDistanceRef.current

      if (Math.abs(scale - 1) > pinchThreshold) {
        stateRef.current.currentScale = scale
        const center = getCenter(currentTouches[0], currentTouches[1])

        onPinch?.({
          scale,
          center
        })
      }

      if (preventScroll) {
        event.preventDefault()
      }
      return
    }

    // Handle swipe gesture
    if (currentTouches.length === 1 && touchStartRef.current.length === 1) {
      const startTouch = touchStartRef.current[0]
      const currentTouch = currentTouches[0]

      const deltaX = currentTouch.x - startTouch.x
      const deltaY = currentTouch.y - startTouch.y

      // Update swipe states for visual feedback
      if (Math.abs(deltaX) > 10) {
        stateRef.current.isSwipingLeft = deltaX < 0
        stateRef.current.isSwipingRight = deltaX > 0
      }

      if (Math.abs(deltaY) > 10) {
        stateRef.current.isSwipingUp = deltaY < 0
        stateRef.current.isSwipingDown = deltaY > 0
      }

      if (preventScroll && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        event.preventDefault()
      }
    }

    onTouchMove?.(event)
  }, [getDistance, getCenter, onPinch, onTouchMove, pinchThreshold, preventScroll])

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (touchStartRef.current.length === 0) return

    const endTime = Date.now()
    const duration = endTime - touchStartTimeRef.current

    // Handle swipe gesture completion
    if (touchStartRef.current.length === 1 && event.changedTouches.length === 1) {
      const startTouch = touchStartRef.current[0]
      const endTouch = {
        x: event.changedTouches[0].clientX,
        y: event.changedTouches[0].clientY
      }

      const deltaX = endTouch.x - startTouch.x
      const deltaY = endTouch.y - startTouch.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const velocity = distance / duration

      if (distance >= swipeThreshold) {
        let direction: 'left' | 'right' | 'up' | 'down'

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = deltaX > 0 ? 'right' : 'left'
        } else {
          direction = deltaY > 0 ? 'down' : 'up'
        }

        onSwipe?.({
          direction,
          distance,
          velocity,
          duration
        })
      }
    }

    // Reset states
    touchStartRef.current = []
    stateRef.current.isSwipingLeft = false
    stateRef.current.isSwipingRight = false
    stateRef.current.isSwipingUp = false
    stateRef.current.isSwipingDown = false
    stateRef.current.isPinching = false
    stateRef.current.currentScale = 1

    onTouchEnd?.(event)
  }, [onSwipe, onTouchEnd, swipeThreshold])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const options = { passive: !preventScroll }

    element.addEventListener('touchstart', handleTouchStart, options)
    element.addEventListener('touchmove', handleTouchMove, options)
    element.addEventListener('touchend', handleTouchEnd, options)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventScroll])

  return {
    ref: elementRef,
    state: stateRef.current
  }
}

// Hook for pull-to-refresh gesture
export const usePullToRefresh = (onRefresh: () => void | Promise<void>, threshold = 100) => {
  const elementRef = useRef<HTMLElement>(null)
  const startYRef = useRef<number>(0)
  const currentYRef = useRef<number>(0)
  const isRefreshingRef = useRef<boolean>(false)
  const pullDistanceRef = useRef<number>(0)

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (isRefreshingRef.current) return

    const element = elementRef.current
    if (!element || element.scrollTop > 0) return

    startYRef.current = event.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (isRefreshingRef.current || startYRef.current === 0) return

    const element = elementRef.current
    if (!element || element.scrollTop > 0) return

    currentYRef.current = event.touches[0].clientY
    const pullDistance = currentYRef.current - startYRef.current

    if (pullDistance > 0) {
      pullDistanceRef.current = pullDistance

      // Add visual feedback class
      element.style.setProperty('--pull-distance', `${Math.min(pullDistance, threshold)}px`)

      if (pullDistance > threshold) {
        element.classList.add('pull-to-refresh-ready')
      } else {
        element.classList.remove('pull-to-refresh-ready')
      }

      // Prevent default scroll behavior when pulling down
      event.preventDefault()
    }
  }, [threshold])

  const handleTouchEnd = useCallback(async (event: TouchEvent) => {
    if (isRefreshingRef.current || startYRef.current === 0) return

    const element = elementRef.current
    if (!element) return

    const pullDistance = pullDistanceRef.current

    if (pullDistance > threshold) {
      isRefreshingRef.current = true
      element.classList.add('pull-to-refresh-loading')

      try {
        await onRefresh()
      } finally {
        isRefreshingRef.current = false
        element.classList.remove('pull-to-refresh-loading', 'pull-to-refresh-ready')
        element.style.removeProperty('--pull-distance')
      }
    } else {
      element.classList.remove('pull-to-refresh-ready')
      element.style.removeProperty('--pull-distance')
    }

    startYRef.current = 0
    currentYRef.current = 0
    pullDistanceRef.current = 0
  }, [onRefresh, threshold])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    ref: elementRef,
    isRefreshing: isRefreshingRef.current
  }
}