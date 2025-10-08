'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { logger } from '@/lib/monitoring/logger';

interface Notification {
  type: string
  title: string
  message: string
  data?: any
  timestamp: string
  priority?: 'low' | 'medium' | 'high'
}

interface OnlineUser {
  id: number
  name: string
  role: string
  last_activity: string
}

interface UseSocketReturn {
  socket: Socket | null
  isConnected: boolean
  notifications: Notification[]
  onlineUsers: OnlineUser[]
  sendNotification: (notification: Notification) => void
  joinTicketRoom: (ticketId: number) => void
  leaveTicketRoom: (ticketId: number) => void
  startTyping: (ticketId: number, userName: string) => void
  stopTyping: (ticketId: number) => void
  clearNotifications: () => void
  markNotificationAsRead: (index: number) => void
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    const token = localStorage.getItem('auth_token')

    if (!token) {
      logger.warn('No auth token found for socket connection')
      return
    }

    // Criar conexão socket
    const socket = io(process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin
      : 'http://localhost:3000', {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    socketRef.current = socket

    // Event handlers
    socket.on('connect', () => {
      logger.info('🔗 Socket connected', socket.id)
      setIsConnected(true)

      // Solicitar lista de usuários online
      socket.emit('request_online_users')
    })

    socket.on('disconnect', (reason) => {
      logger.info('🔌 Socket disconnected', reason)
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      logger.error('❌ Socket connection error', error)
      setIsConnected(false)
    })

    // Receber notificações
    socket.on('notification', (notification: Notification) => {
      logger.info('📢 New notification', notification)

      setNotifications(prev => [notification, ...prev.slice(0, 49)]) // Manter apenas 50 notificações

      // Mostrar notificação no browser se permitido
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          const browserNotification = new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: notification.type,
            requireInteraction: notification.priority === 'high'
          })

          // Auto-fechar após 5 segundos (exceto prioridade alta)
          if (notification.priority !== 'high') {
            setTimeout(() => {
              browserNotification.close()
            }, 5000)
          }
        } else if (Notification.permission === 'default') {
          // Solicitar permissão
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              logger.info('✅ Notification permission granted')
            }
          })
        }
      }

      // Tocar som de notificação
      if (typeof window !== 'undefined') {
        try {
          const audio = new Audio('/sounds/notification.mp3')
          audio.volume = 0.3
          audio.play().catch(e => {
            logger.info('Could not play notification sound', e)
          })
        } catch (e) {
          logger.info('Audio not available')
        }
      }
    })

    // Atualizar lista de usuários online
    socket.on('online_users_updated', (users: OnlineUser[]) => {
      logger.info('👥 Online users updated', users.length)
      setOnlineUsers(users)
    })

    // Status de usuário mudou
    socket.on('user_status_changed', (data: { userId: number; isOnline: boolean }) => {
      logger.info(`👤 User ${data.userId} is now ${data.isOnline ? 'online' : 'offline'}`)

      if (!data.isOnline) {
        setOnlineUsers(prev => prev.filter(user => user.id !== data.userId))
      }
    })

    // Indicador de digitação
    socket.on('user_typing', (data: { userName: string; userId: number; isTyping: boolean }) => {
      logger.info(`⌨️ ${data.userName} is ${data.isTyping ? 'typing' : 'stopped typing'}`)

      // Emitir evento personalizado para componentes que estão escutando
      const event = new CustomEvent('user_typing', { detail: data })
      window.dispatchEvent(event)
    })

    // Cleanup na desmontagem
    return () => {
      logger.info('🧹 Cleaning up socket connection')
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setNotifications([])
      setOnlineUsers([])
    }
  }, [])

  const sendNotification = (notification: Notification) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_notification', notification)
    }
  }

  const joinTicketRoom = (ticketId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_ticket', ticketId)
      logger.info(`📝 Joined ticket room: ${ticketId}`)
    }
  }

  const leaveTicketRoom = (ticketId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_ticket', ticketId)
      logger.info(`📝 Left ticket room: ${ticketId}`)
    }
  }

  const startTyping = (ticketId: number, userName: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing_start', { ticketId, userName })
    }
  }

  const stopTyping = (ticketId: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing_stop', { ticketId })
    }
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  const markNotificationAsRead = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index))
  }

  return {
    socket: socketRef.current,
    isConnected,
    notifications,
    onlineUsers,
    sendNotification,
    joinTicketRoom,
    leaveTicketRoom,
    startTyping,
    stopTyping,
    clearNotifications,
    markNotificationAsRead
  }
}