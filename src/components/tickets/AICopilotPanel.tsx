'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  XMarkIcon,
  ArrowPathIcon,
  SparklesIcon,
  BookOpenIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

import { SentimentIndicator, type SentimentData } from './SentimentIndicator';
import { SuggestedResponse } from './SuggestedResponse';
import { SimilarTickets, type SimilarTicketData } from './SimilarTickets';
import { SmartActions, type SmartActionData } from './SmartActions';
import { TicketSummary, type TicketSummaryData } from './TicketSummary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KBArticle {
  id: number;
  title: string;
  slug: string;
  helpful_votes: number;
  view_count: number;
}

interface SLAInfo {
  resolution_hours: number;
  response_hours: number;
  remaining_ms: number;
  remaining_label: string;
  breached: boolean;
  first_response_at: string | null;
  resolved_at: string | null;
}

interface CopilotData {
  ticket_id: number;
  summary: {
    problem: string;
    description_preview: string;
    days_open: number;
    comment_count: number;
    internal_comments: number;
    status: string;
    priority: string;
    category: string;
    assigned_to: string;
    recommended_next_step: string;
  };
  suggested_response: {
    text: string;
    confidence: number;
    source: 'knowledge_base' | 'similar_ticket' | 'template';
  };
  similar_tickets: SimilarTicketData[];
  kb_articles: KBArticle[];
  sentiment: SentimentData;
  smart_actions: SmartActionData[];
  sla: SLAInfo | null;
}

interface AICopilotPanelProps {
  ticketId: number;
  isOpen: boolean;
  onClose: () => void;
  onUseResponse?: (text: string) => void;
  onEditResponse?: (text: string) => void;
  onEscalate?: () => void;
  onMerge?: () => void;
  onMarkKnownError?: () => void;
  onReclassify?: () => void;
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function CopilotSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      {/* Sentiment skeleton */}
      <div className="h-8 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-700" />

      {/* SLA skeleton */}
      <div className="h-12 rounded-xl bg-neutral-200 dark:bg-neutral-700" />

      {/* Suggested response skeleton */}
      <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <div className="h-4 w-36 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-24 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="flex gap-2">
          <div className="h-9 flex-1 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-9 w-20 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        </div>
      </div>

      {/* KB articles skeleton */}
      <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <div className="h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-8 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-8 rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>

      {/* Similar tickets skeleton */}
      <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <div className="h-4 w-36 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-16 rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-16 rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>

      {/* Actions skeleton */}
      <div className="grid grid-cols-2 gap-2">
        <div className="h-16 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-16 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-16 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-16 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SLA Badge
// ---------------------------------------------------------------------------

function SLABadge({ sla }: { sla: SLAInfo }) {
  const breached = sla.breached;
  const urgent = !breached && sla.remaining_ms < 2 * 60 * 60 * 1000; // <2h

  const bgColor = breached
    ? 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-800'
    : urgent
      ? 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800'
      : 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800';

  const textColor = breached
    ? 'text-red-700 dark:text-red-300'
    : urgent
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-emerald-700 dark:text-emerald-300';

  return (
    <div className={`flex items-center gap-2 rounded-xl border p-3 ${bgColor}`}>
      <ClockIcon className={`h-4 w-4 ${textColor}`} />
      <div className="min-w-0 flex-1">
        <span className={`text-xs font-medium ${textColor}`}>SLA</span>
        <p className={`text-sm font-semibold ${textColor}`}>{sla.remaining_label}</p>
      </div>
      {breached && (
        <ExclamationCircleIcon className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KB Articles section
// ---------------------------------------------------------------------------

function KBArticlesSection({ articles }: { articles: KBArticle[] }) {
  if (articles.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80">
        <div className="flex items-center gap-2 mb-2">
          <BookOpenIcon className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Artigos Relevantes
          </span>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Nenhum artigo encontrado para este ticket.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80">
      <div className="mb-3 flex items-center gap-2">
        <BookOpenIcon className="h-4 w-4 text-brand-500" />
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Artigos Relevantes
        </span>
        <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
          {articles.length}
        </span>
      </div>

      <ul className="space-y-2">
        {articles.map((article) => (
          <li key={article.id}>
            <a
              href={`/knowledge/${article.slug || article.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/20"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-800 group-hover:text-brand-700 dark:text-neutral-200 dark:group-hover:text-brand-300">
                  {article.title}
                </p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {article.helpful_votes > 0 && (
                    <span>{article.helpful_votes} votos</span>
                  )}
                  {article.view_count > 0 && (
                    <span>{article.view_count} visualizacoes</span>
                  )}
                </div>
              </div>
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition-colors group-hover:text-brand-500 dark:text-neutral-500" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function AICopilotPanel({
  ticketId,
  isOpen,
  onClose,
  onUseResponse,
  onEditResponse,
  onEscalate,
  onMerge,
  onMarkKnownError,
  onReclassify,
}: AICopilotPanelProps) {
  const [data, setData] = useState<CopilotData | null>(null);
  const [detailedSummary, setDetailedSummary] = useState<TicketSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch copilot data
  const fetchCopilotData = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Erro ${res.status}`);
      }

      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do copiloto');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  // Fetch detailed summary
  const fetchSummary = useCallback(async () => {
    if (!ticketId) return;
    setSummaryLoading(true);

    try {
      const res = await fetch('/api/ai/copilot/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      if (!res.ok) throw new Error('Falha ao gerar resumo');

      const json = await res.json();
      setDetailedSummary(json.data ?? json);
    } catch {
      // Graceful — summary is optional
    } finally {
      setSummaryLoading(false);
    }
  }, [ticketId]);

  // Auto-fetch when panel opens
  useEffect(() => {
    if (isOpen && ticketId) {
      fetchCopilotData();
    }
  }, [isOpen, ticketId, fetchCopilotData]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Default handlers
  const handleUseResponse = useCallback(
    (text: string) => {
      if (onUseResponse) {
        onUseResponse(text);
      } else {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    },
    [onUseResponse],
  );

  const handleEditResponse = useCallback(
    (text: string) => {
      if (onEditResponse) {
        onEditResponse(text);
      }
    },
    [onEditResponse],
  );

  const noop = useCallback(() => {}, []);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-50 flex h-full w-[380px] max-w-[90vw] flex-col border-l border-neutral-200 bg-neutral-50/95 shadow-2xl backdrop-blur-md transition-transform duration-300 ease-in-out dark:border-neutral-700 dark:bg-neutral-900/95 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
              Copiloto IA
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchCopilotData}
              disabled={loading}
              title="Atualizar dados"
              className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && <CopilotSkeleton />}

          {error && !loading && (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                type="button"
                onClick={fetchCopilotData}
                className="mt-2 text-sm font-medium text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-4 p-4">
              {/* Sentiment + SLA row */}
              <div className="flex flex-wrap items-center gap-2">
                <SentimentIndicator sentiment={data.sentiment} />
              </div>

              {data.sla && <SLABadge sla={data.sla} />}

              {/* Ticket Summary */}
              <TicketSummary
                ticketId={ticketId}
                summary={detailedSummary}
                onRegenerate={fetchSummary}
                isLoading={summaryLoading}
              />

              {/* Suggested Response */}
              <SuggestedResponse
                text={data.suggested_response.text}
                confidence={data.suggested_response.confidence}
                source={data.suggested_response.source}
                onUse={handleUseResponse}
                onEdit={handleEditResponse}
              />

              {/* KB Articles */}
              <KBArticlesSection articles={data.kb_articles} />

              {/* Similar Tickets */}
              <SimilarTickets tickets={data.similar_tickets} />

              {/* Smart Actions */}
              <SmartActions
                actions={data.smart_actions}
                onEscalate={onEscalate || noop}
                onMerge={onMerge || noop}
                onMarkKnownError={onMarkKnownError || noop}
                onReclassify={onReclassify || noop}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-neutral-200 bg-white/80 px-4 py-2 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80">
          <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
            Sugestoes geradas por IA — sempre revise antes de usar
          </p>
        </div>
      </div>
    </>
  );
}
