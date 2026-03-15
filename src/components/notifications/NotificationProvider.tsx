'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon
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
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stoppedRef = useRef(false)
  const pollIntervalMs = useRef(30000) // Start at 30s

  const POLL_MIN_MS = 30000  // 30s minimum
  const POLL_MAX_MS = 120000 // 120s maximum
  const POLL_BACKOFF_FACTOR = 1.5

  // Stable ref for addNotification to avoid effect re-runs
  const addNotificationRef = useRef(addNotification)
  addNotificationRef.current = addNotification

  useEffect(() => {
    stoppedRef.current = false
    pollIntervalMs.current = POLL_MIN_MS

    const scheduleNextPoll = () => {
      if (stoppedRef.current) return
      pollTimeoutRef.current = setTimeout(pollNotifications, pollIntervalMs.current)
    }

    const pollNotifications = async () => {
      if (stoppedRef.current) return

      try {
        const response = await fetch('/api/notifications/unread', {
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          if (data.notifications && data.notifications.length > 0) {
            // New notifications found — reset interval to minimum
            pollIntervalMs.current = POLL_MIN_MS
            data.notifications.forEach((notification: any) => {
              addNotificationRef.current({
                type: notification.type,
                title: notification.title,
                message: notification.message,
                persistent: false
              })
            })
          } else {
            // No new notifications — increase interval with backoff
            pollIntervalMs.current = Math.min(
              pollIntervalMs.current * POLL_BACKOFF_FACTOR,
              POLL_MAX_MS
            )
          }
        } else if (response.status === 401) {
          // Token invalid — stop polling permanently until remount
          stoppedRef.current = true
          return
        }
      } catch {
        // Silently fail for network errors to avoid console spam
      }

      scheduleNextPoll()
    }

    // Delay first poll by 8s to let auth fully settle
    const initialTimeout = setTimeout(() => {
      if (stoppedRef.current) return
      pollNotifications()
    }, 8000)

    return () => {
      clearTimeout(initialTimeout)
      stoppedRef.current = true
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, []) // No deps — runs once on mount, uses refs for mutable values

  const value = useMemo<NotificationContextType>(() => ({
    notifications,
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    unreadCount
  }), [notifications, addNotification, removeNotification, markAsRead, markAllAsRead, clearAll, unreadCount])

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
    const base = 'h-5 w-5 flex-shrink-0'
    switch (type) {
      case 'success': return <CheckCircleIcon className={`${base} text-emerald-500`} />
      case 'error': return <XCircleIcon className={`${base} text-red-500`} />
      case 'warning': return <ExclamationTriangleIcon className={`${base} text-amber-500`} />
      case 'info': return <InformationCircleIcon className={`${base} text-brand-500`} />
    }
  }

  const getColors = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700'
      case 'error': return 'bg-red-50 dark:bg-red-950/80 border-red-300 dark:border-red-700'
      case 'warning': return 'bg-amber-50 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700'
      case 'info': return 'bg-brand-50 dark:bg-brand-950/80 border-brand-300 dark:border-brand-700'
    }
  }

  const getAccent = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-emerald-500'
      case 'error': return 'bg-red-500'
      case 'warning': return 'bg-amber-500'
      case 'info': return 'bg-brand-500'
    }
  }

  // Only show non-read, recent notifications as toasts
  const visibleToasts = notifications.filter(n => !n.read).slice(0, 3)

  if (visibleToasts.length === 0) return null

  return (
    <div
      className="fixed top-20 right-4 z-50 w-full max-w-sm space-y-2 pointer-events-none"
      role="region"
      aria-label="Notificações"
      aria-live="polite"
    >
      {visibleToasts.map((notification) => (
        <div
          key={notification.id}
          className={`pointer-events-auto relative overflow-hidden border rounded-xl shadow-xl ring-1 ring-black/5 dark:ring-white/5 backdrop-blur-sm ${getColors(notification.type)}`}
          onClick={() => markAsRead(notification.id)}
          role="alert"
          style={{ animation: 'fadeSlideRight 0.3s ease-out' }}
        >
          {/* Accent bar */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${getAccent(notification.type)}`} />

          <div className="flex items-start gap-3 p-3.5 pl-5">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                {notification.title}
              </h4>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-300 mt-0.5 line-clamp-2">
                {notification.message}
              </p>

              {/* Actions */}
              {notification.actions && notification.actions.length > 0 && (
                <div className="flex items-center gap-2 mt-2.5">
                  {notification.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation()
                        action.action()
                        removeNotification(notification.id)
                      }}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                        action.variant === 'primary'
                          ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                          : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeNotification(notification.id)
              }}
              className="flex-shrink-0 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
              aria-label={`Fechar notificação: ${notification.title}`}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
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