'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChartBarIcon,
  CalendarIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import OverviewCards from '@/src/components/analytics/OverviewCards'
import TicketTrendChart from '@/src/components/analytics/TicketTrendChart'
import DistributionCharts from '@/src/components/analytics/DistributionCharts'

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
  const [userRole, setUserRole] = useState<'admin' | 'agent' | 'user'>('user')
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const role = localStorage.getItem('user_role') as 'admin' | 'agent' | 'user'

    if (!token) {
      router.push('/auth/login')
      return
    }

    setUserRole(role || 'user')
    loadAnalytics()
  }, [router, period])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/analytics/overview?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        console.error('Erro ao carregar analytics:', result.error)
      }

    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const periodOptions = [
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' },
    { value: '1y', label: 'Último ano' }
  ]

  if (loading) {
    return (
      <div className=\"min-h-screen bg-gray-50 flex items-center justify-center\">
        <div className=\"text-center\">
          <div className=\"animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4\"></div>
          <p className=\"text-gray-600\">Carregando analytics...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className=\"min-h-screen bg-gray-50 flex items-center justify-center\">
        <div className=\"text-center\">
          <ChartBarIcon className=\"w-16 h-16 text-gray-400 mx-auto mb-4\" />
          <h1 className=\"text-2xl font-bold text-gray-900 mb-4\">Erro ao carregar dados</h1>
          <button
            onClick={loadAnalytics}
            className=\"text-blue-600 hover:text-blue-700 flex items-center mx-auto\"
          >
            <ArrowPathIcon className=\"w-4 h-4 mr-2\" />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className=\"min-h-screen bg-gray-50\">
      <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8\">
        {/* Header */}
        <div className=\"flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8\">
          <div>
            <h1 className=\"text-3xl font-bold text-gray-900 mb-2\">
              Analytics Dashboard
            </h1>
            <p className=\"text-gray-600\">
              Visão completa das métricas e performance do suporte
            </p>
          </div>

          <div className=\"mt-4 sm:mt-0 flex items-center space-x-4\">
            {/* Seletor de período */}
            <div className=\"relative\">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className=\"appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent\"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <CalendarIcon className=\"absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none\" />
            </div>

            <button
              onClick={loadAnalytics}
              className=\"flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors\"
            >
              <ArrowPathIcon className=\"w-4 h-4 mr-2\" />
              Atualizar
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        <OverviewCards data={data.overview} />

        {/* Trend Chart */}
        <div className=\"mb-8\">
          <TicketTrendChart data={data.trends.ticketTrend} />
        </div>

        {/* Distribution Charts */}
        <DistributionCharts
          statusData={data.distributions.byStatus}
          categoryData={data.distributions.byCategory}
          priorityData={data.distributions.byPriority}
        />

        {/* SLA e Satisfaction Row */}
        <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8\">
          {/* SLA Performance */}
          <div className=\"bg-white rounded-lg border border-gray-200 p-6\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">
              Performance SLA
            </h3>
            <div className=\"space-y-4\">
              <div>
                <div className=\"flex justify-between items-center mb-2\">
                  <span className=\"text-sm font-medium text-gray-700\">
                    Cumprimento de Resposta
                  </span>
                  <span className=\"text-sm font-bold text-gray-900\">
                    {data.sla.responseCompliance}%
                  </span>
                </div>
                <div className=\"w-full bg-gray-200 rounded-full h-2\">
                  <div
                    className=\"bg-blue-600 h-2 rounded-full\"
                    style={{ width: `${data.sla.responseCompliance}%` }}
                  />
                </div>
              </div>

              <div>
                <div className=\"flex justify-between items-center mb-2\">
                  <span className=\"text-sm font-medium text-gray-700\">
                    Cumprimento de Resolução
                  </span>
                  <span className=\"text-sm font-bold text-gray-900\">
                    {data.sla.resolutionCompliance}%
                  </span>
                </div>
                <div className=\"w-full bg-gray-200 rounded-full h-2\">
                  <div
                    className=\"bg-green-600 h-2 rounded-full\"
                    style={{ width: `${data.sla.resolutionCompliance}%` }}
                  />
                </div>
              </div>

              <div className=\"pt-4 border-t border-gray-200\">
                <div className=\"grid grid-cols-2 gap-4 text-center\">
                  <div>
                    <p className=\"text-sm text-gray-600\">Tempo Médio de Resposta</p>
                    <p className=\"text-lg font-semibold text-gray-900\">
                      {data.sla.avgResponseTime}h
                    </p>
                  </div>
                  <div>
                    <p className=\"text-sm text-gray-600\">Tempo Médio de Resolução</p>
                    <p className=\"text-lg font-semibold text-gray-900\">
                      {data.sla.avgResolutionTime}h
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Satisfaction */}
          <div className=\"bg-white rounded-lg border border-gray-200 p-6\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">
              Satisfação do Cliente
            </h3>
            <div className=\"text-center\">
              <div className=\"mb-4\">
                <span className=\"text-4xl font-bold text-yellow-500\">
                  {data.satisfaction.avgRating ? data.satisfaction.avgRating.toFixed(1) : '0.0'}
                </span>
                <span className=\"text-lg text-gray-600 ml-1\">/5.0</span>
              </div>

              <div className=\"flex justify-center mb-4\">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-6 h-6 ${
                      star <= Math.round(data.satisfaction.avgRating)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                    viewBox=\"0 0 20 20\"
                  >
                    <path d=\"M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z\" />
                  </svg>
                ))}
              </div>

              <p className=\"text-sm text-gray-600\">
                Baseado em {data.satisfaction.totalSurveys} avaliações
              </p>

              {data.satisfaction.totalSurveys === 0 && (
                <p className=\"text-xs text-gray-500 mt-2\">
                  Nenhuma avaliação no período selecionado
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Agent Performance (apenas para admins) */}
        {userRole === 'admin' && data.agentPerformance && (
          <div className=\"bg-white rounded-lg border border-gray-200 p-6\">
            <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">
              Performance dos Agentes
            </h3>
            <div className=\"overflow-x-auto\">
              <table className=\"min-w-full divide-y divide-gray-200\">
                <thead className=\"bg-gray-50\">
                  <tr>
                    <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\">
                      Agente
                    </th>
                    <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\">
                      Tickets Atribuídos
                    </th>
                    <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\">
                      Tickets Resolvidos
                    </th>
                    <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\">
                      Tempo Médio de Resposta
                    </th>
                    <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\">
                      Tempo Médio de Resolução
                    </th>
                    <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider\">
                      Taxa de Resolução
                    </th>
                  </tr>
                </thead>
                <tbody className=\"bg-white divide-y divide-gray-200\">
                  {data.agentPerformance.map((agent, index) => (
                    <tr key={index} className=\"hover:bg-gray-50\">
                      <td className=\"px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900\">
                        {agent.agent_name}
                      </td>
                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">
                        {agent.tickets_assigned}
                      </td>
                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">
                        {agent.tickets_resolved}
                      </td>
                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">
                        {agent.avg_response_time ? `${Math.round(agent.avg_response_time / 60 * 10) / 10}h` : '-'}
                      </td>
                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">
                        {agent.avg_resolution_time ? `${Math.round(agent.avg_resolution_time / 60 * 10) / 10}h` : '-'}
                      </td>
                      <td className=\"px-6 py-4 whitespace-nowrap text-sm text-gray-500\">
                        {agent.tickets_assigned > 0
                          ? `${Math.round((agent.tickets_resolved / agent.tickets_assigned) * 100)}%`
                          : '-'
                        }
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