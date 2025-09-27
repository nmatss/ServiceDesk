'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BellIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  TicketIcon,
  UserIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { useSocket } from '@/src/hooks/useSocket'

interface Notification {
  type: string
  title: string
  message: string
  data?: any
  timestamp: string
  priority?: 'low' | 'medium' | 'high'
}

export default function RealtimeNotifications() {
  const { notifications, clearNotifications, markNotificationAsRead, isConnected } = useSocket()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    setUnreadCount(notifications.length)
  }, [notifications])

  const getNotificationIcon = (type: string) => {
    const iconClass = \"w-5 h-5\"

    switch (type) {
      case 'ticket_assigned':
      case 'ticket_updated':
        return <TicketIcon className={iconClass} />
      case 'comment_added':
        return <UserIcon className={iconClass} />
      case 'sla_warning':
      case 'sla_breach':
        return <ClockIcon className={iconClass} />
      case 'system_alert':
        return <ExclamationTriangleIcon className={iconClass} />
      default:
        return <InformationCircleIcon className={iconClass} />
    }
  }

  const getNotificationColor = (type: string, priority?: string) => {
    if (priority === 'high') return 'border-red-200 bg-red-50'
    if (priority === 'medium') return 'border-yellow-200 bg-yellow-50'

    switch (type) {
      case 'ticket_assigned':
        return 'border-blue-200 bg-blue-50'
      case 'ticket_updated':
        return 'border-indigo-200 bg-indigo-50'
      case 'comment_added':
        return 'border-green-200 bg-green-50'
      case 'sla_warning':
      case 'sla_breach':
        return 'border-orange-200 bg-orange-50'
      case 'system_alert':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const handleNotificationClick = (notification: Notification, index: number) => {
    // Marcar como lida
    markNotificationAsRead(index)

    // Navegar para a página apropriada
    if (notification.data?.ticketId) {
      router.push(`/tickets/${notification.data.ticketId}`)
    } else if (notification.type === 'system_alert') {
      router.push('/admin/settings')
    }

    setIsOpen(false)
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}m atrás`
    if (hours < 24) return `${hours}h atrás`
    return `${days}d atrás`
  }

  return (
    <div className=\"relative\">
      {/* Botão de notificações */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isConnected
            ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            : 'text-gray-400 cursor-not-allowed'
        }`}
        disabled={!isConnected}
        title={isConnected ? 'Notificações' : 'Desconectado'}
      >
        <BellIcon className=\"w-6 h-6\" />

        {/* Indicador de conexão */}
        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
          isConnected ? 'bg-green-500' : 'bg-gray-400'
        }`} />

        {/* Contador de notificações */}
        {unreadCount > 0 && (
          <div className=\"absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center\">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown de notificações */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className=\"fixed inset-0 z-10\"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className=\"absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-96 overflow-hidden\">
            {/* Header */}
            <div className=\"flex items-center justify-between p-4 border-b border-gray-200\">
              <h3 className=\"text-lg font-semibold text-gray-900\">
                Notificações
              </h3>
              <div className=\"flex items-center space-x-2\">
                {notifications.length > 0 && (
                  <button
                    onClick={clearNotifications}
                    className=\"text-sm text-gray-500 hover:text-gray-700\"
                    title=\"Limpar todas\"
                  >
                    <CheckIcon className=\"w-4 h-4\" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className=\"text-gray-400 hover:text-gray-600\"
                >
                  <XMarkIcon className=\"w-5 h-5\" />
                </button>
              </div>
            </div>

            {/* Status de conexão */}
            <div className={`px-4 py-2 text-xs font-medium ${
              isConnected
                ? 'text-green-700 bg-green-50'
                : 'text-red-700 bg-red-50'
            }`}>
              {isConnected ? '🟢 Conectado - Recebendo notificações em tempo real' : '🔴 Desconectado - Reconectando...'}
            </div>

            {/* Lista de notificações */}
            <div className=\"max-h-80 overflow-y-auto\">
              {notifications.length === 0 ? (
                <div className=\"p-8 text-center\">
                  <BellIcon className=\"w-12 h-12 text-gray-300 mx-auto mb-4\" />
                  <p className=\"text-gray-500 text-sm\">
                    Nenhuma notificação no momento
                  </p>
                </div>
              ) : (
                <div className=\"divide-y divide-gray-100\">
                  {notifications.map((notification, index) => (
                    <div
                      key={index}
                      onClick={() => handleNotificationClick(notification, index)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${getNotificationColor(notification.type, notification.priority)}`}
                    >
                      <div className=\"flex items-start space-x-3\">
                        <div className={`flex-shrink-0 p-2 rounded-lg ${
                          notification.priority === 'high'
                            ? 'text-red-600 bg-red-100'
                            : notification.priority === 'medium'
                            ? 'text-yellow-600 bg-yellow-100'
                            : 'text-blue-600 bg-blue-100'
                        }`}>
                          {getNotificationIcon(notification.type)}
                        </div>

                        <div className=\"flex-1 min-w-0\">
                          <div className=\"flex items-center justify-between mb-1\">
                            <h4 className=\"text-sm font-medium text-gray-900 truncate\">
                              {notification.title}
                            </h4>
                            <span className=\"text-xs text-gray-500 flex-shrink-0 ml-2\">
                              {formatTimestamp(notification.timestamp)}
                            </span>
                          </div>

                          <p className=\"text-sm text-gray-600 line-clamp-2\">
                            {notification.message}
                          </p>

                          {/* Indicador de prioridade */}
                          {notification.priority === 'high' && (
                            <div className=\"inline-flex items-center mt-2 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800\">
                              <ExclamationTriangleIcon className=\"w-3 h-3 mr-1\" />
                              Alta Prioridade
                            </div>
                          )}

                          {/* Dados adicionais */}
                          {notification.data?.ticketId && (
                            <div className=\"mt-2 text-xs text-gray-500\">
                              Ticket #{notification.data.ticketId}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className=\"p-3 bg-gray-50 border-t border-gray-200\">
                <button
                  onClick={() => {
                    router.push('/notifications')
                    setIsOpen(false)
                  }}
                  className=\"w-full text-sm text-blue-600 hover:text-blue-700 font-medium\"
                >
                  Ver todas as notificações
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}