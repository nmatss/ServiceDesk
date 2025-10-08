'use client';

/**
 * TouchGestures Component
 * Implements comprehensive touch gesture handling for mobile devices
 * - Swipe gestures (left, right, up, down)
 * - Pull-to-refresh
 * - Long press
 * - Pinch to zoom
 * - Double tap
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/monitoring/logger';

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface GestureCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onPinchZoom?: (scale: number) => void;
  onPullToRefresh?: () => Promise<void>;
  onTap?: (x: number, y: number) => void;
}

interface GestureConfig {
  swipeThreshold?: number;
  longPressDuration?: number;
  doubleTapDelay?: number;
  pinchSensitivity?: number;
  pullToRefreshThreshold?: number;
  preventDefaultScroll?: boolean;
}

interface TouchGesturesProps {
  children: React.ReactNode;
  callbacks?: GestureCallbacks;
  config?: GestureConfig;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_CONFIG: Required<GestureConfig> = {
  swipeThreshold: 50,
  longPressDuration: 500,
  doubleTapDelay: 300,
  pinchSensitivity: 1.0,
  pullToRefreshThreshold: 80,
  preventDefaultScroll: false,
};

export default function TouchGestures({
  children,
  callbacks = {},
  config = {},
  className = '',
  disabled = false,
}: TouchGesturesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const touchEndRef = useRef<TouchPoint | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<TouchPoint | null>(null);
  const initialPinchDistanceRef = useRef<number>(0);
  const currentPinchScaleRef = useRef<number>(1);
  const isPinchingRef = useRef<boolean>(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate distance between two touch points
  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      const now = Date.now();

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: now,
      };

      // Handle pinch zoom (two fingers)
      if (e.touches.length === 2) {
        isPinchingRef.current = true;
        initialPinchDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
        currentPinchScaleRef.current = 1;
        return;
      }

      // Handle long press
      if (callbacks.onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          if (touchStartRef.current) {
            callbacks.onLongPress?.(touchStartRef.current.x, touchStartRef.current.y);
            // Vibrate if available
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }
        }, mergedConfig.longPressDuration);
      }

      // Handle double tap
      if (callbacks.onDoubleTap && lastTapRef.current) {
        const timeSinceLastTap = now - lastTapRef.current.timestamp;

        if (timeSinceLastTap < mergedConfig.doubleTapDelay) {
          callbacks.onDoubleTap(touch.clientX, touch.clientY);
          lastTapRef.current = null;
          return;
        }
      }

      lastTapRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: now,
      };

      // Prevent default scroll if configured
      if (mergedConfig.preventDefaultScroll) {
        e.preventDefault();
      }
    },
    [
      disabled,
      callbacks,
      mergedConfig.longPressDuration,
      mergedConfig.doubleTapDelay,
      mergedConfig.preventDefaultScroll,
      getDistance,
    ]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      // Clear long press timer on move
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Handle pinch zoom
      if (isPinchingRef.current && e.touches.length === 2) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialPinchDistanceRef.current;
        currentPinchScaleRef.current = scale;

        callbacks.onPinchZoom?.(scale * mergedConfig.pinchSensitivity);
        e.preventDefault();
        return;
      }

      // Handle pull to refresh
      if (
        callbacks.onPullToRefresh &&
        touchStartRef.current &&
        e.touches.length === 1 &&
        window.scrollY === 0
      ) {
        const touch = e.touches[0];
        const deltaY = touch.clientY - touchStartRef.current.y;

        if (deltaY > 0 && deltaY < mergedConfig.pullToRefreshThreshold * 2) {
          setPullDistance(deltaY);
          e.preventDefault();
        }
      }
    },
    [
      disabled,
      callbacks,
      mergedConfig.pinchSensitivity,
      mergedConfig.pullToRefreshThreshold,
      getDistance,
    ]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      // Clear long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Handle pinch end
      if (isPinchingRef.current) {
        isPinchingRef.current = false;
        initialPinchDistanceRef.current = 0;
        currentPinchScaleRef.current = 1;
        return;
      }

      // Handle pull to refresh
      if (pullDistance >= mergedConfig.pullToRefreshThreshold && callbacks.onPullToRefresh) {
        setIsRefreshing(true);
        callbacks
          .onPullToRefresh()
          .then(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          })
          .catch((error) => {
            logger.error('Pull to refresh error', error);
            setIsRefreshing(false);
            setPullDistance(0);
          });
        return;
      } else {
        setPullDistance(0);
      }

      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now(),
      };

      const deltaX = touchEndRef.current.x - touchStartRef.current.x;
      const deltaY = touchEndRef.current.y - touchStartRef.current.y;
      const deltaTime = touchEndRef.current.timestamp - touchStartRef.current.timestamp;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Determine if it's a swipe
      if (absX > mergedConfig.swipeThreshold || absY > mergedConfig.swipeThreshold) {
        // Horizontal swipe
        if (absX > absY) {
          if (deltaX > 0) {
            callbacks.onSwipeRight?.();
          } else {
            callbacks.onSwipeLeft?.();
          }
        }
        // Vertical swipe
        else {
          if (deltaY > 0) {
            callbacks.onSwipeDown?.();
          } else {
            callbacks.onSwipeUp?.();
          }
        }
      }
      // It's a tap
      else if (absX < 10 && absY < 10 && deltaTime < 200) {
        callbacks.onTap?.(touch.clientX, touch.clientY);
      }

      touchStartRef.current = null;
      touchEndRef.current = null;
    },
    [
      disabled,
      pullDistance,
      mergedConfig.pullToRefreshThreshold,
      mergedConfig.swipeThreshold,
      callbacks,
    ]
  );

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
    isPinchingRef.current = false;
    setPullDistance(0);
  }, []);

  // Setup and cleanup event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return (
    <div ref={containerRef} className={`touch-gestures-container ${className}`}>
      {/* Pull to refresh indicator */}
      {callbacks.onPullToRefresh && pullDistance > 0 && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center transition-transform"
          style={{
            transform: `translateY(${Math.min(pullDistance, mergedConfig.pullToRefreshThreshold)}px)`,
            opacity: Math.min(pullDistance / mergedConfig.pullToRefreshThreshold, 1),
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg">
            {isRefreshing ? (
              <svg
                className="animate-spin h-6 w-6 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6 text-blue-600"
                style={{
                  transform: `rotate(${Math.min((pullDistance / mergedConfig.pullToRefreshThreshold) * 360, 360)}deg)`,
                }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

// Hook for using touch gestures
export function useTouchGestures(callbacks: GestureCallbacks, config?: GestureConfig) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    let touchStart: TouchPoint | null = null;
    let longPressTimer: NodeJS.Timeout | null = null;
    let lastTap: TouchPoint | null = null;
    let initialPinchDistance = 0;
    let isPinching = false;

    const getDistance = (touch1: Touch, touch2: Touch): number => {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const now = Date.now();

      touchStart = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: now,
      };

      if (e.touches.length === 2) {
        isPinching = true;
        initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
        return;
      }

      if (callbacks.onLongPress) {
        longPressTimer = setTimeout(() => {
          if (touchStart) {
            callbacks.onLongPress?.(touchStart.x, touchStart.y);
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }
        }, mergedConfig.longPressDuration);
      }

      if (callbacks.onDoubleTap && lastTap) {
        const timeSinceLastTap = now - lastTap.timestamp;
        if (timeSinceLastTap < mergedConfig.doubleTapDelay) {
          callbacks.onDoubleTap(touch.clientX, touch.clientY);
          lastTap = null;
          return;
        }
      }

      lastTap = { x: touch.clientX, y: touch.clientY, timestamp: now };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (isPinching && e.touches.length === 2) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialPinchDistance;
        callbacks.onPinchZoom?.(scale * mergedConfig.pinchSensitivity);
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      if (isPinching) {
        isPinching = false;
        initialPinchDistance = 0;
        return;
      }

      if (!touchStart) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > mergedConfig.swipeThreshold || absY > mergedConfig.swipeThreshold) {
        if (absX > absY) {
          deltaX > 0 ? callbacks.onSwipeRight?.() : callbacks.onSwipeLeft?.();
        } else {
          deltaY > 0 ? callbacks.onSwipeDown?.() : callbacks.onSwipeUp?.();
        }
      } else if (absX < 10 && absY < 10) {
        callbacks.onTap?.(touch.clientX, touch.clientY);
      }

      touchStart = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      if (longPressTimer) clearTimeout(longPressTimer);
    };
  }, [callbacks, config]);

  return elementRef;
}
