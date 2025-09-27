'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface Notification {
  id: number
  type: string
  message: string
  title?: string
  timestamp: string
  user_id: number
  tenant_id: number
  is_read: boolean
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: number) => void
  markAllAsRead: () => void
  isConnected: boolean
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

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markAsRead = (id: number) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification
      )
    )

    fetch('/api/notifications', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': '1'
      },
      body: JSON.stringify({ notification_id: id })
    }).catch(console.error)
  }

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, is_read: true }))
    )

    fetch('/api/notifications', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': '1'
      },
      body: JSON.stringify({ mark_all_read: true })
    }).catch(console.error)
  }

  useEffect(() => {
    const eventSource = new EventSource('/api/notifications/sse', {
      withCredentials: true
    })

    eventSource.onopen = () => {
      setIsConnected(true)
      console.log('Connected to notification stream')
    }

    eventSource.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data)
        console.log('Received notification:', notification)

        if (notification.type !== 'connection') {
          setNotifications(prev => [notification, ...prev.slice(0, 99)]) // Manter apenas 100 notificações
        }
      } catch (error) {
        console.error('Error parsing notification:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      setIsConnected(false)
    }

    return () => {
      eventSource.close()
      setIsConnected(false)
    }
  }, [])

  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isConnected
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}