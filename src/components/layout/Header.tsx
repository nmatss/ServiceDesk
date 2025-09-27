'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  MagnifyingGlassIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import AdvancedThemeToggle from '@/src/components/theme/AdvancedThemeToggle'
import NotificationBell from '@/src/components/notifications/NotificationBell'

interface HeaderProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  user?: {
    id: number
    name: string
    email: string
    role: 'admin' | 'agent' | 'user'
  }
}

export default function Header({ sidebarOpen, setSidebarOpen, user }: HeaderProps) {
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
      setShowSearch(false)
      setSearchQuery('')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_name')
    router.push('/auth/login')
  }


  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          {/* Left section */}
          <div className="flex items-center space-x-4">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn btn-ghost p-2 lg:hidden"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>

            {/* Desktop sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn btn-ghost p-2 hidden lg:block"
              aria-label="Toggle sidebar"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>

            {/* Search toggle for mobile */}
            <button
              onClick={() => setShowSearch(true)}
              className="btn btn-ghost p-2 sm:hidden"
              aria-label="Search"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>

            {/* Search bar for desktop */}
            <form onSubmit={handleSearch} className="hidden sm:block">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar tickets, usuários..."
                  className="input pl-10 pr-4 w-64 lg:w-80"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-2">
            {/* Theme toggle */}
            <AdvancedThemeToggle />

            {/* Notifications */}
            <NotificationBell />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 btn btn-ghost p-2"
                aria-label="User menu"
              >
                <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="hidden md:block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {user?.name || 'Usuário'}
                </span>
              </button>

              {/* User dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-large z-50">
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {user?.name}
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {user?.email}
                    </p>
                    <span className={`inline-flex mt-2 badge ${
                      user?.role === 'admin' ? 'badge-error' :
                      user?.role === 'agent' ? 'badge-warning' :
                      'badge-neutral'
                    }`}>
                      {user?.role === 'admin' ? 'Administrador' :
                       user?.role === 'agent' ? 'Agente' :
                       'Usuário'}
                    </span>
                  </div>

                  <div className="py-2">
                    <button
                      onClick={() => {
                        router.push('/profile')
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <UserIcon className="h-4 w-4 mr-3" />
                      Meu Perfil
                    </button>

                    <button
                      onClick={() => {
                        router.push('/settings')
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-3" />
                      Configurações
                    </button>

                    <div className="border-t border-neutral-200 dark:border-neutral-700 my-2"></div>

                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile search overlay */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm sm:hidden">
          <div className="bg-white dark:bg-neutral-900 p-4">
            <form onSubmit={handleSearch} className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar tickets, usuários..."
                  className="input pl-10 pr-4 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                className="btn btn-ghost p-2"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Overlay for dropdowns */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowUserMenu(false)
          }}
        />
      )}
    </>
  )
}