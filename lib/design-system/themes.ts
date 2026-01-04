/**
 * Design System Themes
 *
 * Complete theme definitions for light/dark modes across all personas:
 * - EndUser: Simple, accessible, customer-focused
 * - Agent: Productive, information-dense, workflow-optimized
 * - Manager: Executive, strategic, insights-focused
 */

import { colors, PersonaType, getPersonaTokens } from './tokens';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Background colors
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    elevated: string;
    overlay: string;
  };

  // Text colors
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
    muted: string;
  };

  // Border colors
  border: {
    primary: string;
    secondary: string;
    tertiary: string;
    focus: string;
    error: string;
    success: string;
    warning: string;
  };

  // Interactive colors
  interactive: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primaryDisabled: string;
    secondary: string;
    secondaryHover: string;
    ghost: string;
    ghostHover: string;
  };

  // Status colors
  status: {
    success: string;
    successBackground: string;
    warning: string;
    warningBackground: string;
    error: string;
    errorBackground: string;
    info: string;
    infoBackground: string;
  };

  // Priority colors
  priority: {
    low: string;
    lowBackground: string;
    medium: string;
    mediumBackground: string;
    high: string;
    highBackground: string;
    critical: string;
    criticalBackground: string;
  };

  // Ticket status colors
  ticketStatus: {
    open: string;
    openBackground: string;
    'in-progress': string;
    'in-progressBackground': string;
    resolved: string;
    resolvedBackground: string;
    closed: string;
    closedBackground: string;
    cancelled: string;
    cancelledBackground: string;
  };
}

export interface Theme {
  mode: ThemeMode;
  persona: PersonaType;
  colors: ThemeColors;
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    focus: string;
    inset: string;
  };
  opacity: {
    disabled: number;
    hover: number;
    active: number;
    overlay: number;
  };
}

// Light theme base colors
const lightColors: ThemeColors = {
  background: {
    primary: colors.neutral[50],
    secondary: colors.neutral[100],
    tertiary: colors.neutral[200],
    elevated: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[700],
    tertiary: colors.neutral[500],
    inverse: colors.neutral[50],
    muted: colors.neutral[400],
  },
  border: {
    primary: colors.neutral[200],
    secondary: colors.neutral[300],
    tertiary: colors.neutral[400],
    focus: colors.brand[500],
    error: colors.error[500],
    success: colors.success[500],
    warning: colors.warning[500],
  },
  interactive: {
    primary: colors.brand[500],
    primaryHover: colors.brand[600],
    primaryActive: colors.brand[700],
    primaryDisabled: colors.neutral[300],
    secondary: colors.neutral[200],
    secondaryHover: colors.neutral[300],
    ghost: 'transparent',
    ghostHover: colors.neutral[100],
  },
  status: {
    success: colors.success[600],
    successBackground: colors.success[50],
    warning: colors.warning[600],
    warningBackground: colors.warning[50],
    error: colors.error[600],
    errorBackground: colors.error[50],
    info: colors.brand[600],
    infoBackground: colors.brand[50],
  },
  priority: {
    low: colors.success[600],
    lowBackground: colors.success[50],
    medium: colors.warning[600],
    mediumBackground: colors.warning[50],
    high: colors.warning[700],
    highBackground: colors.warning[100],
    critical: colors.error[600],
    criticalBackground: colors.error[50],
  },
  ticketStatus: {
    open: colors.brand[600],
    openBackground: colors.brand[50],
    'in-progress': colors.warning[600],
    'in-progressBackground': colors.warning[50],
    resolved: colors.success[600],
    resolvedBackground: colors.success[50],
    closed: colors.neutral[600],
    closedBackground: colors.neutral[100],
    cancelled: colors.error[600],
    cancelledBackground: colors.error[50],
  },
};

// Dark theme base colors
const darkColors: ThemeColors = {
  background: {
    primary: colors.neutral[900],
    secondary: colors.neutral[800],
    tertiary: colors.neutral[700],
    elevated: colors.neutral[800],
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
  text: {
    primary: colors.neutral[100],
    secondary: colors.neutral[300],
    tertiary: colors.neutral[400],
    inverse: colors.neutral[900],
    muted: colors.neutral[500],
  },
  border: {
    primary: colors.neutral[700],
    secondary: colors.neutral[600],
    tertiary: colors.neutral[500],
    focus: colors.brand[400],
    error: colors.error[400],
    success: colors.success[400],
    warning: colors.warning[400],
  },
  interactive: {
    primary: colors.brand[400],
    primaryHover: colors.brand[300],
    primaryActive: colors.brand[200],
    primaryDisabled: colors.neutral[600],
    secondary: colors.neutral[700],
    secondaryHover: colors.neutral[600],
    ghost: 'transparent',
    ghostHover: colors.neutral[800],
  },
  status: {
    success: colors.success[400],
    successBackground: colors.success[950],
    warning: colors.warning[400],
    warningBackground: colors.warning[950],
    error: colors.error[400],
    errorBackground: colors.error[950],
    info: colors.brand[400],
    infoBackground: colors.brand[950],
  },
  priority: {
    low: colors.success[400],
    lowBackground: colors.success[950],
    medium: colors.warning[400],
    mediumBackground: colors.warning[950],
    high: colors.warning[300],
    highBackground: colors.warning[900],
    critical: colors.error[400],
    criticalBackground: colors.error[950],
  },
  ticketStatus: {
    open: colors.brand[400],
    openBackground: colors.brand[950],
    'in-progress': colors.warning[400],
    'in-progressBackground': colors.warning[950],
    resolved: colors.success[400],
    resolvedBackground: colors.success[950],
    closed: colors.neutral[400],
    closedBackground: colors.neutral[800],
    cancelled: colors.error[400],
    cancelledBackground: colors.error[950],
  },
};

// Persona-specific theme adjustments
function getPersonaColorAdjustments(persona: PersonaType, baseColors: ThemeColors, mode: ThemeMode): Partial<ThemeColors> {
  const personaTokens = getPersonaTokens(persona);

  switch (persona) {
    case 'enduser':
      return {
        interactive: {
          ...baseColors.interactive,
          primary: mode === 'light' ? colors.brand[500] : colors.brand[400],
          primaryHover: mode === 'light' ? colors.brand[600] : colors.brand[300],
        },
        border: {
          ...baseColors.border,
          // Softer borders for end users
          primary: mode === 'light' ? colors.neutral[200] : colors.neutral[700],
        },
      };

    case 'agent':
      return {
        interactive: {
          ...baseColors.interactive,
          primary: mode === 'light' ? colors.brand[600] : colors.brand[400],
          primaryHover: mode === 'light' ? colors.brand[700] : colors.brand[300],
        },
        border: {
          ...baseColors.border,
          // More defined borders for agent productivity
          primary: mode === 'light' ? colors.neutral[300] : colors.neutral[600],
        },
        text: {
          ...baseColors.text,
          // Higher contrast for agent workflow
          primary: mode === 'light' ? colors.neutral[900] : colors.neutral[50],
        },
      };

    case 'manager':
      return {
        interactive: {
          ...baseColors.interactive,
          primary: mode === 'light' ? colors.brand[700] : colors.brand[300],
          primaryHover: mode === 'light' ? colors.brand[800] : colors.brand[200],
        },
        text: {
          ...baseColors.text,
          // Executive-focused text hierarchy
          primary: mode === 'light' ? colors.neutral[900] : colors.neutral[50],
          secondary: mode === 'light' ? colors.neutral[600] : colors.neutral[300],
        },
      };

    default:
      return {};
  }
}

// Shadow definitions
const shadows = {
  light: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    focus: `0 0 0 3px ${colors.brand[500]}40`,
    inset: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
  dark: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
    focus: `0 0 0 3px ${colors.brand[400]}40`,
    inset: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
  },
};

// Opacity values
const opacity = {
  disabled: 0.5,
  hover: 0.8,
  active: 0.7,
  overlay: 0.5,
};

// Theme factory function
export function createTheme(mode: ThemeMode, persona: PersonaType): Theme {
  const baseColors = mode === 'light' ? lightColors : darkColors;
  const personaAdjustments = getPersonaColorAdjustments(persona, baseColors, mode);

  return {
    mode,
    persona,
    colors: {
      ...baseColors,
      ...personaAdjustments,
    } as ThemeColors,
    shadows: shadows[mode],
    opacity,
  };
}

// Pre-defined themes
export const themes = {
  // Light themes
  enduserLight: createTheme('light', 'enduser'),
  agentLight: createTheme('light', 'agent'),
  managerLight: createTheme('light', 'manager'),

  // Dark themes
  enduserDark: createTheme('dark', 'enduser'),
  agentDark: createTheme('dark', 'agent'),
  managerDark: createTheme('dark', 'manager'),
} as const;

// Theme utilities
export function getTheme(mode: ThemeMode, persona: PersonaType): Theme {
  const key = `${persona}${mode.charAt(0).toUpperCase() + mode.slice(1)}` as keyof typeof themes;
  return themes[key];
}

export function getThemeKey(mode: ThemeMode, persona: PersonaType): string {
  return `${persona}-${mode}`;
}

// CSS custom properties generator
export function generateCSSVariables(theme: Theme): Record<string, string> {
  const cssVars: Record<string, string> = {};

  // Background colors
  cssVars['--bg-primary'] = theme.colors.background.primary;
  cssVars['--bg-secondary'] = theme.colors.background.secondary;
  cssVars['--bg-tertiary'] = theme.colors.background.tertiary;
  cssVars['--bg-elevated'] = theme.colors.background.elevated;
  cssVars['--bg-overlay'] = theme.colors.background.overlay;

  // Text colors
  cssVars['--text-primary'] = theme.colors.text.primary;
  cssVars['--text-secondary'] = theme.colors.text.secondary;
  cssVars['--text-tertiary'] = theme.colors.text.tertiary;
  cssVars['--text-inverse'] = theme.colors.text.inverse;
  cssVars['--text-muted'] = theme.colors.text.muted;

  // Border colors
  cssVars['--border-primary'] = theme.colors.border.primary;
  cssVars['--border-secondary'] = theme.colors.border.secondary;
  cssVars['--border-tertiary'] = theme.colors.border.tertiary;
  cssVars['--border-focus'] = theme.colors.border.focus;

  // Interactive colors
  cssVars['--interactive-primary'] = theme.colors.interactive.primary;
  cssVars['--interactive-primary-hover'] = theme.colors.interactive.primaryHover;
  cssVars['--interactive-primary-active'] = theme.colors.interactive.primaryActive;
  cssVars['--interactive-primary-disabled'] = theme.colors.interactive.primaryDisabled;

  // Status colors
  cssVars['--status-success'] = theme.colors.status.success;
  cssVars['--status-success-bg'] = theme.colors.status.successBackground;
  cssVars['--status-warning'] = theme.colors.status.warning;
  cssVars['--status-warning-bg'] = theme.colors.status.warningBackground;
  cssVars['--status-error'] = theme.colors.status.error;
  cssVars['--status-error-bg'] = theme.colors.status.errorBackground;
  cssVars['--status-info'] = theme.colors.status.info;
  cssVars['--status-info-bg'] = theme.colors.status.infoBackground;

  // Priority colors
  cssVars['--priority-low'] = theme.colors.priority.low;
  cssVars['--priority-low-bg'] = theme.colors.priority.lowBackground;
  cssVars['--priority-medium'] = theme.colors.priority.medium;
  cssVars['--priority-medium-bg'] = theme.colors.priority.mediumBackground;
  cssVars['--priority-high'] = theme.colors.priority.high;
  cssVars['--priority-high-bg'] = theme.colors.priority.highBackground;
  cssVars['--priority-critical'] = theme.colors.priority.critical;
  cssVars['--priority-critical-bg'] = theme.colors.priority.criticalBackground;

  // Shadows
  cssVars['--shadow-sm'] = theme.shadows.sm;
  cssVars['--shadow-md'] = theme.shadows.md;
  cssVars['--shadow-lg'] = theme.shadows.lg;
  cssVars['--shadow-xl'] = theme.shadows.xl;
  cssVars['--shadow-focus'] = theme.shadows.focus;
  cssVars['--shadow-inset'] = theme.shadows.inset;

  // Opacity
  cssVars['--opacity-disabled'] = theme.opacity.disabled.toString();
  cssVars['--opacity-hover'] = theme.opacity.hover.toString();
  cssVars['--opacity-active'] = theme.opacity.active.toString();
  cssVars['--opacity-overlay'] = theme.opacity.overlay.toString();

  return cssVars;
}

// Export default themes for easy access
export const defaultThemes = {
  enduser: themes.enduserLight,
  agent: themes.agentLight,
  manager: themes.managerLight,
} as const;