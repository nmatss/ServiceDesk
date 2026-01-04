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
import GlobalSearchWithAutocomplete from '@/src/components/search/GlobalSearchWithAutocomplete'
import Tooltip from '@/components/ui/Tooltip'

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

  const handleLogout = async () => {
    try {
      // Call logout API to clear server-side cookies
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      // Continue with redirect even if API call fails
      console.error('Logout API error:', error)
    }
    router.push('/auth/login')
  }

  // Keyboard navigation for user menu
  const handleUserMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowUserMenu(false)
    }
  }

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const userMenu = document.getElementById('user-menu-dropdown')
      const userMenuButton = document.querySelector('[aria-controls="user-menu-dropdown"]')

      if (showUserMenu && userMenu && userMenuButton &&
        !userMenu.contains(event.target as Node) &&
        !userMenuButton.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])


  return (
    <>
      <header
        className="sticky top-0 z-40 glass border-b border-white/10 safe-top"
        role="banner"
      >
        <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-6 lg:px-8">
          {/* Left section */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Mobile sidebar toggle */}
            <Tooltip content={sidebarOpen ? "Fechar menu" : "Abrir menu"} placement="bottom">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="btn btn-ghost p-2 min-h-touch min-w-touch lg:hidden transition-all duration-200 active:scale-95"
                aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
                aria-expanded={sidebarOpen}
                aria-controls="main-sidebar"
              >
                {sidebarOpen ? (
                  <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-200" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-200" aria-hidden="true" />
                )}
              </button>
            </Tooltip>

            {/* Desktop sidebar toggle */}
            <Tooltip content={sidebarOpen ? "Recolher menu" : "Expandir menu"} placement="bottom">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`
                  btn btn-ghost p-2 min-h-touch min-w-touch hidden lg:block transition-all duration-200 active:scale-95
                  ${sidebarOpen ? 'rotate-0' : 'rotate-180'}
                `}
                aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
                aria-expanded={sidebarOpen}
                aria-controls="main-sidebar"
              >
                <Bars3Icon className="h-5 w-5 transition-transform duration-300" aria-hidden="true" />
              </button>
            </Tooltip>

            {/* Search toggle for mobile */}
            <Tooltip content="Buscar" placement="bottom">
              <button
                onClick={() => setShowSearch(true)}
                className="btn btn-ghost p-2 min-h-touch min-w-touch sm:hidden transition-all duration-200 active:scale-95"
                aria-label="Abrir busca"
              >
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </Tooltip>

            {/* Search bar for desktop with autocomplete */}
            <div className="hidden sm:block">
              <GlobalSearchWithAutocomplete
                placeholder="Buscar tickets, artigos, usuários..."
                className=""
              />
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-2" role="group" aria-label="Ações do usuário">
            {/* Theme toggle */}
            <AdvancedThemeToggle />

            {/* Notifications */}
            <NotificationBell />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 btn btn-ghost p-2 min-h-touch"
                aria-label={`Menu do usuário ${user?.name || 'Usuário'}`}
                aria-expanded={showUserMenu}
                aria-controls="user-menu-dropdown"
                aria-haspopup="true"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-brand-500 rounded-full flex items-center justify-center" aria-hidden="true">
                  <span className="text-white text-sm sm:text-base font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="hidden md:block text-sm font-medium text-neutral-700 dark:text-neutral-300 max-w-[120px] truncate">
                  {user?.name || 'Usuário'}
                </span>
              </button>

              {/* User dropdown */}
              {showUserMenu && (
                <div
                  id="user-menu-dropdown"
                  className="absolute right-0 mt-2 w-64 sm:w-72 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-large z-50"
                  role="menu"
                  aria-label="Menu do usuário"
                  onKeyDown={handleUserMenuKeyDown}
                >
                  <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {user?.name}
                    </p>
                    <p className="text-xs text-description">
                      {user?.email}
                    </p>
                    <span className={`inline-flex mt-2 badge ${user?.role === 'admin' ? 'badge-error' :
                        user?.role === 'agent' ? 'badge-warning' :
                          'badge-neutral'
                      }`}>
                      {user?.role === 'admin' ? 'Administrador' :
                        user?.role === 'agent' ? 'Agente' :
                          'Usuário'}
                    </span>
                  </div>

                  <div className="py-2" role="group">
                    <button
                      onClick={() => {
                        router.push('/profile')
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-3 text-sm min-h-touch text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      role="menuitem"
                      aria-label="Ir para meu perfil"
                    >
                      <UserIcon className="h-5 w-5 mr-3" aria-hidden="true" />
                      Meu Perfil
                    </button>

                    <button
                      onClick={() => {
                        router.push('/settings')
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-3 text-sm min-h-touch text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      role="menuitem"
                      aria-label="Ir para configurações"
                    >
                      <Cog6ToothIcon className="h-5 w-5 mr-3" aria-hidden="true" />
                      Configurações
                    </button>

                    <div className="border-t border-neutral-200 dark:border-neutral-700 my-2" role="separator"></div>

                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-3 text-sm min-h-touch text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                      role="menuitem"
                      aria-label="Sair da conta"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5 mr-3" aria-hidden="true" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile search overlay with autocomplete */}
      {showSearch && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Busca móvel"
        >
          <div className="bg-white dark:bg-neutral-900 p-4">
            <GlobalSearchWithAutocomplete
              placeholder="Buscar tickets, artigos, usuários..."
              isMobile={true}
              onClose={() => setShowSearch(false)}
              autoFocus={true}
            />
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
          role="presentation"
          aria-hidden="true"
        />
      )}
    </>
  )
}