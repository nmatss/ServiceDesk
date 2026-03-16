'use client';

import React from 'react';
import {
  TicketIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export interface SimilarTicketData {
  id: number;
  title: string;
  status_name: string;
  created_at: string;
  match_pct: number;
}

interface SimilarTicketsProps {
  tickets: SimilarTicketData[];
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  aberto: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  open: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  'em andamento': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'em progresso': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  resolvido: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  fechado: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
  closed: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
};

function getStatusColor(status: string): string {
  return (
    STATUS_COLORS[status.toLowerCase()] ||
    'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
  );
}

export function SimilarTickets({ tickets, className = '' }: SimilarTicketsProps) {
  if (tickets.length === 0) {
    return (
      <div className={`rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <TicketIcon className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Tickets Similares
          </span>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nenhum ticket similar encontrado.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80 ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <TicketIcon className="h-4 w-4 text-brand-500" />
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Tickets Similares
        </span>
        <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
          {tickets.length}
        </span>
      </div>

      <ul className="space-y-2">
        {tickets.map((ticket) => (
          <li
            key={ticket.id}
            className="group rounded-lg border border-neutral-100 p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/50 dark:border-neutral-700 dark:hover:border-brand-800 dark:hover:bg-brand-900/20"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                    #{ticket.id}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(ticket.status_name)}`}>
                    {ticket.status_name}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-neutral-800 dark:text-neutral-200">
                  {ticket.title}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {ticket.match_pct}%
                </span>
                <a
                  href={`/tickets/${ticket.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Ver detalhes
                  <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
