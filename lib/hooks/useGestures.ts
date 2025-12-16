'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

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

export interface LongPressGesture {
  position: TouchPosition
  duration: number
}

export interface DoubleTapGesture {
  position: TouchPosition
  timeBetweenTaps: number
}

export interface GestureOptions {
  onSwipe?: (gesture: SwipeGesture) => void
  onPinch?: (gesture: PinchGesture) => void
  onLongPress?: (gesture: LongPressGesture) => void
  onDoubleTap?: (gesture: DoubleTapGesture) => void
  onTouchStart?: (event: TouchEvent) => void
  onTouchMove?: (event: TouchEvent) => void
  onTouchEnd?: (event: TouchEvent) => void
  swipeThreshold?: number
  pinchThreshold?: number
  longPressDelay?: number
  doubleTapDelay?: number
  preventScroll?: boolean
}

export interface GestureState {
  isSwipingLeft: boolean
  isSwipingRight: boolean
  isSwipingUp: boolean
  isSwipingDown: boolean
  isPinching: boolean
  isLongPressing: boolean
  currentScale: number
}

export const useGestures = <T extends HTMLElement = HTMLElement>(options: GestureOptions = {}) => {
  const elementRef = useRef<T>(null)
  const touchStartRef = useRef<TouchPosition[]>([])
  const touchStartTimeRef = useRef<number>(0)
  const lastPinchDistanceRef = useRef<number>(0)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTapTimeRef = useRef<number>(0)
  const lastTapPositionRef = useRef<TouchPosition | null>(null)

  const [state, setState] = useState<GestureState>({
    isSwipingLeft: false,
    isSwipingRight: false,
    isSwipingUp: false,
    isSwipingDown: false,
    isPinching: false,
    isLongPressing: false,
    currentScale: 1
  })

  const {
    onSwipe,
    onPinch,
    onLongPress,
    onDoubleTap,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    swipeThreshold = 50,
    pinchThreshold = 0.1,
    longPressDelay = 500,
    doubleTapDelay = 300,
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

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touches = Array.from(event.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY
    }))

    touchStartRef.current = touches
    touchStartTimeRef.current = Date.now()

    // Handle pinch gesture
    if (touches.length === 2 && touches[0] && touches[1]) {
      lastPinchDistanceRef.current = getDistance(touches[0], touches[1])
      setState(prev => ({ ...prev, isPinching: true }))
      clearLongPressTimer()
    } else {
      setState(prev => ({ ...prev, isPinching: false }))

      // Start long press timer
      if (onLongPress && touches[0]) {
        clearLongPressTimer()
        longPressTimerRef.current = setTimeout(() => {
          setState(prev => ({ ...prev, isLongPressing: true }))
          if (touches[0]) {
            onLongPress({
              position: touches[0],
              duration: Date.now() - touchStartTimeRef.current
            })
          }

          // Haptic feedback if supported
          if (navigator.vibrate) {
            navigator.vibrate(50)
          }
        }, longPressDelay)
      }

      // Handle double tap
      if (onDoubleTap && lastTapPositionRef.current && touches[0]) {
        const timeSinceLastTap = Date.now() - lastTapTimeRef.current
        const distanceFromLastTap = getDistance(touches[0], lastTapPositionRef.current)

        if (timeSinceLastTap < doubleTapDelay && distanceFromLastTap < 30) {
          clearLongPressTimer()
          onDoubleTap({
            position: touches[0],
            timeBetweenTaps: timeSinceLastTap
          })
          lastTapPositionRef.current = null
          lastTapTimeRef.current = 0
        } else {
          lastTapPositionRef.current = touches[0]
          lastTapTimeRef.current = Date.now()
        }
      } else if (onDoubleTap && touches[0]) {
        lastTapPositionRef.current = touches[0]
        lastTapTimeRef.current = Date.now()
      }
    }

    // Reset swipe states
    setState(prev => ({
      ...prev,
      isSwipingLeft: false,
      isSwipingRight: false,
      isSwipingUp: false,
      isSwipingDown: false
    }))

    if (preventScroll) {
      event.preventDefault()
    }

    onTouchStart?.(event)
  }, [getDistance, onLongPress, onDoubleTap, onTouchStart, preventScroll, longPressDelay, doubleTapDelay, clearLongPressTimer])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (touchStartRef.current.length === 0) return

    const currentTouches = Array.from(event.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY
    }))

    // Clear long press on movement
    clearLongPressTimer()
    setState(prev => ({ ...prev, isLongPressing: false }))

    // Handle pinch gesture
    if (currentTouches.length === 2 && touchStartRef.current.length === 2 && currentTouches[0] && currentTouches[1]) {
      const currentDistance = getDistance(currentTouches[0], currentTouches[1])
      const scale = currentDistance / lastPinchDistanceRef.current

      if (Math.abs(scale - 1) > pinchThreshold) {
        setState(prev => ({ ...prev, currentScale: scale }))
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

      if (!startTouch || !currentTouch) return

      const deltaX = currentTouch.x - startTouch.x
      const deltaY = currentTouch.y - startTouch.y

      // Update swipe states for visual feedback
      if (Math.abs(deltaX) > 10) {
        setState(prev => ({
          ...prev,
          isSwipingLeft: deltaX < 0,
          isSwipingRight: deltaX > 0
        }))
      }

      if (Math.abs(deltaY) > 10) {
        setState(prev => ({
          ...prev,
          isSwipingUp: deltaY < 0,
          isSwipingDown: deltaY > 0
        }))
      }

      if (preventScroll && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        event.preventDefault()
      }
    }

    onTouchMove?.(event)
  }, [getDistance, getCenter, onPinch, onTouchMove, pinchThreshold, preventScroll, clearLongPressTimer])

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (touchStartRef.current.length === 0) return

    clearLongPressTimer()

    const endTime = Date.now()
    const duration = endTime - touchStartTimeRef.current

    // Handle swipe gesture completion
    if (touchStartRef.current.length === 1 && event.changedTouches.length === 1) {
      const startTouch = touchStartRef.current[0]
      const changedTouch = event.changedTouches[0]

      if (!startTouch || !changedTouch) return

      const endTouch = {
        x: changedTouch.clientX,
        y: changedTouch.clientY
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

        // Haptic feedback for successful swipe
        if (navigator.vibrate) {
          navigator.vibrate(10)
        }
      }
    }

    // Reset states
    touchStartRef.current = []
    setState({
      isSwipingLeft: false,
      isSwipingRight: false,
      isSwipingUp: false,
      isSwipingDown: false,
      isPinching: false,
      isLongPressing: false,
      currentScale: 1
    })

    onTouchEnd?.(event)
  }, [onSwipe, onTouchEnd, swipeThreshold, clearLongPressTimer])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const touchOptions: AddEventListenerOptions = { passive: !preventScroll }

    element.addEventListener('touchstart', handleTouchStart, touchOptions)
    element.addEventListener('touchmove', handleTouchMove, touchOptions)
    element.addEventListener('touchend', handleTouchEnd, touchOptions)
    element.addEventListener('touchcancel', handleTouchEnd, touchOptions)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchEnd)
      clearLongPressTimer()
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventScroll, clearLongPressTimer])

  return {
    ref: elementRef,
    state
  }
}

// Pull-to-refresh hook
export const usePullToRefresh = (
  onRefresh: () => void | Promise<void>,
  threshold = 100
) => {
  const elementRef = useRef<HTMLElement>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startYRef = useRef<number>(0)
  const currentYRef = useRef<number>(0)

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (isRefreshing) return

    const element = elementRef.current
    if (!element || element.scrollTop > 0) return

    const firstTouch = event.touches[0]
    if (!firstTouch) return

    startYRef.current = firstTouch.clientY
  }, [isRefreshing])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (isRefreshing || startYRef.current === 0) return

    const element = elementRef.current
    if (!element || element.scrollTop > 0) return

    const firstTouch = event.touches[0]
    if (!firstTouch) return

    currentYRef.current = firstTouch.clientY
    const distance = currentYRef.current - startYRef.current

    if (distance > 0) {
      setPullDistance(Math.min(distance, threshold * 1.5))

      // Prevent default scroll behavior when pulling down
      event.preventDefault()
    }
  }, [isRefreshing, threshold])

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing || startYRef.current === 0) return

    if (pullDistance > threshold) {
      setIsRefreshing(true)

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }

      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }

    startYRef.current = 0
    currentYRef.current = 0
  }, [isRefreshing, pullDistance, threshold, onRefresh])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    ref: elementRef,
    isRefreshing,
    pullDistance,
    progress: Math.min((pullDistance / threshold) * 100, 100)
  }
}
