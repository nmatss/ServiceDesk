'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
  BellIcon
} from '@heroicons/react/24/outline'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  persistent?: boolean
  timestamp: Date
  read?: boolean
  actions?: {
    label: string
    action: () => void
    variant?: 'primary' | 'secondary'
  }[]
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
  unreadCount: number
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: React.ReactNode
  maxNotifications?: number
}

export function NotificationProvider({ children, maxNotifications = 5 }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      duration: notification.duration ?? (notification.persistent ? undefined : 5000)
    }

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, maxNotifications)
      return updated
    })

    // Auto-remove if not persistent
    if (!notification.persistent && newNotification.duration) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }, [maxNotifications])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    )
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  // Listen for server-sent events or WebSocket for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    // Example WebSocket connection (you would implement the actual WebSocket logic)
    const connectWebSocket = () => {
      // This is a placeholder for WebSocket connection
      // In a real implementation, you would connect to your WebSocket server
      /*
      const ws = new WebSocket(`ws://localhost:3001/notifications?token=${token}`)

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        addNotification({
          type: data.type,
          title: data.title,
          message: data.message,
          persistent: data.persistent
        })
      }

      ws.onclose = () => {
        // Reconnect logic
        setTimeout(connectWebSocket, 5000)
      }

      return ws
      */
    }

    // For now, we'll simulate real-time notifications with polling
    const pollNotifications = async () => {
      try {
        const currentToken = localStorage.getItem('auth_token')
        if (!currentToken) return // Stop polling if no token

        const response = await fetch('/api/notifications/unread', {
          headers: {
            'Authorization': `Bearer ${currentToken}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.notifications && data.notifications.length > 0) {
            data.notifications.forEach((notification: any) => {
              addNotification({
                type: notification.type,
                title: notification.title,
                message: notification.message,
                persistent: false
              })
            })
          }
        } else if (response.status === 401) {
          // Token invalid, stop polling
          return
        }
      } catch (error) {
        // Silently fail for network errors to avoid console spam
      }
    }

    // Poll every 30 seconds
    const pollInterval = setInterval(pollNotifications, 30000)

    return () => {
      clearInterval(pollInterval)
    }
  }, [addNotification])

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    unreadCount
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

function NotificationContainer() {
  const { notifications, removeNotification, markAsRead } = useNotifications()

  const getIcon = (type: Notification['type']) => {
    const iconClass = "h-5 w-5"
    switch (type) {
      case 'success': return <CheckCircleIcon className={`${iconClass} text-success-500`} />
      case 'error': return <XCircleIcon className={`${iconClass} text-error-500`} />
      case 'warning': return <ExclamationTriangleIcon className={`${iconClass} text-warning-500`} />
      case 'info': return <InformationCircleIcon className={`${iconClass} text-info-500`} />
    }
  }

  const getNotificationColors = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-success-50 border-success-200 text-success-800 dark:bg-success-900/20 dark:border-success-800 dark:text-success-200'
      case 'error': return 'bg-error-50 border-error-200 text-error-800 dark:bg-error-900/20 dark:border-error-800 dark:text-error-200'
      case 'warning': return 'bg-warning-50 border-warning-200 text-warning-800 dark:bg-warning-900/20 dark:border-warning-800 dark:text-warning-200'
      case 'info': return 'bg-info-50 border-info-200 text-info-800 dark:bg-info-900/20 dark:border-info-800 dark:text-info-200'
    }
  }

  const formatTime = (timestamp: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Agora mesmo'
    if (diffInMinutes < 60) return `${diffInMinutes}min atrás`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h atrás`

    return timestamp.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm w-full space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`border rounded-lg shadow-lg p-4 animate-slide-in ${getNotificationColors(notification.type)} ${
            !notification.read ? 'ring-2 ring-brand-500/20' : ''
          }`}
          onClick={() => markAsRead(notification.id)}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {getIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">{notification.title}</h4>
                  <p className="text-sm opacity-90">{notification.message}</p>
                  <p className="text-xs opacity-75 mt-2">{formatTime(notification.timestamp)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeNotification(notification.id)
                  }}
                  className="ml-2 flex-shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Actions */}
              {notification.actions && notification.actions.length > 0 && (
                <div className="flex items-center space-x-2 mt-3">
                  {notification.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation()
                        action.action()
                        removeNotification(notification.id)
                      }}
                      className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                        action.variant === 'primary'
                          ? 'bg-current text-white bg-opacity-90 hover:bg-opacity-100'
                          : 'bg-current bg-opacity-10 hover:bg-opacity-20'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Utility hook for common notification patterns
export function useNotificationHelpers() {
  const { addNotification } = useNotifications()

  return {
    success: (title: string, message: string) =>
      addNotification({ type: 'success', title, message }),

    error: (title: string, message: string) =>
      addNotification({ type: 'error', title, message, persistent: true }),

    warning: (title: string, message: string) =>
      addNotification({ type: 'warning', title, message }),

    info: (title: string, message: string) =>
      addNotification({ type: 'info', title, message }),

    ticketCreated: (ticketId: number) =>
      addNotification({
        type: 'success',
        title: 'Ticket Criado',
        message: `Ticket #${ticketId} foi criado com sucesso`,
        actions: [
          {
            label: 'Ver Ticket',
            action: () => window.location.href = `/tickets/${ticketId}`,
            variant: 'primary'
          }
        ]
      }),

    ticketUpdated: (ticketId: number) =>
      addNotification({
        type: 'info',
        title: 'Ticket Atualizado',
        message: `Ticket #${ticketId} foi atualizado`,
        actions: [
          {
            label: 'Ver Ticket',
            action: () => window.location.href = `/tickets/${ticketId}`,
            variant: 'primary'
          }
        ]
      }),

    ticketAssigned: (ticketId: number, agentName: string) =>
      addNotification({
        type: 'info',
        title: 'Ticket Atribuído',
        message: `Ticket #${ticketId} foi atribuído para ${agentName}`,
        actions: [
          {
            label: 'Ver Ticket',
            action: () => window.location.href = `/tickets/${ticketId}`,
            variant: 'primary'
          }
        ]
      })
  }
}