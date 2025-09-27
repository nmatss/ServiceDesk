'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowsUpDownIcon,
  ViewColumnsIcon,
  ListBulletIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline'
import TicketCard, { Ticket } from './TicketCard'
import StatsCard from '../ui/StatsCard'

interface TicketListProps {
  userRole?: 'admin' | 'agent' | 'user'
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
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      if (limit) params.append('limit', limit.toString())

      let url = '/api/tickets'
      if (userRole === 'admin' && !showUserTickets) {
        url = '/api/admin/tickets'
      } else if (showUserTickets) {
        const userId = localStorage.getItem('user_id')
        url = `/api/tickets/user/${userId}`
      }

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar tickets')
      }

      const data = await response.json()
      setTickets(data.tickets || [])
    } catch (error) {
      console.error('Erro ao buscar tickets:', error)
      setError('Erro ao carregar tickets')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      let url = '/api/tickets/stats'
      if (showUserTickets) {
        const userId = localStorage.getItem('user_id')
        url = `/api/tickets/user/${userId}/stats`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || stats)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
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
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          {/* Search */}
          {showSearch && (
            <div className="flex-1 max-w-md">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar tickets..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="input input-bordered w-full pl-10"
                />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="btn-group">
              <button
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-active' : ''}`}
                onClick={() => setViewMode('cards')}
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
            </div>

            {/* Filter Toggle */}
            {showFilters && (
              <button
                className={`btn btn-sm ${showFiltersPanel ? 'btn-active' : ''}`}
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              >
                <FunnelIcon className="h-4 w-4 mr-1" />
                Filtros
              </button>
            )}

            {/* Sort */}
            <div className="dropdown dropdown-end">
              <button className="btn btn-sm">
                <ArrowsUpDownIcon className="h-4 w-4 mr-1" />
                Ordenar
              </button>
              <ul className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box w-52">
                <li><button onClick={() => handleSortChange('created_at')}>Data de Criação</button></li>
                <li><button onClick={() => handleSortChange('updated_at')}>Última Atualização</button></li>
                <li><button onClick={() => handleSortChange('priority_level')}>Prioridade</button></li>
                <li><button onClick={() => handleSortChange('title')}>Título</button></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && showFiltersPanel && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <div>
              <label className="label label-text">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="select select-bordered w-full"
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
              <label className="label label-text">Prioridade</label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="select select-bordered w-full"
              >
                <option value="">Todas</option>
                <option value="1">Baixa</option>
                <option value="2">Média</option>
                <option value="3">Alta</option>
                <option value="4">Crítica</option>
              </select>
            </div>

            <div>
              <label className="label label-text">Categoria</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="select select-bordered w-full"
              >
                <option value="">Todas</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            {(userRole === 'admin' || userRole === 'agent') && (
              <div>
                <label className="label label-text">Agente</label>
                <select
                  value={filters.assignedAgent}
                  onChange={(e) => handleFilterChange('assignedAgent', e.target.value)}
                  className="select select-bordered w-full"
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
      return (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="p-6">
                <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <div className="card">
          <div className="p-6 text-center">
            <p className="text-error-600 dark:text-error-400 mb-4">{error}</p>
            <button
              onClick={fetchTickets}
              className="btn btn-primary"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )
    }

    if (tickets.length === 0) {
      return (
        <div className="card">
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ListBulletIcon className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Nenhum ticket encontrado
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {showUserTickets
                ? 'Você ainda não criou nenhum ticket.'
                : 'Não há tickets que correspondam aos filtros aplicados.'}
            </p>
            <button
              onClick={() => router.push('/tickets/new')}
              className="btn btn-primary"
            >
              Criar Novo Ticket
            </button>
          </div>
        </div>
      )
    }

    const gridClass = viewMode === 'grid'
      ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'
      : 'space-y-4'

    return (
      <div className={gridClass}>
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            variant={compact ? 'compact' : 'default'}
            showActions={userRole === 'admin' || userRole === 'agent'}
            userRole={userRole}
            onClick={() => handleTicketClick(ticket.id)}
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