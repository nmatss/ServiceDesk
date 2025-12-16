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
  XCircleIcon
} from '@heroicons/react/24/outline'

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
        { name: 'Suporte Técnico', count: 52, percentage: 33, color: 'bg-blue-500' },
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
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <TicketIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                Relatório de Tickets
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Análise detalhada por período
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
              </select>
              <button className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2">
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
              <button
                onClick={() => fetchReportData()}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Total de Tickets</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{summary.total}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Abertos</p>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{summary.open + summary.in_progress}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Resolvidos</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{summary.resolved + summary.closed}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Tempo Médio</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{summary.avg_resolution_hours}h</p>
              </div>
            </div>

            {/* SLA Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Cumprimento de SLA</h3>
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
                      <span className="text-xl font-bold text-gray-900">
                        {Math.round((summary.sla_met / summary.total) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        Dentro do SLA
                      </span>
                      <span className="font-medium text-green-600">{summary.sla_met}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <XCircleIcon className="w-4 h-4 text-red-500" />
                        Fora do SLA
                      </span>
                      <span className="font-medium text-red-600">{summary.sla_breached}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Status Atual</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Abertos</span>
                      <span className="font-medium">{summary.open}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(summary.open / summary.total) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Em Progresso</span>
                      <span className="font-medium">{summary.in_progress}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(summary.in_progress / summary.total) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Resolvidos</span>
                      <span className="font-medium">{summary.resolved}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(summary.resolved / summary.total) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trend Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
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
                              className="flex-1 bg-blue-400 rounded-t"
                              style={{ height: `${(day.created / maxDaily) * 100}%` }}
                              title={`Criados: ${day.created}`}
                            />
                            <div
                              className="flex-1 bg-green-400 rounded-t"
                              style={{ height: `${(day.resolved / maxDaily) * 100}%` }}
                              title={`Resolvidos: ${day.resolved}`}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{dayNum}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-400 rounded" />
                  Criados
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded" />
                  Resolvidos
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By Category */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Por Categoria</h3>
                <div className="space-y-3">
                  {categoryData.map((cat, index) => (
                    <div key={index}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{cat.name}</span>
                        <span className="font-medium">{cat.count} ({cat.percentage}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Priority */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Por Prioridade</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 font-medium">Prioridade</th>
                        <th className="pb-2 font-medium text-right">Tickets</th>
                        <th className="pb-2 font-medium text-right hidden sm:table-cell">Tempo Médio</th>
                        <th className="pb-2 font-medium text-right">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priorityData.map((p, index) => (
                        <tr key={index} className="border-b border-gray-100">
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/reports/my-performance')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Minha Performance
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
