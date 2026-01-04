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
  ArrowPathIcon,
  HomeIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard'

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
    <div className="pb-20 sm:pb-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Minha Performance"
        description="Acompanhe suas métricas e conquistas"
        icon={ChartBarIcon}
        breadcrumbs={[
          { label: 'Início', href: '/dashboard', icon: HomeIcon },
          { label: 'Relatórios', href: '/reports' },
          { label: 'Minha Performance' }
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
              <option value="year">Este ano</option>
            </select>
            <button
              onClick={() => fetchPerformanceData()}
              className="p-2 text-description hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
              aria-label="Atualizar dados"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>
        }
      />

      <div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        ) : (
          <div className="space-y-6 animate-slide-up">
            {/* Key Metrics */}
            <StatsGrid cols={4}>
              {metrics.map((metric, index) => (
                <StatsCard
                  key={index}
                  label={metric.label}
                  value={metric.value}
                  icon={metric.icon}
                  trend={metric.change > 0 ? 'up' : 'down'}
                  trendValue={`${Math.abs(metric.change)}%`}
                  trendLabel={metric.changeLabel}
                  variant="glass"
                />
              ))}
            </StatsGrid>

            {/* CSAT and Additional Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* CSAT Score */}
              <div className="glass-panel bg-gradient-to-br from-brand-600 to-brand-700 rounded-xl p-6 text-white border-0">
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
              <div className="glass-panel rounded-xl p-6">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Resumo Rápido</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-description">Tickets Pendentes</span>
                    <span className="font-medium text-status-warning-text">{stats.pending}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-description">Taxa de Reabertura</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{stats.reopen_rate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-description">Média Diária</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {(stats.resolved / (period === '7d' ? 7 : period === '30d' ? 30 : 90)).toFixed(1)} tickets
                    </span>
                  </div>
                </div>
              </div>

              {/* Ranking */}
              <div className="glass-panel rounded-xl p-6">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                  <TrophyIcon className="w-5 h-5 text-priority-medium-icon" />
                  Ranking da Equipe
                </h3>
                <div className="text-center py-4">
                  <span className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">3º</span>
                  <p className="text-sm text-muted-content mt-1">de 12 agentes</p>
                </div>
                <div className="mt-2 bg-priority-medium-bg dark:bg-priority-medium-bg/20 rounded-lg p-2 text-center">
                  <span className="text-sm text-priority-medium-text dark:text-priority-medium-icon">
                    Top 25% da equipe
                  </span>
                </div>
              </div>
            </div>

            {/* Activity Chart */}
            <div className="glass-panel rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5 text-icon-muted" />
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
                            className="w-full max-w-[30px] bg-brand-500 dark:bg-brand-600 rounded-t transition-all hover:bg-brand-600 dark:hover:bg-brand-500"
                            style={{ height: `${Math.max(height, 10)}%` }}
                            title={`${day.tickets_resolved} tickets resolvidos`}
                          />
                        </div>
                        <span className="text-xs text-muted-content">{dayNum}</span>
                        <span className="text-[10px] text-icon-muted uppercase">{dayName}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-content">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-brand-500 dark:bg-brand-600 rounded" />
                  Tickets Resolvidos
                </span>
              </div>
            </div>

            {/* Achievements */}
            <div className="glass-panel rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                <TrophyIcon className="w-5 h-5 text-priority-medium-icon" />
                Conquistas
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {achievements.map(achievement => (
                  <div
                    key={achievement.id}
                    className={`p-4 rounded-xl border-2 text-center transition-all hover:scale-105 ${
                      achievement.earned
                        ? 'border-priority-medium-border bg-priority-medium-bg dark:bg-priority-medium-bg/20'
                        : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 opacity-75'
                    }`}
                  >
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                      achievement.earned ? 'bg-priority-medium-bg dark:bg-priority-medium-bg/30' : 'bg-neutral-200 dark:bg-neutral-700'
                    }`}>
                      <achievement.icon className={`w-6 h-6 ${
                        achievement.earned ? achievement.color : 'text-icon-muted'
                      }`} />
                    </div>
                    <h4 className={`font-medium mt-2 text-sm ${
                      achievement.earned ? 'text-neutral-900 dark:text-neutral-100' : 'text-muted-content'
                    }`}>
                      {achievement.title}
                    </h4>
                    <p className="text-xs text-muted-content mt-1">{achievement.description}</p>
                    {!achievement.earned && achievement.progress !== undefined && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 dark:bg-brand-600 rounded-full transition-all"
                            style={{ width: `${achievement.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-icon-muted mt-1">{achievement.progress}%</span>
                      </div>
                    )}
                    {achievement.earned && (
                      <span className="inline-block mt-2 text-xs text-priority-medium-text dark:text-priority-medium-icon font-medium">
                        Conquistado
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="glass-panel bg-brand-50 dark:bg-brand-950/20 border-brand-200 dark:border-brand-900/50 rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold text-brand-900 dark:text-brand-100 mb-3">Dicas para melhorar</h3>
              <ul className="space-y-2 text-sm text-brand-800 dark:text-brand-200">
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 dark:text-brand-400 mt-0.5">•</span>
                  Responda tickets de alta prioridade primeiro para melhorar o SLA
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 dark:text-brand-400 mt-0.5">•</span>
                  Use templates de resposta para agilizar o atendimento
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-500 dark:text-brand-400 mt-0.5">•</span>
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
