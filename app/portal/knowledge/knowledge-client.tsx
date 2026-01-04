'use client'

import { useState, useMemo } from 'react'
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
  useMemo(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchQuery, sortBy])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 animate-fade-in">
      {/* Header */}
      <div className="glass-panel shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/portal')}
                className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <BookOpenIcon className="w-8 h-8 text-brand-600" />
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">
                  Base de Conhecimento
                </h1>
                <p className="text-neutral-600">
                  Encontre respostas para suas dúvidas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Categories */}
          <div className="lg:col-span-1">
            <div className="glass-panel rounded-lg shadow-sm border border-neutral-200 p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Categorias
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Todas</span>
                    <span className="text-sm text-neutral-500">
                      {initialData.articles.length}
                    </span>
                  </div>
                </button>
                {initialData.categories.map((category) => (
                  <button
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedCategory === category.name
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{category.name}</span>
                      <span className="text-sm text-neutral-500">
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
                  className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Sort Options */}
              <div className="flex items-center justify-end space-x-2">
                <span className="text-sm text-neutral-600">Ordenar por:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSortBy('recent')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      sortBy === 'recent'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-300'
                    }`}
                  >
                    Mais Recentes
                  </button>
                  <button
                    onClick={() => setSortBy('popular')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      sortBy === 'popular'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-300'
                    }`}
                  >
                    Mais Vistos
                  </button>
                  <button
                    onClick={() => setSortBy('helpful')}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      sortBy === 'helpful'
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-300'
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
                <h2 className="text-xl font-semibold text-neutral-900 mb-4">
                  Artigos em Destaque
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {featuredArticles.slice(0, 4).map((article) => (
                    <div
                      key={article.id}
                      onClick={() => router.push(`/knowledge/article/${article.slug || article.id}`)}
                      className="bg-gradient-to-br from-warning-50 to-warning-100 p-6 rounded-lg border border-warning-200 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <StarSolidIcon className="w-5 h-5 text-warning-500" />
                        <span className="text-xs text-warning-600 bg-warning-100 px-2 py-1 rounded-full">
                          {article.category}
                        </span>
                      </div>
                      <h3 className="font-semibold text-neutral-900 mb-2 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-sm text-neutral-600 mb-3 line-clamp-2">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-neutral-500">
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
                <h2 className="text-xl font-semibold text-neutral-900">
                  {selectedCategory === 'all' ? 'Todos os Artigos' : `Categoria: ${selectedCategory}`}
                </h2>
                <span className="text-sm text-neutral-500">
                  {filteredAndSortedArticles.length} artigo{filteredAndSortedArticles.length !== 1 ? 's' : ''} encontrado{filteredAndSortedArticles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredAndSortedArticles.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpenIcon className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">
                    Nenhum artigo encontrado
                  </h3>
                  <p className="text-neutral-600">
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
                      className="glass-panel p-6 rounded-lg border border-neutral-200 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <FolderIcon className="w-4 h-4 text-neutral-400" />
                          <span className="text-sm text-neutral-600">{article.category}</span>
                          {article.featured && (
                            <StarSolidIcon className="w-4 h-4 text-warning-500" />
                          )}
                        </div>
                        <span className="text-xs text-neutral-500">
                          {new Date(article.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-neutral-900 mb-2 hover:text-brand-600 transition-colors">
                        {article.title}
                      </h3>

                      <p className="text-neutral-600 mb-4 line-clamp-2">
                        {article.excerpt}
                      </p>

                      <div className="flex items-center justify-between text-sm text-neutral-500">
                        <span>Por {article.authorName}</span>
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center">
                            <EyeIcon className="w-4 h-4 mr-1" />
                            {article.viewCount} visualizações
                          </span>
                          <span className="flex items-center">
                            <HandThumbUpIcon className="w-4 h-4 mr-1" />
                            {article.helpfulCount} útil
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                      </button>

                      <div className="flex space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // Show first, last, current, and pages around current
                          const showPage =
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)

                          if (!showPage) {
                            // Show ellipsis
                            if (page === currentPage - 2 || page === currentPage + 2) {
                              return (
                                <span key={page} className="px-3 py-2 text-neutral-500">
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
                              className={`px-4 py-2 rounded-md transition-colors ${
                                currentPage === page
                                  ? 'bg-brand-600 text-white'
                                  : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-300'
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
                        className="px-3 py-2 border border-neutral-300 rounded-md hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
