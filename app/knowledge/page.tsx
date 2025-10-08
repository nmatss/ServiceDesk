'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  MagnifyingGlassIcon,
  DocumentTextIcon,
  FolderIcon,
  ClockIcon,
  EyeIcon,
  PlusIcon,
  TagIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline'
import { useNotificationHelpers } from '@/src/components/notifications/NotificationProvider'

interface KnowledgeArticle {
  id: number
  title: string
  content: string
  category: string
  tags: string[]
  views: number
  created_at: string
  updated_at: string
  author: string
  slug: string
}

interface KnowledgeCategory {
  id: number
  name: string
  description: string
  article_count: number
  icon: string
}

export default function KnowledgePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [categories, setCategories] = useState<KnowledgeCategory[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [userRole, setUserRole] = useState<'admin' | 'agent' | 'user'>('user')
  const { success, error } = useNotificationHelpers()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const role = localStorage.getItem('user_role') as 'admin' | 'agent' | 'user'

    if (!token) {
      router.push('/auth/login')
      return
    }

    setUserRole(role || 'user')
    fetchKnowledgeData()
  }, [router])

  const fetchKnowledgeData = async () => {
    try {
      setLoading(true)

      // Buscar categorias
      const categoriesResponse = await fetch('/api/knowledge/categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      const categoriesData = await categoriesResponse.json()

      // Buscar artigos
      const articlesResponse = await fetch('/api/knowledge/articles?status=published&limit=50', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      const articlesData = await articlesResponse.json()

      if (categoriesData.success) {
        const mappedCategories: KnowledgeCategory[] = categoriesData.categories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description || '',
          article_count: cat.article_count || 0,
          icon: cat.icon || '📄'
        }))
        setCategories(mappedCategories)
      } else {
        // Fallback para categorias mock se API falhar
        setCategories([
          {
            id: 1,
            name: 'Geral',
            description: 'Artigos gerais',
            article_count: 0,
            icon: '📄'
          }
        ])
      }

      if (articlesData.success) {
        const mappedArticles: KnowledgeArticle[] = articlesData.articles.map((article: any) => ({
          id: article.id,
          title: article.title,
          content: article.summary || 'Sem resumo disponível',
          category: article.category_name || 'Geral',
          tags: article.tags?.map((tag: any) => tag.name) || [],
          views: article.view_count || 0,
          created_at: article.created_at,
          updated_at: article.updated_at,
          author: article.author_name || 'Autor desconhecido',
          slug: article.slug
        }))
        setArticles(mappedArticles)
      } else {
        setArticles([])
      }
    } catch (err) {
      logger.error('Erro ao buscar base de conhecimento', err)
      error('Erro', 'Falha ao carregar base de conhecimento')
    } finally {
      setLoading(false)
    }
  }

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="container-responsive py-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                Base de Conhecimento
              </h1>
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                Encontre soluções e documentação para problemas comuns
              </p>
            </div>
            {(userRole === 'admin' || userRole === 'agent') && (
              <div className="mt-4 lg:mt-0">
                <button
                  onClick={() => router.push('/knowledge/new')}
                  className="btn btn-primary"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Novo Artigo
                </button>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar artigos, soluções ou documentação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-primary pl-10 text-lg py-4"
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>

          {/* Categories */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Categorias
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  selectedCategory === 'all'
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                <div className="flex items-center mb-2">
                  <BookOpenIcon className="h-5 w-5 text-brand-600 dark:text-brand-400 mr-2" />
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    Todos os Artigos
                  </span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {articles.length} artigos
                </p>
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedCategory === category.name
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <span className="text-lg mr-2">{category.icon}</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {category.name}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    {category.description}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">
                    {category.article_count} artigos
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Articles */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {selectedCategory === 'all' ? 'Todos os Artigos' : selectedCategory}
              </h2>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {filteredArticles.length} artigo(s) encontrado(s)
              </span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 animate-pulse">
                    <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-full mb-2"></div>
                    <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3 mb-4"></div>
                    <div className="flex space-x-2 mb-4">
                      <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-16"></div>
                      <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-12"></div>
                    </div>
                    <div className="flex justify-between">
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-20"></div>
                      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                  Nenhum artigo encontrado
                </h3>
                <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                  {searchTerm ? 'Tente buscar com outros termos' : 'Nenhum artigo disponível nesta categoria'}
                </p>
                {(userRole === 'admin' || userRole === 'agent') && (
                  <button
                    onClick={() => router.push('/knowledge/new')}
                    className="btn btn-primary"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Criar Primeiro Artigo
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/knowledge/${article.slug}`)}
                  >
                    <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2 line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4 line-clamp-3">
                      {truncateContent(article.content)}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {article.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
                        >
                          <TagIcon className="h-3 w-3 mr-1" />
                          {tag}
                        </span>
                      ))}
                      {article.tags.length > 3 && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          +{article.tags.length - 3} mais
                        </span>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                      <div className="flex items-center">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        {formatDate(article.updated_at)}
                      </div>
                      <div className="flex items-center">
                        <EyeIcon className="h-3 w-3 mr-1" />
                        {article.views} visualizações
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
  )
}