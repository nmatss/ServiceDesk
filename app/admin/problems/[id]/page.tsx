'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ExclamationTriangleIcon,
  ArrowLeftIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  LinkIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  BeakerIcon,
  LightBulbIcon,
  BookOpenIcon,
  TagIcon,
  ServerIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import { ExclamationTriangleIcon as ExclamationTriangleSolid } from '@heroicons/react/24/solid'

interface Problem {
  id: string
  title: string
  description: string
  status: 'new' | 'investigation' | 'root_cause_identified' | 'known_error' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: string
  assigned_to: string | null
  assigned_name: string | null
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  root_cause: string | null
  workaround: string | null
  permanent_solution: string | null
  impact: string | null
  affected_services: string[]
  related_incidents: number[]
  related_changes: number[]
  affected_cis: Array<{ id: string; name: string; type: string }>
  timeline: Array<{
    id: string
    type: 'status_change' | 'comment' | 'assignment' | 'rca_update' | 'workaround_added'
    content: string
    user: string
    timestamp: string
  }>
}

export default function ProblemDetailPage() {
  const router = useRouter()
  const params = useParams()
  const problemId = params.id as string

  const [problem, setProblem] = useState<Problem | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'rca' | 'incidents' | 'changes' | 'timeline'>('details')
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    fetchProblem()
  }, [problemId])

  const fetchProblem = async () => {
    setLoading(true)
    try {
      // Simulated data - would be API call in production
      await new Promise(resolve => setTimeout(resolve, 300))

      setProblem({
        id: problemId,
        title: 'Lentidão intermitente no sistema ERP',
        description: 'Usuários relatam lentidão significativa no módulo financeiro do ERP durante horários de pico (9h-11h e 14h-16h). O problema afeta aproximadamente 150 usuários e causa atrasos nas operações diárias.',
        status: 'root_cause_identified',
        priority: 'high',
        category: 'Performance',
        assigned_to: 'user_2',
        assigned_name: 'Carlos Silva',
        created_by: 'user_1',
        created_by_name: 'Maria Santos',
        created_at: '2024-12-10T10:30:00Z',
        updated_at: '2024-12-14T09:15:00Z',
        resolved_at: null,
        root_cause: 'Análise identificou que o banco de dados está com índices fragmentados e queries não otimizadas no módulo de relatórios financeiros. Durante horários de pico, o processamento de relatórios concorrentes causa locks extensos nas tabelas principais.',
        workaround: '1. Executar relatórios pesados fora do horário de pico (antes das 9h ou após as 18h)\n2. Limitar a 5 usuários simultâneos no módulo de relatórios\n3. Usar a versão resumida dos relatórios quando possível',
        permanent_solution: 'Plano de ação:\n1. Reconstruir índices do banco de dados (agendado para próximo domingo)\n2. Otimizar queries do módulo de relatórios\n3. Implementar cache de consultas frequentes\n4. Considerar separação de banco para relatórios (read replica)',
        impact: 'Alto impacto no departamento financeiro. Atrasos de 2-3 horas nas operações diárias. Risco de perda de prazos fiscais.',
        affected_services: ['ERP Financeiro', 'Relatórios Gerenciais', 'BI Dashboard'],
        related_incidents: [1234, 1256, 1278, 1290, 1302],
        related_changes: [456],
        affected_cis: [
          { id: 'ci_1', name: 'SRV-ERP-01', type: 'server' },
          { id: 'ci_2', name: 'DB-ERP-PROD', type: 'database' },
          { id: 'ci_3', name: 'ERP-APP-CLUSTER', type: 'application' }
        ],
        timeline: [
          {
            id: '1',
            type: 'status_change',
            content: 'Problema criado a partir de incidentes recorrentes',
            user: 'Maria Santos',
            timestamp: '2024-12-10T10:30:00Z'
          },
          {
            id: '2',
            type: 'assignment',
            content: 'Atribuído para Carlos Silva (Especialista em Performance)',
            user: 'Maria Santos',
            timestamp: '2024-12-10T11:00:00Z'
          },
          {
            id: '3',
            type: 'status_change',
            content: 'Status alterado para: Em Investigação',
            user: 'Carlos Silva',
            timestamp: '2024-12-10T14:00:00Z'
          },
          {
            id: '4',
            type: 'comment',
            content: 'Iniciando análise de logs e métricas de performance do servidor ERP',
            user: 'Carlos Silva',
            timestamp: '2024-12-11T09:00:00Z'
          },
          {
            id: '5',
            type: 'workaround_added',
            content: 'Workaround documentado: Limitar uso de relatórios em horário de pico',
            user: 'Carlos Silva',
            timestamp: '2024-12-12T15:30:00Z'
          },
          {
            id: '6',
            type: 'rca_update',
            content: 'Causa raiz identificada: Índices fragmentados e queries não otimizadas',
            user: 'Carlos Silva',
            timestamp: '2024-12-13T11:00:00Z'
          },
          {
            id: '7',
            type: 'status_change',
            content: 'Status alterado para: Causa Raiz Identificada',
            user: 'Carlos Silva',
            timestamp: '2024-12-13T11:05:00Z'
          }
        ]
      })
    } catch (error) {
      console.error('Error fetching problem:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
      case 'investigation': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'root_cause_identified': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'known_error': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'resolved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'closed': return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Novo'
      case 'investigation': return 'Em Investigação'
      case 'root_cause_identified': return 'Causa Raiz Identificada'
      case 'known_error': return 'Erro Conhecido'
      case 'resolved': return 'Resolvido'
      case 'closed': return 'Fechado'
      default: return status
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
    }
  }

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'status_change': return <ArrowPathIcon className="w-4 h-4" />
      case 'comment': return <ChatBubbleLeftRightIcon className="w-4 h-4" />
      case 'assignment': return <UserIcon className="w-4 h-4" />
      case 'rca_update': return <BeakerIcon className="w-4 h-4" />
      case 'workaround_added': return <LightBulbIcon className="w-4 h-4" />
      default: return <DocumentTextIcon className="w-4 h-4" />
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

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 dark:border-brand-400"></div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationCircleIcon className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Problema não encontrado</h2>
          <button
            onClick={() => router.push('/admin/problems')}
            className="mt-4 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Voltar para lista
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'details', label: 'Detalhes', icon: DocumentTextIcon },
    { id: 'rca', label: 'RCA & Solução', icon: BeakerIcon },
    { id: 'incidents', label: `Incidentes (${problem.related_incidents.length})`, icon: ExclamationTriangleIcon },
    { id: 'changes', label: `Mudanças (${problem.related_changes.length})`, icon: ArrowPathIcon },
    { id: 'timeline', label: 'Histórico', icon: ClockIcon }
  ]

  return (
    <>
      <div className="space-y-6 animate-fade-in pb-6">
      {/* Header */}
      <div className="glass-panel">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.push('/admin/problems')}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-description" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-content mb-1">
              <span>Problema</span>
              <ChevronRightIcon className="w-4 h-4" />
              <span className="font-mono font-semibold">PRB-{problem.id}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate">
              {problem.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(problem.status)}`}>
            {getStatusLabel(problem.status)}
          </span>
          <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getPriorityColor(problem.priority)}`}>
            {problem.priority.toUpperCase()}
          </span>
          <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
            {problem.category}
          </span>
          {problem.workaround && (
            <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 flex items-center gap-2">
              <LightBulbIcon className="w-4 h-4" />
              Workaround disponível
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide border-t border-neutral-200 dark:border-neutral-700 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-description hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <>
              <div className="glass-panel animate-slide-up">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-brand-500" />
                  Descrição
                </h2>
                <p className="text-description whitespace-pre-wrap">{problem.description}</p>
              </div>

              {problem.impact && (
                <div className="glass-panel bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800 animate-slide-up">
                  <h2 className="font-semibold text-error-800 dark:text-error-400 mb-3 flex items-center gap-2">
                    <ExclamationTriangleSolid className="w-5 h-5" />
                    Impacto no Negócio
                  </h2>
                  <p className="text-error-700 dark:text-error-300">{problem.impact}</p>
                </div>
              )}

                <div className="glass-panel animate-slide-up">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Serviços Afetados</h2>
                  <div className="flex flex-wrap gap-2">
                    {problem.affected_services.map((service, index) => (
                      <span key={index} className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="glass-panel animate-slide-up">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                    <ServerIcon className="w-5 h-5 text-icon-muted" />
                    CIs Afetados
                  </h2>
                  <div className="space-y-2">
                    {problem.affected_cis.map(ci => (
                      <div
                        key={ci.id}
                        onClick={() => router.push(`/admin/cmdb/${ci.id}`)}
                        className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer transition-colors"
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
              </>
            )}

            {/* RCA Tab */}
            {activeTab === 'rca' && (
              <>
                <div className="glass-panel animate-slide-up">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <BeakerIcon className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                    Análise de Causa Raiz (RCA)
                  </h2>
                  {problem.root_cause ? (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{problem.root_cause}</p>
                    </div>
                  ) : (
                    <p className="text-muted-content italic">Causa raiz ainda não identificada</p>
                  )}
                </div>

                <div className="glass-panel animate-slide-up">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <LightBulbIcon className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                    Workaround
                  </h2>
                  {problem.workaround ? (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{problem.workaround}</p>
                    </div>
                  ) : (
                    <p className="text-muted-content italic">Nenhum workaround documentado</p>
                  )}
                </div>

                <div className="glass-panel animate-slide-up">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
                    Solução Permanente
                  </h2>
                  {problem.permanent_solution ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{problem.permanent_solution}</p>
                    </div>
                  ) : (
                    <p className="text-muted-content italic">Solução permanente ainda não definida</p>
                  )}
                </div>

                {problem.status === 'known_error' && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 sm:p-6 animate-slide-up">
                    <div className="flex items-center gap-3 mb-3">
                      <BookOpenIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      <div>
                        <h2 className="font-semibold text-purple-800 dark:text-purple-300">Erro Conhecido (KEDB)</h2>
                        <p className="text-sm text-purple-600 dark:text-purple-400">Este problema foi registrado na base de erros conhecidos</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/admin/problems/kedb')}
                      className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium transition-colors"
                    >
                      Ver no KEDB →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Incidents Tab */}
            {activeTab === 'incidents' && (
              <div className="glass-panel animate-slide-up">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Incidentes Relacionados</h2>
                  <button className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 transition-colors">
                    <PlusIcon className="w-4 h-4" />
                    Vincular
                  </button>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {problem.related_incidents.map(incidentId => (
                    <div
                      key={incidentId}
                      onClick={() => router.push(`/tickets/${incidentId}`)}
                      className="p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">INC-{incidentId}</p>
                          <p className="text-sm text-muted-content">Lentidão no ERP - Módulo Financeiro</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Resolvido
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Changes Tab */}
            {activeTab === 'changes' && (
              <div className="glass-panel animate-slide-up">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Mudanças Relacionadas</h2>
                  <button className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 flex items-center gap-1 transition-colors">
                    <PlusIcon className="w-4 h-4" />
                    Criar RFC
                  </button>
                </div>
                {problem.related_changes.length > 0 ? (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {problem.related_changes.map(changeId => (
                      <div
                        key={changeId}
                        onClick={() => router.push(`/admin/changes/${changeId}`)}
                        className="p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ArrowPathIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-neutral-100">CHG-{changeId}</p>
                            <p className="text-sm text-muted-content">Otimização de índices do banco ERP</p>
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                          Agendada
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-content">
                    <ArrowPathIcon className="w-12 h-12 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
                    <p>Nenhuma mudança vinculada</p>
                    <button className="mt-2 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm transition-colors">
                      Criar RFC para este problema
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="glass-panel animate-slide-up">
                <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-brand-500" />
                  Histórico de Atividades
                </h2>
                <div className="space-y-6">
                  {problem.timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${
                          event.type === 'rca_update' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                          event.type === 'workaround_added' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                          event.type === 'status_change' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' :
                          event.type === 'assignment' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400' :
                          'bg-neutral-100 dark:bg-neutral-800 text-description'
                        }`}>
                          {getTimelineIcon(event.type)}
                        </div>
                        {index < problem.timeline.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gradient-to-b from-neutral-300 to-transparent dark:from-neutral-600 mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="glass-panel !p-4 hover:shadow-md transition-shadow">
                          <p className="text-neutral-900 dark:text-neutral-100 font-medium">{event.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-content">
                            <UserIcon className="w-4 h-4" />
                            <span className="font-medium">{event.user}</span>
                            <span>•</span>
                            <ClockIcon className="w-4 h-4" />
                            <span>{formatDate(event.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Comment */}
                <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="w-5 h-5 text-brand-500" />
                    Adicionar Comentário
                  </h3>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Descreva as ações realizadas, descobertas ou próximos passos..."
                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                    rows={4}
                  />
                  <button
                    className="mt-3 btn btn-primary"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Adicionar ao Histórico
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Actions */}
            <div className="glass-panel animate-slide-up">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Ações Rápidas</h3>
              <div className="space-y-2">
                <button className="btn btn-primary w-full justify-center">
                  <PencilIcon className="w-4 h-4 mr-2" />
                  Editar Problema
                </button>
                {problem.status !== 'known_error' && problem.root_cause && (
                  <button className="btn btn-secondary w-full justify-center bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30">
                    <BookOpenIcon className="w-4 h-4 mr-2" />
                    Promover para KEDB
                  </button>
                )}
                <button className="btn btn-secondary w-full justify-center">
                  <ArrowPathIcon className="w-4 h-4 mr-2" />
                  Criar RFC
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="glass-panel animate-slide-up">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Informações do Problema</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-content">Responsável</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{problem.assigned_name || 'Não atribuído'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-content">Criado por</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{problem.created_by_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-content">Criado em</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatDate(problem.created_at)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-content">Atualizado</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatDate(problem.updated_at)}</span>
                </div>
                {problem.resolved_at && (
                  <div className="flex justify-between items-center pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span className="text-muted-content">Resolvido em</span>
                    <span className="font-medium text-success-600 dark:text-success-400">{formatDate(problem.resolved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-panel animate-slide-up">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Métricas do Problema</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800">
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{problem.related_incidents.length}</p>
                  <p className="text-xs text-orange-700 dark:text-orange-500 font-medium mt-1">Incidentes</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/10 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{problem.related_changes.length}</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-500 font-medium mt-1">Mudanças</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-900/10 rounded-xl border border-brand-200 dark:border-brand-800">
                  <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">{problem.affected_cis.length}</p>
                  <p className="text-xs text-brand-700 dark:text-brand-500 font-medium mt-1">CIs Afetados</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <p className="text-3xl font-bold text-description">
                    {Math.ceil((new Date().getTime() - new Date(problem.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                  </p>
                  <p className="text-xs text-neutral-700 dark:text-neutral-500 font-medium mt-1">Dias Aberto</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t shadow-2xl p-3 sm:hidden safe-bottom z-50">
        {/* Mobile Bottom Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/problems')}
            className="btn btn-secondary flex-1"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Voltar
          </button>
          <button
            className="btn btn-primary flex-1"
          >
            <PencilIcon className="w-4 h-4 mr-2" />
            Editar
          </button>
        </div>
      </div>
    </>
  )
}
