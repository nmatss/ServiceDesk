'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useRouter } from 'next/navigation'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  BugAntIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentMagnifyingGlassIcon,
  ChevronRightIcon,
  XCircleIcon,
  LinkIcon,
  BeakerIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'

interface Problem {
  id: number
  problem_number: string
  title: string
  description: string
  status: string
  priority: string
  category_name: string
  root_cause: string | null
  workaround: string | null
  permanent_fix: string | null
  affected_services: string | null
  incident_count: number
  assigned_to_name: string | null
  team_name: string | null
  created_at: string
  updated_at: string
  time_to_identify: number | null
  time_to_resolve: number | null
}

interface ProblemStats {
  total: number
  new: number
  investigation: number
  known_error: number
  resolved: number
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  new: { label: 'Novo', color: 'text-brand-700', bgColor: 'bg-brand-100', icon: ExclamationTriangleIcon },
  investigation: { label: 'Em Investigação', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: DocumentMagnifyingGlassIcon },
  root_cause_identified: { label: 'Causa Raiz Identificada', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: LightBulbIcon },
  known_error: { label: 'Erro Conhecido', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: BugAntIcon },
  resolved: { label: 'Resolvido', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircleIcon },
  closed: { label: 'Fechado', color: 'text-neutral-700', bgColor: 'bg-neutral-100', icon: CheckCircleIcon }
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
}

export default function ProblemsPage() {
  const router = useRouter()
  const [problems, setProblems] = useState<Problem[]>([])
  const [stats, setStats] = useState<ProblemStats>({ total: 0, new: 0, investigation: 0, known_error: 0, resolved: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const debouncedSearch = useDebounce(search, 300)

  const fetchProblems = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      if (debouncedSearch) params.append('search', debouncedSearch)
      if (statusFilter) params.append('status', statusFilter)
      if (priorityFilter) params.append('priority', priorityFilter)

      // Fetch problems and statistics in parallel
      const [problemsResponse, statsResponse] = await Promise.all([
        fetch(`/api/problems?${params}`, { credentials: 'include' }),
        fetch('/api/problems/statistics', { credentials: 'include' })
      ])

      const problemsData = await problemsResponse.json()
      const statsData = await statsResponse.json()

      if (problemsData.success && problemsData.data) {
        // API returns { success, data: { data: [...], total, page, limit, totalPages, hasNext, hasPrev } }
        const paginated = problemsData.data
        const problemsList = (paginated.data || []).map((p: any) => ({
          ...p,
          // Map nested relations to flat fields expected by the component
          priority: p.priority?.name?.toLowerCase() || '',
          category_name: p.category?.name || '',
          assigned_to_name: p.assignee?.name || null,
          team_name: p.assigned_group?.name || null,
        }))
        setProblems(problemsList)
        setTotalPages(paginated.totalPages || 1)
      } else {
        setError(problemsData.error)
      }

      // Parse statistics from the separate endpoint
      // API returns { success, data: { problems: { total, by_status, ... }, known_errors: { ... } } }
      if (statsData.success && statsData.data?.problems) {
        const problemStats = statsData.data.problems
        setStats({
          total: problemStats.total || 0,
          new: problemStats.by_status?.new || 0,
          investigation: problemStats.by_status?.investigation || 0,
          known_error: problemStats.by_status?.known_error || 0,
          resolved: problemStats.by_status?.resolved || 0,
        })
      }
    } catch {
      setError('Erro ao carregar problemas')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, priorityFilter])

  useEffect(() => {
    fetchProblems()
  }, [fetchProblems])

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || statusConfig.new
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setPriorityFilter('')
    setPage(1)
  }

  const hasActiveFilters = search || statusFilter || priorityFilter

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Gestão de Problemas"
        description="Análise de causa raiz e base de erros conhecidos (KEDB)"
        icon={BugAntIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Problemas' }
        ]}
        actions={[
          {
            label: 'KEDB',
            icon: BeakerIcon,
            variant: 'secondary',
            onClick: () => router.push('/admin/problems/kedb')
          },
          {
            label: 'Novo Problema',
            icon: PlusIcon,
            variant: 'primary',
            onClick: () => router.push('/admin/problems/new')
          }
        ]}
      />

      {/* Stats Cards */}
      <StatsGrid cols={5}>
        <StatsCard
          title="Total de Problemas"
          value={stats.total}
          icon={<BugAntIcon />}
          color="neutral"
          size="md"
        />

        <StatsCard
          title="Novos"
          value={stats.new}
          icon={<ExclamationTriangleIcon />}
          color="info"
          size="md"
        />

        <StatsCard
          title="Em Investigação"
          value={stats.investigation}
          icon={<DocumentMagnifyingGlassIcon />}
          color="warning"
          size="md"
        />

        <StatsCard
          title="Erros Conhecidos"
          value={stats.known_error}
          icon={<ShieldExclamationIcon />}
          color="error"
          size="md"
        />

        <StatsCard
          title="Resolvidos"
          value={stats.resolved}
          icon={<CheckCircleIcon />}
          color="success"
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
            <option value="new">Novo</option>
            <option value="investigation">Em Investigação</option>
            <option value="root_cause_identified">Causa Raiz Identificada</option>
            <option value="known_error">Erro Conhecido</option>
            <option value="resolved">Resolvido</option>
            <option value="closed">Fechado</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 transition-all"
          >
            <option value="">Todas as prioridades</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchProblems}
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

      {/* Problems List */}
      <div className="animate-slide-up">
        {loading && !problems.length ? (
          <div className="glass-panel text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 dark:border-brand-400 mx-auto mb-4"></div>
            <p className="text-description">Carregando problemas...</p>
          </div>
        ) : error ? (
          <div className="glass-panel text-center py-12">
            <ExclamationTriangleIcon className="w-16 h-16 text-error-500 dark:text-error-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Erro ao carregar</h3>
            <p className="text-description mb-6">{error}</p>
            <button
              onClick={fetchProblems}
              className="btn btn-primary"
            >
              Tentar Novamente
            </button>
          </div>
        ) : problems.length === 0 ? (
          <div className="glass-panel text-center py-12">
            <BugAntIcon className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Nenhum problema encontrado</h3>
            <p className="text-description mb-6">
              {hasActiveFilters ? 'Tente ajustar os filtros de busca' : 'Registre problemas para análise de causa raiz e gestão de erros conhecidos'}
            </p>
            <button
              onClick={() => router.push('/admin/problems/new')}
              className="btn btn-primary"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Registrar Primeiro Problema
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {problems.map((problem) => {
              const config = getStatusConfig(problem.status)
              const StatusIcon = config.icon

              return (
                <div
                  key={problem.id}
                  onClick={() => router.push(`/admin/problems/${problem.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/admin/problems/${problem.id}`) } }}
                  role="button"
                  tabIndex={0}
                  className="glass-panel hover:shadow-large hover:-translate-y-1 cursor-pointer group transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Status Icon */}
                    <div className={`p-3 rounded-xl ${config.bgColor} flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                      <StatusIcon className={`w-6 h-6 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-muted-content font-semibold">{problem.problem_number}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                        {problem.priority && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${priorityColors[problem.priority]}`}>
                            {problem.priority.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 line-clamp-1 mb-2 transition-colors">
                        {problem.title}
                      </h3>

                      <p className="text-sm text-description line-clamp-2 mb-3">
                        {problem.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-content">
                        {problem.incident_count > 0 && (
                          <span className="flex items-center gap-1.5">
                            <LinkIcon className="w-4 h-4" />
                            <span className="font-medium">{problem.incident_count} incidente{problem.incident_count > 1 ? 's' : ''}</span>
                          </span>
                        )}
                        {problem.category_name && (
                          <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                            {problem.category_name}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <ClockIcon className="w-4 h-4" />
                          {formatDateTime(problem.created_at)}
                        </span>
                      </div>

                      {/* Root Cause / Workaround indicators */}
                      {(problem.root_cause || problem.workaround) && (
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                          {problem.root_cause && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg text-xs font-medium">
                              <LightBulbIcon className="w-4 h-4" />
                              Causa raiz identificada
                            </span>
                          )}
                          {problem.workaround && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-lg text-xs font-medium">
                              <BeakerIcon className="w-4 h-4" />
                              Workaround disponível
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <ChevronRightIcon className="w-5 h-5 text-neutral-400 dark:text-neutral-600 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors flex-shrink-0 hidden sm:block" />
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
