/**
 * Persona-Specific Component Variants
 *
 * Defines specific styling variants for components based on user personas:
 * - EndUser: Simple, accessible, customer-focused variants
 * - Agent: Productive, compact, workflow-optimized variants
 * - Manager: Executive, polished, insights-focused variants
 */

import { PersonaType, getPersonaTokens } from './tokens';
import { ThemeMode } from './themes';

export interface ComponentVariant {
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  density: 'compact' | 'comfortable' | 'spacious';
  borderRadius: 'sm' | 'md' | 'lg' | 'xl';
  shadow: 'none' | 'sm' | 'md' | 'lg';
  animation: 'none' | 'subtle' | 'smooth' | 'prominent';
  padding: 'tight' | 'normal' | 'relaxed';
  typography: 'compact' | 'comfortable' | 'large';
}

export interface PersonaVariants {
  // Basic UI components
  button: ComponentVariant & {
    weight: 'light' | 'medium' | 'bold';
    letterSpacing: 'tight' | 'normal' | 'wide';
  };

  card: ComponentVariant & {
    border: 'none' | 'subtle' | 'visible' | 'prominent';
    background: 'transparent' | 'subtle' | 'elevated';
  };

  input: ComponentVariant & {
    border: 'none' | 'subtle' | 'visible' | 'prominent';
    focusRing: 'subtle' | 'visible' | 'prominent';
  };

  // Layout components
  sidebar: {
    width: 'narrow' | 'medium' | 'wide';
    padding: 'tight' | 'normal' | 'relaxed';
    itemSpacing: 'compact' | 'comfortable' | 'spacious';
    iconSize: 'sm' | 'md' | 'lg';
  };

  header: {
    height: 'compact' | 'standard' | 'tall';
    padding: 'tight' | 'normal' | 'relaxed';
    searchBar: 'minimal' | 'standard' | 'prominent';
  };

  // Data display components
  table: {
    density: 'compact' | 'comfortable' | 'spacious';
    rowHeight: 'sm' | 'md' | 'lg';
    borderStyle: 'none' | 'subtle' | 'visible';
    hoverEffect: 'none' | 'subtle' | 'prominent';
  };

  // Interactive components
  dropdown: ComponentVariant & {
    maxHeight: 'small' | 'medium' | 'large';
    itemPadding: 'tight' | 'normal' | 'relaxed';
  };

  modal: ComponentVariant & {
    backdrop: 'light' | 'medium' | 'dark';
    maxWidth: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  };

  // Notification components
  toast: ComponentVariant & {
    position: 'top' | 'bottom' | 'center';
    duration: number;
  };

  // Dashboard components
  widget: ComponentVariant & {
    titleSize: 'sm' | 'md' | 'lg';
    contentPadding: 'tight' | 'normal' | 'relaxed';
  };

  // Form components
  form: {
    labelPosition: 'top' | 'left' | 'floating';
    fieldSpacing: 'tight' | 'normal' | 'relaxed';
    groupSpacing: 'compact' | 'comfortable' | 'spacious';
  };
}

// EndUser persona variants - Simple, accessible, customer-focused
const enduserVariants: PersonaVariants = {
  button: {
    size: 'lg',
    density: 'comfortable',
    borderRadius: 'lg',
    shadow: 'sm',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'comfortable',
    weight: 'medium',
    letterSpacing: 'normal',
  },

  card: {
    size: 'lg',
    density: 'spacious',
    borderRadius: 'xl',
    shadow: 'md',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'comfortable',
    border: 'subtle',
    background: 'elevated',
  },

  input: {
    size: 'lg',
    density: 'comfortable',
    borderRadius: 'lg',
    shadow: 'sm',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'comfortable',
    border: 'visible',
    focusRing: 'prominent',
  },

  sidebar: {
    width: 'wide',
    padding: 'relaxed',
    itemSpacing: 'spacious',
    iconSize: 'lg',
  },

  header: {
    height: 'tall',
    padding: 'relaxed',
    searchBar: 'prominent',
  },

  table: {
    density: 'comfortable',
    rowHeight: 'lg',
    borderStyle: 'subtle',
    hoverEffect: 'subtle',
  },

  dropdown: {
    size: 'lg',
    density: 'comfortable',
    borderRadius: 'lg',
    shadow: 'lg',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'comfortable',
    maxHeight: 'large',
    itemPadding: 'relaxed',
  },

  modal: {
    size: 'xl',
    density: 'spacious',
    borderRadius: 'xl',
    shadow: 'lg',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'large',
    backdrop: 'medium',
    maxWidth: 'lg',
  },

  toast: {
    size: 'lg',
    density: 'comfortable',
    borderRadius: 'lg',
    shadow: 'lg',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'comfortable',
    position: 'top',
    duration: 5000,
  },

  widget: {
    size: 'lg',
    density: 'spacious',
    borderRadius: 'xl',
    shadow: 'md',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'large',
    titleSize: 'lg',
    contentPadding: 'relaxed',
  },

  form: {
    labelPosition: 'top',
    fieldSpacing: 'relaxed',
    groupSpacing: 'spacious',
  },
};

// Agent persona variants - Productive, compact, workflow-optimized
const agentVariants: PersonaVariants = {
  button: {
    size: 'sm',
    density: 'compact',
    borderRadius: 'md',
    shadow: 'sm',
    animation: 'subtle',
    padding: 'tight',
    typography: 'compact',
    weight: 'medium',
    letterSpacing: 'tight',
  },

  card: {
    size: 'md',
    density: 'compact',
    borderRadius: 'md',
    shadow: 'sm',
    animation: 'subtle',
    padding: 'normal',
    typography: 'compact',
    border: 'visible',
    background: 'subtle',
  },

  input: {
    size: 'sm',
    density: 'compact',
    borderRadius: 'md',
    shadow: 'none',
    animation: 'subtle',
    padding: 'tight',
    typography: 'compact',
    border: 'visible',
    focusRing: 'visible',
  },

  sidebar: {
    width: 'narrow',
    padding: 'tight',
    itemSpacing: 'compact',
    iconSize: 'sm',
  },

  header: {
    height: 'compact',
    padding: 'tight',
    searchBar: 'standard',
  },

  table: {
    density: 'compact',
    rowHeight: 'sm',
    borderStyle: 'visible',
    hoverEffect: 'subtle',
  },

  dropdown: {
    size: 'sm',
    density: 'compact',
    borderRadius: 'md',
    shadow: 'md',
    animation: 'subtle',
    padding: 'tight',
    typography: 'compact',
    maxHeight: 'medium',
    itemPadding: 'tight',
  },

  modal: {
    size: 'lg',
    density: 'compact',
    borderRadius: 'lg',
    shadow: 'lg',
    animation: 'subtle',
    padding: 'normal',
    typography: 'compact',
    backdrop: 'light',
    maxWidth: 'xl',
  },

  toast: {
    size: 'sm',
    density: 'compact',
    borderRadius: 'md',
    shadow: 'md',
    animation: 'subtle',
    padding: 'tight',
    typography: 'compact',
    position: 'bottom',
    duration: 3000,
  },

  widget: {
    size: 'md',
    density: 'compact',
    borderRadius: 'lg',
    shadow: 'sm',
    animation: 'subtle',
    padding: 'normal',
    typography: 'compact',
    titleSize: 'md',
    contentPadding: 'tight',
  },

  form: {
    labelPosition: 'left',
    fieldSpacing: 'tight',
    groupSpacing: 'compact',
  },
};

// Manager persona variants - Executive, polished, insights-focused
const managerVariants: PersonaVariants = {
  button: {
    size: 'md',
    density: 'comfortable',
    borderRadius: 'lg',
    shadow: 'md',
    animation: 'smooth',
    padding: 'normal',
    typography: 'comfortable',
    weight: 'bold',
    letterSpacing: 'wide',
  },

  card: {
    size: 'lg',
    density: 'comfortable',
    borderRadius: 'xl',
    shadow: 'lg',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'comfortable',
    border: 'subtle',
    background: 'elevated',
  },

  input: {
    size: 'md',
    density: 'comfortable',
    borderRadius: 'lg',
    shadow: 'sm',
    animation: 'smooth',
    padding: 'normal',
    typography: 'comfortable',
    border: 'subtle',
    focusRing: 'visible',
  },

  sidebar: {
    width: 'wide',
    padding: 'normal',
    itemSpacing: 'comfortable',
    iconSize: 'md',
  },

  header: {
    height: 'standard',
    padding: 'normal',
    searchBar: 'standard',
  },

  table: {
    density: 'comfortable',
    rowHeight: 'md',
    borderStyle: 'subtle',
    hoverEffect: 'prominent',
  },

  dropdown: {
    size: 'md',
    density: 'comfortable',
    borderRadius: 'lg',
    shadow: 'lg',
    animation: 'smooth',
    padding: 'normal',
    typography: 'comfortable',
    maxHeight: 'large',
    itemPadding: 'normal',
  },

  modal: {
    size: 'xl',
    density: 'comfortable',
    borderRadius: 'xl',
    shadow: 'lg',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'comfortable',
    backdrop: 'dark',
    maxWidth: '2xl',
  },

  toast: {
    size: 'md',
    density: 'comfortable',
    borderRadius: 'lg',
    shadow: 'lg',
    animation: 'smooth',
    padding: 'normal',
    typography: 'comfortable',
    position: 'top',
    duration: 4000,
  },

  widget: {
    size: 'xl',
    density: 'comfortable',
    borderRadius: 'xl',
    shadow: 'lg',
    animation: 'smooth',
    padding: 'relaxed',
    typography: 'comfortable',
    titleSize: 'lg',
    contentPadding: 'relaxed',
  },

  form: {
    labelPosition: 'floating',
    fieldSpacing: 'normal',
    groupSpacing: 'comfortable',
  },
};

// Export persona variants
export const personaVariants = {
  enduser: enduserVariants,
  agent: agentVariants,
  manager: managerVariants,
} as const;

// Utility functions
export function getPersonaVariants(persona: PersonaType): PersonaVariants {
  return personaVariants[persona];
}

export function getComponentVariant<T extends keyof PersonaVariants>(
  persona: PersonaType,
  component: T
): PersonaVariants[T] {
  return personaVariants[persona][component];
}

// CSS class name generators
export function generateVariantClasses(persona: PersonaType, component: keyof PersonaVariants): Record<string, string> {
  const variant = getComponentVariant(persona, component);
  const classes: Record<string, string> = {};

  // Type guard to check if variant has ComponentVariant properties
  const hasComponentVariantProps = (v: unknown): v is ComponentVariant => {
    return (
      typeof v === 'object' &&
      v !== null &&
      'size' in v &&
      'density' in v &&
      'borderRadius' in v &&
      'shadow' in v &&
      'animation' in v &&
      'padding' in v &&
      'typography' in v
    );
  };

  if (!hasComponentVariantProps(variant)) {
    // For non-ComponentVariant types, return empty classes
    return classes;
  }

  // Size classes
  classes.size = `size-${variant.size}`;

  // Density classes
  classes.density = `density-${variant.density}`;

  // Border radius classes
  classes.borderRadius = `rounded-${variant.borderRadius}`;

  // Shadow classes
  classes.shadow = variant.shadow === 'none' ? 'shadow-none' : `shadow-${variant.shadow}`;

  // Animation classes
  classes.animation = `transition-${variant.animation}`;

  // Padding classes
  classes.padding = `p-${variant.padding}`;

  // Typography classes
  classes.typography = `text-${variant.typography}`;

  return classes;
}

// Responsive variant utilities
export interface ResponsiveVariant {
  mobile: Partial<ComponentVariant>;
  tablet: Partial<ComponentVariant>;
  desktop: Partial<ComponentVariant>;
}

export function getResponsiveVariant(persona: PersonaType, component: keyof PersonaVariants): ResponsiveVariant {
  const baseVariant = getComponentVariant(persona, component);

  // Type guard to check if variant has ComponentVariant properties
  const isComponentVariant = (v: unknown): v is ComponentVariant => {
    return (
      typeof v === 'object' &&
      v !== null &&
      'size' in v &&
      'density' in v &&
      'padding' in v &&
      'typography' in v
    );
  };

  // For non-ComponentVariant types, return the base variant for all breakpoints
  if (!isComponentVariant(baseVariant)) {
    return {
      mobile: {},
      tablet: {},
      desktop: {},
    };
  }

  switch (persona) {
    case 'enduser':
      return {
        mobile: {
          size: 'lg',
          padding: 'relaxed',
          typography: 'large',
        },
        tablet: baseVariant as Partial<ComponentVariant>,
        desktop: baseVariant as Partial<ComponentVariant>,
      };

    case 'agent':
      return {
        mobile: {
          size: 'md',
          padding: 'normal',
          density: 'comfortable',
        },
        tablet: baseVariant as Partial<ComponentVariant>,
        desktop: {
          ...(baseVariant as ComponentVariant),
          density: 'compact',
        },
      };

    case 'manager':
      return {
        mobile: {
          size: 'lg',
          padding: 'relaxed',
          typography: 'comfortable',
        },
        tablet: baseVariant as Partial<ComponentVariant>,
        desktop: {
          ...(baseVariant as ComponentVariant),
          size: 'xl',
        },
      };

    default:
      return {
        mobile: baseVariant as Partial<ComponentVariant>,
        tablet: baseVariant as Partial<ComponentVariant>,
        desktop: baseVariant as Partial<ComponentVariant>,
      };
  }
}

// Accessibility enhancements per persona
export interface AccessibilityConfig {
  focusRingWidth: string;
  minimumTargetSize: string;
  colorContrastRatio: number;
  reducedMotion: boolean;
  highContrast: boolean;
}

export function getPersonaA11yConfig(persona: PersonaType): AccessibilityConfig {
  const base: AccessibilityConfig = {
    focusRingWidth: '2px',
    minimumTargetSize: '44px',
    colorContrastRatio: 4.5,
    reducedMotion: false,
    highContrast: false,
  };

  switch (persona) {
    case 'enduser':
      return {
        ...base,
        focusRingWidth: '3px',
        minimumTargetSize: '48px',
        colorContrastRatio: 7, // AAA compliance
        reducedMotion: true,
        highContrast: true,
      };

    case 'agent':
      return {
        ...base,
        focusRingWidth: '2px',
        minimumTargetSize: '40px',
        colorContrastRatio: 4.5, // AA compliance
      };

    case 'manager':
      return {
        ...base,
        focusRingWidth: '2px',
        minimumTargetSize: '44px',
        colorContrastRatio: 4.5, // AA compliance
      };

    default:
      return base;
  }
}

// Performance optimization configs per persona
export interface PerformanceConfig {
  animationDuration: number;
  transitionDuration: number;
  debounceDelay: number;
  prefetchDelay: number;
  lazyLoadThreshold: number;
}

export function getPersonaPerformanceConfig(persona: PersonaType): PerformanceConfig {
  switch (persona) {
    case 'enduser':
      return {
        animationDuration: 300,
        transitionDuration: 200,
        debounceDelay: 300,
        prefetchDelay: 100,
        lazyLoadThreshold: 200,
      };

    case 'agent':
      return {
        animationDuration: 150,
        transitionDuration: 100,
        debounceDelay: 150,
        prefetchDelay: 50,
        lazyLoadThreshold: 100,
      };

    case 'manager':
      return {
        animationDuration: 250,
        transitionDuration: 150,
        debounceDelay: 200,
        prefetchDelay: 75,
        lazyLoadThreshold: 150,
      };

    default:
      return {
        animationDuration: 200,
        transitionDuration: 150,
        debounceDelay: 200,
        prefetchDelay: 100,
        lazyLoadThreshold: 150,
      };
  }
}