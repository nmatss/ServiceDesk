'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ========================================
// ANIMATED CARD
// ========================================
interface AnimatedCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  href?: string
  hoverScale?: number
  hoverY?: number
  tapScale?: number
  delay?: number
}

export function AnimatedCard({
  children,
  className,
  onClick,
  href,
  hoverScale = 1.02,
  hoverY = -4,
  tapScale = 0.98,
  delay = 0,
}: AnimatedCardProps) {
  const CardWrapper = href ? motion.a : motion.div

  return (
    <CardWrapper
      href={href}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
        delay,
      }}
      whileHover={{
        scale: hoverScale,
        y: hoverY,
        transition: { type: 'spring', stiffness: 400, damping: 15 },
      }}
      whileTap={{ scale: tapScale }}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer',
        className
      )}
    >
      {children}
    </CardWrapper>
  )
}

// ========================================
// ANIMATED LIST (Stagger Children)
// ========================================
interface AnimatedListProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
}

export function AnimatedList({ children, className, staggerDelay = 0.05 }: AnimatedListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ========================================
// ANIMATED LIST ITEM
// ========================================
interface AnimatedListItemProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function AnimatedListItem({ children, className, delay = 0 }: AnimatedListItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            type: 'spring',
            stiffness: 400,
            damping: 25,
            delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ========================================
// FADE IN CONTAINER
// ========================================
interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  duration?: number
}

export function FadeIn({ children, className, delay = 0, direction = 'up', duration = 0.4 }: FadeInProps) {
  const directions = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ========================================
// SLIDE IN PANEL
// ========================================
interface SlideInPanelProps {
  children: ReactNode
  isOpen: boolean
  onClose?: () => void
  side?: 'left' | 'right' | 'top' | 'bottom'
  className?: string
}

export function SlideInPanel({ children, isOpen, onClose, side = 'right', className }: SlideInPanelProps) {
  const variants = {
    left: {
      hidden: { x: '-100%' },
      visible: { x: 0 },
    },
    right: {
      hidden: { x: '100%' },
      visible: { x: 0 },
    },
    top: {
      hidden: { y: '-100%' },
      visible: { y: 0 },
    },
    bottom: {
      hidden: { y: '100%' },
      visible: { y: 0 },
    },
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40"
      />

      {/* Panel */}
      <motion.div
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={variants[side]}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed z-50 bg-white dark:bg-gray-900 shadow-xl',
          side === 'left' && 'left-0 top-0 bottom-0 w-80',
          side === 'right' && 'right-0 top-0 bottom-0 w-80',
          side === 'top' && 'top-0 left-0 right-0 h-80',
          side === 'bottom' && 'bottom-0 left-0 right-0 h-80',
          className
        )}
      >
        {children}
      </motion.div>
    </>
  )
}

// ========================================
// ANIMATED NUMBER (Counter)
// ========================================
interface AnimatedNumberProps {
  value: number
  duration?: number
  className?: string
  decimals?: number
  prefix?: string
  suffix?: string
}

export function AnimatedNumber({
  value,
  duration = 1,
  className,
  decimals = 0,
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <motion.span
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 100,
          damping: 10,
          duration,
        }}
      >
        {prefix}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration }}
          onUpdate={(latest: any) => {
            // This creates the counting effect
            const element = document.getElementById(`animated-number-${value}`)
            if (element && latest.opacity !== undefined) {
              const currentValue = value * latest.opacity
              element.innerText = currentValue.toFixed(decimals)
            }
          }}
        >
          <span id={`animated-number-${value}`}>{value.toFixed(decimals)}</span>
        </motion.span>
        {suffix}
      </motion.span>
    </motion.span>
  )
}

// ========================================
// HOVER CARD (with subtle animations)
// ========================================
interface HoverCardProps {
  children: ReactNode
  className?: string
  glowColor?: string
}

export function HoverCard({ children, className, glowColor = 'blue' }: HoverCardProps) {
  const glowColors = {
    blue: 'hover:shadow-blue-500/20',
    green: 'hover:shadow-green-500/20',
    red: 'hover:shadow-red-500/20',
    yellow: 'hover:shadow-yellow-500/20',
    purple: 'hover:shadow-purple-500/20',
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-200',
        glowColors[glowColor as keyof typeof glowColors],
        className
      )}
    >
      {children}
    </motion.div>
  )
}

// ========================================
// PULSE ANIMATION (for notifications)
// ========================================
interface PulseProps {
  children: ReactNode
  className?: string
  pulseColor?: string
}

export function Pulse({ children, className, pulseColor = 'bg-blue-500' }: PulseProps) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={cn('relative', className)}
    >
      {children}
      <span className={cn('absolute -top-1 -right-1 h-3 w-3 rounded-full animate-ping', pulseColor)} />
      <span className={cn('absolute -top-1 -right-1 h-3 w-3 rounded-full', pulseColor)} />
    </motion.div>
  )
}

// ========================================
// SKELETON WITH SHIMMER
// ========================================
export function SkeletonShimmer({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700', className)}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  )
}

// ========================================
// BOUNCE IN
// ========================================
interface BounceInProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function BounceIn({ children, className, delay = 0 }: BounceInProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ========================================
// ROTATE IN
// ========================================
interface RotateInProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function RotateIn({ children, className, delay = 0 }: RotateInProps) {
  return (
    <motion.div
      initial={{ rotate: -180, opacity: 0 }}
      animate={{ rotate: 0, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ========================================
// PROGRESS BAR (animated)
// ========================================
interface AnimatedProgressBarProps {
  progress: number
  className?: string
  color?: string
  showLabel?: boolean
}

export function AnimatedProgressBar({
  progress,
  className,
  color = 'bg-blue-600',
  showLabel = true,
}: AnimatedProgressBarProps) {
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between mb-1 text-sm text-gray-600 dark:text-gray-400">
          <span>Progresso</span>
          <span>{progress}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
