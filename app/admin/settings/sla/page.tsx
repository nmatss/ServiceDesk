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
  ChevronUpIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'

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
  critical: 'bg-error-100 text-error-700 dark:bg-error-900/20 dark:text-error-400 border-error-200 dark:border-error-800',
  high: 'bg-warning-100 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400 border-warning-200 dark:border-warning-800',
  medium: 'bg-warning-100 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400 border-warning-200 dark:border-warning-800',
  low: 'bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-400 border-success-200 dark:border-success-800'
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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Modern Header with Breadcrumbs */}
        <PageHeader
          title="Políticas de SLA"
          description="Configure os tempos de resposta e resolução por prioridade"
          icon={ClockIcon}
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Configurações', href: '/admin/settings' },
            { label: 'SLA', href: '/admin/settings/sla' }
          ]}
          actions={[
            {
              label: 'Nova Política',
              onClick: () => {
                setEditingPolicy(null)
                setShowModal(true)
              },
              icon: PlusIcon,
              variant: 'primary'
            }
          ]}
        />
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-panel p-6 hover:shadow-large hover:-translate-y-1 transition-all duration-300 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-description">Políticas Ativas</div>
              <div className="h-10 w-10 bg-gradient-brand rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-3">
              {policies.filter(p => p.active).length}
            </div>
          </div>
          <div className="glass-panel p-6 hover:shadow-large hover:-translate-y-1 transition-all duration-300 animate-fade-in delay-75">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-description">Total de Políticas</div>
              <div className="h-10 w-10 bg-gradient-to-br from-brand-500 to-brand-600 rounded-lg flex items-center justify-center">
                <Cog6ToothIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-3">
              {policies.length}
            </div>
          </div>
          <div className="glass-panel p-6 hover:shadow-large hover:-translate-y-1 transition-all duration-300 animate-fade-in delay-150">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-description">Com Escalonamento</div>
              <div className="h-10 w-10 bg-gradient-to-br from-warning-500 to-warning-600 rounded-lg flex items-center justify-center">
                <BellIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-3">
              {policies.filter(p => p.escalation_enabled).length}
            </div>
          </div>
          <div className="glass-panel p-6 hover:shadow-large hover:-translate-y-1 transition-all duration-300 animate-fade-in delay-200">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-description">24/7</div>
              <div className="h-10 w-10 bg-gradient-to-br from-success-500 to-success-600 rounded-lg flex items-center justify-center">
                <ArrowPathIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-3">
              {policies.filter(p => !p.business_hours_only).length}
            </div>
          </div>
        </div>

        {/* Business Hours Card */}
        <div className="glass-panel p-6 animate-fade-in delay-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <ClockIcon className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                Horário Comercial
              </h2>
              <p className="text-sm text-description mt-1">
                Configuração padrão para políticas com horário comercial
              </p>
            </div>
            <div className="h-12 w-12 bg-gradient-brand rounded-xl flex items-center justify-center">
              <ClockIcon className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
              <span className="text-sm font-medium text-description">Início:</span>
              <div className="mt-2 px-3 py-2 bg-white dark:bg-neutral-950 rounded-lg font-bold text-lg text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600">
                {businessHours.start}
              </div>
            </div>
            <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
              <span className="text-sm font-medium text-description">Fim:</span>
              <div className="mt-2 px-3 py-2 bg-white dark:bg-neutral-950 rounded-lg font-bold text-lg text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600">
                {businessHours.end}
              </div>
            </div>
            <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
              <span className="text-sm font-medium text-description block mb-2">Dias:</span>
              <div className="flex flex-wrap gap-1">
                {businessHours.days.map(day => (
                  <span key={day} className="px-2.5 py-1 bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-lg text-xs font-bold border border-brand-200 dark:border-brand-800">
                    {day}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Policies List */}
        <div className="space-y-4">
          {policies.map((policy, index) => (
            <div
              key={policy.id}
              className={`glass-panel transition-all duration-300 hover:shadow-large hover:-translate-y-1 animate-fade-in ${
                !policy.active ? 'opacity-60' : ''
              }`}
              style={{ animationDelay: `${400 + index * 100}ms` }}
            >
              {/* Policy Header */}
              <div
                className="p-6 cursor-pointer"
                onClick={() => togglePolicy(policy.id)}
              >
                <div className="flex items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <div className="h-10 w-10 bg-gradient-brand rounded-lg flex items-center justify-center flex-shrink-0">
                        <Cog6ToothIcon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">{policy.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${priorityColors[policy.priority]}`}>
                        {priorityLabels[policy.priority]}
                      </span>
                      {!policy.active && (
                        <span className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-description rounded-full text-xs font-bold border border-neutral-200 dark:border-neutral-700">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-description mt-1">{policy.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="text-muted-content text-xs font-medium mb-1">Resposta</div>
                        <div className="font-bold text-brand-600 dark:text-brand-400">{formatTime(policy.response_time)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-content text-xs font-medium mb-1">Resolução</div>
                        <div className="font-bold text-success-600 dark:text-success-400">{formatTime(policy.resolution_time)}</div>
                      </div>
                    </div>
                    {expandedPolicy === policy.id ? (
                      <ChevronUpIcon className="w-5 h-5 text-icon-muted transition-transform" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-icon-muted transition-transform" />
                    )}
                  </div>
                </div>

                {/* Mobile time display */}
                <div className="flex sm:hidden items-center gap-4 mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/10 rounded-lg border border-brand-200 dark:border-brand-800">
                    <ClockIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    <span className="text-description text-sm">Resp: <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatTime(policy.response_time)}</span></span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-success-50 dark:bg-success-900/10 rounded-lg border border-success-200 dark:border-success-800">
                    <CheckCircleIcon className="w-4 h-4 text-success-600 dark:text-success-400" />
                    <span className="text-description text-sm">Res: <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatTime(policy.resolution_time)}</span></span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedPolicy === policy.id && (
                <div className="border-t border-neutral-200 dark:border-neutral-700 p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 animate-slide-down">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white dark:bg-neutral-950 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 shadow-soft hover:shadow-medium transition-shadow">
                      <div className="flex items-center gap-2 text-sm font-medium text-description mb-2">
                        <ClockIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        Tempo de Resposta
                      </div>
                      <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                        {formatTime(policy.response_time)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-neutral-950 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 shadow-soft hover:shadow-medium transition-shadow">
                      <div className="flex items-center gap-2 text-sm font-medium text-description mb-2">
                        <CheckCircleIcon className="w-4 h-4 text-success-600 dark:text-success-400" />
                        Tempo de Resolução
                      </div>
                      <div className="text-2xl font-bold text-success-600 dark:text-success-400">
                        {formatTime(policy.resolution_time)}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-neutral-950 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 shadow-soft hover:shadow-medium transition-shadow">
                      <div className="flex items-center gap-2 text-sm font-medium text-description mb-2">
                        <BellIcon className="w-4 h-4" />
                        Escalonamento
                      </div>
                      <div className="text-2xl font-bold">
                        {policy.escalation_enabled ? (
                          <span className="text-success-600 dark:text-success-400">Ativado</span>
                        ) : (
                          <span className="text-muted-content">Desativado</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-neutral-950 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700 shadow-soft hover:shadow-medium transition-shadow">
                      <div className="flex items-center gap-2 text-sm font-medium text-description mb-2">
                        <ArrowPathIcon className="w-4 h-4" />
                        Cobertura
                      </div>
                      <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                        {policy.business_hours_only ? 'Horário Comercial' : '24/7'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(policy)
                      }}
                      className="px-4 py-2.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:shadow-medium transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleActive(policy.id)
                      }}
                      className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 hover:shadow-medium ${
                        policy.active
                          ? 'bg-warning-100 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400 border border-warning-200 dark:border-warning-800 hover:bg-warning-200 dark:hover:bg-warning-900/30'
                          : 'bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-800 hover:bg-success-200 dark:hover:bg-success-900/30'
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
                      className="px-4 py-2.5 bg-error-100 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg border border-error-200 dark:border-error-800 hover:bg-error-200 dark:hover:bg-error-900/30 hover:shadow-medium transition-all duration-200 flex items-center gap-2 text-sm font-medium"
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
        <div className="glass-panel p-8 animate-fade-in delay-500">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-6 h-6 text-warning-600 dark:text-warning-400" />
                Regras de Escalonamento
              </h2>
              <p className="text-sm text-description mt-1">
                Ações automáticas baseadas no progresso do SLA
              </p>
            </div>
            <div className="h-12 w-12 bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl flex items-center justify-center">
              <ExclamationTriangleIcon className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-warning-50 to-warning-100 dark:from-warning-900/10 dark:to-warning-800/10 rounded-xl border border-warning-200 dark:border-warning-800 hover:shadow-medium transition-all duration-200">
              <div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100 mb-1">50% do tempo de resposta</div>
                <div className="text-sm text-description">Notificar agente atribuído</div>
              </div>
              <div className="h-10 w-10 bg-warning-500 rounded-lg flex items-center justify-center">
                <BellIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-warning-50 to-warning-100 dark:from-warning-900/10 dark:to-warning-800/10 rounded-xl border border-warning-200 dark:border-warning-800 hover:shadow-medium transition-all duration-200">
              <div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100 mb-1">80% do tempo de resposta</div>
                <div className="text-sm text-description">Notificar líder da equipe</div>
              </div>
              <div className="h-10 w-10 bg-warning-600 rounded-lg flex items-center justify-center">
                <BellIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-error-50 to-error-100 dark:from-error-900/10 dark:to-error-800/10 rounded-xl border border-error-200 dark:border-error-800 hover:shadow-medium transition-all duration-200">
              <div>
                <div className="font-bold text-neutral-900 dark:text-neutral-100 mb-1">SLA violado</div>
                <div className="text-sm text-description">Notificar gerente + escalar prioridade</div>
              </div>
              <div className="h-10 w-10 bg-error-600 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Creating/Editing Policy */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gradient-brand rounded-lg flex items-center justify-center">
                    <Cog6ToothIcon className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {editingPolicy ? 'Editar Política' : 'Nova Política de SLA'}
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
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Nome da Política *
                </label>
                <input
                  type="text"
                  defaultValue={editingPolicy?.name || ''}
                  className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all"
                  placeholder="Ex: SLA Crítico"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Descrição
                </label>
                <textarea
                  defaultValue={editingPolicy?.description || ''}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all"
                  placeholder="Descreva quando esta política se aplica..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Prioridade *
                </label>
                <select
                  defaultValue={editingPolicy?.priority || 'medium'}
                  className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Tempo de Resposta (min) *
                  </label>
                  <input
                    type="number"
                    defaultValue={editingPolicy?.response_time || 60}
                    className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Tempo de Resolução (min) *
                  </label>
                  <input
                    type="number"
                    defaultValue={editingPolicy?.resolution_time || 480}
                    className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    defaultChecked={editingPolicy?.escalation_enabled ?? true}
                    className="w-5 h-5 text-brand-600 dark:text-brand-500 rounded focus:ring-brand-500 dark:focus:ring-brand-400 border-neutral-300 dark:border-neutral-600"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">Habilitar escalonamento</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    defaultChecked={editingPolicy?.business_hours_only ?? true}
                    className="w-5 h-5 text-brand-600 dark:text-brand-500 rounded focus:ring-brand-500 dark:focus:ring-brand-400 border-neutral-300 dark:border-neutral-600"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">Apenas horário comercial</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-700 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-5 py-2.5 bg-gradient-brand text-white rounded-lg font-semibold hover:shadow-large transition-all duration-200"
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
