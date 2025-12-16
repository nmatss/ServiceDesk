'use client'

import { AdminCard } from '@/src/components/admin/AdminCard'
import { AdminButton } from '@/src/components/admin/AdminButton'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger';

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
    <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Relatórios e Analytics
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Visualize métricas e gere relatórios do sistema
            </p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0 space-x-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>
            <AdminButton variant="secondary" onClick={() => handleExport('pdf')}>
              Exportar PDF
            </AdminButton>
            <AdminButton variant="primary" onClick={() => handleExport('excel')}>
              Exportar Excel
            </AdminButton>
          </div>
        </div>

        {/* Loading State */}
        {dataLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando dados dos relatórios...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erro</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={fetchReportData}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <AdminCard className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">T</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total de Tickets
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {reportData.overview.totalTickets.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </AdminCard>

            <AdminCard className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">C</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Tickets Fechados
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {reportData.overview.closedTickets.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </AdminCard>

            <AdminCard className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">A</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Tickets Abertos
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {reportData.overview.openTickets}
                    </dd>
                  </dl>
                </div>
              </div>
            </AdminCard>

            <AdminCard className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">T</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Tempo Médio
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {formatTime(reportData.overview.avgResolutionTime)}
                    </dd>
                  </dl>
                </div>
              </div>
            </AdminCard>
          </div>
        )}

        {/* Charts Section */}
        {reportData && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Ticket Status Chart */}
            <AdminCard title="Status dos Tickets">
              <div className="space-y-4">
                {reportData.ticketsByStatus.map((status, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: status.color }}
                      ></div>
                      <span className="text-sm text-gray-600">{status.name}</span>
                    </div>
                    <span className="text-sm font-medium">{status.count}</span>
                  </div>
                ))}
              </div>
            </AdminCard>

            {/* Category Distribution */}
            <AdminCard title="Distribuição por Categoria">
              <div className="space-y-4">
                {reportData.ticketsByCategory.map((category, index) => {
                  const percentage = calculatePercentage(category.count, reportData.overview.totalTickets)
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{category.name}</span>
                        <span className="text-sm font-medium">{category.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
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
            </AdminCard>
          </div>
        )}

        {/* Performance Table */}
        {reportData && (
          <AdminCard title="Performance dos Agentes">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tickets Resolvidos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tempo Médio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.agentPerformance.length > 0 ? (
                    reportData.agentPerformance.map((agent, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {agent.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {agent.tickets_resolved}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTime(agent.avg_resolution_hours)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                        Nenhum agente com tickets resolvidos no período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminCard>
        )}

        {/* User Statistics */}
        {reportData && (
          <AdminCard title="Estatísticas de Usuários">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{reportData.overview.totalUsers}</div>
                <div className="text-sm text-gray-500">Total de Usuários</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{reportData.activeUsers.length}</div>
                <div className="text-sm text-gray-500">Usuários Ativos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{reportData.overview.ticketsInPeriod}</div>
                <div className="text-sm text-gray-500">Tickets no Período</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {reportData.overview.totalTickets > 0 
                    ? Math.round((reportData.overview.closedTickets / reportData.overview.totalTickets) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-gray-500">Taxa de Resolução</div>
              </div>
            </div>
          </AdminCard>
        )}

        {/* Quick Actions */}
        <AdminCard title="Ações Rápidas">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminButton variant="secondary" className="w-full">
              Relatório de Tickets
            </AdminButton>
            <AdminButton variant="secondary" className="w-full">
              Relatório de Usuários
            </AdminButton>
            <AdminButton variant="secondary" className="w-full">
              Relatório de Performance
            </AdminButton>
            <AdminButton variant="secondary" className="w-full">
              Relatório de Categorias
            </AdminButton>
          </div>
        </AdminCard>
      </div>
  )
}
