'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeftIcon, 
  PaperClipIcon, 
  ChatBubbleLeftRightIcon,
  UserIcon,
  CalendarIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

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
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      const response = await fetch(`/api/tickets/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
      console.error('Erro ao buscar ticket:', error)
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
      const token = localStorage.getItem('auth_token')
      
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
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
      console.error('Erro ao adicionar comentário:', error)
      alert('Erro ao adicionar comentário')
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
      case 1: return 'bg-green-100 text-green-800'
      case 2: return 'bg-yellow-100 text-yellow-800'
      case 3: return 'bg-orange-100 text-orange-800'
      case 4: return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando ticket...</p>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro</h1>
          <p className="text-gray-600 mb-4">{error || 'Ticket não encontrado'}</p>
          <button
            onClick={() => router.back()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Voltar
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{ticket.title}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center">
                  <UserIcon className="h-4 w-4 mr-1" />
                  {ticket.user_name}
                </span>
                <span className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                </span>
                <span className="flex items-center">
                  <TagIcon className="h-4 w-4 mr-1" />
                  {ticket.category_name}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(ticket.priority_level)}`}
              >
                {getPriorityIcon(ticket.priority_level)}
                <span className="ml-1">{ticket.priority_name}</span>
              </span>
              
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: `${ticket.status_color}20`, color: ticket.status_color }}
              >
                {ticket.status_name}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conteúdo Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Descrição */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Descrição</h2>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </div>

            {/* Comentários */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                  Comentários ({comments.length})
                </h2>
              </div>

              {/* Lista de Comentários */}
              <div className="space-y-4 mb-6">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-4 rounded-lg ${
                      comment.is_internal 
                        ? 'bg-yellow-50 border-l-4 border-yellow-400' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">{comment.user_name}</span>
                        <span className="ml-2 text-sm text-gray-500">({comment.user_role})</span>
                        {comment.is_internal && (
                          <span className="ml-2 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded">
                            Interno
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(comment.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
              </div>

              {/* Formulário de Novo Comentário */}
              <form onSubmit={handleSubmitComment} className="space-y-4">
                <div>
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                    Adicionar Comentário
                  </label>
                  <textarea
                    id="comment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Digite seu comentário..."
                    required
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="internal"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="internal" className="ml-2 block text-sm text-gray-700">
                    Comentário interno (apenas agentes e admins)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingComment ? 'Enviando...' : 'Adicionar Comentário'}
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Informações do Ticket */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">ID:</span>
                  <p className="text-sm text-gray-900">#{ticket.id}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Criado em:</span>
                  <p className="text-sm text-gray-900">
                    {new Date(ticket.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Atualizado em:</span>
                  <p className="text-sm text-gray-900">
                    {new Date(ticket.updated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Resolvido em:</span>
                    <p className="text-sm text-gray-900">
                      {new Date(ticket.resolved_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                )}
                {ticket.assigned_agent_name && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Atribuído a:</span>
                    <p className="text-sm text-gray-900">{ticket.assigned_agent_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Anexos */}
            {attachments.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <PaperClipIcon className="h-5 w-5 mr-2" />
                  Anexos ({attachments.length})
                </h3>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.original_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                      <a
                        href={`/api/attachments/${attachment.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-indigo-600 hover:text-indigo-800 text-sm"
                      >
                        Baixar
                      </a>
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
