'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
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
  ArrowDownTrayIcon,
  HomeIcon
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
  critical: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800',
  high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  low: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
}

const environmentColors: Record<string, string> = {
  production: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  staging: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
  development: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  test: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  dr: 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
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
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/20 to-neutral-50 dark:from-neutral-950 dark:via-blue-950/20 dark:to-neutral-950 flex items-center justify-center p-4">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Erro ao carregar CMDB</h2>
          <p className="text-description mb-4">{error}</p>
          <button
            onClick={fetchCIs}
            className="px-4 py-2 bg-brand-600 dark:bg-brand-500 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/20 to-neutral-50 dark:from-neutral-950 dark:via-blue-950/20 dark:to-neutral-950">
      {/* Modern PageHeader with Breadcrumbs */}
      <div className="glass-panel sticky top-0 z-20 border-b border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-lg bg-white/80 dark:bg-neutral-900/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <PageHeader
            title="CMDB"
            description="Configuration Management Database"
            icon={CircleStackIcon}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'CMDB' }
            ]}
            actions={[
              {
                label: 'Novo CI',
                href: '/admin/cmdb/new',
                icon: PlusIcon,
                variant: 'primary'
              }
            ]}
          />

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg border transition-all duration-200 flex items-center gap-2 text-sm font-medium ${
                showFilters
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'bg-white/50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-description hover:bg-white dark:hover:bg-neutral-800 hover:shadow-sm'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Stats Cards with Glass Panel */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-panel rounded-xl p-4 sm:p-5 border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-blue-50/30 dark:from-neutral-800 dark:to-blue-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-description mb-1">Total CIs</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-blue-500 bg-clip-text text-transparent">
                  {stats.total}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-md">
                <CircleStackIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 sm:p-5 border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-green-50/30 dark:from-neutral-800 dark:to-green-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-description mb-1">Operacionais</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 to-green-700 dark:from-green-400 dark:to-green-500 bg-clip-text text-transparent">
                  {stats.operational}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 rounded-xl shadow-md">
                <CheckCircleIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 sm:p-5 border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-red-50/30 dark:from-neutral-800 dark:to-red-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-description mb-1">Críticos</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 to-red-700 dark:from-red-400 dark:to-red-500 bg-clip-text text-transparent">
                  {stats.critical}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 rounded-xl shadow-md">
                <ExclamationTriangleIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 sm:p-5 border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-purple-50/30 dark:from-neutral-800 dark:to-purple-900/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-description mb-1">Produção</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-400 dark:to-purple-500 bg-clip-text text-transparent">
                  {stats.production}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 rounded-xl shadow-md">
                <ServerIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Filters Panel */}
      {showFilters && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-4 animate-fade-in">
          <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg p-4 sm:p-6 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Filtros de Pesquisa</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium flex items-center gap-1 transition-colors"
                >
                  <XCircleIcon className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-xs font-medium text-muted-content mb-1">Buscar</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-icon-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome, CI#, IP, hostname..."
                    className="w-full pl-9 pr-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800 transition-colors text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                  />
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-xs font-medium text-muted-content mb-1">Tipo</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800 transition-colors text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Todos os tipos</option>
                  {ciTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-muted-content mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800 transition-colors text-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Todos os status</option>
                  {ciStatuses.map(status => (
                    <option key={status.id} value={status.id}>{status.name}</option>
                  ))}
                </select>
              </div>

              {/* Environment Filter */}
              <div>
                <label className="block text-xs font-medium text-muted-content mb-1">Ambiente</label>
                <select
                  value={environmentFilter}
                  onChange={(e) => setEnvironmentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800 transition-colors text-neutral-900 dark:text-neutral-100"
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
                <label className="block text-xs font-medium text-muted-content mb-1">Criticidade</label>
                <select
                  value={criticalityFilter}
                  onChange={(e) => setCriticalityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800 transition-colors text-neutral-900 dark:text-neutral-100"
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
              <div className="mt-4 pt-4 border-t border-neutral-200/50 dark:border-neutral-700/50">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modern Toolbar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="glass-panel rounded-lg p-1 border border-neutral-200/50 dark:border-neutral-700/50 bg-white/50 dark:bg-neutral-800/50">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-brand-500 dark:bg-brand-600 text-white shadow-sm'
                    : 'text-muted-content hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-brand-500 dark:bg-brand-600 text-white shadow-sm'
                    : 'text-muted-content hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                <ListBulletIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCIs}
              className="p-2 rounded-lg glass-panel border border-neutral-200/50 dark:border-neutral-700/50 text-description hover:bg-white dark:hover:bg-neutral-800 hover:shadow-md transition-all"
              title="Atualizar"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              className="p-2 rounded-lg glass-panel border border-neutral-200/50 dark:border-neutral-700/50 text-description hover:bg-white dark:hover:bg-neutral-800 hover:shadow-md transition-all"
              title="Exportar"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-8">
        {loading && !cis.length ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 dark:border-brand-400"></div>
          </div>
        ) : cis.length === 0 ? (
          <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-8 text-center bg-white/80 dark:bg-neutral-900/80">
            <CircleStackIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">Nenhum CI encontrado</h3>
            <p className="text-muted-content mb-4">
              {hasActiveFilters
                ? 'Tente ajustar os filtros de busca'
                : 'Comece adicionando itens de configuração ao CMDB'}
            </p>
            <button
              onClick={() => router.push('/admin/cmdb/new')}
              className="px-4 py-2 bg-brand-600 dark:bg-brand-500 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors"
            >
              Adicionar CI
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Modern Grid View with Glass Panel Cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {cis.map((ci) => {
              const IconComponent = getIcon(ci.ci_type_icon)
              const StatusIcon = getStatusIcon(ci.is_operational)

              return (
                <div
                  key={ci.id}
                  onClick={() => handleCIClick(ci)}
                  className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-5 hover:shadow-xl hover:border-brand-300 dark:hover:border-brand-600 transition-all duration-300 cursor-pointer group bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm hover:scale-[1.02]"
                >
                  {/* Header with Icon and Status */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="p-2.5 rounded-xl shadow-sm"
                      style={{
                        backgroundColor: `${ci.ci_type_color}15`,
                        borderColor: `${ci.ci_type_color}30`
                      }}
                    >
                      <div className="w-7 h-7" style={{ color: ci.ci_type_color }}>
                        <IconComponent className="w-full h-full" />
                      </div>
                    </div>
                    <StatusIcon
                      className={`w-6 h-6 ${
                        ci.is_operational
                          ? 'text-green-500 dark:text-green-400 drop-shadow-sm'
                          : 'text-red-500 dark:text-red-400 drop-shadow-sm'
                      }`}
                    />
                  </div>

                  {/* CI Name and Number */}
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 mb-1 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors text-base">
                    {ci.name}
                  </h3>
                  <p className="text-xs font-medium text-muted-content mb-3">{ci.ci_number}</p>

                  {/* Technical Details */}
                  <div className="space-y-2 mb-3">
                    {ci.hostname && (
                      <div className="flex items-center gap-2 text-sm text-description">
                        <ComputerDesktopIcon className="w-4 h-4 text-icon-muted flex-shrink-0" />
                        <span className="truncate font-mono text-xs">{ci.hostname}</span>
                      </div>
                    )}
                    {ci.ip_address && (
                      <div className="flex items-center gap-2 text-sm text-description">
                        <GlobeAltIcon className="w-4 h-4 text-icon-muted flex-shrink-0" />
                        <span className="font-mono text-xs">{ci.ip_address}</span>
                      </div>
                    )}
                  </div>

                  {/* Environment and Criticality Tags */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-200/50 dark:border-neutral-700/50">
                    {ci.environment && (
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm ${
                          environmentColors[ci.environment] || 'bg-neutral-100 dark:bg-neutral-800 text-description'
                        }`}
                      >
                        {ci.environment}
                      </span>
                    )}
                    {ci.criticality && (
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border shadow-sm ${criticalityColors[ci.criticality]}`}
                      >
                        {ci.criticality}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs font-medium text-muted-content">{ci.ci_type_name}</span>
                    <ChevronRightIcon className="w-5 h-5 text-neutral-300 dark:text-neutral-600 group-hover:text-brand-500 dark:group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Modern List View */
          <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 overflow-hidden shadow-lg bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">CI</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider hidden sm:table-cell">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider hidden md:table-cell">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider hidden lg:table-cell">Ambiente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider hidden lg:table-cell">Criticidade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider hidden xl:table-cell">IP / Hostname</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {cis.map((ci) => {
                    const IconComponent = getIcon(ci.ci_type_icon)

                    return (
                      <tr
                        key={ci.id}
                        onClick={() => handleCIClick(ci)}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
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
                              <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{ci.name}</p>
                              <p className="text-xs text-muted-content">{ci.ci_number}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-description">{ci.ci_type_name}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            {ci.is_operational ? (
                              <CheckCircleIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                            ) : (
                              <PauseCircleIcon className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                            )}
                            <span className="text-sm text-description">{ci.status_name}</span>
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
                          <div className="text-sm text-description">
                            {ci.ip_address && <p>{ci.ip_address}</p>}
                            {ci.hostname && <p className="text-icon-muted">{ci.hostname}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRightIcon className="w-5 h-5 text-neutral-300 dark:text-neutral-600" />
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
            <p className="text-sm text-muted-content">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-neutral-700 dark:text-neutral-300"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 text-sm bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-neutral-700 dark:text-neutral-300"
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
