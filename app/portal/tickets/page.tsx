'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  CalendarIcon,
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface Ticket {
  id: number
  ticket_number: string
  title: string
  description: string
  status: string
  priority: string
  priority_color: string
  created_at: string
  updated_at: string
  assigned_to_name?: string
  customer_name: string
  category_name?: string
  sla_due_at?: string
  is_overdue: boolean
}

interface Status {
  id: number
  name: string
  color: string
  category: 'open' | 'in_progress' | 'resolved' | 'closed'
}

interface Priority {
  id: number
  name: string
  color: string
  level: number
}

export default function MyTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedPriority, setSelectedPriority] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchTickets()
    fetchStatuses()
    fetchPriorities()
  }, [selectedStatus, selectedPriority, sortBy, sortOrder])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        sort_by: sortBy,
        sort_order: sortOrder,
        limit: '50'
      })

      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus)
      }

      if (selectedPriority !== 'all') {
        params.append('priority', selectedPriority)
      }

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim())
      }

      const response = await fetch(`/api/portal/tickets?${params}`)
      const data = await response.json()

      if (data.success) {
        setTickets(data.tickets || [])
      } else {
        toast.error('Erro ao carregar tickets')
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
      toast.error('Erro ao carregar tickets')
    } finally {
      setLoading(false)
    }
  }

  const fetchStatuses = async () => {
    try {
      const response = await fetch('/api/statuses')
      const data = await response.json()
      if (data.success) {
        setStatuses(data.statuses)
      }
    } catch (error) {
      console.error('Error fetching statuses:', error)
    }
  }

  const fetchPriorities = async () => {
    try {
      const response = await fetch('/api/priorities')
      const data = await response.json()
      if (data.success) {
        setPriorities(data.priorities)
      }
    } catch (error) {
      console.error('Error fetching priorities:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchTickets()
  }

  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('resolvido') || statusLower.includes('fechado')) {
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />
    }
    if (statusLower.includes('progresso') || statusLower.includes('atendimento')) {
      return <ClockIcon className="w-4 h-4 text-blue-500" />
    }
    if (statusLower.includes('pendente') || statusLower.includes('aguard')) {
      return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
    }
    return <ClockIcon className="w-4 h-4 text-gray-500" />
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h atrás`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
      return `${diffInDays}d atrás`
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatSLADue = (dueDateString?: string) => {
    if (!dueDateString) return null

    const dueDate = new Date(dueDateString)
    const now = new Date()
    const diffInHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 0) {
      return <span className="text-red-600 font-medium">Vencido</span>
    }

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60)
      return <span className="text-orange-600 font-medium">{diffInMinutes}m restantes</span>
    }

    if (diffInHours < 24) {
      return <span className="text-yellow-600 font-medium">{Math.floor(diffInHours)}h restantes</span>
    }

    const diffInDays = Math.floor(diffInHours / 24)
    return <span className="text-green-600 font-medium">{diffInDays}d restantes</span>
  }

  const getTicketsByStatus = () => {
    const statusGroups = {
      open: tickets.filter(t => ['aberto', 'novo', 'pendente'].some(s => t.status.toLowerCase().includes(s))),
      in_progress: tickets.filter(t => ['progresso', 'atendimento', 'análise'].some(s => t.status.toLowerCase().includes(s))),
      resolved: tickets.filter(t => ['resolvido', 'fechado', 'finalizado'].some(s => t.status.toLowerCase().includes(s)))
    }
    return statusGroups
  }

  const statusGroups = getTicketsByStatus()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-20 bg-white rounded-lg border border-gray-200"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Meus Tickets
              </h1>
              <p className="text-gray-600">
                Acompanhe o status das suas solicitações
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Link
                href="/portal"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Nova Solicitação
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Abertos</p>
                <p className="text-3xl font-bold text-orange-600">{statusGroups.open.length}</p>
              </div>
              <ClockIcon className="w-8 h-8 text-orange-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Em Progresso</p>
                <p className="text-3xl font-bold text-blue-600">{statusGroups.in_progress.length}</p>
              </div>
              <ExclamationTriangleIcon className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolvidos</p>
                <p className="text-3xl font-bold text-green-600">{statusGroups.resolved.length}</p>
              </div>
              <CheckCircleIcon className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por número, título ou descrição..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FunnelIcon className="w-4 h-4 mr-2" />
              Filtros
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Buscar
            </button>
          </form>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Todos os status</option>
                    {statuses.map(status => (
                      <option key={status.id} value={status.name}>{status.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Todas as prioridades</option>
                    {priorities.map(priority => (
                      <option key={priority.id} value={priority.name}>{priority.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split('-')
                      setSortBy(field)
                      setSortOrder(order as 'asc' | 'desc')
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="created_at-desc">Mais recentes</option>
                    <option value="created_at-asc">Mais antigos</option>
                    <option value="updated_at-desc">Últimas atualizações</option>
                    <option value="priority-asc">Prioridade</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tickets List */}
        {tickets.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum ticket encontrado
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || selectedStatus !== 'all' || selectedPriority !== 'all'
                ? 'Tente ajustar os filtros de busca.'
                : 'Você ainda não criou nenhuma solicitação.'}
            </p>
            <Link
              href="/portal"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Criar primeira solicitação
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map(ticket => (
              <div
                key={ticket.id}
                className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/portal/tickets/${ticket.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-mono text-gray-500">
                        #{ticket.ticket_number}
                      </span>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(ticket.status)}
                        <span className="text-sm font-medium" style={{ color: '#374151' }}>
                          {ticket.status}
                        </span>
                      </div>
                      <span
                        className="px-2 py-1 text-xs font-medium rounded-full text-white"
                        style={{ backgroundColor: ticket.priority_color }}
                      >
                        {ticket.priority}
                      </span>
                      {ticket.is_overdue && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Vencido
                        </span>
                      )}
                    </div>
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <EyeIcon className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  <h3 className="text-lg font-medium text-gray-900 mb-2 line-clamp-1">
                    {ticket.title}
                  </h3>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {ticket.description}
                  </p>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <CalendarIcon className="w-4 h-4" />
                        <span>Criado {formatDate(ticket.created_at)}</span>
                      </div>
                      {ticket.assigned_to_name && (
                        <div className="flex items-center space-x-1">
                          <UserIcon className="w-4 h-4" />
                          <span>Atribuído a {ticket.assigned_to_name}</span>
                        </div>
                      )}
                      {ticket.category_name && (
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          <span>{ticket.category_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {ticket.sla_due_at && formatSLADue(ticket.sla_due_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}