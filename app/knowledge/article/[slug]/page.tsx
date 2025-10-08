'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  ArrowLeftIcon,
  EyeIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChatBubbleBottomCenterTextIcon,
  UserIcon,
  CalendarIcon,
  TagIcon,
  ShareIcon
} from '@heroicons/react/24/outline'
import { HandThumbUpIcon as HandThumbUpSolid, HandThumbDownIcon as HandThumbDownSolid } from '@heroicons/react/24/solid'

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

      const response = await fetch(`/api/knowledge/articles/${slug}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
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

      const response = await fetch(`/api/knowledge/articles/${article.slug}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando artigo...</p>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Artigo não encontrado</h1>
          <button
            onClick={() => router.push('/knowledge')}
            className="text-blue-600 hover:text-blue-700"
          >
            Voltar para Base de Conhecimento
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navegação */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/knowledge')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Voltar para Base de Conhecimento
          </button>
        </div>

        {/* Artigo */}
        <article className="bg-white rounded-lg shadow-sm border">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
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
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  <TagIcon className="w-3 h-3 mr-1" />
                  {tag.name}
                </span>
              ))}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {article.title}
            </h1>

            {article.summary && (
              <p className="text-lg text-gray-600 mb-6">
                {article.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
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
            </div>
          </div>

          {/* Conteúdo */}
          <div className="p-6">
            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>

          {/* Feedback */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
              <div className="mt-4 p-4 bg-white rounded-lg border">
                <p className="text-sm text-gray-600 mb-3">
                  Como podemos melhorar este artigo?
                </p>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Seu comentário (opcional)..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <div className="flex items-center space-x-3 mt-3">
                  <button
                    onClick={handleNegativeFeedbackSubmit}
                    disabled={submittingFeedback}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submittingFeedback ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button
                    onClick={() => setShowFeedbackComment(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Estatísticas */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-500">
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Artigos Relacionados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {article.relatedArticles.map((relatedArticle) => (
                <div
                  key={relatedArticle.id}
                  onClick={() => router.push(`/knowledge/article/${relatedArticle.slug}`)}
                  className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                >
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {relatedArticle.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {relatedArticle.summary}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
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