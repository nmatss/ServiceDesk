'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import PageHeader from '@/components/ui/PageHeader'
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
  status: 'draft' | 'submitted' | 'under_review' | 'pending_cab' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
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
      case 'draft': return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
      case 'submitted': return 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
      case 'under_review': return 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
      case 'approved': return 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
      case 'scheduled': return 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
      case 'in_progress': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
      case 'completed': return 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
      case 'failed': return 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
      case 'cancelled': return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
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
      case 'standard': return 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
      case 'normal': return 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
      case 'emergency': return 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
      default: return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
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
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  if (!change) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <ArrowPathIcon className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Mudança não encontrada</h2>
          <button
            onClick={() => router.push('/admin/changes')}
            className="mt-4 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-brand-50/30 to-purple-50/20 dark:from-neutral-950 dark:via-brand-950/20 dark:to-purple-950/10 pb-6 animate-fade-in">
      {/* Modern Header */}
      <div className="glass-panel border-b border-neutral-200/50 dark:border-neutral-700/50 mb-6 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
          <PageHeader
            title={change.title}
            description={`CHG-${change.id} • ${getStatusLabel(change.status)}`}
            icon={ArrowPathIcon}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'Mudanças', href: '/admin/changes' },
              { label: `CHG-${change.id}` }
            ]}
            actions={[
              {
                label: 'Voltar',
                onClick: () => router.push('/admin/changes'),
                icon: ArrowLeftIcon,
                variant: 'ghost'
              },
              {
                label: 'Editar',
                onClick: () => {},
                icon: PencilIcon,
                variant: 'secondary'
              }
            ]}
          />

          {/* Status Badges and Info */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getStatusColor(change.status)} shadow-sm`}>
              {getStatusLabel(change.status)}
            </span>
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getCategoryColor(change.category)} shadow-sm`}>
              {getCategoryLabel(change.category)}
            </span>
            {change.cab_required && (
              <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-purple-100 text-purple-700 flex items-center gap-1.5 shadow-sm">
                <UserGroupIcon className="w-4 h-4" />
                CAB Required
              </span>
            )}
            {change.scheduled_start && (
              <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-700 flex items-center gap-1.5 shadow-sm">
                <CalendarDaysIcon className="w-4 h-4" />
                {formatDate(change.scheduled_start)}
              </span>
            )}
          </div>

          {/* Visual Approval Workflow */}
          <div className="mt-6 glass-panel bg-gradient-to-r from-success-50/50 via-brand-50/50 to-purple-50/50 dark:from-success-950/20 dark:via-brand-950/20 dark:to-purple-950/20">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-4">Workflow de Aprovação</h3>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {/* Step 1: Submitted */}
              <div className="flex flex-col items-center min-w-[100px] transition-all animate-slide-up">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  ['submitted', 'pending_cab', 'approved', 'scheduled', 'in_progress', 'completed'].includes(change.status)
                    ? 'bg-success-500 text-white shadow-glow-success'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-icon-muted'
                }`}>
                  <CheckCircleIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium mt-2 text-center text-neutral-700 dark:text-neutral-300">Submetida</span>
              </div>

              <div className={`flex-1 h-1 mx-2 transition-all ${
                ['pending_cab', 'approved', 'scheduled', 'in_progress', 'completed'].includes(change.status)
                  ? 'bg-success-500'
                  : 'bg-neutral-200 dark:bg-neutral-700'
              }`}></div>

              {/* Step 2: CAB Review */}
              <div className="flex flex-col items-center min-w-[100px] transition-all animate-slide-up delay-75">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  change.cab_decision === 'approved'
                    ? 'bg-success-500 text-white shadow-glow-success'
                    : change.status === 'pending_cab'
                    ? 'bg-purple-500 text-white animate-pulse-soft shadow-glow-purple'
                    : ['approved', 'scheduled', 'in_progress', 'completed'].includes(change.status)
                    ? 'bg-success-500 text-white shadow-glow-success'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-icon-muted'
                }`}>
                  <UserGroupIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium mt-2 text-center text-neutral-700 dark:text-neutral-300">CAB Review</span>
              </div>

              <div className={`flex-1 h-1 mx-2 transition-all ${
                ['approved', 'scheduled', 'in_progress', 'completed'].includes(change.status)
                  ? 'bg-success-500'
                  : 'bg-neutral-200 dark:bg-neutral-700'
              }`}></div>

              {/* Step 3: Approved */}
              <div className="flex flex-col items-center min-w-[100px] transition-all animate-slide-up delay-150">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  ['approved', 'scheduled', 'in_progress', 'completed'].includes(change.status)
                    ? 'bg-success-500 text-white shadow-glow-success'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-icon-muted'
                }`}>
                  <HandThumbUpIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium mt-2 text-center text-neutral-700 dark:text-neutral-300">Aprovada</span>
              </div>

              <div className={`flex-1 h-1 mx-2 transition-all ${
                ['scheduled', 'in_progress', 'completed'].includes(change.status)
                  ? 'bg-brand-500'
                  : 'bg-neutral-200 dark:bg-neutral-700'
              }`}></div>

              {/* Step 4: Scheduled */}
              <div className="flex flex-col items-center min-w-[100px] transition-all animate-slide-up delay-200">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  change.status === 'scheduled'
                    ? 'bg-brand-500 text-white animate-pulse-soft shadow-glow-brand'
                    : ['in_progress', 'completed'].includes(change.status)
                    ? 'bg-brand-500 text-white shadow-glow-brand'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-icon-muted'
                }`}>
                  <CalendarDaysIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium mt-2 text-center text-neutral-700 dark:text-neutral-300">Agendada</span>
              </div>

              <div className={`flex-1 h-1 mx-2 transition-all ${
                ['in_progress', 'completed'].includes(change.status)
                  ? 'bg-brand-500'
                  : 'bg-neutral-200 dark:bg-neutral-700'
              }`}></div>

              {/* Step 5: In Progress */}
              <div className="flex flex-col items-center min-w-[100px] transition-all animate-slide-up delay-300">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  change.status === 'in_progress'
                    ? 'bg-warning-500 text-white shadow-glow-warning'
                    : change.status === 'completed'
                    ? 'bg-brand-500 text-white shadow-glow-brand'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-icon-muted'
                }`}>
                  <PlayIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium mt-2 text-center text-neutral-700 dark:text-neutral-300">Em Execução</span>
              </div>

              <div className={`flex-1 h-1 mx-2 transition-all ${
                change.status === 'completed' ? 'bg-success-600' : 'bg-neutral-200 dark:bg-neutral-700'
              }`}></div>

              {/* Step 6: Completed */}
              <div className="flex flex-col items-center min-w-[100px] transition-all animate-slide-up delay-400">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  change.status === 'completed'
                    ? 'bg-success-600 text-white shadow-glow-success'
                    : change.status === 'failed'
                    ? 'bg-danger-600 text-white shadow-glow-danger'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-icon-muted'
                }`}>
                  {change.status === 'failed' ? (
                    <XCircleIcon className="w-6 h-6" />
                  ) : (
                    <CheckCircleIcon className="w-6 h-6" />
                  )}
                </div>
                <span className="text-xs font-medium mt-2 text-center text-neutral-700 dark:text-neutral-300">Concluída</span>
              </div>
            </div>
          </div>

          {/* Risk Indicator */}
          <div className="mt-6 glass-panel animate-slide-up">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Nível de Risco:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(level => (
                  <div
                    key={level}
                    className={`w-8 h-3 rounded-full transition-all ${level <= change.risk_level ? getRiskColor(change.risk_level) + ' shadow-md' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                  />
                ))}
              </div>
              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {change.risk_level <= 2 ? 'Baixo' : change.risk_level <= 3 ? 'Médio' : change.risk_level <= 4 ? 'Alto' : 'Crítico'}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border-b-2 border-brand-600 dark:border-brand-400'
                    : 'text-description hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
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
                <div className="glass-panel animate-slide-up">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Descrição</h2>
                  <p className="text-description whitespace-pre-wrap">{change.description}</p>
                </div>

                <div className="glass-panel animate-slide-up delay-75">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Justificativa</h2>
                  <p className="text-description whitespace-pre-wrap">{change.justification}</p>
                </div>

                {/* Schedule */}
                {change.scheduled_start && (
                  <div className="glass-panel bg-brand-50/50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 animate-slide-up delay-150">
                    <h2 className="font-semibold text-brand-800 dark:text-brand-300 mb-3 flex items-center gap-2">
                      <CalendarDaysIcon className="w-5 h-5" />
                      Janela de Manutenção
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-brand-600 dark:text-brand-400">Início Planejado</p>
                        <p className="font-medium text-brand-900 dark:text-brand-200">{formatDate(change.scheduled_start)}</p>
                      </div>
                      {change.scheduled_end && (
                        <div>
                          <p className="text-sm text-brand-600 dark:text-brand-400">Fim Planejado</p>
                          <p className="font-medium text-brand-900 dark:text-brand-200">{formatDate(change.scheduled_end)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Approvals Status */}
                <div className="glass-panel animate-slide-up delay-200">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Status de Aprovações</h2>
                  <div className="space-y-3">
                    {change.approvals.map((approval, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg transition-all hover:bg-neutral-100 dark:hover:bg-neutral-700/50">
                        <div className="flex items-center gap-3">
                          {approval.status === 'approved' ? (
                            <CheckCircleIcon className="w-5 h-5 text-success-500" />
                          ) : approval.status === 'rejected' ? (
                            <XCircleIcon className="w-5 h-5 text-danger-500" />
                          ) : (
                            <ClockIcon className="w-5 h-5 text-icon-muted" />
                          )}
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-neutral-100">{approval.user}</p>
                            <p className="text-sm text-muted-content">{approval.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${
                            approval.status === 'approved' ? 'text-success-600 dark:text-success-400' :
                            approval.status === 'rejected' ? 'text-danger-600 dark:text-danger-400' :
                            'text-muted-content'
                          }`}>
                            {approval.status === 'approved' ? 'Aprovado' :
                             approval.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                          </span>
                          {approval.timestamp && (
                            <p className="text-xs text-muted-content">{formatDate(approval.timestamp)}</p>
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
                <div className="glass-panel animate-slide-up">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <RocketLaunchIcon className="w-5 h-5 text-brand-500" />
                    Plano de Implementação
                  </h2>
                  <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
                    <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans">{change.implementation_plan}</pre>
                  </div>
                </div>

                <div className="glass-panel animate-slide-up delay-75">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <ArrowUturnLeftIcon className="w-5 h-5 text-warning-500" />
                    Plano de Rollback
                  </h2>
                  <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
                    <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans">{change.rollback_plan}</pre>
                  </div>
                </div>

                <div className="glass-panel animate-slide-up delay-150">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <BeakerIcon className="w-5 h-5 text-success-500" />
                    Plano de Testes
                  </h2>
                  <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-4">
                    <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans">{change.test_plan}</pre>
                  </div>
                </div>
              </>
            )}

            {/* CAB Tab */}
            {activeTab === 'cab' && (
              <>
                {change.cab_required ? (
                  <>
                    <div className={`glass-panel animate-slide-up ${
                      change.cab_decision === 'approved' ? 'bg-success-50/50 dark:bg-success-900/20 border-success-200 dark:border-success-800' :
                      change.cab_decision === 'rejected' ? 'bg-danger-50/50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800' :
                      'bg-warning-50/50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800'
                    }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <UserGroupIcon className={`w-6 h-6 ${
                          change.cab_decision === 'approved' ? 'text-success-600 dark:text-success-400' :
                          change.cab_decision === 'rejected' ? 'text-danger-600 dark:text-danger-400' :
                          'text-warning-600 dark:text-warning-400'
                        }`} />
                        <div>
                          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Decisão do CAB</h2>
                          {change.cab_meeting_date && (
                            <p className="text-sm text-muted-content">Reunião: {formatDate(change.cab_meeting_date)}</p>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                        change.cab_decision === 'approved' ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300' :
                        change.cab_decision === 'rejected' ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300' :
                        change.cab_decision === 'deferred' ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300' :
                        'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}>
                        {change.cab_decision === 'approved' ? 'Aprovada' :
                         change.cab_decision === 'rejected' ? 'Rejeitada' :
                         change.cab_decision === 'deferred' ? 'Adiada' : 'Pendente'}
                      </span>
                    </div>

                    <div className="glass-panel animate-slide-up delay-75">
                      <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Votos do CAB</h2>
                      <div className="space-y-3">
                        {change.cab_votes.map((vote, index) => (
                          <div key={index} className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg transition-all hover:bg-neutral-100 dark:hover:bg-neutral-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                {vote.vote === 'approve' ? (
                                  <HandThumbUpIcon className="w-5 h-5 text-success-500" />
                                ) : vote.vote === 'reject' ? (
                                  <HandThumbDownIcon className="w-5 h-5 text-danger-500" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                                )}
                                <span className="font-medium text-neutral-900 dark:text-neutral-100">{vote.user}</span>
                              </div>
                              <span className={`text-sm font-medium ${
                                vote.vote === 'approve' ? 'text-success-600 dark:text-success-400' :
                                vote.vote === 'reject' ? 'text-danger-600 dark:text-danger-400' :
                                'text-muted-content'
                              }`}>
                                {vote.vote === 'approve' ? 'Aprova' :
                                 vote.vote === 'reject' ? 'Rejeita' : 'Abstém'}
                              </span>
                            </div>
                            {vote.comment && (
                              <p className="text-sm text-description italic">"{vote.comment}"</p>
                            )}
                            <p className="text-xs text-muted-content mt-1">{formatDate(vote.timestamp)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="glass-panel text-center animate-slide-up">
                    <ShieldCheckIcon className="w-12 h-12 text-success-500 mx-auto mb-3" />
                    <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">CAB não requerido</h2>
                    <p className="text-muted-content">Esta mudança foi classificada como padrão e não requer aprovação do CAB</p>
                  </div>
                )}
              </>
            )}

            {/* Impact Tab */}
            {activeTab === 'impact' && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-panel text-center animate-slide-up">
                    <p className="text-sm text-muted-content mb-1">Risco</p>
                    <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">{change.risk_level}/5</p>
                  </div>
                  <div className="glass-panel text-center animate-slide-up delay-75">
                    <p className="text-sm text-muted-content mb-1">Impacto</p>
                    <p className="text-2xl font-bold text-danger-600 dark:text-danger-400">{change.impact_level}/5</p>
                  </div>
                  <div className="glass-panel text-center animate-slide-up delay-150">
                    <p className="text-sm text-muted-content mb-1">Urgência</p>
                    <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">{change.urgency_level}/5</p>
                  </div>
                </div>

                <div className="glass-panel animate-slide-up delay-200">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Serviços Afetados</h2>
                  <div className="flex flex-wrap gap-2">
                    {change.affected_services.map((service, index) => (
                      <span key={index} className="px-3 py-1.5 bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 rounded-lg text-sm transition-all hover:shadow-md">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="glass-panel animate-slide-up delay-300">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                    <ServerIcon className="w-5 h-5 text-icon-muted" />
                    CIs Afetados
                  </h2>
                  <div className="space-y-2">
                    {change.affected_cis.map(ci => (
                      <div
                        key={ci.id}
                        onClick={() => router.push(`/admin/cmdb/${ci.id}`)}
                        className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <ServerIcon className="w-5 h-5 text-icon-muted" />
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-neutral-100">{ci.name}</p>
                            <p className="text-xs text-muted-content capitalize">{ci.type}</p>
                          </div>
                        </div>
                        <ChevronRightIcon className="w-5 h-5 text-icon-muted" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Related Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="glass-panel animate-slide-up delay-400">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Problemas Relacionados</h3>
                    {change.related_problems.length > 0 ? (
                      <div className="space-y-2">
                        {change.related_problems.map(id => (
                          <div
                            key={id}
                            onClick={() => router.push(`/admin/problems/${id}`)}
                            className="flex items-center gap-2 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded cursor-pointer transition-all"
                          >
                            <ExclamationTriangleIcon className="w-4 h-4 text-purple-500" />
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">PRB-{id}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-content">Nenhum problema vinculado</p>
                    )}
                  </div>

                  <div className="glass-panel animate-slide-up delay-500">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Incidentes Relacionados</h3>
                    {change.related_incidents.length > 0 ? (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {change.related_incidents.map(id => (
                          <div
                            key={id}
                            onClick={() => router.push(`/tickets/${id}`)}
                            className="flex items-center gap-2 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded cursor-pointer transition-all"
                          >
                            <ExclamationTriangleIcon className="w-4 h-4 text-warning-500" />
                            <span className="text-sm text-neutral-700 dark:text-neutral-300">INC-{id}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-content">Nenhum incidente vinculado</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="glass-panel animate-slide-up">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Histórico de Atividades</h2>
                <div className="space-y-4">
                  {change.timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4 animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          event.type === 'approval' ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400' :
                          event.type === 'cab_vote' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                          event.type === 'implementation' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' :
                          'bg-neutral-100 dark:bg-neutral-800 text-description'
                        }`}>
                          {event.type === 'approval' ? <CheckCircleIcon className="w-4 h-4" /> :
                           event.type === 'cab_vote' ? <UserGroupIcon className="w-4 h-4" /> :
                           event.type === 'implementation' ? <RocketLaunchIcon className="w-4 h-4" /> :
                           event.type === 'comment' ? <ChatBubbleLeftRightIcon className="w-4 h-4" /> :
                           <ArrowPathIcon className="w-4 h-4" />}
                        </div>
                        {index < change.timeline.length - 1 && (
                          <div className="w-0.5 h-full bg-neutral-200 dark:bg-neutral-700 mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-neutral-900 dark:text-neutral-100">{event.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-content">
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
            <div className="glass-panel animate-slide-up">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Ações</h3>
              <div className="space-y-2">
                {change.status === 'scheduled' && (
                  <button className="w-full px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2">
                    <PlayIcon className="w-4 h-4" />
                    Iniciar Execução
                  </button>
                )}
                {change.status === 'in_progress' && (
                  <>
                    <button className="w-full px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2">
                      <CheckCircleIcon className="w-4 h-4" />
                      Concluir com Sucesso
                    </button>
                    <button className="w-full px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2">
                      <XCircleIcon className="w-4 h-4" />
                      Marcar como Falha
                    </button>
                    <button className="w-full px-4 py-2 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-lg text-sm font-medium hover:bg-warning-200 dark:hover:bg-warning-900/50 transition-all flex items-center justify-center gap-2">
                      <ArrowUturnLeftIcon className="w-4 h-4" />
                      Executar Rollback
                    </button>
                  </>
                )}
                <button className="w-full px-4 py-2 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg text-sm font-medium hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-all flex items-center justify-center gap-2">
                  <PencilIcon className="w-4 h-4" />
                  Editar RFC
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="glass-panel animate-slide-up delay-75">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Informações</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-content">Responsável</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{change.assigned_name || 'Não atribuído'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-content">Solicitante</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{change.created_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-content">Criado em</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatDate(change.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-content">Atualizado</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatDate(change.updated_at)}</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-panel animate-slide-up delay-150">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Métricas</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg transition-all hover:shadow-md">
                  <p className="text-2xl font-bold text-danger-600 dark:text-danger-400">{change.affected_services.length}</p>
                  <p className="text-xs text-muted-content">Serviços</p>
                </div>
                <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg transition-all hover:shadow-md">
                  <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{change.affected_cis.length}</p>
                  <p className="text-xs text-muted-content">CIs</p>
                </div>
                <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg transition-all hover:shadow-md">
                  <p className="text-2xl font-bold text-success-600 dark:text-success-400">{change.approvals.filter(a => a.status === 'approved').length}</p>
                  <p className="text-xs text-muted-content">Aprovações</p>
                </div>
                <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg transition-all hover:shadow-md">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{change.cab_votes.length}</p>
                  <p className="text-xs text-muted-content">Votos CAB</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t shadow-lg p-3 sm:hidden safe-bottom animate-slide-up">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/changes')}
            className="flex-1 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-lg transition-all hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            Voltar
          </button>
          {change.status === 'scheduled' && (
            <button className="flex-1 py-2.5 text-sm font-medium text-white bg-success-600 hover:bg-success-700 rounded-lg transition-all">
              Iniciar
            </button>
          )}
          {change.status !== 'scheduled' && (
            <button className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-all">
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
