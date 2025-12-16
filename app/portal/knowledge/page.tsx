'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  FolderIcon,
  ArrowLeftIcon,
  HandThumbUpIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import {
  HandThumbUpIcon as _HandThumbUpSolidIcon,
  StarIcon as StarSolidIcon
} from '@heroicons/react/24/solid'

interface KnowledgeArticle {
  id: number
  title: string
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

export default function KnowledgeBasePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchArticles()
    fetchCategories()
  }, [selectedCategory, searchQuery])

  const fetchArticles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') params.append('category', selectedCategory)
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/knowledge/articles?${params}`)
      const data = await response.json()

      if (data.success) {
        setArticles(data.articles)
      }
    } catch (error) {
      logger.error('Error fetching articles', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/knowledge/categories')
      const data = await response.json()

      if (data.success) {
        setCategories(data.categories)
      }
    } catch (error) {
      logger.error('Error fetching categories', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchArticles()
  }

  const goBack = () => {
    router.push('/portal')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={goBack}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <BookOpenIcon className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Base de Conhecimento
                </h1>
                <p className="text-gray-600">
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Categorias
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Todas</span>
                    <span className="text-sm text-gray-500">
                      {articles.length}
                    </span>
                  </div>
                </button>
                {categories.map((category) => (
                  <button
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedCategory === category.name
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{category.name}</span>
                      <span className="text-sm text-gray-500">
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
            {/* Search Bar */}
            <div className="mb-8">
              <form onSubmit={handleSearch} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar artigos..."
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </form>
            </div>

            {/* Featured Articles */}
            {selectedCategory === 'all' && !searchQuery && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Artigos em Destaque
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {articles
                    .filter(article => article.featured)
                    .slice(0, 4)
                    .map((article) => (
                      <div
                        key={article.id}
                        onClick={() => router.push(`/portal/knowledge/${article.id}`)}
                        className="bg-gradient-to-br from-yellow-50 to-orange-50 p-6 rounded-lg border border-yellow-200 cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <StarSolidIcon className="w-5 h-5 text-yellow-500" />
                          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                            {article.category}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {article.excerpt}
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
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
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedCategory === 'all' ? 'Todos os Artigos' : `Categoria: ${selectedCategory}`}
                </h2>
                <span className="text-sm text-gray-500">
                  {articles.length} artigo{articles.length !== 1 ? 's' : ''} encontrado{articles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
                      <div className="animate-pulse">
                        <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
                        <div className="flex space-x-4">
                          <div className="h-3 bg-gray-200 rounded w-20"></div>
                          <div className="h-3 bg-gray-200 rounded w-16"></div>
                          <div className="h-3 bg-gray-200 rounded w-24"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : articles.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpenIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum artigo encontrado
                  </h3>
                  <p className="text-gray-600">
                    {searchQuery
                      ? 'Tente ajustar sua busca ou escolha outra categoria.'
                      : 'Não há artigos nesta categoria ainda.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {articles.map((article) => (
                    <div
                      key={article.id}
                      onClick={() => router.push(`/portal/knowledge/${article.id}`)}
                      className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <FolderIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{article.category}</span>
                          {article.featured && (
                            <StarSolidIcon className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(article.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                        {article.title}
                      </h3>

                      <p className="text-gray-600 mb-4 line-clamp-2">
                        {article.excerpt}
                      </p>

                      <div className="flex items-center justify-between text-sm text-gray-500">
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}