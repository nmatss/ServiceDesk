'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  FolderIcon,
  ArrowLeftIcon,
  HandThumbUpIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import {
  StarIcon as StarSolidIcon
} from '@heroicons/react/24/solid'

interface KnowledgeArticle {
  id: number
  title: string
  slug?: string
  excerpt: string
  category: string
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  createdAt: string
  authorName: string
  featured: boolean
}

interface Category {
  name: string
  count: number
}

interface KnowledgePageClientProps {
  initialData: {
    articles: KnowledgeArticle[]
    categories: Category[]
  }
}

type SortOption = 'recent' | 'popular' | 'helpful'

export default function KnowledgePageClient({ initialData }: KnowledgePageClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const router = useRouter()

  // Client-side filtering and sorting
  const filteredAndSortedArticles = useMemo(() => {
    let filtered = [...initialData.articles]

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(article => article.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.excerpt.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query)
      )
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        filtered.sort((a, b) => b.viewCount - a.viewCount)
        break
      case 'helpful':
        filtered.sort((a, b) => b.helpfulCount - a.helpfulCount)
        break
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }

    return filtered
  }, [initialData.articles, selectedCategory, searchQuery, sortBy])

  const featuredArticles = useMemo(() => {
    return filteredAndSortedArticles.filter(article => article.featured)
  }, [filteredAndSortedArticles])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedArticles.length / itemsPerPage)
  const paginatedArticles = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredAndSortedArticles.slice(start, start + itemsPerPage)
  }, [filteredAndSortedArticles, currentPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchQuery, sortBy])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 animate-fade-in">
      {/* Header */}
      <div className="glass-panel shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/portal')}
              aria-label="Voltar ao portal"
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors flex-shrink-0"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <BookOpenIcon className="w-6 h-6 sm:w-8 sm:h-8 text-brand-600 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                Base de Conhecimento
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
                Encontre respostas para suas dúvidas
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Categories */}
          <div className="lg:col-span-1">
            <div className="glass-panel rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3 sm:mb-4">
                Categorias
              </h3>
              <div className="flex flex-wrap lg:flex-col gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`text-left px-3 py-2 min-h-[44px] sm:min-h-0 rounded-md transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  } lg:w-full`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>Todas</span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {initialData.articles.length}
                    </span>
                  </div>
                </button>
                {initialData.categories.map((category) => (
                  <button
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    className={`text-left px-3 py-2 min-h-[44px] sm:min-h-0 rounded-md transition-colors ${
                      selectedCategory === category.name
                        ? 'bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    } lg:w-full`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{category.name}</span>
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        {category.count}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Search Bar and Sort */}
            <div className="mb-8 space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar artigos..."
                  aria-label="Buscar artigos na base de conhecimento"
                  className="block w-full pl-10 pr-3 py-3 text-base sm:text-sm border border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Sort Options */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-end gap-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Ordenar por:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSortBy('recent')}
                    className={`px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm rounded-md transition-colors ${
                      sortBy === 'recent'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    Mais Recentes
                  </button>
                  <button
                    onClick={() => setSortBy('popular')}
                    className={`px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm rounded-md transition-colors ${
                      sortBy === 'popular'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    Mais Vistos
                  </button>
                  <button
                    onClick={() => setSortBy('helpful')}
                    className={`px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm rounded-md transition-colors ${
                      sortBy === 'helpful'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    Mais Úteis
                  </button>
                </div>
              </div>
            </div>

            {/* Featured Articles */}
            {selectedCategory === 'all' && !searchQuery && featuredArticles.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Artigos em Destaque
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featuredArticles.slice(0, 4).map((article) => (
                    <div
                      key={article.id}
                      onClick={() => router.push(`/knowledge/article/${article.slug || article.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/knowledge/article/${article.slug || article.id}`) } }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ler artigo: ${article.title}`}
                      className="bg-gradient-to-br from-warning-50 to-warning-100 dark:from-warning-900/20 dark:to-warning-900/30 p-6 rounded-lg border border-warning-200 dark:border-warning-800 cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <StarSolidIcon className="w-5 h-5 text-warning-500" />
                        <span className="text-xs text-warning-600 dark:text-warning-400 bg-warning-100 dark:bg-warning-900/40 px-2 py-1 rounded-full">
                          {article.category}
                        </span>
                      </div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 line-clamp-2">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                        <span>Por {article.authorName}</span>
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center">
                            <EyeIcon className="w-4 h-4 mr-1" />
                            {article.viewCount}
                          </span>
                          <span className="flex items-center">
                            <HandThumbUpIcon className="w-4 h-4 mr-1" />
                            {article.helpfulCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Articles List */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  {selectedCategory === 'all' ? 'Todos os Artigos' : `Categoria: ${selectedCategory}`}
                </h2>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {filteredAndSortedArticles.length} artigo{filteredAndSortedArticles.length !== 1 ? 's' : ''} encontrado{filteredAndSortedArticles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredAndSortedArticles.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpenIcon className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                    Nenhum artigo encontrado
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    {searchQuery
                      ? 'Tente ajustar sua busca ou escolha outra categoria.'
                      : 'Não há artigos nesta categoria ainda.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {paginatedArticles.map((article) => (
                    <div
                      key={article.id}
                      onClick={() => router.push(`/knowledge/article/${article.slug || article.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/knowledge/article/${article.slug || article.id}`) } }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ler artigo: ${article.title}`}
                      className="glass-panel p-4 sm:p-6 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <div className="flex items-center gap-2">
                          <FolderIcon className="w-4 h-4 text-neutral-400" />
                          <span className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">{article.category}</span>
                          {article.featured && (
                            <StarSolidIcon className="w-4 h-4 text-warning-500" />
                          )}
                        </div>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0 ml-2">
                          {new Date(article.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                        {article.title}
                      </h3>

                      <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mb-3 sm:mb-4 line-clamp-2">
                        {article.excerpt}
                      </p>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                        <span>Por {article.authorName}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center">
                            <EyeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                            {article.viewCount}
                          </span>
                          <span className="flex items-center">
                            <HandThumbUpIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                            {article.helpfulCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-1 sm:gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                      </button>

                      <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          const showPage =
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)

                          if (!showPage) {
                            if (page === currentPage - 2 || page === currentPage + 2) {
                              return (
                                <span key={page} className="px-2 py-2 text-neutral-500 dark:text-neutral-400">
                                  ...
                                </span>
                              )
                            }
                            return null
                          }

                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-3 sm:px-4 py-2 rounded-md transition-colors ${
                                currentPage === page
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-600'
                              }`}
                            >
                              {page}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border border-neutral-300 dark:border-neutral-600 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRightIcon className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
