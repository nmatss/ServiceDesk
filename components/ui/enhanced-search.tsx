'use client'

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Fuse from 'fuse.js'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

// ========================================
// ENHANCED SEARCH WITH FUZZY MATCHING
// ========================================
interface EnhancedSearchProps<T> {
  data: T[]
  onSearch: (results: T[]) => void
  searchKeys: string[]
  placeholder?: string
  threshold?: number
  debounceMs?: number
  showRecentSearches?: boolean
  maxRecentSearches?: number
  className?: string
  renderSuggestion?: (item: T) => ReactNode
  onSelect?: (item: T) => void
}

export function EnhancedSearch<T>({
  data,
  onSearch,
  searchKeys,
  placeholder = 'Buscar...',
  threshold = 0.3,
  debounceMs = 300,
  showRecentSearches = true,
  maxRecentSearches = 5,
  className,
  renderSuggestion,
  onSelect,
}: EnhancedSearchProps<T>) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<T[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Initialize Fuse.js
  const fuse = useRef(
    new Fuse(data, {
      keys: searchKeys,
      threshold,
      includeScore: true,
    })
  )

  // Update Fuse when data changes
  useEffect(() => {
    fuse.current = new Fuse(data, {
      keys: searchKeys,
      threshold,
      includeScore: true,
    })
  }, [data, searchKeys, threshold])

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches')
    if (stored) {
      setRecentSearches(JSON.parse(stored))
    }
  }, [])

  // Debounced search
  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        onSearch(data)
        setSuggestions([])
        setIsSearching(false)
        return
      }

      setIsSearching(true)
      const timer = setTimeout(() => {
        const results = fuse.current.search(searchQuery)
        const items = results.map((result) => result.item)
        setSuggestions(items.slice(0, 10)) // Show max 10 suggestions
        onSearch(items)
        setIsSearching(false)
      }, debounceMs)

      return () => clearTimeout(timer)
    },
    [data, onSearch, debounceMs]
  )

  useEffect(() => {
    performSearch(query)
  }, [query, performSearch])

  // Save to recent searches
  const addToRecentSearches = (searchQuery: string) => {
    if (!searchQuery.trim()) return

    const updated = [
      searchQuery,
      ...recentSearches.filter((s) => s !== searchQuery),
    ].slice(0, maxRecentSearches)

    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setShowSuggestions(true)
    setSelectedIndex(-1)
  }

  // Handle clear
  const handleClear = () => {
    setQuery('')
    setShowSuggestions(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          const selected = suggestions[selectedIndex]
          onSelect?.(selected)
          setShowSuggestions(false)
        }
        addToRecentSearches(query)
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Handle suggestion click
  const handleSuggestionClick = (item: T, index: number) => {
    setSelectedIndex(index)
    onSelect?.(item)
    setShowSuggestions(false)
    addToRecentSearches(query)
  }

  // Handle recent search click
  const handleRecentSearchClick = (search: string) => {
    setQuery(search)
    setShowSuggestions(false)
    addToRecentSearches(search)
  }

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('recentSearches')
  }

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          className="block w-full h-11 pl-10 pr-10 py-2 text-base sm:text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-neutral-900 dark:text-white transition-all duration-200"
          aria-label="Campo de busca"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {isSearching ? (
            <svg className="animate-spin h-5 w-5 text-neutral-400 dark:text-neutral-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : query ? (
            <button
              onClick={handleClear}
              className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              aria-label="Limpar busca"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (query || (showRecentSearches && recentSearches.length > 0)) && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 mt-2 w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 max-h-96 overflow-auto"
        >
          {/* Recent Searches */}
          {!query && showRecentSearches && recentSearches.length > 0 && (
            <div className="p-2 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">
                  Buscas Recentes
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Limpar
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchClick(search)}
                  className="w-full text-left px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors flex items-center gap-2"
                >
                  <svg className="h-4 w-4 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {search}
                </button>
              ))}
            </div>
          )}

          {/* Search Suggestions */}
          {query && suggestions.length > 0 && (
            <div className="p-2">
              <div className="px-2 mb-2">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">
                  Sugestões
                </span>
              </div>
              {suggestions.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(item, index)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm rounded transition-colors',
                    selectedIndex === index
                      ? 'bg-brand-100 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  )}
                >
                  {renderSuggestion ? renderSuggestion(item) : JSON.stringify(item)}
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {query && suggestions.length === 0 && !isSearching && (
            <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
              <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum resultado encontrado</p>
              <p className="text-xs mt-1">Tente usar palavras-chave diferentes</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ========================================
// SEARCH KEYBOARD SHORTCUT
// ========================================
export function useSearchShortcut(onActivate: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to activate search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onActivate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onActivate])
}
