'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ServerIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  CloudIcon,
  CircleStackIcon,
  DevicePhoneMobileIcon,
  PrinterIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PauseCircleIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline'

interface CI {
  id: number
  ci_number: string
  name: string
  description: string
  ci_type_id: number
  ci_type_name: string
  ci_type_icon: string
  ci_type_color: string
  status_id: number
  status_name: string
  status_color: string
  is_operational: boolean
  environment: string
  criticality: string
  hostname: string
  ip_address: string
  owner_name: string
  team_name: string
  location: string
  created_at: string
  updated_at: string
}

interface CIType {
  id: number
  name: string
  icon: string
  color: string
}

interface CIStatus {
  id: number
  name: string
  color: string
  is_operational: boolean
}

const ciTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  server: ServerIcon,
  desktop: ComputerDesktopIcon,
  laptop: ComputerDesktopIcon,
  network: GlobeAltIcon,
  application: CpuChipIcon,
  database: CircleStackIcon,
  storage: CircleStackIcon,
  cloud: CloudIcon,
  mobile: DevicePhoneMobileIcon,
  printer: PrinterIcon,
  vm: ServerIcon,
  default: CpuChipIcon
}

const criticalityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
}

const environmentColors: Record<string, string> = {
  production: 'bg-red-50 text-red-700',
  staging: 'bg-yellow-50 text-yellow-700',
  development: 'bg-blue-50 text-blue-700',
  test: 'bg-purple-50 text-purple-700',
  dr: 'bg-gray-50 text-gray-700'
}

export default function CMDBPage() {
  const router = useRouter()
  const [cis, setCIs] = useState<CI[]>([])
  const [ciTypes, setCITypes] = useState<CIType[]>([])
  const [ciStatuses, setCIStatuses] = useState<CIStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [environmentFilter, setEnvironmentFilter] = useState('')
  const [criticalityFilter, setCriticalityFilter] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    operational: 0,
    critical: 0,
    production: 0
  })

  const fetchCIs = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })

      if (search) params.append('search', search)
      if (typeFilter) params.append('ci_type_id', typeFilter)
      if (statusFilter) params.append('status_id', statusFilter)
      if (environmentFilter) params.append('environment', environmentFilter)
      if (criticalityFilter) params.append('criticality', criticalityFilter)

      const response = await fetch(`/api/cmdb?${params}`)
      const data = await response.json()

      if (data.success) {
        setCIs(data.configuration_items)
        setTotalPages(data.pagination.total_pages)
        setTotal(data.pagination.total)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Erro ao carregar itens de configuração')
    } finally {
      setLoading(false)
    }
  }, [page, search, typeFilter, statusFilter, environmentFilter, criticalityFilter])

  const fetchMetadata = async () => {
    try {
      const [typesRes, statusesRes] = await Promise.all([
        fetch('/api/cmdb/types'),
        fetch('/api/cmdb/statuses')
      ])

      const typesData = await typesRes.json()
      const statusesData = await statusesRes.json()

      if (typesData.success) setCITypes(typesData.types)
      if (statusesData.success) setCIStatuses(statusesData.statuses)
    } catch {
      // Silently fail - will use defaults
    }
  }

  useEffect(() => {
    fetchMetadata()
  }, [])

  useEffect(() => {
    fetchCIs()
  }, [fetchCIs])

  useEffect(() => {
    // Calculate stats from loaded CIs
    const operational = cis.filter(ci => ci.is_operational).length
    const critical = cis.filter(ci => ci.criticality === 'critical').length
    const production = cis.filter(ci => ci.environment === 'production').length

    setStats({
      total,
      operational,
      critical,
      production
    })
  }, [cis, total])

  const getIcon = (iconName: string) => {
    const IconComponent = ciTypeIcons[iconName?.toLowerCase()] || ciTypeIcons.default
    return IconComponent
  }

  const getStatusIcon = (isOperational: boolean) => {
    if (isOperational) return CheckCircleIcon
    return XCircleIcon
  }

  const handleCIClick = (ci: CI) => {
    router.push(`/admin/cmdb/${ci.id}`)
  }

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('')
    setStatusFilter('')
    setEnvironmentFilter('')
    setCriticalityFilter('')
    setPage(1)
  }

  const hasActiveFilters = search || typeFilter || statusFilter || environmentFilter || criticalityFilter

  if (error && !cis.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar CMDB</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchCIs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CircleStackIcon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
                <span>CMDB</span>
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Configuration Management Database
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/admin/cmdb/new')}
                className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Novo CI</span>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}
              >
                <FunnelIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Total CIs</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                <CircleStackIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Operacionais</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.operational}</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Críticos</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">{stats.critical}</p>
              </div>
              <div className="p-2 sm:p-3 bg-red-100 rounded-lg">
                <ExclamationTriangleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Produção</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.production}</p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                <ServerIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome, CI#, IP, hostname..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os tipos</option>
                  {ciTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os status</option>
                  {ciStatuses.map(status => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
              </div>

              {/* Environment Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ambiente</label>
                <select
                  value={environmentFilter}
                  onChange={(e) => setEnvironmentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  <option value="production">Produção</option>
                  <option value="staging">Staging</option>
                  <option value="development">Desenvolvimento</option>
                  <option value="test">Teste</option>
                  <option value="dr">DR</option>
                </select>
              </div>

              {/* Criticality Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Criticidade</label>
                <select
                  value={criticalityFilter}
                  onChange={(e) => setCriticalityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todas</option>
                  <option value="critical">Crítico</option>
                  <option value="high">Alto</option>
                  <option value="medium">Médio</option>
                  <option value="low">Baixo</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <XCircleIcon className="w-4 h-4" />
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-500 border border-gray-200'}`}
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-500 border border-gray-200'}`}
            >
              <ListBulletIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCIs}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-8">
        {loading && !cis.length ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : cis.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CircleStackIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum CI encontrado</h3>
            <p className="text-gray-500 mb-4">
              {hasActiveFilters
                ? 'Tente ajustar os filtros de busca'
                : 'Comece adicionando itens de configuração ao CMDB'}
            </p>
            <button
              onClick={() => router.push('/admin/cmdb/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Adicionar CI
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cis.map((ci) => {
              const IconComponent = getIcon(ci.ci_type_icon)
              const StatusIcon = getStatusIcon(ci.is_operational)

              return (
                <div
                  key={ci.id}
                  onClick={() => handleCIClick(ci)}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${ci.ci_type_color}20` }}
                    >
                      <div className="w-6 h-6" style={{ color: ci.ci_type_color }}>
                        <IconComponent className="w-full h-full" />
                      </div>
                    </div>
                    <StatusIcon
                      className={`w-5 h-5 ${ci.is_operational ? 'text-green-500' : 'text-red-500'}`}
                    />
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-1 truncate group-hover:text-blue-600">
                    {ci.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">{ci.ci_number}</p>

                  <div className="space-y-2">
                    {ci.hostname && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <ComputerDesktopIcon className="w-4 h-4 text-gray-400" />
                        <span className="truncate">{ci.hostname}</span>
                      </div>
                    )}
                    {ci.ip_address && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <GlobeAltIcon className="w-4 h-4 text-gray-400" />
                        <span>{ci.ip_address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    {ci.environment && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${environmentColors[ci.environment] || 'bg-gray-100 text-gray-600'}`}>
                        {ci.environment}
                      </span>
                    )}
                    {ci.criticality && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${criticalityColors[ci.criticality]}`}>
                        {ci.criticality}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">{ci.ci_type_name}</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CI</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Ambiente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Criticidade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">IP / Hostname</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cis.map((ci) => {
                    const IconComponent = getIcon(ci.ci_type_icon)

                    return (
                      <tr
                        key={ci.id}
                        onClick={() => handleCIClick(ci)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="p-2 rounded-lg flex-shrink-0"
                              style={{ backgroundColor: `${ci.ci_type_color}20` }}
                            >
                              <div className="w-5 h-5" style={{ color: ci.ci_type_color }}>
                                <IconComponent className="w-full h-full" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">{ci.name}</p>
                              <p className="text-xs text-gray-500">{ci.ci_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-gray-600">{ci.ci_type_name}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            {ci.is_operational ? (
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                            ) : (
                              <PauseCircleIcon className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className="text-sm text-gray-600">{ci.status_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {ci.environment && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${environmentColors[ci.environment]}`}>
                              {ci.environment}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {ci.criticality && (
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${criticalityColors[ci.criticality]}`}>
                              {ci.criticality}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="text-sm text-gray-600">
                            {ci.ip_address && <p>{ci.ip_address}</p>}
                            {ci.hostname && <p className="text-gray-400">{ci.hostname}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRightIcon className="w-5 h-5 text-gray-300" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
