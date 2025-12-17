'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  TicketIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  BellAlertIcon,
  FireIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  ChartBarIcon,
  InboxIcon,
  UserGroupIcon,
  BoltIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  BugAntIcon,
  ArrowsRightLeftIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'
import { IconButtonWithTooltip } from '@/components/ui/Tooltip'

interface Ticket {
  id: number
  title: string
  status: string
  priority: string
  type: string
  category_name: string
  requester_name: string
  requester_email: string
  created_at: string
  updated_at: string
  sla_response_deadline: string | null
  sla_resolution_deadline: string | null
  sla_response_breach: boolean
  sla_resolution_breach: boolean
  unread_comments: number
}

interface AgentStats {
  assigned_open: number
  assigned_pending: number
  resolved_today: number
  avg_response_time: number
  sla_compliance: number
  csat_score: number
}

interface QueueStats {
  unassigned: number
  my_queue: number
  team_queue: number
  sla_at_risk: number
  breached: number
}

const priorityConfig: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  critical: { color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
  high: { color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
  medium: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-300' },
  low: { color: 'text-green-700', bgColor: 'bg-green-100', borderColor: 'border-green-300' }
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Aberto', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  in_progress: { label: 'Em Andamento', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  pending: { label: 'Pendente', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  resolved: { label: 'Resolvido', color: 'text-green-700', bgColor: 'bg-green-100' },
  closed: { label: 'Fechado', color: 'text-gray-700', bgColor: 'bg-gray-100' }
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  incident: ExclamationTriangleIcon,
  request: DocumentTextIcon,
  problem: BugAntIcon,
  change: ArrowsRightLeftIcon
}

export default function AgentWorkspacePage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null)
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeQueue, setActiveQueue] = useState<'my' | 'team' | 'unassigned'>('my')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [showSLARisk, setShowSLARisk] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch tickets based on active queue
      const params = new URLSearchParams({
        limit: '50',
        status: 'open,in_progress,pending'
      })

      if (activeQueue === 'my') {
        params.append('assigned_to_me', 'true')
      } else if (activeQueue === 'unassigned') {
        params.append('unassigned', 'true')
      }

      if (priorityFilter) {
        params.append('priority', priorityFilter)
      }

      if (showSLARisk) {
        params.append('sla_at_risk', 'true')
      }

      const [ticketsRes, statsRes] = await Promise.all([
        fetch(`/api/tickets?${params}`),
        fetch('/api/agent/stats')
      ])

      const ticketsData = await ticketsRes.json()
      const statsData = await statsRes.json()

      if (ticketsData.success) {
        setTickets(ticketsData.tickets || [])
      }

      if (statsData.success) {
        setAgentStats(statsData.agent_stats)
        setQueueStats(statsData.queue_stats)
      }
    } catch {
      console.error('Error fetching workspace data')
    } finally {
      setLoading(false)
    }
  }, [activeQueue, priorityFilter, showSLARisk])

  useEffect(() => {
    fetchData()
    // Poll every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d atrás`
    if (hours > 0) return `${hours}h atrás`
    if (minutes > 0) return `${minutes}m atrás`
    return 'Agora'
  }

  const getSLAStatus = (ticket: Ticket) => {
    if (ticket.sla_response_breach || ticket.sla_resolution_breach) {
      return { label: 'Violado', color: 'text-red-600', bgColor: 'bg-red-100' }
    }
    // Check if at risk (within 30 minutes of deadline)
    if (ticket.sla_response_deadline || ticket.sla_resolution_deadline) {
      const deadline = new Date(ticket.sla_response_deadline || ticket.sla_resolution_deadline || '')
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()
      const minutesRemaining = Math.floor(diff / 60000)

      if (minutesRemaining < 0) {
        return { label: 'Violado', color: 'text-red-600', bgColor: 'bg-red-100' }
      }
      if (minutesRemaining < 30) {
        return { label: `${minutesRemaining}m`, color: 'text-orange-600', bgColor: 'bg-orange-100' }
      }
      if (minutesRemaining < 60) {
        return { label: `${minutesRemaining}m`, color: 'text-yellow-600', bgColor: 'bg-yellow-100' }
      }
    }
    return { label: 'OK', color: 'text-green-600', bgColor: 'bg-green-100' }
  }

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    // On mobile, navigate to ticket
    if (window.innerWidth < 1024) {
      router.push(`/tickets/${ticket.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <InboxIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Workspace do Agente</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                  Gerencie seus chamados em uma única tela
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <IconButtonWithTooltip
                icon={ArrowPathIcon}
                tooltip="Atualizar chamados"
                label="Atualizar chamados"
                onClick={fetchData}
                className={loading ? 'animate-spin' : ''}
                disabled={loading}
              />
              <IconButtonWithTooltip
                icon={BellAlertIcon}
                tooltip="Notificações"
                label="Ver notificações"
                onClick={() => {/* TODO: Implement notifications */}}
                badge={3}
              />
              <IconButtonWithTooltip
                icon={Cog6ToothIcon}
                tooltip="Configurações do workspace"
                label="Abrir configurações do workspace"
                onClick={() => router.push('/agent/settings')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-3">
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
            {agentStats && (
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg flex-shrink-0">
                  <TicketIcon className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-gray-500">Meus Abertos</p>
                    <p className="text-lg font-bold text-blue-600">{agentStats.assigned_open}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg flex-shrink-0">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-xs text-gray-500">Resolvidos Hoje</p>
                    <p className="text-lg font-bold text-green-600">{agentStats.resolved_today}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg flex-shrink-0">
                  <ChartBarIcon className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-xs text-gray-500">SLA</p>
                    <p className="text-lg font-bold text-purple-600">{agentStats.sla_compliance}%</p>
                  </div>
                </div>

                {queueStats && queueStats.sla_at_risk > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg flex-shrink-0">
                    <FireIcon className="w-4 h-4 text-red-600" />
                    <div>
                      <p className="text-xs text-gray-500">SLA em Risco</p>
                      <p className="text-lg font-bold text-red-600">{queueStats.sla_at_risk}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left Panel - Queue & Filters */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm sticky top-[120px]">
              {/* Queue Tabs */}
              <div className="p-3 border-b">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setActiveQueue('my')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeQueue === 'my' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <UserIcon className="w-4 h-4" />
                      <span>Meus</span>
                      {queueStats && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
                          {queueStats.my_queue}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveQueue('team')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeQueue === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <UserGroupIcon className="w-4 h-4" />
                      <span>Equipe</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveQueue('unassigned')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeQueue === 'unassigned' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <InboxIcon className="w-4 h-4" />
                      <span>Fila</span>
                      {queueStats && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">
                          {queueStats.unassigned}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="p-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Prioridade</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todas</option>
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSLARisk}
                    onChange={(e) => setShowSLARisk(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 flex items-center gap-1">
                    <FireIcon className="w-4 h-4 text-orange-500" />
                    Apenas SLA em risco
                  </span>
                </label>
              </div>

              {/* Quick Actions */}
              <div className="p-3 border-t">
                <h3 className="text-xs font-medium text-gray-500 mb-2">Ações Rápidas</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/tickets/new')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-sm hover:translate-x-1 group"
                    aria-label="Criar novo ticket"
                  >
                    <BoltIcon className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="flex-1">Novo Ticket</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => router.push('/knowledge')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-sm hover:translate-x-1 group"
                    aria-label="Acessar base de conhecimento"
                  >
                    <DocumentTextIcon className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform" />
                    <span className="flex-1">Base de Conhecimento</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => router.push('/admin/problems')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-sm hover:translate-x-1 group"
                    aria-label="Ver problemas conhecidos"
                  >
                    <BugAntIcon className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                    <span className="flex-1">Problemas</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Ticket List */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Search */}
              <div className="p-3 border-b">
                <div className="relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar tickets..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Ticket List */}
              <div className="divide-y divide-gray-100 max-h-[calc(100vh-280px)] overflow-y-auto">
                {loading && tickets.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="p-8 text-center">
                    <InboxIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhum ticket na fila</p>
                  </div>
                ) : (
                  tickets.map((ticket) => {
                    const priority = priorityConfig[ticket.priority] || priorityConfig.medium
                    const status = statusConfig[ticket.status] || statusConfig.open
                    const sla = getSLAStatus(ticket)
                    const TypeIcon = typeIcons[ticket.type] || TicketIcon

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => handleTicketClick(ticket)}
                        className={`p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedTicket?.id === ticket.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Priority Indicator */}
                          <div className={`w-1 h-12 rounded-full ${priority.bgColor}`}></div>

                          {/* Type Icon */}
                          <div className={`p-2 rounded-lg ${priority.bgColor} flex-shrink-0`}>
                            <TypeIcon className={`w-4 h-4 ${priority.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-500">#{ticket.id}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bgColor} ${status.color}`}>
                                {status.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sla.bgColor} ${sla.color}`}>
                                SLA: {sla.label}
                              </span>
                            </div>

                            <h4 className="font-medium text-gray-900 line-clamp-1 mb-1">
                              {ticket.title}
                            </h4>

                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <UserIcon className="w-3.5 h-3.5" />
                                {ticket.requester_name}
                              </span>
                              <span>{ticket.category_name}</span>
                              <span>{formatTimeAgo(ticket.updated_at)}</span>
                            </div>
                          </div>

                          {/* Indicators */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {ticket.unread_comments > 0 && (
                              <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">
                                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                                {ticket.unread_comments}
                              </span>
                            )}
                            <ChevronRightIcon className="w-5 h-5 text-gray-300 hidden sm:block" />
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Ticket Preview (Desktop only) */}
          <div className="hidden xl:block xl:w-96 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm sticky top-[120px]">
              {selectedTicket ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-mono text-gray-500">#{selectedTicket.id}</span>
                    <button
                      onClick={() => router.push(`/tickets/${selectedTicket.id}`)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <EyeIcon className="w-4 h-4" />
                      Abrir
                    </button>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-3">{selectedTicket.title}</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-gray-500">Solicitante</span>
                      <span className="text-sm font-medium">{selectedTicket.requester_name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-gray-500">Categoria</span>
                      <span className="text-sm font-medium">{selectedTicket.category_name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-gray-500">Prioridade</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${priorityConfig[selectedTicket.priority]?.bgColor} ${priorityConfig[selectedTicket.priority]?.color}`}>
                        {selectedTicket.priority}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-gray-500">Criado</span>
                      <span className="text-sm">{formatTimeAgo(selectedTicket.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                      Responder
                    </button>
                    <button className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Atribuir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <TicketIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Selecione um ticket para visualizar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
