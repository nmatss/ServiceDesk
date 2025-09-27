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
      case 'ticket_updated':
        return '📝'
      case 'comment_added':
        return '💬'
      case 'system':
        return '⚙️'
      default:
        return '📢'
    }
  }

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        <span className="sr-only">Ver notificações</span>
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {isConnected && (
          <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-green-500"></span>
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
        <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="px-4 py-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Notificações</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-500"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Nenhuma notificação
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <Menu.Item key={notification.id}>
                  {({ active }) => (
                    <div
                      className={classNames(
                        active ? 'bg-gray-50' : '',
                        'px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0'
                      )}
                      onClick={() => !notification.is_read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <span className="text-lg">
                            {getNotificationIcon(notification.type)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={classNames(
                              'text-sm',
                              notification.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'
                            )}>
                              {notification.title || notification.message}
                            </p>
                            {!notification.is_read && (
                              <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                            )}
                          </div>
                          {notification.title && (
                            <p className="text-xs text-gray-500 mt-1">
                              {notification.message}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </Menu.Item>
              ))
            )}
          </div>

          {notifications.length > 10 && (
            <div className="px-4 py-2 border-t border-gray-200">
              <button className="text-xs text-blue-600 hover:text-blue-500 w-full text-center">
                Ver todas as notificações
              </button>
            </div>
          )}
        </Menu.Items>
      </Transition>
    </Menu>
  )
}