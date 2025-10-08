'use client';

/**
 * Semantic Search Bar Component
 * Advanced search bar with auto-complete, filters, suggestions,
 * recent searches, and popular searches
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, FunnelIcon, ClockIcon, FireIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/monitoring/logger';

interface SearchFilter {
  categories?: string[];
  tags?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  minHelpfulVotes?: number;
  status?: 'published' | 'draft' | 'archived';
}

interface SearchSuggestion {
  text: string;
  type: 'article' | 'tag' | 'category' | 'query';
  count?: number;
}

interface RecentSearch {
  query: string;
  timestamp: Date;
  resultsCount: number;
}

interface SemanticSearchBarProps {
  onSearch: (query: string, filters?: SearchFilter) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  placeholder?: string;
  showFilters?: boolean;
  showSuggestions?: boolean;
  className?: string;
}

export const SemanticSearchBar: React.FC<SemanticSearchBarProps> = ({
  onSearch,
  onSuggestionSelect,
  placeholder = 'Search knowledge base...',
  showFilters = true,
  showSuggestions = true,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [popularSearches, setPopularSearches] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<SearchFilter>({});
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce query for auto-complete
  const debouncedQuery = useDebounce(query, 300);

  // Load recent and popular searches on mount
  useEffect(() => {
    loadRecentSearches();
    loadPopularSearches();
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2 && showSuggestions) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery, showSuggestions]);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load recent searches from localStorage
  const loadRecentSearches = () => {
    try {
      const stored = localStorage.getItem('kb_recent_searches');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSearches(
          parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }))
        );
      }
    } catch (error) {
      logger.error('Error loading recent searches', error);
    }
  };

  // Load popular searches (from API or mock data)
  const loadPopularSearches = async () => {
    try {
      const response = await fetch('/api/knowledge/search/popular');
      if (response.ok) {
        const data = await response.json();
        setPopularSearches(data.queries || []);
      }
    } catch (error) {
      logger.error('Error loading popular searches', error);
      // Mock data as fallback
      setPopularSearches([
        'How to reset password',
        'Login issues',
        'Account setup',
        'Billing questions',
        'Technical support',
      ]);
    }
  };

  // Fetch auto-complete suggestions
  const fetchSuggestions = async (searchQuery: string) => {
    try {
      const response = await fetch(
        `/api/knowledge/search/autocomplete?q=${encodeURIComponent(searchQuery)}`
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      logger.error('Error fetching suggestions', error);
    }
  };

  // Save search to recent
  const saveRecentSearch = (searchQuery: string, resultsCount: number) => {
    const newSearch: RecentSearch = {
      query: searchQuery,
      timestamp: new Date(),
      resultsCount,
    };

    const updated = [newSearch, ...recentSearches.filter(s => s.query !== searchQuery)].slice(0, 10);
    setRecentSearches(updated);

    try {
      localStorage.setItem('kb_recent_searches', JSON.stringify(updated));
    } catch (error) {
      logger.error('Error saving recent search', error);
    }
  };

  // Handle search submission
  const handleSearch = useCallback(
    (searchQuery?: string) => {
      const finalQuery = searchQuery || query;
      if (finalQuery.trim()) {
        onSearch(finalQuery, filters);
        saveRecentSearch(finalQuery, 0); // Results count will be updated by parent
        setShowDropdown(false);
      }
    },
    [query, filters, onSearch]
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowDropdown(true);
    setSelectedSuggestionIndex(-1);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    handleSearch(suggestion.text);

    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    }
  };

  // Handle recent search click
  const handleRecentSearchClick = (search: RecentSearch) => {
    setQuery(search.query);
    handleSearch(search.query);
  };

  // Handle popular search click
  const handlePopularSearchClick = (popularQuery: string) => {
    setQuery(popularQuery);
    handleSearch(popularQuery);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;

    const allSuggestions = [
      ...suggestions,
      ...recentSearches.map(s => ({ text: s.query, type: 'query' as const })),
      ...popularSearches.map(q => ({ text: q, type: 'query' as const })),
    ];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev =>
          prev < allSuggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && allSuggestions[selectedSuggestionIndex]) {
          setQuery(allSuggestions[selectedSuggestionIndex].text);
          handleSearch(allSuggestions[selectedSuggestionIndex].text);
        } else {
          handleSearch();
        }
        break;

      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();
  };

  // Toggle filter panel
  const toggleFilterPanel = () => {
    setShowFilterPanel(!showFilterPanel);
  };

  // Update filter
  const updateFilter = (key: keyof SearchFilter, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
  };

  // Count active filters
  const activeFilterCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof SearchFilter];
    return value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : true);
  }).length;

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="block w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
          {query && (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}

          {showFilters && (
            <button
              onClick={toggleFilterPanel}
              className={`p-1 rounded transition-colors relative ${
                activeFilterCount > 0
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label="Toggle filters"
            >
              <FunnelIcon className="h-5 w-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto"
        >
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                    selectedSuggestionIndex === index ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">{suggestion.text}</span>
                    {suggestion.type !== 'query' && (
                      <span className="text-xs text-gray-500 capitalize">{suggestion.type}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {query.length < 2 && recentSearches.length > 0 && (
            <div className="py-2 border-t border-gray-200">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center">
                <ClockIcon className="h-4 w-4 mr-2" />
                Recent Searches
              </div>
              {recentSearches.slice(0, 5).map((search, index) => (
                <button
                  key={`recent-${index}`}
                  onClick={() => handleRecentSearchClick(search)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">{search.query}</span>
                    <span className="text-xs text-gray-500">
                      {search.resultsCount} result{search.resultsCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Popular Searches */}
          {query.length < 2 && popularSearches.length > 0 && (
            <div className="py-2 border-t border-gray-200">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center">
                <FireIcon className="h-4 w-4 mr-2" />
                Popular Searches
              </div>
              {popularSearches.slice(0, 5).map((popularQuery, index) => (
                <button
                  key={`popular-${index}`}
                  onClick={() => handlePopularSearchClick(popularQuery)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-900">{popularQuery}</span>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {query.length >= 2 && suggestions.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No suggestions found. Press Enter to search.
            </div>
          )}
        </div>
      )}

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Date Range */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  onChange={e =>
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      from: e.target.value ? new Date(e.target.value) : undefined,
                    })
                  }
                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="From"
                />
                <input
                  type="date"
                  onChange={e =>
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      to: e.target.value ? new Date(e.target.value) : undefined,
                    })
                  }
                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Min Helpful Votes */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Minimum Helpful Votes
              </label>
              <input
                type="number"
                min="0"
                value={filters.minHelpfulVotes || ''}
                onChange={e =>
                  updateFilter('minHelpfulVotes', e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 5"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status || ''}
                onChange={e => updateFilter('status', e.target.value || undefined)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                handleSearch();
                setShowFilterPanel(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
