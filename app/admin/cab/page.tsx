'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserGroupIcon,
  CalendarDaysIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ArrowPathIcon,
  PlayIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  VideoCameraIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  MinusIcon
} from '@heroicons/react/24/outline'
import { UserGroupIcon as UserGroupSolid } from '@heroicons/react/24/solid'

interface CABMeeting {
  id: string
  title: string
  scheduled_date: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  attendees: Array<{ name: string; role: string; present?: boolean }>
  changes: Array<{
    id: string
    title: string
    category: 'standard' | 'normal' | 'emergency'
    risk_level: number
    decision: 'pending' | 'approved' | 'rejected' | 'deferred' | null
    votes: { approve: number; reject: number; abstain: number }
  }>
  notes: string | null
  meeting_link: string | null
}

interface UpcomingChange {
  id: string
  title: string
  category: 'standard' | 'normal' | 'emergency'
  risk_level: number
  requester: string
  scheduled_date: string | null
}

export default function CABPage() {
  const router = useRouter()
  const [meetings, setMeetings] = useState<CABMeeting[]>([])
  const [pendingChanges, setPendingChanges] = useState<UpcomingChange[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'history'>('upcoming')
  const [selectedMeeting, setSelectedMeeting] = useState<CABMeeting | null>(null)

  useEffect(() => {
    fetchCABData()
  }, [])

  const fetchCABData = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 300))

      setMeetings([
        {
          id: '1',
          title: 'CAB Meeting - Semana 51',
          scheduled_date: '2024-12-18T14:00:00Z',
          status: 'scheduled',
          attendees: [
            { name: 'Maria Santos', role: 'Gerente de TI' },
            { name: 'João Oliveira', role: 'DBA Lead' },
            { name: 'Ana Costa', role: 'Security Officer' },
            { name: 'Pedro Almeida', role: 'DevOps Lead' },
            { name: 'Fernanda Silva', role: 'Gerente de Operações' }
          ],
          changes: [
            {
              id: '457',
              title: 'Atualização de segurança do firewall',
              category: 'normal',
              risk_level: 4,
              decision: null,
              votes: { approve: 0, reject: 0, abstain: 0 }
            },
            {
              id: '458',
              title: 'Migração de servidor de arquivos',
              category: 'normal',
              risk_level: 3,
              decision: null,
              votes: { approve: 0, reject: 0, abstain: 0 }
            }
          ],
          notes: null,
          meeting_link: 'https://meet.empresa.com/cab-weekly'
        },
        {
          id: '2',
          title: 'CAB Meeting - Semana 50',
          scheduled_date: '2024-12-13T14:00:00Z',
          status: 'completed',
          attendees: [
            { name: 'Maria Santos', role: 'Gerente de TI', present: true },
            { name: 'João Oliveira', role: 'DBA Lead', present: true },
            { name: 'Ana Costa', role: 'Security Officer', present: true },
            { name: 'Pedro Almeida', role: 'DevOps Lead', present: false },
            { name: 'Fernanda Silva', role: 'Gerente de Operações', present: true }
          ],
          changes: [
            {
              id: '456',
              title: 'Otimização de índices do banco ERP',
              category: 'normal',
              risk_level: 3,
              decision: 'approved',
              votes: { approve: 3, reject: 0, abstain: 1 }
            },
            {
              id: '455',
              title: 'Atualização do sistema de backup',
              category: 'standard',
              risk_level: 2,
              decision: 'approved',
              votes: { approve: 4, reject: 0, abstain: 0 }
            }
          ],
          notes: 'Todas as mudanças foram aprovadas. CHG-456 agendada para domingo 15/12.',
          meeting_link: null
        },
        {
          id: '3',
          title: 'CAB Emergency - CHG-450',
          scheduled_date: '2024-12-10T08:00:00Z',
          status: 'completed',
          attendees: [
            { name: 'Maria Santos', role: 'Gerente de TI', present: true },
            { name: 'João Oliveira', role: 'DBA Lead', present: true }
          ],
          changes: [
            {
              id: '450',
              title: 'Hotfix crítico de segurança',
              category: 'emergency',
              risk_level: 4,
              decision: 'approved',
              votes: { approve: 2, reject: 0, abstain: 0 }
            }
          ],
          notes: 'Aprovação emergencial devido a vulnerabilidade crítica. Implementado imediatamente.',
          meeting_link: null
        }
      ])

      setPendingChanges([
        {
          id: '459',
          title: 'Upgrade do cluster Kubernetes',
          category: 'normal',
          risk_level: 4,
          requester: 'Pedro Almeida',
          scheduled_date: null
        },
        {
          id: '460',
          title: 'Implementação de CDN',
          category: 'normal',
          risk_level: 2,
          requester: 'Carlos Silva',
          scheduled_date: null
        }
      ])
    } catch (error) {
      console.error('Error fetching CAB data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700'
      case 'in_progress': return 'bg-yellow-100 text-yellow-700'
      case 'completed': return 'bg-green-100 text-green-700'
      case 'cancelled': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendada'
      case 'in_progress': return 'Em Andamento'
      case 'completed': return 'Concluída'
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

  const getDecisionColor = (decision: string | null) => {
    switch (decision) {
      case 'approved': return 'bg-green-100 text-green-700'
      case 'rejected': return 'bg-red-100 text-red-700'
      case 'deferred': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const upcomingMeetings = meetings.filter(m => m.status === 'scheduled' || m.status === 'in_progress')
  const pastMeetings = meetings.filter(m => m.status === 'completed' || m.status === 'cancelled')

  const stats = {
    upcoming: upcomingMeetings.length,
    pending: pendingChanges.length,
    approved: meetings.flatMap(m => m.changes).filter(c => c.decision === 'approved').length,
    rejected: meetings.flatMap(m => m.changes).filter(c => c.decision === 'rejected').length
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                <UserGroupSolid className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                Change Advisory Board
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Gerenciamento de reuniões e aprovações de mudanças
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/admin/changes')}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Ver Mudanças
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Nova Reunião
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-px overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
                activeTab === 'upcoming'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Próximas Reuniões ({upcomingMeetings.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
                activeTab === 'pending'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Aguardando CAB ({pendingChanges.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Histórico
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Reuniões Agendadas</p>
            <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Aguardando CAB</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Aprovadas (30d)</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Rejeitadas (30d)</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Upcoming Meetings */}
            {activeTab === 'upcoming' && (
              <div className="space-y-4">
                {upcomingMeetings.map(meeting => (
                  <div key={meeting.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-gray-200">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(meeting.status)}`}>
                              {getStatusLabel(meeting.status)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900">{meeting.title}</h3>
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <CalendarDaysIcon className="w-4 h-4" />
                            {formatDate(meeting.scheduled_date)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {meeting.meeting_link && (
                            <a
                              href={meeting.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-2"
                            >
                              <VideoCameraIcon className="w-4 h-4" />
                              Entrar
                            </a>
                          )}
                          <button
                            onClick={() => setSelectedMeeting(meeting)}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                          >
                            Detalhes
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Attendees */}
                    <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Participantes ({meeting.attendees.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {meeting.attendees.map((attendee, index) => (
                          <span key={index} className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700">
                            {attendee.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Changes to Review */}
                    <div className="p-4 sm:p-6">
                      <p className="text-sm font-medium text-gray-700 mb-3">Mudanças para Análise ({meeting.changes.length})</p>
                      <div className="space-y-2">
                        {meeting.changes.map(change => (
                          <div
                            key={change.id}
                            onClick={() => router.push(`/admin/changes/${change.id}`)}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <ArrowPathIcon className="w-5 h-5 text-indigo-500" />
                              <div>
                                <p className="font-medium text-gray-900">CHG-{change.id}</p>
                                <p className="text-sm text-gray-500">{change.title}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(change.category)}`}>
                                {change.category}
                              </span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(level => (
                                  <div
                                    key={level}
                                    className={`w-2 h-4 rounded ${
                                      level <= change.risk_level
                                        ? change.risk_level <= 2 ? 'bg-green-500' :
                                          change.risk_level <= 3 ? 'bg-yellow-500' :
                                          change.risk_level <= 4 ? 'bg-orange-500' : 'bg-red-500'
                                        : 'bg-gray-200'
                                    }`}
                                  />
                                ))}
                              </div>
                              <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {upcomingMeetings.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <CalendarDaysIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-medium text-gray-900">Nenhuma reunião agendada</h3>
                    <button className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                      Agendar Reunião
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Pending Changes */}
            {activeTab === 'pending' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Mudanças Aguardando Revisão do CAB</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {pendingChanges.map(change => (
                    <div
                      key={change.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <ArrowPathIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">CHG-{change.id}: {change.title}</p>
                          <p className="text-sm text-gray-500">Solicitante: {change.requester}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(change.category)}`}>
                          {change.category}
                        </span>
                        <button
                          onClick={() => router.push(`/admin/changes/${change.id}`)}
                          className="text-indigo-600 hover:text-indigo-700"
                        >
                          <ChevronRightIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {pendingChanges.length === 0 && (
                  <div className="p-8 text-center">
                    <CheckCircleIcon className="w-12 h-12 text-green-300 mx-auto mb-3" />
                    <h3 className="font-medium text-gray-900">Nenhuma mudança pendente</h3>
                    <p className="text-sm text-gray-500">Todas as mudanças foram revisadas</p>
                  </div>
                )}
              </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {pastMeetings.map(meeting => (
                  <div key={meeting.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(meeting.status)}`}>
                              {getStatusLabel(meeting.status)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900">{meeting.title}</h3>
                          <p className="text-sm text-gray-500">{formatShortDate(meeting.scheduled_date)}</p>
                        </div>
                        <button
                          onClick={() => setSelectedMeeting(meeting)}
                          className="text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          Ver Detalhes
                        </button>
                      </div>

                      {/* Decisions */}
                      <div className="mt-4 space-y-2">
                        {meeting.changes.map(change => (
                          <div key={change.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-gray-500">CHG-{change.id}</span>
                              <span className="text-sm text-gray-900 truncate">{change.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${getDecisionColor(change.decision)}`}>
                                {change.decision === 'approved' ? 'Aprovada' :
                                 change.decision === 'rejected' ? 'Rejeitada' :
                                 change.decision === 'deferred' ? 'Adiada' : 'Pendente'}
                              </span>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <HandThumbUpIcon className="w-3 h-3" />
                                {change.votes.approve}
                                <HandThumbDownIcon className="w-3 h-3 ml-1" />
                                {change.votes.reject}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {meeting.notes && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">{meeting.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-3 sm:hidden safe-bottom">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/changes')}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
          >
            Mudanças
          </button>
          <button
            className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg flex items-center justify-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Nova Reunião
          </button>
        </div>
      </div>
    </div>
  )
}
