'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'
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
  under_review: number
  in_progress: number
  completed: number
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
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
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

  const debouncedSearch = useDebounce(search, 300)

  const fetchChanges = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      if (debouncedSearch) params.append('search', debouncedSearch)
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
  }, [page, debouncedSearch, statusFilter, categoryFilter])

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

  const hasActiveFilters = search || statusFilter || categoryFilter

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setCategoryFilter('')
    setPage(1)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Gestão de Mudanças"
        description="Requisições de mudança e fluxo CAB"
        icon={ArrowsRightLeftIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
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

      {/* Stats Cards */}
      <StatsGrid cols={5}>
        <StatsCard
          title="Total"
          value={stats?.total || 0}
          icon={<ArrowsRightLeftIcon />}
          color="neutral"
          size="md"
        />
        <StatsCard
          title="Em Revisão"
          value={stats?.under_review || 0}
          icon={<ClockIcon />}
          color="warning"
          size="md"
        />
        <StatsCard
          title="Em Execução"
          value={stats?.in_progress || 0}
          icon={<PlayIcon />}
          color="info"
          size="md"
        />
        <StatsCard
          title="Concluídos"
          value={stats?.completed || 0}
          icon={<CheckCircleIcon />}
          color="success"
          size="md"
        />
        <StatsCard
          title="Emergências"
          value={stats?.emergency || 0}
          icon={<FireIcon />}
          color="error"
          size="md"
        />
      </StatsGrid>

      {/* Filters */}
      <div className="glass-panel animate-slide-up">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-icon-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, número ou descrição..."
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 transition-all"
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

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 transition-all"
          >
            <option value="">Todas as categorias</option>
            <option value="standard">Padrão</option>
            <option value="normal">Normal</option>
            <option value="emergency">Emergência</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchChanges}
              className="p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-description hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              title="Atualizar"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="p-2.5 rounded-lg text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                title="Limpar filtros"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Changes List */}
      <div className="animate-slide-up">
        {loading && !changes.length ? (
          <div className="glass-panel text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 dark:border-brand-400 mx-auto mb-4"></div>
            <p className="text-description">Carregando mudanças...</p>
          </div>
        ) : error ? (
          <div className="glass-panel text-center py-12">
            <ExclamationTriangleIcon className="w-16 h-16 text-error-500 dark:text-error-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Erro ao carregar</h3>
            <p className="text-description mb-6">{error}</p>
            <button
              onClick={fetchChanges}
              className="btn btn-primary"
            >
              Tentar Novamente
            </button>
          </div>
        ) : changes.length === 0 ? (
          <div className="glass-panel text-center py-12">
            <ArrowsRightLeftIcon className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Nenhuma mudança encontrada</h3>
            <p className="text-description mb-6">
              {hasActiveFilters ? 'Tente ajustar os filtros de busca' : 'Crie sua primeira requisição de mudança'}
            </p>
            <button
              onClick={() => router.push('/admin/changes/new')}
              className="btn btn-primary"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Nova RFC
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {changes.map((change) => {
              const statusCfg = getStatusConfig(change.status)
              const categoryCfg = getCategoryConfig(change.category)
              const StatusIcon = statusCfg.icon

              return (
                <div
                  key={change.id}
                  onClick={() => router.push(`/admin/changes/${change.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/admin/changes/${change.id}`) } }}
                  role="button"
                  tabIndex={0}
                  className="glass-panel hover:shadow-large hover:-translate-y-1 cursor-pointer group transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Status Icon */}
                    <div className={`p-3 rounded-xl ${statusCfg.bgColor} flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <StatusIcon className={`w-6 h-6 ${statusCfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-muted-content font-semibold">{change.change_number}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryCfg.bgColor} ${categoryCfg.color}`}>
                          {categoryCfg.label}
                        </span>
                        {change.category === 'emergency' && (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full text-xs font-semibold animate-pulse">
                            <BoltIcon className="w-3 h-3" />
                            Urgente
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 line-clamp-1 mb-2 transition-colors">
                        {change.title}
                      </h3>

                      <p className="text-sm text-description line-clamp-2 mb-3">
                        {change.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-content">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheckIcon className="w-4 h-4" />
                          <span className="font-medium">Risco: {change.risk_score}</span>
                        </span>
                        {change.scheduled_start_date && (
                          <span className="flex items-center gap-1.5">
                            <CalendarIcon className="w-4 h-4" />
                            <span className="font-medium">{formatDate(change.scheduled_start_date)}</span>
                          </span>
                        )}
                        {change.assignee_name && (
                          <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                            {change.assignee_name}
                          </span>
                        )}
                        {change.cab_meeting_id && (
                          <span className="flex items-center gap-1.5">
                            <UserGroupIcon className="w-4 h-4" />
                            <span className="font-semibold">CAB Agendado</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRightIcon className="w-5 h-5 text-neutral-300 dark:text-neutral-600 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors flex-shrink-0 hidden sm:block" />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 glass-panel">
            <div className="flex items-center justify-between">
              <p className="text-sm text-description">
                Página <span className="font-semibold text-neutral-900 dark:text-neutral-100">{page}</span> de <span className="font-semibold">{totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
