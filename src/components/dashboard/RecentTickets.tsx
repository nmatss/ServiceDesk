'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ClockIcon,
  UserIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TicketIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

interface Ticket {
  id: number
  title: string
  status_name: string
  status_color: string
  priority_name: string
  priority_level: number
  category_name: string
  user_name: string
  created_at: string
}

interface RecentTicketsProps {
  limit?: number
  showUserTickets?: boolean
  className?: string
}

export default function RecentTickets({ limit = 5, showUserTickets = false, className = '' }: RecentTicketsProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentTickets()
  }, [showUserTickets])

  const fetchRecentTickets = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const userRole = localStorage.getItem('user_role')
      const userId = localStorage.getItem('user_id')

      let url = '/api/admin/tickets'
      if (showUserTickets && userId) {
        url = `/api/tickets/user/${userId}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar tickets')
      }

      const data = await response.json()
      const ticketsData = showUserTickets ? data.tickets : data.tickets
      setTickets(ticketsData.slice(0, limit))
    } catch (error) {
      console.error('Erro ao buscar tickets recentes:', error)
      setError('Erro ao carregar tickets')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityIcon = (level: number) => {
    switch (level) {
      case 1: return <CheckCircleIcon className="h-4 w-4 text-success-500" />
      case 2: return <ClockIcon className="h-4 w-4 text-warning-500" />
      case 3: return <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />
      case 4: return <ExclamationTriangleIcon className="h-4 w-4 text-error-500" />
      default: return <ClockIcon className="h-4 w-4 text-neutral-500" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      return diffInMinutes <= 1 ? 'Agora mesmo' : `${diffInMinutes}min atrás`
    } else if (diffInHours < 24) {
      return `${diffInHours}h atrás`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      if (diffInDays === 1) return 'Ontem'
      if (diffInDays < 7) return `${diffInDays}d atrás`
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
  }

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header">
          <div className="flex items-center space-x-2">
            <TicketIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h3 className="text-lg font-semibold">
              {showUserTickets ? 'Meus Tickets Recentes' : 'Tickets Recentes'}
            </h3>
          </div>
        </div>
        <div className="card-body space-y-3">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header">
          <div className="flex items-center space-x-2">
            <TicketIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h3 className="text-lg font-semibold">
              {showUserTickets ? 'Meus Tickets Recentes' : 'Tickets Recentes'}
            </h3>
          </div>
        </div>
        <div className="card-body text-center py-8">
          <p className="text-sm text-error-600 dark:text-error-400 mb-4">{error}</p>
          <button
            onClick={fetchRecentTickets}
            className="btn btn-outline btn-sm"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TicketIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h3 className="text-lg font-semibold">
              {showUserTickets ? 'Meus Tickets Recentes' : 'Tickets Recentes'}
            </h3>
          </div>
          {tickets.length > 0 && (
            <Link
              href={showUserTickets ? '/tickets' : '/admin/tickets'}
              className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium flex items-center group"
            >
              Ver todos
              <ArrowRightIcon className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {tickets.length === 0 ? (
          <div className="card-body text-center py-8">
            <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <TicketIcon className="h-6 w-6 text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {showUserTickets ? 'Você ainda não criou nenhum ticket' : 'Nenhum ticket encontrado'}
            </p>
            <Link
              href="/tickets/new"
              className="btn btn-primary btn-sm"
            >
              Criar Ticket
            </Link>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-brand-600 dark:hover:text-brand-400 truncate block group"
                  >
                    <span className="text-neutral-500 dark:text-neutral-400">#{ticket.id}</span> {ticket.title}
                  </Link>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-neutral-500 dark:text-neutral-400">
                    <div className="flex items-center">
                      <UserIcon className="h-3 w-3 mr-1" />
                      {ticket.user_name}
                    </div>
                    <div className="flex items-center">
                      <TagIcon className="h-3 w-3 mr-1" />
                      {ticket.category_name}
                    </div>
                    <div className="flex items-center">
                      <ClockIcon className="h-3 w-3 mr-1" />
                      {formatDate(ticket.created_at)}
                    </div>
                  </div>
                </div>
                <div className="ml-4 flex items-center space-x-2">
                  {getPriorityIcon(ticket.priority_level)}
                  <span
                    className="badge text-xs"
                    style={{
                      backgroundColor: `${ticket.status_color}15`,
                      borderColor: `${ticket.status_color}30`,
                      color: ticket.status_color
                    }}
                  >
                    {ticket.status_name}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
