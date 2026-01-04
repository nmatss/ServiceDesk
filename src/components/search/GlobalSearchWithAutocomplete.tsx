/**
 * GlobalSearchWithAutocomplete Component
 *
 * Advanced search input with real-time autocomplete suggestions,
 * keyboard navigation, and categorized results.
 *
 * Features:
 * - Debounced search (300ms)
 * - Real-time suggestions from API
 * - Keyboard navigation (↑/↓/Enter/Escape)
 * - Grouped results by type
 * - Highlighted search terms
 * - Loading states and error handling
 *
 * @module src/components/search/GlobalSearchWithAutocomplete
 */

'use client'

import React, { useRef, useEffect, useState, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  MagnifyingGlassIcon,
  TicketIcon,
  UserIcon,
  FolderIcon,
  BookOpenIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { useDebouncedSearch, SearchSuggestion } from '@/lib/hooks/useDebouncedSearch'

interface GlobalSearchWithAutocompleteProps {
  /** Additional CSS classes */
  className?: string
  /** Placeholder text */
  placeholder?: string
  /** Show on mobile */
  isMobile?: boolean
  /** Callback when search is closed (mobile) */
  onClose?: () => void
  /** Auto focus on mount */
  autoFocus?: boolean
}

/**
 * Get icon component by name
 */
const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = {
    TicketIcon,
    UserIcon,
    FolderIcon,
    BookOpenIcon,
    ClockIcon
  }
  return icons[iconName] || MagnifyingGlassIcon
}

/**
 * Get type display name
 */
const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    ticket: 'Tickets',
    user: 'Usuários',
    category: 'Categorias',
    knowledge: 'Base de Conhecimento'
  }
  return labels[type] || type
}

/**
 * Highlight matching text
 */
const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query) return text

  const regex = new RegExp(`(${query})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-warning-200 dark:bg-warning-900/30 text-neutral-900 dark:text-neutral-100 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export default function GlobalSearchWithAutocomplete({
  className = '',
  placeholder = 'Buscar tickets, artigos, usuários...',
  isMobile = false,
  onClose,
  autoFocus = false
}: GlobalSearchWithAutocompleteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const {
    query,
    setQuery,
    suggestions,
    relatedTerms,
    loading,
    error,
    showDropdown,
    setShowDropdown,
    clear
  } = useDebouncedSearch({
    delay: 300,
    minLength: 2,
    limit: 10,
    enableCache: true
  })

  /**
   * Group suggestions by type
   */
  const groupedSuggestions = suggestions.reduce((acc, suggestion) => {
    if (!acc[suggestion.type]) {
      acc[suggestion.type] = []
    }
    acc[suggestion.type].push(suggestion)
    return acc
  }, {} as Record<string, SearchSuggestion[]>)

  /**
   * Handle suggestion selection
   */
  const handleSelect = (suggestion: SearchSuggestion) => {
    router.push(suggestion.url)
    clear()
    setShowDropdown(false)
    onClose?.()
  }

  /**
   * Handle search submit
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      // If there's a selected suggestion, navigate to it
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelect(suggestions[selectedIndex])
      } else {
        // Otherwise, navigate to full search results
        router.push(`/search?q=${encodeURIComponent(query)}`)
        clear()
        setShowDropdown(false)
        onClose?.()
      }
    }
  }

  /**
   * Keyboard navigation
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break

      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setSelectedIndex(-1)
        break

      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault()
          handleSelect(suggestions[selectedIndex])
        }
        break
    }
  }

  /**
   * Auto focus
   */
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  /**
   * Click outside to close
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /**
   * Scroll selected item into view
   */
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      )
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        })
      }
    }
  }, [selectedIndex])

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <form onSubmit={handleSubmit} role="search">
        <div className="relative">
          <MagnifyingGlassIcon
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            placeholder={placeholder}
            className={`
              input pl-10 pr-10 text-sm
              ${isMobile ? 'w-full' : 'w-48 md:w-64 lg:w-80'}
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500
              transition-all duration-200
            `}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(-1)
              setShowDropdown(true)
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowDropdown(true)
              }
            }}
            onKeyDown={handleKeyDown}
            aria-label="Campo de busca global"
            aria-autocomplete="list"
            aria-controls="search-dropdown"
            aria-expanded={showDropdown}
            autoComplete="off"
          />

          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={() => {
                clear()
                inputRef.current?.focus()
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              aria-label="Limpar busca"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      </form>

      {/* Autocomplete Dropdown */}
      {showDropdown && (query.length >= 2) && (
        <div
          ref={dropdownRef}
          id="search-dropdown"
          className={`
            absolute top-full left-0 right-0 mt-2
            bg-white dark:bg-neutral-800
            border border-neutral-200 dark:border-neutral-700
            rounded-lg shadow-large
            max-h-[70vh] overflow-y-auto
            z-50
            animate-fade-in
          `}
          role="listbox"
          aria-label="Sugestões de busca"
        >
          {error && (
            <div className="p-4 text-sm text-error-600 dark:text-error-400">
              {error}
            </div>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <div className="p-6 text-center">
              <MagnifyingGlassIcon className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm text-description">
                Nenhum resultado encontrado para "{query}"
              </p>
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && (
            <>
              {/* Grouped Results */}
              {Object.entries(groupedSuggestions).map(([type, items]) => {
                const startIndex = suggestions.findIndex(s => s.type === type)

                return (
                  <div key={type} className="border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                    {/* Type Header */}
                    <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900/50">
                      <h3 className="text-xs font-semibold text-description uppercase tracking-wider">
                        {getTypeLabel(type)}
                      </h3>
                    </div>

                    {/* Items */}
                    <div className="py-1">
                      {items.map((suggestion, idx) => {
                        const globalIndex = startIndex + idx
                        const Icon = getIconComponent(suggestion.icon)
                        const isSelected = globalIndex === selectedIndex

                        return (
                          <button
                            key={suggestion.id}
                            data-index={globalIndex}
                            onClick={() => handleSelect(suggestion)}
                            className={`
                              w-full px-4 py-3 text-left
                              flex items-start space-x-3
                              transition-colors duration-150
                              ${isSelected
                                ? 'bg-brand-50 dark:bg-brand-900/20'
                                : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                              }
                            `}
                            role="option"
                            aria-selected={isSelected}
                          >
                            {/* Icon */}
                            <Icon
                              className={`
                                h-5 w-5 flex-shrink-0 mt-0.5
                                ${isSelected
                                  ? 'text-brand-600 dark:text-brand-400'
                                  : 'text-neutral-400'
                                }
                              `}
                            />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className={`
                                text-sm font-medium truncate
                                ${isSelected
                                  ? 'text-brand-900 dark:text-brand-100'
                                  : 'text-neutral-900 dark:text-neutral-100'
                                }
                              `}>
                                {highlightText(suggestion.title, query)}
                              </p>
                              <p className="text-xs text-description truncate mt-0.5">
                                {suggestion.subtitle}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Related Terms */}
              {relatedTerms.length > 0 && (
                <div className="border-t border-neutral-200 dark:border-neutral-700 p-3 bg-neutral-50 dark:bg-neutral-900/50">
                  <p className="text-xs font-medium text-description mb-2">
                    Buscas relacionadas:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {relatedTerms.map((term, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setQuery(term)
                          inputRef.current?.focus()
                        }}
                        className="text-xs px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* View All Results */}
              <div className="border-t border-neutral-200 dark:border-neutral-700 p-2">
                <button
                  onClick={() => {
                    router.push(`/search?q=${encodeURIComponent(query)}`)
                    clear()
                    setShowDropdown(false)
                    onClose?.()
                  }}
                  className="w-full px-4 py-2 text-sm text-center text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors font-medium"
                >
                  Ver todos os resultados para "{query}"
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mobile close button */}
      {isMobile && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-0 top-0 btn btn-ghost p-2"
          aria-label="Fechar busca"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}
