/**
 * Accessibility Checker Utilities for WCAG 2.1 AA Compliance
 *
 * This module provides utilities to check and validate accessibility
 * features in the ServiceDesk application.
 */

/**
 * Color Contrast Checker
 * Calculates contrast ratio between two colors and checks WCAG compliance
 */
export class ContrastChecker {
  /**
   * Convert hex color to RGB
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Calculate relative luminance
   * Formula from WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
   */
  private static getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   * @param color1 Hex color (e.g., "#ffffff")
   * @param color2 Hex color (e.g., "#000000")
   * @returns Contrast ratio (1-21)
   */
  static calculateContrast(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    if (!rgb1 || !rgb2) {
      throw new Error('Invalid color format. Use hex colors (e.g., #ffffff)');
    }

    const lum1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Check if contrast ratio meets WCAG standards
   * @param ratio Contrast ratio
   * @param level 'AA' or 'AAA'
   * @param isLargeText Whether text is large (18pt+ or 14pt+ bold)
   */
  static meetsWCAG(ratio: number, level: 'AA' | 'AAA' = 'AA', isLargeText = false): boolean {
    if (level === 'AAA') {
      return isLargeText ? ratio >= 4.5 : ratio >= 7;
    }
    // AA level
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
  }

  /**
   * Check contrast and return detailed results
   */
  static checkContrast(
    foreground: string,
    background: string,
    isLargeText = false
  ): {
    ratio: number;
    passes: {
      AA: boolean;
      AAA: boolean;
    };
    recommendation: string;
  } {
    const ratio = this.calculateContrast(foreground, background);

    return {
      ratio: Math.round(ratio * 100) / 100,
      passes: {
        AA: this.meetsWCAG(ratio, 'AA', isLargeText),
        AAA: this.meetsWCAG(ratio, 'AAA', isLargeText),
      },
      recommendation: this.meetsWCAG(ratio, 'AA', isLargeText)
        ? 'Contraste adequado ✅'
        : `Contraste insuficiente. Mínimo necessário: ${isLargeText ? '3:1' : '4.5:1'}`,
    };
  }
}

/**
 * Accessibility Validator
 * Client-side validation of accessibility features
 */
export class A11yValidator {
  /**
   * Check if element has accessible name
   */
  static hasAccessibleName(element: HTMLElement): boolean {
    return !!(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent?.trim() ||
      (element instanceof HTMLInputElement && element.labels?.length)
    );
  }

  /**
   * Check if interactive element has accessible name
   */
  static validateInteractiveElement(element: HTMLElement): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for accessible name
    if (!this.hasAccessibleName(element)) {
      issues.push('Elemento interativo sem nome acessível');
    }

    // Check for keyboard accessibility
    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex === '-1' && !element.hasAttribute('aria-hidden')) {
      issues.push('Elemento não acessível por teclado');
    }

    // Check buttons
    if (element.tagName === 'BUTTON' && element.getAttribute('type') === null) {
      issues.push('Botão sem atributo type (recomendado: type="button")');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Check form field accessibility
   */
  static validateFormField(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for label
    if (!element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
      issues.push('Campo de formulário sem label');
    }

    // Check for error message association
    if (element.getAttribute('aria-invalid') === 'true' && !element.getAttribute('aria-describedby')) {
      issues.push('Campo com erro sem mensagem de erro associada (aria-describedby)');
    }

    // Check autocomplete for common fields
    if (element instanceof HTMLInputElement) {
      const type = element.type;
      if (['email', 'tel', 'url', 'text'].includes(type) && !element.getAttribute('autocomplete')) {
        issues.push('Campo sem atributo autocomplete (melhora UX e acessibilidade)');
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Scan page for common accessibility issues
   */
  static scanPage(): {
    totalIssues: number;
    issues: Array<{
      severity: 'error' | 'warning';
      message: string;
      element?: string;
    }>;
  } {
    const issues: Array<{
      severity: 'error' | 'warning';
      message: string;
      element?: string;
    }> = [];

    // Check for images without alt text
    document.querySelectorAll('img').forEach((img) => {
      if (!img.hasAttribute('alt')) {
        issues.push({
          severity: 'error',
          message: 'Imagem sem atributo alt',
          element: img.src,
        });
      }
    });

    // Check for buttons without accessible names
    document.querySelectorAll('button').forEach((button) => {
      if (!this.hasAccessibleName(button)) {
        issues.push({
          severity: 'error',
          message: 'Botão sem nome acessível',
          element: button.outerHTML.substring(0, 100),
        });
      }
    });

    // Check for form inputs without labels
    document.querySelectorAll('input, textarea, select').forEach((field) => {
      const input = field as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (input.type !== 'hidden') {
        const validation = this.validateFormField(input);
        validation.issues.forEach((issue) => {
          issues.push({
            severity: 'warning',
            message: issue,
            element: input.id || input.name,
          });
        });
      }
    });

    // Check for skip links
    const skipLink = document.querySelector('a[href="#main-content"]');
    if (!skipLink) {
      issues.push({
        severity: 'warning',
        message: 'Nenhum link de "pular para conteúdo" encontrado',
      });
    }

    // Check for landmark regions
    const hasMain = document.querySelector('main');
    if (!hasMain) {
      issues.push({
        severity: 'error',
        message: 'Nenhuma região <main> encontrada',
      });
    }

    return {
      totalIssues: issues.length,
      issues,
    };
  }
}

/**
 * Screen Reader Utilities
 * Utilities to work with screen readers
 */
export class ScreenReaderUtils {
  /**
   * Announce message to screen readers
   */
  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcer = document.getElementById('a11y-announcer') || this.createAnnouncer();
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }

  /**
   * Create hidden announcer element
   */
  private static createAnnouncer(): HTMLElement {
    const announcer = document.createElement('div');
    announcer.id = 'a11y-announcer';
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
    return announcer;
  }
}

/**
 * Keyboard Navigation Utilities
 */
export class KeyboardNavigation {
  /**
   * Get all focusable elements within a container
   */
  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    return Array.from(container.querySelectorAll(selector));
  }

  /**
   * Focus trap for modals
   */
  static createFocusTrap(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);

    // Return cleanup function
    return () => {
      document.removeEventListener('keydown', handleTab);
    };
  }
}

/**
 * Export all utilities
 */
export const A11y = {
  ContrastChecker,
  A11yValidator,
  ScreenReaderUtils,
  KeyboardNavigation,
};

export default A11y;
