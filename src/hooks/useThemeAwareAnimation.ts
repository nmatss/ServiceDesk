'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/src/contexts/ThemeContext'

export interface ThemeAwareAnimationConfig {
  light: {
    duration: number
    easing: string
    delay?: number
  }
  dark: {
    duration: number
    easing: string
    delay?: number
  }
}

const defaultConfig: ThemeAwareAnimationConfig = {
  light: {
    duration: 200,
    easing: 'ease-out'
  },
  dark: {
    duration: 300,
    easing: 'ease-in-out'
  }
}

export function useThemeAwareAnimation(
  config: Partial<ThemeAwareAnimationConfig> = {}
) {
  const { resolvedTheme } = useTheme()
  const [animationConfig, setAnimationConfig] = useState(
    resolvedTheme === 'dark'
      ? { ...defaultConfig.dark, ...config.dark }
      : { ...defaultConfig.light, ...config.light }
  )

  useEffect(() => {
    const newConfig = resolvedTheme === 'dark'
      ? { ...defaultConfig.dark, ...config.dark }
      : { ...defaultConfig.light, ...config.light }

    setAnimationConfig(newConfig)
  }, [resolvedTheme, config])

  return animationConfig
}

// Hook for theme-aware CSS classes
export function useThemeAwareClasses() {
  const { resolvedTheme } = useTheme()

  return {
    // Background classes
    backgroundPrimary: resolvedTheme === 'dark'
      ? 'bg-neutral-900'
      : 'bg-white',
    backgroundSecondary: resolvedTheme === 'dark'
      ? 'bg-neutral-800'
      : 'bg-neutral-50',
    backgroundTertiary: resolvedTheme === 'dark'
      ? 'bg-neutral-700'
      : 'bg-neutral-100',

    // Text classes
    textPrimary: resolvedTheme === 'dark'
      ? 'text-neutral-100'
      : 'text-neutral-900',
    textSecondary: resolvedTheme === 'dark'
      ? 'text-neutral-300'
      : 'text-neutral-600',
    textTertiary: resolvedTheme === 'dark'
      ? 'text-neutral-400'
      : 'text-neutral-500',

    // Border classes
    borderPrimary: resolvedTheme === 'dark'
      ? 'border-neutral-700'
      : 'border-neutral-200',
    borderSecondary: resolvedTheme === 'dark'
      ? 'border-neutral-600'
      : 'border-neutral-300',

    // Hover states
    hoverBackground: resolvedTheme === 'dark'
      ? 'hover:bg-neutral-800'
      : 'hover:bg-neutral-100',
    hoverBorder: resolvedTheme === 'dark'
      ? 'hover:border-neutral-600'
      : 'hover:border-neutral-300',

    // Focus states
    focusRing: 'focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900',

    // Glass effect
    glass: resolvedTheme === 'dark'
      ? 'backdrop-blur-md bg-neutral-900/80 border border-neutral-700/50'
      : 'backdrop-blur-md bg-white/80 border border-neutral-200/50',

    // Shadows
    shadowSoft: resolvedTheme === 'dark'
      ? 'shadow-lg shadow-black/20'
      : 'shadow-lg shadow-neutral-300/20',
    shadowMedium: resolvedTheme === 'dark'
      ? 'shadow-xl shadow-black/30'
      : 'shadow-xl shadow-neutral-400/20',
    shadowLarge: resolvedTheme === 'dark'
      ? 'shadow-2xl shadow-black/40'
      : 'shadow-2xl shadow-neutral-500/20'
  }
}

// Hook for smooth theme transitions
export function useThemeTransition() {
  const { resolvedTheme } = useTheme()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const triggerTransition = (callback?: () => void) => {
    setIsTransitioning(true)

    // Add transition class to document
    document.documentElement.classList.add('theme-transition')

    if (callback) {
      callback()
    }

    // Remove transition class after animation
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition')
      setIsTransitioning(false)
    }, 300)
  }

  return {
    isTransitioning,
    triggerTransition,
    transitionClass: isTransitioning ? 'theme-transition' : ''
  }
}

// Hook for theme-aware particle effects
export function useThemeParticles() {
  const { resolvedTheme } = useTheme()

  return {
    particleColor: resolvedTheme === 'dark' ? '#ffffff' : '#000000',
    particleOpacity: resolvedTheme === 'dark' ? 0.1 : 0.05,
    particleSize: resolvedTheme === 'dark' ? 2 : 1.5,
    particleSpeed: resolvedTheme === 'dark' ? 0.5 : 0.3
  }
}

// Hook for dynamic color scheme
export function useDynamicColorScheme() {
  const { resolvedTheme } = useTheme()
  const [accent, setAccent] = useState('#0ea5e9')

  useEffect(() => {
    // Load custom color from localStorage
    const customColor = localStorage.getItem('custom-color')
    if (customColor) {
      setAccent(customColor)
    }
  }, [])

  const generateColorVariants = (baseColor: string) => {
    // Simple color manipulation for demo
    // In production, you'd use a proper color library
    const lighter = baseColor + '20'
    const darker = baseColor.replace('#', '#0')

    return {
      50: baseColor + '10',
      100: baseColor + '20',
      200: baseColor + '30',
      300: baseColor + '40',
      400: baseColor + '60',
      500: baseColor,
      600: darker,
      700: darker + '0',
      800: darker + '00',
      900: darker + '000'
    }
  }

  return {
    accent,
    setAccent,
    colorVariants: generateColorVariants(accent),
    isDark: resolvedTheme === 'dark'
  }
}

// Hook for theme-aware performance optimizations
export function useThemePerformance() {
  const { resolvedTheme } = useTheme()
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    // Check for user's motion preferences
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)

    const handleChange = () => setReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return {
    shouldAnimate: !reducedMotion,
    animationDuration: reducedMotion ? 0 : (resolvedTheme === 'dark' ? 300 : 200),
    transitionsEnabled: !reducedMotion,
    performanceMode: reducedMotion ? 'reduced' : 'full'
  }
}