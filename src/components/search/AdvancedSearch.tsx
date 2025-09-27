'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  FunnelIcon,
  SparklesIcon,
  ClockIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import { Ticket } from '../tickets/TicketCard'
import TicketCard from '../tickets/TicketCard'

interface SearchFilters {
  query: string
  status: string[]
  priority: string[]
  category: string[]
  assignedAgent: string[]
  user: string[]
  dateRange: {
    from: string
    to: string
  }
  tags: string[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface SearchResult {
  tickets: Ticket[]
  users: any[]
  knowledge_base: any[]
  total: number
  facets: {
    status: Array<{ value: string; count: number }>
    priority: Array<{ value: string; count: number }>
    category: Array<{ value: string; count: number }>
    agents: Array<{ value: string; count: number }>
    tags: Array<{ value: string; count: number }>
  }
}

const initialFilters: SearchFilters = {
  query: '',
  status: [],
  priority: [],
  category: [],
  assignedAgent: [],
  user: [],
  dateRange: { from: '', to: '' },
  tags: [],
  sortBy: 'relevance',
  sortOrder: 'desc'
}

export default function AdvancedSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<SearchFilters>(initialFilters)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searchType, setSearchType] = useState<'all' | 'tickets' | 'users' | 'knowledge'>('all')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Initialize from URL params
  useEffect(() => {
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') as any || 'all'

    setFilters(prev => ({ ...prev, query }))
    setSearchType(type)

    if (query) {
      performSearch({ ...filters, query })
    }
  }, [searchParams])

  // Search suggestions
  useEffect(() => {
    if (filters.query.length > 2) {
      fetchSuggestions(filters.query)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [filters.query])

  const fetchSuggestions = async (query: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
        setShowSuggestions(true)
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    }
  }

  const performSearch = async (searchFilters: SearchFilters) => {
    if (!searchFilters.query.trim()) return

    setLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const params = new URLSearchParams({
        q: searchFilters.query,
        type: searchType,
        sort_by: searchFilters.sortBy,
        sort_order: searchFilters.sortOrder
      })

      // Add array filters
      searchFilters.status.forEach(s => params.append('status[]', s))
      searchFilters.priority.forEach(p => params.append('priority[]', p))
      searchFilters.category.forEach(c => params.append('category[]', c))
      searchFilters.assignedAgent.forEach(a => params.append('agent[]', a))
      searchFilters.user.forEach(u => params.append('user[]', u))
      searchFilters.tags.forEach(t => params.append('tags[]', t))

      // Date range
      if (searchFilters.dateRange.from) params.append('date_from', searchFilters.dateRange.from)
      if (searchFilters.dateRange.to) params.append('date_to', searchFilters.dateRange.to)

      const response = await fetch(`/api/search?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (error) {
      console.error('Error performing search:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setShowSuggestions(false)

    // Update URL
    const params = new URLSearchParams()
    if (filters.query) params.set('q', filters.query)
    if (searchType !== 'all') params.set('type', searchType)

    router.push(`/search?${params}`)
    performSearch(filters)
  }

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)

    if (filters.query) {
      performSearch(newFilters)
    }
  }

  const toggleArrayFilter = (key: keyof SearchFilters, value: string) => {
    const currentArray = filters[key] as string[]
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]

    handleFilterChange(key, newArray)
  }

  const clearFilters = () => {
    setFilters({ ...initialFilters, query: filters.query })
    if (filters.query) {
      performSearch({ ...initialFilters, query: filters.query })
    }
  }

  const hasActiveFilters = () => {
    return filters.status.length > 0 ||
           filters.priority.length > 0 ||
           filters.category.length > 0 ||
           filters.assignedAgent.length > 0 ||
           filters.user.length > 0 ||
           filters.tags.length > 0 ||
           filters.dateRange.from ||
           filters.dateRange.to
  }

  const getSearchIcon = (type: string) => {
    switch (type) {
      case 'tickets': return <DocumentTextIcon className="h-4 w-4" />
      case 'users': return <UserIcon className="h-4 w-4" />
      case 'knowledge': return <SparklesIcon className="h-4 w-4" />
      default: return <MagnifyingGlassIcon className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <MagnifyingGlassIcon className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Busca Avançada</h1>
        </div>
        <p className="text-brand-100">
          Encontre tickets, usuários e artigos da base de conhecimento com ferramentas de busca poderosas
        </p>
      </div>

      {/* Search Form */}
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Main Search Input */}
            <div className="relative">
              <div className="flex">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Digite sua busca..."
                    value={filters.query}
                    onChange={(e) => handleFilterChange('query', e.target.value)}
                    className="input input-bordered w-full pl-10 pr-4 h-12 text-lg"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`btn ml-3 ${showFilters ? 'btn-active' : ''} ${hasActiveFilters() ? 'btn-primary' : ''}`}
                >
                  <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
                  Filtros
                  {hasActiveFilters() && (
                    <span className="badge badge-sm ml-2">
                      {Object.values(filters).flat().filter(Boolean).length - 1}
                    </span>
                  )}
                </button>
                <button type="submit" className="btn btn-primary ml-3" disabled={loading}>
                  {loading ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    <MagnifyingGlassIcon className="h-5 w-5" />
                  )}
                  Buscar
                </button>
              </div>

              {/* Search Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 mt-1"
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        handleFilterChange('query', suggestion)
                        setShowSuggestions(false)
                        searchInputRef.current?.focus()
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <MagnifyingGlassIcon className="h-4 w-4 text-neutral-400" />
                        <span className="text-sm">{suggestion}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Type Tabs */}
            <div className="flex space-x-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
              {[
                { key: 'all', label: 'Tudo', icon: MagnifyingGlassIcon },
                { key: 'tickets', label: 'Tickets', icon: DocumentTextIcon },
                { key: 'users', label: 'Usuários', icon: UserIcon },
                { key: 'knowledge', label: 'Base de Conhecimento', icon: SparklesIcon }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSearchType(key as any)}
                  className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    searchType === key
                      ? 'bg-white dark:bg-neutral-700 text-brand-600 dark:text-brand-400 shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </form>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Filtros Avançados</h3>
                {hasActiveFilters() && (
                  <button
                    onClick={clearFilters}
                    className="btn btn-outline btn-sm"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Limpar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Date Range */}
                <div>
                  <label className="label label-text">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Período
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={filters.dateRange.from}
                      onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, from: e.target.value })}
                      className="input input-bordered input-sm"
                    />
                    <input
                      type="date"
                      value={filters.dateRange.to}
                      onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, to: e.target.value })}
                      className="input input-bordered input-sm"
                    />
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <label className="label label-text">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    Ordenar por
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={filters.sortBy}
                      onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                      className="select select-bordered select-sm flex-1"
                    >
                      <option value="relevance">Relevância</option>
                      <option value="created_at">Data de Criação</option>
                      <option value="updated_at">Última Atualização</option>
                      <option value="priority">Prioridade</option>
                      <option value="status">Status</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="btn btn-outline btn-sm"
                      title={filters.sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
                    >
                      {filters.sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Facet Filters */}
              {results?.facets && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {Object.entries(results.facets).map(([key, values]) => (
                    values.length > 0 && (
                      <div key={key}>
                        <label className="label label-text font-medium capitalize">
                          {key === 'agents' ? 'Agentes' : key}
                        </label>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {values.map((item) => (
                            <label key={item.value} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Array.isArray(filters[key as keyof SearchFilters]) && (filters[key as keyof SearchFilters] as string[])?.includes(item.value)}
                                onChange={() => toggleArrayFilter(key as keyof SearchFilters, item.value)}
                                className="checkbox checkbox-sm"
                              />
                              <span className="text-sm flex-1">{item.value}</span>
                              <span className="badge badge-neutral badge-sm">{item.count}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search Results */}
      {results && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold">
                Resultados da Busca
              </h2>
              <span className="badge badge-neutral">
                {results.total} {results.total === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>
          </div>

          {/* Results Content */}
          {results.total === 0 ? (
            <div className="card">
              <div className="card-body text-center py-12">
                <MagnifyingGlassIcon className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                  Tente ajustar sua busca ou usar termos diferentes
                </p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={clearFilters}
                    className="btn btn-outline"
                  >
                    Limpar Filtros
                  </button>
                  <button
                    onClick={() => handleFilterChange('query', '')}
                    className="btn btn-primary"
                  >
                    Nova Busca
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tickets Results */}
              {results.tickets && results.tickets.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                    Tickets ({results.tickets.length})
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {results.tickets.map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        variant="compact"
                        showActions={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Users Results */}
              {results.users && results.users.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <UserIcon className="h-5 w-5 mr-2" />
                    Usuários ({results.users.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.users.map((user) => (
                      <div key={user.id} className="card card-compact">
                        <div className="card-body">
                          <div className="flex items-center space-x-3">
                            <div className="avatar">
                              <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center">
                                <span className="text-white font-medium">
                                  {user.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">{user.name}</h4>
                              <p className="text-sm text-neutral-600 dark:text-neutral-400">{user.email}</p>
                              <span className="badge badge-sm">{user.role}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Knowledge Base Results */}
              {results.knowledge_base && results.knowledge_base.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <SparklesIcon className="h-5 w-5 mr-2" />
                    Base de Conhecimento ({results.knowledge_base.length})
                  </h3>
                  <div className="space-y-4">
                    {results.knowledge_base.map((article) => (
                      <div key={article.id} className="card">
                        <div className="card-body">
                          <h4 className="font-medium text-lg mb-2">{article.title}</h4>
                          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                            {article.excerpt}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 text-sm text-neutral-500">
                              <span>Categoria: {article.category}</span>
                              <span>Atualizado: {new Date(article.updated_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <button className="btn btn-outline btn-sm">
                              Ver Artigo
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}