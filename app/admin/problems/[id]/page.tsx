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
      case 'new': return 'bg-blue-100 text-blue-700'
      case 'investigation': return 'bg-yellow-100 text-yellow-700'
      case 'root_cause_identified': return 'bg-orange-100 text-orange-700'
      case 'known_error': return 'bg-purple-100 text-purple-700'
      case 'resolved': return 'bg-green-100 text-green-700'
      case 'closed': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
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
      case 'low': return 'bg-green-100 text-green-700'
      case 'medium': return 'bg-yellow-100 text-yellow-700'
      case 'high': return 'bg-orange-100 text-orange-700'
      case 'critical': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Problema não encontrado</h2>
          <button
            onClick={() => router.push('/admin/problems')}
            className="mt-4 text-purple-600 hover:text-purple-700"
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
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/admin/problems')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span>Problema</span>
                <ChevronRightIcon className="w-4 h-4" />
                <span className="font-mono">PRB-{problem.id}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {problem.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(problem.status)}`}>
              {getStatusLabel(problem.status)}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(problem.priority)}`}>
              {problem.priority.toUpperCase()}
            </span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
              {problem.category}
            </span>
            {problem.workaround && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                <LightBulbIcon className="w-4 h-4" />
                Workaround disponível
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Details Tab */}
            {activeTab === 'details' && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3">Descrição</h2>
                  <p className="text-gray-600 whitespace-pre-wrap">{problem.description}</p>
                </div>

                {problem.impact && (
                  <div className="bg-red-50 rounded-xl border border-red-200 p-4 sm:p-6">
                    <h2 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                      <ExclamationTriangleSolid className="w-5 h-5" />
                      Impacto
                    </h2>
                    <p className="text-red-700">{problem.impact}</p>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-4">Serviços Afetados</h2>
                  <div className="flex flex-wrap gap-2">
                    {problem.affected_services.map((service, index) => (
                      <span key={index} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm">
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
                    {problem.affected_cis.map(ci => (
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
              </>
            )}

            {/* RCA Tab */}
            {activeTab === 'rca' && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BeakerIcon className="w-5 h-5 text-orange-500" />
                    Análise de Causa Raiz (RCA)
                  </h2>
                  {problem.root_cause ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{problem.root_cause}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Causa raiz ainda não identificada</p>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <LightBulbIcon className="w-5 h-5 text-yellow-500" />
                    Workaround
                  </h2>
                  {problem.workaround ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{problem.workaround}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Nenhum workaround documentado</p>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    Solução Permanente
                  </h2>
                  {problem.permanent_solution ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{problem.permanent_solution}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Solução permanente ainda não definida</p>
                  )}
                </div>

                {problem.status === 'known_error' && (
                  <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <BookOpenIcon className="w-6 h-6 text-purple-600" />
                      <div>
                        <h2 className="font-semibold text-purple-800">Erro Conhecido (KEDB)</h2>
                        <p className="text-sm text-purple-600">Este problema foi registrado na base de erros conhecidos</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/admin/problems/kedb')}
                      className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                    >
                      Ver no KEDB →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Incidents Tab */}
            {activeTab === 'incidents' && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Incidentes Relacionados</h2>
                  <button className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
                    <PlusIcon className="w-4 h-4" />
                    Vincular
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {problem.related_incidents.map(incidentId => (
                    <div
                      key={incidentId}
                      onClick={() => router.push(`/tickets/${incidentId}`)}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <ExclamationTriangleIcon className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="font-medium text-gray-900">INC-{incidentId}</p>
                          <p className="text-sm text-gray-500">Lentidão no ERP - Módulo Financeiro</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        Resolvido
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Changes Tab */}
            {activeTab === 'changes' && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Mudanças Relacionadas</h2>
                  <button className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
                    <PlusIcon className="w-4 h-4" />
                    Criar RFC
                  </button>
                </div>
                {problem.related_changes.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {problem.related_changes.map(changeId => (
                      <div
                        key={changeId}
                        onClick={() => router.push(`/admin/changes/${changeId}`)}
                        className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <ArrowPathIcon className="w-5 h-5 text-indigo-500" />
                          <div>
                            <p className="font-medium text-gray-900">CHG-{changeId}</p>
                            <p className="text-sm text-gray-500">Otimização de índices do banco ERP</p>
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                          Agendada
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <ArrowPathIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Nenhuma mudança vinculada</p>
                    <button className="mt-2 text-purple-600 hover:text-purple-700 text-sm">
                      Criar RFC para este problema
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Histórico de Atividades</h2>
                <div className="space-y-4">
                  {problem.timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          event.type === 'rca_update' ? 'bg-orange-100 text-orange-600' :
                          event.type === 'workaround_added' ? 'bg-yellow-100 text-yellow-600' :
                          event.type === 'status_change' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getTimelineIcon(event.type)}
                        </div>
                        {index < problem.timeline.length - 1 && (
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

                {/* Add Comment */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-2">Adicionar Comentário</h3>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Digite seu comentário..."
                    className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                  />
                  <button
                    className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                  >
                    Enviar
                  </button>
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
                <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
                  <PencilIcon className="w-4 h-4" />
                  Editar Problema
                </button>
                {problem.status !== 'known_error' && problem.root_cause && (
                  <button className="w-full px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 flex items-center justify-center gap-2">
                    <BookOpenIcon className="w-4 h-4" />
                    Promover para KEDB
                  </button>
                )}
                <button className="w-full px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-4 h-4" />
                  Criar RFC
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Informações</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Responsável</span>
                  <span className="font-medium text-gray-900">{problem.assigned_name || 'Não atribuído'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Criado por</span>
                  <span className="font-medium text-gray-900">{problem.created_by_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Criado em</span>
                  <span className="font-medium text-gray-900">{formatDate(problem.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Atualizado</span>
                  <span className="font-medium text-gray-900">{formatDate(problem.updated_at)}</span>
                </div>
                {problem.resolved_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Resolvido em</span>
                    <span className="font-medium text-gray-900">{formatDate(problem.resolved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Métricas</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{problem.related_incidents.length}</p>
                  <p className="text-xs text-gray-500">Incidentes</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-indigo-600">{problem.related_changes.length}</p>
                  <p className="text-xs text-gray-500">Mudanças</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{problem.affected_cis.length}</p>
                  <p className="text-xs text-gray-500">CIs Afetados</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.ceil((new Date().getTime() - new Date(problem.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                  </p>
                  <p className="text-xs text-gray-500">Dias aberto</p>
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
            onClick={() => router.push('/admin/problems')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Voltar
          </button>
          <button
            className="flex-1 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}
