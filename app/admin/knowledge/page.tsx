'use client'

import { useState, useEffect } from 'react'
import AdminDashboard from '@/src/components/admin/AdminDashboard'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

interface Article {
  id: number
  title: string
  content: string
  excerpt: string
  category: string
  tags: string
  status: string
  view_count: number
  helpful_count: number
  not_helpful_count: number
  created_at: string
  updated_at: string
  author_name: string
}

interface Category {
  category: string
  count: number
}

export default function KnowledgePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')

  useEffect(() => {
    fetchArticles()
  }, [search, selectedCategory, selectedStatus])

  const fetchArticles = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedCategory) params.append('category', selectedCategory)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)

      const response = await fetch(`/api/knowledge?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': '1'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles)
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Erro ao buscar artigos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteArticle = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este artigo?')) return

    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': '1'
        }
      })

      if (response.ok) {
        fetchArticles()
      }
    } catch (error) {
      console.error('Erro ao excluir artigo:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'archived':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'published':
        return 'Publicado'
      case 'draft':
        return 'Rascunho'
      case 'archived':
        return 'Arquivado'
      default:
        return status
    }
  }

  return (
    <AdminDashboard>
      <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Base de Conhecimento
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie artigos e documentação do sistema
            </p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              Novo Artigo
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="search" className="sr-only">
              Buscar
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                id="search"
                name="search"
                type="search"
                placeholder="Buscar artigos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            >
              <option value="">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            >
              <option value="all">Todos os status</option>
              <option value="published">Publicados</option>
              <option value="draft">Rascunhos</option>
              <option value="archived">Arquivados</option>
            </select>
          </div>
        </div>

        {/* Articles List */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          <div className="px-4 py-6 sm:p-8">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm text-gray-500">Carregando artigos...</p>
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-gray-900">Nenhum artigo encontrado</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comece criando um novo artigo para sua base de conhecimento.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                  >
                    <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
                    Novo Artigo
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {article.title}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                              article.status
                            )}`}
                          >
                            {getStatusText(article.status)}
                          </span>
                        </div>

                        {article.excerpt && (
                          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                            {article.excerpt}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span>Por {article.author_name}</span>
                          <span>•</span>
                          <span>{article.category}</span>
                          <span>•</span>
                          <span>{formatDate(article.created_at)}</span>
                        </div>

                        <div className="mt-4 flex items-center space-x-6">
                          <div className="flex items-center space-x-1">
                            <EyeIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-500">{article.view_count}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <HandThumbUpIcon className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-gray-500">{article.helpful_count}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <HandThumbDownIcon className="h-4 w-4 text-red-400" />
                            <span className="text-sm text-gray-500">{article.not_helpful_count}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArticle(article.id)}
                          className="inline-flex items-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminDashboard>
  )
}