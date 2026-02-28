'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
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
import PageHeader from '@/components/ui/PageHeader'

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
      // Fetch CAB meetings from API
      const response = await fetch('/api/cab')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar reuniões do CAB')
      }

      if (data.success && data.meetings) {
        // Transform API data to match component interface
        const transformedMeetings: CABMeeting[] = await Promise.all(
          data.meetings.map(async (meeting: any) => {
            // Fetch change requests for this meeting
            let changes: any[] = []
            try {
              const changesRes = await fetch(`/api/changes?cab_meeting_id=${meeting.id}`)
              const changesData = await changesRes.json()
              // API returns { success, change_requests: [...] }
              const changesList = changesData.change_requests || changesData.changes || []
              if (changesData.success && changesList.length > 0) {
                const riskLevelMap: Record<string, number> = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 }
                changes = changesList.map((change: any) => ({
                  id: change.id.toString(),
                  title: change.title,
                  category: change.category || 'normal',
                  risk_level: typeof change.risk_level === 'number' ? change.risk_level : (riskLevelMap[change.risk_level] || 3),
                  decision: change.cab_decision || null,
                  votes: {
                    approve: change.cab_votes_approve || 0,
                    reject: change.cab_votes_reject || 0,
                    abstain: change.cab_votes_abstain || 0
                  }
                }))
              }
            } catch (err) {
              console.error('Error fetching changes for meeting:', err)
            }

            // For now, use mock attendees since we don't have attendees in the API response
            // In production, you would fetch this from a cab_attendees table
            const attendees = [
              { name: 'CAB Member 1', role: 'Manager' },
              { name: 'CAB Member 2', role: 'Technical Lead' }
            ]

            return {
              id: meeting.id.toString(),
              title: meeting.title,
              scheduled_date: `${meeting.scheduled_date}T${meeting.scheduled_time || '00:00:00'}Z`,
              status: meeting.status,
              attendees,
              changes,
              notes: meeting.notes || null,
              meeting_link: meeting.meeting_url || null
            }
          })
        )

        setMeetings(transformedMeetings)
      }

      // Fetch pending changes (changes without CAB meeting assignment)
      try {
        const pendingRes = await fetch('/api/changes?status=pending_cab&limit=50')
        const pendingData = await pendingRes.json()

        // API returns { success, change_requests: [...] }
        const pendingChangesList = pendingData.change_requests || pendingData.changes || []
        if (pendingData.success && pendingChangesList.length > 0) {
          const transformedPending: UpcomingChange[] = pendingChangesList
            .filter((c: any) => !c.cab_meeting_id)
            .map((change: any) => ({
              id: change.id.toString(),
              title: change.title,
              category: change.category || 'normal',
              risk_level: typeof change.risk_level === 'number' ? change.risk_level : 3,
              requester: change.requester_name || 'Desconhecido',
              scheduled_date: change.scheduled_start_date || null
            }))

          setPendingChanges(transformedPending)
        }
      } catch (err) {
        console.error('Error fetching pending changes:', err)
        setPendingChanges([])
      }
    } catch (error) {
      console.error('Error fetching CAB data:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar dados do CAB')
      // Set empty data on error
      setMeetings([])
      setPendingChanges([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
      case 'in_progress': return 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-300'
      case 'completed': return 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-300'
      case 'cancelled': return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
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
      case 'standard': return 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-300'
      case 'normal': return 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
      case 'emergency': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
    }
  }

  const getDecisionColor = (decision: string | null) => {
    switch (decision) {
      case 'approved': return 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-300'
      case 'rejected': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
      case 'deferred': return 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-300'
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
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
    <div className="pb-6 animate-fade-in">
      {/* Header */}
      <div className="glass-panel mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <PageHeader
            title="Change Advisory Board"
            description="Gerenciamento de reuniões e aprovações de mudanças"
            icon={UserGroupSolid}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'CAB' }
            ]}
            actions={[
              {
                label: 'Ver Mudanças',
                onClick: () => router.push('/admin/changes'),
                variant: 'secondary'
              },
              {
                label: 'Nova Reunião',
                onClick: () => toast.error('Criação de reuniões CAB ainda não implementada'),
                variant: 'primary',
                icon: PlusIcon
              }
            ]}
          />

          {/* Tabs */}
          <div className="flex gap-1 mt-6 -mb-px overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-all duration-200 ${
                activeTab === 'upcoming'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 border-b-2 border-brand-600 dark:border-brand-400'
                  : 'text-description hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Próximas Reuniões ({upcomingMeetings.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-all duration-200 ${
                activeTab === 'pending'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 border-b-2 border-brand-600 dark:border-brand-400'
                  : 'text-description hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Aguardando CAB ({pendingChanges.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-all duration-200 ${
                activeTab === 'history'
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300 border-b-2 border-brand-600 dark:border-brand-400'
                  : 'text-description hover:bg-neutral-100 dark:hover:bg-neutral-800'
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
          <div className="glass-panel p-4 hover-lift transition-all duration-200">
            <p className="text-sm text-muted-content">Reuniões Agendadas</p>
            <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">{stats.upcoming}</p>
          </div>
          <div className="glass-panel p-4 hover-lift transition-all duration-200">
            <p className="text-sm text-muted-content">Aguardando CAB</p>
            <p className="text-2xl font-bold text-warning-600 dark:text-warning-400 mt-1">{stats.pending}</p>
          </div>
          <div className="glass-panel p-4 hover-lift transition-all duration-200">
            <p className="text-sm text-muted-content">Aprovadas (30d)</p>
            <p className="text-2xl font-bold text-success-600 dark:text-success-400 mt-1">{stats.approved}</p>
          </div>
          <div className="glass-panel p-4 hover-lift transition-all duration-200">
            <p className="text-sm text-muted-content">Rejeitadas (30d)</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.rejected}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
          </div>
        ) : (
          <>
            {/* Upcoming Meetings */}
            {activeTab === 'upcoming' && (
              <div className="space-y-4">
                {upcomingMeetings.map(meeting => (
                  <div key={meeting.id} className="glass-panel overflow-hidden hover-lift transition-all duration-200">
                    <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-700">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-200 ${getStatusColor(meeting.status)}`}>
                              {getStatusLabel(meeting.status)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{meeting.title}</h3>
                          <p className="text-sm text-muted-content flex items-center gap-1 mt-1">
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
                              className="px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-lg flex items-center gap-2 transition-all duration-200"
                            >
                              <VideoCameraIcon className="w-4 h-4" />
                              Entrar
                            </a>
                          )}
                          <button
                            onClick={() => setSelectedMeeting(meeting)}
                            className="px-4 py-2 text-sm font-medium text-description bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-all duration-200"
                          >
                            Detalhes
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Attendees */}
                    <div className="px-4 sm:px-6 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Participantes ({meeting.attendees.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {meeting.attendees.map((attendee, index) => (
                          <span key={index} className="px-3 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-full text-sm text-neutral-700 dark:text-neutral-300 transition-all duration-200">
                            {attendee.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Changes to Review */}
                    <div className="p-4 sm:p-6">
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Mudanças para Análise ({meeting.changes.length})</p>
                      <div className="space-y-2">
                        {meeting.changes.map(change => (
                          <div
                            key={change.id}
                            onClick={() => router.push(`/admin/changes/${change.id}`)}
                            className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50 cursor-pointer transition-all duration-200 group"
                          >
                            <div className="flex items-center gap-3">
                              <ArrowPathIcon className="w-5 h-5 text-brand-500 dark:text-brand-400" />
                              <div>
                                <p className="font-medium text-neutral-900 dark:text-neutral-100">CHG-{change.id}</p>
                                <p className="text-sm text-muted-content">{change.title}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-200 ${getCategoryColor(change.category)}`}>
                                {change.category}
                              </span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(level => (
                                  <div
                                    key={level}
                                    className={`w-2 h-4 rounded transition-all duration-200 ${
                                      level <= change.risk_level
                                        ? change.risk_level <= 2 ? 'bg-success-500 dark:bg-success-400' :
                                          change.risk_level <= 3 ? 'bg-warning-500 dark:bg-warning-400' :
                                          change.risk_level <= 4 ? 'bg-orange-500 dark:bg-orange-400' : 'bg-red-500 dark:bg-red-400'
                                        : 'bg-neutral-200 dark:bg-neutral-700'
                                    }`}
                                  />
                                ))}
                              </div>
                              <ChevronRightIcon className="w-5 h-5 text-neutral-400 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {upcomingMeetings.length === 0 && (
                  <div className="glass-panel p-8 text-center">
                    <CalendarDaysIcon className="w-12 h-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-3" />
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">Nenhuma reunião agendada</h3>
                    <button
                      onClick={() => toast.error('Criação de reuniões CAB ainda não implementada')}
                      className="mt-4 btn btn-primary"
                    >
                      Agendar Reunião
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Pending Changes */}
            {activeTab === 'pending' && (
              <div className="glass-panel overflow-hidden">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Mudanças Aguardando Revisão do CAB</h3>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {pendingChanges.map(change => (
                    <div
                      key={change.id}
                      className="p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/20 rounded-lg flex items-center justify-center transition-all duration-200">
                          <ArrowPathIcon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-neutral-100">CHG-{change.id}: {change.title}</p>
                          <p className="text-sm text-muted-content">Solicitante: {change.requester}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-200 ${getCategoryColor(change.category)}`}>
                          {change.category}
                        </span>
                        <button
                          onClick={() => router.push(`/admin/changes/${change.id}`)}
                          className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                        >
                          <ChevronRightIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {pendingChanges.length === 0 && (
                  <div className="p-8 text-center">
                    <CheckCircleIcon className="w-12 h-12 text-success-300 dark:text-success-600 mx-auto mb-3" />
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">Nenhuma mudança pendente</h3>
                    <p className="text-sm text-muted-content">Todas as mudanças foram revisadas</p>
                  </div>
                )}
              </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {pastMeetings.map(meeting => (
                  <div key={meeting.id} className="glass-panel overflow-hidden hover-lift transition-all duration-200">
                    <div className="p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-200 ${getStatusColor(meeting.status)}`}>
                              {getStatusLabel(meeting.status)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{meeting.title}</h3>
                          <p className="text-sm text-muted-content">{formatShortDate(meeting.scheduled_date)}</p>
                        </div>
                        <button
                          onClick={() => setSelectedMeeting(meeting)}
                          className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                        >
                          Ver Detalhes
                        </button>
                      </div>

                      {/* Decisions */}
                      <div className="mt-4 space-y-2">
                        {meeting.changes.map(change => (
                          <div key={change.id} className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg transition-all duration-200">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-muted-content">CHG-{change.id}</span>
                              <span className="text-sm text-neutral-900 dark:text-neutral-100 truncate">{change.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-200 ${getDecisionColor(change.decision)}`}>
                                {change.decision === 'approved' ? 'Aprovada' :
                                 change.decision === 'rejected' ? 'Rejeitada' :
                                 change.decision === 'deferred' ? 'Adiada' : 'Pendente'}
                              </span>
                              <div className="flex items-center gap-1 text-xs text-muted-content">
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
                        <div className="mt-3 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-100 dark:border-brand-800">
                          <p className="text-sm text-brand-800 dark:text-brand-300">{meeting.notes}</p>
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
      <div className="fixed bottom-0 left-0 right-0 glass-panel border-t border-neutral-200 dark:border-neutral-700 shadow-lg p-3 sm:hidden safe-bottom backdrop-blur-xl">
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/changes')}
            className="flex-1 py-2.5 text-sm font-medium text-description bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-all duration-200"
          >
            Mudanças
          </button>
          <button
            onClick={() => toast.error('Criação de reuniões CAB ainda não implementada')}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-gradient-brand rounded-lg flex items-center justify-center gap-2 hover:shadow-lg transition-all duration-200"
          >
            <PlusIcon className="w-4 h-4" />
            Nova Reunião
          </button>
        </div>
      </div>
    </div>
  )
}
