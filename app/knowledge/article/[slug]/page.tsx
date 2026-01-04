'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  ArrowLeftIcon,
  EyeIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  UserIcon,
  CalendarIcon,
  TagIcon,
  HomeIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid } from '@heroicons/react/24/solid'
import { SafeHTML } from '@/components/SafeHTML'
import { PageHeader } from '@/components/ui/PageHeader'

interface Article {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  status: string
  view_count: number
  helpful_votes: number
  not_helpful_votes: number
  published_at: string
  created_at: string
  updated_at: string
  category_name: string
  category_slug: string
  category_color: string
  author_name: string
  tags: Array<{ name: string; color: string }>
  relatedArticles: Array<{
    id: number
    title: string
    slug: string
    summary: string
    view_count: number
    helpful_votes: number
  }>
}

export default function ArticlePage() {
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(null)
  const [showFeedbackComment, setShowFeedbackComment] = useState(false)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    if (params.slug) {
      loadArticle(params.slug as string)
    }
  }, [params.slug])

  const loadArticle = async (slug: string) => {
    try {
      setLoading(true)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/knowledge/articles/${slug}`, {
        credentials: 'include' // Use httpOnly cookies
      })

      const data = await response.json()

      if (data.success) {
        setArticle(data.article)
      } else {
        logger.error('Erro ao carregar artigo', data.error)
      }

    } catch (error) {
      logger.error('Error loading article', error)
    } finally {
      setLoading(false)
    }
  }

  const submitFeedback = async (wasHelpful: boolean) => {
    if (!article) return

    try {
      setSubmittingFeedback(true)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/knowledge/articles/${article.slug}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Use httpOnly cookies
        body: JSON.stringify({
          was_helpful: wasHelpful,
          comment: feedbackComment || null
        })
      })

      const data = await response.json()

      if (data.success) {
        setFeedbackGiven(wasHelpful)
        setShowFeedbackComment(false)
        setFeedbackComment('')

        // Atualizar as estatísticas do artigo
        if (data.stats) {
          setArticle(prev => prev ? {
            ...prev,
            helpful_votes: data.stats.helpful_votes,
            not_helpful_votes: data.stats.not_helpful_votes
          } : null)
        }
      }

    } catch (error) {
      logger.error('Error submitting feedback', error)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const handleFeedback = (wasHelpful: boolean) => {
    if (wasHelpful) {
      submitFeedback(true)
    } else {
      setShowFeedbackComment(true)
      setFeedbackGiven(false)
    }
  }

  const handleNegativeFeedbackSubmit = () => {
    submitFeedback(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const calculateHelpfulPercentage = () => {
    if (!article) return 0
    const total = article.helpful_votes + article.not_helpful_votes
    if (total === 0) return 0
    return Math.round((article.helpful_votes / total) * 100)
  }

  const calculateReadingTime = (content: string) => {
    // Average reading speed: 200 words per minute
    const wordsPerMinute = 200
    const words = content.trim().split(/\s+/).length
    const minutes = Math.ceil(words / wordsPerMinute)
    return minutes
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-description">Carregando artigo...</p>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">Artigo não encontrado</h1>
          <button
            onClick={() => router.push('/knowledge')}
            className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          >
            Voltar para Base de Conhecimento
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 animate-fade-in">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <PageHeader
          title={article.title}
          description={article.summary}
          icon={DocumentTextIcon}
          breadcrumbs={[
            { label: 'Início', href: '/dashboard', icon: HomeIcon },
            { label: 'Base de Conhecimento', href: '/knowledge', icon: BookOpenIcon },
            { label: article.title }
          ]}
          backButton={{
            label: 'Voltar',
            href: '/knowledge'
          }}
        />

        {/* Artigo */}
        <article className="glass-panel rounded-lg animate-slide-up">
          {/* Article Meta */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {article.category_name && (
                <span
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: article.category_color + '20',
                    color: article.category_color
                  }}
                >
                  {article.category_name}
                </span>
              )}
              {article.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                >
                  <TagIcon className="w-3 h-3 mr-1" />
                  {tag.name}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-content">
              <div className="flex items-center">
                <UserIcon className="w-4 h-4 mr-1" />
                <span>{article.author_name}</span>
              </div>
              <div className="flex items-center">
                <CalendarIcon className="w-4 h-4 mr-1" />
                <span>Publicado em {formatDate(article.published_at)}</span>
              </div>
              <div className="flex items-center">
                <EyeIcon className="w-4 h-4 mr-1" />
                <span>{article.view_count} visualizações</span>
              </div>
              <div className="flex items-center">
                <ClockIcon className="w-4 h-4 mr-1" />
                <span>{calculateReadingTime(article.content)} min de leitura</span>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="p-6">
            <SafeHTML
              html={article.content}
              allowMarkdown
              className="prose prose-lg max-w-none"
            />
          </div>

          {/* Feedback */}
          <div className="p-6 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Este artigo foi útil?
            </h3>

            {feedbackGiven === null && !showFeedbackComment ? (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleFeedback(true)}
                  disabled={submittingFeedback}
                  className="flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  <HandThumbUpIcon className="w-5 h-5 mr-2" />
                  Sim, foi útil
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  disabled={submittingFeedback}
                  className="flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                >
                  <HandThumbDownIcon className="w-5 h-5 mr-2" />
                  Não foi útil
                </button>
              </div>
            ) : feedbackGiven === true ? (
              <div className="flex items-center text-green-700">
                <HandThumbUpSolid className="w-5 h-5 mr-2" />
                <span>Obrigado pelo seu feedback!</span>
              </div>
            ) : feedbackGiven === false && !showFeedbackComment ? (
              <div className="flex items-center text-red-700">
                <HandThumbDownSolid className="w-5 h-5 mr-2" />
                <span>Obrigado pelo seu feedback!</span>
              </div>
            ) : null}

            {showFeedbackComment && (
              <div className="mt-4 p-4 glass-panel rounded-lg border border-neutral-200 dark:border-neutral-700">
                <p className="text-sm text-description mb-3">
                  Como podemos melhorar este artigo?
                </p>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Seu comentário (opcional)..."
                  className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  rows={3}
                />
                <div className="flex items-center space-x-3 mt-3">
                  <button
                    onClick={handleNegativeFeedbackSubmit}
                    disabled={submittingFeedback}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {submittingFeedback ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button
                    onClick={() => setShowFeedbackComment(false)}
                    className="px-4 py-2 text-description hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Estatísticas */}
            <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between text-sm text-muted-content">
                <div className="flex items-center space-x-4">
                  <span>{article.helpful_votes} pessoas acharam útil</span>
                  <span>{article.not_helpful_votes} pessoas acharam inútil</span>
                </div>
                <span>{calculateHelpfulPercentage()}% de aprovação</span>
              </div>
            </div>
          </div>
        </article>

        {/* Artigos relacionados */}
        {article.relatedArticles && article.relatedArticles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">Artigos Relacionados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {article.relatedArticles.map((relatedArticle) => (
                <div
                  key={relatedArticle.id}
                  onClick={() => router.push(`/knowledge/article/${relatedArticle.slug}`)}
                  className="glass-panel p-4 rounded-lg hover:shadow-lg transition-all cursor-pointer hover:scale-105"
                >
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 line-clamp-2">
                    {relatedArticle.title}
                  </h3>
                  <p className="text-sm text-description mb-3 line-clamp-2">
                    {relatedArticle.summary}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-content">
                    <span>{relatedArticle.view_count} views</span>
                    <span>{relatedArticle.helpful_votes} úteis</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}