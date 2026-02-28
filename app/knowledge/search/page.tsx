'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  EyeIcon,
  HandThumbUpIcon,
  ArrowLeftIcon,
  FunnelIcon,
  HomeIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline'
import { useDebounce } from '@/src/hooks/useDebounce'
import { SafeHTML } from '@/components/SafeHTML'
import { PageHeader } from '@/components/ui/PageHeader'

interface SearchResult {
  id: number
  title: string
  slug: string
  summary: string
  category: {
    name: string
    slug: string
    color: string
  }
  score: number
  matches: Array<{
    key: string
    value: string
    indices: Array<[number, number]>
  }>
}

interface SearchData {
  results: SearchResult[]
  categorySuggestions: Array<{
    name: string
    slug: string
    icon: string
    color: string
  }>
  suggestions: string[]
  total: number
}

export default function KnowledgeSearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Debounce search query
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    // Carregar query inicial da URL
    const initialQuery = searchParams.get('q')
    const initialCategory = searchParams.get('category')

    if (initialQuery) {
      setQuery(initialQuery)
    }
    if (initialCategory) {
      setSelectedCategory(initialCategory)
    }
  }, [searchParams])

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      performSearch(debouncedQuery, selectedCategory)
    } else {
      setResults(null)
    }
  }, [debouncedQuery, selectedCategory])

  const performSearch = useCallback(async (searchQuery: string, category?: string) => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        q: searchQuery,
        limit: '20'
      })

      if (category) {
        params.append('category', category)
      }

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/knowledge/search?${params}`, {
        credentials: 'include' // Use httpOnly cookies
      })

      const data = await response.json()

      if (data.success) {
        setResults(data)

        // Atualizar URL
        const newParams = new URLSearchParams()
        newParams.set('q', searchQuery)
        if (category) {
          newParams.set('category', category)
        }

        router.push(`/knowledge/search?${newParams}`, { scroll: false })
      }

    } catch (error) {
      logger.error('Error searching knowledge base', error)
    } finally {
      setLoading(false)
    }
  }, [router])

  const highlightMatches = (text: string, matches?: Array<{ indices: Array<[number, number]> }>) => {
    if (!matches || matches.length === 0) return text

    // Combinar todos os índices de matches
    const allIndices: Array<[number, number]> = []
    matches.forEach(match => {
      match.indices.forEach(index => allIndices.push(index))
    })

    // Ordenar por posição
    allIndices.sort((a, b) => a[0] - b[0])

    if (allIndices.length === 0) return text

    let highlightedText = ''
    let lastIndex = 0

    allIndices.forEach(([start, end]) => {
      // Adicionar texto antes do match
      highlightedText += text.substring(lastIndex, start)

      // Adicionar texto destacado
      highlightedText += `<mark class="bg-yellow-200 font-medium">${text.substring(start, end + 1)}</mark>`

      lastIndex = end + 1
    })

    // Adicionar texto restante
    highlightedText += text.substring(lastIndex)

    return highlightedText
  }

  const formatScore = (score: number) => {
    return Math.round(score * 100)
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 animate-fade-in">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <PageHeader
          title="Buscar na Base de Conhecimento"
          description="Encontre artigos, soluções e tutoriais"
          icon={MagnifyingGlassIcon}
          breadcrumbs={[
            { label: 'Início', href: '/dashboard', icon: HomeIcon },
            { label: 'Base de Conhecimento', href: '/knowledge', icon: BookOpenIcon },
            { label: 'Buscar' }
          ]}
          backButton={{
            label: 'Voltar',
            href: '/knowledge'
          }}
        />

        {/* Search Form */}
        <div className="glass-panel rounded-lg p-6 mb-6 animate-slide-up">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-icon-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar artigos, soluções, tutoriais..."
                className="w-full pl-10 pr-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-4 py-3 border rounded-lg transition-all ${
                showFilters
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300'
                  : 'border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              Filtros
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Categoria:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="border border-neutral-300 dark:border-neutral-600 rounded-md px-3 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Todas as categorias</option>
                  {results?.categorySuggestions.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>

                {selectedCategory && (
                  <button
                    onClick={() => setSelectedCategory('')}
                    className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
            <p className="text-description">Buscando...</p>
          </div>
        )}

        {/* Search Results */}
        {results && !loading && (
          <div>
            {/* Search Info */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                {results.total > 0
                  ? `${results.total} resultado${results.total > 1 ? 's' : ''} encontrado${results.total > 1 ? 's' : ''}`
                  : 'Nenhum resultado encontrado'
                }
              </h2>

              {query && (
                <p className="text-description">
                  Buscando por: <strong>"{query}"</strong>
                  {selectedCategory && ` na categoria "${selectedCategory}"`}
                </p>
              )}
            </div>

            {/* Suggestions */}
            {results.suggestions.length > 0 && (
              <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-brand-900 dark:text-brand-300 mb-2">
                  Você quis dizer:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {results.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setQuery(suggestion)}
                      className="px-3 py-1 bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300 rounded-full text-sm hover:bg-brand-200 dark:hover:bg-brand-900/60 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category Suggestions */}
            {results.categorySuggestions.length > 0 && (
              <div className="bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">
                  Categorias relacionadas:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {results.categorySuggestions.map((category) => (
                    <button
                      key={category.slug}
                      onClick={() => setSelectedCategory(category.slug)}
                      className="flex items-center px-3 py-1 glass-panel border border-neutral-300 dark:border-neutral-600 rounded-full text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      style={{ borderColor: category.color + '40' }}
                    >
                      <span className="mr-2" style={{ color: category.color }}>
                        {category.icon}
                      </span>
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Results List */}
            {results.results.length > 0 ? (
              <div className="space-y-4">
                {results.results.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => router.push(`/knowledge/article/${result.slug}`)}
                    className="glass-panel rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <SafeHTML
                          html={highlightMatches(result.title, result.matches?.filter(m => m.key === 'title'))}
                          as="h3"
                          className="text-lg font-semibold text-neutral-900 dark:text-white mb-2"
                        />

                        <SafeHTML
                          html={highlightMatches(result.summary, result.matches?.filter(m => m.key === 'summary'))}
                          as="p"
                          className="text-description mb-3"
                        />

                        <div className="flex items-center space-x-4 text-sm text-muted-content">
                          {result.category && (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: result.category.color + '20',
                                color: result.category.color
                              }}
                            >
                              {result.category.name}
                            </span>
                          )}

                          <div className="flex items-center space-x-1">
                            <EyeIcon className="w-4 h-4" />
                            <span>Visualizações</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <HandThumbUpIcon className="w-4 h-4" />
                            <span>Útil</span>
                          </div>
                        </div>
                      </div>

                      <div className="ml-4 text-right">
                        <div className="text-sm font-medium text-brand-600 dark:text-brand-400">
                          {formatScore(result.score)}% relevante
                        </div>
                      </div>
                    </div>

                    {/* Matches Preview */}
                    {result.matches && result.matches.length > 0 && (
                      <div className="border-t border-neutral-100 dark:border-neutral-700 pt-3">
                        <div className="text-xs text-muted-content mb-2">
                          Correspondências encontradas:
                        </div>
                        <div className="space-y-1">
                          {result.matches.slice(0, 3).map((match, index) => (
                            <div key={index} className="text-sm">
                              <span className="font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                                {match.key}:
                              </span>{' '}
                              <SafeHTML
                                html={highlightMatches(
                                  match.value.length > 100
                                    ? match.value.substring(0, 100) + '...'
                                    : match.value,
                                  [match]
                                )}
                                as="span"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : query.trim().length >= 2 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-description mb-4">
                  Tente usar termos diferentes ou mais gerais
                </p>
                <div className="space-y-2 text-sm text-muted-content">
                  <p>• Verifique a ortografia das palavras</p>
                  <p>• Use sinônimos ou termos relacionados</p>
                  <p>• Tente buscar por categorias</p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Initial State */}
        {!results && !loading && (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
              Digite algo para começar a buscar
            </h3>
            <p className="text-description">
              Use palavras-chave para encontrar artigos, tutoriais e soluções
            </p>
          </div>
        )}
      </div>
    </div>
  )
}