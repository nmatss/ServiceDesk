'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  ServerIcon,
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
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
}

const environmentColors: Record<string, string> = {
  production: 'bg-red-50 text-red-700 border-red-200',
  staging: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  development: 'bg-blue-50 text-blue-700 border-blue-200',
  test: 'bg-purple-50 text-purple-700 border-purple-200',
  dr: 'bg-gray-50 text-gray-700 border-gray-200'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !ci) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar CI</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin/cmdb')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4">
              <button
                onClick={() => router.push('/admin/cmdb')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
              </button>

              <div
                className="p-2 sm:p-3 rounded-xl flex-shrink-0"
                style={{ backgroundColor: `${ci.ci_type_color}20` }}
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: ci.ci_type_color }}>
                  <IconComponent className="w-full h-full" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{ci.name}</h1>
                  {ci.is_operational ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-gray-500">{ci.ci_number}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-500">{ci.ci_type_name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/admin/cmdb/${id}/edit`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <PencilIcon className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                <TrashIcon className="w-5 h-5 text-red-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              {ci.environment && (
                <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${environmentColors[ci.environment]}`}>
                  {ci.environment}
                </span>
              )}
              {ci.criticality && (
                <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${criticalityColors[ci.criticality]}`}>
                  {ci.criticality}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <ArrowsRightLeftIcon className="w-4 h-4" />
              <span>Relacionamentos</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{totalRelationships}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <DocumentTextIcon className="w-4 h-4" />
              <span>Tickets Vinculados</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{linkedTickets.length}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <ClockIcon className="w-4 h-4" />
              <span>RTO / RPO</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {ci.recovery_time_objective || '-'}h / {ci.recovery_point_objective || '-'}h
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="bg-white rounded-t-xl border border-b-0 border-gray-200">
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
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-8">
        <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 p-4 sm:p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CpuChipIcon className="w-4 h-4 text-gray-400" />
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Nome</p>
                    <p className="text-sm font-medium text-gray-900">{ci.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Número CI</p>
                    <p className="text-sm font-medium text-gray-900">{ci.ci_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tipo</p>
                    <p className="text-sm font-medium text-gray-900">{ci.ci_type_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      {ci.is_operational ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{ci.status_name}</span>
                    </div>
                  </div>
                  {ci.description && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-xs text-gray-500 mb-1">Descrição</p>
                      <p className="text-sm text-gray-700">{ci.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <GlobeAltIcon className="w-4 h-4 text-gray-400" />
                  Informações Técnicas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ci.hostname && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Hostname</p>
                      <p className="text-sm font-medium text-gray-900 font-mono">{ci.hostname}</p>
                    </div>
                  )}
                  {ci.ip_address && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Endereço IP</p>
                      <p className="text-sm font-medium text-gray-900 font-mono">{ci.ip_address}</p>
                    </div>
                  )}
                  {ci.mac_address && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">MAC Address</p>
                      <p className="text-sm font-medium text-gray-900 font-mono">{ci.mac_address}</p>
                    </div>
                  )}
                  {ci.os_version && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Sistema Operacional</p>
                      <p className="text-sm font-medium text-gray-900">{ci.os_version}</p>
                    </div>
                  )}
                  {ci.serial_number && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Número de Série</p>
                      <p className="text-sm font-medium text-gray-900 font-mono">{ci.serial_number}</p>
                    </div>
                  )}
                  {ci.asset_tag && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Asset Tag</p>
                      <p className="text-sm font-medium text-gray-900">{ci.asset_tag}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Location & Owner */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-gray-400" />
                  Localização e Responsabilidade
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ci.location && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Localização</p>
                      <p className="text-sm font-medium text-gray-900">{ci.location}</p>
                    </div>
                  )}
                  {ci.data_center && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Data Center</p>
                      <p className="text-sm font-medium text-gray-900">{ci.data_center}</p>
                    </div>
                  )}
                  {ci.rack_position && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Posição no Rack</p>
                      <p className="text-sm font-medium text-gray-900">{ci.rack_position}</p>
                    </div>
                  )}
                  {ci.owner_name && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Proprietário</p>
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{ci.owner_name}</span>
                      </div>
                    </div>
                  )}
                  {ci.team_name && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Equipe Responsável</p>
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{ci.team_name}</span>
                      </div>
                    </div>
                  )}
                  {(ci.vendor || ci.manufacturer) && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Fabricante / Fornecedor</p>
                      <p className="text-sm font-medium text-gray-900">
                        {[ci.manufacturer, ci.vendor].filter(Boolean).join(' / ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ChartBarIcon className="w-4 h-4 text-gray-400" />
                  Informações de Negócio
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ci.business_service && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Serviço de Negócio</p>
                      <p className="text-sm font-medium text-gray-900">{ci.business_service}</p>
                    </div>
                  )}
                  {ci.business_impact && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Impacto no Negócio</p>
                      <p className="text-sm text-gray-700">{ci.business_impact}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Lifecycle Dates */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-gray-400" />
                  Ciclo de Vida
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Data de Compra</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(ci.purchase_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Data de Instalação</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(ci.installation_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fim da Garantia</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(ci.warranty_expiry)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">End of Life</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(ci.end_of_life_date)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'relationships' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Mapa de Relacionamentos</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <PlusIcon className="w-4 h-4" />
                  Adicionar Relacionamento
                </button>
              </div>

              {/* Visual Relationship Map */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-8">
                    {/* Incoming */}
                    <div className="space-y-2">
                      {incomingRelationships.slice(0, 5).map((rel) => (
                        <div
                          key={rel.id}
                          onClick={() => router.push(`/admin/cmdb/${rel.related_ci_id}`)}
                          className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <LinkIcon className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{rel.related_ci_name}</p>
                            <p className="text-xs text-gray-500">{rel.reverse_name}</p>
                          </div>
                        </div>
                      ))}
                      {incomingRelationships.length === 0 && (
                        <p className="text-sm text-gray-400 text-center">Sem dependências</p>
                      )}
                    </div>

                    {/* Arrows In */}
                    <div className="text-gray-300">
                      <ArrowsRightLeftIcon className="w-8 h-8" />
                    </div>

                    {/* Current CI */}
                    <div
                      className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50"
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
                        <p className="font-semibold text-gray-900 truncate max-w-[130px]">{ci.name}</p>
                        <p className="text-xs text-gray-500">{ci.ci_number}</p>
                      </div>
                    </div>

                    {/* Arrows Out */}
                    <div className="text-gray-300">
                      <ArrowsRightLeftIcon className="w-8 h-8" />
                    </div>

                    {/* Outgoing */}
                    <div className="space-y-2">
                      {outgoingRelationships.slice(0, 5).map((rel) => (
                        <div
                          key={rel.id}
                          onClick={() => router.push(`/admin/cmdb/${rel.related_ci_id}`)}
                          className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg border cursor-pointer hover:shadow-sm ${
                            rel.is_critical_path ? 'border-red-300 hover:border-red-400' : 'border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            rel.is_critical_path ? 'bg-red-100' : 'bg-gray-100'
                          }`}>
                            {rel.is_critical_path ? (
                              <ShieldExclamationIcon className="w-4 h-4 text-red-500" />
                            ) : (
                              <LinkIcon className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">{rel.related_ci_name}</p>
                            <p className="text-xs text-gray-500">{rel.relationship_type}</p>
                          </div>
                        </div>
                      ))}
                      {outgoingRelationships.length === 0 && (
                        <p className="text-sm text-gray-400 text-center">Sem dependentes</p>
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
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Este CI depende de:</h4>
                      <div className="space-y-2">
                        {outgoingRelationships.map((rel) => (
                          <div
                            key={rel.id}
                            onClick={() => router.push(`/admin/cmdb/${rel.related_ci_id}`)}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                          >
                            <div className="flex items-center gap-3">
                              <LinkIcon className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{rel.related_ci_name}</p>
                                <p className="text-xs text-gray-500">{rel.related_ci_number} • {rel.relationship_type}</p>
                              </div>
                            </div>
                            {rel.is_critical_path && (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Crítico</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {incomingRelationships.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Dependem deste CI:</h4>
                      <div className="space-y-2">
                        {incomingRelationships.map((rel) => (
                          <div
                            key={rel.id}
                            onClick={() => router.push(`/admin/cmdb/${rel.related_ci_id}`)}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                          >
                            <div className="flex items-center gap-3">
                              <LinkIcon className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{rel.related_ci_name}</p>
                                <p className="text-xs text-gray-500">{rel.related_ci_number} • {rel.reverse_name}</p>
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Tickets Vinculados</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <PlusIcon className="w-4 h-4" />
                  Vincular Ticket
                </button>
              </div>

              {linkedTickets.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum ticket vinculado a este CI</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => router.push(`/tickets/${ticket.ticket_id}`)}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{ticket.ticket_title}</p>
                          <p className="text-xs text-gray-500">#{ticket.ticket_id} • {ticket.link_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          ticket.ticket_status === 'open' ? 'bg-blue-100 text-blue-700' :
                          ticket.ticket_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
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
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Histórico de Alterações</h3>

              {history.length === 0 ? (
                <div className="text-center py-8">
                  <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma alteração registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <ClockIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 capitalize">{entry.action}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(entry.changed_at)}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">por {entry.changed_by_name}</p>
                        {entry.changes && (
                          <pre className="text-xs text-gray-600 mt-2 bg-white p-2 rounded overflow-x-auto">
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
