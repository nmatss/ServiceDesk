/**
 * Design System Tokens
 *
 * Multi-persona design tokens supporting:
 * - EndUser: Simple, intuitive, minimal cognitive load
 * - Agent: Productive, information-dense, efficient workflows
 * - Manager: Executive, strategic, high-level insights
 */

export type PersonaType = 'enduser' | 'agent' | 'manager';

// Base color palette
export const colors = {
  // Brand colors
  brand: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },

  // Semantic colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },

  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },

  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // Neutral grays
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Priority colors
  priority: {
    low: '#22c55e',      // Green
    medium: '#f59e0b',   // Amber
    high: '#f97316',     // Orange
    critical: '#ef4444', // Red
  },

  // Status colors
  status: {
    open: '#3b82f6',      // Blue
    'in-progress': '#f59e0b', // Amber
    resolved: '#22c55e',   // Green
    closed: '#6b7280',     // Gray
    cancelled: '#ef4444',  // Red
  },
} as const;

// Typography scales
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },

  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
    '6xl': ['3.75rem', { lineHeight: '1' }],
  },

  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// Spacing scale
export const spacing = {
  px: '1px',
  0: '0px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  9: '2.25rem',
  10: '2.5rem',
  11: '2.75rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
  18: '4.5rem',
  20: '5rem',
  24: '6rem',
  28: '7rem',
  32: '8rem',
  36: '9rem',
  40: '10rem',
  44: '11rem',
  48: '12rem',
  52: '13rem',
  56: '14rem',
  60: '15rem',
  64: '16rem',
  72: '18rem',
  80: '20rem',
  96: '24rem',
  128: '32rem',
} as const;

// Border radius
export const borderRadius = {
  none: '0px',
  sm: '0.125rem',
  DEFAULT: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
} as const;

// Shadows
export const boxShadow = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: '0 0 #0000',

  // Custom shadows for personas
  soft: '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
  medium: '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  large: '0 10px 50px -12px rgba(0, 0, 0, 0.25)',
  'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
} as const;

// Animation durations
export const animation = {
  none: '0ms',
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
  slower: '750ms',
  slowest: '1000ms',
} as const;

// Persona-specific design tokens
export const personaTokens = {
  enduser: {
    name: 'End User',
    description: 'Simple, intuitive interface for customers',
    colors: {
      primary: colors.brand[500],
      primaryHover: colors.brand[600],
      background: colors.neutral[50],
      backgroundSecondary: colors.neutral[100],
      text: colors.neutral[800],
      textSecondary: colors.neutral[600],
      border: colors.neutral[200],
    },
    typography: {
      scale: 'comfortable', // Larger text for readability
      headingFont: typography.fontFamily.sans,
      bodyFont: typography.fontFamily.sans,
      baseFontSize: typography.fontSize.base,
      headingWeight: typography.fontWeight.semibold,
      bodyWeight: typography.fontWeight.normal,
    },
    spacing: {
      scale: 'generous', // More breathing room
      containerPadding: spacing[8],
      sectionSpacing: spacing[12],
      elementSpacing: spacing[6],
    },
    layout: {
      density: 'relaxed',
      maxWidth: '1200px',
      sidebarWidth: '280px',
      borderRadius: borderRadius.lg,
      shadow: boxShadow.soft,
    },
    animation: {
      duration: animation.normal,
      easing: 'ease-out',
      reducedMotion: true,
    },
  },

  agent: {
    name: 'Agent',
    description: 'Productive, information-dense interface for support agents',
    colors: {
      primary: colors.brand[600],
      primaryHover: colors.brand[700],
      background: colors.neutral[50],
      backgroundSecondary: colors.neutral[100],
      text: colors.neutral[900],
      textSecondary: colors.neutral[700],
      border: colors.neutral[300],
    },
    typography: {
      scale: 'compact', // Smaller text for density
      headingFont: typography.fontFamily.sans,
      bodyFont: typography.fontFamily.sans,
      baseFontSize: typography.fontSize.sm,
      headingWeight: typography.fontWeight.semibold,
      bodyWeight: typography.fontWeight.normal,
    },
    spacing: {
      scale: 'compact', // Tighter spacing for efficiency
      containerPadding: spacing[6],
      sectionSpacing: spacing[8],
      elementSpacing: spacing[4],
    },
    layout: {
      density: 'dense',
      maxWidth: '1400px',
      sidebarWidth: '240px',
      borderRadius: borderRadius.md,
      shadow: boxShadow.sm,
    },
    animation: {
      duration: animation.fast,
      easing: 'ease-in-out',
      reducedMotion: false,
    },
  },

  manager: {
    name: 'Manager',
    description: 'Executive interface focused on insights and KPIs',
    colors: {
      primary: colors.brand[700],
      primaryHover: colors.brand[800],
      background: colors.neutral[50],
      backgroundSecondary: colors.neutral[100],
      text: colors.neutral[900],
      textSecondary: colors.neutral[600],
      border: colors.neutral[200],
    },
    typography: {
      scale: 'balanced', // Balanced for readability and density
      headingFont: typography.fontFamily.sans,
      bodyFont: typography.fontFamily.sans,
      baseFontSize: typography.fontSize.base,
      headingWeight: typography.fontWeight.bold,
      bodyWeight: typography.fontWeight.medium,
    },
    spacing: {
      scale: 'balanced', // Balanced spacing
      containerPadding: spacing[8],
      sectionSpacing: spacing[10],
      elementSpacing: spacing[5],
    },
    layout: {
      density: 'balanced',
      maxWidth: '1600px',
      sidebarWidth: '300px',
      borderRadius: borderRadius.xl,
      shadow: boxShadow.lg,
    },
    animation: {
      duration: animation.normal,
      easing: 'ease-out',
      reducedMotion: false,
    },
  },
} as const;

// Breakpoints
export const breakpoints = {
  xs: '475px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  '3xl': '1600px',
} as const;

// Z-index scale
export const zIndex = {
  auto: 'auto',
  0: '0',
  10: '10',
  20: '20',
  30: '30',
  40: '40',
  50: '50',
  dropdown: '1000',
  sticky: '1020',
  fixed: '1030',
  modalBackdrop: '1040',
  modal: '1050',
  popover: '1060',
  tooltip: '1070',
  toast: '1080',
} as const;

// Component size variants
export const sizes = {
  xs: {
    height: '1.75rem',  // 28px
    padding: '0.25rem 0.5rem',
    fontSize: typography.fontSize.xs,
  },
  sm: {
    height: '2rem',     // 32px
    padding: '0.375rem 0.75rem',
    fontSize: typography.fontSize.sm,
  },
  md: {
    height: '2.5rem',   // 40px
    padding: '0.5rem 1rem',
    fontSize: typography.fontSize.base,
  },
  lg: {
    height: '3rem',     // 48px
    padding: '0.75rem 1.5rem',
    fontSize: typography.fontSize.lg,
  },
  xl: {
    height: '3.5rem',   // 56px
    padding: '1rem 2rem',
    fontSize: typography.fontSize.xl,
  },
} as const;

// Accessibility tokens
export const a11y = {
  focusRing: {
    width: '2px',
    color: colors.brand[500],
    offset: '2px',
    style: 'solid',
  },
  contrast: {
    aa: 4.5,
    aaa: 7,
  },
  motion: {
    reducedMotion: '@media (prefers-reduced-motion: reduce)',
  },
  touch: {
    minTarget: '44px',
    recommendedTarget: '48px',
  },
} as const;

// Export utility function to get persona tokens
export function getPersonaTokens(persona: PersonaType) {
  return personaTokens[persona];
}

// Export utility to get theme-aware colors
export function getThemeColors(isDark: boolean) {
  if (isDark) {
    return {
      background: colors.neutral[900],
      backgroundSecondary: colors.neutral[800],
      backgroundTertiary: colors.neutral[700],
      text: colors.neutral[100],
      textSecondary: colors.neutral[300],
      textTertiary: colors.neutral[400],
      border: colors.neutral[700],
      borderSecondary: colors.neutral[600],
    };
  }

  return {
    background: colors.neutral[50],
    backgroundSecondary: colors.neutral[100],
    backgroundTertiary: colors.neutral[200],
    text: colors.neutral[900],
    textSecondary: colors.neutral[700],
    textTertiary: colors.neutral[500],
    border: colors.neutral[200],
    borderSecondary: colors.neutral[300],
  };
}