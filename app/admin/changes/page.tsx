'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowsRightLeftIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  FireIcon,
  DocumentTextIcon,
  BoltIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline'

interface ChangeRequest {
  id: number
  change_number: string
  title: string
  description: string
  category: 'standard' | 'normal' | 'emergency'
  priority: string
  status: string
  risk_level: string
  risk_score: number
  requester_name: string
  assignee_name: string | null
  team_name: string | null
  scheduled_start_date: string | null
  scheduled_end_date: string | null
  created_at: string
  cab_meeting_id: number | null
}

interface ChangeStats {
  total: number
  pending_approval: number
  approved: number
  in_progress: number
  completed: number
  failed: number
  emergency: number
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Rascunho', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: DocumentTextIcon },
  submitted: { label: 'Submetido', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: ArrowsRightLeftIcon },
  pending_assessment: { label: 'Aguardando Avaliação', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: ClockIcon },
  pending_cab: { label: 'Aguardando CAB', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: UserGroupIcon },
  approved: { label: 'Aprovado', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircleIcon },
  rejected: { label: 'Rejeitado', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircleIcon },
  scheduled: { label: 'Agendado', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: CalendarIcon },
  in_progress: { label: 'Em Execução', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: PlayIcon },
  completed: { label: 'Concluído', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircleIcon },
  failed: { label: 'Falhou', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircleIcon },
  cancelled: { label: 'Cancelado', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: PauseIcon }
}

const categoryConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  standard: { label: 'Padrão', color: 'text-green-700', bgColor: 'bg-green-100' },
  normal: { label: 'Normal', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  emergency: { label: 'Emergência', color: 'text-red-700', bgColor: 'bg-red-100' }
}

const riskColors: Record<string, string> = {
  very_high: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
  very_low: 'bg-blue-500'
}

export default function ChangesPage() {
  const router = useRouter()
  const [changes, setChanges] = useState<ChangeRequest[]>([])
  const [stats, setStats] = useState<ChangeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchChanges = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      if (categoryFilter) params.append('category', categoryFilter)

      const response = await fetch(`/api/changes?${params}`)
      const data = await response.json()

      if (data.success) {
        setChanges(data.change_requests || [])
        setTotalPages(data.pagination?.total_pages || 1)
        if (data.statistics) {
          setStats(data.statistics)
        }
      } else {
        setError(data.error)
      }
    } catch {
      setError('Erro ao carregar mudanças')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, categoryFilter])

  useEffect(() => {
    fetchChanges()
  }, [fetchChanges])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || statusConfig.draft
  }

  const getCategoryConfig = (category: string) => {
    return categoryConfig[category] || categoryConfig.normal
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ArrowsRightLeftIcon className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
                <span>Gestão de Mudanças</span>
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Requisições de mudança e fluxo CAB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/admin/cab')}
                className="px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg flex items-center gap-2"
              >
                <UserGroupIcon className="w-4 h-4" />
                <span className="hidden sm:inline">CAB</span>
              </button>
              <button
                onClick={() => router.push('/admin/changes/calendar')}
                className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-2"
              >
                <CalendarIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Calendário</span>
              </button>
              <button
                onClick={() => router.push('/admin/changes/new')}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Nova RFC</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500">Aguardando CAB</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats?.pending_approval || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500">Aprovados</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats?.approved || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500">Em Execução</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats?.in_progress || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500">Concluídos</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats?.completed || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500">Falhas</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{stats?.failed || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-3 sm:p-4 border border-red-200 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <FireIcon className="w-4 h-4 text-red-500" />
              <p className="text-xs text-gray-500">Emergências</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{stats?.emergency || 0}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar mudanças..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos os status</option>
              <option value="draft">Rascunho</option>
              <option value="submitted">Submetido</option>
              <option value="pending_cab">Aguardando CAB</option>
              <option value="approved">Aprovado</option>
              <option value="scheduled">Agendado</option>
              <option value="in_progress">Em Execução</option>
              <option value="completed">Concluído</option>
              <option value="failed">Falhou</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas as categorias</option>
              <option value="standard">Padrão</option>
              <option value="normal">Normal</option>
              <option value="emergency">Emergência</option>
            </select>

            <button
              onClick={fetchChanges}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Changes List */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-8">
        {loading && !changes.length ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">{error}</p>
          </div>
        ) : changes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <ArrowsRightLeftIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma mudança encontrada</h3>
            <p className="text-gray-500 mb-4">Crie sua primeira requisição de mudança</p>
            <button
              onClick={() => router.push('/admin/changes/new')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Nova RFC
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {changes.map((change) => {
              const statusCfg = getStatusConfig(change.status)
              const categoryCfg = getCategoryConfig(change.category)
              const StatusIcon = statusCfg.icon

              return (
                <div
                  key={change.id}
                  onClick={() => router.push(`/admin/changes/${change.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-indigo-200 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Risk Indicator */}
                    <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                      <div className={`w-2 h-12 sm:w-12 sm:h-2 rounded-full ${riskColors[change.risk_level] || riskColors.medium}`}></div>
                      <div className={`p-2 sm:p-3 rounded-xl ${statusCfg.bgColor}`}>
                        <StatusIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${statusCfg.color}`} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">{change.change_number}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryCfg.bgColor} ${categoryCfg.color}`}>
                          {categoryCfg.label}
                        </span>
                        {change.category === 'emergency' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                            <BoltIcon className="w-3 h-3" />
                            Urgente
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 line-clamp-1 mb-1">
                        {change.title}
                      </h3>

                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {change.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <ShieldCheckIcon className="w-3.5 h-3.5" />
                          Risco: {change.risk_score}
                        </span>
                        {change.scheduled_start_date && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {formatDate(change.scheduled_start_date)}
                          </span>
                        )}
                        {change.assignee_name && (
                          <span>{change.assignee_name}</span>
                        )}
                        {change.cab_meeting_id && (
                          <span className="flex items-center gap-1 text-purple-600">
                            <UserGroupIcon className="w-3.5 h-3.5" />
                            CAB Agendado
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRightIcon className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0 hidden sm:block" />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">Página {page} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
