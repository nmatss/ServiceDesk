'use client'

import { useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import {
  CpuChipIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  BoltIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  BeakerIcon,
  ChartBarIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'

interface Automation {
  id: string
  name: string
  description: string
  trigger_type: 'event' | 'schedule' | 'condition'
  trigger_config: {
    event?: string
    schedule?: string
    condition?: string
  }
  actions: {
    type: string
    config: Record<string, unknown>
  }[]
  enabled: boolean
  executions_today: number
  last_execution?: string
  success_rate: number
  created_at: string
}

const mockAutomations: Automation[] = [
  {
    id: '1',
    name: 'Auto-atribuição por categoria',
    description: 'Atribui tickets automaticamente ao agente especialista baseado na categoria',
    trigger_type: 'event',
    trigger_config: { event: 'ticket.created' },
    actions: [
      { type: 'assign_agent', config: { based_on: 'category_expertise' } },
      { type: 'send_notification', config: { to: 'agent', template: 'new_assignment' } }
    ],
    enabled: true,
    executions_today: 45,
    last_execution: '2024-12-14T10:30:00',
    success_rate: 98.5,
    created_at: '2024-01-15'
  },
  {
    id: '2',
    name: 'Escalonamento por SLA',
    description: 'Escalona tickets quando atingem 80% do tempo de SLA',
    trigger_type: 'condition',
    trigger_config: { condition: 'sla_warning' },
    actions: [
      { type: 'escalate', config: { level: 1 } },
      { type: 'send_notification', config: { to: 'manager', template: 'sla_warning' } },
      { type: 'add_tag', config: { tag: 'sla-risco' } }
    ],
    enabled: true,
    executions_today: 12,
    last_execution: '2024-12-14T09:45:00',
    success_rate: 100,
    created_at: '2024-01-20'
  },
  {
    id: '3',
    name: 'Fechamento automático de tickets',
    description: 'Fecha tickets resolvidos após 7 dias sem resposta do usuário',
    trigger_type: 'schedule',
    trigger_config: { schedule: '0 8 * * *' },
    actions: [
      { type: 'update_status', config: { status: 'closed' } },
      { type: 'send_notification', config: { to: 'requester', template: 'ticket_closed' } }
    ],
    enabled: true,
    executions_today: 8,
    last_execution: '2024-12-14T08:00:00',
    success_rate: 95.2,
    created_at: '2024-02-01'
  },
  {
    id: '4',
    name: 'Detecção de duplicados',
    description: 'Detecta e vincula tickets potencialmente duplicados via IA',
    trigger_type: 'event',
    trigger_config: { event: 'ticket.created' },
    actions: [
      { type: 'ai_detect_duplicates', config: { threshold: 0.8 } },
      { type: 'link_tickets', config: { type: 'duplicate' } },
      { type: 'add_internal_note', config: { content: 'Possível duplicado detectado' } }
    ],
    enabled: true,
    executions_today: 45,
    last_execution: '2024-12-14T10:30:00',
    success_rate: 87.3,
    created_at: '2024-02-15'
  },
  {
    id: '5',
    name: 'Classificação automática de prioridade',
    description: 'Usa IA para classificar prioridade baseado no conteúdo do ticket',
    trigger_type: 'event',
    trigger_config: { event: 'ticket.created' },
    actions: [
      { type: 'ai_classify', config: { model: 'priority-classifier' } },
      { type: 'update_priority', config: { based_on: 'ai_result' } }
    ],
    enabled: false,
    executions_today: 0,
    last_execution: '2024-12-10T15:20:00',
    success_rate: 92.1,
    created_at: '2024-03-01'
  }
]

const triggerTypes = {
  event: {
    label: 'Evento',
    icon: BoltIcon,
    color: 'bg-warning-50 text-warning-700 dark:bg-warning-950 dark:text-warning-400',
    iconColor: 'text-warning-500 dark:text-warning-400'
  },
  schedule: {
    label: 'Agendado',
    icon: ClockIcon,
    color: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400',
    iconColor: 'text-brand-500 dark:text-brand-400'
  },
  condition: {
    label: 'Condição',
    icon: ArrowPathIcon,
    color: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    iconColor: 'text-purple-500 dark:text-purple-400'
  }
}

const eventOptions = [
  { id: 'ticket.created', name: 'Ticket Criado' },
  { id: 'ticket.updated', name: 'Ticket Atualizado' },
  { id: 'ticket.assigned', name: 'Ticket Atribuído' },
  { id: 'ticket.status_changed', name: 'Status Alterado' },
  { id: 'ticket.priority_changed', name: 'Prioridade Alterada' },
  { id: 'ticket.comment_added', name: 'Comentário Adicionado' },
  { id: 'sla.warning', name: 'Alerta de SLA' },
  { id: 'sla.breached', name: 'SLA Violado' }
]

const actionTypes = [
  { id: 'assign_agent', name: 'Atribuir Agente', icon: '👤' },
  { id: 'update_status', name: 'Atualizar Status', icon: '🔄' },
  { id: 'update_priority', name: 'Atualizar Prioridade', icon: '⚡' },
  { id: 'add_tag', name: 'Adicionar Tag', icon: '🏷️' },
  { id: 'send_notification', name: 'Enviar Notificação', icon: '🔔' },
  { id: 'send_email', name: 'Enviar E-mail', icon: '📧' },
  { id: 'escalate', name: 'Escalonar', icon: '📈' },
  { id: 'add_internal_note', name: 'Adicionar Nota Interna', icon: '📝' },
  { id: 'ai_classify', name: 'Classificar via IA', icon: '🤖' },
  { id: 'ai_detect_duplicates', name: 'Detectar Duplicados (IA)', icon: '🔍' },
  { id: 'ai_suggest_solution', name: 'Sugerir Solução (IA)', icon: '💡' },
  { id: 'link_tickets', name: 'Vincular Tickets', icon: '🔗' },
  { id: 'webhook', name: 'Chamar Webhook', icon: '🌐' }
]

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>(mockAutomations)
  const [showModal, setShowModal] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null)
  const [expandedAutomation, setExpandedAutomation] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const toggleAutomation = (id: string) => {
    setExpandedAutomation(expandedAutomation === id ? null : id)
  }

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation)
    setShowModal(true)
  }

  const handleDuplicate = (automation: Automation) => {
    const newAutomation: Automation = {
      ...automation,
      id: Date.now().toString(),
      name: `${automation.name} (Cópia)`,
      enabled: false,
      executions_today: 0,
      last_execution: undefined,
      created_at: new Date().toISOString().split('T')[0]
    }
    setAutomations([...automations, newAutomation])
  }

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta automação?')) {
      setAutomations(automations.filter(a => a.id !== id))
    }
  }

  const toggleEnabled = (id: string) => {
    setAutomations(automations.map(a =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    ))
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setTestingId(null)
    alert('Teste executado com sucesso!')
  }

  const formatLastExecution = (date?: string) => {
    if (!date) return 'Nunca'
    const d = new Date(date)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-purple-50/20 to-neutral-50 dark:from-neutral-950 dark:via-purple-950/20 dark:to-neutral-950 pb-6">
      {/* Modern Header with PageHeader */}
      <div className="glass-panel border-b border-neutral-200/50 dark:border-neutral-700/50 backdrop-blur-lg bg-white/80 dark:bg-neutral-900/80 mb-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <PageHeader
            title="Automações"
            description="Configure regras e automações para o workflow de tickets"
            icon={CpuChipIcon}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'Configurações', href: '/admin/settings' },
              { label: 'Automações' }
            ]}
            actions={[
              {
                label: 'Nova Automação',
                icon: PlusIcon,
                variant: 'primary',
                onClick: () => {
                  setEditingAutomation(null)
                  setShowModal(true)
                }
              }
            ]}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Modern Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 animate-fade-in">
          <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-5 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-description">Total</div>
              <CpuChipIcon className="w-5 h-5 text-icon-muted group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">{automations.length}</div>
            <div className="text-xs text-muted-content mt-1">automações configuradas</div>
          </div>

          <div className="glass-panel rounded-xl border border-success-200/50 dark:border-success-700/50 p-4 sm:p-5 bg-gradient-to-br from-success-50/50 to-white/80 dark:from-success-950/30 dark:to-neutral-900/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-success-700 dark:text-success-400">Ativas</div>
              <CheckCircleIcon className="w-5 h-5 text-success-500 dark:text-success-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-success-700 dark:text-success-400">
              {automations.filter(a => a.enabled).length}
            </div>
            <div className="text-xs text-success-600 dark:text-success-500 mt-1">em execução</div>
          </div>

          <div className="glass-panel rounded-xl border border-brand-200/50 dark:border-brand-700/50 p-4 sm:p-5 bg-gradient-to-br from-brand-50/50 to-white/80 dark:from-brand-950/30 dark:to-neutral-900/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-brand-700 dark:text-brand-400">Execuções Hoje</div>
              <PlayIcon className="w-5 h-5 text-brand-500 dark:text-brand-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-brand-700 dark:text-brand-400">
              {automations.reduce((sum, a) => sum + a.executions_today, 0)}
            </div>
            <div className="text-xs text-brand-600 dark:text-brand-500 mt-1">ações executadas</div>
          </div>

          <div className="glass-panel rounded-xl border border-purple-200/50 dark:border-purple-700/50 p-4 sm:p-5 bg-gradient-to-br from-purple-50/50 to-white/80 dark:from-purple-950/30 dark:to-neutral-900/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:scale-105 group">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-purple-700 dark:text-purple-400">Taxa de Sucesso</div>
              <ChartBarIcon className="w-5 h-5 text-purple-500 dark:text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-400">
              {(automations.reduce((sum, a) => sum + a.success_rate, 0) / automations.length).toFixed(1)}%
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-500 mt-1">média geral</div>
          </div>
        </div>

        {/* Modern Automations List */}
        <div className="space-y-4 animate-slide-up">
          {automations.map((automation, index) => {
            const TriggerIcon = triggerTypes[automation.trigger_type].icon
            return (
              <div
                key={automation.id}
                className={`glass-panel rounded-xl border transition-all duration-300 hover:shadow-xl ${
                  automation.enabled
                    ? 'border-neutral-200/50 dark:border-neutral-700/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm'
                    : 'border-neutral-200/30 dark:border-neutral-700/30 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm opacity-70'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Automation Header */}
                <div
                  className="p-4 sm:p-6 cursor-pointer hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors rounded-t-xl"
                  onClick={() => toggleAutomation(automation.id)}
                >
                  <div className="flex items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className={`p-2 rounded-lg ${triggerTypes[automation.trigger_type].color} shadow-sm`}>
                          <TriggerIcon className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{automation.name}</h3>
                        {automation.enabled ? (
                          <span className="px-2.5 py-1 bg-success-100 dark:bg-success-950 text-success-700 dark:text-success-400 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Ativa
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 text-description rounded-full text-xs font-medium flex items-center gap-1.5 shadow-sm">
                            <PauseIcon className="w-3.5 h-3.5" />
                            Pausada
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-description mt-2">{automation.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-4 text-sm text-muted-content mr-2">
                        <div className="text-center px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                          <div className="text-xs font-medium text-muted-content">Hoje</div>
                          <div className="font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">{automation.executions_today}</div>
                        </div>
                        <div className="text-center px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
                          <div className="text-xs font-medium text-muted-content">Sucesso</div>
                          <div className={`font-bold mt-0.5 ${
                            automation.success_rate >= 95
                              ? 'text-success-600 dark:text-success-400'
                              : automation.success_rate >= 80
                              ? 'text-warning-600 dark:text-warning-400'
                              : 'text-error-600 dark:text-error-400'
                          }`}>
                            {automation.success_rate}%
                          </div>
                        </div>
                      </div>
                      {expandedAutomation === automation.id ? (
                        <ChevronUpIcon className="w-5 h-5 text-icon-muted transition-transform" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5 text-icon-muted transition-transform" />
                      )}
                    </div>
                  </div>

                  {/* Mobile Stats */}
                  <div className="flex sm:hidden items-center gap-3 mt-4 text-xs">
                    <span className="px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium">
                      Execuções hoje: {automation.executions_today}
                    </span>
                    <span className="px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium">
                      Sucesso: {automation.success_rate}%
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedAutomation === automation.id && (
                  <div className="border-t border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 bg-gradient-to-br from-neutral-50/50 to-white/50 dark:from-neutral-800/50 dark:to-neutral-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      {/* Trigger */}
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                          <BoltIcon className={`w-5 h-5 ${triggerTypes[automation.trigger_type].iconColor}`} />
                          Gatilho
                        </h4>
                        <div className="glass-panel rounded-lg p-4 border border-neutral-200/50 dark:border-neutral-700/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`px-3 py-1 rounded-lg text-xs font-medium ${triggerTypes[automation.trigger_type].color} shadow-sm`}>
                              {triggerTypes[automation.trigger_type].label}
                            </span>
                          </div>
                          {automation.trigger_config.event && (
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="text-muted-content">Evento:</span>{' '}
                              <span className="font-semibold">{automation.trigger_config.event}</span>
                            </div>
                          )}
                          {automation.trigger_config.schedule && (
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="text-muted-content">Cron:</span>{' '}
                              <span className="font-mono font-semibold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">{automation.trigger_config.schedule}</span>
                            </div>
                          )}
                          {automation.trigger_config.condition && (
                            <div className="text-sm text-neutral-700 dark:text-neutral-300">
                              <span className="text-muted-content">Condição:</span>{' '}
                              <span className="font-semibold">{automation.trigger_config.condition}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                          <PlayIcon className="w-5 h-5 text-success-500 dark:text-success-400" />
                          Ações ({automation.actions.length})
                        </h4>
                        <div className="glass-panel rounded-lg p-4 border border-neutral-200/50 dark:border-neutral-700/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm space-y-2">
                          {automation.actions.map((action, index) => {
                            const actionDef = actionTypes.find(a => a.id === action.type)
                            return (
                              <div key={index} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                                <span className="text-lg">{actionDef?.icon || '⚙️'}</span>
                                <span className="text-neutral-700 dark:text-neutral-300 font-medium">{actionDef?.name || action.type}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Execution Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      <div className="glass-panel rounded-lg p-3 sm:p-4 border border-neutral-200/50 dark:border-neutral-700/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm text-center hover:shadow-md transition-shadow">
                        <div className="text-xs font-medium text-muted-content">Última Execução</div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-1.5">
                          {formatLastExecution(automation.last_execution)}
                        </div>
                      </div>
                      <div className="glass-panel rounded-lg p-3 sm:p-4 border border-brand-200/50 dark:border-brand-700/50 bg-gradient-to-br from-brand-50/50 to-white/80 dark:from-brand-950/30 dark:to-neutral-900/80 backdrop-blur-sm text-center hover:shadow-md transition-shadow">
                        <div className="text-xs font-medium text-brand-600 dark:text-brand-400">Execuções Hoje</div>
                        <div className="text-sm font-semibold text-brand-700 dark:text-brand-300 mt-1.5">
                          {automation.executions_today}
                        </div>
                      </div>
                      <div className="glass-panel rounded-lg p-3 sm:p-4 border border-neutral-200/50 dark:border-neutral-700/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm text-center hover:shadow-md transition-shadow">
                        <div className="text-xs font-medium text-muted-content">Taxa de Sucesso</div>
                        <div className={`text-sm font-semibold mt-1.5 ${
                          automation.success_rate >= 95
                            ? 'text-success-600 dark:text-success-400'
                            : automation.success_rate >= 80
                            ? 'text-warning-600 dark:text-warning-400'
                            : 'text-error-600 dark:text-error-400'
                        }`}>
                          {automation.success_rate}%
                        </div>
                      </div>
                      <div className="glass-panel rounded-lg p-3 sm:p-4 border border-neutral-200/50 dark:border-neutral-700/50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm text-center hover:shadow-md transition-shadow">
                        <div className="text-xs font-medium text-muted-content">Criado em</div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mt-1.5">
                          {automation.created_at}
                        </div>
                      </div>
                    </div>

                    {/* Modern Action Buttons */}
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleEnabled(automation.id)
                        }}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 ${
                          automation.enabled
                            ? 'bg-warning-100 dark:bg-warning-950 text-warning-700 dark:text-warning-400 hover:bg-warning-200 dark:hover:bg-warning-900 border border-warning-200 dark:border-warning-800'
                            : 'bg-success-100 dark:bg-success-950 text-success-700 dark:text-success-400 hover:bg-success-200 dark:hover:bg-success-900 border border-success-200 dark:border-success-800'
                        }`}
                      >
                        {automation.enabled ? (
                          <>
                            <PauseIcon className="w-4 h-4" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <PlayIcon className="w-4 h-4" />
                            Ativar
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTest(automation.id)
                        }}
                        disabled={testingId === automation.id}
                        className="px-4 py-2 bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-400 rounded-lg hover:bg-brand-200 dark:hover:bg-brand-900 border border-brand-200 dark:border-brand-800 flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testingId === automation.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-700 dark:border-brand-400"></div>
                            Testando...
                          </>
                        ) : (
                          <>
                            <BeakerIcon className="w-4 h-4" />
                            Testar
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(automation)
                        }}
                        className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicate(automation)
                        }}
                        className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        Duplicar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(automation.id)
                        }}
                        className="px-4 py-2 bg-error-100 dark:bg-error-950 text-error-700 dark:text-error-400 rounded-lg hover:bg-error-200 dark:hover:bg-error-900 border border-error-200 dark:border-error-800 flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {automations.length === 0 && (
          <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-8 sm:p-12 text-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-lg animate-fade-in">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-brand-100 dark:from-purple-900/30 dark:to-brand-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md">
                <CpuChipIcon className="w-10 h-10 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Nenhuma automação configurada</h3>
              <p className="text-description mb-6">
                Crie automações inteligentes para otimizar o workflow de tickets e aumentar a produtividade da equipe
              </p>
              <button
                onClick={() => {
                  setEditingAutomation(null)
                  setShowModal(true)
                }}
                className="btn btn-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Criar Primeira Automação
              </button>
            </div>
          </div>
        )}

        {/* Modern Execution Log Summary */}
        <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 p-4 sm:p-6 mt-6 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-lg animate-fade-in">
          <h2 className="font-bold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
            <ChartBarIcon className="w-6 h-6 text-purple-500 dark:text-purple-400" />
            Resumo de Execuções (Últimas 24h)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-5 sm:p-6 glass-panel rounded-xl border border-success-200/50 dark:border-success-700/50 bg-gradient-to-br from-success-50/50 to-white/80 dark:from-success-950/30 dark:to-neutral-900/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300 group">
              <CheckCircleIcon className="w-10 h-10 text-success-500 dark:text-success-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <div className="text-3xl font-bold text-success-600 dark:text-success-400">
                {automations.reduce((sum, a) => sum + Math.round(a.executions_today * a.success_rate / 100), 0)}
              </div>
              <div className="text-sm font-medium text-success-700 dark:text-success-500 mt-2">Execuções com Sucesso</div>
            </div>
            <div className="text-center p-5 sm:p-6 glass-panel rounded-xl border border-error-200/50 dark:border-error-700/50 bg-gradient-to-br from-error-50/50 to-white/80 dark:from-error-950/30 dark:to-neutral-900/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300 group">
              <XCircleIcon className="w-10 h-10 text-error-500 dark:text-error-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <div className="text-3xl font-bold text-error-600 dark:text-error-400">
                {automations.reduce((sum, a) => sum + Math.round(a.executions_today * (100 - a.success_rate) / 100), 0)}
              </div>
              <div className="text-sm font-medium text-error-700 dark:text-error-500 mt-2">Execuções com Falha</div>
            </div>
            <div className="text-center p-5 sm:p-6 glass-panel rounded-xl border border-warning-200/50 dark:border-warning-700/50 bg-gradient-to-br from-warning-50/50 to-white/80 dark:from-warning-950/30 dark:to-neutral-900/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300 group">
              <ExclamationTriangleIcon className="w-10 h-10 text-warning-500 dark:text-warning-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
              <div className="text-3xl font-bold text-warning-600 dark:text-warning-400">
                {automations.filter(a => a.success_rate < 90).length}
              </div>
              <div className="text-sm font-medium text-warning-700 dark:text-warning-500 mt-2">Automações com Problemas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg shadow-2xl border border-neutral-200/50 dark:border-neutral-700/50 animate-scale-in">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-neutral-200/50 dark:border-neutral-700/50 bg-gradient-to-r from-purple-50/50 to-brand-50/50 dark:from-purple-950/30 dark:to-brand-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-brand-500 rounded-xl flex items-center justify-center shadow-md">
                    <CpuChipIcon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {editingAutomation ? 'Editar Automação' : 'Nova Automação'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-muted-content" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Nome da Automação *
                </label>
                <input
                  type="text"
                  defaultValue={editingAutomation?.name || ''}
                  className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all shadow-sm"
                  placeholder="Ex: Auto-atribuição por categoria"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Descrição
                </label>
                <textarea
                  defaultValue={editingAutomation?.description || ''}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all shadow-sm resize-none"
                  placeholder="Descreva o que esta automação faz..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Tipo de Gatilho *
                </label>
                <select
                  defaultValue={editingAutomation?.trigger_type || 'event'}
                  className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all shadow-sm"
                >
                  <option value="event">Evento (acionado por ação do sistema)</option>
                  <option value="schedule">Agendado (executa em horários específicos)</option>
                  <option value="condition">Condição (acionado quando condição é satisfeita)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  Evento do Sistema *
                </label>
                <select
                  defaultValue={editingAutomation?.trigger_config.event || 'ticket.created'}
                  className="w-full px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all shadow-sm"
                >
                  {eventOptions.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                  Ações a Executar
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {actionTypes.slice(0, 8).map(action => (
                    <label
                      key={action.id}
                      className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors border border-neutral-200/50 dark:border-neutral-700/50"
                    >
                      <input type="checkbox" className="w-4 h-4 text-purple-600 dark:text-purple-500 rounded border-neutral-300 dark:border-neutral-600 focus:ring-purple-500 dark:focus:ring-purple-400" />
                      <span className="text-lg">{action.icon}</span>
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{action.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-neutral-200/50 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/50 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 shadow-sm hover:shadow-md transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-brand-600 dark:from-purple-500 dark:to-brand-500 text-white rounded-lg font-medium hover:from-purple-700 hover:to-brand-700 dark:hover:from-purple-600 dark:hover:to-brand-600 shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                {editingAutomation ? (
                  <>
                    <CheckCircleIcon className="w-5 h-5" />
                    Salvar Alterações
                  </>
                ) : (
                  <>
                    <PlusIcon className="w-5 h-5" />
                    Criar Automação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
