'use client'

import { useState } from 'react'
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
  ChartBarIcon
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
  event: { label: 'Evento', icon: BoltIcon, color: 'bg-yellow-100 text-yellow-700' },
  schedule: { label: 'Agendado', icon: ClockIcon, color: 'bg-blue-100 text-blue-700' },
  condition: { label: 'Condição', icon: ArrowPathIcon, color: 'bg-purple-100 text-purple-700' }
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
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CpuChipIcon className="w-6 h-6 text-purple-600" />
                Automações
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Configure regras e automações para o workflow de tickets
              </p>
            </div>
            <button
              onClick={() => {
                setEditingAutomation(null)
                setShowModal(true)
              }}
              className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Nova Automação
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{automations.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Ativas</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {automations.filter(a => a.enabled).length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Execuções Hoje</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {automations.reduce((sum, a) => sum + a.executions_today, 0)}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Taxa de Sucesso</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {(automations.reduce((sum, a) => sum + a.success_rate, 0) / automations.length).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Automations List */}
        <div className="space-y-4">
          {automations.map((automation) => {
            const TriggerIcon = triggerTypes[automation.trigger_type].icon
            return (
              <div
                key={automation.id}
                className={`bg-white rounded-xl border transition-all ${
                  automation.enabled ? 'border-gray-200' : 'border-gray-200 opacity-60'
                }`}
              >
                {/* Automation Header */}
                <div
                  className="p-4 sm:p-6 cursor-pointer"
                  onClick={() => toggleAutomation(automation.id)}
                >
                  <div className="flex items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className={`p-1.5 rounded-lg ${triggerTypes[automation.trigger_type].color}`}>
                          <TriggerIcon className="w-4 h-4" />
                        </div>
                        <h3 className="font-semibold text-gray-900">{automation.name}</h3>
                        {automation.enabled ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <CheckCircleIcon className="w-3 h-3" />
                            Ativa
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium flex items-center gap-1">
                            <PauseIcon className="w-3 h-3" />
                            Pausada
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{automation.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500 mr-4">
                        <div className="text-center">
                          <div className="text-xs">Hoje</div>
                          <div className="font-semibold text-gray-900">{automation.executions_today}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs">Sucesso</div>
                          <div className={`font-semibold ${automation.success_rate >= 95 ? 'text-green-600' : automation.success_rate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {automation.success_rate}%
                          </div>
                        </div>
                      </div>
                      {expandedAutomation === automation.id ? (
                        <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Mobile Stats */}
                  <div className="flex sm:hidden items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>Execuções hoje: {automation.executions_today}</span>
                    <span>Sucesso: {automation.success_rate}%</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedAutomation === automation.id && (
                  <div className="border-t border-gray-100 p-4 sm:p-6 bg-gray-50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      {/* Trigger */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <BoltIcon className="w-4 h-4 text-yellow-500" />
                          Gatilho
                        </h4>
                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${triggerTypes[automation.trigger_type].color}`}>
                              {triggerTypes[automation.trigger_type].label}
                            </span>
                          </div>
                          {automation.trigger_config.event && (
                            <div className="text-sm text-gray-700">
                              Evento: <span className="font-medium">{automation.trigger_config.event}</span>
                            </div>
                          )}
                          {automation.trigger_config.schedule && (
                            <div className="text-sm text-gray-700">
                              Cron: <span className="font-mono">{automation.trigger_config.schedule}</span>
                            </div>
                          )}
                          {automation.trigger_config.condition && (
                            <div className="text-sm text-gray-700">
                              Condição: <span className="font-medium">{automation.trigger_config.condition}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <PlayIcon className="w-4 h-4 text-green-500" />
                          Ações ({automation.actions.length})
                        </h4>
                        <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-2">
                          {automation.actions.map((action, index) => {
                            const actionDef = actionTypes.find(a => a.id === action.type)
                            return (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <span>{actionDef?.icon || '⚙️'}</span>
                                <span className="text-gray-700">{actionDef?.name || action.type}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Execution Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                        <div className="text-xs text-gray-500">Última Execução</div>
                        <div className="text-sm font-medium text-gray-900 mt-1">
                          {formatLastExecution(automation.last_execution)}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                        <div className="text-xs text-gray-500">Execuções Hoje</div>
                        <div className="text-sm font-medium text-gray-900 mt-1">
                          {automation.executions_today}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                        <div className="text-xs text-gray-500">Taxa de Sucesso</div>
                        <div className={`text-sm font-medium mt-1 ${
                          automation.success_rate >= 95 ? 'text-green-600' :
                          automation.success_rate >= 80 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {automation.success_rate}%
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                        <div className="text-xs text-gray-500">Criado em</div>
                        <div className="text-sm font-medium text-gray-900 mt-1">
                          {automation.created_at}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleEnabled(automation.id)
                        }}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm ${
                          automation.enabled
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
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
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2 text-sm disabled:opacity-50"
                      >
                        {testingId === automation.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
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
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicate(automation)
                        }}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        Duplicar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(automation.id)
                        }}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2 text-sm"
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
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CpuChipIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma automação configurada</h3>
            <p className="text-gray-600 mb-4">
              Crie automações para otimizar o workflow de tickets
            </p>
            <button
              onClick={() => {
                setEditingAutomation(null)
                setShowModal(true)
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
            >
              Criar Primeira Automação
            </button>
          </div>
        )}

        {/* Execution Log Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mt-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-gray-400" />
            Resumo de Execuções (Últimas 24h)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircleIcon className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">
                {automations.reduce((sum, a) => sum + Math.round(a.executions_today * a.success_rate / 100), 0)}
              </div>
              <div className="text-sm text-green-700">Execuções com Sucesso</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <XCircleIcon className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-red-600">
                {automations.reduce((sum, a) => sum + Math.round(a.executions_today * (100 - a.success_rate) / 100), 0)}
              </div>
              <div className="text-sm text-red-700">Execuções com Falha</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-yellow-600">
                {automations.filter(a => a.success_rate < 90).length}
              </div>
              <div className="text-sm text-yellow-700">Automações com Problemas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingAutomation ? 'Editar Automação' : 'Nova Automação'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  defaultValue={editingAutomation?.name || ''}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Nome da automação"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  defaultValue={editingAutomation?.description || ''}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="O que esta automação faz?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Gatilho *
                </label>
                <select
                  defaultValue={editingAutomation?.trigger_type || 'event'}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="event">Evento</option>
                  <option value="schedule">Agendado (Cron)</option>
                  <option value="condition">Condição</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evento *
                </label>
                <select
                  defaultValue={editingAutomation?.trigger_config.event || 'ticket.created'}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {eventOptions.map(event => (
                    <option key={event.id} value={event.id}>{event.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Ações
                </label>
                <div className="space-y-2">
                  {actionTypes.slice(0, 6).map(action => (
                    <label key={action.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <input type="checkbox" className="w-4 h-4 text-purple-600 rounded" />
                      <span>{action.icon}</span>
                      <span className="text-sm text-gray-700">{action.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
              >
                {editingAutomation ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
