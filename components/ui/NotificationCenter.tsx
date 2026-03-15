'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  BellIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
  actions?: NotificationAction[]
}

interface NotificationAction {
  label: string
  action: () => void
  variant?: 'primary' | 'secondary'
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onRemove: (id: string) => void
  onClearAll: () => void
  unreadCount: number
  className?: string
}

export const NotificationCenter = React.memo(function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onRemove,
  onClearAll,
  unreadCount,
  className = ''
}: NotificationCenterProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      if (filter === 'unread' && notification.read) return false

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query)
        )
      }

      return true
    })
  }, [notifications, filter, searchQuery])

  // Format relative time in Portuguese
  const formatRelativeTime = useCallback((date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const minutes = Math.floor(diffMs / 60000)

    if (minutes < 1) return 'Agora mesmo'
    if (minutes < 60) return `${minutes}min atrás`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atrás`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d atrás`

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  // Get notification icon
  const getIcon = useCallback((type: string) => {
    const base = 'h-5 w-5'
    switch (type) {
      case 'success':
        return <CheckCircleIcon className={`${base} text-emerald-500`} />
      case 'error':
        return <XCircleIcon className={`${base} text-red-500`} />
      case 'warning':
        return <ExclamationTriangleIcon className={`${base} text-amber-500`} />
      case 'info':
      default:
        return <InformationCircleIcon className={`${base} text-brand-500`} />
    }
  }, [])

  const getIconBg = useCallback((type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 dark:bg-emerald-500/10'
      case 'error': return 'bg-red-50 dark:bg-red-500/10'
      case 'warning': return 'bg-amber-50 dark:bg-amber-500/10'
      case 'info':
      default: return 'bg-brand-50 dark:bg-brand-500/10'
    }
  }, [])

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60] sm:bg-transparent sm:backdrop-blur-none"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={containerRef}
        className={`fixed z-[61] bg-white dark:bg-neutral-800 shadow-2xl border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden ${className}
          inset-x-2 top-16 bottom-auto rounded-xl sm:inset-auto sm:top-16 sm:right-4 sm:w-[26rem] sm:max-h-[calc(100vh-5rem)] sm:rounded-xl
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Central de notificações"
        style={{ animation: 'fadeSlideDown 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
                <BellIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Notificações
                </h2>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  {unreadCount > 0
                    ? `${unreadCount} ${unreadCount === 1 ? 'não lida' : 'não lidas'}`
                    : 'Tudo em dia'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showFilters
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                    : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-700'
                }`}
                title="Filtros"
                aria-label="Mostrar filtros"
              >
                <FunnelIcon className="h-4 w-4" />
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-500/10 transition-colors"
                  title="Marcar todas como lidas"
                  aria-label="Marcar todas como lidas"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                aria-label="Fechar"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/50 space-y-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar notificações..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-600'
                }`}
              >
                Não lidas
              </button>
              {(searchQuery || filter !== 'all') && (
                <button
                  onClick={() => { setFilter('all'); setSearchQuery('') }}
                  className="text-xs px-3 py-1.5 rounded-md font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {/* Notifications list */}
        <div className="overflow-y-auto overscroll-contain max-h-[50vh] sm:max-h-[calc(100vh-16rem)]">
          {filteredNotifications.length === 0 ? (
            <div className="py-14 px-4 text-center">
              <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center mx-auto mb-4">
                <BellIcon className="h-7 w-7 text-neutral-400 dark:text-neutral-500" />
              </div>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {searchQuery ? 'Nenhum resultado encontrado' : 'Nenhuma notificação'}
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                {searchQuery
                  ? 'Tente outra busca'
                  : 'Quando houver novidades, elas aparecerão aqui.'
                }
              </p>
            </div>
          ) : (
            <div>
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative flex items-start gap-3 px-4 py-3.5 border-b border-neutral-50 dark:border-neutral-700/30 last:border-0 transition-colors ${
                    !notification.read
                      ? 'bg-brand-50/30 dark:bg-brand-500/5 hover:bg-brand-50/50 dark:hover:bg-brand-500/8'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/30'
                  }`}
                >
                  {/* Unread indicator */}
                  {!notification.read && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-500" />
                  )}

                  {/* Icon */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${getIconBg(notification.type)}`}>
                    {getIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${
                      !notification.read
                        ? 'font-semibold text-neutral-900 dark:text-neutral-100'
                        : 'font-medium text-neutral-700 dark:text-neutral-300'
                    }`}>
                      {notification.title}
                    </p>
                    <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">
                      <ClockIcon className="h-3 w-3" />
                      {formatRelativeTime(notification.timestamp)}
                    </span>

                    {/* Actions */}
                    {notification.actions && notification.actions.length > 0 && (
                      <div className="flex items-center gap-2 mt-2.5">
                        {notification.actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation()
                              action.action()
                              onRemove(notification.id)
                            }}
                            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
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

                  {/* Hover actions */}
                  <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <button
                        onClick={() => onMarkAsRead(notification.id)}
                        className="p-1 rounded-md text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-500/10 transition-colors"
                        title="Marcar como lida"
                        aria-label={`Marcar "${notification.title}" como lida`}
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(notification.id)}
                      className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Remover"
                      aria-label={`Remover "${notification.title}"`}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/80">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {filteredNotifications.length} de {notifications.length}
              </span>
              <button
                onClick={onClearAll}
                className="text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                Limpar todas
              </button>
            </div>
          </div>
        )}
      </div>

    </>,
    document.body
  )
})

// Hook for notification center
export function useNotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)

  return {
    isOpen,
    open: useCallback(() => setIsOpen(true), []),
    close: useCallback(() => setIsOpen(false), []),
    toggle: useCallback(() => setIsOpen(prev => !prev), [])
  }
}
