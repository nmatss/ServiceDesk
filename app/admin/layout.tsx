'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { logger } from '@/lib/monitoring/logger';
import {
  HomeIcon,
  UsersIcon,
  TicketIcon,
  ChartBarIcon,
  CogIcon,
  UserGroupIcon,
  BookOpenIcon,
  ClockIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { Toaster } from 'react-hot-toast'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon },
  { name: 'Tickets', href: '/admin/tickets', icon: TicketIcon, badge: 5 },
  { name: 'Usuários', href: '/admin/users', icon: UsersIcon },
  { name: 'Equipes', href: '/admin/teams', icon: UserGroupIcon },
  { name: 'Relatórios', href: '/admin/reports', icon: ChartBarIcon },
  { name: 'Base de Conhecimento', href: '/admin/knowledge', icon: BookOpenIcon },
  { name: 'SLA', href: '/admin/sla', icon: ClockIcon },
  { name: 'Configurações', href: '/admin/settings', icon: CogIcon },
]

interface User {
  name: string
  email: string
  role: string
  avatar?: string
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    // Mock user data - replace with actual user context
    setUser({
      name: 'Admin User',
      email: 'admin@servicedesk.com',
      role: 'Administrador'
    })
  }, [])

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  const handleLogout = () => {
    // Implement logout logic
    logger.info('Logout')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${
          sidebarOpen ? 'block' : 'hidden'
        }`}
      >
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-75"
          onClick={() => setSidebarOpen(false)}
        />

        {/* Mobile sidebar */}
        <div className="relative flex w-full max-w-xs flex-col bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>

          <div className="flex grow flex-col overflow-y-auto bg-white px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center">
              <h1 className="text-xl font-bold text-gray-900">ServiceDesk Pro</h1>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors ${
                            isActive(item.href)
                              ? 'bg-blue-50 text-blue-600'
                              : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <item.icon className="h-6 w-6 shrink-0" />
                          <span className="flex-1">{item.name}</span>
                          {item.badge && (
                            <span className="ml-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-800">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-gray-900">ServiceDesk Pro</h1>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors ${
                          isActive(item.href)
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                        }`}
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                          <span className="ml-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-800">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-900/10 lg:hidden" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            {/* Search */}
            <form className="relative flex flex-1" action="#" method="GET">
              <label htmlFor="search-field" className="sr-only">
                Buscar
              </label>
              <MagnifyingGlassIcon className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" />
              <input
                id="search-field"
                className="block h-full w-full border-0 py-0 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                placeholder="Buscar tickets, usuários..."
                type="search"
                name="search"
              />
            </form>

            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Notifications */}
              <button
                type="button"
                className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
              >
                <BellIcon className="h-6 w-6" />
                <span className="absolute -mt-5 ml-2 inline-flex h-2 w-2 rounded-full bg-red-400"></span>
              </button>

              {/* Separator */}
              <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10" />

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  type="button"
                  className="-m-1.5 flex items-center p-1.5 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <span className="sr-only">Abrir menu do usuário</span>
                  {user?.avatar ? (
                    <img
                      className="h-8 w-8 rounded-full"
                      src={user.avatar}
                      alt=""
                    />
                  ) : (
                    <UserCircleIcon className="h-8 w-8 text-gray-400" />
                  )}
                  <span className="hidden lg:flex lg:items-center">
                    <span className="ml-4 text-sm font-semibold leading-6 text-gray-900">
                      {user?.name}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}