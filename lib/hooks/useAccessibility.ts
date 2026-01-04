'use client';

import { useEffect, useRef, useCallback } from 'react';
import { KeyboardNavigation, ScreenReaderUtils } from '@/lib/a11y/accessibility-checker';

/**
 * Hook for focus trap functionality (for modals, dialogs, etc.)
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Save current focus
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first element
    const focusableElements = KeyboardNavigation.getFocusableElements(containerRef.current);
    focusableElements[0]?.focus();

    // Create focus trap
    const cleanup = KeyboardNavigation.createFocusTrap(containerRef.current);

    return () => {
      cleanup();
      // Restore previous focus
      previousActiveElement.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for announcing messages to screen readers
 */
export function useAnnouncer() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    ScreenReaderUtils.announce(message, priority);
  }, []);

  return announce;
}

/**
 * Hook for keyboard navigation (Arrow keys, Enter, Escape)
 */
export function useKeyboardNavigation(
  onEnter?: () => void,
  onEscape?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          onEnter?.();
          break;
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onArrowDown?.();
          break;
      }
    },
    [onEnter, onEscape, onArrowUp, onArrowDown]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook to detect reduced motion preference
 */
export function useReducedMotion() {
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion.current;
}

/**
 * Hook to manage ARIA live regions
 */
export function useAriaLiveRegion() {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, assertive = false) => {
    if (!liveRegionRef.current) return;

    liveRegionRef.current.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    liveRegionRef.current.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = '';
      }
    }, 1000);
  }, []);

  return { liveRegionRef, announce };
}

/**
 * Hook to ensure unique IDs for form fields
 */
export function useUniqueId(prefix = 'field') {
  const idRef = useRef<string>('');

  if (!idRef.current) {
    idRef.current = `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  return idRef.current;
}

/**
 * Hook to detect if user prefers high contrast
 */
export function useHighContrast() {
  const prefersHighContrast = useRef(false);

  useEffect(() => {
    // Check for Windows High Contrast Mode
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    prefersHighContrast.current = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      prefersHighContrast.current = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersHighContrast.current;
}
