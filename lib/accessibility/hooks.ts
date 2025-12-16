/**
 * Accessibility Hooks
 * Custom hooks para gerenciar acessibilidade no ServiceDesk
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook para anunciar mensagens para screen readers
 *
 * @example
 * const announce = useAnnouncement();
 * announce('Ticket criado com sucesso', 'polite');
 * announce('Erro ao salvar', 'assertive');
 */
export function useAnnouncement() {
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Criar live region se não existir
    if (!liveRegionRef.current) {
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
      liveRegionRef.current = liveRegion;
    }

    return () => {
      // Cleanup
      if (liveRegionRef.current && document.body.contains(liveRegionRef.current)) {
        document.body.removeChild(liveRegionRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (liveRegionRef.current) {
      liveRegionRef.current.setAttribute('aria-live', priority);

      // Limpar primeiro para garantir que mudanças sejam detectadas
      liveRegionRef.current.textContent = '';

      // Pequeno delay para garantir que screen readers detectem a mudança
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = message;
        }
      }, 100);
    }
  }, []);

  return announce;
}

/**
 * Hook para gerenciar focus trap em modais
 *
 * @example
 * const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
 */
export function useFocusTrap<T extends HTMLElement>(
  isActive: boolean
) {
  const elementRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !elementRef.current) return;

    // Salvar elemento com foco atual
    previousFocusRef.current = document.activeElement as HTMLElement;

    const element = elementRef.current;
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focar primeiro elemento
    firstFocusable?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab: voltar
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab: avançar
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    element.addEventListener('keydown', handleTabKey as EventListener);

    return () => {
      element.removeEventListener('keydown', handleTabKey as EventListener);

      // Restaurar foco anterior
      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive]);

  return elementRef;
}

/**
 * Hook para detectar navegação por teclado
 * Adiciona classe 'user-is-tabbing' ao body quando Tab é pressionado
 *
 * @example
 * useKeyboardUser();
 */
export function useKeyboardUser() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.body.classList.add('user-is-tabbing');
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove('user-is-tabbing');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
}

/**
 * Hook para gerenciar atalhos de teclado
 *
 * @example
 * useKeyboardShortcut({ key: 'k', ctrlKey: true }, () => {
 *   openCommandPalette();
 * });
 */
export function useKeyboardShortcut(
  shortcut: {
    key: string;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  },
  callback: () => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { key, ctrlKey = false, shiftKey = false, altKey = false } = shortcut;

      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === ctrlKey &&
        e.shiftKey === shiftKey &&
        e.altKey === altKey
      ) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcut, callback]);
}

/**
 * Hook para detectar preferência de movimento reduzido
 *
 * @example
 * const prefersReducedMotion = usePrefersReducedMotion();
 *
 * if (!prefersReducedMotion) {
 *   // Aplicar animações
 * }
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook para gerenciar ID único para acessibilidade
 * Útil para aria-labelledby, aria-describedby, etc.
 *
 * @example
 * const id = useId('input');
 * // Retorna: "input-1", "input-2", etc.
 */
let idCounter = 0;

export function useId(prefix: string = 'id'): string {
  const [id] = useState(() => {
    idCounter += 1;
    return `${prefix}-${idCounter}`;
  });

  return id;
}

/**
 * Hook para gerenciar estado de loading com anúncio
 *
 * @example
 * const { isLoading, startLoading, stopLoading } = useLoadingState();
 *
 * startLoading('Salvando ticket...');
 * await saveTicket();
 * stopLoading('Ticket salvo com sucesso');
 */
export function useLoadingState() {
  const [isLoading, setIsLoading] = useState(false);
  const announce = useAnnouncement();

  const startLoading = useCallback((message?: string) => {
    setIsLoading(true);
    if (message) {
      announce(message, 'polite');
    }
  }, [announce]);

  const stopLoading = useCallback((message?: string) => {
    setIsLoading(false);
    if (message) {
      announce(message, 'polite');
    }
  }, [announce]);

  return {
    isLoading,
    startLoading,
    stopLoading,
  };
}

/**
 * Hook para gerenciar scroll e anunciar mudanças de página
 *
 * @example
 * usePageAnnouncement();
 */
export function usePageAnnouncement() {
  const announce = useAnnouncement();

  useEffect(() => {
    // Anunciar título da página quando ela muda
    const title = document.title;
    announce(`Navegou para ${title}`, 'polite');
  }, [announce]);
}

/**
 * Hook para validar contraste de cores
 * Retorna se o contraste é suficiente para WCAG AA
 *
 * @example
 * const isAccessible = useContrastChecker('#ffffff', '#000000');
 * // Retorna: true (21:1)
 */
export function useContrastChecker(
  foreground: string,
  background: string,
  largeText: boolean = false
): boolean {
  const [meetsStandard, setMeetsStandard] = useState(true);

  useEffect(() => {
    const getLuminance = (color: string): number => {
      // Converter hex para RGB
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      // Calcular luminância relativa
      const [rs, gs, bs] = [r, g, b].map(val => {
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });

      return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);

    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    // WCAG AA: 4.5:1 para texto normal, 3:1 para texto grande
    const minRatio = largeText ? 3 : 4.5;
    setMeetsStandard(ratio >= minRatio);
  }, [foreground, background, largeText]);

  return meetsStandard;
}

/**
 * Hook para gerenciar foco em elementos dinâmicos
 * Útil para focar primeiro elemento após criar/carregar conteúdo
 *
 * @example
 * const focusRef = useAutoFocus<HTMLInputElement>();
 * return <input ref={focusRef} />;
 */
export function useAutoFocus<T extends HTMLElement>() {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.focus();
    }
  }, []);

  return elementRef;
}

/**
 * Hook para detectar modo de alto contraste (Windows)
 *
 * @example
 * const isHighContrast = useHighContrastMode();
 */
export function useHighContrastMode(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isHighContrast;
}
