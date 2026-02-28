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
import PageHeader from '@/components/ui/PageHeader'

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
  critical: { color: 'text-priority-critical dark:text-priority-critical', bgColor: 'bg-priority-critical/10 dark:bg-priority-critical/20', borderColor: 'border-priority-critical/30 dark:border-priority-critical/50' },
  high: { color: 'text-priority-high dark:text-priority-high', bgColor: 'bg-priority-high/10 dark:bg-priority-high/20', borderColor: 'border-priority-high/30 dark:border-priority-high/50' },
  medium: { color: 'text-priority-medium dark:text-priority-medium', bgColor: 'bg-priority-medium/10 dark:bg-priority-medium/20', borderColor: 'border-priority-medium/30 dark:border-priority-medium/50' },
  low: { color: 'text-priority-low dark:text-priority-low', bgColor: 'bg-priority-low/10 dark:bg-priority-low/20', borderColor: 'border-priority-low/30 dark:border-priority-low/50' }
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Aberto', color: 'text-status-open dark:text-status-open', bgColor: 'bg-status-open/10 dark:bg-status-open/20' },
  in_progress: { label: 'Em Andamento', color: 'text-status-progress dark:text-status-progress', bgColor: 'bg-status-progress/10 dark:bg-status-progress/20' },
  pending: { label: 'Pendente', color: 'text-priority-high dark:text-priority-high', bgColor: 'bg-priority-high/10 dark:bg-priority-high/20' },
  resolved: { label: 'Resolvido', color: 'text-status-resolved dark:text-status-resolved', bgColor: 'bg-status-resolved/10 dark:bg-status-resolved/20' },
  closed: { label: 'Fechado', color: 'text-description', bgColor: 'bg-neutral-100 dark:bg-neutral-800' }
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
      return { label: 'Violado', color: 'text-priority-critical dark:text-priority-critical', bgColor: 'bg-priority-critical/10 dark:bg-priority-critical/20' }
    }
    // Check if at risk (within 30 minutes of deadline)
    if (ticket.sla_response_deadline || ticket.sla_resolution_deadline) {
      const deadline = new Date(ticket.sla_response_deadline || ticket.sla_resolution_deadline || '')
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()
      const minutesRemaining = Math.floor(diff / 60000)

      if (minutesRemaining < 0) {
        return { label: 'Violado', color: 'text-priority-critical dark:text-priority-critical', bgColor: 'bg-priority-critical/10 dark:bg-priority-critical/20' }
      }
      if (minutesRemaining < 30) {
        return { label: `${minutesRemaining}m`, color: 'text-priority-high dark:text-priority-high', bgColor: 'bg-priority-high/10 dark:bg-priority-high/20' }
      }
      if (minutesRemaining < 60) {
        return { label: `${minutesRemaining}m`, color: 'text-priority-medium dark:text-priority-medium', bgColor: 'bg-priority-medium/10 dark:bg-priority-medium/20' }
      }
    }
    return { label: 'OK', color: 'text-status-resolved dark:text-status-resolved', bgColor: 'bg-status-resolved/10 dark:bg-status-resolved/20' }
  }

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    // On mobile, navigate to ticket
    if (window.innerWidth < 1024) {
      router.push(`/tickets/${ticket.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="glass-panel border-b border-neutral-200 dark:border-neutral-800 sticky top-0 z-20">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-4">
          <PageHeader
            title="Workspace do Agente"
            description="Gerencie seus chamados em uma única tela"
            icon={InboxIcon}
            actions={[
              {
                label: 'Atualizar',
                onClick: fetchData,
                icon: ArrowPathIcon,
                variant: 'ghost'
              },
              {
                label: 'Notificações',
                onClick: () => {/* TODO: Implement notifications */},
                icon: BellAlertIcon,
                variant: 'ghost'
              },
              {
                label: 'Configurações',
                onClick: () => router.push('/admin/settings'),
                icon: Cog6ToothIcon,
                variant: 'secondary'
              }
            ]}
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="glass-panel border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 py-3">
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin">
            {agentStats && (
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-status-open/10 dark:bg-status-open/20 rounded-lg flex-shrink-0 transition-all hover:scale-105 animate-slide-up">
                  <TicketIcon className="w-4 h-4 text-status-open" />
                  <div>
                    <p className="text-xs text-description">Meus Abertos</p>
                    <p className="text-lg font-bold text-status-open">{agentStats.assigned_open}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-status-resolved/10 dark:bg-status-resolved/20 rounded-lg flex-shrink-0 transition-all hover:scale-105 animate-slide-up" style={{ animationDelay: '100ms' }}>
                  <CheckCircleIcon className="w-4 h-4 text-status-resolved" />
                  <div>
                    <p className="text-xs text-description">Resolvidos Hoje</p>
                    <p className="text-lg font-bold text-status-resolved">{agentStats.resolved_today}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/10 dark:bg-brand-500/20 rounded-lg flex-shrink-0 transition-all hover:scale-105 animate-slide-up" style={{ animationDelay: '200ms' }}>
                  <ChartBarIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <div>
                    <p className="text-xs text-description">SLA</p>
                    <p className="text-lg font-bold text-brand-600 dark:text-brand-400">{agentStats.sla_compliance}%</p>
                  </div>
                </div>

                {queueStats && queueStats.sla_at_risk > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-priority-critical/10 dark:bg-priority-critical/20 rounded-lg flex-shrink-0 transition-all hover:scale-105 animate-slide-up animate-pulse-soft" style={{ animationDelay: '300ms' }}>
                    <FireIcon className="w-4 h-4 text-priority-critical" />
                    <div>
                      <p className="text-xs text-description">SLA em Risco</p>
                      <p className="text-lg font-bold text-priority-critical">{queueStats.sla_at_risk}</p>
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
            <div className="glass-panel rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm sticky top-[120px] animate-slide-up">
              {/* Queue Tabs */}
              <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-lg p-1">
                  <button
                    onClick={() => setActiveQueue('my')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeQueue === 'my' ? 'glass-panel text-brand-600 dark:text-brand-400 shadow-sm' : 'text-description hover:text-neutral-900 dark:hover:text-neutral-100'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <UserIcon className="w-4 h-4" />
                      <span>Meus</span>
                      {queueStats && (
                        <span className="px-1.5 py-0.5 bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded text-xs">
                          {queueStats.my_queue}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveQueue('team')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeQueue === 'team' ? 'glass-panel text-brand-600 dark:text-brand-400 shadow-sm' : 'text-description hover:text-neutral-900 dark:hover:text-neutral-100'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <UserGroupIcon className="w-4 h-4" />
                      <span>Equipe</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveQueue('unassigned')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeQueue === 'unassigned' ? 'glass-panel text-brand-600 dark:text-brand-400 shadow-sm' : 'text-description hover:text-neutral-900 dark:hover:text-neutral-100'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <InboxIcon className="w-4 h-4" />
                      <span>Fila</span>
                      {queueStats && (
                        <span className="px-1.5 py-0.5 bg-priority-high/10 dark:bg-priority-high/20 text-priority-high rounded text-xs">
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
                  <label className="text-xs font-medium text-description mb-1 block">Prioridade</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                  >
                    <option value="">Todas</option>
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={showSLARisk}
                    onChange={(e) => setShowSLARisk(e.target.checked)}
                    className="rounded border-neutral-300 dark:border-neutral-700 text-brand-600 dark:text-brand-500 focus:ring-brand-500 dark:focus:ring-brand-600"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300 flex items-center gap-1 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors">
                    <FireIcon className="w-4 h-4 text-priority-high" />
                    Apenas SLA em risco
                  </span>
                </label>
              </div>

              {/* Quick Actions */}
              <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
                <h3 className="text-xs font-medium text-description mb-2">Ações Rápidas</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push('/tickets/new')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all duration-200 hover:shadow-sm hover:translate-x-1 group text-neutral-700 dark:text-neutral-300"
                    aria-label="Criar novo ticket"
                  >
                    <BoltIcon className="w-4 h-4 text-brand-500 group-hover:scale-110 transition-transform" />
                    <span className="flex-1">Novo Ticket</span>
                    <ChevronRightIcon className="w-4 h-4 text-neutral-300 dark:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => router.push('/knowledge')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all duration-200 hover:shadow-sm hover:translate-x-1 group text-neutral-700 dark:text-neutral-300"
                    aria-label="Acessar base de conhecimento"
                  >
                    <DocumentTextIcon className="w-4 h-4 text-status-resolved group-hover:scale-110 transition-transform" />
                    <span className="flex-1">Base de Conhecimento</span>
                    <ChevronRightIcon className="w-4 h-4 text-neutral-300 dark:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={() => router.push('/admin/problems')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all duration-200 hover:shadow-sm hover:translate-x-1 group text-neutral-700 dark:text-neutral-300"
                    aria-label="Ver problemas conhecidos"
                  >
                    <BugAntIcon className="w-4 h-4 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform" />
                    <span className="flex-1">Problemas</span>
                    <ChevronRightIcon className="w-4 h-4 text-neutral-300 dark:text-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Ticket List */}
          <div className="flex-1 min-w-0">
            <div className="glass-panel rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm animate-slide-up" style={{ animationDelay: '100ms' }}>
              {/* Search */}
              <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-600" />
                  <input
                    type="text"
                    placeholder="Buscar tickets..."
                    className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-600 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Ticket List */}
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin">
                {loading && tickets.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 dark:border-brand-400 mx-auto"></div>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="p-8 text-center">
                    <InboxIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                    <p className="text-muted-content">Nenhum ticket na fila</p>
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
                        className={`p-3 sm:p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer transition-all group ${
                          selectedTicket?.id === ticket.id ? 'bg-brand-50 dark:bg-brand-950 border-l-4 border-brand-500 dark:border-brand-400' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Priority Indicator */}
                          <div className={`w-1 h-12 rounded-full ${priority.bgColor}`}></div>

                          {/* Type Icon */}
                          <div className={`p-2 rounded-lg ${priority.bgColor} flex-shrink-0 group-hover:scale-110 transition-transform`}>
                            <TypeIcon className={`w-4 h-4 ${priority.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-mono text-muted-content">#{ticket.id}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bgColor} ${status.color}`}>
                                {status.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sla.bgColor} ${sla.color}`}>
                                SLA: {sla.label}
                              </span>
                            </div>

                            <h4 className="font-medium text-neutral-900 dark:text-neutral-100 line-clamp-1 mb-1">
                              {ticket.title}
                            </h4>

                            <div className="flex items-center gap-3 text-xs text-muted-content flex-wrap">
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
                              <span className="flex items-center gap-1 px-2 py-1 bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 rounded text-xs animate-pulse-soft">
                                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                                {ticket.unread_comments}
                              </span>
                            )}
                            <ChevronRightIcon className="w-5 h-5 text-neutral-300 dark:text-neutral-700 hidden sm:block group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors" />
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
            <div className="glass-panel rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm sticky top-[120px] animate-slide-up" style={{ animationDelay: '200ms' }}>
              {selectedTicket ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-mono text-muted-content">#{selectedTicket.id}</span>
                    <button
                      onClick={() => router.push(`/tickets/${selectedTicket.id}`)}
                      className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                    >
                      <EyeIcon className="w-4 h-4" />
                      Abrir
                    </button>
                  </div>

                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">{selectedTicket.title}</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="text-sm text-muted-content">Solicitante</span>
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{selectedTicket.requester_name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="text-sm text-muted-content">Categoria</span>
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{selectedTicket.category_name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="text-sm text-muted-content">Prioridade</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${priorityConfig[selectedTicket.priority]?.bgColor} ${priorityConfig[selectedTicket.priority]?.color}`}>
                        {selectedTicket.priority}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="text-sm text-muted-content">Criado</span>
                      <span className="text-sm text-neutral-900 dark:text-neutral-100">{formatTimeAgo(selectedTicket.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-gradient-brand text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all hover:shadow-lg">
                      Responder
                    </button>
                    <button className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all">
                      Atribuir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <TicketIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
                  <p className="text-muted-content text-sm">Selecione um ticket para visualizar</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
