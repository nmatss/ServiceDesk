'use client'

import { useState, useEffect } from 'react'
import AdminDashboard from '@/src/components/admin/AdminDashboard'
import {
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

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
      const [policiesResponse, ticketsResponse] = await Promise.all([
        fetch('/api/sla', {
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': '1'
          }
        }),
        fetch('/api/sla/tickets', {
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': '1'
          }
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
      console.error('Erro ao buscar dados SLA:', error)
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

      const response = await fetch(`/api/sla/tickets?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': '1'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSLATickets(data.tickets || [])
        setSLAStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao buscar tickets SLA:', error)
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
        return 'bg-red-100 text-red-800'
      case 'at_risk':
        return 'bg-yellow-100 text-yellow-800'
      case 'on_time':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
    <AdminDashboard>
      <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Gerenciamento de SLA
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Monitore e gerencie acordos de nível de serviço
            </p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <button
              type="button"
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              Nova Política SLA
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Visão Geral', icon: ClockIcon },
              { id: 'policies', name: 'Políticas', icon: CheckCircleIcon },
              { id: 'tickets', name: 'Tickets', icon: ExclamationTriangleIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-sm text-gray-500">Carregando dados SLA...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && slaStats && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <ClockIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Conformidade SLA
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {slaCompliance}%
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <ExclamationTriangleIcon className="h-6 w-6 text-red-400" aria-hidden="true" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              SLAs Violados
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {slaStats.breached_tickets}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Em Risco
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {slaStats.at_risk_tickets}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <CheckCircleIcon className="h-6 w-6 text-green-400" aria-hidden="true" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              No Prazo
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">
                              {slaStats.on_time_tickets}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Métricas de Performance
                    </h3>
                    <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Tempo Médio de Primeira Resposta
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                          {slaStats.avg_response_time_minutes
                            ? formatTime(Math.round(slaStats.avg_response_time_minutes))
                            : 'N/A'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">
                          Tempo Médio de Resolução
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                          {slaStats.avg_resolution_time_minutes
                            ? formatTime(Math.round(slaStats.avg_resolution_time_minutes))
                            : 'N/A'}
                        </dd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Policies Tab */}
            {activeTab === 'policies' && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Políticas de SLA
                  </h3>
                  {slaPolicies.length === 0 ? (
                    <div className="text-center py-12">
                      <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-semibold text-gray-900">
                        Nenhuma política SLA configurada
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Comece criando uma nova política de SLA.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4">
                      {slaPolicies.map((policy) => (
                        <div
                          key={policy.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">
                                {policy.name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {policy.description}
                              </p>
                              <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                                <span>Resposta: {formatTime(policy.response_time_minutes)}</span>
                                <span>Resolução: {formatTime(policy.resolution_time_minutes)}</span>
                                {policy.priority_name && (
                                  <span>Prioridade: {policy.priority_name}</span>
                                )}
                                {policy.category_name && (
                                  <span>Categoria: {policy.category_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                  policy.is_active
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {policy.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tickets Tab */}
            {activeTab === 'tickets' && (
              <div className="space-y-4">
                {/* Filter */}
                <div className="flex space-x-4">
                  {[
                    { id: 'all', name: 'Todos' },
                    { id: 'breached', name: 'Violados' },
                    { id: 'at_risk', name: 'Em Risco' },
                    { id: 'on_time', name: 'No Prazo' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setTicketFilter(filter.id as any)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        ticketFilter === filter.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {filter.name}
                    </button>
                  ))}
                </div>

                {/* Tickets List */}
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    {slaTickets.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-sm text-gray-500">
                          Nenhum ticket encontrado com os filtros selecionados.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {slaTickets.map((ticket) => (
                          <div
                            key={ticket.id}
                            className="border border-gray-200 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                  #{ticket.id} - {ticket.title}
                                </h4>
                                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                                  <span>Criado: {formatDate(ticket.created_at)}</span>
                                  <span>Usuário: {ticket.user_name}</span>
                                  <span>Prioridade: {ticket.priority}</span>
                                  <span>Status: {ticket.status}</span>
                                </div>
                                {ticket.minutes_remaining !== null && (
                                  <div className="mt-2 text-xs">
                                    {ticket.minutes_remaining > 0 ? (
                                      <span className="text-blue-600">
                                        Restam: {formatTime(ticket.minutes_remaining)}
                                      </span>
                                    ) : (
                                      <span className="text-red-600">
                                        Atrasado: {formatTime(Math.abs(ticket.minutes_remaining))}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getSLAStatusColor(
                                  ticket.sla_status
                                )}`}
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
              </div>
            )}
          </>
        )}
      </div>
    </AdminDashboard>
  )
}