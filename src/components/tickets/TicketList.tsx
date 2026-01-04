'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger'
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
  ListBulletIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline'
import TicketCard, { TicketData as Ticket } from '../../../components/ui/TicketCard'
import StatsCard from '@/components/ui/StatsCard'
import { TicketListSkeleton, StatsCardsSkeleton } from '@/components/ui/loading-states'
import { LoadingError } from '@/components/ui/error-states'
import { TicketsEmptyState, FilterEmptyState } from '@/components/ui/empty-state'

interface TicketListProps {
  userRole?: 'admin' | 'agent' | 'user' | 'manager' | 'read_only' | 'api_client' | 'tenant_admin'
  showUserTickets?: boolean
  showFilters?: boolean
  showStats?: boolean
  showSearch?: boolean
  compact?: boolean
  limit?: number
  className?: string
}

interface TicketStats {
  total: number
  open: number
  in_progress: number
  pending: number
  resolved: number
  closed: number
}

interface FilterState {
  status: string
  priority: string
  category: string
  assignedAgent: string
  search: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

const initialFilters: FilterState = {
  status: '',
  priority: '',
  category: '',
  assignedAgent: '',
  search: '',
  sortBy: 'created_at',
  sortOrder: 'desc'
}

export default function TicketList({
  userRole = 'user',
  showUserTickets = false,
  showFilters = true,
  showStats = true,
  showSearch = true,
  compact = false,
  limit,
  className = ''
}: TicketListProps) {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    in_progress: 0,
    pending: 0,
    resolved: 0,
    closed: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'grid'>('cards')

  // Mock data for development
  const [categories] = useState([
    { id: 1, name: 'Suporte Técnico' },
    { id: 2, name: 'Solicitação' },
    { id: 3, name: 'Bug' },
    { id: 4, name: 'Dúvida' }
  ])

  const [agents] = useState([
    { id: 1, name: 'Maria Santos' },
    { id: 2, name: 'Ana Lima' },
    { id: 3, name: 'Carlos Silva' }
  ])

  useEffect(() => {
    fetchTickets()
    if (showStats) {
      fetchStats()
    }
  }, [filters, showUserTickets])

  const fetchTickets = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      if (limit) params.append('limit', limit.toString())
      if (showUserTickets) params.append('my_tickets', 'true')

      let url = '/api/tickets'
      if (userRole === 'admin' && !showUserTickets) {
        url = '/api/admin/tickets'
      }

      // SECURITY: Use cookies instead of localStorage token
      const response = await fetch(`${url}?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar tickets')
      }

      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (error) {
      logger.error('Erro ao buscar tickets', error)
      setError('Erro ao carregar tickets')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const url = showUserTickets ? '/api/tickets/stats?my_tickets=true' : '/api/tickets/stats'

      // SECURITY: Use cookies instead of localStorage token
      const response = await fetch(url, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || stats)
      }
    } catch (error) {
      logger.error('Erro ao buscar estatísticas', error)
    }
  }

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleSortChange = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc'
    }))
  }

  const clearFilters = () => {
    setFilters(initialFilters)
  }

  const handleTicketClick = (ticketId: number) => {
    router.push(`/tickets/${ticketId}`)
  }

  const renderStats = () => {
    if (!showStats) return null

    if (loading) {
      return <StatsCardsSkeleton count={6} />
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatsCard
          title="Total"
          value={stats.total}
          icon="tickets"
          color="brand"
          size="sm"
        />
        <StatsCard
          title="Abertos"
          value={stats.open}
          icon="pending"
          color="error"
          size="sm"
        />
        <StatsCard
          title="Em Andamento"
          value={stats.in_progress}
          icon="time"
          color="warning"
          size="sm"
        />
        <StatsCard
          title="Pendentes"
          value={stats.pending}
          icon="pending"
          color="info"
          size="sm"
        />
        <StatsCard
          title="Resolvidos"
          value={stats.resolved}
          icon="resolved"
          color="success"
          size="sm"
        />
        <StatsCard
          title="Fechados"
          value={stats.closed}
          icon="resolved"
          color="neutral"
          size="sm"
        />
      </div>
    )
  }

  const renderSearchAndFilters = () => {
    if (!showSearch && !showFilters) return null

    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 mb-6" role="search" aria-label="Busca e filtros de tickets">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          {/* Search */}
          {showSearch && (
            <div className="flex-1 max-w-md">
              <label htmlFor="ticket-search" className="sr-only">Buscar tickets por título ou descrição</label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" aria-hidden="true" />
                <input
                  id="ticket-search"
                  type="search"
                  placeholder="Buscar tickets..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="input input-bordered w-full pl-10"
                  aria-label="Campo de busca de tickets"
                  aria-describedby="search-help"
                />
                <span id="search-help" className="sr-only">Digite para buscar tickets por título ou descrição</span>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center space-x-2" role="group" aria-label="Controles de visualização">
            {/* View Mode Toggle */}
            <div className="btn-group" role="group" aria-label="Modo de visualização">
              <button
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-active' : ''}`}
                onClick={() => setViewMode('cards')}
                aria-label="Visualizar em lista"
                aria-pressed={viewMode === 'cards'}
              >
                <ListBulletIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-active' : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Visualizar em grade"
                aria-pressed={viewMode === 'grid'}
              >
                <Squares2X2Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Filter Toggle */}
            {showFilters && (
              <button
                className={`btn btn-sm ${showFiltersPanel ? 'btn-active' : ''}`}
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                aria-label={showFiltersPanel ? "Ocultar filtros" : "Mostrar filtros"}
                aria-expanded={showFiltersPanel}
                aria-controls="filter-panel"
              >
                <FunnelIcon className="h-4 w-4 mr-1" aria-hidden="true" />
                Filtros
              </button>
            )}

            {/* Sort */}
            <div className="dropdown dropdown-end">
              <button
                className="btn btn-sm"
                aria-label="Ordenar tickets"
                aria-haspopup="true"
                aria-expanded="false"
              >
                <ArrowsUpDownIcon className="h-4 w-4 mr-1" aria-hidden="true" />
                Ordenar
              </button>
              <ul className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-52" role="menu" aria-label="Opções de ordenação">
                <li role="none"><button onClick={() => handleSortChange('created_at')} role="menuitem">Data de Criação</button></li>
                <li role="none"><button onClick={() => handleSortChange('updated_at')} role="menuitem">Última Atualização</button></li>
                <li role="none"><button onClick={() => handleSortChange('priority_level')} role="menuitem">Prioridade</button></li>
                <li role="none"><button onClick={() => handleSortChange('title')} role="menuitem">Título</button></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && showFiltersPanel && (
          <div id="filter-panel" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700" role="region" aria-label="Filtros avançados">
            <div>
              <label htmlFor="status-filter" className="label label-text">Status</label>
              <select
                id="status-filter"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="select select-bordered w-full"
                aria-label="Filtrar por status"
              >
                <option value="">Todos</option>
                <option value="new">Novo</option>
                <option value="in_progress">Em Andamento</option>
                <option value="pending">Pendente</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
            </div>

            <div>
              <label htmlFor="priority-filter" className="label label-text">Prioridade</label>
              <select
                id="priority-filter"
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="select select-bordered w-full"
                aria-label="Filtrar por prioridade"
              >
                <option value="">Todas</option>
                <option value="1">Baixa</option>
                <option value="2">Média</option>
                <option value="3">Alta</option>
                <option value="4">Crítica</option>
              </select>
            </div>

            <div>
              <label htmlFor="category-filter" className="label label-text">Categoria</label>
              <select
                id="category-filter"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="select select-bordered w-full"
                aria-label="Filtrar por categoria"
              >
                <option value="">Todas</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            {(userRole === 'admin' || userRole === 'agent') && (
              <div>
                <label htmlFor="agent-filter" className="label label-text">Agente</label>
                <select
                  id="agent-filter"
                  value={filters.assignedAgent}
                  onChange={(e) => handleFilterChange('assignedAgent', e.target.value)}
                  className="select select-bordered w-full"
                  aria-label="Filtrar por agente"
                >
                  <option value="">Todos</option>
                  <option value="unassigned">Não atribuído</option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="btn btn-outline w-full"
                aria-label="Limpar todos os filtros aplicados"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderTickets = () => {
    if (loading) {
      return <TicketListSkeleton items={limit || 5} />
    }

    if (error) {
      return (
        <LoadingError
          message={error}
          onRetry={fetchTickets}
        />
      )
    }

    if (tickets.length === 0) {
      // Check if filters are applied
      const hasFilters = filters.search || filters.status || filters.priority ||
                        filters.category || filters.assignedAgent

      if (hasFilters) {
        return <FilterEmptyState onClearFilters={clearFilters} />
      }

      return (
        <TicketsEmptyState
          onCreateTicket={() => router.push('/tickets/new')}
        />
      )
    }

    const gridClass = viewMode === 'grid'
      ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'
      : 'space-y-4'

    return (
      <div
        className={gridClass}
        role="list"
        aria-label={`Lista de tickets (${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} encontrado${tickets.length !== 1 ? 's' : ''})`}
      >
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            compact={compact}
            showActions={userRole === 'admin' || userRole === 'agent'}
            onClick={() => handleTicketClick(Number(ticket.id))}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      {renderStats()}
      {renderSearchAndFilters()}
      {renderTickets()}
    </div>
  )
}