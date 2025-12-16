'use client'

import { useState } from 'react'
import {
  ClockIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  BellIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'

interface SLAPolicy {
  id: string
  name: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  response_time: number
  resolution_time: number
  escalation_enabled: boolean
  business_hours_only: boolean
  active: boolean
  created_at: string
}

const mockPolicies: SLAPolicy[] = [
  {
    id: '1',
    name: 'SLA Crítico',
    description: 'Para tickets de prioridade crítica com impacto alto nos negócios',
    priority: 'critical',
    response_time: 15,
    resolution_time: 120,
    escalation_enabled: true,
    business_hours_only: false,
    active: true,
    created_at: '2024-01-15'
  },
  {
    id: '2',
    name: 'SLA Alta Prioridade',
    description: 'Para tickets de alta prioridade',
    priority: 'high',
    response_time: 60,
    resolution_time: 480,
    escalation_enabled: true,
    business_hours_only: false,
    active: true,
    created_at: '2024-01-15'
  },
  {
    id: '3',
    name: 'SLA Média Prioridade',
    description: 'Para tickets de prioridade média',
    priority: 'medium',
    response_time: 240,
    resolution_time: 1440,
    escalation_enabled: true,
    business_hours_only: true,
    active: true,
    created_at: '2024-01-15'
  },
  {
    id: '4',
    name: 'SLA Baixa Prioridade',
    description: 'Para tickets de baixa prioridade',
    priority: 'low',
    response_time: 480,
    resolution_time: 2880,
    escalation_enabled: false,
    business_hours_only: true,
    active: true,
    created_at: '2024-01-15'
  }
]

const businessHours = {
  start: '08:00',
  end: '18:00',
  days: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']
}

const priorityColors = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200'
}

const priorityLabels = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo'
}

export default function SLASettingsPage() {
  const [policies, setPolicies] = useState<SLAPolicy[]>(mockPolicies)
  const [showModal, setShowModal] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<SLAPolicy | null>(null)
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null)

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
    return `${Math.floor(minutes / 1440)}d`
  }

  const togglePolicy = (id: string) => {
    setExpandedPolicy(expandedPolicy === id ? null : id)
  }

  const handleEdit = (policy: SLAPolicy) => {
    setEditingPolicy(policy)
    setShowModal(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta política de SLA?')) {
      setPolicies(policies.filter(p => p.id !== id))
    }
  }

  const toggleActive = (id: string) => {
    setPolicies(policies.map(p =>
      p.id === id ? { ...p, active: !p.active } : p
    ))
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClockIcon className="w-6 h-6 text-blue-600" />
                Políticas de SLA
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Configure os tempos de resposta e resolução por prioridade
              </p>
            </div>
            <button
              onClick={() => {
                setEditingPolicy(null)
                setShowModal(true)
              }}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              Nova Política
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Políticas Ativas</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {policies.filter(p => p.active).length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total de Políticas</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {policies.length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Com Escalonamento</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {policies.filter(p => p.escalation_enabled).length}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-600">24/7</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {policies.filter(p => !p.business_hours_only).length}
            </div>
          </div>
        </div>

        {/* Business Hours Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-gray-400" />
            Horário Comercial
          </h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Início:</span>
              <span className="px-3 py-1 bg-gray-100 rounded-lg font-medium">{businessHours.start}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Fim:</span>
              <span className="px-3 py-1 bg-gray-100 rounded-lg font-medium">{businessHours.end}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Dias:</span>
              <div className="flex gap-1">
                {businessHours.days.map(day => (
                  <span key={day} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {day}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Policies List */}
        <div className="space-y-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className={`bg-white rounded-xl border transition-all ${
                policy.active ? 'border-gray-200' : 'border-gray-200 opacity-60'
              }`}
            >
              {/* Policy Header */}
              <div
                className="p-4 sm:p-6 cursor-pointer"
                onClick={() => togglePolicy(policy.id)}
              >
                <div className="flex items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{policy.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[policy.priority]}`}>
                        {priorityLabels[policy.priority]}
                      </span>
                      {!policy.active && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{policy.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-gray-500">Resposta</div>
                        <div className="font-semibold text-gray-900">{formatTime(policy.response_time)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500">Resolução</div>
                        <div className="font-semibold text-gray-900">{formatTime(policy.resolution_time)}</div>
                      </div>
                    </div>
                    {expandedPolicy === policy.id ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Mobile time display */}
                <div className="flex sm:hidden items-center gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Resp: {formatTime(policy.response_time)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircleIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Res: {formatTime(policy.resolution_time)}</span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedPolicy === policy.id && (
                <div className="border-t border-gray-100 p-4 sm:p-6 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <ClockIcon className="w-4 h-4" />
                        Tempo de Resposta
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatTime(policy.response_time)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <CheckCircleIcon className="w-4 h-4" />
                        Tempo de Resolução
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatTime(policy.resolution_time)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <BellIcon className="w-4 h-4" />
                        Escalonamento
                      </div>
                      <div className="text-lg font-semibold">
                        {policy.escalation_enabled ? (
                          <span className="text-green-600">Ativado</span>
                        ) : (
                          <span className="text-gray-500">Desativado</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <ArrowPathIcon className="w-4 h-4" />
                        Cobertura
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {policy.business_hours_only ? 'Horário Comercial' : '24/7'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(policy)
                      }}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleActive(policy.id)
                      }}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm ${
                        policy.active
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {policy.active ? (
                        <>
                          <XMarkIcon className="w-4 h-4" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="w-4 h-4" />
                          Ativar
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(policy.id)
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
          ))}
        </div>

        {/* Escalation Rules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mt-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
            Regras de Escalonamento
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">50% do tempo de resposta</div>
                <div className="text-sm text-gray-600">Notificar agente atribuído</div>
              </div>
              <BellIcon className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">80% do tempo de resposta</div>
                <div className="text-sm text-gray-600">Notificar líder da equipe</div>
              </div>
              <BellIcon className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">SLA violado</div>
                <div className="text-sm text-gray-600">Notificar gerente + escalar prioridade</div>
              </div>
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Creating/Editing Policy */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingPolicy ? 'Editar Política' : 'Nova Política de SLA'}
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
                  Nome da Política *
                </label>
                <input
                  type="text"
                  defaultValue={editingPolicy?.name || ''}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: SLA Crítico"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  defaultValue={editingPolicy?.description || ''}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descreva quando esta política se aplica..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade *
                </label>
                <select
                  defaultValue={editingPolicy?.priority || 'medium'}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tempo de Resposta (min) *
                  </label>
                  <input
                    type="number"
                    defaultValue={editingPolicy?.response_time || 60}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tempo de Resolução (min) *
                  </label>
                  <input
                    type="number"
                    defaultValue={editingPolicy?.resolution_time || 480}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked={editingPolicy?.escalation_enabled ?? true}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Habilitar escalonamento</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked={editingPolicy?.business_hours_only ?? true}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Apenas horário comercial</span>
                </label>
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                {editingPolicy ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
