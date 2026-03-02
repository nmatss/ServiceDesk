'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  BellIcon,
  CheckIcon,
  TrashIcon,
  EyeIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid'
import { useNotifications } from './NotificationProvider'

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll
  } = useNotifications()

  const [isOpen, setIsOpen] = useState(false)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const formatTime = useCallback((timestamp: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - timestamp.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'Agora'
    if (diffMin < 60) return `${diffMin}min`

    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h`

    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD}d`

    return timestamp.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short'
    })
  }, [])

  const getIcon = useCallback((type: string) => {
    const base = 'h-5 w-5 flex-shrink-0'
    switch (type) {
      case 'success':
        return <CheckCircleIcon className={`${base} text-emerald-500`} />
      case 'error':
        return <XCircleIcon className={`${base} text-red-500`} />
      case 'warning':
        return <ExclamationTriangleIcon className={`${base} text-amber-500`} />
      case 'info':
      default:
        return <InformationCircleIcon className={`${base} text-blue-500`} />
    }
  }, [])

  const getIconBg = useCallback((type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 dark:bg-emerald-500/10'
      case 'error': return 'bg-red-50 dark:bg-red-500/10'
      case 'warning': return 'bg-amber-50 dark:bg-amber-500/10'
      case 'info':
      default: return 'bg-blue-50 dark:bg-blue-500/10'
    }
  }, [])

  const handleRemove = useCallback((id: string) => {
    setExitingIds(prev => new Set(prev).add(id))
    setTimeout(() => {
      removeNotification(id)
      setExitingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 200)
  }, [removeNotification])

  const handleNotificationClick = useCallback((notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    if (notification.actions?.length > 0) {
      notification.actions[0].action()
    }
    setIsOpen(false)
  }, [markAsRead])

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all duration-200 ${
          isOpen
            ? 'bg-neutral-100 dark:bg-neutral-700/50'
            : unreadCount > 0
              ? 'text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10'
              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
        }`}
        aria-label={unreadCount > 0 ? `Notificações: ${unreadCount} não lidas` : 'Notificações'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="notification-panel"
      >
        {unreadCount > 0 ? (
          <BellIconSolid className="h-5 w-5 sm:h-6 sm:w-6" />
        ) : (
          <BellIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        )}

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-neutral-900 tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          id="notification-panel"
          className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200/80 dark:border-neutral-700/80 z-50 overflow-hidden"
          role="region"
          aria-label="Painel de notificações"
          style={{
            animation: 'fadeSlideDown 0.2s ease-out',
            maxWidth: '24rem',
            right: '0'
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Notificações
                </h3>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-500/10 transition-colors"
                    title="Marcar todas como lidas"
                    aria-label="Marcar todas como lidas"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => {
                      clearAll()
                      setIsOpen(false)
                    }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Limpar todas"
                    aria-label="Limpar todas as notificações"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-700 transition-colors sm:hidden"
                  aria-label="Fechar notificações"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          <div
            className="max-h-[60vh] sm:max-h-96 overflow-y-auto overscroll-contain"
            role="list"
            aria-label="Lista de notificações"
          >
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center mx-auto mb-3">
                  <BellIcon className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
                </div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  Nenhuma notificação
                </p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  Você está em dia!
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-200 border-b border-neutral-50 dark:border-neutral-700/30 last:border-0 ${
                    exitingIds.has(notification.id)
                      ? 'opacity-0 -translate-x-4'
                      : ''
                  } ${
                    !notification.read
                      ? 'bg-brand-50/40 dark:bg-brand-500/5 hover:bg-brand-50/60 dark:hover:bg-brand-500/10'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/30'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  role="listitem"
                  aria-label={`${notification.title}: ${notification.message}. ${formatTime(notification.timestamp)}`}
                >
                  {/* Unread indicator */}
                  {!notification.read && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-500" />
                  )}

                  {/* Icon */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${getIconBg(notification.type)}`}>
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
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500">
                        <ClockIcon className="h-3 w-3" />
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>

                    {/* Actions */}
                    {notification.actions && notification.actions.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {notification.actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation()
                              action.action()
                              removeNotification(notification.id)
                              setIsOpen(false)
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

                  {/* Hover actions */}
                  <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notification.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notification.id)
                        }}
                        className="p-1 rounded-md text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-500/10 transition-colors"
                        title="Marcar como lida"
                        aria-label={`Marcar "${notification.title}" como lida`}
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(notification.id)
                      }}
                      className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Remover"
                      aria-label={`Remover "${notification.title}"`}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 3 && (
            <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/80">
              <p className="text-xs text-center text-neutral-400 dark:text-neutral-500">
                {notifications.length} {notifications.length === 1 ? 'notificação' : 'notificações'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {unreadCount > 0
          ? `${unreadCount} ${unreadCount === 1 ? 'nova notificação' : 'novas notificações'}`
          : 'Nenhuma notificação nova'
        }
      </div>
    </div>
  )
}
