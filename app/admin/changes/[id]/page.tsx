'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowPathIcon,
  ArrowLeftIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  ServerIcon,
  ChevronRightIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChatBubbleLeftRightIcon,
  PencilIcon,
  PlayIcon,
  PauseIcon,
  ArrowUturnLeftIcon,
  ShieldCheckIcon,
  BeakerIcon,
  RocketLaunchIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'
import { ArrowPathIcon as ArrowPathSolid } from '@heroicons/react/24/solid'

interface Change {
  id: string
  title: string
  description: string
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  category: 'standard' | 'normal' | 'emergency'
  priority: 'low' | 'medium' | 'high' | 'critical'
  risk_level: number // 1-5
  impact_level: number // 1-5
  urgency_level: number // 1-5
  assigned_to: string | null
  assigned_name: string | null
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  justification: string
  implementation_plan: string
  rollback_plan: string
  test_plan: string
  affected_services: string[]
  affected_cis: Array<{ id: string; name: string; type: string }>
  related_problems: number[]
  related_incidents: number[]
  cab_required: boolean
  cab_meeting_date: string | null
  cab_decision: 'pending' | 'approved' | 'rejected' | 'deferred' | null
  cab_votes: Array<{ user: string; vote: 'approve' | 'reject' | 'abstain'; comment: string; timestamp: string }>
  approvals: Array<{ user: string; role: string; status: 'pending' | 'approved' | 'rejected'; timestamp: string | null }>
  timeline: Array<{
    id: string
    type: 'status_change' | 'comment' | 'approval' | 'cab_vote' | 'implementation'
    content: string
    user: string
    timestamp: string
  }>
}

export default function ChangeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const changeId = params.id as string

  const [change, setChange] = useState<Change | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'cab' | 'impact' | 'timeline'>('overview')

  useEffect(() => {
    fetchChange()
  }, [changeId])

  const fetchChange = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 300))

      setChange({
        id: changeId,
        title: 'Otimização de índices do banco de dados ERP',
        description: 'Reconstrução de índices fragmentados e otimização de queries no banco de dados do ERP para resolver problemas de performance identificados no PRB-123.',
        status: 'scheduled',
        category: 'normal',
        priority: 'high',
        risk_level: 3,
        impact_level: 4,
        urgency_level: 3,
        assigned_to: 'user_3',
        assigned_name: 'Pedro Almeida',
        created_by: 'user_2',
        created_by_name: 'Carlos Silva',
        created_at: '2024-12-11T14:00:00Z',
        updated_at: '2024-12-14T10:00:00Z',
        scheduled_start: '2024-12-15T22:00:00Z',
        scheduled_end: '2024-12-16T02:00:00Z',
        actual_start: null,
        actual_end: null,
        justification: 'O banco de dados do ERP está apresentando lentidão severa durante horários de pico, afetando aproximadamente 150 usuários do departamento financeiro. A análise de causa raiz (PRB-123) identificou índices fragmentados e queries não otimizadas como a causa principal. Esta mudança visa resolver definitivamente o problema.',
        implementation_plan: `1. Backup completo do banco de dados (22:00 - 22:30)
2. Notificar usuários sobre janela de manutenção (22:30)
3. Parar serviços dependentes do ERP (22:30 - 22:45)
4. Executar script de reconstrução de índices (22:45 - 00:30)
5. Aplicar otimizações de queries (00:30 - 01:00)
6. Executar testes de validação (01:00 - 01:30)
7. Reiniciar serviços (01:30 - 01:45)
8. Validação final e monitoramento (01:45 - 02:00)`,
        rollback_plan: `Em caso de falha:
1. Interromper imediatamente o processo
2. Restaurar backup do banco de dados
3. Reiniciar serviços na configuração anterior
4. Notificar equipe de suporte
5. Agendar nova janela para investigação adicional

Tempo estimado de rollback: 45 minutos
Ponto de não retorno: Após início da otimização de queries`,
        test_plan: `Testes de Validação:
1. Verificar integridade dos dados (checksum)
2. Executar queries de benchmark
3. Testar módulos críticos (Financeiro, Relatórios, Dashboard)
4. Verificar logs de erro
5. Comparar tempo de resposta com baseline
6. Teste de carga simulando horário de pico`,
        affected_services: ['ERP Financeiro', 'Relatórios Gerenciais', 'BI Dashboard', 'Integração SAP'],
        affected_cis: [
          { id: 'ci_1', name: 'SRV-ERP-01', type: 'server' },
          { id: 'ci_2', name: 'DB-ERP-PROD', type: 'database' },
          { id: 'ci_3', name: 'ERP-APP-CLUSTER', type: 'application' }
        ],
        related_problems: [123],
        related_incidents: [1234, 1256, 1278, 1290, 1302],
        cab_required: true,
        cab_meeting_date: '2024-12-13T14:00:00Z',
        cab_decision: 'approved',
        cab_votes: [
          { user: 'Maria Santos', vote: 'approve', comment: 'Mudança necessária. Planos adequados.', timestamp: '2024-12-13T14:15:00Z' },
          { user: 'João Oliveira', vote: 'approve', comment: 'Aprovado. Garantir monitoramento durante execução.', timestamp: '2024-12-13T14:20:00Z' },
          { user: 'Ana Costa', vote: 'approve', comment: 'OK. Validar backup antes de iniciar.', timestamp: '2024-12-13T14:25:00Z' }
        ],
        approvals: [
          { user: 'Maria Santos', role: 'Gerente de TI', status: 'approved', timestamp: '2024-12-13T14:30:00Z' },
          { user: 'Roberto Lima', role: 'DBA Lead', status: 'approved', timestamp: '2024-12-13T15:00:00Z' },
          { user: 'Fernanda Silva', role: 'Gerente de Operações', status: 'approved', timestamp: '2024-12-13T16:00:00Z' }
        ],
        timeline: [
          { id: '1', type: 'status_change', content: 'RFC criada', user: 'Carlos Silva', timestamp: '2024-12-11T14:00:00Z' },
          { id: '2', type: 'status_change', content: 'Status: Submetida para Revisão', user: 'Carlos Silva', timestamp: '2024-12-11T14:30:00Z' },
          { id: '3', type: 'comment', content: 'Solicitação de revisão pelo CAB agendada', user: 'Sistema', timestamp: '2024-12-12T09:00:00Z' },
          { id: '4', type: 'cab_vote', content: 'CAB Meeting realizada. Decisão: Aprovada', user: 'CAB', timestamp: '2024-12-13T14:30:00Z' },
          { id: '5', type: 'approval', content: 'Aprovação: Maria Santos (Gerente de TI)', user: 'Maria Santos', timestamp: '2024-12-13T14:30:00Z' },
          { id: '6', type: 'approval', content: 'Aprovação: Roberto Lima (DBA Lead)', user: 'Roberto Lima', timestamp: '2024-12-13T15:00:00Z' },
          { id: '7', type: 'approval', content: 'Aprovação: Fernanda Silva (Gerente de Operações)', user: 'Fernanda Silva', timestamp: '2024-12-13T16:00:00Z' },
          { id: '8', type: 'status_change', content: 'Status: Agendada para 15/12/2024 22:00', user: 'Pedro Almeida', timestamp: '2024-12-14T10:00:00Z' }
        ]
      })
    } catch (error) {
      console.error('Error fetching change:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700'
      case 'submitted': return 'bg-blue-100 text-blue-700'
      case 'under_review': return 'bg-yellow-100 text-yellow-700'
      case 'approved': return 'bg-green-100 text-green-700'
      case 'scheduled': return 'bg-indigo-100 text-indigo-700'
      case 'in_progress': return 'bg-purple-100 text-purple-700'
      case 'completed': return 'bg-green-100 text-green-700'
      case 'failed': return 'bg-red-100 text-red-700'
      case 'cancelled': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Rascunho'
      case 'submitted': return 'Submetida'
      case 'under_review': return 'Em Revisão'
      case 'approved': return 'Aprovada'
      case 'scheduled': return 'Agendada'
      case 'in_progress': return 'Em Execução'
      case 'completed': return 'Concluída'
      case 'failed': return 'Falhou'
      case 'cancelled': return 'Cancelada'
      default: return status
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'standard': return 'bg-green-100 text-green-700'
      case 'normal': return 'bg-blue-100 text-blue-700'
      case 'emergency': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'standard': return 'Padrão'
      case 'normal': return 'Normal'
      case 'emergency': return 'Emergência'
      default: return category
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRiskColor = (level: number) => {
    if (level <= 2) return 'bg-green-500'
    if (level <= 3) return 'bg-yellow-500'
    if (level <= 4) return 'bg-orange-500'
    return 'bg-red-500'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!change) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Mudança não encontrada</h2>
          <button
            onClick={() => router.push('/admin/changes')}
            className="mt-4 text-indigo-600 hover:text-indigo-700"
          >
            Voltar para lista
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: DocumentTextIcon },
    { id: 'plans', label: 'Planos', icon: ClipboardDocumentCheckIcon },
    { id: 'cab', label: 'CAB', icon: UserGroupIcon },
    { id: 'impact', label: 'Impacto', icon: ExclamationTriangleIcon },
    { id: 'timeline', label: 'Histórico', icon: ClockIcon }
  ]

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/admin/changes')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span>Mudança</span>
                <ChevronRightIcon className="w-4 h-4" />
                <span className="font-mono">CHG-{change.id}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {change.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(change.status)}`}>
              {getStatusLabel(change.status)}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(change.category)}`}>
              {getCategoryLabel(change.category)}
            </span>
            {change.cab_required && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                <UserGroupIcon className="w-4 h-4" />
                CAB Required
              </span>
            )}
            {change.scheduled_start && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 flex items-center gap-1">
                <CalendarDaysIcon className="w-4 h-4" />
                {formatDate(change.scheduled_start)}
              </span>
            )}
          </div>

          {/* Risk Indicator */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-gray-500">Risco:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(level => (
                <div
                  key={level}
                  className={`w-6 h-3 rounded ${level <= change.risk_level ? getRiskColor(change.risk_level) : 'bg-gray-200'}`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-700">
              {change.risk_level <= 2 ? 'Baixo' : change.risk_level <= 3 ? 'Médio' : change.risk_level <= 4 ? 'Alto' : 'Crítico'}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3">Descrição</h2>
                  <p className="text-gray-600 whitespace-pre-wrap">{change.description}</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3">Justificativa</h2>
                  <p className="text-gray-600 whitespace-pre-wrap">{change.justification}</p>
                </div>

                {/* Schedule */}
                {change.scheduled_start && (
                  <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 sm:p-6">
                    <h2 className="font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                      <CalendarDaysIcon className="w-5 h-5" />
                      Janela de Manutenção
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-indigo-600">Início Planejado</p>
                        <p className="font-medium text-indigo-900">{formatDate(change.scheduled_start)}</p>
                      </div>
                      {change.scheduled_end && (
                        <div>
                          <p className="text-sm text-indigo-600">Fim Planejado</p>
                          <p className="font-medium text-indigo-900">{formatDate(change.scheduled_end)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Approvals Status */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-4">Status de Aprovações</h2>
                  <div className="space-y-3">
                    {change.approvals.map((approval, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {approval.status === 'approved' ? (
                            <CheckCircleIcon className="w-5 h-5 text-green-500" />
                          ) : approval.status === 'rejected' ? (
                            <XCircleIcon className="w-5 h-5 text-red-500" />
                          ) : (
                            <ClockIcon className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{approval.user}</p>
                            <p className="text-sm text-gray-500">{approval.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${
                            approval.status === 'approved' ? 'text-green-600' :
                            approval.status === 'rejected' ? 'text-red-600' :
                            'text-gray-500'
                          }`}>
                            {approval.status === 'approved' ? 'Aprovado' :
                             approval.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </span>
                          {approval.timestamp && (
                            <p className="text-xs text-gray-500">{formatDate(approval.timestamp)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Plans Tab */}
            {activeTab === 'plans' && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <RocketLaunchIcon className="w-5 h-5 text-blue-500" />
                    Plano de Implementação
                  </h2>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{change.implementation_plan}</pre>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ArrowUturnLeftIcon className="w-5 h-5 text-orange-500" />
                    Plano de Rollback
                  </h2>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{change.rollback_plan}</pre>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BeakerIcon className="w-5 h-5 text-green-500" />
                    Plano de Testes
                  </h2>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{change.test_plan}</pre>
                  </div>
                </div>
              </>
            )}

            {/* CAB Tab */}
            {activeTab === 'cab' && (
              <>
                {change.cab_required ? (
                  <>
                    <div className={`rounded-xl border p-4 sm:p-6 ${
                      change.cab_decision === 'approved' ? 'bg-green-50 border-green-200' :
                      change.cab_decision === 'rejected' ? 'bg-red-50 border-red-200' :
                      'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <UserGroupIcon className={`w-6 h-6 ${
                          change.cab_decision === 'approved' ? 'text-green-600' :
                          change.cab_decision === 'rejected' ? 'text-red-600' :
                          'text-yellow-600'
                        }`} />
                        <div>
                          <h2 className="font-semibold text-gray-900">Decisão do CAB</h2>
                          {change.cab_meeting_date && (
                            <p className="text-sm text-gray-500">Reunião: {formatDate(change.cab_meeting_date)}</p>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        change.cab_decision === 'approved' ? 'bg-green-100 text-green-700' :
                        change.cab_decision === 'rejected' ? 'bg-red-100 text-red-700' :
                        change.cab_decision === 'deferred' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {change.cab_decision === 'approved' ? 'Aprovada' :
                         change.cab_decision === 'rejected' ? 'Rejeitada' :
                         change.cab_decision === 'deferred' ? 'Adiada' : 'Pendente'}
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                      <h2 className="font-semibold text-gray-900 mb-4">Votos do CAB</h2>
                      <div className="space-y-3">
                        {change.cab_votes.map((vote, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                {vote.vote === 'approve' ? (
                                  <HandThumbUpIcon className="w-5 h-5 text-green-500" />
                                ) : vote.vote === 'reject' ? (
                                  <HandThumbDownIcon className="w-5 h-5 text-red-500" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-300" />
                                )}
                                <span className="font-medium text-gray-900">{vote.user}</span>
                              </div>
                              <span className={`text-sm font-medium ${
                                vote.vote === 'approve' ? 'text-green-600' :
                                vote.vote === 'reject' ? 'text-red-600' :
                                'text-gray-500'
                              }`}>
                                {vote.vote === 'approve' ? 'Aprova' :
                                 vote.vote === 'reject' ? 'Rejeita' : 'Abstém'}
                              </span>
                            </div>
                            {vote.comment && (
                              <p className="text-sm text-gray-600 italic">"{vote.comment}"</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">{formatDate(vote.timestamp)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <ShieldCheckIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h2 className="font-semibold text-gray-900 mb-2">CAB não requerido</h2>
                    <p className="text-gray-500">Esta mudança foi classificada como padrão e não requer aprovação do CAB</p>
                  </div>
                )}
              </>
            )}

            {/* Impact Tab */}
            {activeTab === 'impact' && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Risco</p>
                    <p className="text-2xl font-bold text-orange-600">{change.risk_level}/5</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Impacto</p>
                    <p className="text-2xl font-bold text-red-600">{change.impact_level}/5</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">Urgência</p>
                    <p className="text-2xl font-bold text-yellow-600">{change.urgency_level}/5</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-4">Serviços Afetados</h2>
                  <div className="flex flex-wrap gap-2">
                    {change.affected_services.map((service, index) => (
                      <span key={index} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <ServerIcon className="w-5 h-5 text-gray-400" />
                    CIs Afetados
                  </h2>
                  <div className="space-y-2">
                    {change.affected_cis.map(ci => (
                      <div
                        key={ci.id}
                        onClick={() => router.push(`/admin/cmdb/${ci.id}`)}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <ServerIcon className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{ci.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{ci.type}</p>
                          </div>
                        </div>
                        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Related Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Problemas Relacionados</h3>
                    {change.related_problems.length > 0 ? (
                      <div className="space-y-2">
                        {change.related_problems.map(id => (
                          <div
                            key={id}
                            onClick={() => router.push(`/admin/problems/${id}`)}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <ExclamationTriangleIcon className="w-4 h-4 text-purple-500" />
                            <span className="text-sm">PRB-{id}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum problema vinculado</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Incidentes Relacionados</h3>
                    {change.related_incidents.length > 0 ? (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {change.related_incidents.map(id => (
                          <div
                            key={id}
                            onClick={() => router.push(`/tickets/${id}`)}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                          >
                            <ExclamationTriangleIcon className="w-4 h-4 text-orange-500" />
                            <span className="text-sm">INC-{id}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum incidente vinculado</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Histórico de Atividades</h2>
                <div className="space-y-4">
                  {change.timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          event.type === 'approval' ? 'bg-green-100 text-green-600' :
                          event.type === 'cab_vote' ? 'bg-purple-100 text-purple-600' :
                          event.type === 'implementation' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {event.type === 'approval' ? <CheckCircleIcon className="w-4 h-4" /> :
                           event.type === 'cab_vote' ? <UserGroupIcon className="w-4 h-4" /> :
                           event.type === 'implementation' ? <RocketLaunchIcon className="w-4 h-4" /> :
                           event.type === 'comment' ? <ChatBubbleLeftRightIcon className="w-4 h-4" /> :
                           <ArrowPathIcon className="w-4 h-4" />}
                        </div>
                        {index < change.timeline.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-gray-900">{event.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <span>{event.user}</span>
                          <span>•</span>
                          <span>{formatDate(event.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Ações</h3>
              <div className="space-y-2">
                {change.status === 'scheduled' && (
                  <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2">
                    <PlayIcon className="w-4 h-4" />
                    Iniciar Execução
                  </button>
                )}
                {change.status === 'in_progress' && (
                  <>
                    <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2">
                      <CheckCircleIcon className="w-4 h-4" />
                      Concluir com Sucesso
                    </button>
                    <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2">
                      <XCircleIcon className="w-4 h-4" />
                      Marcar como Falha
                    </button>
                    <button className="w-full px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 flex items-center justify-center gap-2">
                      <ArrowUturnLeftIcon className="w-4 h-4" />
                      Executar Rollback
                    </button>
                  </>
                )}
                <button className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 flex items-center justify-center gap-2">
                  <PencilIcon className="w-4 h-4" />
                  Editar RFC
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Informações</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Responsável</span>
                  <span className="font-medium text-gray-900">{change.assigned_name || 'Não atribuído'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Solicitante</span>
                  <span className="font-medium text-gray-900">{change.created_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Criado em</span>
                  <span className="font-medium text-gray-900">{formatDate(change.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Atualizado</span>
                  <span className="font-medium text-gray-900">{formatDate(change.updated_at)}</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Métricas</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{change.affected_services.length}</p>
                  <p className="text-xs text-gray-500">Serviços</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{change.affected_cis.length}</p>
                  <p className="text-xs text-gray-500">CIs</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{change.approvals.filter(a => a.status === 'approved').length}</p>
                  <p className="text-xs text-gray-500">Aprovações</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{change.cab_votes.length}</p>
                  <p className="text-xs text-gray-500">Votos CAB</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/changes')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Voltar
          </button>
          {change.status === 'scheduled' && (
            <button className="flex-1 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg">
              Iniciar
            </button>
          )}
          {change.status !== 'scheduled' && (
            <button className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg">
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
