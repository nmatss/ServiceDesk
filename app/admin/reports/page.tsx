'use client'

import { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'
import {
  ChartBarIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'

interface ReportData {
  overview: {
    totalTickets: number
    openTickets: number
    closedTickets: number
    totalUsers: number
    ticketsInPeriod: number
    avgResolutionTime: number
  }
  ticketsByStatus: Array<{ name: string; color: string; count: number }>
  ticketsByCategory: Array<{ name: string; color: string; count: number }>
  ticketsByPriority: Array<{ name: string; color: string; level: number; count: number }>
  agentPerformance: Array<{ name: string; tickets_resolved: number; avg_resolution_hours: number }>
  dailyTickets: Array<{ date: string; count: number }>
  activeUsers: Array<{ name: string; email: string; tickets_created: number }>
}

export default function AdminReportsPage() {
  const [_loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('30')
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReportData()
  }, [selectedPeriod])

  const fetchReportData = async () => {
    try {
      setDataLoading(true)
      setError(null)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/admin/reports?period=${selectedPeriod}`, {
        credentials: 'include' // Use httpOnly cookies
      })

      if (!response.ok) {
        if (response.status === 401) {
          setError('Sessão expirada. Faça login novamente.')
        } else if (response.status === 403) {
          setError('Acesso negado. Apenas administradores podem visualizar relatórios.')
        } else {
          setError('Erro ao carregar dados dos relatórios')
        }
        return
      }

      const data = await response.json()
      setReportData(data)
    } catch (error) {
      logger.error('Erro ao buscar dados dos relatórios', error)
      setError('Erro ao carregar dados dos relatórios')
    } finally {
      setDataLoading(false)
    }
  }

  const handleExport = async (_format: string) => {
    setLoading(true)
    // Simular exportação
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLoading(false)
    // Aqui você implementaria a lógica de exportação
  }

  const formatTime = (hours: number) => {
    if (hours < 24) {
      return `${Math.round(hours)}h`
    } else {
      const days = Math.round(hours / 24 * 10) / 10
      return `${days} dias`
    }
  }

  const calculatePercentage = (count: number, total: number) => {
    return total > 0 ? Math.round((count / total) * 100) : 0
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Relatórios e Analytics"
        description="Visualize métricas e gere relatórios do sistema"
        icon={ChartBarIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Relatórios' }
        ]}
        actions={[
          {
            label: 'Exportar PDF',
            icon: DocumentTextIcon,
            variant: 'secondary',
            onClick: () => handleExport('pdf')
          },
          {
            label: 'Exportar Excel',
            icon: DocumentArrowDownIcon,
            variant: 'primary',
            onClick: () => handleExport('excel')
          }
        ]}
      />

      {/* Period Filter */}
      <div className="glass-panel p-4 animate-slide-up">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Período:
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="input max-w-xs"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {dataLoading && (
        <div className="glass-panel p-12 text-center animate-slide-up">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-description">Carregando dados dos relatórios...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="glass-panel border-l-4 border-error-500 p-6 animate-slide-up">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-error-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-error-800 dark:text-error-300">Erro ao carregar relatórios</h3>
              <div className="mt-2 text-sm text-error-700 dark:text-error-400">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={fetchReportData}
                  className="btn btn-secondary"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Stats */}
      {reportData && (
        <StatsGrid cols={4}>
          <StatsCard
            title="Total de Tickets"
            value={reportData.overview.totalTickets}
            icon={TicketIcon}
            color="brand"
            loading={dataLoading}
          />
          <StatsCard
            title="Tickets Fechados"
            value={reportData.overview.closedTickets}
            icon={CheckCircleIcon}
            color="success"
            loading={dataLoading}
          />
          <StatsCard
            title="Tickets Abertos"
            value={reportData.overview.openTickets}
            icon={TicketIcon}
            color="warning"
            loading={dataLoading}
          />
          <StatsCard
            title="Tempo Médio"
            value={formatTime(reportData.overview.avgResolutionTime)}
            icon={ClockIcon}
            color="info"
            loading={dataLoading}
          />
        </StatsGrid>
      )}

      {/* Charts Section */}
      {reportData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Ticket Status Chart */}
          <div className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
              Status dos Tickets
            </h3>
            <div className="space-y-4">
              {reportData.ticketsByStatus.map((status, index) => (
                <div key={index} className="flex items-center justify-between group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 p-3 rounded-lg transition-colors">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-3 group-hover:scale-125 transition-transform"
                      style={{ backgroundColor: status.color }}
                    ></div>
                    <span className="text-sm text-description">{status.name}</span>
                  </div>
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{status.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Distribution */}
          <div className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
              Distribuição por Categoria
            </h3>
            <div className="space-y-4">
              {reportData.ticketsByCategory.map((category, index) => {
                const percentage = calculatePercentage(category.count, reportData.overview.totalTickets)
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-description">{category.name}</span>
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{category.count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: category.color
                        }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Performance Table */}
      {reportData && (
        <div className="glass-panel overflow-hidden animate-slide-up" style={{ animationDelay: '300ms' }}>
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Performance dos Agentes
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                    Agente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                    Tickets Resolvidos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                    Tempo Médio
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
                {reportData.agentPerformance.length > 0 ? (
                  reportData.agentPerformance.map((agent, index) => (
                    <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center mr-3">
                            <UserGroupIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                          </div>
                          {agent.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-description">
                        <span className="badge badge-success">{agent.tickets_resolved}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-description">
                        {formatTime(agent.avg_resolution_hours)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-muted-content">
                      <UserGroupIcon className="h-12 w-12 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
                      <p>Nenhum agente com tickets resolvidos no período</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Statistics */}
      {reportData && (
        <div className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
            Estatísticas de Usuários
          </h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                {reportData.overview.totalUsers}
              </div>
              <div className="text-sm text-muted-content mt-1">
                Total de Usuários
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
              <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                {reportData.activeUsers.length}
              </div>
              <div className="text-sm text-muted-content mt-1">
                Usuários Ativos
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-success-50 dark:bg-success-900/20 hover:bg-success-100 dark:hover:bg-success-900/30 transition-colors">
              <div className="text-3xl font-bold text-success-600 dark:text-success-400">
                {reportData.overview.ticketsInPeriod}
              </div>
              <div className="text-sm text-muted-content mt-1">
                Tickets no Período
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {reportData.overview.totalTickets > 0
                  ? Math.round((reportData.overview.closedTickets / reportData.overview.totalTickets) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-muted-content mt-1">
                Taxa de Resolução
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '500ms' }}>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button onClick={() => toast.error('Relatório de tickets ainda não implementado')} className="btn btn-secondary w-full group">
            <TicketIcon className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
            Relatório de Tickets
          </button>
          <button onClick={() => toast.error('Relatório de usuários ainda não implementado')} className="btn btn-secondary w-full group">
            <UserGroupIcon className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
            Relatório de Usuários
          </button>
          <button onClick={() => toast.error('Relatório de performance ainda não implementado')} className="btn btn-secondary w-full group">
            <ChartBarIcon className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
            Relatório de Performance
          </button>
          <button onClick={() => toast.error('Relatório de categorias ainda não implementado')} className="btn btn-secondary w-full group">
            <DocumentTextIcon className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
            Relatório de Categorias
          </button>
        </div>
      </div>
    </div>
  )
}
