'use client'

import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { BellIcon } from '@heroicons/react/24/outline'
import { useNotifications } from './NotificationProvider'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isConnected } = useNotifications()

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'agora mesmo'
    if (minutes < 60) return `${minutes}m atrás`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h atrás`

    const days = Math.floor(hours / 24)
    return `${days}d atrás`
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ticket_created':
        return '🎫'
      case 'ticket_assigned':
        return '👤'
      case 'ticket_updated':
        return '📝'
      case 'ticket_resolved':
        return '✅'
      case 'comment_added':
        return '💬'
      case 'sla_warning':
        return '⚠️'
      case 'sla_breach':
        return '🔴'
      case 'system_alert':
        return '⚙️'
      case 'ticket_escalated':
        return '⬆️'
      case 'system':
        return '⚙️'
      default:
        return '📢'
    }
  }

  const getNotificationLink = (notification: any): string => {
    if (notification.ticket_id || notification.data?.ticketId) {
      const ticketId = notification.ticket_id || notification.data?.ticketId
      return `/admin/tickets?id=${ticketId}`
    }

    switch (notification.type) {
      case 'sla_warning':
      case 'sla_breach':
        return '/admin/sla'
      case 'system_alert':
        return '/admin/settings'
      default:
        return '/admin/dashboard/itil'
    }
  }

  return (
    <Menu as="div" className="relative">
      {({ open }: { open: boolean }) => (
        <>
        <Menu.Button
          className="btn btn-ghost btn-circle relative text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ''}`}
          aria-expanded={open}
          aria-haspopup="true"
        >
        <span className="sr-only">Ver notificações</span>
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="badge badge-error badge-sm absolute -top-1 -right-1"
            aria-label={`${unreadCount} notificações não lidas`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {isConnected && (
          <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-success-500" aria-label="Conectado"></span>
        )}
        </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items
          className="glass-panel absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-lg py-1 shadow-lg ring-1 ring-neutral-200 dark:ring-neutral-700 ring-opacity-5 focus:outline-none"
        >
          <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-white" id="notifications-heading">Notificações</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="btn btn-xs btn-ghost text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  aria-label="Marcar todas as notificações como lidas"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto" role="list" aria-labelledby="notifications-heading" aria-live="polite" aria-atomic="false">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-content" role="status">
                Nenhuma notificação
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <Menu.Item key={notification.id}>
                  {({ active }) => (
                    <a
                      href={getNotificationLink(notification)}
                      className={classNames(
                        active ? 'bg-neutral-50 dark:bg-neutral-800/50' : '',
                        'block px-4 py-3 cursor-pointer border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors'
                      )}
                      onClick={() => !notification.is_read && markAsRead(notification.id)}
                      role="listitem"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          !notification.is_read && markAsRead(notification.id)
                        }
                      }}
                      aria-label={`${notification.title || notification.message}${!notification.is_read ? '. Não lida' : '. Lida'}. ${formatTimestamp(notification.timestamp)}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <span className="text-lg" aria-hidden="true">
                            {getNotificationIcon(notification.type)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={classNames(
                              'text-sm',
                              notification.is_read ? 'text-description' : 'text-neutral-900 dark:text-white font-medium'
                            )}>
                              {notification.title || notification.message}
                            </p>
                            {!notification.is_read && (
                              <div className="h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" aria-label="Não lida"></div>
                            )}
                          </div>
                          {notification.title && (
                            <p className="text-xs text-muted-content mt-1">
                              {notification.message}
                            </p>
                          )}
                          <p className="text-xs text-icon-muted mt-1">
                            <time dateTime={notification.timestamp}>
                              {formatTimestamp(notification.timestamp)}
                            </time>
                          </p>
                        </div>
                      </div>
                    </a>
                  )}
                </Menu.Item>
              ))
            )}
          </div>

          {notifications.length > 10 && (
            <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-700">
              <button
                className="btn btn-xs btn-ghost w-full text-brand-600 hover:text-brand-700 dark:text-brand-400"
                aria-label={`Ver todas as ${notifications.length} notificações`}
              >
                Ver todas as notificações
              </button>
            </div>
          )}
        </Menu.Items>
      </Transition>
      </>
      )}
    </Menu>
  )
}