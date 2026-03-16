'use client'

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/monitoring/logger'
import { customToast } from '@/components/ui/toast'
import {
  CpuChipIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  ShieldCheckIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentConfig {
  enabled: boolean
  allowedIntents: string[]
  dailyLimit: number
  maxPriority: number
  autoResolveMin: number
  suggestMin: number
  availableIntents: string[]
}

interface AgentStats {
  today: { total: number; resolved: number; suggested: number; escalated: number; resolutionRate: number }
  week: { total: number; resolved: number; resolutionRate: number }
  month: { total: number; resolved: number; resolutionRate: number }
  topIntents: { intent: string; count: number }[]
  actionBreakdown: { activity_type: string; count: number }[]
  recentActions: {
    id: number
    ticket_id: number
    activity_type: string
    description: string
    created_at: string
    ticket_title: string
  }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTENT_LABELS: Record<string, string> = {
  password_reset: 'Redefinição de Senha',
  account_unlock: 'Desbloqueio de Conta',
  access_request: 'Solicitação de Acesso',
  software_install: 'Instalação de Software',
  information_query: 'Consulta de Informação',
  troubleshooting: 'Troubleshooting',
  status_inquiry: 'Consulta de Status',
}

const ACTION_LABELS: Record<string, string> = {
  ai_auto_resolved: 'Resolvido Automaticamente',
  ai_suggestion_posted: 'Sugestão Postada',
  ai_escalated: 'Escalado',
}

const ACTION_COLORS: Record<string, string> = {
  ai_auto_resolved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  ai_suggestion_posted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  ai_escalated: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Baixa',
  2: 'Baixa e Média',
  3: 'Baixa, Média e Alta',
  4: 'Todas (incluindo Crítica)',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIAgentPage() {
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'config'>('overview')

  // Draft config for editing
  const [draftConfig, setDraftConfig] = useState<AgentConfig | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [configRes, statsRes] = await Promise.all([
        fetch('/api/ai/agent/config', { credentials: 'include' }),
        fetch('/api/ai/agent/stats', { credentials: 'include' }),
      ])

      if (configRes.ok) {
        const configData = await configRes.json()
        const cfg = configData.data ?? configData
        setConfig(cfg)
        setDraftConfig(cfg)
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.data ?? statsData)
      }
    } catch (error) {
      logger.error('Erro ao buscar dados do Agente AI', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    if (!draftConfig) return
    setSaving(true)
    try {
      const res = await fetch('/api/ai/agent/config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftConfig),
      })
      if (res.ok) {
        setConfig(draftConfig)
        customToast.success('Configuração salva com sucesso!')
      } else {
        const data = await res.json()
        customToast.error(data.error ?? 'Erro ao salvar configuração')
      }
    } catch {
      customToast.error('Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  const toggleIntent = (intent: string) => {
    if (!draftConfig) return
    const current = draftConfig.allowedIntents ?? []
    const next = current.includes(intent)
      ? current.filter(i => i !== intent)
      : [...current, intent]
    setDraftConfig({ ...draftConfig, allowedIntents: next })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <PageHeader
          title="Agente AI Autônomo"
          description="Resolução inteligente de tickets L1 sem intervenção humana"
          icon={CpuChipIcon}
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Agente AI' },
          ]}
          actions={[
            {
              label: 'Atualizar',
              onClick: () => { setLoading(true); fetchData() },
              icon: ArrowPathIcon,
              variant: 'ghost',
            },
          ]}
        />

        {/* Tabs */}
        <div className="glass-panel p-1 flex space-x-2 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Abas do Agente AI">
          {[
            { id: 'overview' as const, name: 'Visão Geral', icon: ChartBarIcon },
            { id: 'config' as const, name: 'Configuração', icon: Cog6ToothIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-label={`Aba ${tab.name}`}
              aria-selected={activeTab === tab.id}
              role="tab"
              className={`
                flex-1 flex items-center justify-center space-x-2 px-4 sm:px-6 py-3 rounded-lg font-medium text-sm
                transition-all duration-300 whitespace-nowrap min-w-fit min-h-[44px]
                ${activeTab === tab.id
                  ? 'bg-gradient-brand text-white shadow-medium'
                  : 'text-description hover:text-brand-600 dark:hover:text-brand-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }
              `}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="glass-panel text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-200 border-t-brand-600"></div>
            <p className="mt-6 text-base text-description font-medium">Carregando dados do Agente AI...</p>
          </div>
        ) : (
          <>
            {/* ============================================================ */}
            {/* OVERVIEW TAB                                                  */}
            {/* ============================================================ */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-8">
                {/* Status Badge */}
                <div className="glass-panel p-4 flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${config?.enabled ? 'bg-green-500 animate-pulse' : 'bg-neutral-400'}`} />
                  <span className="text-sm font-medium text-primary">
                    {config?.enabled ? 'Agente AI ativo' : 'Agente AI desativado'}
                  </span>
                </div>

                {/* Stats Cards */}
                <StatsGrid cols={4}>
                  <StatsCard
                    title="Resolvidos Hoje"
                    value={stats.today.resolved}
                    icon={CheckCircleIcon}
                    color="success"
                    description={`de ${stats.today.total} processados`}
                  />
                  <StatsCard
                    title="Taxa de Resolução"
                    value={`${stats.today.resolutionRate}%`}
                    icon={ArrowTrendingUpIcon}
                    color="brand"
                    description="hoje"
                  />
                  <StatsCard
                    title="Escalados Hoje"
                    value={stats.today.escalated}
                    icon={ExclamationTriangleIcon}
                    color="warning"
                    description={`${stats.today.suggested} sugestões`}
                  />
                  <StatsCard
                    title="Resolvidos (Mês)"
                    value={stats.month.resolved}
                    icon={ClockIcon}
                    color="info"
                    description={`${stats.month.resolutionRate}% taxa mensal`}
                  />
                </StatsGrid>

                {/* Period Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Hoje', data: stats.today },
                    { label: 'Semana', data: stats.week },
                    { label: 'Mês', data: stats.month },
                  ].map(({ label, data }) => (
                    <div key={label} className="glass-panel p-6">
                      <h3 className="text-sm font-medium text-description mb-4">{label}</h3>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-bold text-primary">{data.resolved}</p>
                          <p className="text-sm text-description mt-1">resolvidos de {data.total}</p>
                        </div>
                        <div className={`text-2xl font-bold ${data.resolutionRate >= 70 ? 'text-green-600 dark:text-green-400' : data.resolutionRate >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                          {data.resolutionRate}%
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-4 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${data.resolutionRate >= 70 ? 'bg-green-500' : data.resolutionRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(data.resolutionRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Top Intents & Action Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Intents */}
                  <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                      <BoltIcon className="h-5 w-5 text-brand-500" />
                      Top Intenções Resolvidas
                    </h3>
                    {stats.topIntents.length === 0 ? (
                      <p className="text-sm text-description">Nenhum dado disponível ainda.</p>
                    ) : (
                      <div className="space-y-3">
                        {stats.topIntents.map((item) => (
                          <div key={item.intent} className="flex items-center justify-between">
                            <span className="text-sm text-primary">
                              {INTENT_LABELS[item.intent] ?? item.intent}
                            </span>
                            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                              {item.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Breakdown */}
                  <div className="glass-panel p-6">
                    <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                      <ChartBarIcon className="h-5 w-5 text-brand-500" />
                      Distribuição de Ações (Mês)
                    </h3>
                    {stats.actionBreakdown.length === 0 ? (
                      <p className="text-sm text-description">Nenhum dado disponível ainda.</p>
                    ) : (
                      <div className="space-y-3">
                        {stats.actionBreakdown.map((item) => {
                          const total = stats.actionBreakdown.reduce((s, i) => s + i.count, 0)
                          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
                          return (
                            <div key={item.activity_type}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-primary">
                                  {ACTION_LABELS[item.activity_type] ?? item.activity_type}
                                </span>
                                <span className="text-description">{item.count} ({pct}%)</span>
                              </div>
                              <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    item.activity_type === 'ai_auto_resolved'
                                      ? 'bg-green-500'
                                      : item.activity_type === 'ai_suggestion_posted'
                                        ? 'bg-yellow-500'
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Actions Table */}
                <div className="glass-panel p-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">Ações Recentes do Agente AI</h3>
                  {stats.recentActions.length === 0 ? (
                    <p className="text-sm text-description text-center py-8">Nenhuma ação registrada ainda.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 dark:border-neutral-700">
                            <th className="text-left py-3 px-4 font-medium text-description">Ticket</th>
                            <th className="text-left py-3 px-4 font-medium text-description">Ação</th>
                            <th className="text-left py-3 px-4 font-medium text-description">Detalhes</th>
                            <th className="text-left py-3 px-4 font-medium text-description">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentActions.map((action) => (
                            <tr key={action.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                              <td className="py-3 px-4">
                                <a
                                  href={`/tickets/${action.ticket_id}`}
                                  className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                                >
                                  #{action.ticket_id}
                                </a>
                                <p className="text-xs text-description mt-0.5 truncate max-w-[200px]">
                                  {action.ticket_title}
                                </p>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${ACTION_COLORS[action.activity_type] ?? 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'}`}>
                                  {ACTION_LABELS[action.activity_type] ?? action.activity_type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-description truncate max-w-[300px]">
                                {action.description}
                              </td>
                              <td className="py-3 px-4 text-description whitespace-nowrap">
                                {formatDate(action.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* CONFIG TAB                                                    */}
            {/* ============================================================ */}
            {activeTab === 'config' && draftConfig && (
              <div className="space-y-6">
                {/* Enable/Disable */}
                <div className="glass-panel p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                        <ShieldCheckIcon className="h-5 w-5 text-brand-500" />
                        Ativar Agente AI
                      </h3>
                      <p className="text-sm text-description mt-1">
                        Quando ativado, o agente processa automaticamente tickets L1 elegíveis.
                      </p>
                    </div>
                    <button
                      onClick={() => setDraftConfig({ ...draftConfig, enabled: !draftConfig.enabled })}
                      className={`
                        relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300
                        ${draftConfig.enabled ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-600'}
                      `}
                      role="switch"
                      aria-checked={draftConfig.enabled}
                      aria-label="Ativar ou desativar Agente AI"
                    >
                      <span
                        className={`
                          inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300
                          ${draftConfig.enabled ? 'translate-x-8' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                </div>

                {/* Confidence Thresholds */}
                <div className="glass-panel p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-primary">Limites de Confiança</h3>

                  {/* Auto-resolve threshold */}
                  <div>
                    <label className="flex justify-between text-sm font-medium text-primary mb-2">
                      <span>Resolver Automaticamente (min)</span>
                      <span className="text-brand-600 dark:text-brand-400 font-bold">{draftConfig.autoResolveMin}%</span>
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={draftConfig.autoResolveMin}
                      onChange={(e) => setDraftConfig({ ...draftConfig, autoResolveMin: Number(e.target.value) })}
                      className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                    <div className="flex justify-between text-xs text-description mt-1">
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Suggest threshold */}
                  <div>
                    <label className="flex justify-between text-sm font-medium text-primary mb-2">
                      <span>Sugerir Solução (min)</span>
                      <span className="text-brand-600 dark:text-brand-400 font-bold">{draftConfig.suggestMin}%</span>
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={draftConfig.autoResolveMin - 1}
                      value={Math.min(draftConfig.suggestMin, draftConfig.autoResolveMin - 1)}
                      onChange={(e) => setDraftConfig({ ...draftConfig, suggestMin: Number(e.target.value) })}
                      className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                    <div className="flex justify-between text-xs text-description mt-1">
                      <span>20%</span>
                      <span>{draftConfig.autoResolveMin - 1}%</span>
                    </div>
                  </div>

                  {/* Visual threshold guide */}
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 text-xs text-description space-y-1">
                    <p><span className="inline-block w-3 h-3 bg-green-500 rounded mr-2" /> <strong>{draftConfig.autoResolveMin}%+</strong> — Resolver automaticamente</p>
                    <p><span className="inline-block w-3 h-3 bg-yellow-500 rounded mr-2" /> <strong>{draftConfig.suggestMin}%–{draftConfig.autoResolveMin - 1}%</strong> — Postar sugestão</p>
                    <p><span className="inline-block w-3 h-3 bg-red-500 rounded mr-2" /> <strong>0–{draftConfig.suggestMin - 1}%</strong> — Escalar para humano</p>
                  </div>
                </div>

                {/* Allowed Intents */}
                <div className="glass-panel p-6">
                  <h3 className="text-lg font-semibold text-primary mb-4">Tipos de Intenção Permitidos</h3>
                  <p className="text-sm text-description mb-4">
                    Selecione quais tipos de solicitação o agente pode resolver automaticamente.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(draftConfig.availableIntents ?? Object.keys(INTENT_LABELS)).map((intent) => {
                      const checked = (draftConfig.allowedIntents ?? []).includes(intent)
                      return (
                        <label
                          key={intent}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200
                            ${checked
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-400'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-brand-300 dark:hover:border-brand-600'
                            }
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleIntent(intent)}
                            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-sm text-primary font-medium">
                            {INTENT_LABELS[intent] ?? intent}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Limits */}
                <div className="glass-panel p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-primary">Limites e Restrições</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Daily limit */}
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Limite Diário de Resoluções
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={draftConfig.dailyLimit}
                        onChange={(e) => setDraftConfig({ ...draftConfig, dailyLimit: Math.max(1, Math.min(500, Number(e.target.value))) })}
                        className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm text-primary focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                      />
                      <p className="text-xs text-description mt-1">Máximo de tickets que o agente pode resolver por dia (1–500)</p>
                    </div>

                    {/* Max priority */}
                    <div>
                      <label className="block text-sm font-medium text-primary mb-2">
                        Prioridade Máxima para Auto-Resolução
                      </label>
                      <select
                        value={draftConfig.maxPriority}
                        onChange={(e) => setDraftConfig({ ...draftConfig, maxPriority: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm text-primary focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
                      >
                        {[1, 2, 3, 4].map(v => (
                          <option key={v} value={v}>{PRIORITY_LABELS[v]}</option>
                        ))}
                      </select>
                      <p className="text-xs text-description mt-1">Tickets com prioridade acima deste nível serão escalados</p>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`
                      inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white text-sm
                      transition-all duration-300 shadow-medium
                      ${saving
                        ? 'bg-neutral-400 cursor-not-allowed'
                        : 'bg-gradient-brand hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                      }
                    `}
                  >
                    {saving ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Salvar Configuração
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
