/**
 * Accessibility Utilities
 * Funções utilitárias para melhorar acessibilidade no ServiceDesk
 */

/**
 * Gera ID único para elementos relacionados (aria-labelledby, aria-describedby)
 */
let uniqueIdCounter = 0;
export function generateId(prefix: string = 'a11y'): string {
  uniqueIdCounter += 1;
  return `${prefix}-${uniqueIdCounter}-${Date.now()}`;
}

/**
 * Verifica se um elemento é focável
 */
export function isFocusable(element: HTMLElement): boolean {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  return focusableSelectors.some(selector => element.matches(selector));
}

/**
 * Obtém todos os elementos focáveis dentro de um container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
}

/**
 * Move o foco para o próximo elemento focável
 */
export function focusNextElement(currentElement?: HTMLElement): void {
  const focusableElements = getFocusableElements(document.body);

  if (focusableElements.length === 0) return;

  if (!currentElement) {
    focusableElements[0]?.focus();
    return;
  }

  const currentIndex = focusableElements.indexOf(currentElement);
  const nextIndex = (currentIndex + 1) % focusableElements.length;
  focusableElements[nextIndex]?.focus();
}

/**
 * Move o foco para o elemento focável anterior
 */
export function focusPreviousElement(currentElement?: HTMLElement): void {
  const focusableElements = getFocusableElements(document.body);

  if (focusableElements.length === 0) return;

  if (!currentElement) {
    focusableElements[focusableElements.length - 1]?.focus();
    return;
  }

  const currentIndex = focusableElements.indexOf(currentElement);
  const prevIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
  focusableElements[prevIndex]?.focus();
}

/**
 * Cria uma live region para anúncios
 */
export function createLiveRegion(priority: 'polite' | 'assertive' = 'polite'): HTMLDivElement {
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  document.body.appendChild(liveRegion);
  return liveRegion;
}

/**
 * Anuncia uma mensagem para screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const liveRegion = createLiveRegion(priority);
  liveRegion.textContent = message;

  // Remover após 1 segundo
  setTimeout(() => {
    if (document.body.contains(liveRegion)) {
      document.body.removeChild(liveRegion);
    }
  }, 1000);
}

/**
 * Calcula a luminância relativa de uma cor
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function getRelativeLuminance(color: string): number {
  // Remove #
  const hex = color.replace('#', '');

  // Converte para RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  // Aplica fórmula de luminância
  const [rs, gs, bs] = [r, g, b].map(val => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

/**
 * Calcula o contraste entre duas cores
 * https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 */
export function getContrastRatio(foreground: string, background: string): number {
  const l1 = getRelativeLuminance(foreground);
  const l2 = getRelativeLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Verifica se o contraste atende aos padrões WCAG
 */
export function meetsContrastStandards(
  foreground: string,
  background: string,
  options: {
    level?: 'AA' | 'AAA';
    largeText?: boolean;
  } = {}
): boolean {
  const { level = 'AA', largeText = false } = options;

  const ratio = getContrastRatio(foreground, background);

  if (level === 'AA') {
    return largeText ? ratio >= 3 : ratio >= 4.5;
  } else {
    // AAA
    return largeText ? ratio >= 4.5 : ratio >= 7;
  }
}

/**
 * Detecta se o usuário prefere movimento reduzido
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Detecta se o usuário prefere modo escuro
 */
export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Detecta se o usuário está em modo de alto contraste
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-contrast: more)').matches;
}

/**
 * Gera um aria-label descritivo para botões de fechar
 */
export function getCloseButtonLabel(context?: string): string {
  return context ? `Fechar ${context}` : 'Fechar';
}

/**
 * Gera um aria-label descritivo para botões de ação
 */
export function getActionButtonLabel(action: string, target?: string): string {
  return target ? `${action} ${target}` : action;
}

/**
 * Formata data para screen readers
 */
export function formatDateForScreenReader(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(dateObj);
}

/**
 * Formata número para screen readers
 */
export function formatNumberForScreenReader(num: number): string {
  return new Intl.NumberFormat('pt-BR').format(num);
}

/**
 * Gera descrição acessível para status de ticket
 */
export function getTicketStatusDescription(status: string): string {
  const statusMap: Record<string, string> = {
    open: 'Ticket em aberto',
    'in-progress': 'Ticket em andamento',
    resolved: 'Ticket resolvido',
    closed: 'Ticket fechado',
    cancelled: 'Ticket cancelado',
  };

  return statusMap[status] || status;
}

/**
 * Gera descrição acessível para prioridade de ticket
 */
export function getPriorityDescription(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: 'Prioridade baixa',
    medium: 'Prioridade média',
    high: 'Prioridade alta',
    critical: 'Prioridade crítica',
  };

  return priorityMap[priority] || priority;
}

/**
 * Valida se um elemento tem nome acessível
 */
export function hasAccessibleName(element: HTMLElement): boolean {
  const ariaLabel = element.getAttribute('aria-label');
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  const textContent = element.textContent?.trim();
  const title = element.getAttribute('title');

  return Boolean(ariaLabel || ariaLabelledBy || textContent || title);
}

/**
 * Valida estrutura de headings em um container
 * Retorna avisos se houver problemas
 */
export function validateHeadingStructure(container: HTMLElement = document.body): string[] {
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const warnings: string[] = [];

  // Verificar se há pelo menos um h1
  const h1Count = headings.filter(h => h.tagName === 'H1').length;
  if (h1Count === 0) {
    warnings.push('Nenhum h1 encontrado na página');
  } else if (h1Count > 1) {
    warnings.push(`Múltiplos h1 encontrados (${h1Count}). Deve haver apenas 1.`);
  }

  // Verificar ordem hierárquica
  const levels = headings.map(h => parseInt(h.tagName.replace('H', ''), 10));

  for (let i = 1; i < levels.length; i++) {
    const diff = (levels[i] ?? 0) - (levels[i - 1] ?? 0);

    // Não deve pular níveis ao descer (h1 -> h3)
    if (diff > 1) {
      warnings.push(
        `Nível de heading pulado: h${levels[i - 1] ?? 0} seguido por h${levels[i] ?? 0} (linha ${i + 1})`
      );
    }
  }

  return warnings;
}

/**
 * Valida landmarks em um container
 */
export function validateLandmarks(container: HTMLElement = document.body): string[] {
  const warnings: string[] = [];

  // Verificar presença de landmarks essenciais
  const hasMain = container.querySelector('main, [role="main"]');
  if (!hasMain) {
    warnings.push('Nenhum landmark <main> encontrado');
  }

  const hasBanner = container.querySelector('header, [role="banner"]');
  if (!hasBanner) {
    warnings.push('Nenhum landmark <header> ou role="banner" encontrado');
  }

  // Verificar múltiplos landmarks do mesmo tipo
  const navs = container.querySelectorAll('nav, [role="navigation"]');
  if (navs.length > 1) {
    const navsWithLabel = Array.from(navs).filter(nav =>
      nav.hasAttribute('aria-label') || nav.hasAttribute('aria-labelledby')
    );

    if (navsWithLabel.length !== navs.length) {
      warnings.push(
        `Múltiplos landmarks de navegação encontrados (${navs.length}), mas nem todos têm aria-label único`
      );
    }
  }

  return warnings;
}

/**
 * Testa se todos os interativos têm nome acessível
 */
export function validateInteractiveElements(container: HTMLElement = document.body): string[] {
  const warnings: string[] = [];

  const interactives = container.querySelectorAll<HTMLElement>(
    'button, a, input, select, textarea, [role="button"], [role="link"]'
  );

  interactives.forEach((element, index) => {
    if (!hasAccessibleName(element)) {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      warnings.push(
        `Elemento interativo sem nome acessível: ${role || tag} (índice ${index})`
      );
    }
  });

  return warnings;
}

/**
 * Executa validação completa de acessibilidade
 */
export function runAccessibilityValidation(container: HTMLElement = document.body): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validar headings
  const headingWarnings = validateHeadingStructure(container);
  warnings.push(...headingWarnings);

  // Validar landmarks
  const landmarkWarnings = validateLandmarks(container);
  warnings.push(...landmarkWarnings);

  // Validar elementos interativos
  const interactiveWarnings = validateInteractiveElements(container);
  errors.push(...interactiveWarnings);

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Helper para criar props de acessibilidade para botões de fechar
 */
export function getCloseButtonProps(context?: string) {
  return {
    'type': 'button' as const,
    'aria-label': getCloseButtonLabel(context),
  };
}

/**
 * Helper para criar props de live region
 */
export function getLiveRegionProps(priority: 'polite' | 'assertive' = 'polite') {
  return {
    'role': 'status' as const,
    'aria-live': priority,
    'aria-atomic': 'true' as const,
  };
}

/**
 * Helper para criar props de modal/dialog
 */
export function getDialogProps(titleId: string, descriptionId?: string) {
  return {
    'role': 'dialog' as const,
    'aria-modal': 'true' as const,
    'aria-labelledby': titleId,
    ...(descriptionId && { 'aria-describedby': descriptionId }),
  };
}

/**
 * Helper para criar props de menu dropdown
 */
export function getMenuProps(labelId: string) {
  return {
    'role': 'menu' as const,
    'aria-labelledby': labelId,
  };
}

/**
 * Helper para criar props de menuitem
 */
export function getMenuItemProps() {
  return {
    'role': 'menuitem' as const,
  };
}

/**
 * Helper para criar props de campo de formulário
 */
export function getFormFieldProps(
  id: string,
  options: {
    required?: boolean;
    invalid?: boolean;
    describedBy?: string;
    label?: string;
  } = {}
) {
  const { required = false, invalid = false, describedBy, label } = options;

  return {
    'id': id,
    ...(required && { 'required': true, 'aria-required': 'true' as const }),
    ...(invalid && { 'aria-invalid': 'true' as const }),
    ...(describedBy && { 'aria-describedby': describedBy }),
    ...(label && { 'aria-label': label }),
  };
}
