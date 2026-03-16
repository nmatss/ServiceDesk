'use client';

import React, { useState, useCallback } from 'react';
import {
  ClipboardDocumentCheckIcon,
  PencilSquareIcon,
  SparklesIcon,
  BookOpenIcon,
  TicketIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface SuggestedResponseProps {
  text: string;
  confidence: number;
  source: 'knowledge_base' | 'similar_ticket' | 'template';
  onUse: (text: string) => void;
  onEdit: (text: string) => void;
  className?: string;
}

const SOURCE_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  knowledge_base: {
    icon: BookOpenIcon,
    label: 'Base de Conhecimento',
    color: 'text-brand-600 dark:text-brand-400',
  },
  similar_ticket: {
    icon: TicketIcon,
    label: 'Ticket Similar',
    color: 'text-purple-600 dark:text-purple-400',
  },
  template: {
    icon: DocumentTextIcon,
    label: 'Template Gerado',
    color: 'text-neutral-600 dark:text-neutral-400',
  },
};

export function SuggestedResponse({
  text,
  confidence,
  source,
  onUse,
  onEdit,
  className = '',
}: SuggestedResponseProps) {
  const [copied, setCopied] = useState(false);
  const srcCfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.template;
  const SourceIcon = srcCfg.icon;

  const confidenceColor =
    confidence >= 70
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : confidence >= 50
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400';

  const handleUse = useCallback(() => {
    onUse(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onUse, text]);

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80 ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Resposta Sugerida
          </span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColor}`}>
          {confidence}% confianca
        </span>
      </div>

      {/* Source */}
      <div className="mb-3 flex items-center gap-1.5">
        <SourceIcon className={`h-3.5 w-3.5 ${srcCfg.color}`} />
        <span className={`text-xs ${srcCfg.color}`}>Fonte: {srcCfg.label}</span>
      </div>

      {/* Response text */}
      <div className="mb-4 max-h-56 overflow-y-auto rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900/60">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {text}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUse}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
        >
          <ClipboardDocumentCheckIcon className="h-4 w-4" />
          {copied ? 'Copiada!' : 'Usar resposta'}
        </button>

        <button
          type="button"
          onClick={() => onEdit(text)}
          className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:focus:ring-offset-neutral-900"
        >
          <PencilSquareIcon className="h-4 w-4" />
          Editar
        </button>
      </div>
    </div>
  );
}
