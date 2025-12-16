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
  FunnelIcon
} from '@heroicons/react/24/outline'
import { useDebounce } from '@/src/hooks/useDebounce'
import { sanitizeHTML } from '@/lib/security/sanitize'

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

        router.replace(`/knowledge/search?${newParams}`, { scroll: false })
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/knowledge')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Voltar para Base de Conhecimento
          </button>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Buscar na Base de Conhecimento
          </h1>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar artigos, soluções, tutoriais..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-4 py-3 border rounded-lg transition-colors ${
                showFilters
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              Filtros
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">
                  Categoria:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="text-sm text-blue-600 hover:text-blue-700"
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Buscando...</p>
          </div>
        )}

        {/* Search Results */}
        {results && !loading && (
          <div>
            {/* Search Info */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {results.total > 0
                  ? `${results.total} resultado${results.total > 1 ? 's' : ''} encontrado${results.total > 1 ? 's' : ''}`
                  : 'Nenhum resultado encontrado'
                }
              </h2>

              {query && (
                <p className="text-gray-600">
                  Buscando por: <strong>"{query}"</strong>
                  {selectedCategory && ` na categoria "${selectedCategory}"`}
                </p>
              )}
            </div>

            {/* Suggestions */}
            {results.suggestions.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  Você quis dizer:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {results.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => setQuery(suggestion)}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category Suggestions */}
            {results.categorySuggestions.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Categorias relacionadas:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {results.categorySuggestions.map((category) => (
                    <button
                      key={category.slug}
                      onClick={() => setSelectedCategory(category.slug)}
                      className="flex items-center px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50 transition-colors"
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
                    className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3
                          className="text-lg font-semibold text-gray-900 mb-2"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHTML(highlightMatches(result.title, result.matches?.filter(m => m.key === 'title')))
                          }}
                        />

                        <p
                          className="text-gray-600 mb-3"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHTML(highlightMatches(result.summary, result.matches?.filter(m => m.key === 'summary')))
                          }}
                        />

                        <div className="flex items-center space-x-4 text-sm text-gray-500">
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
                        <div className="text-sm font-medium text-blue-600">
                          {formatScore(result.score)}% relevante
                        </div>
                      </div>
                    </div>

                    {/* Matches Preview */}
                    {result.matches && result.matches.length > 0 && (
                      <div className="border-t border-gray-100 pt-3">
                        <div className="text-xs text-gray-500 mb-2">
                          Correspondências encontradas:
                        </div>
                        <div className="space-y-1">
                          {result.matches.slice(0, 3).map((match, index) => (
                            <div key={index} className="text-sm">
                              <span className="font-medium text-gray-700 capitalize">
                                {match.key}:
                              </span>{' '}
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHTML(highlightMatches(
                                    match.value.length > 100
                                      ? match.value.substring(0, 100) + '...'
                                      : match.value,
                                    [match]
                                  ))
                                }}
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
                <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-gray-600 mb-4">
                  Tente usar termos diferentes ou mais gerais
                </p>
                <div className="space-y-2 text-sm text-gray-500">
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
            <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Digite algo para começar a buscar
            </h3>
            <p className="text-gray-600">
              Use palavras-chave para encontrar artigos, tutoriais e soluções
            </p>
          </div>
        )}
      </div>
    </div>
  )
}