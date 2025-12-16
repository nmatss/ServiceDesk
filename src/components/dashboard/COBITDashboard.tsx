'use client'

import { useState, useEffect } from 'react'
import {
  ChartBarIcon,
  ShieldCheckIcon,
  CogIcon,
  BoltIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface COBITMetrics {
  governance: {
    stakeholder_satisfaction: number
    value_realization: number
    risk_optimization: number
    resource_optimization: number
  }
  alignment: {
    strategy_alignment: number
    innovation_rate: number
    architecture_compliance: number
    budget_adherence: number
  }
  implementation: {
    project_success_rate: number
    change_success_rate: number
    deployment_frequency: number
    lead_time: number
  }
  delivery: {
    service_availability: number
    incident_resolution_rate: number
    first_contact_resolution: number
    sla_compliance: number
    mttr: number
    mtbf: number
  }
  monitoring: {
    control_effectiveness: number
    compliance_rate: number
    audit_findings_resolved: number
    security_incidents: number
  }
}

interface COBITData {
  success: boolean
  metrics: COBITMetrics
  maturity_level: number
  maturity_description: string
  trends: {
    sla_trend: number
    resolution_trend: number
    satisfaction_trend: number
  }
  period_days: number
}

const MetricCard = ({
  title,
  value,
  unit = '%',
  description,
  trend,
  color = 'blue'
}: {
  title: string
  value: number
  unit?: string
  description?: string
  trend?: number
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700'
  }

  const getValueColor = (val: number) => {
    if (val >= 90) return 'text-green-600'
    if (val >= 70) return 'text-blue-600'
    if (val >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const TrendIcon = trend && trend > 0 ? ArrowTrendingUpIcon : trend && trend < 0 ? ArrowTrendingDownIcon : MinusIcon

  return (
    <div className={`p-3 sm:p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-1 sm:mb-2">
        <h4 className="text-xs sm:text-sm font-medium truncate pr-2">{title}</h4>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 flex-shrink-0 ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'}`}>
            <TrendIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="text-[10px] sm:text-xs">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl sm:text-2xl md:text-3xl font-bold ${getValueColor(value)}`}>
          {value}
        </span>
        <span className="text-xs sm:text-sm text-gray-500">{unit}</span>
      </div>
      {description && (
        <p className="text-[10px] sm:text-xs text-gray-500 mt-1 line-clamp-2">{description}</p>
      )}
    </div>
  )
}

const MaturityGauge = ({ level, description }: { level: number; description: string }) => {
  const percentage = (level / 5) * 100

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-purple-600" />
        <span className="truncate">Nível de Maturidade COBIT</span>
      </h3>

      <div className="flex items-center gap-4 sm:gap-6">
        {/* Gauge */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={level >= 4 ? '#10B981' : level >= 3 ? '#3B82F6' : level >= 2 ? '#F59E0B' : '#EF4444'}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${percentage * 2.51} 251`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">{level}</span>
              <span className="text-xs sm:text-sm text-gray-500">/5</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                className={`h-2 flex-1 rounded-full ${
                  lvl <= level
                    ? level >= 4 ? 'bg-green-500' : level >= 3 ? 'bg-blue-500' : level >= 2 ? 'bg-yellow-500' : 'bg-red-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs sm:text-sm text-gray-600 line-clamp-3 sm:line-clamp-none">{description}</p>
        </div>
      </div>
    </div>
  )
}

const DomainSection = ({
  title,
  icon: Icon,
  color,
  children
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  children: React.ReactNode
}) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
      <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
        <div className={`p-1.5 sm:p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <span className="truncate">{title}</span>
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
        {children}
      </div>
    </div>
  )
}

export default function COBITDashboard() {
  const [data, setData] = useState<COBITData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    fetchData()
  }, [period])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/analytics/cobit?period=${period}`)
      const result = await response.json()

      if (result.success) {
        setData(result)
        setError(null)
      } else {
        setError(result.error || 'Erro ao carregar métricas')
      }
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center px-4">
          <ExclamationTriangleIcon className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 sm:mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { metrics, maturity_level, maturity_description, trends } = data

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
            Dashboard COBIT 2019
          </h2>
          <p className="text-xs sm:text-sm text-gray-600">
            Métricas de governança e gestão de TI
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Último ano</option>
        </select>
      </div>

      {/* Maturity Level */}
      <MaturityGauge level={maturity_level} description={maturity_description} />

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Disponibilidade"
          value={metrics.delivery.service_availability}
          description="Uptime dos serviços"
          trend={trends.sla_trend}
          color="green"
        />
        <MetricCard
          title="SLA"
          value={metrics.delivery.sla_compliance}
          description="Conformidade com SLA"
          trend={trends.sla_trend}
          color="blue"
        />
        <MetricCard
          title="Satisfação"
          value={metrics.governance.stakeholder_satisfaction}
          description="Satisfação das partes interessadas"
          trend={trends.satisfaction_trend}
          color="purple"
        />
        <MetricCard
          title="Mudanças"
          value={metrics.implementation.change_success_rate}
          description="Taxa de sucesso em mudanças"
          color="yellow"
        />
      </div>

      {/* COBIT Domains */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* EDM - Governance */}
        <DomainSection title="EDM - Governança" icon={ShieldCheckIcon} color="purple">
          <MetricCard
            title="Satisfação"
            value={metrics.governance.stakeholder_satisfaction}
            color="purple"
          />
          <MetricCard
            title="Valor Realizado"
            value={metrics.governance.value_realization}
            color="purple"
          />
          <MetricCard
            title="Otimização de Risco"
            value={metrics.governance.risk_optimization}
            color="purple"
          />
          <MetricCard
            title="Otimização de Recursos"
            value={metrics.governance.resource_optimization}
            color="purple"
          />
        </DomainSection>

        {/* DSS - Delivery */}
        <DomainSection title="DSS - Entrega de Serviços" icon={BoltIcon} color="green">
          <MetricCard
            title="Disponibilidade"
            value={metrics.delivery.service_availability}
            color="green"
          />
          <MetricCard
            title="Resolução de Incidentes"
            value={metrics.delivery.incident_resolution_rate}
            color="green"
          />
          <MetricCard
            title="FCR"
            value={metrics.delivery.first_contact_resolution}
            description="Resolução no 1º contato"
            color="green"
          />
          <MetricCard
            title="MTTR"
            value={metrics.delivery.mttr}
            unit="h"
            description="Tempo médio de resolução"
            color="green"
          />
        </DomainSection>

        {/* BAI - Implementation */}
        <DomainSection title="BAI - Implementação" icon={CogIcon} color="blue">
          <MetricCard
            title="Sucesso em Projetos"
            value={metrics.implementation.project_success_rate}
            color="blue"
          />
          <MetricCard
            title="Sucesso em Mudanças"
            value={metrics.implementation.change_success_rate}
            color="blue"
          />
          <MetricCard
            title="Deploys/Semana"
            value={metrics.implementation.deployment_frequency}
            unit=""
            color="blue"
          />
          <MetricCard
            title="Lead Time"
            value={metrics.implementation.lead_time}
            unit="dias"
            color="blue"
          />
        </DomainSection>

        {/* MEA - Monitoring */}
        <DomainSection title="MEA - Monitoramento" icon={ClipboardDocumentCheckIcon} color="yellow">
          <MetricCard
            title="Eficácia de Controles"
            value={metrics.monitoring.control_effectiveness}
            color="yellow"
          />
          <MetricCard
            title="Conformidade"
            value={metrics.monitoring.compliance_rate}
            color="yellow"
          />
          <MetricCard
            title="Auditorias Resolvidas"
            value={metrics.monitoring.audit_findings_resolved}
            color="yellow"
          />
          <MetricCard
            title="Incidentes de Segurança"
            value={metrics.monitoring.security_incidents}
            unit=""
            description="No período"
            color="yellow"
          />
        </DomainSection>
      </div>

      {/* MTBF/MTTR Detail */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">
          Métricas de Confiabilidade
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-500">MTBF</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.delivery.mtbf}h</p>
            <p className="text-[10px] sm:text-xs text-gray-500">Tempo entre falhas</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-500">MTTR</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.delivery.mttr}h</p>
            <p className="text-[10px] sm:text-xs text-gray-500">Tempo de resolução</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-500">Disponibilidade</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{metrics.delivery.service_availability}%</p>
            <p className="text-[10px] sm:text-xs text-gray-500">Uptime calculado</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-500">SLA Compliance</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{metrics.delivery.sla_compliance}%</p>
            <p className="text-[10px] sm:text-xs text-gray-500">Meta: 95%</p>
          </div>
        </div>
      </div>
    </div>
  )
}
