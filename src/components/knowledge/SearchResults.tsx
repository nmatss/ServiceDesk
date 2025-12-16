'use client';

/**
 * Search Results Component
 * Displays semantic search results with relevance highlighting,
 * snippets, and faceted filtering
 */

import React from 'react';
import Link from 'next/link';
import {
  DocumentTextIcon,
  ClockIcon,
  TagIcon,
  StarIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

export interface SearchResult {
  id: number;
  title: string;
  summary: string;
  content: string;
  category_name?: string;
  tags?: string[];
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_at: string;
  updated_at: string;
  score: number;
  semanticScore?: number;
  keywordScore?: number;
  highlights?: string[];
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  total: number;
  loading?: boolean;
  onResultClick?: (result: SearchResult, position: number) => void;
  className?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  total,
  loading = false,
  onResultClick,
  className = ''
}) => {
  /**
   * Highlight query terms in text
   */
  const highlightText = (text: string, searchQuery: string): React.ReactNode => {
    if (!searchQuery) return text;

    const terms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) return text;

    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (terms.some(term => part.toLowerCase() === term.toLowerCase())) {
        return (
          <mark key={index} className="bg-yellow-200 px-0.5 rounded">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  /**
   * Calculate helpful percentage
   */
  const getHelpfulPercentage = (result: SearchResult): number => {
    const total = result.helpful_count + result.not_helpful_count;
    if (total === 0) return 0;
    return Math.round((result.helpful_count / total) * 100);
  };

  /**
   * Get score color
   */
  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-blue-600 bg-blue-50';
    if (score >= 0.4) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  /**
   * Format date
   */
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-12 text-center ${className}`}>
        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
        <p className="text-gray-600 mb-4">
          We couldn't find any articles matching "{query}"
        </p>
        <p className="text-sm text-gray-500">
          Try different keywords or browse by category
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Results header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          Found <span className="font-semibold text-gray-900">{total}</span> result
          {total !== 1 ? 's' : ''} for "{query}"
        </p>
      </div>

      {/* Results list */}
      {results.map((result, index) => {
        const helpfulPercentage = getHelpfulPercentage(result);

        return (
          <div
            key={result.id}
            className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <Link
                href={`/knowledge/article/${result.id}`}
                onClick={() => onResultClick?.(result, index)}
                className="flex-1"
              >
                <h3 className="text-lg font-semibold text-blue-600 hover:text-blue-700 mb-1">
                  {highlightText(result.title, query)}
                </h3>
              </Link>

              {/* Relevance score */}
              {result.score > 0 && (
                <span
                  className={`ml-4 px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(
                    result.score
                  )}`}
                >
                  {Math.round(result.score * 100)}% match
                </span>
              )}
            </div>

            {/* Summary */}
            <p className="text-gray-700 mb-3 line-clamp-2">
              {highlightText(result.summary || result.content.substring(0, 200), query)}
            </p>

            {/* Highlights */}
            {result.highlights && result.highlights.length > 0 && (
              <div className="mb-3 space-y-1">
                {result.highlights.slice(0, 2).map((highlight, idx) => (
                  <p key={idx} className="text-sm text-gray-600 italic">
                    "...{highlightText(highlight, query)}..."
                  </p>
                ))}
              </div>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              {/* Category */}
              {result.category_name && (
                <div className="flex items-center">
                  <DocumentTextIcon className="h-4 w-4 mr-1" />
                  <span>{result.category_name}</span>
                </div>
              )}

              {/* Views */}
              <div className="flex items-center">
                <EyeIcon className="h-4 w-4 mr-1" />
                <span>{result.view_count.toLocaleString()} views</span>
              </div>

              {/* Helpful votes */}
              {(result.helpful_count > 0 || result.not_helpful_count > 0) && (
                <div className="flex items-center">
                  <StarIcon className="h-4 w-4 mr-1 text-yellow-500" />
                  <span>{helpfulPercentage}% helpful</span>
                </div>
              )}

              {/* Last updated */}
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-1" />
                <span>{formatDate(result.updated_at)}</span>
              </div>
            </div>

            {/* Tags */}
            {result.tags && result.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {result.tags.slice(0, 5).map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag}
                  </span>
                ))}
                {result.tags.length > 5 && (
                  <span className="text-xs text-gray-500">+{result.tags.length - 5} more</span>
                )}
              </div>
            )}

            {/* Score breakdown (debug mode) */}
            {(result.semanticScore !== undefined || result.keywordScore !== undefined) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex gap-4 text-xs text-gray-500">
                  {result.semanticScore !== undefined && (
                    <span>Semantic: {Math.round(result.semanticScore * 100)}%</span>
                  )}
                  {result.keywordScore !== undefined && (
                    <span>Keyword: {Math.round(result.keywordScore * 100)}%</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SearchResults;
