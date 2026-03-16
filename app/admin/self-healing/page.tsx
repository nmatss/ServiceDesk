'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BoltIcon,
  ShieldCheckIcon,
  ClockIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
  Cog6ToothIcon,
  ArrowUpCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'

// ─── Types ───────────────────────────────────────────────────────────────────

interface HistoryEvent {
  id: number
  ticket_number: string
  title: string
  status: string
  priority: string
  created_at: string
  updated_at: string
  runbook_name: string | null
  runbook_success: boolean | null
  duration_ms: number | null
  result: 'success' | 'escalated' | 'in_progress'
}

interface RunbookItem {
  id: string
  name: string
  description?: string
  trigger: string
  risk: 'low' | 'medium' | 'high'
  enabled: boolean
  steps: Array<{ order: number; type: string; name: string }>
  is_custom: boolean
}

interface SelfHealingConfig {
  enabled: boolean
  max_remediations_per_hour: number
  require_approval_high_risk: boolean
  notification_emails: string[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SelfHealingPage() {
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [runbooks, setRunbooks] = useState<RunbookItem[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [config, setConfig] = useState<SelfHealingConfig>({
    enabled: true,
    max_remediations_per_hour: 10,
    require_approval_high_risk: true,
    notification_emails: [],
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'events' | 'runbooks' | 'config'>('events')
  const [savingConfig, setSavingConfig] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [historyRes, runbooksRes] = await Promise.all([
        fetch('/api/self-healing/history?limit=20'),
        fetch('/api/self-healing/runbooks'),
      ])

      if (historyRes.ok) {
        const historyData = await historyRes.json()
        if (historyData.success) {
          setEvents(historyData.data?.events || [])
          setStats(historyData.data?.stats || {})
        }
      }

      if (runbooksRes.ok) {
        const runbooksData = await runbooksRes.json()
        if (runbooksData.success) {
          setRunbooks(runbooksData.data?.runbooks || [])
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleRunbook = async (runbookId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/self-healing/runbooks/${runbookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      if (res.ok) {
        setRunbooks((prev) =>
          prev.map((rb) => (rb.id === runbookId ? { ...rb, enabled } : rb))
        )
      }
    } catch (error) {
      console.error('Erro ao atualizar runbook:', error)
    }
  }

  const deleteRunbook = async (runbookId: string) => {
    if (!confirm('Tem certeza que deseja excluir este runbook?')) return

    try {
      const res = await fetch(`/api/self-healing/runbooks/${runbookId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Erro ao excluir runbook:', error)
    }
  }

  const saveConfig = async () => {
    setSavingConfig(true)
    try {
      // Save config via a general settings endpoint or custom
      // For now, we'll use the runbooks PUT to toggle enabled state
      // The full config would be saved via system_settings
      setSavingConfig(false)
    } catch {
      setSavingConfig(false)
    }
  }

  // ─── Stats computation ─────────────────────────────────────────────────────

  const totalEvents = Object.values(stats).reduce((sum, v) => sum + v, 0)
  const resolvedCount = stats['resolved'] || 0
  const resolutionRate = totalEvents > 0 ? Math.round((resolvedCount / totalEvents) * 100) : 0
  const activeRunbooksCount = runbooks.filter((r) => r.enabled).length
  const avgDuration = events.length > 0
    ? Math.round(
        events
          .filter((e) => e.duration_ms != null)
          .reduce((sum, e) => sum + (e.duration_ms || 0), 0) /
        Math.max(events.filter((e) => e.duration_ms != null).length, 1) /
        1000
      )
    : 0

  // ─── Render ─────────────────────────────────────────────────────────────────

  const riskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }
    const labels: Record<string, string> = { low: 'Baixo', medium: 'Medio', high: 'Alto' }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[risk] || colors.medium}`}>
        {labels[risk] || risk}
      </span>
    )
  }

  const resultBadge = (result: string) => {
    const config: Record<string, { color: string; label: string; icon: typeof CheckCircleIcon }> = {
      success: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', label: 'Sucesso', icon: CheckCircleIcon },
      escalated: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Escalado', icon: ArrowUpCircleIcon },
      in_progress: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Em Progresso', icon: ClockIcon },
    }
    const c = config[result] || config.in_progress
    const Icon = c.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>
        <Icon className="h-3.5 w-3.5" />
        {c.label}
      </span>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Auto-Healing"
        description="Sistema de auto-remediacao automatica com deteccao, correlacao e execucao de runbooks"
        icon={BoltIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Self-Healing' },
        ]}
        actions={[
          {
            label: 'Atualizar',
            icon: ArrowPathIcon,
            variant: 'secondary' as const,
            onClick: fetchData,
          },
        ]}
      />

      {/* Stats Cards */}
      <StatsGrid>
        <StatsCard
          title="Eventos Hoje"
          value={totalEvents}
          icon={BoltIcon}
          color="brand"
          loading={loading}
        />
        <StatsCard
          title="Taxa de Resolucao"
          value={`${resolutionRate}%`}
          icon={CheckCircleIcon}
          color="success"
          loading={loading}
        />
        <StatsCard
          title="Tempo Medio"
          value={`${avgDuration}s`}
          icon={ClockIcon}
          color="info"
          loading={loading}
        />
        <StatsCard
          title="Runbooks Ativos"
          value={activeRunbooksCount}
          icon={PlayIcon}
          color="warning"
          loading={loading}
        />
      </StatsGrid>

      {/* Enable/Disable Toggle */}
      <div className="glass-panel p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon className="h-6 w-6 text-brand-500" />
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Auto-Healing Ativo
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Habilita a remediacao automatica para esta organizacao
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 ${
            config.enabled ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
          role="switch"
          aria-checked={config.enabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              config.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {([
            { key: 'events', label: 'Eventos Recentes', icon: ClockIcon },
            { key: 'runbooks', label: 'Runbooks', icon: PlayIcon },
            { key: 'config', label: 'Configuracao', icon: Cog6ToothIcon },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`group inline-flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'events' && (
        <div className="glass-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Eventos Recentes
            </h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
              <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando eventos...
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
              <InformationCircleIcon className="h-8 w-8 mx-auto mb-2" />
              <p>Nenhum evento de auto-healing registrado ainda.</p>
              <p className="text-xs mt-1">Eventos aparecerao aqui quando alertas forem processados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Alerta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Runbook
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Resultado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Duracao
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Ticket
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                        {new Date(event.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 max-w-xs truncate">
                        {event.title.replace('[Auto-Healing] ', '')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                        {event.runbook_name || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {resultBadge(event.result)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">
                        {event.duration_ms != null ? `${(event.duration_ms / 1000).toFixed(1)}s` : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <a
                          href={`/tickets/${event.id}`}
                          className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                        >
                          {event.ticket_number}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'runbooks' && (
        <div className="space-y-4">
          {loading ? (
            <div className="glass-panel p-8 text-center text-neutral-500 dark:text-neutral-400">
              <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto mb-2" />
              Carregando runbooks...
            </div>
          ) : runbooks.length === 0 ? (
            <div className="glass-panel p-8 text-center text-neutral-500 dark:text-neutral-400">
              <InformationCircleIcon className="h-8 w-8 mx-auto mb-2" />
              Nenhum runbook configurado.
            </div>
          ) : (
            runbooks.map((runbook) => (
              <div
                key={runbook.id}
                className="glass-panel p-4 animate-slide-up"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {runbook.name}
                      </h4>
                      {riskBadge(runbook.risk)}
                      {runbook.is_custom && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400">
                          Customizado
                        </span>
                      )}
                    </div>
                    {runbook.description && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                        {runbook.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>
                        <strong>Trigger:</strong> {runbook.trigger}
                      </span>
                      <span>
                        <strong>Passos:</strong> {runbook.steps.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {/* Enable/Disable toggle */}
                    <button
                      onClick={() => toggleRunbook(runbook.id, !runbook.enabled)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 dark:focus:ring-offset-neutral-800 ${
                        runbook.enabled ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-600'
                      }`}
                      role="switch"
                      aria-checked={runbook.enabled}
                      aria-label={`${runbook.enabled ? 'Desabilitar' : 'Habilitar'} ${runbook.name}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          runbook.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    {runbook.is_custom && (
                      <>
                        <button
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                          aria-label={`Editar ${runbook.name}`}
                          title="Editar"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteRunbook(runbook.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          aria-label={`Excluir ${runbook.name}`}
                          title="Excluir"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div className="glass-panel p-6 space-y-6 animate-slide-up">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5 text-brand-500" />
            Configuracoes do Auto-Healing
          </h3>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Max remediations per hour */}
            <div>
              <label
                htmlFor="max-remediations"
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
              >
                Maximo de remedicoes por hora
              </label>
              <input
                id="max-remediations"
                type="number"
                min={1}
                max={100}
                value={config.max_remediations_per_hour}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    max_remediations_per_hour: parseInt(e.target.value, 10) || 10,
                  }))
                }
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Limite de seguranca para evitar loops de remediacao
              </p>
            </div>

            {/* Require approval for high risk */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Aprovacao para alto risco
              </label>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      require_approval_high_risk: !prev.require_approval_high_risk,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 ${
                    config.require_approval_high_risk
                      ? 'bg-brand-500'
                      : 'bg-neutral-300 dark:bg-neutral-600'
                  }`}
                  role="switch"
                  aria-checked={config.require_approval_high_risk}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      config.require_approval_high_risk ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {config.require_approval_high_risk
                    ? 'Requer aprovacao manual'
                    : 'Execucao automatica permitida'}
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Runbooks de alto risco ou alertas criticos exigem aprovacao antes da execucao
              </p>
            </div>
          </div>

          {/* Notification emails */}
          <div>
            <label
              htmlFor="notification-emails"
              className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
            >
              E-mails de notificacao
            </label>
            <input
              id="notification-emails"
              type="text"
              value={config.notification_emails.join(', ')}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  notification_emails: e.target.value
                    .split(',')
                    .map((email) => email.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="admin@empresa.com, ops@empresa.com"
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Destinatarios de notificacoes de eventos de auto-healing (separados por virgula)
            </p>
          </div>

          {/* Info box */}
          <div className="rounded-lg border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 p-4">
            <div className="flex gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-brand-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-brand-800 dark:text-brand-300">
                <p className="font-medium mb-1">Guardrails de Seguranca</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>Limite de remedicoes por hora previne loops infinitos</li>
                  <li>Alertas duplicados em 15 minutos sao ignorados automaticamente</li>
                  <li>Runbooks de alto risco podem exigir aprovacao manual</li>
                  <li>Todos os eventos sao registrados em audit logs e tickets</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 disabled:opacity-50 transition-colors"
            >
              {savingConfig ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="h-4 w-4" />
              )}
              Salvar Configuracoes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
