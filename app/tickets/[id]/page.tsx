'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { logger } from '@/lib/monitoring/logger';
import {
  ArrowLeftIcon,
  PaperClipIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  CalendarIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  PencilIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import { PageHeader } from '@/components/ui/PageHeader'

interface Ticket {
  id: number
  title: string
  description: string
  user_id: number
  assigned_to?: number
  category_id: number
  priority_id: number
  status_id: number
  created_at: string
  updated_at: string
  resolved_at?: string
  user_name: string
  user_email: string
  assigned_agent_name?: string
  category_name: string
  priority_name: string
  priority_level: number
  status_name: string
  status_color: string
  comments_count: number
  attachments_count: number
}

interface Comment {
  id: number
  ticket_id: number
  user_id: number
  content: string
  is_internal: boolean
  created_at: string
  user_name: string
  user_role: string
}

interface Attachment {
  id: number
  ticket_id: number
  filename: string
  original_name: string
  mime_type: string
  size: number
  uploaded_by: number
  created_at: string
}

export default function TicketDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  const ticketId = params.id as string

  useEffect(() => {
    fetchTicketDetails()
  }, [ticketId])

  const fetchTicketDetails = async () => {
    try {
      setLoading(true)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/tickets/${ticketId}`, {
        credentials: 'include' // Use httpOnly cookies
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Ticket não encontrado')
        } else if (response.status === 403) {
          setError('Acesso negado')
        } else {
          setError('Erro ao carregar ticket')
        }
        return
      }

      const data = await response.json()
      setTicket(data.ticket)
      setComments(data.comments || [])
      setAttachments(data.attachments || [])
    } catch (error) {
      logger.error('Erro ao buscar ticket', error)
      setError('Erro ao carregar ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      setSubmittingComment(true)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Use httpOnly cookies
        body: JSON.stringify({
          content: newComment.trim(),
          is_internal: isInternal
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao adicionar comentário')
      }

      const data = await response.json()
      setComments([...comments, data.comment])
      setNewComment('')
      setIsInternal(false)
    } catch (error) {
      logger.error('Erro ao adicionar comentário', error)
      toast.error('Erro ao adicionar comentário')
    } finally {
      setSubmittingComment(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getPriorityColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-gradient-to-r from-success-50 to-success-100 text-success-700 dark:from-success-900/20 dark:to-success-800/20 dark:text-success-300 border border-success-200 dark:border-success-800'
      case 2: return 'bg-gradient-to-r from-warning-50 to-warning-100 text-warning-700 dark:from-warning-900/20 dark:to-warning-800/20 dark:text-warning-300 border border-warning-200 dark:border-warning-800'
      case 3: return 'bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 dark:from-orange-900/20 dark:to-orange-800/20 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
      case 4: return 'bg-gradient-to-r from-danger-50 to-danger-100 text-danger-700 dark:from-danger-900/20 dark:to-danger-800/20 dark:text-danger-300 border border-danger-200 dark:border-danger-800'
      default: return 'bg-gradient-to-r from-neutral-50 to-neutral-100 text-neutral-700 dark:from-neutral-900/20 dark:to-neutral-800/20 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
    }
  }

  const getPriorityIcon = (level: number) => {
    switch (level) {
      case 1: return <CheckCircleIcon className="h-4 w-4" />
      case 2: return <ClockIcon className="h-4 w-4" />
      case 3: return <ExclamationTriangleIcon className="h-4 w-4" />
      case 4: return <ExclamationTriangleIcon className="h-4 w-4" />
      default: return <ClockIcon className="h-4 w-4" />
    }
  }

  const getStatusColor = (statusName: string) => {
    const name = statusName.toLowerCase()
    if (name.includes('aberto') || name.includes('novo')) {
      return 'bg-gradient-to-r from-info-50 to-info-100 text-info-700 dark:from-info-900/20 dark:to-info-800/20 dark:text-info-300 border border-info-200 dark:border-info-800'
    } else if (name.includes('progresso') || name.includes('andamento')) {
      return 'bg-gradient-to-r from-warning-50 to-warning-100 text-warning-700 dark:from-warning-900/20 dark:to-warning-800/20 dark:text-warning-300 border border-warning-200 dark:border-warning-800'
    } else if (name.includes('resolvido') || name.includes('concluído')) {
      return 'bg-gradient-to-r from-success-50 to-success-100 text-success-700 dark:from-success-900/20 dark:to-success-800/20 dark:text-success-300 border border-success-200 dark:border-success-800'
    } else if (name.includes('fechado')) {
      return 'bg-gradient-to-r from-neutral-50 to-neutral-100 text-neutral-700 dark:from-neutral-900/20 dark:to-neutral-800/20 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
    }
    return 'bg-gradient-to-r from-neutral-50 to-neutral-100 text-neutral-700 dark:from-neutral-900/20 dark:to-neutral-800/20 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 flex items-center justify-center">
        <div className="glass-panel p-8 text-center animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-neutral-200 dark:border-neutral-700 border-t-brand-600 dark:border-t-brand-400 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 bg-brand-100 dark:bg-brand-900/30 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-6 text-description font-medium">Carregando ticket...</p>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 flex items-center justify-center">
        <div className="glass-panel p-10 text-center max-w-md animate-fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-danger-100 to-danger-200 dark:from-danger-900/30 dark:to-danger-800/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <ExclamationTriangleIcon className="h-10 w-10 text-danger-600 dark:text-danger-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">Erro ao Carregar Ticket</h1>
          <p className="text-description mb-6">{error || 'Ticket não encontrado'}</p>
          <button
            onClick={() => router.back()}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Voltar</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Breadcrumbs */}
        <PageHeader
          title={ticket.title}
          breadcrumbs={[
            { label: 'Tickets', href: '/tickets' },
            { label: `#${ticket.id}` }
          ]}
          actions={
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push(`/tickets/${ticket.id}/edit`)}
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <PencilIcon className="h-4 w-4" />
                <span>Editar</span>
              </button>
              <button
                onClick={() => window.print()}
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <EyeIcon className="h-4 w-4" />
                <span>Visualizar</span>
              </button>
            </div>
          }
        />

        {/* Status and Priority Badges */}
        <div className="mb-6 flex flex-wrap items-center gap-3 animate-slide-up">
          <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${getPriorityColor(ticket.priority_level)}`}>
            {getPriorityIcon(ticket.priority_level)}
            <span className="ml-2">{ticket.priority_name}</span>
          </span>

          <span className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${getStatusColor(ticket.status_name)}`}>
            {ticket.status_name}
          </span>

          <div className="flex items-center space-x-4 text-sm text-muted-content ml-auto">
            <span className="flex items-center glass-panel px-3 py-1.5 rounded-lg">
              <UserIcon className="h-4 w-4 mr-1.5" />
              {ticket.user_name}
            </span>
            <span className="flex items-center glass-panel px-3 py-1.5 rounded-lg">
              <CalendarIcon className="h-4 w-4 mr-1.5" />
              {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
            </span>
            <span className="flex items-center glass-panel px-3 py-1.5 rounded-lg">
              <TagIcon className="h-4 w-4 mr-1.5" />
              {ticket.category_name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conteúdo Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Descrição */}
            <div className="glass-panel animate-fade-in">
              <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Descrição do Ticket</h2>
              </div>
              <div className="prose max-w-none">
                <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
              </div>
            </div>

            {/* Timeline de Atividades */}
            <div className="glass-panel animate-fade-in">
              <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2 text-brand-600 dark:text-brand-400" />
                  Timeline de Atividades ({comments.length})
                </h2>
              </div>

              {/* Lista de Comentários com Timeline */}
              <div className="space-y-6 mb-8">
                {comments.length === 0 ? (
                  <div className="text-center py-8">
                    <ChatBubbleLeftRightIcon className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                    <p className="text-muted-content">Nenhum comentário ainda</p>
                  </div>
                ) : (
                  comments.map((comment, index) => (
                    <div key={comment.id} className="relative animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                      {/* Timeline Line */}
                      {index !== comments.length - 1 && (
                        <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-brand-200 dark:from-brand-800 to-transparent"></div>
                      )}

                      <div className="flex gap-4">
                        {/* Avatar Circle */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white shadow-lg ${
                          comment.is_internal
                            ? 'bg-gradient-to-br from-warning-400 to-warning-600'
                            : 'bg-gradient-to-br from-brand-500 to-brand-700'
                        }`}>
                          {comment.user_name.charAt(0).toUpperCase()}
                        </div>

                        {/* Comment Content */}
                        <div className="flex-1">
                          <div className={`p-5 rounded-xl shadow-sm border-2 transition-all hover:shadow-md ${
                            comment.is_internal
                              ? 'bg-gradient-to-br from-warning-50 to-warning-100 dark:from-warning-900/20 dark:to-warning-800/20 border-warning-200 dark:border-warning-800'
                              : 'bg-white dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700'
                          }`}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="font-semibold text-neutral-900 dark:text-white">{comment.user_name}</span>
                                <span className="px-2 py-0.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-full">
                                  {comment.user_role}
                                </span>
                                {comment.is_internal && (
                                  <span className="px-2 py-0.5 text-xs font-semibold bg-warning-200 dark:bg-warning-800 text-warning-800 dark:text-warning-200 rounded-full">
                                    Interno
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-content whitespace-nowrap ml-4">
                                {new Date(comment.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Formulário de Novo Comentário Modernizado */}
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                <form onSubmit={handleSubmitComment} className="space-y-4">
                  <div>
                    <label htmlFor="comment" className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                      Adicionar Comentário
                    </label>
                    <textarea
                      id="comment"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all resize-none text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500"
                      placeholder="Digite seu comentário aqui..."
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        id="internal"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="h-5 w-5 text-brand-600 focus:ring-brand-500 border-neutral-300 dark:border-neutral-600 rounded transition-all"
                      />
                      <span className="ml-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white">
                        Comentário interno (apenas agentes e admins)
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={submittingComment || !newComment.trim()}
                      className="btn-primary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      <span>{submittingComment ? 'Enviando...' : 'Publicar Comentário'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Informações do Ticket */}
            <div className="glass-panel animate-fade-in">
              <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-4">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Informações</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-800/20 rounded-lg border border-brand-100 dark:border-brand-800">
                  <span className="text-sm font-medium text-description">ID do Ticket</span>
                  <span className="text-sm font-bold text-brand-700 dark:text-brand-300">#{ticket.id}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start">
                    <CalendarIcon className="h-5 w-5 text-icon-muted mr-3 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-muted-content block mb-1">Criado em</span>
                      <p className="text-sm text-neutral-900 dark:text-white font-medium">
                        {new Date(ticket.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <ClockIcon className="h-5 w-5 text-icon-muted mr-3 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-muted-content block mb-1">Atualizado em</span>
                      <p className="text-sm text-neutral-900 dark:text-white font-medium">
                        {new Date(ticket.updated_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {ticket.resolved_at && (
                    <div className="flex items-start">
                      <CheckCircleIcon className="h-5 w-5 text-success-500 dark:text-success-400 mr-3 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-muted-content block mb-1">Resolvido em</span>
                        <p className="text-sm text-neutral-900 dark:text-white font-medium">
                          {new Date(ticket.resolved_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}

                  {ticket.assigned_agent_name && (
                    <div className="flex items-start">
                      <UserIcon className="h-5 w-5 text-icon-muted mr-3 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-muted-content block mb-1">Atribuído a</span>
                        <p className="text-sm text-neutral-900 dark:text-white font-medium">{ticket.assigned_agent_name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Anexos Modernizados */}
            {attachments.length > 0 && (
              <div className="glass-panel animate-fade-in">
                <div className="border-b border-neutral-200 dark:border-neutral-700 pb-4 mb-4">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center">
                    <PaperClipIcon className="h-5 w-5 mr-2 text-brand-600 dark:text-brand-400" />
                    Anexos ({attachments.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {attachments.map((attachment, index) => (
                    <div
                      key={attachment.id}
                      className="group relative p-4 bg-gradient-to-r from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-xl hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-md transition-all animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        {/* File Icon */}
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900/40 dark:to-brand-800/40 rounded-lg flex items-center justify-center">
                          <PaperClipIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate mb-1">
                            {attachment.original_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-content">
                            <span className="px-2 py-0.5 bg-white dark:bg-neutral-900 rounded-full border border-neutral-200 dark:border-neutral-600">
                              {formatFileSize(attachment.size)}
                            </span>
                            <span className="px-2 py-0.5 bg-white dark:bg-neutral-900 rounded-full border border-neutral-200 dark:border-neutral-600">
                              {attachment.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}
                            </span>
                          </div>
                        </div>

                        {/* Download Button */}
                        <a
                          href={`/api/attachments/${attachment.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 p-2 bg-brand-600 dark:bg-brand-500 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors group-hover:scale-110 transform"
                          title="Baixar arquivo"
                        >
                          <DocumentArrowDownIcon className="h-5 w-5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
