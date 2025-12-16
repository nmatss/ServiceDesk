'use client';

/**
 * Related Articles Component
 * AI-powered related content suggestions using semantic search
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { DocumentTextIcon, SparklesIcon, EyeIcon, StarIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/monitoring/logger';

interface RelatedArticle {
  id: number;
  title: string;
  summary: string;
  view_count: number;
  helpful_count: number;
  category_name?: string;
  similarityScore?: number;
}

interface RelatedArticlesProps {
  currentArticleId: number;
  maxResults?: number;
  title?: string;
  showSimilarityScore?: boolean;
  className?: string;
}

export const RelatedArticles: React.FC<RelatedArticlesProps> = ({
  currentArticleId,
  maxResults = 5,
  title = 'Related Articles',
  showSimilarityScore = false,
  className = ''
}) => {
  const [articles, setArticles] = useState<RelatedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRelatedArticles();
  }, [currentArticleId]);

  const loadRelatedArticles = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/knowledge/${currentArticleId}/related?limit=${maxResults}`
      );

      if (!response.ok) {
        throw new Error('Failed to load related articles');
      }

      const data = await response.json();
      setArticles(data.articles || []);
    } catch (err) {
      logger.error('Error loading related articles', err);
      setError('Failed to load related articles');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get similarity color
   */
  const getSimilarityColor = (score?: number): string => {
    if (!score) return 'text-gray-600';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-blue-600';
    if (score >= 0.4) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="flex items-center mb-4">
          <SparklesIcon className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || articles.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center mb-4">
        <SparklesIcon className="h-5 w-5 text-blue-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      {/* Articles list */}
      <div className="space-y-4">
        {articles.map((article, index) => {
          const helpfulPercentage =
            article.helpful_count > 0
              ? Math.round((article.helpful_count / (article.helpful_count + 1)) * 100)
              : 0;

          return (
            <div key={article.id} className="group">
              <Link
                href={`/knowledge/article/${article.id}`}
                className="block hover:bg-gray-50 -mx-2 p-2 rounded transition-colors"
              >
                {/* Title */}
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors flex-1 line-clamp-2">
                    {article.title}
                  </h3>

                  {/* Similarity score */}
                  {showSimilarityScore && article.similarityScore !== undefined && (
                    <span
                      className={`ml-2 text-xs font-medium ${getSimilarityColor(
                        article.similarityScore
                      )}`}
                    >
                      {Math.round(article.similarityScore * 100)}%
                    </span>
                  )}
                </div>

                {/* Summary */}
                {article.summary && (
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">{article.summary}</p>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {/* Category */}
                  {article.category_name && (
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-3 w-3 mr-1" />
                      <span>{article.category_name}</span>
                    </div>
                  )}

                  {/* Views */}
                  <div className="flex items-center">
                    <EyeIcon className="h-3 w-3 mr-1" />
                    <span>{article.view_count.toLocaleString()}</span>
                  </div>

                  {/* Helpful */}
                  {article.helpful_count > 0 && (
                    <div className="flex items-center">
                      <StarIcon className="h-3 w-3 mr-1 text-yellow-500" />
                      <span>{helpfulPercentage}%</span>
                    </div>
                  )}
                </div>
              </Link>

              {/* Separator */}
              {index < articles.length - 1 && <div className="border-t border-gray-100 mt-4"></div>}
            </div>
          );
        })}
      </div>

      {/* View all link */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <Link
          href="/knowledge/search"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View all articles →
        </Link>
      </div>
    </div>
  );
};

export default RelatedArticles;
