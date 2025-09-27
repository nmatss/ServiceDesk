'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import StatsCard, { StatsGrid, StatsCardSkeleton } from '@/src/components/ui/StatsCard'
import {
  ChartBarIcon,
  ClockIcon,
  UserIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  PlusIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

interface DashboardData {
  overview: {
    tickets: {
      total: number
      open: number
      closed: number
      unassigned: number
      avg_resolution_hours: number
    }
    users?: {
      total_users: number
      end_users: number
      agents: number
      admins: number
    }
  }
  tickets: {
    by_status: Array<{
      name: string
      color: string
      is_final: boolean
      count: number
    }>
    daily_created: Array<{
      date: string
      count: number
    }>
    daily_resolved: Array<{
      date: string
      count: number
    }>
  }
  agent_performance?: Array<{
    id: number
    name: string
    tickets_assigned: number
    tickets_resolved: number
    avg_resolution_hours: number
    resolution_rate: number
  }>
  sla: {
    total_tracked: number
    response_compliance: number
    resolution_compliance: number
    response_compliant: number
    resolution_compliant: number
  }
  trends: {
    current_period: number
    previous_period: number
    change_percentage: number
    trend: 'up' | 'down' | 'stable'
  }
  categories: Array<{
    name: string
    color: string
    count: number
    count_period: number
  }>
  priorities: Array<{
    name: string
    color: string
    level: number
    count: number
    count_period: number
  }>
  recent_activity: Array<{
    id: number
    title: string
    created_at: string
    updated_at: string
    user_name: string
    status_name: string
    status_color: string
    priority_name: string
    priority_color: string
    category_name: string
  }>
}

interface ModernDashboardProps {
  userRole: 'admin' | 'agent' | 'user'
  period?: number
}

export default function ModernDashboard({ userRole, period = 30 }: ModernDashboardProps) {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [period])

  const fetchDashboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      const response = await fetch(`/api/dashboard?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar dashboard')
      }

      const result = await response.json()
      setData(result.data)
      setError(null)
    } catch (error) {
      console.error('Error fetching dashboard:', error)
      setError('Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refresh = () => {
    fetchDashboardData(true)
  }

  if (loading && !data) {
    return <DashboardSkeleton />
  }

  if (error && !data) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-error-100 dark:bg-error-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5C3.498 20.333 4.46 22 6 22z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Erro ao carregar dashboard
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          {error}
        </p>
        <button onClick={refresh} className="btn btn-primary">
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            Dashboard
          </h1>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            {userRole === 'admin' ? 'Visão geral do sistema' :
             userRole === 'agent' ? 'Seus tickets e performance' :
             'Seus tickets de suporte'}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          {userRole !== 'user' && (
            <button
              onClick={() => router.push('/admin/reports')}
              className="btn btn-primary"
            >
              <ChartBarIcon className="h-4 w-4 mr-2" />
              Relatórios
            </button>
          )}
        </div>
      </div>

      {/* Main Stats */}
      <StatsGrid cols={userRole === 'admin' ? 4 : 3}>
        <StatsCard
          title="Total de Tickets"
          value={data.overview.tickets.total}
          icon="tickets"
          color="brand"
          change={{
            value: Math.abs(data.trends.change_percentage),
            type: data.trends.trend === 'up' ? 'increase' : data.trends.trend === 'down' ? 'decrease' : 'neutral',
            period: `vs ${period} dias anteriores`
          }}
          onClick={() => router.push(userRole === 'admin' ? '/admin/tickets' : '/tickets')}
        />

        <StatsCard
          title="Em Aberto"
          value={data.overview.tickets.open}
          icon="pending"
          color="warning"
          onClick={() => router.push(userRole === 'admin' ? '/admin/tickets?status=open' : '/tickets?status=open')}
        />

        <StatsCard
          title="Resolvidos"
          value={data.overview.tickets.closed}
          icon="resolved"
          color="success"
          onClick={() => router.push(userRole === 'admin' ? '/admin/tickets?status=resolved' : '/tickets?status=resolved')}
        />

        {userRole === 'admin' && data.overview.users && (
          <StatsCard
            title="Usuários Ativos"
            value={data.overview.users.total_users}
            icon="users"
            color="neutral"
            onClick={() => router.push('/admin/users')}
          />
        )}

        {userRole === 'agent' && (
          <StatsCard
            title="Não Atribuídos"
            value={data.overview.tickets.unassigned}
            icon="time"
            color="error"
            onClick={() => router.push('/tickets?unassigned=true')}
          />
        )}
      </StatsGrid>

      {/* SLA Stats */}
      {data.sla.total_tracked > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Compliance SLA
            </h3>
          </div>
          <div className="card-body">
            <StatsGrid cols={3}>
              <StatsCard
                title="Conformidade Resposta"
                value={`${data.sla.response_compliance.toFixed(1)}%`}
                icon="time"
                color={data.sla.response_compliance >= 90 ? 'success' : data.sla.response_compliance >= 70 ? 'warning' : 'error'}
                size="sm"
              />
              <StatsCard
                title="Conformidade Resolução"
                value={`${data.sla.resolution_compliance.toFixed(1)}%`}
                icon="resolved"
                color={data.sla.resolution_compliance >= 90 ? 'success' : data.sla.resolution_compliance >= 70 ? 'warning' : 'error'}
                size="sm"
              />
              <StatsCard
                title="Tickets Monitorados"
                value={data.sla.total_tracked}
                icon="chart"
                color="brand"
                size="sm"
              />
            </StatsGrid>
          </div>
        </div>
      )}

      {/* Performance dos Agentes (Admin only) */}
      {userRole === 'admin' && data.agent_performance && data.agent_performance.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Performance dos Agentes
              </h3>
              <button
                onClick={() => router.push('/admin/reports?type=agents')}
                className="btn btn-ghost btn-sm"
              >
                Ver relatório completo
              </button>
            </div>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.agent_performance.slice(0, 6).map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {agent.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                        {agent.name}
                      </h4>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">
                        {agent.tickets_resolved} resolvidos
                      </div>
                      <div className="text-xs text-neutral-500">
                        {agent.avg_resolution_hours.toFixed(1)}h média
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        agent.resolution_rate >= 80 ? 'text-success-600 dark:text-success-400' :
                        agent.resolution_rate >= 60 ? 'text-warning-600 dark:text-warning-400' :
                        'text-error-600 dark:text-error-400'
                      }`}>
                        {agent.resolution_rate}%
                      </div>
                      <div className="text-xs text-neutral-500">
                        taxa resolução
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid de Categorias e Prioridades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Categorias */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Tickets por Categoria
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {data.categories.slice(0, 5).map((category) => (
                <div key={category.name} className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {category.name}
                      </span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {category.count}
                      </span>
                    </div>
                    <div className="mt-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          backgroundColor: category.color,
                          width: `${Math.min((category.count / Math.max(...data.categories.map(c => c.count))) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tickets por Prioridade */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Tickets por Prioridade
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {data.priorities
                .sort((a, b) => b.level - a.level)
                .map((priority) => (
                  <div key={priority.name} className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: priority.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {priority.name}
                        </span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {priority.count}
                        </span>
                      </div>
                      <div className="mt-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            backgroundColor: priority.color,
                            width: `${Math.min((priority.count / Math.max(...data.priorities.map(p => p.count))) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Atividade Recente */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Atividade Recente
            </h3>
            <button
              onClick={() => router.push(userRole === 'admin' ? '/admin/tickets' : '/tickets')}
              className="btn btn-ghost btn-sm"
            >
              Ver todos
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {data.recent_activity.slice(0, 8).map((ticket) => (
              <div
                key={ticket.id}
                className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                onClick={() => router.push(`/tickets/${ticket.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        #{ticket.id} {ticket.title}
                      </h4>
                      <span
                        className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: `${ticket.status_color}20`,
                          color: ticket.status_color
                        }}
                      >
                        {ticket.status_name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center space-x-4 text-xs text-neutral-600 dark:text-neutral-400">
                      <span>{ticket.user_name}</span>
                      <span>{ticket.category_name}</span>
                      <span
                        style={{ color: ticket.priority_color }}
                        className="font-medium"
                      >
                        {ticket.priority_name}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(ticket.updated_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => router.push('/tickets/new')}
          className="p-4 card hover:shadow-medium transition-all duration-200 group"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <PlusIcon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Novo Ticket
            </span>
          </div>
        </button>

        <button
          onClick={() => router.push('/search')}
          className="p-4 card hover:shadow-medium transition-all duration-200 group"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-success-100 dark:bg-success-900/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <FunnelIcon className="h-6 w-6 text-success-600 dark:text-success-400" />
            </div>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Busca Avançada
            </span>
          </div>
        </button>

        {userRole !== 'user' && (
          <button
            onClick={() => router.push('/admin/reports')}
            className="p-4 card hover:shadow-medium transition-all duration-200 group"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-warning-100 dark:bg-warning-900/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <ChartBarIcon className="h-6 w-6 text-warning-600 dark:text-warning-400" />
              </div>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Relatórios
              </span>
            </div>
          </button>
        )}

        <button
          onClick={() => router.push('/knowledge')}
          className="p-4 card hover:shadow-medium transition-all duration-200 group"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <EyeIcon className="h-6 w-6 text-neutral-600 dark:text-neutral-400" />
            </div>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Base Conhecimento
            </span>
          </div>
        </button>
      </div>
    </div>
  )
}

// Loading skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-start">
        <div>
          <div className="w-48 h-8 loading-skeleton rounded mb-2" />
          <div className="w-64 h-4 loading-skeleton rounded" />
        </div>
        <div className="w-24 h-10 loading-skeleton rounded" />
      </div>

      {/* Stats skeleton */}
      <StatsGrid cols={4}>
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </StatsGrid>

      {/* Content skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card">
            <div className="card-header">
              <div className="w-32 h-6 loading-skeleton rounded" />
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="w-full h-12 loading-skeleton rounded" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}