'use client'

import { useState, useEffect } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { logger } from '@/lib/monitoring/logger';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  PencilIcon,
  TrashIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ChartBarIcon,
  SparklesIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'
import { ArticleListSkeleton, StatsCardsSkeleton } from '@/components/ui/states'
import { LoadingError, KnowledgeBaseEmptyState, FilterEmptyState } from '@/components/ui/states'

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
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')

  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    fetchArticles()
  }, [debouncedSearch, selectedCategory, selectedStatus])

  const fetchArticles = async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (selectedCategory) params.append('category', selectedCategory)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)

      // SECURITY: Use httpOnly cookies for authentication - tenant is extracted server-side
      const response = await fetch(`/api/knowledge?${params}`, {
        credentials: 'include' // Use httpOnly cookies
      })

      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles)
        setCategories(data.categories)
      } else {
        setError('Erro ao carregar artigos')
      }
    } catch (error) {
      logger.error('Erro ao buscar artigos', error)
      setError('Erro ao carregar artigos. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteArticle = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este artigo?')) return

    try {
      // SECURITY: Use httpOnly cookies for authentication - tenant is extracted server-side
      const response = await fetch(`/api/knowledge/${id}`, {
        method: 'DELETE',
        credentials: 'include' // Use httpOnly cookies
      })

      if (response.ok) {
        fetchArticles()
      }
    } catch (error) {
      logger.error('Erro ao excluir artigo', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
      case 'draft':
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'
      case 'archived':
        return 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400'
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'
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

  // Calculate stats
  const totalArticles = articles.length
  const publishedArticles = articles.filter(a => a.status === 'published').length
  const draftArticles = articles.filter(a => a.status === 'draft').length
  const totalViews = articles.reduce((sum, a) => sum + a.view_count, 0)
  const avgHelpfulRate = articles.length > 0
    ? Math.round(
        articles.reduce((sum, a) => {
          const total = a.helpful_count + a.not_helpful_count
          return sum + (total > 0 ? (a.helpful_count / total) * 100 : 0)
        }, 0) / articles.length
      )
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modern Header */}
      <PageHeader
        title="Base de Conhecimento"
        description="Gerencie artigos e documentação do sistema"
        icon={BookOpenIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Base de Conhecimento' }
        ]}
        actions={[
          {
            label: 'Novo Artigo',
            icon: PlusIcon,
            variant: 'primary',
            onClick: () => logger.info('Create new article')
          }
        ]}
      />

      {/* Stats Cards */}
      <StatsGrid cols={4}>
        <StatsCard
          title="Total de Artigos"
          value={totalArticles}
          icon={DocumentTextIcon}
          color="brand"
          loading={loading}
          change={totalArticles > 0 ? { value: 12, type: 'increase', period: 'vs mês anterior' } : undefined}
        />
        <StatsCard
          title="Artigos Publicados"
          value={publishedArticles}
          icon={BookOpenIcon}
          color="success"
          loading={loading}
          change={publishedArticles > 0 ? { value: 8, type: 'increase', period: 'vs mês anterior' } : undefined}
        />
        <StatsCard
          title="Rascunhos"
          value={draftArticles}
          icon={PencilIcon}
          color="warning"
          loading={loading}
        />
        <StatsCard
          title="Visualizações Totais"
          value={totalViews}
          icon={EyeIcon}
          color="info"
          loading={loading}
          change={totalViews > 0 ? { value: 25, type: 'increase', period: 'vs mês anterior' } : undefined}
        />
      </StatsGrid>

      {/* Modern Filters */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <FunnelIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Filtros
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Search Input */}
          <div>
            <label htmlFor="search" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Buscar Artigos
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-5 w-5 text-neutral-400" aria-hidden="true" />
              </div>
              <input
                id="search"
                name="search"
                type="search"
                placeholder="Buscar por título, conteúdo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label htmlFor="category" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Categoria
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
            >
              <option value="">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Status
            </label>
            <select
              id="status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input-field"
            >
              <option value="all">Todos os status</option>
              <option value="published">Publicados</option>
              <option value="draft">Rascunhos</option>
              <option value="archived">Arquivados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Artigos ({articles.length})
            </h3>
          </div>
          {articles.length > 0 && (
            <span className="text-sm text-muted-content">
              {search || selectedCategory || selectedStatus !== 'all' ? 'Filtrados' : 'Todos os artigos'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-neutral-200 dark:border-neutral-700"></div>
              <div className="absolute top-0 h-12 w-12 rounded-full border-4 border-brand-600 dark:border-brand-400 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 text-sm text-muted-content">Carregando artigos...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-4">
              <div className="h-16 w-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                <DocumentTextIcon className="h-8 w-8 text-neutral-400" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                <SparklesIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              Nenhum artigo encontrado
            </h3>
            <p className="text-sm text-muted-content mb-6 text-center max-w-md">
              {search || selectedCategory || selectedStatus !== 'all'
                ? 'Tente ajustar os filtros para encontrar artigos.'
                : 'Comece criando seu primeiro artigo para construir sua base de conhecimento.'}
            </p>
            <button
              type="button"
              onClick={() => logger.info('Create new article')}
              className="btn btn-primary"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Novo Artigo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article, index) => (
              <div
                key={article.id}
                className="group relative glass-panel p-6 hover:shadow-large hover:-translate-y-1 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title and Status */}
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {article.title}
                      </h3>
                      <span className={`badge shrink-0 ${
                        article.status === 'published' ? 'badge-success' :
                        article.status === 'draft' ? 'badge-warning' :
                        'badge-error'
                      }`}>
                        {getStatusText(article.status)}
                      </span>
                    </div>

                    {/* Excerpt */}
                    {article.excerpt && (
                      <p className="text-sm text-description line-clamp-2 mb-4">
                        {article.excerpt}
                      </p>
                    )}

                    {/* Category Badge */}
                    {article.category && (
                      <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-medium mb-4">
                        <BookOpenIcon className="h-3 w-3" />
                        {article.category}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-content">
                      <span className="flex items-center gap-1">
                        Por <span className="font-medium text-neutral-700 dark:text-neutral-300">{article.author_name}</span>
                      </span>
                      <span>•</span>
                      <span>{formatDate(article.created_at)}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center gap-2 text-sm">
                        <EyeIcon className="h-4 w-4 text-blue-500" />
                        <span className="text-description">{article.view_count}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <HandThumbUpIcon className="h-4 w-4 text-success-500" />
                        <span className="text-description">{article.helpful_count}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <HandThumbDownIcon className="h-4 w-4 text-error-500" />
                        <span className="text-description">{article.not_helpful_count}</span>
                      </div>
                      {article.helpful_count + article.not_helpful_count > 0 && (
                        <>
                          <span className="text-neutral-400 dark:text-neutral-600">•</span>
                          <span className="text-sm text-description">
                            {Math.round((article.helpful_count / (article.helpful_count + article.not_helpful_count)) * 100)}% útil
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => logger.info('Edit article', article.id)}
                      aria-label="Editar artigo"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArticle(article.id)}
                      className="btn btn-danger"
                      aria-label="Excluir artigo"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-xl pointer-events-none bg-gradient-brand" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}