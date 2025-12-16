'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface TouchPosition {
  x: number;
  y: number;
}

interface SwipeGestureProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  swipeThreshold?: number;
  className?: string;
}

// Swipe Gesture Component
export function SwipeGesture({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  swipeThreshold = 50,
  className = '',
}: SwipeGestureProps) {
  const [touchStart, setTouchStart] = useState<TouchPosition | null>(null);
  const [touchEnd, setTouchEnd] = useState<TouchPosition | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    const touch = e.targetTouches[0];
    if (touch) {
      setTouchStart({
        x: touch.clientX,
        y: touch.clientY,
      });
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.targetTouches[0];
    if (touch) {
      setTouchEnd({
        x: touch.clientX,
        y: touch.clientY,
      });
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isLeftSwipe = distanceX > swipeThreshold;
    const isRightSwipe = distanceX < -swipeThreshold;
    const isUpSwipe = distanceY > swipeThreshold;
    const isDownSwipe = distanceY < -swipeThreshold;

    // Determine if horizontal or vertical swipe is dominant
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      // Horizontal swipe
      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      } else if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }
    } else {
      // Vertical swipe
      if (isUpSwipe && onSwipeUp) {
        onSwipeUp();
      } else if (isDownSwipe && onSwipeDown) {
        onSwipeDown();
      }
    }
  };

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}

// Pull-to-Refresh Component
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
  threshold = 100,
  className = '',
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    const touch = e.touches[0];
    if (touch) {
      setStartY(touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || isRefreshing || startY === 0) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    const touch = e.touches[0];
    if (touch) {
      const currentY = touch.clientY;
      const distance = Math.max(0, currentY - startY);

      if (distance > 0) {
        e.preventDefault();
        setPullDistance(Math.min(distance, threshold * 1.5));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (disabled || isRefreshing || pullDistance < threshold) {
      setPullDistance(0);
      setStartY(0);
      return;
    }

    setIsRefreshing(true);

    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
      setStartY(0);
    }
  };

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const shouldTriggerRefresh = pullDistance >= threshold;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {pullDistance > 0 && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-blue-50 border-b border-blue-200 transition-all duration-150 ease-out z-10"
          style={{
            height: `${Math.min(pullDistance, threshold)}px`,
            transform: `translateY(-${Math.max(0, threshold - pullDistance)}px)`,
          }}
        >
          <div className="flex flex-col items-center space-y-2 text-blue-600">
            <ArrowPathIcon
              className={`h-6 w-6 transition-transform duration-200 ${
                isRefreshing ? 'animate-spin' : shouldTriggerRefresh ? 'rotate-180' : ''
              }`}
              style={{
                opacity: pullProgress,
                transform: `rotate(${pullProgress * 180}deg) ${isRefreshing ? '' : shouldTriggerRefresh ? 'rotate(180deg)' : ''}`,
              }}
            />
            <span className="text-sm font-medium" style={{ opacity: pullProgress }}>
              {isRefreshing
                ? 'Atualizando...'
                : shouldTriggerRefresh
                  ? 'Solte para atualizar'
                  : 'Puxe para atualizar'
              }
            </span>
          </div>
        </div>
      )}

      {/* Content with offset during pull */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Long Press Component
interface LongPressProps {
  onLongPress: () => void;
  onPress?: () => void;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function LongPress({
  onLongPress,
  onPress,
  children,
  delay = 500,
  className = '',
}: LongPressProps) {
  const [isPressed, setIsPressed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    setIsPressed(true);
    timeoutRef.current = setTimeout(() => {
      onLongPress();
      setIsPressed(false);
    }, delay);
  }, [onLongPress, delay]);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isPressed && onPress) {
      onPress();
    }

    setIsPressed(false);
  }, [isPressed, onPress]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`${className} ${isPressed ? 'scale-95' : 'scale-100'} transition-transform duration-150`}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
    >
      {children}
    </div>
  );
}

// Expandable Bottom Sheet
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[];
  initialSnap?: number;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0.3, 0.6, 0.9],
  initialSnap = 0,
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [startY, setStartY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      setStartY(touch.clientY);
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    if (!touch) return;

    const currentY = touch.clientY;
    const deltaY = currentY - startY;
    const sheet = sheetRef.current;

    if (sheet) {
      const currentSnapPoint = snapPoints[currentSnap];
      if (currentSnapPoint !== undefined) {
        const currentHeight = currentSnapPoint * window.innerHeight;
        const newHeight = Math.max(0, currentHeight - deltaY);

        sheet.style.height = `${newHeight}px`;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const touch = e.changedTouches[0];
    if (!touch) {
      setIsDragging(false);
      return;
    }

    const currentY = touch.clientY;
    const deltaY = currentY - startY;
    const sheet = sheetRef.current;

    if (sheet) {
      const currentSnapPoint = snapPoints[currentSnap];
      if (currentSnapPoint !== undefined) {
        const currentHeight = currentSnapPoint * window.innerHeight;
        const newHeight = currentHeight - deltaY;
        const newSnapRatio = newHeight / window.innerHeight;

        // Find closest snap point
        let closestSnap = currentSnap;
        const currentSnapForDistance = snapPoints[currentSnap];
        if (currentSnapForDistance !== undefined) {
          let minDistance = Math.abs(currentSnapForDistance - newSnapRatio);

          snapPoints.forEach((snap, index) => {
            const distance = Math.abs(snap - newSnapRatio);
            if (distance < minDistance) {
              minDistance = distance;
              closestSnap = index;
            }
          });

          // Close if dragged down significantly
          if (deltaY > 100 && closestSnap === 0) {
            onClose();
          } else {
            setCurrentSnap(closestSnap);
          }
        }
      }
    }

    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 transition-all duration-300 ease-out"
        style={{
          height: `${(snapPoints[currentSnap] ?? 0.3) * 100}vh`,
          maxHeight: '90vh',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-4 pb-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </>
  );
}

// Haptic Feedback Hook
export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const light = useCallback(() => vibrate(10), [vibrate]);
  const medium = useCallback(() => vibrate(20), [vibrate]);
  const heavy = useCallback(() => vibrate([30, 10, 30]), [vibrate]);
  const success = useCallback(() => vibrate([10, 5, 10]), [vibrate]);
  const error = useCallback(() => vibrate([50, 20, 50, 20, 50]), [vibrate]);

  return {
    vibrate,
    light,
    medium,
    heavy,
    success,
    error,
  };
}

// Mobile-optimized Floating Action Button
interface FloatingActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
}

export function FloatingActionButton({
  onClick,
  icon,
  label,
  className = '',
}: FloatingActionButtonProps) {
  const haptic = useHapticFeedback();

  const handleClick = () => {
    haptic.light();
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`fixed bottom-6 right-6 z-30 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center active:scale-95 ${className}`}
      aria-label={label}
    >
      {icon}
    </button>
  );
}