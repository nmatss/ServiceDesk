'use client'

import { useState, useEffect, useCallback } from 'react'
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
  new: { label: 'Novo', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: ExclamationTriangleIcon },
  investigation: { label: 'Em Investigação', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: DocumentMagnifyingGlassIcon },
  root_cause_identified: { label: 'Causa Raiz Identificada', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: LightBulbIcon },
  known_error: { label: 'Erro Conhecido', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: BugAntIcon },
  resolved: { label: 'Resolvido', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircleIcon },
  closed: { label: 'Fechado', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: CheckCircleIcon }
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

  const fetchProblems = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      if (priorityFilter) params.append('priority', priorityFilter)

      const response = await fetch(`/api/problems?${params}`)
      const data = await response.json()

      if (data.success) {
        setProblems(data.problems || [])
        setTotalPages(data.pagination?.total_pages || 1)
        if (data.statistics) {
          setStats(data.statistics)
        }
      } else {
        setError(data.error)
      }
    } catch {
      setError('Erro ao carregar problemas')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, priorityFilter])

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BugAntIcon className="w-6 h-6 sm:w-7 sm:h-7 text-purple-600" />
                <span>Gestão de Problemas</span>
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Análise de causa raiz e erros conhecidos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/admin/problems/kedb')}
                className="px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg flex items-center gap-2"
              >
                <BeakerIcon className="w-4 h-4" />
                <span className="hidden sm:inline">KEDB</span>
              </button>
              <button
                onClick={() => router.push('/admin/problems/new')}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Novo Problema</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Total</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                <BugAntIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Novos</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.new}</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <ExclamationTriangleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Investigação</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.investigation}</p>
              </div>
              <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
                <DocumentMagnifyingGlassIcon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Erros Conhecidos</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-600">{stats.known_error}</p>
              </div>
              <div className="p-2 sm:p-3 bg-orange-100 rounded-lg">
                <ShieldExclamationIcon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Resolvidos</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.resolved}</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar problemas..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
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
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
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
                className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Problems List */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-8">
        {loading && !problems.length ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">{error}</p>
            <button
              onClick={fetchProblems}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Tentar Novamente
            </button>
          </div>
        ) : problems.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <BugAntIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum problema encontrado</h3>
            <p className="text-gray-500 mb-4">
              {hasActiveFilters ? 'Tente ajustar os filtros' : 'Registre problemas para análise de causa raiz'}
            </p>
            <button
              onClick={() => router.push('/admin/problems/new')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Registrar Problema
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {problems.map((problem) => {
              const config = getStatusConfig(problem.status)
              const StatusIcon = config.icon

              return (
                <div
                  key={problem.id}
                  onClick={() => router.push(`/admin/problems/${problem.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-purple-200 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Status Icon */}
                    <div className={`p-2 sm:p-3 rounded-xl ${config.bgColor} flex-shrink-0`}>
                      <StatusIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">{problem.problem_number}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                          {config.label}
                        </span>
                        {problem.priority && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[problem.priority]}`}>
                            {problem.priority}
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 line-clamp-1 mb-1">
                        {problem.title}
                      </h3>

                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {problem.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {problem.incident_count > 0 && (
                          <span className="flex items-center gap-1">
                            <LinkIcon className="w-3.5 h-3.5" />
                            {problem.incident_count} incidente{problem.incident_count > 1 ? 's' : ''}
                          </span>
                        )}
                        {problem.category_name && (
                          <span>{problem.category_name}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          {formatDateTime(problem.created_at)}
                        </span>
                      </div>

                      {/* Root Cause / Workaround indicators */}
                      {(problem.root_cause || problem.workaround) && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {problem.root_cause && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">
                              <LightBulbIcon className="w-3 h-3" />
                              Causa identificada
                            </span>
                          )}
                          {problem.workaround && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              <BeakerIcon className="w-3 h-3" />
                              Workaround disponível
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <ChevronRightIcon className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors flex-shrink-0 hidden sm:block" />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
