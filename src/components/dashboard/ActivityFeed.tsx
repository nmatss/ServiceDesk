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
        return <UserIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'ticket_created':
        return 'bg-blue-50'
      case 'ticket_updated':
        return 'bg-yellow-50'
      case 'ticket_resolved':
        return 'bg-green-50'
      case 'comment_added':
        return 'bg-purple-50'
      case 'attachment_uploaded':
        return 'bg-indigo-50'
      default:
        return 'bg-gray-50'
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
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Atividade Recente</h3>
        <div className="space-y-4">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start space-x-3">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Atividade Recente</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {activities.length === 0 ? (
          <div className="px-6 py-4 text-center">
            <p className="text-sm text-gray-500">Nenhuma atividade recente</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="px-6 py-4">
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 p-2 rounded-full ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user_name}</span>{' '}
                      {activity.description}
                      {activity.ticket_id && (
                        <span className="text-indigo-600">
                          {' '}no ticket #{activity.ticket_id}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center text-xs text-gray-500">
                      <ClockIcon className="h-3 w-3 mr-1" />
                      {formatTime(activity.timestamp)}
                    </div>
                  </div>
                  {activity.ticket_title && (
                    <p className="mt-1 text-sm text-gray-600 truncate">
                      "{activity.ticket_title}"
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
