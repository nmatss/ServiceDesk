'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { logger } from '@/lib/monitoring/logger';
import {
  ChartBarIcon,
  CalendarIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  HomeIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import OverviewCards from '@/src/components/analytics/OverviewCards'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'

// Lazy load heavy Recharts components to reduce initial bundle size
const TicketTrendChart = dynamic(
  () => import('@/src/components/analytics/TicketTrendChart'),
  {
    ssr: false,
    loading: () => (
      <div className="glass-panel p-6 h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-2"></div>
          <p className="text-sm text-description">Carregando gráfico...</p>
        </div>
      </div>
    )
  }
)

const DistributionCharts = dynamic(
  () => import('@/src/components/analytics/DistributionCharts'),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-panel p-6 h-80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        ))}
      </div>
    )
  }
)

interface AnalyticsData {
  overview: {
    totalTickets: number
    resolvedTickets: number
    openTickets: number
    overdueTickets: number
    resolutionRate: number
    avgFirstResponseTime: number
    avgResolutionTime: number
  }
  distributions: {
    byStatus: Array<{ status: string; count: number; color: string }>
    byCategory: Array<{ category: string; count: number; color: string }>
    byPriority: Array<{ priority: string; count: number; color: string; level: number }>
  }
  trends: {
    ticketTrend: Array<{ date: string; created: number; resolved: number }>
  }
  sla: {
    responseCompliance: number
    resolutionCompliance: number
    avgResponseTime: number
    avgResolutionTime: number
  }
  satisfaction: {
    avgRating: number
    totalSurveys: number
  }
  agentPerformance?: Array<{
    agent_name: string
    tickets_assigned: number
    tickets_resolved: number
    avg_response_time: number
    avg_resolution_time: number
  }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')

  // Use the centralized auth hook - eliminates 30+ lines of duplicate code
  const { user, loading: authLoading } = useRequireAuth()

  useEffect(() => {
    // Only load analytics once user is authenticated
    if (!authLoading && user) {
      loadAnalytics()
    }
  }, [authLoading, user, period])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/analytics/overview?period=${period}`, {
        credentials: 'include' // Use httpOnly cookies
      })

      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        logger.error('Erro ao carregar analytics', result.error)
      }

    } catch (error) {
      logger.error('Error loading analytics', error)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async () => {
    try {
      const response = await fetch(`/api/analytics/export?period=${period}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics-report-${period}-${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      logger.error('Error exporting report', error)
    }
  }

  const periodOptions = [
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' },
    { value: '1y', label: 'Último ano' }
  ]

  // Show loading while authenticating or loading data
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-description">Carregando analytics...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <ChartBarIcon className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">Erro ao carregar dados</h1>
          <button
            onClick={loadAnalytics}
            className="btn btn-primary"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Modern Header */}
        <PageHeader
          title="Analytics Dashboard"
          description="Visão completa das métricas e performance do suporte"
          icon={ChartBarIcon}
          breadcrumbs={[
            { label: 'Home', href: '/', icon: HomeIcon },
            { label: 'Analytics' }
          ]}
          actions={[
            {
              label: 'Exportar Relatório',
              onClick: exportReport,
              icon: ArrowDownTrayIcon,
              variant: 'secondary'
            },
            {
              label: 'Atualizar',
              onClick: loadAnalytics,
              icon: ArrowPathIcon,
              variant: 'primary'
            }
          ]}
        />

        {/* Period Filter */}
        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-muted-content" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Período:</span>
          </div>
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="appearance-none bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-neutral-900 dark:text-neutral-100"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        {/* Overview Cards */}
        <OverviewCards data={data.overview} />

        {/* Trend Chart */}
        <TicketTrendChart data={data.trends.ticketTrend} />

        {/* Distribution Charts */}
        <DistributionCharts
          statusData={data.distributions.byStatus}
          categoryData={data.distributions.byCategory}
          priorityData={data.distributions.byPriority}
        />

        {/* SLA e Satisfaction Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SLA Performance */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
              Performance SLA
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Cumprimento de Resposta
                  </span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {data.sla.responseCompliance}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5">
                  <div
                    className="bg-gradient-to-r from-brand-500 to-brand-400 h-2.5 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${data.sla.responseCompliance}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Cumprimento de Resolução
                  </span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {data.sla.resolutionCompliance}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5">
                  <div
                    className="bg-gradient-success h-2.5 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${data.sla.resolutionCompliance}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <p className="text-xs text-description mb-1">Tempo Médio de Resposta</p>
                    <p className="text-xl font-bold text-brand-600 dark:text-brand-400">
                      {data.sla.avgResponseTime}h
                    </p>
                  </div>
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <p className="text-xs text-description mb-1">Tempo Médio de Resolução</p>
                    <p className="text-xl font-bold text-success-600 dark:text-success-400">
                      {data.sla.avgResolutionTime}h
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Satisfaction */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
              Satisfação do Cliente
            </h3>
            <div className="text-center">
              <div className="mb-6">
                <span className="text-5xl font-bold text-warning-500">
                  {data.satisfaction.avgRating ? data.satisfaction.avgRating.toFixed(1) : '0.0'}
                </span>
                <span className="text-xl text-description ml-2">/5.0</span>
              </div>

              <div className="flex justify-center mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-8 h-8 transition-all duration-300 ${
                      star <= Math.round(data.satisfaction.avgRating)
                        ? 'text-warning-400 fill-current scale-110'
                        : 'text-neutral-300 dark:text-neutral-600'
                    }`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-sm text-description">
                  Baseado em <span className="font-semibold text-neutral-900 dark:text-neutral-100">{data.satisfaction.totalSurveys}</span> avaliações
                </p>

                {data.satisfaction.totalSurveys === 0 && (
                  <p className="text-xs text-muted-content mt-2">
                    Nenhuma avaliação no período selecionado
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Agent Performance (apenas para admins) */}
        {user?.role === 'admin' && data.agentPerformance && (
          <div className="glass-panel p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
              Performance dos Agentes
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
                <thead className="bg-neutral-50 dark:bg-neutral-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                      Agente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                      Tickets Atribuídos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                      Tickets Resolvidos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                      Tempo Médio de Resposta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                      Tempo Médio de Resolução
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-content uppercase tracking-wider">
                      Taxa de Resolução
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
                  {data.agentPerformance.map((agent, index) => (
                    <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {agent.agent_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-description">
                        {agent.tickets_assigned}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-description">
                        {agent.tickets_resolved}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-description">
                        {agent.avg_response_time ? `${Math.round(agent.avg_response_time / 60 * 10) / 10}h` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-description">
                        {agent.avg_resolution_time ? `${Math.round(agent.avg_resolution_time / 60 * 10) / 10}h` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {agent.tickets_assigned > 0 ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            Math.round((agent.tickets_resolved / agent.tickets_assigned) * 100) >= 80
                              ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
                              : Math.round((agent.tickets_resolved / agent.tickets_assigned) * 100) >= 60
                              ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400'
                              : 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400'
                          }`}>
                            {Math.round((agent.tickets_resolved / agent.tickets_assigned) * 100)}%
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}