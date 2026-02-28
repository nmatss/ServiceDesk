'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';

interface Notification {
  id: number
  type: string
  message: string
  title?: string
  timestamp: string
  user_id: number
  tenant_id: number
  is_read: boolean
  ticket_id?: number
  data?: any
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: number) => void
  markAllAsRead: () => void
  isConnected: boolean
  refresh: () => Promise<void>
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
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [usePolling, setUsePolling] = useState(false)
  const [authFailed, setAuthFailed] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pathname = usePathname()

  const unreadCount = notifications.filter(n => !n.is_read).length

  // Check if on auth page — skip all network requests
  const isAuthPage = pathname?.startsWith('/auth/') || pathname === '/landing'

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread', {
        credentials: 'include',
      })

      if (response.status === 401) {
        // Not authenticated — stop all polling/SSE
        setAuthFailed(true)
        setIsConnected(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const data = await response.json()

      if (data.success && data.notifications) {
        // Transform API response to match our notification interface
        const formattedNotifications = data.notifications.map((notif: any) => ({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          timestamp: notif.createdAt,
          is_read: notif.isRead,
          user_id: 0, // Will be set server-side
          tenant_id: 0, // Will be set server-side
          ticket_id: notif.data?.ticketId,
          data: notif.data,
        }))

        setNotifications(formattedNotifications)
        setIsConnected(true)
      }
    } catch (error) {
      logger.error('Error fetching notifications', error)
      setIsConnected(false)
    }
  }, [])

  const markAsRead = useCallback((id: number) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification
      )
    )

    // SECURITY: Use httpOnly cookies for authentication - tenant is extracted server-side
    fetch('/api/notifications', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Use httpOnly cookies
      body: JSON.stringify({ notification_id: id })
    }).catch(err => logger.error('Error marking notification as read', err))
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, is_read: true }))
    )

    // SECURITY: Use httpOnly cookies for authentication - tenant is extracted server-side
    fetch('/api/notifications', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Use httpOnly cookies
      body: JSON.stringify({ mark_all_read: true })
    }).catch(err => logger.error('Error marking all notifications as read', err))
  }, [])

  // Setup SSE connection
  useEffect(() => {
    if (usePolling || isAuthPage || authFailed) return

    let retryCount = 0
    const maxRetries = 3

    const setupSSE = () => {
      try {
        const eventSource = new EventSource('/api/notifications/sse', {
          withCredentials: true
        })

        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          setIsConnected(true)
          retryCount = 0
          logger.info('Connected to notification stream')
        }

        eventSource.onmessage = (event) => {
          try {
            const notification = JSON.parse(event.data)
            logger.info('Received notification', notification)

            if (notification.type !== 'connection') {
              setNotifications(prev => [notification, ...prev.slice(0, 99)])
            }
          } catch (error) {
            logger.error('Error parsing notification', error)
          }
        }

        eventSource.onerror = (error) => {
          logger.error('SSE error', error)
          setIsConnected(false)
          eventSource.close()
          eventSourceRef.current = null

          // Switch to polling after max retries
          retryCount++
          if (retryCount >= maxRetries) {
            logger.warn('SSE max retries reached, switching to polling')
            setUsePolling(true)
          } else {
            // Retry SSE connection after delay
            setTimeout(setupSSE, 5000 * retryCount)
          }
        }
      } catch (error) {
        logger.error('Error setting up SSE', error)
        setUsePolling(true)
      }
    }

    // Initial fetch
    fetchNotifications()

    // Setup SSE
    setupSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [usePolling, isAuthPage, authFailed, fetchNotifications])

  // Setup polling fallback
  useEffect(() => {
    if (!usePolling || isAuthPage || authFailed) return

    logger.info('Using polling for notifications')

    // Initial fetch
    fetchNotifications()

    // Poll every 30 seconds
    pollingIntervalRef.current = setInterval(fetchNotifications, 30000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [usePolling, isAuthPage, authFailed, fetchNotifications])

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isConnected,
    refresh: fetchNotifications,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}