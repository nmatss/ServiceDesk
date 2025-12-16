'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  TicketIcon,
  StarIcon,
  CalendarDaysIcon,
  UserIcon,
  TrophyIcon,
  FireIcon,
  BoltIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

interface PerformanceMetric {
  label: string
  value: number | string
  change: number
  changeLabel: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

interface TicketStats {
  resolved: number
  pending: number
  avg_resolution_time: number
  first_response_time: number
  sla_compliance: number
  csat_score: number
  reopen_rate: number
}

interface DailyActivity {
  date: string
  tickets_resolved: number
  tickets_assigned: number
  comments: number
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  earned: boolean
  progress?: number
  color: string
}

export default function MyPerformancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [stats, setStats] = useState<TicketStats>({
    resolved: 0,
    pending: 0,
    avg_resolution_time: 0,
    first_response_time: 0,
    sla_compliance: 0,
    csat_score: 0,
    reopen_rate: 0
  })
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])

  useEffect(() => {
    fetchPerformanceData()
  }, [period])

  const fetchPerformanceData = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 400))

      setStats({
        resolved: 47,
        pending: 8,
        avg_resolution_time: 4.2,
        first_response_time: 12,
        sla_compliance: 94,
        csat_score: 4.6,
        reopen_rate: 3.2
      })

      // Generate daily activity for last 14 days
      const activity: DailyActivity[] = []
      for (let i = 13; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        activity.push({
          date: date.toISOString().split('T')[0],
          tickets_resolved: Math.floor(Math.random() * 5) + 1,
          tickets_assigned: Math.floor(Math.random() * 6) + 2,
          comments: Math.floor(Math.random() * 10) + 5
        })
      }
      setDailyActivity(activity)

      setAchievements([
        {
          id: '1',
          title: 'Speed Demon',
          description: 'Resolver 10 tickets em um dia',
          icon: BoltIcon,
          earned: true,
          color: 'text-yellow-500'
        },
        {
          id: '2',
          title: 'SLA Master',
          description: 'Manter 95% de SLA por 30 dias',
          icon: TrophyIcon,
          earned: true,
          color: 'text-purple-500'
        },
        {
          id: '3',
          title: 'Customer Hero',
          description: 'Receber 10 avaliações 5 estrelas',
          icon: StarIcon,
          earned: false,
          progress: 70,
          color: 'text-blue-500'
        },
        {
          id: '4',
          title: 'On Fire',
          description: 'Resolver 50 tickets no mês',
          icon: FireIcon,
          earned: false,
          progress: 94,
          color: 'text-orange-500'
        }
      ])
    } catch (error) {
      console.error('Error fetching performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const metrics: PerformanceMetric[] = [
    {
      label: 'Tickets Resolvidos',
      value: stats.resolved,
      change: 12,
      changeLabel: 'vs período anterior',
      icon: CheckCircleIcon,
      color: 'text-green-600'
    },
    {
      label: 'Tempo Médio Resolução',
      value: `${stats.avg_resolution_time}h`,
      change: -8,
      changeLabel: 'mais rápido',
      icon: ClockIcon,
      color: 'text-blue-600'
    },
    {
      label: 'Primeira Resposta',
      value: `${stats.first_response_time}min`,
      change: -15,
      changeLabel: 'mais rápido',
      icon: BoltIcon,
      color: 'text-purple-600'
    },
    {
      label: 'SLA Compliance',
      value: `${stats.sla_compliance}%`,
      change: 3,
      changeLabel: 'aumento',
      icon: TrophyIcon,
      color: 'text-yellow-600'
    }
  ]

  const maxActivity = Math.max(...dailyActivity.map(d => d.tickets_resolved), 1)

  return (
    <div className="pb-20 sm:pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <ChartBarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                Minha Performance
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Acompanhe suas métricas e conquistas
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
                <option value="year">Este ano</option>
              </select>
              <button
                onClick={() => fetchPerformanceData()}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {metrics.map((metric, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <metric.icon className={`w-5 h-5 ${metric.color}`} />
                    <span className="text-sm text-gray-500">{metric.label}</span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metric.value}</p>
                  <div className="flex items-center gap-1 mt-2">
                    {metric.change > 0 ? (
                      <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
                    ) : (
                      <ArrowTrendingDownIcon className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-xs text-green-600">
                      {Math.abs(metric.change)}% {metric.changeLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* CSAT and Additional Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* CSAT Score */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                <h3 className="text-lg font-medium opacity-90 mb-2">Satisfação do Cliente</h3>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-bold">{stats.csat_score}</span>
                  <div className="flex gap-0.5 pb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <StarIconSolid
                        key={star}
                        className={`w-5 h-5 ${star <= Math.round(stats.csat_score) ? 'text-yellow-300' : 'text-white/30'}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-white/70 mt-2">
                  Baseado em {Math.round(stats.resolved * 0.6)} avaliações
                </p>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Resumo Rápido</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Tickets Pendentes</span>
                    <span className="font-medium text-orange-600">{stats.pending}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Taxa de Reabertura</span>
                    <span className="font-medium text-gray-900">{stats.reopen_rate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Média Diária</span>
                    <span className="font-medium text-gray-900">
                      {(stats.resolved / (period === '7d' ? 7 : period === '30d' ? 30 : 90)).toFixed(1)} tickets
                    </span>
                  </div>
                </div>
              </div>

              {/* Ranking */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrophyIcon className="w-5 h-5 text-yellow-500" />
                  Ranking da Equipe
                </h3>
                <div className="text-center py-4">
                  <span className="text-4xl font-bold text-gray-900">3º</span>
                  <p className="text-sm text-gray-500 mt-1">de 12 agentes</p>
                </div>
                <div className="mt-2 bg-yellow-50 rounded-lg p-2 text-center">
                  <span className="text-sm text-yellow-700">
                    🏆 Top 25% da equipe
                  </span>
                </div>
              </div>
            </div>

            {/* Activity Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
                Atividade Diária (últimos 14 dias)
              </h3>
              <div className="overflow-x-auto">
                <div className="flex gap-1 sm:gap-2 min-w-[500px]">
                  {dailyActivity.map((day, index) => {
                    const height = (day.tickets_resolved / maxActivity) * 100
                    const date = new Date(day.date)
                    const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' })
                    const dayNum = date.getDate()

                    return (
                      <div key={index} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full h-24 flex items-end justify-center">
                          <div
                            className="w-full max-w-[30px] bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                            style={{ height: `${Math.max(height, 10)}%` }}
                            title={`${day.tickets_resolved} tickets resolvidos`}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{dayNum}</span>
                        <span className="text-[10px] text-gray-400 uppercase">{dayName}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  Tickets Resolvidos
                </span>
              </div>
            </div>

            {/* Achievements */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrophyIcon className="w-5 h-5 text-yellow-500" />
                Conquistas
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {achievements.map(achievement => (
                  <div
                    key={achievement.id}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      achievement.earned
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-100 bg-gray-50 opacity-75'
                    }`}
                  >
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                      achievement.earned ? 'bg-yellow-100' : 'bg-gray-200'
                    }`}>
                      <achievement.icon className={`w-6 h-6 ${
                        achievement.earned ? achievement.color : 'text-gray-400'
                      }`} />
                    </div>
                    <h4 className={`font-medium mt-2 text-sm ${
                      achievement.earned ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {achievement.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">{achievement.description}</p>
                    {!achievement.earned && achievement.progress !== undefined && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${achievement.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 mt-1">{achievement.progress}%</span>
                      </div>
                    )}
                    {achievement.earned && (
                      <span className="inline-block mt-2 text-xs text-yellow-600 font-medium">
                        ✓ Conquistado
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold text-blue-900 mb-3">💡 Dicas para melhorar</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  Responda tickets de alta prioridade primeiro para melhorar o SLA
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  Use templates de resposta para agilizar o atendimento
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span>
                  Consulte a base de conhecimento antes de escalar
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
