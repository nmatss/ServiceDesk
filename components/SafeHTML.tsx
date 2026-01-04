'use client';

import { useMemo } from 'react';
import { sanitizeHTML, sanitizeMarkdown } from '@/lib/security/sanitize';

interface SafeHTMLProps {
  html: string;
  className?: string;
  allowMarkdown?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Componente seguro para renderizar HTML sanitizado
 * Previne XSS automaticamente
 */
export function SafeHTML({
  html,
  className,
  allowMarkdown = false,
  as: Component = 'div'
}: SafeHTMLProps) {
  const sanitized = useMemo(() => {
    return allowMarkdown ? sanitizeMarkdown(html) : sanitizeHTML(html);
  }, [html, allowMarkdown]);

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
