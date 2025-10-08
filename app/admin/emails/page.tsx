'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'react-hot-toast'
import { logger } from '@/lib/monitoring/logger';
import {
  EnvelopeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  PlayIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

interface EmailQueueItem {
  id: number
  to_email: string
  cc_emails?: string
  subject: string
  template_type: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'sending' | 'sent' | 'failed'
  attempts: number
  max_attempts: number
  scheduled_at?: string
  sent_at?: string
  error_message?: string
  created_at: string
}

interface EmailStats {
  total: number
  sent: number
  failed: number
  pending: number
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailQueueItem[]>([])
  const [stats, setStats] = useState<EmailStats>({ total: 0, sent: 0, failed: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchEmails()
  }, [selectedStatus, selectedPriority, page])

  const fetchEmails = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      if (selectedStatus !== 'all') params.append('status', selectedStatus)
      if (selectedPriority !== 'all') params.append('priority', selectedPriority)

      const response = await fetch(`/api/email/queue?${params}`)
      const data = await response.json()

      if (data.success) {
        setEmails(data.emails)
        setTotalPages(data.pagination.totalPages)

        // Calculate stats from the returned stats array
        const statsMap = data.stats.reduce((acc: any, stat: any) => {
          acc[stat.status] = (acc[stat.status] || 0) + stat.count
          return acc
        }, {})

        setStats({
          total: Object.values(statsMap).reduce((a: any, b: any) => a + b, 0),
          sent: statsMap.sent || 0,
          failed: statsMap.failed || 0,
          pending: statsMap.pending || 0
        })
      }
    } catch (error) {
      logger.error('Error fetching emails', error)
      toast.error('Erro ao carregar emails')
    } finally {
      setLoading(false)
    }
  }

  const processQueue = async () => {
    setProcessing(true)
    try {
      const response = await fetch('/api/email/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process', limit: 20 })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message)
        fetchEmails()
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('Erro ao processar fila')
    } finally {
      setProcessing(false)
    }
  }

  const retryFailed = async () => {
    try {
      const response = await fetch('/api/email/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_failed' })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message)
        fetchEmails()
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('Erro ao reprocessar emails')
    }
  }

  const clearFailed = async () => {
    if (!confirm('Tem certeza que deseja remover todos os emails falhados?')) return

    try {
      const response = await fetch('/api/email/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_failed' })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message)
        fetchEmails()
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('Erro ao limpar emails falhados')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircleIcon className="w-5 h-5 text-green-500" />
      case 'failed': return <XCircleIcon className="w-5 h-5 text-red-500" />
      case 'sending': return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />
      default: return <ClockIcon className="w-5 h-5 text-yellow-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Emails</h1>
          <p className="mt-2 text-gray-600">
            Monitore e gerencie a fila de emails do sistema
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <Button
            onClick={processQueue}
            disabled={processing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {processing ? (
              <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PlayIcon className="w-4 h-4 mr-2" />
            )}
            Processar Fila
          </Button>
          <Button variant="outline">
            <PlusIcon className="w-4 h-4 mr-2" />
            Novo Email
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <EnvelopeIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Enviados</p>
              <p className="text-3xl font-bold text-green-600">{stats.sent}</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pendentes</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <ClockIcon className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Falhados</p>
              <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <XCircleIcon className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="sending">Enviando</option>
                <option value="sent">Enviados</option>
                <option value="failed">Falhados</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridade
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={retryFailed}
              className="text-yellow-600 hover:text-yellow-700"
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Reprocessar
            </Button>
            <Button
              variant="outline"
              onClick={clearFailed}
              className="text-red-600 hover:text-red-700"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Limpar Falhados
            </Button>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Fila de Emails</h3>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-12 text-center">
            <EnvelopeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum email encontrado
            </h3>
            <p className="text-gray-600">
              Não há emails na fila com os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {emails.map((email) => (
              <div key={email.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {getStatusIcon(email.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {email.subject}
                        </p>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(email.priority)}`}>
                          {email.priority}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Para: {email.to_email}</span>
                        <span>Tipo: {email.template_type}</span>
                        <span>Tentativas: {email.attempts}/{email.max_attempts}</span>
                        <span>{formatDate(email.created_at)}</span>
                      </div>
                      {email.error_message && (
                        <p className="text-sm text-red-600 mt-1">
                          Erro: {email.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {email.sent_at && (
                      <span>Enviado: {formatDate(email.sent_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Página {page} de {totalPages}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}