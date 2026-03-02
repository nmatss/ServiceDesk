'use client'

import { useState, useEffect } from 'react'
import { 
  UserIcon, 
  TicketIcon, 
  ChatBubbleLeftRightIcon,
  PaperClipIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface Activity {
  id: string
  type: 'ticket_created' | 'ticket_updated' | 'comment_added' | 'attachment_uploaded' | 'ticket_resolved'
  user_name: string
  ticket_id?: number
  ticket_title?: string
  description: string
  timestamp: string
}

interface ActivityFeedProps {
  limit?: number
}

export default function ActivityFeed({ limit = 10 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simular dados de atividade (em produção, viria de uma API)
    const mockActivities: Activity[] = [
      {
        id: '1',
        type: 'ticket_created',
        user_name: 'João Silva',
        ticket_id: 123,
        ticket_title: 'Problema com login',
        description: 'criou um novo ticket',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min atrás
      },
      {
        id: '2',
        type: 'comment_added',
        user_name: 'Maria Santos',
        ticket_id: 122,
        ticket_title: 'Erro na aplicação',
        description: 'adicionou um comentário',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2h atrás
      },
      {
        id: '3',
        type: 'ticket_resolved',
        user_name: 'Carlos Lima',
        ticket_id: 121,
        ticket_title: 'Configuração de email',
        description: 'resolveu o ticket',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() // 4h atrás
      },
      {
        id: '4',
        type: 'attachment_uploaded',
        user_name: 'Ana Costa',
        ticket_id: 120,
        ticket_title: 'Documentação necessária',
        description: 'fez upload de um anexo',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() // 6h atrás
      },
      {
        id: '5',
        type: 'ticket_updated',
        user_name: 'Pedro Oliveira',
        ticket_id: 119,
        ticket_title: 'Melhoria solicitada',
        description: 'atualizou o ticket',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() // 8h atrás
      }
    ]

    setTimeout(() => {
      setActivities(mockActivities.slice(0, limit))
      setLoading(false)
    }, 1000)
  }, [limit])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ticket_created':
        return <TicketIcon className="h-5 w-5 text-blue-500" />
      case 'ticket_updated':
        return <TicketIcon className="h-5 w-5 text-yellow-500" />
      case 'ticket_resolved':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'comment_added':
        return <ChatBubbleLeftRightIcon className="h-5 w-5 text-purple-500" />
      case 'attachment_uploaded':
        return <PaperClipIcon className="h-5 w-5 text-indigo-500" />
      default:
        return <UserIcon className="h-5 w-5 text-neutral-500" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'ticket_created':
        return 'bg-blue-50 dark:bg-blue-900/20'
      case 'ticket_updated':
        return 'bg-yellow-50 dark:bg-yellow-900/20'
      case 'ticket_resolved':
        return 'bg-green-50 dark:bg-green-900/20'
      case 'comment_added':
        return 'bg-purple-50 dark:bg-purple-900/20'
      case 'attachment_uploaded':
        return 'bg-indigo-50 dark:bg-indigo-900/20'
      default:
        return 'bg-neutral-50 dark:bg-neutral-800'
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) {
      return 'Agora mesmo'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}min atrás`
    } else if (diffInMinutes < 1440) { // 24 horas
      const hours = Math.floor(diffInMinutes / 60)
      return `${hours}h atrás`
    } else {
      const days = Math.floor(diffInMinutes / 1440)
      return `${days}d atrás`
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">Atividade Recente</h3>
        <div className="space-y-4">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start space-x-3">
                <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-neutral-800 shadow rounded-lg">
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">Atividade Recente</h3>
      </div>
      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {activities.length === 0 ? (
          <div className="px-6 py-4 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma atividade recente</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 p-2 rounded-full ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <p className="text-sm text-neutral-900 dark:text-neutral-100">
                      <span className="font-medium">{activity.user_name}</span>{' '}
                      {activity.description}
                      {activity.ticket_id && (
                        <span className="text-brand-600 dark:text-brand-400">
                          {' '}no ticket #{activity.ticket_id}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                      <ClockIcon className="h-3 w-3 mr-1" />
                      {formatTime(activity.timestamp)}
                    </div>
                  </div>
                  {activity.ticket_title && (
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 truncate">
                      &ldquo;{activity.ticket_title}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
