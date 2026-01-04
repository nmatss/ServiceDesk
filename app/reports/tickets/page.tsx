'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChartBarIcon,
  TicketIcon,
  ClockIcon,
  CalendarDaysIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  HomeIcon
} from '@heroicons/react/24/outline'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard'

interface TicketSummary {
  total: number
  open: number
  in_progress: number
  resolved: number
  closed: number
  avg_resolution_hours: number
  sla_met: number
  sla_breached: number
}

interface DailyData {
  date: string
  created: number
  resolved: number
  backlog: number
}

interface CategoryData {
  name: string
  count: number
  percentage: number
  color: string
}

interface PriorityData {
  priority: string
  count: number
  avg_resolution: number
  sla_compliance: number
  color: string
}

export default function TicketReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [summary, setSummary] = useState<TicketSummary>({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    avg_resolution_hours: 0,
    sla_met: 0,
    sla_breached: 0
  })
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [priorityData, setPriorityData] = useState<PriorityData[]>([])

  useEffect(() => {
    fetchReportData()
  }, [period])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 400))

      setSummary({
        total: 156,
        open: 23,
        in_progress: 18,
        resolved: 89,
        closed: 26,
        avg_resolution_hours: 8.4,
        sla_met: 142,
        sla_breached: 14
      })

      // Generate daily data
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const daily: DailyData[] = []
      let backlog = 45

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const created = Math.floor(Math.random() * 8) + 2
        const resolved = Math.floor(Math.random() * 7) + 1
        backlog = backlog + created - resolved

        daily.push({
          date: date.toISOString().split('T')[0],
          created,
          resolved,
          backlog: Math.max(0, backlog)
        })
      }
      setDailyData(daily)

      setCategoryData([
        { name: 'Suporte Técnico', count: 52, percentage: 33, color: 'bg-brand-500' },
        { name: 'Acesso/Permissões', count: 38, percentage: 24, color: 'bg-green-500' },
        { name: 'Hardware', count: 28, percentage: 18, color: 'bg-yellow-500' },
        { name: 'Software', count: 22, percentage: 14, color: 'bg-purple-500' },
        { name: 'Rede', count: 16, percentage: 11, color: 'bg-orange-500' }
      ])

      setPriorityData([
        { priority: 'Crítica', count: 12, avg_resolution: 2.3, sla_compliance: 92, color: 'bg-red-500' },
        { priority: 'Alta', count: 34, avg_resolution: 4.5, sla_compliance: 88, color: 'bg-orange-500' },
        { priority: 'Média', count: 67, avg_resolution: 8.2, sla_compliance: 94, color: 'bg-yellow-500' },
        { priority: 'Baixa', count: 43, avg_resolution: 18.6, sla_compliance: 97, color: 'bg-green-500' }
      ])
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const maxDaily = Math.max(...dailyData.map(d => Math.max(d.created, d.resolved)), 1)

  return (
    <div className="pb-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Relatório de Tickets"
        description="Análise detalhada por período"
        icon={TicketIcon}
        breadcrumbs={[
          { label: 'Início', href: '/dashboard', icon: HomeIcon },
          { label: 'Relatórios', href: '/reports' },
          { label: 'Tickets' }
        ]}
        actions={
          <div className="flex gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
            </select>
            <button className="px-3 py-2 text-sm font-medium text-description bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg flex items-center gap-2 transition-all">
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button
              onClick={() => fetchReportData()}
              className="p-2 text-description hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
              aria-label="Atualizar dados"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        ) : (
          <div className="space-y-6 animate-slide-up">
            {/* Summary Cards */}
            <StatsGrid cols={4}>
              <StatsCard
                label="Total de Tickets"
                value={summary.total}
                icon={TicketIcon}
                variant="glass"
              />
              <StatsCard
                label="Abertos"
                value={summary.open + summary.in_progress}
                icon={ExclamationTriangleIcon}
                variant="glass"
                valueColor="text-status-warning-text"
              />
              <StatsCard
                label="Resolvidos"
                value={summary.resolved + summary.closed}
                icon={CheckCircleIcon}
                variant="glass"
                valueColor="text-status-success-text"
              />
              <StatsCard
                label="Tempo Médio"
                value={`${summary.avg_resolution_hours}h`}
                icon={ClockIcon}
                variant="glass"
                valueColor="text-brand-600 dark:text-brand-400"
              />
            </StatsGrid>

            {/* SLA Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-panel rounded-xl p-4 sm:p-6">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Cumprimento de SLA</h3>
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="#10b981"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(summary.sla_met / summary.total) * 251} 251`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-neutral-900 dark:text-white">
                        {Math.round((summary.sla_met / summary.total) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-description flex items-center gap-1">
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        Dentro do SLA
                      </span>
                      <span className="font-medium text-green-600">{summary.sla_met}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-description flex items-center gap-1">
                        <XCircleIcon className="w-4 h-4 text-red-500" />
                        Fora do SLA
                      </span>
                      <span className="font-medium text-red-600">{summary.sla_breached}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-4 sm:p-6">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Status Atual</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-description">Abertos</span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{summary.open}</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-status-open-border dark:bg-status-open-bg rounded-full transition-all" style={{ width: `${(summary.open / summary.total) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-description">Em Progresso</span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{summary.in_progress}</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-status-progress-border dark:bg-status-progress-bg rounded-full transition-all" style={{ width: `${(summary.in_progress / summary.total) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-description">Resolvidos</span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{summary.resolved}</span>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-status-success-border dark:bg-status-success-bg rounded-full transition-all" style={{ width: `${(summary.resolved / summary.total) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trend Chart */}
            <div className="glass-panel rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5 text-icon-muted" />
                Tendência de Tickets
              </h3>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="flex gap-1 items-end h-40">
                    {dailyData.slice(-14).map((day, index) => {
                      const date = new Date(day.date)
                      const dayNum = date.getDate()

                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex gap-0.5 items-end h-32">
                            <div
                              className="flex-1 bg-brand-500 dark:bg-brand-600 rounded-t transition-all hover:bg-brand-600 dark:hover:bg-brand-500"
                              style={{ height: `${(day.created / maxDaily) * 100}%` }}
                              title={`Criados: ${day.created}`}
                            />
                            <div
                              className="flex-1 bg-status-success-border dark:bg-status-success-bg rounded-t transition-all hover:opacity-80"
                              style={{ height: `${(day.resolved / maxDaily) * 100}%` }}
                              title={`Resolvidos: ${day.resolved}`}
                            />
                          </div>
                          <span className="text-xs text-muted-content">{dayNum}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-content">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-brand-500 dark:bg-brand-600 rounded" />
                  Criados
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-status-success-border dark:bg-status-success-bg rounded" />
                  Resolvidos
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By Category */}
              <div className="glass-panel rounded-xl p-4 sm:p-6">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Por Categoria</h3>
                <div className="space-y-3">
                  {categoryData.map((cat, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-description">{cat.name}</span>
                        <span className="font-medium text-neutral-900 dark:text-white">{cat.count} ({cat.percentage}%)</span>
                      </div>
                      <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Priority */}
              <div className="glass-panel rounded-xl p-4 sm:p-6">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Por Prioridade</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-content border-b border-neutral-200 dark:border-neutral-700">
                        <th className="pb-2 font-medium">Prioridade</th>
                        <th className="pb-2 font-medium text-right">Tickets</th>
                        <th className="pb-2 font-medium text-right hidden sm:table-cell">Tempo Médio</th>
                        <th className="pb-2 font-medium text-right">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priorityData.map((p, index) => (
                        <tr key={index} className="border-b border-neutral-100 dark:border-neutral-700">
                          <td className="py-2 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${p.color}`} />
                            {p.priority}
                          </td>
                          <td className="py-2 text-right">{p.count}</td>
                          <td className="py-2 text-right hidden sm:table-cell">{p.avg_resolution}h</td>
                          <td className="py-2 text-right">
                            <span className={p.sla_compliance >= 90 ? 'text-green-600' : 'text-orange-600'}>
                              {p.sla_compliance}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/reports/my-performance')}
            className="flex-1 py-2.5 text-sm font-medium text-description bg-neutral-100 dark:bg-neutral-800 rounded-lg"
          >
            Minha Performance
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
