'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
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
  draft: { label: 'Rascunho', color: 'text-neutral-700', bgColor: 'bg-neutral-100', icon: DocumentTextIcon },
  submitted: { label: 'Submetido', color: 'text-brand-700', bgColor: 'bg-brand-100', icon: ArrowsRightLeftIcon },
  pending_assessment: { label: 'Aguardando Avaliação', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: ClockIcon },
  pending_cab: { label: 'Aguardando CAB', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: UserGroupIcon },
  approved: { label: 'Aprovado', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircleIcon },
  rejected: { label: 'Rejeitado', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircleIcon },
  scheduled: { label: 'Agendado', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: CalendarIcon },
  in_progress: { label: 'Em Execução', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: PlayIcon },
  completed: { label: 'Concluído', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircleIcon },
  failed: { label: 'Falhou', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircleIcon },
  cancelled: { label: 'Cancelado', color: 'text-neutral-700', bgColor: 'bg-neutral-100', icon: PauseIcon }
}

const categoryConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  standard: { label: 'Padrão', color: 'text-green-700', bgColor: 'bg-green-100' },
  normal: { label: 'Normal', color: 'text-brand-700', bgColor: 'bg-brand-100' },
  emergency: { label: 'Emergência', color: 'text-red-700', bgColor: 'bg-red-100' }
}

const riskColors: Record<string, string> = {
  very_high: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
  very_low: 'bg-brand-500'
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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-brand-50/30 to-purple-50/20">
      {/* Modern Header with Breadcrumbs */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-neutral-200/50 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <PageHeader
            title="Gestão de Mudanças"
            description="Requisições de mudança e fluxo CAB"
            icon={ArrowsRightLeftIcon}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'ITIL', href: '/admin/dashboard/itil' },
              { label: 'Mudanças' }
            ]}
            actions={[
              {
                label: 'CAB',
                href: '/admin/cab',
                icon: UserGroupIcon,
                variant: 'ghost'
              },
              {
                label: 'Calendário',
                href: '/admin/changes/calendar',
                icon: CalendarIcon,
                variant: 'secondary'
              },
              {
                label: 'Nova RFC',
                href: '/admin/changes/new',
                icon: PlusIcon,
                variant: 'primary'
              }
            ]}
          />
        </div>
      </div>

      {/* Modern Stats Cards with Glass Panel Effect */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
          <div className="glass-panel group hover:scale-105 transition-all duration-300">
            <p className="text-xs font-medium text-neutral-500 mb-1">Total</p>
            <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats?.total || 0}</p>
            <div className="mt-2 h-1 bg-gradient-to-r from-neutral-400 to-neutral-600 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <div className="glass-panel group hover:scale-105 transition-all duration-300 hover:shadow-purple-200">
            <p className="text-xs font-medium text-neutral-500 mb-1">Aguardando CAB</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats?.pending_approval || 0}</p>
            <div className="mt-2 h-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <div className="glass-panel group hover:scale-105 transition-all duration-300 hover:shadow-green-200">
            <p className="text-xs font-medium text-neutral-500 mb-1">Aprovados</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats?.approved || 0}</p>
            <div className="mt-2 h-1 bg-gradient-to-r from-green-400 to-green-600 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <div className="glass-panel group hover:scale-105 transition-all duration-300 hover:shadow-orange-200">
            <p className="text-xs font-medium text-neutral-500 mb-1">Em Execução</p>
            <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats?.in_progress || 0}</p>
            <div className="mt-2 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <div className="glass-panel group hover:scale-105 transition-all duration-300 hover:shadow-brand-200">
            <p className="text-xs font-medium text-neutral-500 mb-1">Concluídos</p>
            <p className="text-xl sm:text-2xl font-bold text-brand-600">{stats?.completed || 0}</p>
            <div className="mt-2 h-1 bg-gradient-to-r from-brand-400 to-brand-600 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <div className="glass-panel group hover:scale-105 transition-all duration-300 hover:shadow-red-200">
            <p className="text-xs font-medium text-neutral-500 mb-1">Falhas</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{stats?.failed || 0}</p>
            <div className="mt-2 h-1 bg-gradient-to-r from-red-400 to-red-600 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          </div>

          <div className="glass-panel col-span-2 sm:col-span-1 border-red-200 bg-gradient-to-br from-red-50/50 to-orange-50/30 group hover:scale-105 transition-all duration-300 hover:shadow-red-300">
            <div className="flex items-center gap-2 mb-1">
              <FireIcon className="w-4 h-4 text-red-500 animate-pulse" />
              <p className="text-xs font-medium text-neutral-500">Emergências</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{stats?.emergency || 0}</p>
            <div className="mt-2 h-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </div>
      </div>

      {/* Modern Filters with Glass Effect */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-6">
        <div className="glass-panel">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative group">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-brand-500 transition-colors" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar mudanças por título, número ou descrição..."
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white transition-all"
                />
              </div>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-neutral-200 rounded-lg text-sm bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
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
              className="px-3 py-2.5 border border-neutral-200 rounded-lg text-sm bg-white/50 backdrop-blur-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
            >
              <option value="">Todas as categorias</option>
              <option value="standard">Padrão</option>
              <option value="normal">Normal</option>
              <option value="emergency">Emergência</option>
            </select>

            <button
              onClick={fetchChanges}
              className="p-2.5 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 text-white hover:from-brand-600 hover:to-purple-700 transition-all shadow-lg shadow-brand-200 hover:shadow-xl hover:shadow-brand-300"
              title="Atualizar lista"
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-neutral-600">{error}</p>
          </div>
        ) : changes.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
            <ArrowsRightLeftIcon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">Nenhuma mudança encontrada</h3>
            <p className="text-neutral-500 mb-4">Crie sua primeira requisição de mudança</p>
            <button
              onClick={() => router.push('/admin/changes/new')}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
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
                  className="glass-panel group hover:scale-[1.02] hover:shadow-xl hover:shadow-brand-100 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Risk Indicator with Animation */}
                    <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                      <div className={`w-2 h-12 sm:w-12 sm:h-2 rounded-full ${riskColors[change.risk_level] || riskColors.medium} shadow-lg group-hover:shadow-xl transition-shadow`}></div>
                      <div className={`p-2 sm:p-3 rounded-xl ${statusCfg.bgColor} group-hover:scale-110 transition-transform`}>
                        <StatusIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${statusCfg.color}`} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-2 py-1 rounded">{change.change_number}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.bgColor} ${statusCfg.color} shadow-sm`}>
                          {statusCfg.label}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${categoryCfg.bgColor} ${categoryCfg.color} shadow-sm`}>
                          {categoryCfg.label}
                        </span>
                        {change.category === 'emergency' && (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full text-xs font-semibold shadow-lg animate-pulse">
                            <BoltIcon className="w-3 h-3" />
                            Urgente
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-neutral-900 group-hover:text-brand-600 line-clamp-1 mb-2 text-lg transition-colors">
                        {change.title}
                      </h3>

                      <p className="text-sm text-neutral-600 line-clamp-2 mb-3">
                        {change.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
                        <span className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-lg">
                          <ShieldCheckIcon className="w-4 h-4 text-orange-500" />
                          <span className="font-medium">Risco: {change.risk_score}</span>
                        </span>
                        {change.scheduled_start_date && (
                          <span className="flex items-center gap-1.5 bg-brand-50 px-2 py-1 rounded-lg">
                            <CalendarIcon className="w-4 h-4 text-brand-500" />
                            <span className="font-medium">{formatDate(change.scheduled_start_date)}</span>
                          </span>
                        )}
                        {change.assignee_name && (
                          <span className="flex items-center gap-1.5 bg-purple-50 px-2 py-1 rounded-lg">
                            <span className="font-medium">{change.assignee_name}</span>
                          </span>
                        )}
                        {change.cab_meeting_id && (
                          <span className="flex items-center gap-1.5 text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                            <UserGroupIcon className="w-4 h-4" />
                            <span className="font-semibold">CAB Agendado</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRightIcon className="w-5 h-5 text-neutral-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all flex-shrink-0 hidden sm:block" />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-neutral-500">Página {page} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg disabled:opacity-50"
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
