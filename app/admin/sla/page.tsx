'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlusIcon,
  ChartBarIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'

interface SLAPolicy {
  id: number
  name: string
  description: string
  priority_id: number
  category_id: number
  business_hours_only: boolean
  response_time_minutes: number
  resolution_time_minutes: number
  escalation_time_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
  priority_name: string
  category_name: string
}

interface SLATicket {
  id: number
  title: string
  created_at: string
  response_due_at: string
  resolution_due_at: string
  first_response_at: string
  response_breached: boolean
  resolution_breached: boolean
  status: string
  is_final: boolean
  priority: string
  category: string
  user_name: string
  sla_policy_name: string
  sla_status: string
  minutes_remaining: number
}

interface SLAStats {
  total_tickets: number
  breached_tickets: number
  at_risk_tickets: number
  on_time_tickets: number
  avg_response_time_minutes: number
  avg_resolution_time_minutes: number
}

export default function SLAPage() {
  const [slaPolicies, setSLAPolicies] = useState<SLAPolicy[]>([])
  const [slaTickets, setSLATickets] = useState<SLATicket[]>([])
  const [slaStats, setSLAStats] = useState<SLAStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'policies' | 'tickets'>('overview')
  const [ticketFilter, setTicketFilter] = useState<'all' | 'breached' | 'at_risk' | 'on_time'>('all')

  useEffect(() => {
    fetchSLAData()
  }, [])

  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchSLATickets()
    }
  }, [activeTab, ticketFilter])

  const fetchSLAData = async () => {
    try {
      // SECURITY: Use httpOnly cookies for authentication - tenant is extracted server-side
      const [policiesResponse, ticketsResponse] = await Promise.all([
        fetch('/api/sla', {
          credentials: 'include' // Use httpOnly cookies
        }),
        fetch('/api/sla/tickets', {
          credentials: 'include' // Use httpOnly cookies
        })
      ])

      if (policiesResponse.ok) {
        const policiesData = await policiesResponse.json()
        setSLAPolicies(policiesData.sla_policies || [])
      }

      if (ticketsResponse.ok) {
        const ticketsData = await ticketsResponse.json()
        setSLATickets(ticketsData.tickets || [])
        setSLAStats(ticketsData.stats)
      }
    } catch (error) {
      logger.error('Erro ao buscar dados SLA', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSLATickets = async () => {
    try {
      const params = new URLSearchParams()
      if (ticketFilter !== 'all') {
        params.append('status', ticketFilter)
      }

      // SECURITY: Use httpOnly cookies for authentication - tenant is extracted server-side
      const response = await fetch(`/api/sla/tickets?${params}`, {
        credentials: 'include' // Use httpOnly cookies
      })

      if (response.ok) {
        const data = await response.json()
        setSLATickets(data.tickets || [])
        setSLAStats(data.stats)
      }
    } catch (error) {
      logger.error('Erro ao buscar tickets SLA', error)
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const getSLAStatusColor = (status: string) => {
    switch (status) {
      case 'breached':
        return 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400'
      case 'at_risk':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400'
      case 'on_time':
        return 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'
    }
  }

  const getSLAStatusText = (status: string) => {
    switch (status) {
      case 'breached':
        return 'Violado'
      case 'at_risk':
        return 'Em Risco'
      case 'on_time':
        return 'No Prazo'
      default:
        return status
    }
  }

  const slaCompliance = slaStats
    ? ((slaStats.on_time_tickets / slaStats.total_tickets) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Modern Header */}
        <PageHeader
          title="Gerenciamento de SLA"
          description="Monitore e gerencie acordos de nível de serviço"
          icon={ClockIcon}
          actions={[
            {
              label: 'Atualizar',
              onClick: fetchSLAData,
              icon: ArrowPathIcon,
              variant: 'ghost'
            },
            {
              label: 'Nova Política SLA',
              onClick: () => logger.info('Criar nova política SLA'),
              icon: PlusIcon,
              variant: 'primary'
            }
          ]}
        />

        {/* Modern Tabs with Glass Effect */}
        <div className="glass-panel p-1 flex space-x-2">
          {[
            { id: 'overview', name: 'Visão Geral', icon: ChartBarIcon },
            { id: 'policies', name: 'Políticas', icon: Cog6ToothIcon },
            { id: 'tickets', name: 'Tickets', icon: ExclamationTriangleIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex-1 flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium text-sm
                transition-all duration-300
                ${activeTab === tab.id
                  ? 'bg-gradient-brand text-white shadow-medium'
                  : 'text-description hover:text-brand-600 dark:hover:text-brand-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }
              `}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="glass-panel text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-200 border-t-brand-600"></div>
            <p className="mt-6 text-base text-description font-medium">Carregando dados SLA...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && slaStats && (
              <div className="space-y-8">
                {/* Modern Stats Cards with Glass Effect */}
                <StatsGrid cols={4}>
                  <StatsCard
                    title="Conformidade SLA"
                    value={`${slaCompliance}%`}
                    icon={ChartBarIcon}
                    color="info"
                    change={{
                      value: parseFloat(slaCompliance) >= 95 ? 5 : -3,
                      type: parseFloat(slaCompliance) >= 95 ? 'increase' : 'decrease',
                      period: 'vs mês anterior'
                    }}
                  />
                  <StatsCard
                    title="SLAs Violados"
                    value={slaStats.breached_tickets}
                    icon={ExclamationTriangleIcon}
                    color="error"
                    change={{
                      value: 12,
                      type: slaStats.breached_tickets > 0 ? 'increase' : 'decrease',
                      period: 'vs semana anterior'
                    }}
                  />
                  <StatsCard
                    title="Em Risco"
                    value={slaStats.at_risk_tickets}
                    icon="pending"
                    color="warning"
                    change={{
                      value: 8,
                      type: 'neutral',
                      period: 'últimas 24h'
                    }}
                  />
                  <StatsCard
                    title="No Prazo"
                    value={slaStats.on_time_tickets}
                    icon={CheckCircleIcon}
                    color="success"
                    change={{
                      value: 15,
                      type: 'increase',
                      period: 'vs período anterior'
                    }}
                  />
                </StatsGrid>

                {/* Performance Metrics with Glass Panel */}
                <div className="glass-panel p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                        Métricas de Performance
                      </h3>
                      <p className="text-sm text-description mt-1">
                        Tempos médios de resposta e resolução
                      </p>
                    </div>
                    <div className="h-12 w-12 bg-gradient-brand rounded-xl flex items-center justify-center">
                      <ClockIcon className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gradient-to-br from-info-50 to-info-100 dark:from-info-900/20 dark:to-info-800/20 rounded-xl p-6 border border-info-200 dark:border-info-800">
                      <dt className="text-sm font-semibold text-info-700 dark:text-info-300 uppercase tracking-wide">
                        Tempo Médio de Primeira Resposta
                      </dt>
                      <dd className="mt-3 text-4xl font-bold text-info-900 dark:text-info-100">
                        {slaStats.avg_response_time_minutes
                          ? formatTime(Math.round(slaStats.avg_response_time_minutes))
                          : 'N/A'}
                      </dd>
                      <div className="mt-4 flex items-center text-sm text-info-600 dark:text-info-400">
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        <span>Meta: 30 minutos</span>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-success-50 to-success-100 dark:from-success-900/20 dark:to-success-800/20 rounded-xl p-6 border border-success-200 dark:border-success-800">
                      <dt className="text-sm font-semibold text-success-700 dark:text-success-300 uppercase tracking-wide">
                        Tempo Médio de Resolução
                      </dt>
                      <dd className="mt-3 text-4xl font-bold text-success-900 dark:text-success-100">
                        {slaStats.avg_resolution_time_minutes
                          ? formatTime(Math.round(slaStats.avg_resolution_time_minutes))
                          : 'N/A'}
                      </dd>
                      <div className="mt-4 flex items-center text-sm text-success-600 dark:text-success-400">
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        <span>Meta: 4 horas</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SLA Compliance Chart Placeholder */}
                <div className="glass-panel p-8">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
                    Gráfico de Conformidade SLA
                  </h3>
                  <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 rounded-xl p-8 flex items-center justify-center min-h-[300px] border border-neutral-200 dark:border-neutral-700">
                    <div className="text-center">
                      <ChartBarIcon className="h-16 w-16 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
                      <p className="text-description font-medium">
                        Gráfico de tendências de SLA será exibido aqui
                      </p>
                      <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-2">
                        Integre com biblioteca de gráficos como Recharts ou Chart.js
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Policies Tab */}
            {activeTab === 'policies' && (
              <div className="glass-panel p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      Políticas de SLA
                    </h3>
                    <p className="text-sm text-description mt-1">
                      Gerencie suas políticas de acordo de nível de serviço
                    </p>
                  </div>
                  <button className="btn btn-primary">
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Adicionar Política
                  </button>
                </div>
                {slaPolicies.length === 0 ? (
                  <div className="text-center py-20 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700">
                    <Cog6ToothIcon className="mx-auto h-16 w-16 text-neutral-400 dark:text-neutral-600" />
                    <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                      Nenhuma política SLA configurada
                    </h3>
                    <p className="mt-2 text-sm text-description">
                      Comece criando uma nova política de SLA para gerenciar seus acordos.
                    </p>
                    <button className="mt-6 btn btn-primary">
                      <PlusIcon className="h-5 w-5 mr-2" />
                      Criar Primeira Política
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {slaPolicies.map((policy) => (
                      <div
                        key={policy.id}
                        className="group glass-panel p-6 hover:shadow-large hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="h-10 w-10 bg-gradient-brand rounded-lg flex items-center justify-center">
                                <Cog6ToothIcon className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                                  {policy.name}
                                </h4>
                              </div>
                            </div>
                            {policy.description && (
                              <p className="text-sm text-description line-clamp-2">
                                {policy.description}
                              </p>
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              policy.is_active
                                ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
                                : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'
                            }`}
                          >
                            {policy.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>

                        <div className="space-y-3 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-description flex items-center">
                              <ClockIcon className="h-4 w-4 mr-2" />
                              Resposta
                            </span>
                            <span className="font-semibold text-brand-600 dark:text-brand-400">
                              {formatTime(policy.response_time_minutes)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-description flex items-center">
                              <CheckCircleIcon className="h-4 w-4 mr-2" />
                              Resolução
                            </span>
                            <span className="font-semibold text-success-600 dark:text-success-400">
                              {formatTime(policy.resolution_time_minutes)}
                            </span>
                          </div>
                          {policy.priority_name && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-description">Prioridade</span>
                              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                {policy.priority_name}
                              </span>
                            </div>
                          )}
                          {policy.category_name && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-description">Categoria</span>
                              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                {policy.category_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tickets Tab */}
            {activeTab === 'tickets' && (
              <div className="space-y-6">
                {/* Modern Filter with Glass Panel */}
                <div className="glass-panel p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FunnelIcon className="h-5 w-5 text-description" />
                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Filtrar por:</span>
                  </div>
                  <div className="flex space-x-2">
                    {[
                      { id: 'all', name: 'Todos', icon: null },
                      { id: 'breached', name: 'Violados', icon: ExclamationTriangleIcon },
                      { id: 'at_risk', name: 'Em Risco', icon: ExclamationTriangleIcon },
                      { id: 'on_time', name: 'No Prazo', icon: CheckCircleIcon }
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        onClick={() => setTicketFilter(filter.id as any)}
                        className={`
                          px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 flex items-center space-x-2
                          ${ticketFilter === filter.id
                            ? 'bg-gradient-brand text-white shadow-medium'
                            : 'text-description hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }
                        `}
                      >
                        {filter.icon && <filter.icon className="h-4 w-4" />}
                        <span>{filter.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modern Tickets List */}
                <div className="glass-panel p-6">
                  {slaTickets.length === 0 ? (
                    <div className="text-center py-20 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700">
                      <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-neutral-400 dark:text-neutral-600" />
                      <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                        Nenhum ticket encontrado
                      </h3>
                      <p className="mt-2 text-sm text-description">
                        Nenhum ticket encontrado com os filtros selecionados.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {slaTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="group glass-panel p-6 hover:shadow-large hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-3">
                                <span className="px-3 py-1 bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-lg text-sm font-bold">
                                  #{ticket.id}
                                </span>
                                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                                  {ticket.title}
                                </h4>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                                <div className="flex items-center space-x-2">
                                  <ClockIcon className="h-4 w-4 text-muted-content" />
                                  <span className="text-description">
                                    {formatDate(ticket.created_at)}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-description">
                                    Usuário: <span className="font-medium text-neutral-900 dark:text-neutral-100">{ticket.user_name}</span>
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-description">
                                    Prioridade: <span className="font-medium text-neutral-900 dark:text-neutral-100">{ticket.priority}</span>
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-description">
                                    Status: <span className="font-medium text-neutral-900 dark:text-neutral-100">{ticket.status}</span>
                                  </span>
                                </div>
                              </div>

                              {ticket.minutes_remaining !== null && (
                                <div className="mt-4 flex items-center">
                                  {ticket.minutes_remaining > 0 ? (
                                    <div className="flex items-center px-3 py-1.5 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg text-sm">
                                      <ClockIcon className="h-4 w-4 text-info-600 dark:text-info-400 mr-2" />
                                      <span className="font-semibold text-info-700 dark:text-info-300">
                                        Restam: {formatTime(ticket.minutes_remaining)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center px-3 py-1.5 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg text-sm">
                                      <ExclamationTriangleIcon className="h-4 w-4 text-error-600 dark:text-error-400 mr-2" />
                                      <span className="font-semibold text-error-700 dark:text-error-300">
                                        Atrasado: {formatTime(Math.abs(ticket.minutes_remaining))}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <span
                              className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap ${
                                ticket.sla_status === 'breached'
                                  ? 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400'
                                  : ticket.sla_status === 'at_risk'
                                  ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400'
                                  : 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
                              }`}
                            >
                              {getSLAStatusText(ticket.sla_status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}