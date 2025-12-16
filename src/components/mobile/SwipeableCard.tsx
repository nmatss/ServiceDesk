'use client'

import React, { useRef, useState, useCallback } from 'react'

export interface SwipeAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color: 'primary' | 'success' | 'warning' | 'danger'
  threshold?: number
}

export interface SwipeableCardProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  className?: string
  disabled?: boolean
}

const actionColors = {
  primary: 'bg-blue-500 text-white',
  success: 'bg-green-500 text-white',
  warning: 'bg-yellow-500 text-white',
  danger: 'bg-red-500 text-white'
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeLeft,
  onSwipeRight,
  className = '',
  disabled = false
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [_revealedSide, setRevealedSide] = useState<'left' | 'right' | null>(null)

  const maxSwipeDistance = 200
  const actionThreshold = 80

  const resetCard = useCallback(() => {
    setSwipeOffset(0)
    setIsSwiping(false)
    setRevealedSide(null)
  }, [])

  const handleSwipeStart = useCallback(() => {
    if (!disabled) {
      setIsSwiping(true)
    }
  }, [disabled])

  const handleSwipeMove = useCallback((deltaX: number) => {
    if (disabled) return

    // Limit swipe based on available actions
    const maxLeft = leftActions.length > 0 ? maxSwipeDistance : 0
    const maxRight = rightActions.length > 0 ? -maxSwipeDistance : 0

    const newOffset = Math.max(maxRight, Math.min(maxLeft, deltaX))
    setSwipeOffset(newOffset)
  }, [disabled, leftActions.length, rightActions.length, maxSwipeDistance])

  const handleSwipeEnd = useCallback(() => {
    if (disabled) return

    setIsSwiping(false)

    // Determine if an action should be triggered
    if (Math.abs(swipeOffset) > actionThreshold) {
      if (swipeOffset > 0 && leftActions.length > 0) {
        // Trigger left action
        const actionIndex = Math.min(
          Math.floor(swipeOffset / actionThreshold) - 1,
          leftActions.length - 1
        )
        if (actionIndex >= 0 && leftActions[actionIndex]) {
          leftActions[actionIndex].onClick()
        }
        onSwipeRight?.()
      } else if (swipeOffset < 0 && rightActions.length > 0) {
        // Trigger right action
        const actionIndex = Math.min(
          Math.floor(Math.abs(swipeOffset) / actionThreshold) - 1,
          rightActions.length - 1
        )
        if (actionIndex >= 0 && rightActions[actionIndex]) {
          rightActions[actionIndex].onClick()
        }
        onSwipeLeft?.()
      }
    }

    // Reset to resting position
    resetCard()
  }, [disabled, swipeOffset, leftActions, rightActions, onSwipeLeft, onSwipeRight, actionThreshold, resetCard])

  // Use touch gestures
  const touchStartX = useRef(0)
  const currentX = useRef(0)

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (disabled) return
    touchStartX.current = event.touches[0]?.clientX ?? 0
    handleSwipeStart()
  }, [disabled, handleSwipeStart])

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (disabled || !isSwiping) return
    currentX.current = event.touches[0]?.clientX ?? 0
    const deltaX = currentX.current - touchStartX.current
    handleSwipeMove(deltaX)
  }, [disabled, isSwiping, handleSwipeMove])

  const handleTouchEnd = useCallback(() => {
    if (disabled) return
    handleSwipeEnd()
  }, [disabled, handleSwipeEnd])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left Actions Background */}
      {leftActions.length > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-center">
          {leftActions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                action.onClick()
                resetCard()
              }}
              className={`h-full px-6 flex flex-col items-center justify-center ${actionColors[action.color]} transition-all duration-200`}
              style={{
                width: `${actionThreshold}px`,
                opacity: swipeOffset > index * actionThreshold ? 1 : 0.5,
                transform: `scale(${swipeOffset > (index + 1) * actionThreshold ? 1.1 : 1})`
              }}
              aria-label={action.label}
            >
              <div className="w-6 h-6 mb-1">
                {action.icon}
              </div>
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right Actions Background */}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center">
          {rightActions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                action.onClick()
                resetCard()
              }}
              className={`h-full px-6 flex flex-col items-center justify-center ${actionColors[action.color]} transition-all duration-200`}
              style={{
                width: `${actionThreshold}px`,
                opacity: Math.abs(swipeOffset) > index * actionThreshold ? 1 : 0.5,
                transform: `scale(${Math.abs(swipeOffset) > (index + 1) * actionThreshold ? 1.1 : 1})`
              }}
              aria-label={action.label}
            >
              <div className="w-6 h-6 mb-1">
                {action.icon}
              </div>
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Card Content */}
      <div
        ref={cardRef}
        className={`relative bg-white dark:bg-neutral-800 transition-transform ${
          isSwiping ? 'duration-0' : 'duration-300'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'}`}
        style={{
          transform: `translateX(${swipeOffset}px)`
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>

      {/* Swipe Indicator */}
      {isSwiping && Math.abs(swipeOffset) > 10 && (
        <div className="absolute top-1/2 transform -translate-y-1/2 pointer-events-none">
          {swipeOffset > 0 ? (
            <div className="ml-4 text-blue-500 animate-pulse">
              ←
            </div>
          ) : (
            <div className="mr-4 text-red-500 animate-pulse" style={{ right: 0, position: 'absolute' }}>
              →
            </div>
          )}
        </div>
      )}
    </div>
  )
}
