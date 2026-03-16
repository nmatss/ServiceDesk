'use client';

import React, { useState, useCallback } from 'react';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  ClockIcon,
  UserIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';

export interface TicketSummaryData {
  ticket_id: number;
  problem: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  status_explanation: string;
  opened_by: string;
  assigned_to: string;
  days_open: number;
  total_comments: number;
  internal_comments: number;
  timeline: Array<{ date: string; event: string; actor: string }>;
  recommended_next_step: string;
  generated_at: string;
}

interface TicketSummaryProps {
  ticketId: number;
  summary: TicketSummaryData | null;
  onRegenerate: () => void;
  isLoading?: boolean;
  className?: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function TicketSummary({
  ticketId,
  summary,
  onRegenerate,
  isLoading = false,
  className = '',
}: TicketSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className={`rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <DocumentTextIcon className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Resumo do Ticket
          </span>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-700 w-3/4" />
          <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-700 w-full" />
          <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-700 w-5/6" />
          <div className="h-3 rounded bg-neutral-200 dark:bg-neutral-700 w-2/3" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={`rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-4 w-4 text-brand-500" />
            <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Resumo do Ticket
            </span>
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Gerar resumo
          </button>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Clique em &quot;Gerar resumo&quot; para criar um resumo do ticket.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80 ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Resumo do Ticket
          </span>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isLoading}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-900/30"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Regenerar
        </button>
      </div>

      {/* Problem statement */}
      <div className="mb-3">
        <h4 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {summary.problem}
        </h4>
        {summary.description && (
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
            {summary.description}
          </p>
        )}
      </div>

      {/* Quick stats */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <ClockIcon className="h-3.5 w-3.5" />
          <span>{summary.days_open}d aberto</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
          <span>{summary.total_comments} msgs</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <UserIcon className="h-3.5 w-3.5" />
          <span className="truncate">{summary.assigned_to}</span>
        </div>
      </div>

      {/* Status explanation */}
      <div className="mb-3 rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-900/60">
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          {summary.status_explanation}
        </p>
      </div>

      {/* Timeline (collapsible) */}
      {summary.timeline.length > 0 && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mb-2 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {expanded ? 'Ocultar timeline' : `Ver timeline (${summary.timeline.length} eventos)`}
          </button>

          {expanded && (
            <ul className="space-y-1.5 border-l-2 border-neutral-200 pl-3 dark:border-neutral-700">
              {summary.timeline.map((event, idx) => (
                <li key={idx} className="relative text-xs">
                  <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-brand-400 dark:bg-brand-500" />
                  <span className="text-neutral-500 dark:text-neutral-500">
                    {formatDate(event.date)}
                  </span>
                  <span className="mx-1 text-neutral-400 dark:text-neutral-600">-</span>
                  <span className="text-neutral-700 dark:text-neutral-300">{event.event}</span>
                  <span className="ml-1 text-neutral-400 dark:text-neutral-500">
                    ({event.actor})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Recommended next step */}
      <div className="rounded-lg bg-brand-50 p-2.5 dark:bg-brand-900/20">
        <div className="flex items-start gap-2">
          <LightBulbIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <div>
            <span className="text-xs font-medium text-brand-700 dark:text-brand-300">
              Proximo passo recomendado
            </span>
            <p className="mt-0.5 text-xs text-brand-600 dark:text-brand-400">
              {summary.recommended_next_step}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
