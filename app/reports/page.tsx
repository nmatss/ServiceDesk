'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  ChartBarIcon,
  ClockIcon,
  TicketIcon,
  TrophyIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { useNotificationHelpers } from '@/src/components/notifications/NotificationProvider'

interface ReportStats {
  totalTickets: number
  resolvedTickets: number
  avgResolutionTime: number
  satisfactionRating: number
  responseTime: number
  ticketsThisMonth: number
  ticketsLastMonth: number
  performanceScore: number
}

interface TicketTrend {
  date: string
  created: number
  resolved: number
}

interface CategoryStats {
  category: string
  count: number
  percentage: number
  avgResolutionTime: number
}

export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ReportStats | null>(null)
  const [trends, setTrends] = useState<TicketTrend[]>([])
  const [categories, setCategories] = useState<CategoryStats[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [userRole, setUserRole] = useState<'admin' | 'agent' | 'user'>('user')
  const [userName, setUserName] = useState('')
  const { success, error } = useNotificationHelpers()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const role = localStorage.getItem('user_role') as 'admin' | 'agent' | 'user'
    const name = localStorage.getItem('user_name') || ''

    if (!token) {
      router.push('/auth/login')
      return
    }

    setUserRole(role || 'user')
    setUserName(name)
    fetchReportsData()
  }, [router, selectedPeriod])

  const fetchReportsData = async () => {
    try {
      setLoading(true)

      // Por enquanto, vamos usar dados mock até a API estar pronta
      const mockStats: ReportStats = {
        totalTickets: 156,
        resolvedTickets: 134,
        avgResolutionTime: 4.2,
        satisfactionRating: 4.6,
        responseTime: 1.8,
        ticketsThisMonth: 45,
        ticketsLastMonth: 38,
        performanceScore: 92
      }

      const mockTrends: TicketTrend[] = [
        { date: '2024-01-01', created: 12, resolved: 8 },
        { date: '2024-01-02', created: 15, resolved: 14 },
        { date: '2024-01-03', created: 10, resolved: 16 },
        { date: '2024-01-04', created: 18, resolved: 12 },
        { date: '2024-01-05', created: 14, resolved: 18 },
        { date: '2024-01-06', created: 8, resolved: 15 },
        { date: '2024-01-07', created: 22, resolved: 20 }
      ]

      const mockCategories: CategoryStats[] = [
        { category: 'Suporte Técnico', count: 45, percentage: 35, avgResolutionTime: 3.2 },
        { category: 'Bugs', count: 32, percentage: 25, avgResolutionTime: 5.8 },
        { category: 'Solicitações', count: 28, percentage: 22, avgResolutionTime: 2.1 },
        { category: 'Outros', count: 23, percentage: 18, avgResolutionTime: 4.5 }
      ]

      setStats(mockStats)
      setTrends(mockTrends)
      setCategories(mockCategories)
    } catch (err) {
      logger.error('Erro ao buscar dados de relatórios', err)
      error('Erro', 'Falha ao carregar relatórios')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    // Implementar exportação de relatório
    success('Sucesso', 'Relatório exportado com sucesso')
  }

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case '7d': return 'Últimos 7 dias'
      case '30d': return 'Últimos 30 dias'
      case '90d': return 'Últimos 90 dias'
      case '1y': return 'Último ano'
      default: return 'Período'
    }
  }

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return 'Excelente'
    if (score >= 70) return 'Bom'
    return 'Precisa Melhorar'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="container-responsive py-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                {userRole === 'agent' ? 'Meus Relatórios' : 'Relatórios'}
              </h1>
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                {userRole === 'agent'
                  ? `Análise da performance de ${userName}`
                  : 'Análise de performance e estatísticas do sistema'
                }
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex items-center space-x-4">
              {/* Period Selector */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="input-primary text-sm"
              >
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
                <option value="1y">Último ano</option>
              </select>
              <button
                onClick={exportReport}
                className="btn btn-secondary"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Exportar
              </button>
            </div>
          </div>

          {/* Performance Summary */}
          {userRole === 'agent' && stats && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Score de Performance
                </h2>
                <div className="flex items-center">
                  <TrophyIcon className={`h-6 w-6 mr-2 ${getPerformanceColor(stats.performanceScore)}`} />
                  <span className={`text-2xl font-bold ${getPerformanceColor(stats.performanceScore)}`}>
                    {stats.performanceScore}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  stats.performanceScore >= 90
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : stats.performanceScore >= 70
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {getPerformanceBadge(stats.performanceScore)}
                </span>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Baseado em resolução, tempo de resposta e satisfação do cliente
                </p>
              </div>
            </div>
          )}

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
                <div className="flex items-center">
                  <TicketIcon className="h-8 w-8 text-brand-600 dark:text-brand-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      Total de Tickets
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {stats.totalTickets}
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-sm">
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    +{((stats.ticketsThisMonth - stats.ticketsLastMonth) / stats.ticketsLastMonth * 100).toFixed(1)}%
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-400 ml-1">
                    vs mês anterior
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
                <div className="flex items-center">
                  <ChartBarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      Taxa de Resolução
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {((stats.resolvedTickets / stats.totalTickets) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {stats.resolvedTickets} de {stats.totalTickets} tickets
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      Tempo Médio de Resolução
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {stats.avgResolutionTime}h
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  Tempo de resposta: {stats.responseTime}h
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
                <div className="flex items-center">
                  <TrophyIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      Satisfação do Cliente
                    </p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {stats.satisfactionRating}/5
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-lg ${
                        i < Math.floor(stats.satisfactionRating)
                          ? 'text-yellow-400'
                          : 'text-neutral-300 dark:text-neutral-600'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Trend Chart */}
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Tendência de Tickets - {getPeriodLabel(selectedPeriod)}
              </h3>
              <div className="h-64 flex items-end justify-between space-x-2">
                {trends.map((trend, index) => {
                  const maxValue = Math.max(...trends.map(t => Math.max(t.created, t.resolved)))
                  const createdHeight = (trend.created / maxValue) * 100
                  const resolvedHeight = (trend.resolved / maxValue) * 100

                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="w-full flex justify-center space-x-1 mb-2">
                        <div
                          className="bg-brand-500 rounded-t"
                          style={{ height: `${createdHeight * 2}px`, width: '12px' }}
                          title={`Criados: ${trend.created}`}
                        />
                        <div
                          className="bg-green-500 rounded-t"
                          style={{ height: `${resolvedHeight * 2}px`, width: '12px' }}
                          title={`Resolvidos: ${trend.resolved}`}
                        />
                      </div>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 transform rotate-45">
                        {new Date(trend.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-center space-x-6 mt-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-brand-500 rounded mr-2"></div>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Criados</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">Resolvidos</span>
                </div>
              </div>
            </div>

            {/* Category Distribution */}
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Distribuição por Categoria
              </h3>
              <div className="space-y-4">
                {categories.map((category, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        {category.category}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {category.count}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">
                          ({category.percentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div
                        className="bg-brand-500 h-2 rounded-full"
                        style={{ width: `${category.percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        Tempo médio: {category.avgResolutionTime}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Opções de Exportação
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => exportReport()}
                className="btn btn-secondary justify-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Exportar PDF
              </button>
              <button
                onClick={() => exportReport()}
                className="btn btn-secondary justify-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Exportar Excel
              </button>
              <button
                onClick={() => exportReport()}
                className="btn btn-secondary justify-center"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}