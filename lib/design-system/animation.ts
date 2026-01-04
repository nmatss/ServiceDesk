/**
 * Animation Duration Constants
 * Provides consistent animation durations across the application
 * Following the design system guidelines
 */

export const animationDurations = {
  /** Fast animations (150ms) - For hover states and simple transitions */
  fast: 'duration-150',

  /** Normal animations (300ms) - For most UI interactions */
  normal: 'duration-300',

  /** Slow animations (500ms) - For complex transitions and modals */
  slow: 'duration-500',
} as const;

export const animationEasings = {
  /** Ease in-out - For smooth start and end */
  inOut: 'ease-in-out',

  /** Ease in - For accelerating animations */
  in: 'ease-in',

  /** Ease out - For decelerating animations */
  out: 'ease-out',
} as const;

/**
 * Utility function to create transition classes
 * @param duration - The duration constant to use
 * @param easing - The easing constant to use (default: 'inOut')
 * @returns Complete transition class string
 */
export function createTransition(
  duration: keyof typeof animationDurations = 'normal',
  easing: keyof typeof animationEasings = 'inOut'
): string {
  return `transition-all ${animationDurations[duration]} ${animationEasings[easing]}`;
}

/**
 * Pre-built transition combinations for common use cases
 */
export const transitions = {
  /** Button hover states */
  button: `transition-all ${animationDurations.fast} ${animationEasings.inOut}`,

  /** Card hover and interactions */
  card: `transition-all ${animationDurations.normal} ${animationEasings.inOut}`,

  /** Modal and overlay animations */
  modal: `transition-all ${animationDurations.slow} ${animationEasings.inOut}`,

  /** Color transitions only */
  color: `transition-colors ${animationDurations.fast} ${animationEasings.inOut}`,

  /** Transform transitions only */
  transform: `transition-transform ${animationDurations.normal} ${animationEasings.out}`,

  /** Opacity transitions */
  opacity: `transition-opacity ${animationDurations.normal} ${animationEasings.inOut}`,
} as const;

export default {
  durations: animationDurations,
  easings: animationEasings,
  createTransition,
  transitions,
};
