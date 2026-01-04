'use client'

import { useState, useEffect } from 'react'
import {
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  ShieldCheckIcon,
  CogIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
  BugAntIcon,
  CircleStackIcon,
  SparklesIcon,
  CalendarIcon,
  FireIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'

interface ITILMetrics {
  incident: {
    total: number
    open: number
    resolved_today: number
    mttr: number
    mttr_trend: number
    first_call_resolution: number
    sla_compliance: number
    reopen_rate: number
    by_priority: { critical: number; high: number; medium: number; low: number }
  }
  request: {
    total: number
    pending: number
    fulfilled_today: number
    avg_fulfillment_time: number
    catalog_usage: number
    approval_pending: number
  }
  problem: {
    total: number
    open: number
    known_errors: number
    rca_completed: number
    workarounds_available: number
    linked_incidents: number
  }
  change: {
    total: number
    pending_cab: number
    approved: number
    success_rate: number
    emergency_changes: number
    failed_changes: number
    upcoming_changes: number
  }
  cmdb: {
    total_cis: number
    operational: number
    critical_cis: number
    relationships: number
    coverage: number
  }
  sla: {
    overall_compliance: number
    response_compliance: number
    resolution_compliance: number
    at_risk: number
    breached: number
  }
}

const colorMap: Record<string, 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  blue: 'brand',
  green: 'success',
  yellow: 'warning',
  red: 'error',
  purple: 'info',
  indigo: 'info',
  orange: 'warning'
}

const GaugeChart = ({ value, label, color }: { value: number; label: string; color: string }) => {
  const colorClasses: Record<string, string> = {
    green: '#10B981',
    blue: '#3B82F6',
    yellow: '#F59E0B',
    red: '#EF4444'
  }

  const getGaugeColor = (val: number) => {
    if (val >= 90) return colorClasses.green
    if (val >= 70) return colorClasses.blue
    if (val >= 50) return colorClasses.yellow
    return colorClasses.red
  }

  const gaugeColor = getGaugeColor(value)

  return (
    <div className="flex flex-col items-center animate-fade-in">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-700"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${value * 2.51} 251`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100">{value}%</span>
        </div>
      </div>
      <p className="text-xs sm:text-sm text-muted-content mt-2 text-center">{label}</p>
    </div>
  )
}

export default function ITILDashboardPage() {
  const [metrics, setMetrics] = useState<ITILMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    fetchMetrics()
  }, [period])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      // Fetch from multiple endpoints
      const [overviewRes, cobitRes] = await Promise.all([
        fetch(`/api/analytics/overview?period=${period}`),
        fetch(`/api/analytics/cobit?period=${period}`)
      ])

      const overviewData = await overviewRes.json()
      const cobitData = await cobitRes.json()

      // Combine and transform data
      setMetrics({
        incident: {
          total: overviewData.statistics?.total_tickets || 0,
          open: overviewData.statistics?.open_tickets || 0,
          resolved_today: overviewData.statistics?.resolved_today || 0,
          mttr: cobitData.metrics?.delivery?.mttr || 0,
          mttr_trend: -5,
          first_call_resolution: cobitData.metrics?.delivery?.first_contact_resolution || 0,
          sla_compliance: cobitData.metrics?.delivery?.sla_compliance || 0,
          reopen_rate: 3,
          by_priority: { critical: 5, high: 15, medium: 45, low: 35 }
        },
        request: {
          total: 150,
          pending: 25,
          fulfilled_today: 12,
          avg_fulfillment_time: 4.5,
          catalog_usage: 75,
          approval_pending: 8
        },
        problem: {
          total: 24,
          open: 8,
          known_errors: 12,
          rca_completed: 18,
          workarounds_available: 15,
          linked_incidents: 156
        },
        change: {
          total: 45,
          pending_cab: 6,
          approved: 12,
          success_rate: cobitData.metrics?.implementation?.change_success_rate || 95,
          emergency_changes: 3,
          failed_changes: 2,
          upcoming_changes: 8
        },
        cmdb: {
          total_cis: 1250,
          operational: 1180,
          critical_cis: 45,
          relationships: 3200,
          coverage: 85
        },
        sla: {
          overall_compliance: cobitData.metrics?.delivery?.sla_compliance || 0,
          response_compliance: 96,
          resolution_compliance: 92,
          at_risk: 5,
          breached: 2
        }
      })
    } catch {
      console.error('Error fetching metrics')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 space-y-6">
        {/* Page Header with Breadcrumbs */}
        <PageHeader
          title="Dashboard ITIL/COBIT"
          description="KPIs e métricas de governança de TI"
          icon={ChartBarIcon}
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Dashboard', href: '/admin/dashboard' },
            { label: 'ITIL' }
          ]}
          actions={[
            {
              label: period === '7' ? 'Últimos 7 dias' : period === '30' ? 'Últimos 30 dias' : period === '90' ? 'Últimos 90 dias' : 'Último ano',
              variant: 'secondary',
              onClick: () => {
                const periods = ['7', '30', '90', '365']
                const currentIndex = periods.indexOf(period)
                const nextIndex = (currentIndex + 1) % periods.length
                setPeriod(periods[nextIndex])
              }
            }
          ]}
        />

        {/* Period Selector */}
        <div className="flex justify-end">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
        </div>
        {/* SLA Overview */}
        <div className="glass-panel animate-fade-in">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-success-600 dark:text-success-400" />
            Visão Geral de SLA
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            <GaugeChart value={metrics.sla.overall_compliance} label="Compliance Geral" color="green" />
            <GaugeChart value={metrics.sla.response_compliance} label="Tempo de Resposta" color="blue" />
            <GaugeChart value={metrics.sla.resolution_compliance} label="Tempo de Resolução" color="blue" />
            <div className="flex flex-col items-center justify-center animate-fade-in">
              <div className="text-3xl sm:text-4xl font-bold text-warning-600 dark:text-warning-400">{metrics.sla.at_risk}</div>
              <p className="text-xs sm:text-sm text-muted-content text-center mt-2">Em Risco</p>
            </div>
            <div className="flex flex-col items-center justify-center animate-fade-in">
              <div className="text-3xl sm:text-4xl font-bold text-error-600 dark:text-error-400">{metrics.sla.breached}</div>
              <p className="text-xs sm:text-sm text-muted-content text-center mt-2">Violados</p>
            </div>
          </div>
        </div>

        {/* Incident Management */}
        <div className="glass-panel animate-slide-up">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-error-600 dark:text-error-400" />
            Gestão de Incidentes
          </h2>
          <StatsGrid cols={6}>
            <StatsCard
              title="Total"
              value={metrics.incident.total}
              icon={<DocumentTextIcon />}
              color="brand"
              size="sm"
            />
            <StatsCard
              title="Abertos"
              value={metrics.incident.open}
              icon={<ExclamationTriangleIcon />}
              color="warning"
              size="sm"
            />
            <StatsCard
              title="Resolvidos Hoje"
              value={metrics.incident.resolved_today}
              icon={<CheckCircleIcon />}
              color="success"
              size="sm"
            />
            <StatsCard
              title="MTTR"
              value={`${metrics.incident.mttr}h`}
              icon={<ClockIcon />}
              color="info"
              size="sm"
              change={metrics.incident.mttr_trend ? {
                value: Math.abs(metrics.incident.mttr_trend),
                type: metrics.incident.mttr_trend < 0 ? 'decrease' : 'increase'
              } : undefined}
            />
            <StatsCard
              title="FCR"
              value={`${metrics.incident.first_call_resolution}%`}
              icon={<StarIcon />}
              color="info"
              size="sm"
            />
            <StatsCard
              title="Reabertura"
              value={`${metrics.incident.reopen_rate}%`}
              icon={<BoltIcon />}
              color="warning"
              size="sm"
            />
          </StatsGrid>

          {/* Priority Distribution */}
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-description mb-3 font-medium">Distribuição por Prioridade</p>
            <div className="flex gap-2 h-4 rounded-full overflow-hidden">
              <div className="bg-error-500 transition-all duration-500" style={{ width: `${metrics.incident.by_priority.critical}%` }}></div>
              <div className="bg-warning-500 transition-all duration-500" style={{ width: `${metrics.incident.by_priority.high}%` }}></div>
              <div className="bg-yellow-400 transition-all duration-500" style={{ width: `${metrics.incident.by_priority.medium}%` }}></div>
              <div className="bg-success-500 transition-all duration-500" style={{ width: `${metrics.incident.by_priority.low}%` }}></div>
            </div>
            <div className="flex justify-between mt-3 text-xs text-muted-content">
              <span>Crítica: {metrics.incident.by_priority.critical}%</span>
              <span>Alta: {metrics.incident.by_priority.high}%</span>
              <span>Média: {metrics.incident.by_priority.medium}%</span>
              <span>Baixa: {metrics.incident.by_priority.low}%</span>
            </div>
          </div>
        </div>

        {/* Service Request & Problem Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Service Requests */}
          <div className="glass-panel animate-slide-up">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              Requisições de Serviço
            </h2>
            <StatsGrid cols={3}>
              <StatsCard title="Total" value={metrics.request.total} icon={<DocumentTextIcon />} color="brand" size="sm" />
              <StatsCard title="Pendentes" value={metrics.request.pending} icon={<ClockIcon />} color="warning" size="sm" />
              <StatsCard title="Atendidas Hoje" value={metrics.request.fulfilled_today} icon={<CheckCircleIcon />} color="success" size="sm" />
              <StatsCard title="TMA" value={`${metrics.request.avg_fulfillment_time}h`} icon={<ClockIcon />} color="info" size="sm" />
              <StatsCard title="Uso Catálogo" value={`${metrics.request.catalog_usage}%`} icon={<CogIcon />} color="info" size="sm" />
              <StatsCard title="Aguardando Aprovação" value={metrics.request.approval_pending} icon={<UserGroupIcon />} color="warning" size="sm" />
            </StatsGrid>
          </div>

          {/* Problem Management */}
          <div className="glass-panel animate-slide-up">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              <BugAntIcon className="w-5 h-5 text-info-600 dark:text-info-400" />
              Gestão de Problemas
            </h2>
            <StatsGrid cols={3}>
              <StatsCard title="Total" value={metrics.problem.total} icon={<BugAntIcon />} color="info" size="sm" />
              <StatsCard title="Abertos" value={metrics.problem.open} icon={<ExclamationTriangleIcon />} color="warning" size="sm" />
              <StatsCard title="Erros Conhecidos" value={metrics.problem.known_errors} icon={<DocumentTextIcon />} color="warning" size="sm" />
              <StatsCard title="RCA Concluídas" value={metrics.problem.rca_completed} icon={<CheckCircleIcon />} color="success" size="sm" />
              <StatsCard title="Workarounds" value={metrics.problem.workarounds_available} icon={<CogIcon />} color="brand" size="sm" />
              <StatsCard title="Incidentes Vinculados" value={metrics.problem.linked_incidents} icon={<BoltIcon />} color="error" size="sm" />
            </StatsGrid>
          </div>
        </div>

        {/* Change Management & CMDB */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Change Management */}
          <div className="glass-panel animate-slide-up">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              <ArrowsRightLeftIcon className="w-5 h-5 text-info-600 dark:text-info-400" />
              Gestão de Mudanças
            </h2>
            <StatsGrid cols={3}>
              <StatsCard title="Total" value={metrics.change.total} icon={<ArrowsRightLeftIcon />} color="info" size="sm" />
              <StatsCard title="Aguardando CAB" value={metrics.change.pending_cab} icon={<UserGroupIcon />} color="info" size="sm" />
              <StatsCard title="Aprovadas" value={metrics.change.approved} icon={<CheckCircleIcon />} color="success" size="sm" />
              <StatsCard title="Taxa de Sucesso" value={`${metrics.change.success_rate}%`} icon={<ChartBarIcon />} color="brand" size="sm" />
              <StatsCard title="Emergências" value={metrics.change.emergency_changes} icon={<FireIcon />} color="error" size="sm" />
              <StatsCard title="Agendadas" value={metrics.change.upcoming_changes} icon={<CalendarIcon />} color="warning" size="sm" />
            </StatsGrid>
          </div>

          {/* CMDB */}
          <div className="glass-panel animate-slide-up">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              <CircleStackIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              CMDB
            </h2>
            <StatsGrid cols={3}>
              <StatsCard title="Total CIs" value={metrics.cmdb.total_cis} icon={<CircleStackIcon />} color="brand" size="sm" />
              <StatsCard title="Operacionais" value={metrics.cmdb.operational} icon={<CheckCircleIcon />} color="success" size="sm" />
              <StatsCard title="Críticos" value={metrics.cmdb.critical_cis} icon={<ExclamationTriangleIcon />} color="error" size="sm" />
              <StatsCard title="Relacionamentos" value={metrics.cmdb.relationships} icon={<BoltIcon />} color="info" size="sm" />
              <div className="col-span-2 glass-panel bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-neutral-700 dark:text-neutral-300 font-medium">Cobertura CMDB</span>
                  <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{metrics.cmdb.coverage}%</span>
                </div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-brand rounded-full transition-all duration-1000 ease-out" style={{ width: `${metrics.cmdb.coverage}%` }}></div>
                </div>
              </div>
            </StatsGrid>
          </div>
        </div>
      </div>
    </div>
  )
}
