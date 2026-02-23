'use client'

import React from 'react'

type RichTextFallbackProps = {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  rows?: number
}

/**
 * Simple, safe fallback rich text editor.
 * Use this when rich text libraries are disabled or unavailable.
 */
export default function RichTextFallback({
  value = '',
  onChange,
  placeholder = 'Digite o conteúdo...',
  className = '',
  rows = 8,
}: RichTextFallbackProps) {
  return (
    <textarea
      className={`w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 ${className}`}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      rows={rows}
    />
  )
}
