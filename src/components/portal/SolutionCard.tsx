'use client';

import { CheckCircleIcon, XCircleIcon, BookOpenIcon } from '@heroicons/react/24/outline';

interface SolutionArticle {
  id: number;
  title: string;
  summary: string;
  content: string;
  confidence: number;
}

interface SolutionCardProps {
  article: SolutionArticle;
  onResolved: () => void;
  onNotResolved: () => void;
}

export default function SolutionCard({ article, onResolved, onNotResolved }: SolutionCardProps) {
  const confidencePercent = Math.round(article.confidence * 100);
  const confidenceColor =
    confidencePercent >= 85
      ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
      : confidencePercent >= 70
        ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30'
        : 'text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800';

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm overflow-hidden animate-fade-in max-w-md">
      {/* Header */}
      <div className="px-4 py-3 bg-brand-50 dark:bg-brand-900/20 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2">
        <BookOpenIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
          Artigo da Base de Conhecimento
        </span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${confidenceColor}`}>
          {confidencePercent}% relevante
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
          {article.title}
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-3">
          {article.summary || article.content.substring(0, 200)}
          {(article.summary || article.content).length > 200 ? '...' : ''}
        </p>

        {/* Link to full article */}
        <a
          href={`/portal/knowledge/${article.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
        >
          Ver artigo completo
        </a>
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2 font-medium">
          Isso resolveu o seu problema?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onResolved}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Sim, resolveu!
          </button>
          <button
            onClick={onNotResolved}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-sm font-medium rounded-lg transition-colors"
          >
            <XCircleIcon className="w-4 h-4" />
            Não resolveu
          </button>
        </div>
      </div>
    </div>
  );
}
