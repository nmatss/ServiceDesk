'use client'

import { useState, ReactNode, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { QuestionMarkCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

// ========================================
// HELP TOOLTIP COMPONENT
// ========================================
interface HelpTooltipProps {
  content: ReactNode
  children?: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: number
  delay?: number
  className?: string
  icon?: 'question' | 'info'
}

export function HelpTooltip({
  content,
  children,
  position = 'top',
  maxWidth = 250,
  delay = 200,
  className,
  icon = 'question',
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const IconComponent = icon === 'question' ? QuestionMarkCircleIcon : InformationCircleIcon

  // Calculate tooltip position
  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
        break
      case 'bottom':
        top = triggerRect.bottom + 8
        left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
        break
      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
        left = triggerRect.left - tooltipRect.width - 8
        break
      case 'right':
        top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
        left = triggerRect.right + 8
        break
    }

    // Keep tooltip within viewport
    const padding = 8
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding))
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding))

    setCoords({ top, left })
  }

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible) {
      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)

      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isVisible])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className={cn('inline-flex items-center cursor-help', className)}
      >
        {children || <IconComponent className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />}
      </div>

      {isVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg animate-fade-in"
            style={{
              top: coords.top,
              left: coords.left,
              maxWidth: `${maxWidth}px`,
            }}
          >
            {content}
            {/* Arrow */}
            <div
              className={cn(
                'absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45',
                position === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
                position === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
                position === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
                position === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2'
              )}
            />
          </div>,
          document.body
        )}
    </>
  )
}

// ========================================
// INLINE HELP TEXT
// ========================================
interface InlineHelpProps {
  children: ReactNode
  className?: string
}

export function InlineHelp({ children, className }: InlineHelpProps) {
  return (
    <div className={cn('flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg', className)}>
      <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-800 dark:text-blue-200">{children}</p>
    </div>
  )
}

// ========================================
// HELP PANEL (expandable help section)
// ========================================
interface HelpPanelProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function HelpPanel({ title, children, defaultOpen = false, className }: HelpPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={cn('border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <QuestionMarkCircleIcon className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-gray-900 dark:text-white">{title}</span>
        </div>
        <svg
          className={cn('w-5 h-5 text-gray-400 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

// ========================================
// CONTEXTUAL HELP BUTTON
// ========================================
interface ContextualHelpProps {
  onClick: () => void
  className?: string
}

export function ContextualHelp({ onClick, className }: ContextualHelpProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors',
        className
      )}
    >
      <QuestionMarkCircleIcon className="w-4 h-4" />
      <span>Precisa de ajuda?</span>
    </button>
  )
}

// ========================================
// FEATURE ANNOUNCEMENT
// ========================================
interface FeatureAnnouncementProps {
  title: string
  description: string
  onDismiss?: () => void
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function FeatureAnnouncement({
  title,
  description,
  onDismiss,
  actionLabel,
  onAction,
  className,
}: FeatureAnnouncementProps) {
  return (
    <div className={cn('relative p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg text-white', className)}>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold mb-1">{title}</h4>
          <p className="text-sm text-white/90 mb-3">{description}</p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ========================================
// ONBOARDING TOOLTIP
// ========================================
interface OnboardingTooltipProps {
  step: number
  totalSteps: number
  title: string
  content: ReactNode
  onNext?: () => void
  onPrev?: () => void
  onSkip?: () => void
  position?: 'top' | 'bottom' | 'left' | 'right'
  target: HTMLElement | null
}

export function OnboardingTooltip({
  step,
  totalSteps,
  title,
  content,
  onNext,
  onPrev,
  onSkip,
  position = 'bottom',
  target,
}: OnboardingTooltipProps) {
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!target || !tooltipRef.current) return

    const updatePosition = () => {
      const targetRect = target.getBoundingClientRect()
      const tooltipRect = tooltipRef.current!.getBoundingClientRect()

      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = targetRect.top - tooltipRect.height - 16
          left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
          break
        case 'bottom':
          top = targetRect.bottom + 16
          left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
          break
        case 'left':
          top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
          left = targetRect.left - tooltipRect.width - 16
          break
        case 'right':
          top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
          left = targetRect.right + 16
          break
      }

      setCoords({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [target, position])

  if (!target) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" />

      {/* Spotlight on target */}
      <div
        className="fixed z-50 ring-4 ring-blue-500 rounded-lg pointer-events-none"
        style={{
          top: target.getBoundingClientRect().top - 4,
          left: target.getBoundingClientRect().left - 4,
          width: target.getBoundingClientRect().width + 8,
          height: target.getBoundingClientRect().height + 8,
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 w-80 p-5 bg-white dark:bg-gray-800 rounded-lg shadow-2xl animate-fade-in"
        style={coords}
      >
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Passo {step} de {totalSteps}
            </span>
            {onSkip && (
              <button onClick={onSkip} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                Pular tour
              </button>
            )}
          </div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h4>
        </div>

        <div className="text-sm text-gray-700 dark:text-gray-300 mb-4">{content}</div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 w-8 rounded-full transition-colors',
                  i + 1 === step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                )}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 1 && onPrev && (
              <button
                onClick={onPrev}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Anterior
              </button>
            )}
            {step < totalSteps && onNext && (
              <button
                onClick={onNext}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Próximo
              </button>
            )}
            {step === totalSteps && onNext && (
              <button
                onClick={onNext}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              >
                Concluir
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
