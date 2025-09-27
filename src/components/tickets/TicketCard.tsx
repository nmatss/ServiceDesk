'use client'

import React from 'react'
import Link from 'next/link'
import {
  ClockIcon,
  UserIcon,
  TagIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChatBubbleLeftEllipsisIcon,
  EyeIcon,
  PencilIcon
} from '@heroicons/react/24/outline'
import {
  ClockIcon as ClockIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid'

export interface Ticket {
  id: number
  title: string
  description?: string
  status: string
  status_name: string
  status_color: string
  priority: string
  priority_name: string
  priority_level: number
  priority_color: string
  category: string
  category_name: string
  category_color?: string
  user_id: number
  user_name: string
  user_email: string
  assigned_agent_id?: number
  assigned_agent_name?: string
  created_at: string
  updated_at: string
  last_reply?: string
  replies_count?: number
  attachments_count?: number
  sla_deadline?: string
  tags?: string[]
}

interface TicketCardProps {
  ticket: Ticket
  variant?: 'default' | 'compact' | 'detailed'
  showActions?: boolean
  userRole?: 'admin' | 'agent' | 'user'
  onClick?: () => void
  className?: string
}

export default function TicketCard({
  ticket,
  variant = 'default',
  showActions = false,
  userRole = 'user',
  onClick,
  className = ''
}: TicketCardProps) {
  const getPriorityIcon = (level: number, solid = false) => {
    const iconClass = "h-4 w-4"
    const IconComponent = solid ? ExclamationTriangleIconSolid : ExclamationTriangleIcon

    switch (level) {
      case 1: return <CheckCircleIcon className={`${iconClass} text-success-500`} />
      case 2: return <ClockIcon className={`${iconClass} text-warning-500`} />
      case 3: return <IconComponent className={`${iconClass} text-orange-500`} />
      case 4: return <IconComponent className={`${iconClass} text-error-500`} />
      default: return <ClockIcon className={`${iconClass} text-neutral-500`} />
    }
  }

  const formatRelativeTime = (dateString: string) => {
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

  const getSLAStatus = () => {
    if (!ticket.sla_deadline) return null

    const deadline = new Date(ticket.sla_deadline)
    const now = new Date()
    const diffInHours = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 0) {
      return { status: 'overdue', text: 'SLA Vencido', class: 'text-error-600 bg-error-50 border-error-200' }
    } else if (diffInHours < 2) {
      return { status: 'critical', text: 'SLA Crítico', class: 'text-warning-700 bg-warning-50 border-warning-200' }
    } else if (diffInHours < 24) {
      return { status: 'warning', text: `${diffInHours}h restantes`, class: 'text-warning-600 bg-warning-50 border-warning-200' }
    }
    return null
  }

  const slaStatus = getSLAStatus()

  if (variant === 'compact') {
    return (
      <div
        className={`card group hover:shadow-medium transition-all duration-200 cursor-pointer ${className}`}
        onClick={onClick}
      >
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <Link
                href={`/tickets/${ticket.id}`}
                className="text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-brand-600 dark:hover:text-brand-400 truncate block group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
              >
                #{ticket.id} {ticket.title}
              </Link>
              <div className="mt-1 flex items-center space-x-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="flex items-center">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  {formatRelativeTime(ticket.created_at)}
                </span>
                {ticket.replies_count && ticket.replies_count > 0 && (
                  <span className="flex items-center">
                    <ChatBubbleLeftEllipsisIcon className="h-3 w-3 mr-1" />
                    {ticket.replies_count}
                  </span>
                )}
              </div>
            </div>
            <div className="ml-3 flex items-center space-x-2">
              {getPriorityIcon(ticket.priority_level)}
              <span className="badge badge-outline text-xs" style={{
                borderColor: ticket.status_color,
                color: ticket.status_color
              }}>
                {ticket.status_name}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`card group hover:shadow-medium transition-all duration-200 cursor-pointer ${className}`}
      onClick={onClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                Ticket #{ticket.id}
              </span>
              {slaStatus && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${slaStatus.class}`}>
                  {slaStatus.text}
                </span>
              )}
            </div>
            <Link
              href={`/tickets/${ticket.id}`}
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 hover:text-brand-600 dark:hover:text-brand-400 line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
            >
              {ticket.title}
            </Link>
            {variant === 'detailed' && ticket.description && (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                {ticket.description}
              </p>
            )}
          </div>
          <div className="ml-4 flex items-center space-x-2">
            {getPriorityIcon(ticket.priority_level)}
            <span
              className="badge text-sm"
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

        {/* Meta information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400">
            <UserIcon className="h-4 w-4 mr-2 text-neutral-400" />
            <span className="truncate">{ticket.user_name}</span>
          </div>
          <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400">
            <TagIcon className="h-4 w-4 mr-2 text-neutral-400" />
            <span className="truncate">{ticket.category_name}</span>
          </div>
          {ticket.assigned_agent_name && (
            <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400">
              <UserIcon className="h-4 w-4 mr-2 text-neutral-400" />
              <span className="truncate">Agente: {ticket.assigned_agent_name}</span>
            </div>
          )}
          <div className="flex items-center text-sm text-neutral-600 dark:text-neutral-400">
            <ClockIcon className="h-4 w-4 mr-2 text-neutral-400" />
            <span>{formatRelativeTime(ticket.created_at)}</span>
          </div>
        </div>

        {/* Tags */}
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {ticket.tags.map((tag, index) => (
              <span
                key={index}
                className="badge badge-neutral text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer with stats and actions */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center space-x-4 text-sm text-neutral-500 dark:text-neutral-400">
            {ticket.replies_count && ticket.replies_count > 0 && (
              <span className="flex items-center">
                <ChatBubbleLeftEllipsisIcon className="h-4 w-4 mr-1" />
                {ticket.replies_count} {ticket.replies_count === 1 ? 'resposta' : 'respostas'}
              </span>
            )}
            {ticket.attachments_count && ticket.attachments_count > 0 && (
              <span className="flex items-center">
                📎 {ticket.attachments_count}
              </span>
            )}
            {ticket.last_reply && (
              <span className="text-xs">
                Última resposta: {formatRelativeTime(ticket.last_reply)}
              </span>
            )}
          </div>

          {showActions && (
            <div className="flex items-center space-x-2">
              <Link
                href={`/tickets/${ticket.id}`}
                className="btn btn-outline btn-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                Ver
              </Link>
              {(userRole === 'admin' || userRole === 'agent') && (
                <Link
                  href={`/tickets/${ticket.id}/edit`}
                  className="btn btn-primary btn-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PencilIcon className="h-4 w-4 mr-1" />
                  Editar
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}