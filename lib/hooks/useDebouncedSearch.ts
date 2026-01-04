/**
 * useDebouncedSearch Hook
 *
 * Provides debounced search functionality with autocomplete suggestions
 * from the global search API. Optimized for performance with caching
 * and request cancellation.
 *
 * @module lib/hooks/useDebouncedSearch
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export interface SearchSuggestion {
  type: 'ticket' | 'user' | 'category' | 'knowledge'
  id: number
  title: string
  subtitle: string
  url: string
  icon: string
  priority?: string
  role?: string
}

export interface SearchSuggestionsResponse {
  success: boolean
  suggestions: SearchSuggestion[]
  relatedTerms: string[]
  query: string
  total: number
}

interface UseDebouncedSearchOptions {
  /** Debounce delay in milliseconds (default: 300) */
  delay?: number
  /** Minimum query length to trigger search (default: 2) */
  minLength?: number
  /** Search type filter (default: 'all') */
  type?: 'all' | 'tickets' | 'users' | 'categories' | 'knowledge'
  /** Maximum number of suggestions (default: 10) */
  limit?: number
  /** Enable caching of results (default: true) */
  enableCache?: boolean
  /** Callback when search is triggered */
  onSearch?: (query: string) => void
  /** Callback when suggestion is selected */
  onSelect?: (suggestion: SearchSuggestion) => void
}

interface UseDebouncedSearchReturn {
  /** Current search query */
  query: string
  /** Set search query */
  setQuery: (query: string) => void
  /** Current suggestions */
  suggestions: SearchSuggestion[]
  /** Related search terms */
  relatedTerms: string[]
  /** Loading state */
  loading: boolean
  /** Error message if any */
  error: string | null
  /** Whether dropdown should be shown */
  showDropdown: boolean
  /** Set dropdown visibility */
  setShowDropdown: (show: boolean) => void
  /** Clear search and suggestions */
  clear: () => void
  /** Manually trigger search */
  search: (q?: string) => void
}

// Simple in-memory cache
const searchCache = new Map<string, {
  data: SearchSuggestionsResponse
  timestamp: number
}>()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Custom hook for debounced search with autocomplete
 */
export function useDebouncedSearch(
  options: UseDebouncedSearchOptions = {}
): UseDebouncedSearchReturn {
  const {
    delay = 300,
    minLength = 2,
    type = 'all',
    limit = 10,
    enableCache = true,
    onSearch,
    onSelect
  } = options

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [relatedTerms, setRelatedTerms] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Fetch suggestions from API
   */
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < minLength) {
      setSuggestions([])
      setRelatedTerms([])
      setShowDropdown(false)
      return
    }

    // Check cache
    const cacheKey = `${searchQuery}:${type}:${limit}`
    if (enableCache) {
      const cached = searchCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setSuggestions(cached.data.suggestions)
        setRelatedTerms(cached.data.relatedTerms)
        setShowDropdown(true)
        setLoading(false)
        return
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        type,
        limit: limit.toString()
      })

      const response = await fetch(`/api/search/suggestions?${params}`, {
        signal: abortControllerRef.current.signal,
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Falha ao buscar sugestões')
      }

      const data: SearchSuggestionsResponse = await response.json()

      if (data.success) {
        setSuggestions(data.suggestions)
        setRelatedTerms(data.relatedTerms)
        setShowDropdown(true)

        // Cache results
        if (enableCache) {
          searchCache.set(cacheKey, {
            data,
            timestamp: Date.now()
          })

          // Clean old cache entries (keep last 50)
          if (searchCache.size > 50) {
            const entries = Array.from(searchCache.entries())
            entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
            entries.slice(50).forEach(([key]) => searchCache.delete(key))
          }
        }

        onSearch?.(searchQuery)
      } else {
        setError('Erro ao buscar sugestões')
        setShowDropdown(false)
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err.name !== 'AbortError') {
        console.error('Search error:', err)
        setError(err.message || 'Erro ao buscar sugestões')
        setShowDropdown(false)
      }
    } finally {
      setLoading(false)
    }
  }, [minLength, type, limit, enableCache, onSearch])

  /**
   * Debounced search effect
   */
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Don't search for empty or too short queries
    if (!query || query.length < minLength) {
      setSuggestions([])
      setRelatedTerms([])
      setShowDropdown(false)
      return
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(query)
    }, delay)

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, delay, minLength, fetchSuggestions])

  /**
   * Clear search
   */
  const clear = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setRelatedTerms([])
    setShowDropdown(false)
    setError(null)
    setLoading(false)

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
  }, [])

  /**
   * Manual search trigger
   */
  const search = useCallback((q?: string) => {
    const searchQuery = q ?? query
    if (searchQuery && searchQuery.length >= minLength) {
      fetchSuggestions(searchQuery)
    }
  }, [query, minLength, fetchSuggestions])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    query,
    setQuery,
    suggestions,
    relatedTerms,
    loading,
    error,
    showDropdown,
    setShowDropdown,
    clear,
    search
  }
}

export default useDebouncedSearch
