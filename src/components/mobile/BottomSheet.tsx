'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useTouchGestures } from '@/src/hooks/useTouchGestures'

export interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  snapPoints?: number[] // Array of snap points as percentages (0-100)
  initialSnapPoint?: number // Index of initial snap point
  showHandle?: boolean
  showCloseButton?: boolean
  closeOnBackdrop?: boolean
  maxHeight?: string
  className?: string
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [30, 60, 90],
  initialSnapPoint = 1,
  showHandle = true,
  showCloseButton = true,
  closeOnBackdrop = true,
  maxHeight,
  className = ''
}) => {
  const sheetRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const [currentSnapPoint, setCurrentSnapPoint] = useState(initialSnapPoint)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)

  // Calculate height based on snap points
  const getHeight = useCallback((snapIndex: number) => {
    return `${snapPoints[snapIndex]}vh`
  }, [snapPoints])

  // Find nearest snap point
  const findNearestSnapPoint = useCallback((height: number) => {
    const heightPercent = (height / window.innerHeight) * 100
    let nearestIndex = 0
    let minDiff = Math.abs(snapPoints[0] - heightPercent)

    snapPoints.forEach((point, index) => {
      const diff = Math.abs(point - heightPercent)
      if (diff < minDiff) {
        minDiff = diff
        nearestIndex = index
      }
    })

    return nearestIndex
  }, [snapPoints])

  // Touch gesture handlers
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!sheetRef.current) return

    const touch = event.touches[0]
    setStartY(touch.clientY)
    setCurrentY(touch.clientY)
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!isDragging || !sheetRef.current) return

    const touch = event.touches[0]
    setCurrentY(touch.clientY)

    const deltaY = touch.clientY - startY
    const currentHeight = window.innerHeight * (snapPoints[currentSnapPoint] / 100)
    const newHeight = Math.max(100, currentHeight - deltaY)

    // Apply transform for smooth dragging
    sheetRef.current.style.height = `${newHeight}px`

    // Prevent page scroll while dragging
    event.preventDefault()
  }, [isDragging, startY, currentSnapPoint, snapPoints])

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!isDragging || !sheetRef.current) return

    setIsDragging(false)

    const deltaY = currentY - startY
    const currentHeight = window.innerHeight * (snapPoints[currentSnapPoint] / 100)
    const newHeight = currentHeight - deltaY

    // Check if should close (dragged down significantly from smallest snap point)
    if (currentSnapPoint === 0 && deltaY > 100) {
      onClose()
      return
    }

    // Find nearest snap point
    const nearestSnapIndex = findNearestSnapPoint(newHeight)
    setCurrentSnapPoint(nearestSnapIndex)

    // Animate to snap point
    sheetRef.current.style.height = getHeight(nearestSnapIndex)
    sheetRef.current.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'

    // Remove transition after animation
    setTimeout(() => {
      if (sheetRef.current) {
        sheetRef.current.style.transition = ''
      }
    }, 300)
  }, [isDragging, currentY, startY, currentSnapPoint, snapPoints, onClose, findNearestSnapPoint, getHeight])

  // Touch gestures for handle and header
  const { ref: handleRef } = useTouchGestures({
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onSwipe: (gesture) => {
      if (gesture.direction === 'down' && gesture.velocity > 0.5) {
        // Fast swipe down - go to next lower snap point or close
        if (currentSnapPoint > 0) {
          setCurrentSnapPoint(currentSnapPoint - 1)
        } else {
          onClose()
        }
      } else if (gesture.direction === 'up' && gesture.velocity > 0.5) {
        // Fast swipe up - go to next higher snap point
        if (currentSnapPoint < snapPoints.length - 1) {
          setCurrentSnapPoint(currentSnapPoint + 1)
        }
      }
    }
  })

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (closeOnBackdrop && event.target === backdropRef.current) {
      onClose()
    }
  }, [closeOnBackdrop, onClose])

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Update height when snap point changes
  useEffect(() => {
    if (sheetRef.current && isOpen) {
      sheetRef.current.style.height = getHeight(currentSnapPoint)
    }
  }, [currentSnapPoint, getHeight, isOpen])

  if (!isOpen) return null

  const sheetContent = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isOpen ? 'bg-opacity-50' : 'bg-opacity-0'
        }`}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={`
          relative w-full bg-white dark:bg-neutral-900 rounded-t-xl shadow-xl
          transform transition-transform duration-300 ease-out
          flex flex-col overflow-hidden
          ${className}
        `}
        style={{
          height: getHeight(currentSnapPoint),
          maxHeight: maxHeight || '90vh'
        }}
      >
        {/* Handle */}
        {showHandle && (
          <div
            ref={handleRef as React.RefObject<HTMLDivElement>}
            className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          >
            <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
            {title && (
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                aria-label="Fechar"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
          }}
        >
          {children}
        </div>

        {/* Snap point indicators */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2">
          {snapPoints.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSnapPoint(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentSnapPoint
                  ? 'bg-brand-500'
                  : 'bg-neutral-300 dark:bg-neutral-600 hover:bg-neutral-400 dark:hover:bg-neutral-500'
              }`}
              aria-label={`Ir para posição ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )

  // Render in portal for proper stacking
  if (typeof window !== 'undefined') {
    return createPortal(sheetContent, document.body)
  }

  return null
}

// Quick action bottom sheet component
export interface QuickActionSheetProps {
  isOpen: boolean
  onClose: () => void
  actions: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'danger' | 'success'
    disabled?: boolean
  }>
}

export const QuickActionSheet: React.FC<QuickActionSheetProps> = ({
  isOpen,
  onClose,
  actions
}) => {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={[30]}
      initialSnapPoint={0}
      showCloseButton={false}
      className="max-h-80"
    >
      <div className="p-4 space-y-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => {
              action.onClick()
              onClose()
            }}
            disabled={action.disabled}
            className={`
              w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left
              transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
              ${action.variant === 'danger'
                ? 'text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20'
                : action.variant === 'success'
                ? 'text-success-600 hover:bg-success-50 dark:text-success-400 dark:hover:bg-success-900/20'
                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }
            `}
          >
            {action.icon && (
              <div className="flex-shrink-0 w-5 h-5">
                {action.icon}
              </div>
            )}
            <span className="font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}