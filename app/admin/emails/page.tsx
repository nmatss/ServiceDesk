'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
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
          total: Object.values(statsMap).reduce((a: any, b: any) => (a as number) + (b as number), 0) as number,
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
      case 'sent': return <CheckCircleIcon className="w-5 h-5 text-success-600 dark:text-success-400" />
      case 'failed': return <XCircleIcon className="w-5 h-5 text-danger-600 dark:text-danger-400" />
      case 'sending': return <ArrowPathIcon className="w-5 h-5 text-brand-600 dark:text-brand-400 animate-spin" />
      default: return <ClockIcon className="w-5 h-5 text-warning-600 dark:text-warning-400" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-danger-700 bg-danger-100 dark:text-danger-300 dark:bg-danger-950/30'
      case 'medium': return 'text-warning-700 bg-warning-100 dark:text-warning-300 dark:bg-warning-950/30'
      case 'low': return 'text-success-700 bg-success-100 dark:text-success-300 dark:bg-success-950/30'
      default: return 'text-neutral-700 bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Gerenciamento de Emails"
        description="Monitore e gerencie a fila de emails do sistema"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Emails', href: '/admin/emails' }
        ]}
      >
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={processQueue}
            disabled={processing}
            className="bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
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
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel group hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-description">Total</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 transition-transform duration-300 group-hover:scale-110">{stats.total}</p>
            </div>
            <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 transition-colors duration-300">
              <EnvelopeIcon className="w-8 h-8 text-description group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-300" />
            </div>
          </div>
        </div>

        <div className="glass-panel group hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-description">Enviados</p>
              <p className="text-3xl font-bold text-success-600 dark:text-success-400 transition-transform duration-300 group-hover:scale-110">{stats.sent}</p>
            </div>
            <div className="p-3 bg-success-100 dark:bg-success-900/30 rounded-lg group-hover:bg-success-200 dark:group-hover:bg-success-900/50 transition-colors duration-300">
              <CheckCircleIcon className="w-8 h-8 text-success-600 dark:text-success-400 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </div>
        </div>

        <div className="glass-panel group hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-description">Pendentes</p>
              <p className="text-3xl font-bold text-warning-600 dark:text-warning-400 transition-transform duration-300 group-hover:scale-110">{stats.pending}</p>
            </div>
            <div className="p-3 bg-warning-100 dark:bg-warning-900/30 rounded-lg group-hover:bg-warning-200 dark:group-hover:bg-warning-900/50 transition-colors duration-300">
              <ClockIcon className="w-8 h-8 text-warning-600 dark:text-warning-400 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </div>
        </div>

        <div className="glass-panel group hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-description">Falhados</p>
              <p className="text-3xl font-bold text-danger-600 dark:text-danger-400 transition-transform duration-300 group-hover:scale-110">{stats.failed}</p>
            </div>
            <div className="p-3 bg-danger-100 dark:bg-danger-900/30 rounded-lg group-hover:bg-danger-200 dark:group-hover:bg-danger-900/50 transition-colors duration-300">
              <XCircleIcon className="w-8 h-8 text-danger-600 dark:text-danger-400 transition-transform duration-300 group-hover:scale-110" />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel animate-slide-up" style={{ animationDelay: '400ms' }}>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full rounded-lg border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:focus:border-brand-400 dark:focus:ring-brand-400 transition-colors duration-200"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="sending">Enviando</option>
                <option value="sent">Enviados</option>
                <option value="failed">Falhados</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Prioridade
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="block w-full rounded-lg border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:focus:border-brand-400 dark:focus:ring-brand-400 transition-colors duration-200"
              >
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={retryFailed}
              className="text-warning-600 hover:text-warning-700 dark:text-warning-400 dark:hover:text-warning-300 border-warning-300 hover:border-warning-400 dark:border-warning-600 dark:hover:border-warning-500"
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Reprocessar
            </Button>
            <Button
              variant="outline"
              onClick={clearFailed}
              className="text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 border-danger-300 hover:border-danger-400 dark:border-danger-600 dark:hover:border-danger-500"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Limpar Falhados
            </Button>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="glass-panel p-0 overflow-hidden animate-slide-up" style={{ animationDelay: '500ms' }}>
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Fila de Emails</h3>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        ) : emails.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 mb-4">
              <EnvelopeIcon className="w-8 h-8 text-icon-muted" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Nenhum email encontrado
            </h3>
            <p className="text-description">
              Não há emails na fila com os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {emails.map((email, index) => (
              <div
                key={email.id}
                className="p-6 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all duration-200 group animate-slide-up"
                style={{ animationDelay: `${600 + (index * 50)}ms` }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start space-x-4 flex-1 min-w-0">
                    <div className="mt-1 flex-shrink-0">
                      {getStatusIcon(email.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {email.subject}
                        </p>
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${getPriorityColor(email.priority)}`}>
                          {email.priority === 'high' ? 'Alta' : email.priority === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-description">
                        <span className="flex items-center">
                          <span className="font-medium mr-1">Para:</span>
                          {email.to_email}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center">
                          <span className="font-medium mr-1">Tipo:</span>
                          {email.template_type}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center">
                          <span className="font-medium mr-1">Tentativas:</span>
                          {email.attempts}/{email.max_attempts}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span>{formatDate(email.created_at)}</span>
                      </div>
                      {email.error_message && (
                        <div className="mt-2 p-3 bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-900/30 rounded-lg">
                          <p className="text-sm text-danger-700 dark:text-danger-300">
                            <span className="font-semibold">Erro:</span> {email.error_message}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-description lg:text-right flex-shrink-0">
                    {email.sent_at && (
                      <div className="inline-flex items-center px-3 py-1.5 bg-success-50 dark:bg-success-950/20 border border-success-200 dark:border-success-900/30 rounded-lg">
                        <CheckCircleIcon className="w-4 h-4 mr-1.5 text-success-600 dark:text-success-400" />
                        <span className="text-success-700 dark:text-success-300">
                          {formatDate(email.sent_at)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">
              Página {page} de {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
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