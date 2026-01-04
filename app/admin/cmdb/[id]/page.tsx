'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
import {
  ArrowLeftIcon,
  ServerIcon,
  HomeIcon,
  ComputerDesktopIcon,
  CpuChipIcon,
  CloudIcon,
  CircleStackIcon,
  DevicePhoneMobileIcon,
  PrinterIcon,
  GlobeAltIcon,
  PencilIcon,
  TrashIcon,
  LinkIcon,
  ClockIcon,
  UserIcon,
  UsersIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ShieldExclamationIcon,
  PlusIcon
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
  mac_address: string
  serial_number: string
  asset_tag: string
  os_version: string
  vendor: string
  manufacturer: string
  location: string
  data_center: string
  rack_position: string
  business_service: string
  business_impact: string
  recovery_time_objective: number
  recovery_point_objective: number
  owner_id: number
  owner_name: string
  owner_email: string
  managed_by_team_id: number
  team_name: string
  purchase_date: string
  installation_date: string
  warranty_expiry: string
  end_of_life_date: string
  custom_attributes: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface Relationship {
  id: number
  relationship_type: string
  reverse_name: string
  related_ci_id: number
  related_ci_number: string
  related_ci_name: string
  related_ci_type: string
  related_ci_icon: string
  related_ci_status: string
  related_ci_status_color: string
  is_critical_path: boolean
}

interface HistoryEntry {
  id: number
  action: string
  changes: string
  changed_by_name: string
  changed_at: string
}

interface LinkedTicket {
  id: number
  ticket_id: number
  ticket_title: string
  ticket_status: string
  ticket_priority: string
  link_type: string
  linked_at: string
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
  critical: 'bg-error-100 text-error-800 border-error-200 dark:bg-error-900/20 dark:text-error-200 dark:border-error-800',
  high: 'bg-warning-100 text-warning-800 border-warning-200 dark:bg-warning-900/20 dark:text-warning-200 dark:border-warning-800',
  medium: 'bg-warning-100 text-warning-800 border-warning-200 dark:bg-warning-900/20 dark:text-warning-200 dark:border-warning-800',
  low: 'bg-success-100 text-success-800 border-success-200 dark:bg-success-900/20 dark:text-success-200 dark:border-success-800'
}

const environmentColors: Record<string, string> = {
  production: 'bg-error-50 text-error-700 border-error-200 dark:bg-error-900/20 dark:text-error-200 dark:border-error-800',
  staging: 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-200 dark:border-warning-800',
  development: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/20 dark:text-brand-200 dark:border-brand-800',
  test: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-800',
  dr: 'bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-900/20 dark:text-neutral-200 dark:border-neutral-800'
}

export default function CIDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [ci, setCI] = useState<CI | null>(null)
  const [outgoingRelationships, setOutgoingRelationships] = useState<Relationship[]>([])
  const [incomingRelationships, setIncomingRelationships] = useState<Relationship[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [linkedTickets, setLinkedTickets] = useState<LinkedTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'relationships' | 'tickets' | 'history'>('details')

  useEffect(() => {
    fetchCI()
  }, [id])

  const fetchCI = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/cmdb/${id}`)
      const data = await response.json()

      if (data.success) {
        setCI(data.configuration_item)
        setHistory(data.history || [])
        setLinkedTickets(data.linked_tickets || [])

        // Fetch relationships
        const relResponse = await fetch(`/api/cmdb/${id}/relationships`)
        const relData = await relResponse.json()
        if (relData.success) {
          setOutgoingRelationships(relData.outgoing_relationships || [])
          setIncomingRelationships(relData.incoming_relationships || [])
        }
      } else {
        setError(data.error)
      }
    } catch {
      setError('Erro ao carregar item de configuração')
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (iconName: string) => {
    const IconComponent = ciTypeIcons[iconName?.toLowerCase()] || ciTypeIcons.default
    return IconComponent
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('pt-BR')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (error || !ci) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-error-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Erro ao carregar CI</h2>
          <p className="text-description mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin/cmdb')}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Voltar ao CMDB
          </button>
        </div>
      </div>
    )
  }

  const IconComponent = getIcon(ci.ci_type_icon)
  const totalRelationships = outgoingRelationships.length + incomingRelationships.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-brand-50/20 to-neutral-50 dark:from-neutral-950 dark:via-brand-950/20 dark:to-neutral-950">
      {/* Modern Header with Breadcrumbs */}
      <div className="glass-panel sticky top-0 z-20 border-b border-neutral-200/50 dark:border-neutral-700/50 backdrop-blur-lg bg-white/80 dark:bg-neutral-900/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <button
              onClick={() => router.push('/admin/cmdb')}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-description" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/admin/cmdb/${id}/edit`)}
                className="p-2 glass-panel border border-neutral-200/50 dark:border-neutral-700/50 rounded-lg hover:bg-white dark:hover:bg-neutral-800 hover:shadow-md transition-all"
                title="Editar"
              >
                <PencilIcon className="w-5 h-5 text-description" />
              </button>
              <button
                className="p-2 glass-panel border border-error-200/50 dark:border-error-800/50 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 hover:shadow-md transition-all"
                title="Excluir"
              >
                <TrashIcon className="w-5 h-5 text-error-600 dark:text-error-400" />
              </button>
            </div>
          </div>

          <PageHeader
            title={ci.name}
            description={`${ci.ci_number} • ${ci.ci_type_name}`}
            icon={IconComponent}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'CMDB', href: '/admin/cmdb' },
              { label: ci.ci_number }
            ]}
          />

          {/* Status Badge */}
          <div className="flex items-center gap-2 mt-4">
            {ci.is_operational ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-200 rounded-lg border border-success-200 dark:border-success-800">
                <CheckCircleIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Operacional</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-error-100 text-error-700 dark:bg-error-900/20 dark:text-error-200 rounded-lg border border-error-200 dark:border-error-800">
                <XCircleIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Não Operacional</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Quick Stats */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-panel rounded-xl p-4 border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg bg-gradient-to-br from-white to-brand-50/30 dark:from-neutral-800 dark:to-brand-950/30 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              {ci.environment && (
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${environmentColors[ci.environment]}`}>
                  {ci.environment}
                </span>
              )}
              {ci.criticality && (
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${criticalityColors[ci.criticality]}`}>
                  {ci.criticality}
                </span>
              )}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-white to-purple-50/30 dark:from-neutral-800 dark:to-purple-950/30 animate-fade-in">
            <div className="flex items-center gap-2 text-sm font-medium text-description mb-2">
              <ArrowsRightLeftIcon className="w-4 h-4" />
              <span>Relacionamentos</span>
            </div>
            <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-400 dark:to-purple-500 bg-clip-text text-transparent">
              {totalRelationships}
            </p>
          </div>

          <div className="glass-panel rounded-xl p-4 border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-white to-brand-50/30 dark:from-neutral-800 dark:to-brand-950/30 animate-fade-in">
            <div className="flex items-center gap-2 text-sm font-medium text-description mb-2">
              <DocumentTextIcon className="w-4 h-4" />
              <span>Tickets</span>
            </div>
            <p className="text-2xl font-bold bg-gradient-to-r from-brand-600 to-brand-700 dark:from-brand-400 dark:to-brand-500 bg-clip-text text-transparent">
              {linkedTickets.length}
            </p>
          </div>

          <div className="glass-panel rounded-xl p-4 border border-neutral-200/50 dark:border-neutral-700/50 shadow-lg hover:shadow-xl transition-all bg-gradient-to-br from-white to-warning-50/30 dark:from-neutral-800 dark:to-warning-950/30 animate-fade-in">
            <div className="flex items-center gap-2 text-sm font-medium text-description mb-2">
              <ClockIcon className="w-4 h-4" />
              <span>RTO / RPO</span>
            </div>
            <p className="text-xl font-bold bg-gradient-to-r from-warning-600 to-warning-700 dark:from-warning-400 dark:to-warning-500 bg-clip-text text-transparent">
              {ci.recovery_time_objective || '-'}h / {ci.recovery_point_objective || '-'}h
            </p>
          </div>
        </div>
      </div>

      {/* Modern Tabs */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="glass-panel rounded-t-xl border border-b-0 border-neutral-200/50 dark:border-neutral-700/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
          <div className="flex overflow-x-auto">
            {[
              { id: 'details', label: 'Detalhes', icon: CpuChipIcon },
              { id: 'relationships', label: 'Relacionamentos', icon: ArrowsRightLeftIcon, count: totalRelationships },
              { id: 'tickets', label: 'Tickets', icon: DocumentTextIcon, count: linkedTickets.length },
              { id: 'history', label: 'Histórico', icon: ClockIcon, count: history.length }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400'
                    : 'text-muted-content border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    activeTab === tab.id ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' : 'bg-neutral-100 dark:bg-neutral-800 text-description'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modern Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-8">
        <div className="glass-panel rounded-b-xl border border-t-0 border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-lg">
          {activeTab === 'details' && (
            <div className="space-y-6 animate-fade-in">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <CpuChipIcon className="w-4 h-4 text-icon-muted" />
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-content mb-1">Nome</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-content mb-1">Número CI</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.ci_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-content mb-1">Tipo</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.ci_type_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-content mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {ci.is_operational ? (
                        <CheckCircleIcon className="w-4 h-4 text-success-500" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-error-500" />
                      )}
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.status_name}</span>
                    </div>
                  </div>
                  {ci.description && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-xs text-muted-content mb-1">Descrição</p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{ci.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Info */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <GlobeAltIcon className="w-4 h-4 text-icon-muted" />
                  Informações Técnicas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ci.hostname && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Hostname</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 font-mono">{ci.hostname}</p>
                    </div>
                  )}
                  {ci.ip_address && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Endereço IP</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 font-mono">{ci.ip_address}</p>
                    </div>
                  )}
                  {ci.mac_address && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">MAC Address</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 font-mono">{ci.mac_address}</p>
                    </div>
                  )}
                  {ci.os_version && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Sistema Operacional</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.os_version}</p>
                    </div>
                  )}
                  {ci.serial_number && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Número de Série</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 font-mono">{ci.serial_number}</p>
                    </div>
                  )}
                  {ci.asset_tag && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Asset Tag</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.asset_tag}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Location & Owner */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-icon-muted" />
                  Localização e Responsabilidade
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ci.location && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Localização</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.location}</p>
                    </div>
                  )}
                  {ci.data_center && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Data Center</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.data_center}</p>
                    </div>
                  )}
                  {ci.rack_position && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Posição no Rack</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.rack_position}</p>
                    </div>
                  )}
                  {ci.owner_name && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Proprietário</p>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-icon-muted" />
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.owner_name}</span>
                      </div>
                    </div>
                  )}
                  {ci.team_name && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Equipe Responsável</p>
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-icon-muted" />
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.team_name}</span>
                      </div>
                    </div>
                  )}
                  {(ci.vendor || ci.manufacturer) && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Fabricante / Fornecedor</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {[ci.manufacturer, ci.vendor].filter(Boolean).join(' / ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Info */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <ChartBarIcon className="w-4 h-4 text-icon-muted" />
                  Informações de Negócio
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ci.business_service && (
                    <div>
                      <p className="text-xs text-muted-content mb-1">Serviço de Negócio</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ci.business_service}</p>
                    </div>
                  )}
                  {ci.business_impact && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-content mb-1">Impacto no Negócio</p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{ci.business_impact}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Lifecycle Dates */}
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-icon-muted" />
                  Ciclo de Vida
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-content mb-1">Data de Compra</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatDate(ci.purchase_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-content mb-1">Data de Instalação</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatDate(ci.installation_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-content mb-1">Fim da Garantia</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatDate(ci.warranty_expiry)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-content mb-1">End of Life</p>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{formatDate(ci.end_of_life_date)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'relationships' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Mapa de Relacionamentos</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
                  <PlusIcon className="w-4 h-4" />
                  Adicionar Relacionamento
                </button>
              </div>

              {/* Visual Relationship Map */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-8">
                    {/* Incoming */}
                    <div className="space-y-2">
                      {incomingRelationships.slice(0, 5).map((rel) => (
                        <div
                          key={rel.id}
                          onClick={() => router.push(`/admin/cmdb/${rel.related_ci_id}`)}
                          className="flex items-center gap-2 px-3 py-2 glass-panel rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all"
                        >
                          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                            <LinkIcon className="w-4 h-4 text-muted-content" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[120px]">{rel.related_ci_name}</p>
                            <p className="text-xs text-muted-content">{rel.reverse_name}</p>
                          </div>
                        </div>
                      ))}
                      {incomingRelationships.length === 0 && (
                        <p className="text-sm text-icon-muted text-center">Sem dependências</p>
                      )}
                    </div>

                    {/* Arrows In */}
                    <div className="text-neutral-300 dark:text-neutral-600">
                      <ArrowsRightLeftIcon className="w-8 h-8" />
                    </div>

                    {/* Current CI */}
                    <div
                      className="p-4 rounded-xl border-2 border-brand-500 dark:border-brand-600 bg-brand-50 dark:bg-brand-900/20"
                      style={{ minWidth: '150px' }}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div
                          className="p-3 rounded-xl mb-2"
                          style={{ backgroundColor: `${ci.ci_type_color}30` }}
                        >
                          <div className="w-8 h-8" style={{ color: ci.ci_type_color }}>
                            <IconComponent className="w-full h-full" />
                          </div>
                        </div>
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[130px]">{ci.name}</p>
                        <p className="text-xs text-muted-content">{ci.ci_number}</p>
                      </div>
                    </div>

                    {/* Arrows Out */}
                    <div className="text-neutral-300 dark:text-neutral-600">
                      <ArrowsRightLeftIcon className="w-8 h-8" />
                    </div>

                    {/* Outgoing */}
                    <div className="space-y-2">
                      {outgoingRelationships.slice(0, 5).map((rel) => (
                        <div
                          key={rel.id}
                          onClick={() => router.push(`/admin/cmdb/${rel.related_ci_id}`)}
                          className={`flex items-center gap-2 px-3 py-2 glass-panel rounded-lg border cursor-pointer hover:shadow-sm transition-all ${
                            rel.is_critical_path ? 'border-error-300 dark:border-error-700 hover:border-error-400 dark:hover:border-error-600' : 'border-neutral-200 dark:border-neutral-700 hover:border-brand-300 dark:hover:border-brand-700'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            rel.is_critical_path ? 'bg-error-100 dark:bg-error-900/20' : 'bg-neutral-100 dark:bg-neutral-700'
                          }`}>
                            {rel.is_critical_path ? (
                              <ShieldExclamationIcon className="w-4 h-4 text-error-500" />
                            ) : (
                              <LinkIcon className="w-4 h-4 text-muted-content" />
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[120px]">{rel.related_ci_name}</p>
                            <p className="text-xs text-muted-content">{rel.relationship_type}</p>
                          </div>
                        </div>
                      ))}
                      {outgoingRelationships.length === 0 && (
                        <p className="text-sm text-icon-muted text-center">Sem dependentes</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Relationship List */}
              {totalRelationships > 0 && (
                <div className="space-y-4">
                  {outgoingRelationships.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Este CI depende de:</h4>
                      <div className="space-y-2">
                        {outgoingRelationships.map((rel) => (
                          <div
                            key={rel.id}
                            onClick={() => router.push(`/admin/cmdb/${rel.related_ci_id}`)}
                            className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <LinkIcon className="w-4 h-4 text-icon-muted" />
                              <div>
                                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{rel.related_ci_name}</p>
                                <p className="text-xs text-muted-content">{rel.related_ci_number} • {rel.relationship_type}</p>
                              </div>
                            </div>
                            {rel.is_critical_path && (
                              <span className="px-2 py-1 text-xs bg-error-100 dark:bg-error-900/20 text-error-700 dark:text-error-300 rounded">Crítico</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {incomingRelationships.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Dependem deste CI:</h4>
                      <div className="space-y-2">
                        {incomingRelationships.map((rel) => (
                          <div
                            key={rel.id}
                            onClick={() => router.push(`/admin/cmdb/${rel.related_ci_id}`)}
                            className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <LinkIcon className="w-4 h-4 text-icon-muted" />
                              <div>
                                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{rel.related_ci_name}</p>
                                <p className="text-xs text-muted-content">{rel.related_ci_number} • {rel.reverse_name}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Tickets Vinculados</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
                  <PlusIcon className="w-4 h-4" />
                  Vincular Ticket
                </button>
              </div>

              {linkedTickets.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-muted-content">Nenhum ticket vinculado a este CI</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => router.push(`/tickets/${ticket.ticket_id}`)}
                      className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <DocumentTextIcon className="w-5 h-5 text-icon-muted" />
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{ticket.ticket_title}</p>
                          <p className="text-xs text-muted-content">#{ticket.ticket_id} • {ticket.link_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          ticket.ticket_status === 'open' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' :
                          ticket.ticket_status === 'in_progress' ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300' :
                          'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                        }`}>
                          {ticket.ticket_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Histórico de Alterações</h3>

              {history.length === 0 ? (
                <div className="text-center py-8">
                  <ClockIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-muted-content">Nenhuma alteração registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                        <ClockIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 capitalize">{entry.action}</p>
                          <p className="text-xs text-muted-content">{formatDateTime(entry.changed_at)}</p>
                        </div>
                        <p className="text-xs text-muted-content mt-0.5">por {entry.changed_by_name}</p>
                        {entry.changes && (
                          <pre className="text-xs text-neutral-600 dark:text-neutral-300 mt-2 glass-panel p-2 rounded overflow-x-auto">
                            {JSON.stringify(JSON.parse(entry.changes), null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
