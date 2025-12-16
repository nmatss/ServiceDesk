/**
 * Design System Utilities
 *
 * Utility functions for component styling, variants, and theme management
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type PersonaType, getPersonaTokens, getThemeColors } from './tokens';

/**
 * Combines class names with Tailwind CSS conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Creates a variant function using class-variance-authority pattern
 */
export function createVariants<T extends Record<string, Record<string, string>>>(
  base: string,
  variants: T,
  defaultVariants?: Partial<{
    [K in keyof T]: keyof T[K];
  }>
) {
  return function (
    props?: Partial<{
      [K in keyof T]: keyof T[K];
    }> & { className?: string }
  ) {
    const classes = [base];

    if (variants && props) {
      Object.entries(variants).forEach(([key, variantOptions]) => {
        const selectedVariant = props[key as keyof typeof props] || defaultVariants?.[key as keyof typeof defaultVariants];
        const variantClass = selectedVariant && variantOptions[selectedVariant as string];
        if (variantClass) {
          classes.push(variantClass);
        }
      });
    }

    return cn(...classes, props?.className);
  };
}

/**
 * Gets persona-specific class names
 */
export function getPersonaClasses(persona: PersonaType) {
  const tokens = getPersonaTokens(persona);

  const densityClasses = {
    relaxed: 'space-y-6 p-8',
    balanced: 'space-y-5 p-6',
    dense: 'space-y-4 p-4',
  };

  const scaleClasses = {
    comfortable: 'text-base leading-relaxed',
    balanced: 'text-base leading-normal',
    compact: 'text-sm leading-tight',
  };

  return {
    density: densityClasses[tokens.layout.density as keyof typeof densityClasses],
    typography: scaleClasses[tokens.typography.scale as keyof typeof scaleClasses],
    maxWidth: `max-w-[${tokens.layout.maxWidth}]`,
    sidebarWidth: `w-[${tokens.layout.sidebarWidth}]`,
  };
}

/**
 * Gets theme-aware classes
 */
export function getThemeClasses(isDark: boolean) {
  const colors = getThemeColors(isDark);

  return {
    background: isDark ? 'bg-neutral-900' : 'bg-neutral-50',
    backgroundSecondary: isDark ? 'bg-neutral-800' : 'bg-neutral-100',
    text: isDark ? 'text-neutral-100' : 'text-neutral-900',
    textSecondary: isDark ? 'text-neutral-300' : 'text-neutral-700',
    border: isDark ? 'border-neutral-700' : 'border-neutral-200',
  };
}

/**
 * Focus management utilities
 */
export const focusClasses = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2',
  ringDark: 'dark:focus:ring-offset-neutral-900',
  visible: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
  within: 'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
};

/**
 * Animation utilities
 */
export const animations = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  slideDown: 'animate-slide-down',
  slideLeft: 'animate-slide-left',
  slideRight: 'animate-slide-right',
  scaleIn: 'animate-scale-in',
  bounce: 'animate-bounce-soft',
  pulse: 'animate-pulse-soft',
  float: 'animate-float',
};

/**
 * Interactive state utilities
 */
export const interactiveStates = {
  hover: 'transition-colors duration-200 hover:bg-opacity-80',
  active: 'active:scale-95 active:transition-transform active:duration-100',
  disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  loading: 'opacity-50 cursor-wait pointer-events-none',
};

/**
 * Responsive utilities
 */
export const responsive = {
  mobile: 'block sm:hidden',
  tablet: 'hidden sm:block lg:hidden',
  desktop: 'hidden lg:block',
  mobileFirst: 'w-full sm:w-auto',
  stack: 'flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0',
  grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
};

/**
 * Status and priority utilities
 */
export function getStatusClasses(status: string) {
  const statusMap = {
    open: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
    'in-progress': 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800',
    resolved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
    closed: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  };

  return statusMap[status as keyof typeof statusMap] || statusMap.open;
}

export function getPriorityClasses(priority: string) {
  const priorityMap = {
    low: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
    medium: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800',
    high: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
    critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  };

  return priorityMap[priority as keyof typeof priorityMap] || priorityMap.medium;
}

/**
 * Size utilities
 */
export const sizes = {
  xs: {
    height: 'h-7',
    padding: 'px-2 py-1',
    text: 'text-xs',
    icon: 'w-3 h-3',
  },
  sm: {
    height: 'h-8',
    padding: 'px-3 py-1.5',
    text: 'text-sm',
    icon: 'w-4 h-4',
  },
  md: {
    height: 'h-10',
    padding: 'px-4 py-2',
    text: 'text-base',
    icon: 'w-5 h-5',
  },
  lg: {
    height: 'h-12',
    padding: 'px-6 py-3',
    text: 'text-lg',
    icon: 'w-6 h-6',
  },
  xl: {
    height: 'h-14',
    padding: 'px-8 py-4',
    text: 'text-xl',
    icon: 'w-7 h-7',
  },
};

/**
 * Shadow utilities by persona
 */
export function getShadowByPersona(persona: PersonaType, elevation: 'low' | 'medium' | 'high' = 'medium') {
  const shadows = {
    enduser: {
      low: 'shadow-soft',
      medium: 'shadow-medium',
      high: 'shadow-large',
    },
    agent: {
      low: 'shadow-sm',
      medium: 'shadow',
      high: 'shadow-md',
    },
    manager: {
      low: 'shadow-md',
      medium: 'shadow-lg',
      high: 'shadow-xl',
    },
  };

  return shadows[persona][elevation];
}

/**
 * Spacing utilities by persona
 */
export function getSpacingByPersona(persona: PersonaType) {
  const spacing = {
    enduser: {
      xs: 'p-2',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
      xl: 'p-12',
    },
    agent: {
      xs: 'p-1',
      sm: 'p-2',
      md: 'p-4',
      lg: 'p-6',
      xl: 'p-8',
    },
    manager: {
      xs: 'p-2',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-8',
      xl: 'p-10',
    },
  };

  return spacing[persona];
}

/**
 * Border radius utilities by persona
 */
export function getBorderRadiusByPersona(persona: PersonaType, size: 'sm' | 'md' | 'lg' = 'md') {
  const radius = {
    enduser: {
      sm: 'rounded-md',
      md: 'rounded-lg',
      lg: 'rounded-xl',
    },
    agent: {
      sm: 'rounded',
      md: 'rounded-md',
      lg: 'rounded-lg',
    },
    manager: {
      sm: 'rounded-lg',
      md: 'rounded-xl',
      lg: 'rounded-2xl',
    },
  };

  return radius[persona][size];
}

/**
 * Typography utilities by persona
 */
export function getTypographyByPersona(persona: PersonaType) {
  const typography = {
    enduser: {
      heading: 'text-xl sm:text-2xl font-semibold leading-relaxed',
      subheading: 'text-lg sm:text-xl font-medium leading-relaxed',
      body: 'text-base leading-relaxed',
      caption: 'text-sm leading-relaxed text-neutral-600 dark:text-neutral-400',
    },
    agent: {
      heading: 'text-lg sm:text-xl font-semibold leading-tight',
      subheading: 'text-base sm:text-lg font-medium leading-tight',
      body: 'text-sm leading-tight',
      caption: 'text-xs leading-tight text-neutral-700 dark:text-neutral-300',
    },
    manager: {
      heading: 'text-xl sm:text-2xl font-bold leading-normal',
      subheading: 'text-lg sm:text-xl font-semibold leading-normal',
      body: 'text-base font-medium leading-normal',
      caption: 'text-sm leading-normal text-neutral-600 dark:text-neutral-400',
    },
  };

  return typography[persona];
}

/**
 * Layout utilities
 */
export const layout = {
  container: 'container-responsive',
  sidebar: 'w-64 sm:w-72 lg:w-80',
  main: 'flex-1 min-w-0',
  header: 'sticky top-0 z-30 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md',
  footer: 'mt-auto',
  card: 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-soft',
};

/**
 * Accessibility utilities
 */
export const a11y = {
  screenReader: 'sr-only',
  skipLink: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white px-4 py-2 rounded-md shadow-lg z-50',
  focusable: 'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900',
  touch: 'min-h-[44px] min-w-[44px]', // Minimum touch target size
  highContrast: 'contrast-more:border-black contrast-more:text-black dark:contrast-more:border-white dark:contrast-more:text-white',
};

/**
 * Performance utilities
 */
export const performance = {
  willChange: 'will-change-transform',
  gpu: 'transform-gpu',
  backfaceHidden: 'backface-hidden',
  isolate: 'isolate',
};

/**
 * Print utilities
 */
export const print = {
  hidden: 'print:hidden',
  visible: 'print:block',
  breakAfter: 'print:break-after-page',
  breakBefore: 'print:break-before-page',
  colors: 'print:text-black print:bg-white',
};