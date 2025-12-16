const { colors, typography, spacing, borderRadius, boxShadow, breakpoints, zIndex, sizes } = require('./lib/design-system/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // JIT mode enabled by default in Tailwind CSS 3+
  // Optimized content paths for faster builds
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',

  // Performance optimizations
  future: {
    hoverOnlyWhenSupported: true, // Only enable hover on devices that support it
  },

  // Mobile-first optimizations
  experimental: {
    optimizeUniversalDefaults: true
  },
  theme: {
    extend: {
      // Import design tokens as extended colors (preserving Tailwind defaults)
      colors: {
        ...colors,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Glassmorphism Colors
        glass: {
          border: "rgba(var(--glass-border), var(--glass-opacity-heavy))",
          surface: "rgba(var(--glass-surface), var(--glass-opacity))",
          highlight: "rgba(255, 255, 255, 0.1)",
        },
      },
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      letterSpacing: typography.letterSpacing,
      spacing,
      borderRadius,
      boxShadow,
      screens: breakpoints,
      zIndex,

      // Persona-specific component sizes
      componentSizes: sizes,

      // CSS custom properties for dynamic theming
      backgroundColor: {
        'persona-primary': 'var(--bg-primary)',
        'persona-secondary': 'var(--bg-secondary)',
        'persona-tertiary': 'var(--bg-tertiary)',
        'persona-elevated': 'var(--bg-elevated)',
        'persona-overlay': 'var(--bg-overlay)',
      },

      textColor: {
        'persona-primary': 'var(--text-primary)',
        'persona-secondary': 'var(--text-secondary)',
        'persona-tertiary': 'var(--text-tertiary)',
        'persona-inverse': 'var(--text-inverse)',
        'persona-muted': 'var(--text-muted)',
      },

      borderColor: {
        'persona-primary': 'var(--border-primary)',
        'persona-secondary': 'var(--border-secondary)',
        'persona-tertiary': 'var(--border-tertiary)',
        'persona-focus': 'var(--border-focus)',
      },

      ringColor: {
        'persona-focus': 'var(--border-focus)',
      },

      // Interactive colors using CSS variables
      colors: {
        'interactive-primary': 'var(--interactive-primary)',
        'interactive-primary-hover': 'var(--interactive-primary-hover)',
        'interactive-primary-active': 'var(--interactive-primary-active)',
        'interactive-primary-disabled': 'var(--interactive-primary-disabled)',

        'status-success': 'var(--status-success)',
        'status-success-bg': 'var(--status-success-bg)',
        'status-warning': 'var(--status-warning)',
        'status-warning-bg': 'var(--status-warning-bg)',
        'status-error': 'var(--status-error)',
        'status-error-bg': 'var(--status-error-bg)',
        'status-info': 'var(--status-info)',
        'status-info-bg': 'var(--status-info-bg)',

        'priority-low': 'var(--priority-low)',
        'priority-low-bg': 'var(--priority-low-bg)',
        'priority-medium': 'var(--priority-medium)',
        'priority-medium-bg': 'var(--priority-medium-bg)',
        'priority-high': 'var(--priority-high)',
        'priority-high-bg': 'var(--priority-high-bg)',
        'priority-critical': 'var(--priority-critical)',
        'priority-critical-bg': 'var(--priority-critical-bg)',
      },

      // Persona-specific spacing
      space: {
        'persona-xs': 'var(--spacing-xs)',
        'persona-sm': 'var(--spacing-sm)',
        'persona-md': 'var(--spacing-md)',
        'persona-lg': 'var(--spacing-lg)',
        'persona-xl': 'var(--spacing-xl)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
        'gradient-success': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        'gradient-warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-error': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'large': '0 10px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      // Persona-aware animations
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-in-fast': 'fadeIn 0.15s ease-in-out',
        'fade-in-slow': 'fadeIn 0.75s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-up-fast': 'slideUp 0.15s ease-out',
        'slide-up-slow': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'scale-in-fast': 'scaleIn 0.1s ease-out',
        'scale-in-slow': 'scaleIn 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },

      // Persona-specific utilities
      utilities: {
        '.persona-enduser': {
          '--spacing-xs': '0.75rem',
          '--spacing-sm': '1rem',
          '--spacing-md': '1.5rem',
          '--spacing-lg': '2rem',
          '--spacing-xl': '3rem',
        },
        '.persona-agent': {
          '--spacing-xs': '0.5rem',
          '--spacing-sm': '0.75rem',
          '--spacing-md': '1rem',
          '--spacing-lg': '1.5rem',
          '--spacing-xl': '2rem',
        },
        '.persona-manager': {
          '--spacing-xs': '0.625rem',
          '--spacing-sm': '1rem',
          '--spacing-md': '1.25rem',
          '--spacing-lg': '1.75rem',
          '--spacing-xl': '2.5rem',
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      screens: {
        'xs': '475px',
        '3xl': '1600px',
      },

      // Safe area insets for notched devices
      padding: {
        'safe': 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-right': 'env(safe-area-inset-right)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
      },

      // Touch target sizes (WCAG 2.5.5)
      minHeight: {
        'touch': '44px',
        'touch-sm': '36px',
        'touch-lg': '48px',
      },
      minWidth: {
        'touch': '44px',
        'touch-sm': '36px',
        'touch-lg': '48px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),

    // Custom plugin for persona-specific utilities
    function ({ addUtilities, addComponents, theme }) {
      // Persona component classes
      addComponents({
        '.btn-persona-enduser': {
          '@apply px-6 py-3 text-lg font-medium rounded-lg shadow-sm transition-all duration-300 ease-out': {},
          '@apply bg-interactive-primary text-white hover:bg-interactive-primary-hover': {},
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:ring-offset-2': {},
          '@apply disabled:bg-interactive-primary-disabled disabled:cursor-not-allowed': {},
        },
        '.btn-persona-agent': {
          '@apply px-3 py-1.5 text-sm font-medium rounded-md shadow-sm transition-all duration-150 ease-in-out': {},
          '@apply bg-interactive-primary text-white hover:bg-interactive-primary-hover': {},
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:ring-offset-1': {},
          '@apply disabled:bg-interactive-primary-disabled disabled:cursor-not-allowed': {},
        },
        '.btn-persona-manager': {
          '@apply px-5 py-2.5 text-base font-bold rounded-lg shadow-md transition-all duration-200 ease-out': {},
          '@apply bg-interactive-primary text-white hover:bg-interactive-primary-hover': {},
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:ring-offset-2': {},
          '@apply disabled:bg-interactive-primary-disabled disabled:cursor-not-allowed': {},
          '@apply tracking-wide': {},
        },

        '.card-persona-enduser': {
          '@apply bg-white dark:bg-gray-800 border border-persona-primary rounded-xl shadow-lg p-6': {},
          '@apply transition-all duration-300 ease-out hover:shadow-xl': {},
        },
        '.card-persona-agent': {
          '@apply bg-white dark:bg-gray-800 border border-persona-secondary rounded-md shadow-sm p-4': {},
          '@apply transition-all duration-150 ease-in-out hover:shadow-md': {},
        },
        '.card-persona-manager': {
          '@apply bg-white dark:bg-gray-800 border border-persona-primary rounded-xl shadow-lg p-6': {},
          '@apply transition-all duration-200 ease-out hover:shadow-xl': {},
        },

        '.input-persona-enduser': {
          '@apply w-full px-4 py-3 text-base border border-persona-secondary rounded-lg': {},
          '@apply bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500': {},
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:border-persona-focus': {},
          '@apply transition-all duration-300 ease-out': {},
        },
        '.input-persona-agent': {
          '@apply w-full px-3 py-1.5 text-sm border border-persona-secondary rounded-md': {},
          '@apply bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500': {},
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:border-persona-focus': {},
          '@apply transition-all duration-150 ease-in-out': {},
        },
        '.input-persona-manager': {
          '@apply w-full px-4 py-2.5 text-base border border-persona-primary rounded-lg': {},
          '@apply bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500': {},
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:border-persona-focus': {},
          '@apply transition-all duration-200 ease-out': {},
        },
      });

      // Persona utility classes
      addUtilities({
        '.density-compact': {
          '@apply space-y-2': {},
        },
        '.density-comfortable': {
          '@apply space-y-4': {},
        },
        '.density-spacious': {
          '@apply space-y-6': {},
        },

        '.text-compact': {
          '@apply text-sm leading-tight': {},
        },
        '.text-comfortable': {
          '@apply text-base leading-relaxed': {},
        },
        '.text-large': {
          '@apply text-lg leading-relaxed': {},
        },

        '.transition-subtle': {
          '@apply transition-all duration-150 ease-in-out': {},
        },
        '.transition-smooth': {
          '@apply transition-all duration-300 ease-out': {},
        },
        '.transition-prominent': {
          '@apply transition-all duration-500 ease-in-out': {},
        },

        // Accessibility utilities
        '.focus-ring-enduser': {
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:ring-offset-2': {},
        },
        '.focus-ring-agent': {
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:ring-offset-1': {},
        },
        '.focus-ring-manager': {
          '@apply focus:outline-none focus:ring-2 focus:ring-persona-focus focus:ring-offset-2': {},
        },

        // Minimum target sizes for accessibility
        '.min-target-enduser': {
          '@apply min-h-[48px] min-w-[48px]': {},
        },
        '.min-target-agent': {
          '@apply min-h-[40px] min-w-[40px]': {},
        },
        '.min-target-manager': {
          '@apply min-h-[44px] min-w-[44px]': {},
        },

        // High contrast mode utilities
        '.high-contrast': {
          filter: 'contrast(1.25) saturate(1.25)',
        },

        // Reduced motion utilities
        '.motion-safe:animate-none': {
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none !important',
          },
        },
        '.motion-safe:transition-none': {
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none !important',
          },
        },

        // Mobile-specific utilities
        '.safe-area-bottom': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.safe-area-top': {
          paddingTop: 'env(safe-area-inset-top)',
        },

        // Remove 300ms tap delay on mobile
        '.tap-highlight-transparent': {
          '-webkit-tap-highlight-color': 'transparent',
        },

        // Smooth scrolling for mobile
        '.scroll-smooth-mobile': {
          '-webkit-overflow-scrolling': 'touch',
          scrollBehavior: 'smooth',
        },

        // Touch-friendly scrollbars
        '.scrollbar-thin': {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(0, 0, 0, 0.3)',
          },
        },

        // Prevent text selection on touch
        '.select-none-touch': {
          '@media (hover: none)': {
            userSelect: 'none',
            '-webkit-user-select': 'none',
          },
        },

        // Active state for mobile
        '.active-scale': {
          '@media (hover: none)': {
            '&:active': {
              transform: 'scale(0.98)',
            },
          },
        },
      });
    },
  ],
}
