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
  ArrowRightIcon,
  Cog6ToothIcon,
  TagIcon,
  ClockIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  RectangleGroupIcon
} from '@heroicons/react/24/outline'

export const metadata: Metadata = {
  title: 'Dashboard Administrativo | ServiceDesk',
  description: 'Visao geral completa do sistema ServiceDesk Pro',
}

// Esta pagina depende de dados autenticados internos e nao deve ser pre-renderizada em build.
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
          <p className="text-neutral-500 dark:text-neutral-400">Nenhuma categoria encontrada</p>
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
              className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border border-neutral-100 dark:border-neutral-700/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <h4 className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                    {category.name}
                  </h4>
                </div>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {percentage}%
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">Total</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {category.total_tickets}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">Resolvidos</span>
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
                <div className="text-xs text-right text-neutral-500 dark:text-neutral-400">
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
        <p className="text-neutral-500 dark:text-neutral-400">Erro ao carregar categorias</p>
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

const adminModules = [
  {
    title: 'Usuarios',
    description: 'Gerenciar usuarios, roles e permissoes',
    icon: UsersIcon,
    href: '/admin/users',
    color: 'from-emerald-500 to-emerald-600'
  },
  {
    title: 'Tickets',
    description: 'Visualizar e gerenciar todos os tickets',
    icon: TicketIcon,
    href: '/admin/tickets',
    color: 'from-brand-500 to-brand-600'
  },
  {
    title: 'Categorias',
    description: 'Configurar categorias de tickets',
    icon: TagIcon,
    href: '/admin/categories',
    color: 'from-violet-500 to-violet-600'
  },
  {
    title: 'SLA',
    description: 'Politicas de nivel de servico',
    icon: ClockIcon,
    href: '/admin/sla',
    color: 'from-amber-500 to-amber-600'
  },
  {
    title: 'Relatorios',
    description: 'Analises e metricas do sistema',
    icon: ChartPieIcon,
    href: '/admin/reports',
    color: 'from-indigo-500 to-indigo-600'
  },
  {
    title: 'Seguranca',
    description: 'Logs de auditoria e configuracoes',
    icon: ShieldCheckIcon,
    href: '/admin/audit',
    color: 'from-rose-500 to-rose-600'
  },
  {
    title: 'Base de Conhecimento',
    description: 'Artigos e documentacao interna',
    icon: DocumentTextIcon,
    href: '/knowledge',
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    title: 'Configuracoes',
    description: 'Configuracoes gerais do sistema',
    icon: Cog6ToothIcon,
    href: '/admin/settings',
    color: 'from-neutral-500 to-neutral-600'
  },
  {
    title: 'Workflows',
    description: 'Automacoes e fluxos de trabalho',
    icon: RectangleGroupIcon,
    href: '/workflows',
    color: 'from-teal-500 to-teal-600'
  },
]

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
      name: 'Total de Usuarios',
      value: stats.totalUsers.toString(),
      icon: UsersIcon,
      description: 'Usuarios ativos no sistema',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      name: 'Tickets Ativos',
      value: stats.openTickets.toString(),
      icon: TicketIcon,
      description: 'Tickets aguardando resolucao',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      name: 'Tickets Resolvidos',
      value: stats.resolvedTickets.toString(),
      icon: CheckCircleIcon,
      description: 'Tickets finalizados com sucesso',
      iconBg: 'bg-brand-100 dark:bg-brand-900/30',
      iconColor: 'text-brand-600 dark:text-brand-400'
    },
    {
      name: 'Taxa de Resolucao',
      value: `${resolutionRate}%`,
      icon: ChartPieIcon,
      description: 'Percentual de tickets resolvidos',
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400'
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Dashboard Administrativo
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Visao geral completa do sistema ServiceDesk Pro
          </p>
        </div>
        <Link
          href="/tickets/new"
          className="inline-flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors shadow-sm"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Novo Ticket
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat) => (
          <div
            key={stat.name}
            className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5 hover:shadow-md transition-all duration-300 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  {stat.name}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
                  {stat.value}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {stat.description}
                </p>
              </div>
              <div className={`h-12 w-12 ${stat.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 ml-3 group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Admin Modules Grid */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Modulos de Administracao
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminModules.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5 hover:shadow-md transition-all duration-300 group"
            >
              <div className="flex items-start gap-4">
                <div className={`h-11 w-11 bg-gradient-to-br ${module.color} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                  <module.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {module.description}
                  </p>
                </div>
                <ArrowRightIcon className="h-4 w-4 text-neutral-400 dark:text-neutral-500 group-hover:text-brand-600 dark:group-hover:text-brand-400 group-hover:translate-x-1 transition-all flex-shrink-0 mt-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Categories Distribution */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Distribuicao por Categorias
          </h3>
          <Link
            href="/admin/categories"
            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm font-medium transition-colors"
          >
            Gerenciar &rarr;
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tickets */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Tickets Recentes
              </h3>
              <Link
                href="/admin/tickets"
                className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
              >
                Ver Todos
              </Link>
            </div>
            <div className="p-4 sm:p-5">
              {recentTickets.length === 0 ? (
                <div className="text-center py-8">
                  <TicketIcon className="h-10 w-10 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum ticket encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTickets.map((ticket) => {
                    const statusLower = (ticket.status || '').toLowerCase()
                    const isOpen = ['aberto', 'novo', 'open', 'new'].includes(statusLower)
                    const isInProgress = ['em andamento', 'em progresso', 'in_progress'].includes(statusLower)

                    return (
                      <Link
                        key={ticket.id}
                        href={`/admin/tickets/${ticket.id}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-200 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700"
                      >
                        <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                          <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1.5 sm:mt-0 ${
                            isOpen ? 'bg-red-400' :
                            isInProgress ? 'bg-amber-400' :
                            'bg-emerald-400'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-neutral-900 dark:text-neutral-100 line-clamp-1">
                              {ticket.title}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                              #{ticket.id} {ticket.assigned_agent_name ? `\u2022 ${ticket.assigned_agent_name}` : ''} {ticket.created_at ? `\u2022 ${new Date(ticket.created_at).toLocaleDateString('pt-BR')}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2 flex-wrap sm:flex-nowrap gap-1">
                          {ticket.priority && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                              {ticket.priority}
                            </span>
                          )}
                          {ticket.status && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              isOpen ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                              isInProgress ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                              'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Acoes Rapidas
            </h3>
            <div className="space-y-3">
              <Link
                href="/tickets/new"
                className="group flex items-center p-3.5 bg-gradient-to-r from-brand-500 to-brand-600 rounded-lg hover:from-brand-600 hover:to-brand-700 transition-all duration-300 hover:shadow-md"
              >
                <div className="h-10 w-10 bg-white/20 rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform flex-shrink-0">
                  <PlusIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white">Criar Novo Ticket</h4>
                  <p className="text-xs text-white/70">Abrir chamado rapidamente</p>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>

              <Link
                href="/admin/reports"
                className="group flex items-center p-3.5 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-md transition-all duration-300"
              >
                <div className="h-10 w-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform flex-shrink-0 shadow-sm">
                  <ChartPieIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ver Relatorios</h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Analises e metricas</p>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:text-violet-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>

              <Link
                href="/admin/users"
                className="group flex items-center p-3.5 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md transition-all duration-300"
              >
                <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform flex-shrink-0 shadow-sm">
                  <UsersIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Gerenciar Usuarios</h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Equipe e permissoes</p>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-neutral-400 dark:text-neutral-500 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </Link>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Status do Sistema
            </h3>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Sistema</span>
                <span className="flex items-center text-sm text-neutral-900 dark:text-neutral-100">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></div>
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Tickets</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{stats.totalTickets} total</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">Versao</span>
                <span className="text-sm text-neutral-900 dark:text-neutral-100">v2.0.0</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Alertas
            </h3>
            <div className="space-y-3">
              {stats.openTickets > 0 && (
                <div className="flex items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3 flex-shrink-0" />
                  <span className="text-sm text-amber-800 dark:text-amber-300">{stats.openTickets} ticket{stats.openTickets > 1 ? 's' : ''} aberto{stats.openTickets > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mr-3 flex-shrink-0" />
                <span className="text-sm text-emerald-800 dark:text-emerald-300">Sistema funcionando normalmente</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
