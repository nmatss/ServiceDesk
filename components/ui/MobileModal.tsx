'use client'

import React, { useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/design-system/utils'

/**
 * MobileModal - Mobile-optimized modal component
 *
 * Features:
 * - Full-screen on mobile, centered dialog on desktop
 * - Bottom sheet variant for mobile
 * - Touch-friendly close gestures
 * - Safe area support for notched devices
 */

export interface MobileModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** Use bottom sheet style on mobile */
  variant?: 'full' | 'bottom-sheet' | 'centered'
  /** Modal size on desktop */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  /** Prevent closing on backdrop click */
  disableBackdropClose?: boolean
  /** Show close button */
  showCloseButton?: boolean
}

export function MobileModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  variant = 'centered',
  size = 'md',
  className,
  disableBackdropClose = false,
  showCloseButton = true
}: MobileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null)

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // iOS specific fix
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Handle swipe down to close on mobile (bottom sheet variant)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (variant !== 'bottom-sheet') return
    setTouchStart(e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (variant !== 'bottom-sheet') return
    setTouchEnd(e.touches[0].clientY)
  }

  const handleTouchEnd = () => {
    if (variant !== 'bottom-sheet') return
    if (!touchStart || !touchEnd) return

    const swipeDistance = touchStart - touchEnd
    const minSwipeDistance = 50

    // Swipe down to close
    if (swipeDistance < -minSwipeDistance) {
      onClose()
    }

    setTouchStart(null)
    setTouchEnd(null)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (disableBackdropClose) return
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full'
  }

  const variantClasses = {
    full: 'fixed inset-0 sm:relative sm:inset-auto sm:m-4',
    'bottom-sheet': 'fixed inset-x-0 bottom-0 sm:relative sm:inset-auto sm:m-4 rounded-t-3xl sm:rounded-2xl',
    centered: 'relative m-4'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={cn(
          'bg-white dark:bg-neutral-900 shadow-xl z-10 w-full overflow-hidden',
          'transition-all duration-300',
          variant === 'full' && 'h-full sm:h-auto sm:rounded-2xl',
          variant === 'bottom-sheet' && 'animate-slide-up',
          variant === 'centered' && 'animate-scale-in rounded-2xl',
          variant === 'bottom-sheet' ? 'max-h-[90vh] sm:max-h-[80vh]' : 'max-h-[95vh]',
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle for bottom sheet */}
        {variant === 'bottom-sheet' && (
          <div className="sm:hidden flex justify-center pt-3 pb-2" aria-hidden="true">
            <div className="bottom-sheet-handle" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 safe-top">
            {title && (
              <h2
                id="modal-title"
                className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors min-h-touch min-w-touch"
                aria-label="Fechar modal"
              >
                <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-description" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-6 scrollbar-thin">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 safe-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * MobileSheet - Bottom sheet component for mobile
 * Simpler variant of MobileModal optimized for mobile-first interactions
 */
export interface MobileSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  snapPoints?: number[] // Percentage heights [25, 50, 90]
  className?: string
}

export function MobileSheet({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [90],
  className
}: MobileSheetProps) {
  const [currentSnap, setCurrentSnap] = React.useState(snapPoints[0] || 90)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 bg-white dark:bg-neutral-900 rounded-t-3xl shadow-xl',
          'transition-all duration-300 animate-slide-up',
          className
        )}
        style={{ height: `${currentSnap}vh` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'sheet-title' : undefined}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="bottom-sheet-handle" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
            <h2 id="sheet-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto px-6 py-4 scrollbar-thin" style={{ height: `calc(${currentSnap}vh - 100px)` }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * ConfirmDialog - Mobile-optimized confirmation dialog
 */
export interface ConfirmDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'info'
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: 'bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400',
    warning: 'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    info: 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
  }

  const buttonStyles = {
    danger: 'btn-danger',
    warning: 'btn-warning',
    info: 'btn-primary'
  }

  return (
    <MobileModal
      isOpen={isOpen}
      onClose={onCancel}
      size="sm"
      variant="centered"
      showCloseButton={false}
      disableBackdropClose={true}
    >
      <div className="text-center py-4">
        <div className={cn(
          'mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4',
          variantStyles[variant]
        )}>
          <XMarkIcon className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          {title}
        </h3>

        <p className="text-sm sm:text-base text-description mb-6">
          {message}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onCancel}
            className="btn btn-secondary w-full sm:flex-1 order-2 sm:order-1"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm()
              onCancel()
            }}
            className={cn('btn w-full sm:flex-1 order-1 sm:order-2', buttonStyles[variant])}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </MobileModal>
  )
}
