'use client'

import { useState, useEffect } from 'react'
import {
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
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

const MetricCard = ({
  title,
  value,
  unit = '',
  trend,
  trendLabel,
  icon: Icon,
  color,
  size = 'normal'
}: {
  title: string
  value: number | string
  unit?: string
  trend?: number
  trendLabel?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  size?: 'normal' | 'large'
}) => {
  const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', iconBg: 'bg-blue-100' },
    green: { bg: 'bg-green-50', text: 'text-green-600', iconBg: 'bg-green-100' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', iconBg: 'bg-yellow-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', iconBg: 'bg-red-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', iconBg: 'bg-purple-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', iconBg: 'bg-indigo-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', iconBg: 'bg-orange-100' }
  }

  const colors = colorClasses[color] || colorClasses.blue

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${size === 'large' ? 'sm:p-6' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-gray-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl sm:text-2xl ${size === 'large' ? 'md:text-3xl' : ''} font-bold ${colors.text}`}>
              {value}
            </span>
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? (
                <ArrowTrendingUpIcon className="w-3 h-3" />
              ) : (
                <ArrowTrendingDownIcon className="w-3 h-3" />
              )}
              <span>{Math.abs(trend)}%</span>
              {trendLabel && <span className="text-gray-500">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`p-2 sm:p-3 rounded-xl ${colors.iconBg}`}>
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
        </div>
      </div>
    </div>
  )
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
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#E5E7EB"
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
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg sm:text-xl font-bold text-gray-900">{value}%</span>
        </div>
      </div>
      <p className="text-xs sm:text-sm text-gray-500 mt-2 text-center">{label}</p>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ChartBarIcon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
                Dashboard ITIL/COBIT
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                KPIs e métricas de governança de TI
              </p>
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 space-y-6">
        {/* SLA Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-green-600" />
            Visão Geral de SLA
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            <GaugeChart value={metrics.sla.overall_compliance} label="Compliance Geral" color="green" />
            <GaugeChart value={metrics.sla.response_compliance} label="Tempo de Resposta" color="blue" />
            <GaugeChart value={metrics.sla.resolution_compliance} label="Tempo de Resolução" color="blue" />
            <div className="flex flex-col items-center justify-center">
              <div className="text-3xl sm:text-4xl font-bold text-yellow-600">{metrics.sla.at_risk}</div>
              <p className="text-xs sm:text-sm text-gray-500 text-center">Em Risco</p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <div className="text-3xl sm:text-4xl font-bold text-red-600">{metrics.sla.breached}</div>
              <p className="text-xs sm:text-sm text-gray-500 text-center">Violados</p>
            </div>
          </div>
        </div>

        {/* Incident Management */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            Gestão de Incidentes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <MetricCard title="Total" value={metrics.incident.total} icon={DocumentTextIcon} color="blue" />
            <MetricCard title="Abertos" value={metrics.incident.open} icon={ExclamationTriangleIcon} color="yellow" />
            <MetricCard title="Resolvidos Hoje" value={metrics.incident.resolved_today} icon={CheckCircleIcon} color="green" />
            <MetricCard title="MTTR" value={metrics.incident.mttr} unit="h" trend={metrics.incident.mttr_trend} icon={ClockIcon} color="purple" />
            <MetricCard title="FCR" value={`${metrics.incident.first_call_resolution}%`} icon={StarIcon} color="indigo" />
            <MetricCard title="Reabertura" value={`${metrics.incident.reopen_rate}%`} icon={BoltIcon} color="orange" />
          </div>

          {/* Priority Distribution */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-500 mb-2">Distribuição por Prioridade</p>
            <div className="flex gap-2 h-4 rounded-full overflow-hidden">
              <div className="bg-red-500" style={{ width: `${metrics.incident.by_priority.critical}%` }}></div>
              <div className="bg-orange-500" style={{ width: `${metrics.incident.by_priority.high}%` }}></div>
              <div className="bg-yellow-500" style={{ width: `${metrics.incident.by_priority.medium}%` }}></div>
              <div className="bg-green-500" style={{ width: `${metrics.incident.by_priority.low}%` }}></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
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
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-blue-600" />
              Requisições de Serviço
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard title="Total" value={metrics.request.total} icon={DocumentTextIcon} color="blue" />
              <MetricCard title="Pendentes" value={metrics.request.pending} icon={ClockIcon} color="yellow" />
              <MetricCard title="Atendidas Hoje" value={metrics.request.fulfilled_today} icon={CheckCircleIcon} color="green" />
              <MetricCard title="TMA" value={metrics.request.avg_fulfillment_time} unit="h" icon={ClockIcon} color="purple" />
              <MetricCard title="Uso Catálogo" value={`${metrics.request.catalog_usage}%`} icon={CogIcon} color="indigo" />
              <MetricCard title="Aguardando Aprovação" value={metrics.request.approval_pending} icon={UserGroupIcon} color="orange" />
            </div>
          </div>

          {/* Problem Management */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BugAntIcon className="w-5 h-5 text-purple-600" />
              Gestão de Problemas
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard title="Total" value={metrics.problem.total} icon={BugAntIcon} color="purple" />
              <MetricCard title="Abertos" value={metrics.problem.open} icon={ExclamationTriangleIcon} color="yellow" />
              <MetricCard title="Erros Conhecidos" value={metrics.problem.known_errors} icon={DocumentTextIcon} color="orange" />
              <MetricCard title="RCA Concluídas" value={metrics.problem.rca_completed} icon={CheckCircleIcon} color="green" />
              <MetricCard title="Workarounds" value={metrics.problem.workarounds_available} icon={CogIcon} color="blue" />
              <MetricCard title="Incidentes Vinculados" value={metrics.problem.linked_incidents} icon={BoltIcon} color="red" />
            </div>
          </div>
        </div>

        {/* Change Management & CMDB */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Change Management */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ArrowsRightLeftIcon className="w-5 h-5 text-indigo-600" />
              Gestão de Mudanças
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard title="Total" value={metrics.change.total} icon={ArrowsRightLeftIcon} color="indigo" />
              <MetricCard title="Aguardando CAB" value={metrics.change.pending_cab} icon={UserGroupIcon} color="purple" />
              <MetricCard title="Aprovadas" value={metrics.change.approved} icon={CheckCircleIcon} color="green" />
              <MetricCard title="Taxa de Sucesso" value={`${metrics.change.success_rate}%`} icon={ChartBarIcon} color="blue" />
              <MetricCard title="Emergências" value={metrics.change.emergency_changes} icon={FireIcon} color="red" />
              <MetricCard title="Agendadas" value={metrics.change.upcoming_changes} icon={CalendarIcon} color="yellow" />
            </div>
          </div>

          {/* CMDB */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CircleStackIcon className="w-5 h-5 text-blue-600" />
              CMDB
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard title="Total CIs" value={metrics.cmdb.total_cis} icon={CircleStackIcon} color="blue" />
              <MetricCard title="Operacionais" value={metrics.cmdb.operational} icon={CheckCircleIcon} color="green" />
              <MetricCard title="Críticos" value={metrics.cmdb.critical_cis} icon={ExclamationTriangleIcon} color="red" />
              <MetricCard title="Relacionamentos" value={metrics.cmdb.relationships} icon={BoltIcon} color="purple" />
              <div className="col-span-2">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Cobertura CMDB</span>
                    <span className="text-lg font-bold text-blue-600">{metrics.cmdb.coverage}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${metrics.cmdb.coverage}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
