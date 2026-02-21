'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { logger } from '@/lib/monitoring/logger';
import {
  ArrowLeftIcon,
  ChatBubbleBottomCenterTextIcon,
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentIcon,
  EyeIcon
} from '@heroicons/react/24/outline'

interface Ticket {
  id: number
  ticket_number: string
  title: string
  description: string
  status: string
  status_color: string
  status_category: string
  priority: string
  priority_color: string
  priority_level: number
  customer_name: string
  customer_email: string
  assigned_to_name?: string
  assigned_to_email?: string
  category_name?: string
  ticket_type_name?: string
  workflow_type: string
  tenant_name?: string
  created_at: string
  updated_at: string
  resolved_at?: string
  sla_due_at?: string
  response_due_at?: string
  is_overdue: boolean
  time_metrics: {
    created_hours_ago: number
    response_time_remaining?: number
    resolution_time_remaining?: number
    is_response_overdue: boolean
    is_resolution_overdue: boolean
  }
  sla_info?: {
    sla_policy_name?: string
    response_time_hours?: number
    resolution_time_hours?: number
    sla_description?: string
  }
}

interface Comment {
  id: number
  content: string
  created_at: string
  is_internal: boolean
  author_name: string
  author_email: string
  author_role: string
}

interface Attachment {
  id: number
  filename: string
  original_filename: string
  file_size: number
  mime_type: string
  uploaded_at: string
  uploaded_by: string
}

interface HistoryItem {
  id: number
  action: string
  details: string
  created_at: string
  user_name: string
  user_role: string
}

export default function TicketDetailPage() {
  const router = useRouter()
  const params = useParams()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addingComment, setAddingComment] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [showAddComment, setShowAddComment] = useState(false)

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetails()
    }
  }, [ticketId])

  const fetchTicketDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/portal/tickets/${ticketId}`)
      const data = await response.json()

      if (data.success) {
        setTicket(data.ticket)
        setComments(data.comments || [])
        setAttachments(data.attachments || [])
        setHistory(data.history || [])
      } else {
        toast.error('Ticket não encontrado')
        router.push('/portal/tickets')
      }
    } catch (error) {
      logger.error('Error fetching ticket', error)
      toast.error('Erro ao carregar ticket')
      router.push('/portal/tickets')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newComment.trim()) {
      toast.error('Por favor, escreva um comentário')
      return
    }

    setAddingComment(true)

    try {
      const response = await fetch(`/api/portal/tickets/${ticketId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          customer_name: ticket?.customer_name || 'Cliente',
          customer_email: ticket?.customer_email || ''
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Comentário adicionado com sucesso')
        setNewComment('')
        setShowAddComment(false)
        fetchTicketDetails() // Refresh data
      } else {
        toast.error(data.error || 'Erro ao adicionar comentário')
      }
    } catch (error) {
      logger.error('Error adding comment', error)
      toast.error('Erro ao adicionar comentário')
    } finally {
      setAddingComment(false)
    }
  }

  const getStatusIcon = (statusCategory: string) => {
    switch (statusCategory) {
      case 'resolved':
      case 'closed':
        return <CheckCircleIcon className="w-5 h-5 text-success-500" />
      case 'in_progress':
        return <ClockIcon className="w-5 h-5 text-brand-500" />
      default:
        return <ExclamationTriangleIcon className="w-5 h-5 text-warning-500" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTimeRemaining = (hours?: number) => {
    if (hours === undefined || hours === null) return 'N/A'

    if (hours < 0) {
      const overdue = Math.abs(hours)
      if (overdue < 24) {
        return `${Math.floor(overdue)}h em atraso`
      }
      return `${Math.floor(overdue / 24)}d em atraso`
    }

    if (hours < 24) {
      return `${Math.floor(hours)}h restantes`
    }

    return `${Math.floor(hours / 24)}d restantes`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 animate-fade-in flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 animate-fade-in flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Ticket não encontrado</h2>
          <button
            onClick={() => router.push('/portal/tickets')}
            className="text-brand-600 hover:text-brand-700"
          >
            Voltar para lista de tickets
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 animate-fade-in">
      {/* Header */}
      <div className="glass-panel shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/portal/tickets')}
              className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-neutral-600" />
            </button>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-sm font-mono text-neutral-500">#{ticket.ticket_number}</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(ticket.status_category)}
                  <span className="text-sm font-medium" style={{ color: ticket.status_color }}>
                    {ticket.status}
                  </span>
                </div>
                <span
                  className="px-2 py-1 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: ticket.priority_color }}
                >
                  {ticket.priority}
                </span>
                {ticket.is_overdue && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-error-100 text-error-800">
                    Vencido
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-neutral-900">{ticket.title}</h1>
              <p className="text-neutral-600">{ticket.ticket_type_name} • {ticket.category_name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="glass-panel rounded-lg border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Descrição</h2>
              <div className="prose prose-sm max-w-none">
                <p className="text-neutral-700 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </div>

            {/* Comments */}
            <div className="glass-panel rounded-lg border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900">
                  Comentários ({comments.length})
                </h2>
                <button
                  onClick={() => setShowAddComment(!showAddComment)}
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  <ChatBubbleBottomCenterTextIcon className="w-4 h-4 mr-1" />
                  Adicionar comentário
                </button>
              </div>

              {showAddComment && (
                <form onSubmit={handleAddComment} className="mb-6 p-4 bg-neutral-50 rounded-lg">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Escreva seu comentário..."
                    rows={4}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    required
                  />
                  <div className="mt-3 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowAddComment(false)}
                      className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={addingComment}
                      className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50"
                    >
                      {addingComment ? 'Adicionando...' : 'Adicionar comentário'}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">
                    Nenhum comentário ainda. Seja o primeiro a comentar!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-neutral-300 rounded-full flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-neutral-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-neutral-900">
                            {comment.author_name}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {comment.author_role}
                          </span>
                          <span className="text-xs text-neutral-500">•</span>
                          <span className="text-xs text-neutral-500">
                            {formatDate(comment.created_at)}
                          </span>
                        </div>
                        <div className="text-sm text-neutral-700 whitespace-pre-wrap">
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="glass-panel rounded-lg border border-neutral-200 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                  Anexos ({attachments.length})
                </h2>
                <div className="space-y-3">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <DocumentIcon className="w-5 h-5 text-neutral-400" />
                        <div>
                          <p className="text-sm font-medium text-neutral-900">
                            {attachment.original_filename}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {formatFileSize(attachment.file_size)} • Enviado por {attachment.uploaded_by}
                          </p>
                        </div>
                      </div>
                      <button className="p-2 text-neutral-400 hover:text-neutral-600 rounded">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Ticket Info */}
            <div className="glass-panel rounded-lg border border-neutral-200 p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">Informações do Ticket</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Criado:</span>
                  <span className="text-sm text-neutral-900">{formatDate(ticket.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Última atualização:</span>
                  <span className="text-sm text-neutral-900">{formatDate(ticket.updated_at)}</span>
                </div>
                {ticket.assigned_to_name && (
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Atribuído a:</span>
                    <span className="text-sm text-neutral-900">{ticket.assigned_to_name}</span>
                  </div>
                )}
                {ticket.resolved_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Resolvido em:</span>
                    <span className="text-sm text-neutral-900">{formatDate(ticket.resolved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* SLA Information */}
            {ticket.sla_info && (
              <div className="glass-panel rounded-lg border border-neutral-200 p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">SLA</h3>
                <div className="space-y-3">
                  {ticket.sla_info.sla_policy_name && (
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">Política:</span>
                      <span className="text-sm text-neutral-900">{ticket.sla_info.sla_policy_name}</span>
                    </div>
                  )}

                  {ticket.time_metrics.response_time_remaining !== null && (
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">Tempo para resposta:</span>
                      <span className={`text-sm ${ticket.time_metrics.is_response_overdue ? 'text-error-600' : 'text-neutral-900'}`}>
                        {formatTimeRemaining(ticket.time_metrics.response_time_remaining)}
                      </span>
                    </div>
                  )}

                  {ticket.time_metrics.resolution_time_remaining !== null && (
                    <div className="flex justify-between">
                      <span className="text-sm text-neutral-600">Tempo para resolução:</span>
                      <span className={`text-sm ${ticket.time_metrics.is_resolution_overdue ? 'text-error-600' : 'text-neutral-900'}`}>
                        {formatTimeRemaining(ticket.time_metrics.resolution_time_remaining)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Activity History */}
            {history.length > 0 && (
              <div className="glass-panel rounded-lg border border-neutral-200 p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Histórico</h3>
                <div className="space-y-3">
                  {history.slice(0, 5).map((item) => (
                    <div key={item.id} className="text-sm">
                      <div className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-brand-400 rounded-full mt-2 flex-shrink-0"></div>
                        <div>
                          <p className="text-neutral-700">
                            <span className="font-medium">{item.user_name}</span> {item.action}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
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