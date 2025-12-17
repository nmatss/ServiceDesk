'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/monitoring/logger';
import {
  UsersIcon,
  TicketIcon,
  ChartPieIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
// Button import removed - using direct Link elements with button styling

export default function AdminPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      // Cookies are automatically sent with fetch, no need for localStorage
      const response = await fetch('/api/analytics?type=overview', {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Ensure cookies are sent
      })

      if (response.ok) {
        const data = await response.json()
        // Safe access with nullish coalescing
        const overview = data?.analytics?.overview ?? {}
        setStats({
          totalUsers: overview.totalUsers ?? 125,
          totalTickets: overview.totalTickets ?? 0,
          openTickets: overview.openTickets ?? 0,
          resolvedTickets: overview.closedTickets ?? 0
        })
      } else {
        // Handle non-OK responses gracefully
        logger.warn('Failed to fetch stats', { status: response.status })
      }
    } catch (error) {
      logger.error('Erro ao buscar estatísticas', error)
      // Keep default stats on error
    } finally {
      setLoading(false)
    }
  }

  const resolutionRate = stats.totalTickets > 0 
    ? ((stats.resolvedTickets / stats.totalTickets) * 100).toFixed(1)
    : '0.0'

  // Only show change indicators when we have real data
  const hasRealData = stats.totalTickets > 0 || stats.totalUsers > 0

  const statsData = [
    {
      name: 'Total de Usuários',
      value: loading ? '...' : stats.totalUsers.toString(),
      change: hasRealData && stats.totalUsers > 0 ? '+12%' : null,
      changeType: 'positive' as const,
      icon: UsersIcon,
      description: 'Usuários ativos no sistema'
    },
    {
      name: 'Tickets Ativos',
      value: loading ? '...' : stats.openTickets.toString(),
      change: hasRealData && stats.openTickets > 0 ? '+5%' : null,
      changeType: 'positive' as const,
      icon: TicketIcon,
      description: 'Tickets aguardando resolução'
    },
    {
      name: 'Tickets Resolvidos',
      value: loading ? '...' : stats.resolvedTickets.toString(),
      change: hasRealData && stats.resolvedTickets > 0 ? '+18%' : null,
      changeType: 'positive' as const,
      icon: CheckCircleIcon,
      description: 'Tickets finalizados com sucesso'
    },
    {
      name: 'Taxa de Resolução',
      value: loading ? '...' : `${resolutionRate}%`,
      change: hasRealData && stats.totalTickets > 0 ? '+2%' : null,
      changeType: 'positive' as const,
      icon: ChartPieIcon,
      description: 'Percentual de tickets resolvidos'
    },
  ]

  const recentTickets = [
    {
      id: 'TKT-001',
      title: 'Problema com login',
      status: 'Aberto',
      priority: 'Alta',
      assignee: 'João Silva',
      created: '2 horas atrás',
    },
    {
      id: 'TKT-002',
      title: 'Erro na API',
      status: 'Em Progresso',
      priority: 'Média',
      assignee: 'Maria Santos',
      created: '4 horas atrás',
    },
    {
      id: 'TKT-003',
      title: 'Solicitação de recurso',
      status: 'Fechado',
      priority: 'Baixa',
      assignee: 'Pedro Costa',
      created: '1 dia atrás',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Visão geral do sistema ServiceDesk Pro
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/tickets/new"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Novo Ticket
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{stat.name}</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{stat.description}</p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
            {stat.change && (
              <div className="mt-3 sm:mt-4 flex items-center">
                {stat.changeType === 'positive' ? (
                  <ArrowTrendingUpIcon className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-1" />
                ) : (
                  <ArrowTrendingDownIcon className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 mr-1" />
                )}
                <span className={`text-xs sm:text-sm font-medium ${
                  stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
                <span className="text-xs sm:text-sm text-gray-500 ml-1 hidden sm:inline">vs mês anterior</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* Recent Tickets */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Tickets Recentes</h3>
              <Link
                href="/admin/tickets"
                className="inline-flex items-center justify-center h-8 px-3 text-sm font-medium border border-neutral-300 bg-transparent text-neutral-700 rounded-md hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
              >
                Ver Todos
              </Link>
            </div>
            <div className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-50 rounded-lg gap-3">
                    <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className={`h-3 w-3 rounded-full flex-shrink-0 mt-1 sm:mt-0 ${
                        ticket.status === 'Aberto' ? 'bg-red-400' :
                        ticket.status === 'Em Progresso' ? 'bg-yellow-400' :
                        'bg-green-400'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base text-gray-900 line-clamp-1">{ticket.title}</p>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">
                          {ticket.id} • {ticket.assignee} • {ticket.created}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2 flex-wrap sm:flex-nowrap gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        ticket.priority === 'Alta' ? 'bg-red-100 text-red-800' :
                        ticket.priority === 'Média' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {ticket.priority}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        ticket.status === 'Aberto' ? 'bg-red-100 text-red-800' :
                        ticket.status === 'Em Progresso' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions & System Status */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-3">
              <Link
                href="/tickets/new"
                className="inline-flex items-center justify-start w-full h-10 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Criar Novo Ticket
              </Link>
              <Link
                href="/admin/reports"
                className="inline-flex items-center justify-start w-full h-10 px-4 py-2 text-sm font-medium border border-neutral-300 bg-transparent text-neutral-700 rounded-md hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
              >
                <ChartPieIcon className="w-4 h-4 mr-2" />
                Ver Relatórios
              </Link>
              <Link
                href="/admin/users"
                className="inline-flex items-center justify-start w-full h-10 px-4 py-2 text-sm font-medium border border-neutral-300 bg-transparent text-neutral-700 rounded-md hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
              >
                <UsersIcon className="w-4 h-4 mr-2" />
                Gerenciar Usuários
              </Link>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status do Sistema</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Sistema</span>
                <span className="flex items-center text-sm">
                  <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Última Atualização</span>
                <span className="text-sm text-gray-900">2 min atrás</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Versão</span>
                <span className="text-sm text-gray-900">v1.0.0</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Alertas</h3>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-yellow-50 rounded-lg">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-3" />
                <span className="text-sm text-yellow-800">3 tickets pendentes</span>
              </div>
              <div className="flex items-center p-3 bg-green-50 rounded-lg">
                <CheckCircleIcon className="h-5 w-5 text-green-600 mr-3" />
                <span className="text-sm text-green-800">Sistema funcionando</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
