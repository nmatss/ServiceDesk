'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useThemePerformance } from '@/src/hooks/useThemeAwareAnimation'

// Floating elements animation
export function FloatingElements({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  const { shouldAnimate } = useThemePerformance()

  if (!shouldAnimate) return <div className={className}>{children}</div>

  return (
    <div className={`animate-float ${className}`}>
      {children}
    </div>
  )
}

// Staggered animation for lists
interface StaggeredListProps {
  children: React.ReactElement[]
  delay?: number
  className?: string
}

export function StaggeredList({ children, delay = 100, className = '' }: StaggeredListProps) {
  const { shouldAnimate } = useThemePerformance()
  const [visibleItems, setVisibleItems] = useState<number[]>([])

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleItems(children.map((_, index) => index))
      return
    }

    children.forEach((_, index) => {
      setTimeout(() => {
        setVisibleItems(prev => [...prev, index])
      }, index * delay)
    })
  }, [children, delay, shouldAnimate])

  return (
    <div className={className}>
      {children.map((child, index) => (
        <div
          key={index}
          className={`transition-all duration-500 ease-out ${
            visibleItems.includes(index)
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
          style={{
            transitionDelay: shouldAnimate ? `${index * 50}ms` : '0ms'
          }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}

// Pulse animation for loading states
export function PulseLoader({ className = '', size = 'md' }: { className?: string, size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className={`animate-pulse ${sizeClasses[size]} bg-brand-200 dark:bg-brand-800 rounded-full ${className}`} />
  )
}

// Ripple effect for buttons
export function RippleButton({
  children,
  onClick,
  className = '',
  disabled = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { shouldAnimate } = useThemePerformance()

  const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!shouldAnimate || disabled) return

    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newRipple = {
      x,
      y,
      id: Date.now()
    }

    setRipples(prev => [...prev, newRipple])

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id))
    }, 600)
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    createRipple(e)
    if (onClick) onClick(e)
  }

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full animate-ripple pointer-events-none"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20
          }}
        />
      ))}
    </button>
  )
}

// Magnetic button effect
export function MagneticButton({
  children,
  className = '',
  strength = 0.3,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { strength?: number }) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { shouldAnimate } = useThemePerformance()

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!shouldAnimate || !buttonRef.current) return

    const button = buttonRef.current
    const rect = button.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const deltaX = (e.clientX - centerX) * strength
    const deltaY = (e.clientY - centerY) * strength

    setPosition({ x: deltaX, y: deltaY })
  }

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }

  return (
    <button
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-200 ease-out ${className}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
      {...props}
    >
      {children}
    </button>
  )
}

// Morphing icon animation
interface MorphingIconProps {
  icons: React.ReactElement[]
  currentIndex: number
  className?: string
}

export function MorphingIcon({ icons, currentIndex, className = '' }: MorphingIconProps) {
  const { shouldAnimate } = useThemePerformance()

  return (
    <div className={`relative ${className}`}>
      {icons.map((icon, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-all duration-300 ${
            index === currentIndex
              ? 'opacity-100 scale-100 rotate-0'
              : 'opacity-0 scale-75 rotate-45'
          }`}
          style={{
            transitionDelay: shouldAnimate ? `${index * 50}ms` : '0ms'
          }}
        >
          {icon}
        </div>
      ))}
    </div>
  )
}

// Progress bar with smooth animation
interface AnimatedProgressProps {
  value: number
  max?: number
  className?: string
  showValue?: boolean
  color?: 'brand' | 'success' | 'warning' | 'error'
}

export function AnimatedProgress({
  value,
  max = 100,
  className = '',
  showValue = false,
  color = 'brand'
}: AnimatedProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const { shouldAnimate } = useThemePerformance()

  useEffect(() => {
    if (!shouldAnimate) {
      setAnimatedValue(value)
      return
    }

    const startValue = animatedValue
    const difference = value - startValue
    const duration = 1000
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function
      const easeOut = 1 - Math.pow(1 - progress, 3)

      setAnimatedValue(startValue + difference * easeOut)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, shouldAnimate])

  const percentage = (animatedValue / max) * 100

  const colorClasses = {
    brand: 'bg-brand-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500'
  }

  return (
    <div className={`relative ${className}`}>
      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-1000 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <div className="absolute right-0 -top-6 text-xs font-medium text-description">
          {Math.round(animatedValue)}/{max}
        </div>
      )}
    </div>
  )
}

// Particle system for backgrounds
export function ParticleBackground({ density = 50, className = '' }: { density?: number, className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { shouldAnimate } = useThemePerformance()

  useEffect(() => {
    if (!shouldAnimate) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      opacity: number
    }> = []

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    const createParticles = () => {
      particles.length = 0
      for (let i = 0; i < density; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.1
        })
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach(particle => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        ctx.fillStyle = `rgba(14, 165, 233, ${particle.opacity})`
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    resizeCanvas()
    createParticles()
    animate()

    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [density, shouldAnimate])

  if (!shouldAnimate) return null

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  )
}

// Card hover effects
export function HoverCard({
  children,
  className = '',
  hoverScale = 1.02,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hoverScale?: number }) {
  const [isHovered, setIsHovered] = useState(false)
  const { shouldAnimate } = useThemePerformance()

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`transition-all duration-300 ease-out ${className}`}
      style={{
        transform: shouldAnimate && isHovered ? `scale(${hoverScale})` : 'scale(1)'
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Loading skeleton with shimmer effect
export function SkeletonLoader({
  className = '',
  width = '100%',
  height = '1rem',
  rounded = 'rounded'
}: {
  className?: string
  width?: string
  height?: string
  rounded?: string
}) {
  return (
    <div
      className={`bg-neutral-200 dark:bg-neutral-700 animate-pulse relative overflow-hidden ${rounded} ${className}`}
      style={{ width, height }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </div>
  )
}

// Success checkmark animation
export function SuccessCheckmark({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg
        viewBox="0 0 52 52"
        className={`transition-all duration-500 ${visible ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
      >
        <circle
          cx="26"
          cy="26"
          r="25"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-success-500 animate-draw-circle"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.1 27.2l7.1 7.2 16.7-16.8"
          className="text-success-500 animate-draw-check"
        />
      </svg>
    </div>
  )
}