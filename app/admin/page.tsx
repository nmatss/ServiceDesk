import { Suspense } from 'react'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import {
  UsersIcon,
  TicketIcon,
  ChartPieIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

export const metadata: Metadata = {
  title: 'Dashboard Administrativo | ServiceDesk',
  description: 'Visão geral completa do sistema ServiceDesk Pro',
}

// Esta página depende de dados autenticados internos e não deve ser pré-renderizada em build.
export const dynamic = 'force-dynamic'

interface DashboardStats {
  totalUsers: number
  totalTickets: number
  openTickets: number
  resolvedTickets: number
}

interface RecentTicket {
  id: number
  title: string
  status: string
  status_color: string
  priority: string
  priority_color: string
  assigned_agent_name: string | null
  created_at: string
}

interface CategoryStats {
  id: number
  name: string
  color: string
  total_tickets: number
  resolved_tickets: number
  resolution_rate: number
}

async function resolveRequestContext() {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') || 'http'
  const baseUrl =
    host
      ? `${protocol}://${host}`
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

  return {
    baseUrl,
    forwardedHeaders: {
      'Content-Type': 'application/json',
      cookie: requestHeaders.get('cookie') || '',
      authorization: requestHeaders.get('authorization') || '',
      'x-tenant-id': requestHeaders.get('x-tenant-id') || '',
      'x-tenant-slug': requestHeaders.get('x-tenant-slug') || '',
      'x-tenant-name': requestHeaders.get('x-tenant-name') || ''
    }
  }
}

// Categories Distribution Component
async function CategoriesDistribution() {
  const { baseUrl, forwardedHeaders } = await resolveRequestContext()

  try {
    const response = await fetch(`${baseUrl}/api/analytics?type=category-analytics`, {
      headers: forwardedHeaders,
      credentials: 'include',
      next: {
        revalidate: 300, // 5 minutes
        tags: ['category-stats']
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch category stats')
    }

    const result = await response.json()
    const categories: CategoryStats[] = result.data || []

    if (categories.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-content">Nenhuma categoria encontrada</p>
        </div>
      )
    }

    const totalTickets = categories.reduce((sum, cat) => sum + cat.total_tickets, 0)

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => {
          const percentage = totalTickets > 0
            ? ((category.total_tickets / totalTickets) * 100).toFixed(1)
            : '0'

          return (
            <div
              key={category.id}
              className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <h4 className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                    {category.name}
                  </h4>
                </div>
                <span className="text-xs font-semibold text-muted-content">
                  {percentage}%
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-description">Total</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {category.total_tickets}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-description">Resolvidos</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {category.resolved_tickets}
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5 mt-2">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${category.resolution_rate || 0}%`,
                      backgroundColor: category.color
                    }}
                  />
                </div>
                <div className="text-xs text-right text-muted-content">
                  {category.resolution_rate?.toFixed(0) || 0}% resolvidos
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  } catch {
    return (
      <div className="text-center py-8">
        <p className="text-muted-content">Erro ao carregar categorias</p>
      </div>
    )
  }
}

// Parallel data fetching for optimal performance
async function getDashboardData(): Promise<DashboardStats> {
  const { baseUrl, forwardedHeaders } = await resolveRequestContext()

  try {
    const response = await fetch(`${baseUrl}/api/analytics?type=overview`, {
      headers: forwardedHeaders,
      credentials: 'include',
      next: {
        revalidate: 60, // 1 minute for dashboard
        tags: ['dashboard-stats']
      }
    })

    if (response.ok) {
      const data = await response.json()
      const overview = data?.analytics?.overview ?? {}
      return {
        totalUsers: overview.totalUsers ?? 0,
        totalTickets: overview.totalTickets ?? 0,
        openTickets: overview.openTickets ?? 0,
        resolvedTickets: overview.closedTickets ?? 0
      }
    }

    return {
      totalUsers: 0,
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0
    }
  } catch {
    return {
      totalUsers: 0,
      totalTickets: 0,
      openTickets: 0,
      resolvedTickets: 0
    }
  }
}

async function getRecentTickets(): Promise<RecentTicket[]> {
  const { baseUrl, forwardedHeaders } = await resolveRequestContext()

  try {
    const response = await fetch(`${baseUrl}/api/admin/tickets`, {
      headers: forwardedHeaders,
      credentials: 'include',
      next: {
        revalidate: 60,
        tags: ['recent-tickets']
      }
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success && Array.isArray(data.tickets)) {
        return data.tickets.slice(0, 5)
      }
    }
    return []
  } catch {
    return []
  }
}

export default async function AdminPage() {
  const [stats, recentTickets] = await Promise.all([
    getDashboardData(),
    getRecentTickets()
  ])

  const resolutionRate = stats.totalTickets > 0
    ? ((stats.resolvedTickets / stats.totalTickets) * 100).toFixed(1)
    : '0.0'

  const statsData = [
    {
      name: 'Total de Usuários',
      value: stats.totalUsers.toString(),
      icon: UsersIcon,
      description: 'Usuários ativos no sistema'
    },
    {
      name: 'Tickets Ativos',
      value: stats.openTickets.toString(),
      icon: TicketIcon,
      description: 'Tickets aguardando resolução'
    },
    {
      name: 'Tickets Resolvidos',
      value: stats.resolvedTickets.toString(),
      icon: CheckCircleIcon,
      description: 'Tickets finalizados com sucesso'
    },
    {
      name: 'Taxa de Resolução',
      value: `${resolutionRate}%`,
      icon: ChartPieIcon,
      description: 'Percentual de tickets resolvidos'
    },
  ]

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            Dashboard Administrativo
          </h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-description">
            Visão geral completa do sistema ServiceDesk Pro
          </p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/tickets/new"
            className="btn btn-primary"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Novo Ticket
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat) => (
          <div
            key={stat.name}
            className="glass-panel p-4 sm:p-6 hover:shadow-large transition-all duration-300 group animate-slide-up"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-description truncate">
                  {stat.name}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 sm:mt-2">
                  {stat.value}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                  {stat.description}
                </p>
              </div>
              <div className="h-12 w-12 sm:h-14 sm:w-14 bg-gradient-brand rounded-xl flex items-center justify-center flex-shrink-0 ml-3 group-hover:scale-110 transition-transform duration-300">
                <stat.icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Categories Distribution */}
      <div className="glass-panel p-4 sm:p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Distribuição por Categorias
          </h3>
          <Link
            href="/admin/categories"
            className="text-brand-600 hover:text-brand-700 text-sm font-medium"
          >
            Gerenciar →
          </Link>
        </div>
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 dark:border-brand-400"></div>
          </div>
        }>
          <CategoriesDistribution />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Tickets */}
        <div className="lg:col-span-2">
          <div className="glass-panel overflow-hidden animate-slide-up">
            <div className="px-4 sm:px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Tickets Recentes
              </h3>
              <Link
                href="/admin/tickets"
                className="btn btn-secondary text-sm"
              >
                Ver Todos
              </Link>
            </div>
            <div className="p-4 sm:p-6">
              {recentTickets.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-content text-sm">Nenhum ticket encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTickets.map((ticket, index) => {
                    const statusLower = (ticket.status || '').toLowerCase()
                    const isOpen = ['aberto', 'novo', 'open', 'new'].includes(statusLower)
                    const isInProgress = ['em andamento', 'em progresso', 'in_progress'].includes(statusLower)

                    return (
                      <Link
                        key={ticket.id}
                        href={`/admin/tickets/${ticket.id}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-200"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                          <div className={`h-3 w-3 rounded-full flex-shrink-0 mt-1 sm:mt-0 ${
                            isOpen ? 'bg-error-400' :
                            isInProgress ? 'bg-warning-400' :
                            'bg-success-400'
                          } animate-pulse-soft`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm sm:text-base text-neutral-900 dark:text-neutral-100 line-clamp-1">
                              {ticket.title}
                            </p>
                            <p className="text-xs sm:text-sm text-description truncate">
                              #{ticket.id} {ticket.assigned_agent_name ? `\u2022 ${ticket.assigned_agent_name}` : ''} {ticket.created_at ? `\u2022 ${new Date(ticket.created_at).toLocaleDateString('pt-BR')}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2 flex-wrap sm:flex-nowrap gap-2">
                          {ticket.priority && (
                            <span className="badge badge-warning text-xs">
                              {ticket.priority}
                            </span>
                          )}
                          {ticket.status && (
                            <span className={`badge text-xs ${
                              isOpen ? 'badge-error' :
                              isInProgress ? 'badge-warning' :
                              'badge-success'
                            }`}>
                              {ticket.status}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions & System Status */}
        <div className="space-y-4 sm:space-y-6">
          {/* Quick Actions - Enhanced Design */}
          <div className="glass-panel p-4 sm:p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Ações Rápidas
            </h3>
            <div className="space-y-3">
              <Link
                href="/tickets/new"
                className="group relative bg-gradient-to-br from-sky-500 to-blue-600 p-4 rounded-xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex items-center overflow-hidden"
              >
                {/* Icon container */}
                <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform flex-shrink-0">
                  <PlusIcon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-white">
                    Criar Novo Ticket
                  </h4>
                  <p className="text-xs text-white/80">
                    Abrir chamado rapidamente
                  </p>
                </div>

                {/* Arrow */}
                <ArrowRightIcon className="w-5 h-5 text-white/70 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>

              <Link
                href="/admin/reports"
                className="group relative bg-gradient-to-br from-white to-purple-50 dark:from-neutral-800 dark:to-purple-950/20 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex items-center overflow-hidden"
              >
                {/* Icon container */}
                <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform flex-shrink-0 shadow-md">
                  <ChartPieIcon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Ver Relatórios
                  </h4>
                  <p className="text-xs text-description">
                    Análises e métricas
                  </p>
                </div>

                {/* Arrow */}
                <ArrowRightIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>

              <Link
                href="/admin/users"
                className="group relative bg-gradient-to-br from-white to-green-50 dark:from-neutral-800 dark:to-green-950/20 p-4 rounded-xl border-2 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex items-center overflow-hidden"
              >
                {/* Icon container */}
                <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center mr-4 group-hover:scale-110 transition-transform flex-shrink-0 shadow-md">
                  <UsersIcon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Gerenciar Usuários
                  </h4>
                  <p className="text-xs text-description">
                    Equipe e permissões
                  </p>
                </div>

                {/* Arrow */}
                <ArrowRightIcon className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>
            </div>
          </div>

          {/* System Status */}
          <div className="glass-panel p-4 sm:p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Status do Sistema
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-description">Sistema</span>
                <span className="flex items-center text-sm text-neutral-900 dark:text-neutral-100">
                  <div className="h-2 w-2 bg-success-400 rounded-full mr-2 animate-pulse-soft"></div>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-description">Tickets</span>
                <span className="text-sm text-neutral-900 dark:text-neutral-100">{stats.totalTickets} total</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-description">Versão</span>
                <span className="text-sm text-neutral-900 dark:text-neutral-100">v2.0.0</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="glass-panel p-4 sm:p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Alertas
            </h3>
            <div className="space-y-3">
              {stats.openTickets > 0 && (
                <div className="flex items-center p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
                  <ExclamationTriangleIcon className="h-5 w-5 text-warning-600 dark:text-warning-400 mr-3 flex-shrink-0" />
                  <span className="text-sm text-warning-800 dark:text-warning-300">{stats.openTickets} ticket{stats.openTickets > 1 ? 's' : ''} aberto{stats.openTickets > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex items-center p-3 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
                <CheckCircleIcon className="h-5 w-5 text-success-600 dark:text-success-400 mr-3 flex-shrink-0" />
                <span className="text-sm text-success-800 dark:text-success-300">Sistema funcionando normalmente</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
