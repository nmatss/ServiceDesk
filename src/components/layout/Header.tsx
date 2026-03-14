'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  MagnifyingGlassIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronRightIcon,
  HomeIcon
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
    role: 'super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user'
  }
}

// Route segment to Portuguese label mapping
const segmentLabels: Record<string, string> = {
  admin: 'Administração',
  super: 'Super Admin',
  tickets: 'Tickets',
  problems: 'Problemas',
  changes: 'Mudanças',
  cmdb: 'CMDB',
  cab: 'CAB',
  catalog: 'Catálogo',
  users: 'Usuários',
  teams: 'Equipes',
  reports: 'Relatórios',
  governance: 'Governança',
  knowledge: 'Base de Conhecimento',
  settings: 'Configurações',
  dashboard: 'Dashboard',
  profile: 'Perfil',
  search: 'Busca',
  portal: 'Portal',
  workflows: 'Workflows',
  notifications: 'Notificações',
  organizations: 'Organizações',
  audit: 'Auditoria',
  new: 'Novo',
  edit: 'Editar',
  kedb: 'KEDB',
  calendar: 'Calendário',
  itil: 'ITIL',
  sla: 'SLA',
  templates: 'Templates',
  automations: 'Automações',
  workspace: 'Workspace',
  agent: 'Agente',
  create: 'Criar'
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  tenant_admin: 'Admin Tenant',
  team_manager: 'Gerente de Equipe',
  agent: 'Agente',
  user: 'Usuário'
}

const roleBadgeColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  tenant_admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  team_manager: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  agent: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  user: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
}

export default function Header({ sidebarOpen, setSidebarOpen, user }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Build breadcrumbs from current path
  const breadcrumbs = useMemo(() => {
    if (!pathname || pathname === '/' || pathname === '/admin' || pathname === '/dashboard') return []

    const segments = pathname.split('/').filter(Boolean)
    const crumbs: { label: string; href: string }[] = []

    // Skip building breadcrumbs if we're at a root-level page
    if (segments.length <= 1) return []

    let currentPath = ''
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      currentPath += `/${segment}`

      // Skip numeric IDs in breadcrumb labels — show as "Detalhes" instead
      const isId = /^\d+$/.test(segment)
      const label = isId ? 'Detalhes' : (segmentLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1))

      // Don't add 'admin' as a separate breadcrumb if the next segment exists
      if (segment === 'admin' && i < segments.length - 1) continue

      crumbs.push({ label, href: currentPath })
    }

    // Only show the last 3 crumbs to keep it clean
    return crumbs.slice(-3)
  }, [pathname])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch {
      // Continue with redirect even if API call fails
    }
    router.push('/auth/login')
  }

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
        className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-700 safe-top shadow-sm"
        role="banner"
      >
        <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6 lg:px-8">
          {/* Left section */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            {/* Mobile sidebar toggle */}
            <Tooltip content={sidebarOpen ? "Fechar menu" : "Abrir menu"} placement="bottom">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="inline-flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-all duration-200 active:scale-95 lg:hidden"
                aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
                aria-expanded={sidebarOpen}
                aria-controls="main-sidebar"
              >
                {sidebarOpen ? (
                  <XMarkIcon className="h-5 w-5 transition-transform duration-200" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="h-5 w-5 transition-transform duration-200" aria-hidden="true" />
                )}
              </button>
            </Tooltip>

            {/* Desktop sidebar toggle */}
            <Tooltip content={sidebarOpen ? "Recolher menu" : "Expandir menu"} placement="bottom">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:inline-flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition-all duration-200 active:scale-95"
                aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
                aria-expanded={sidebarOpen}
                aria-controls="main-sidebar"
              >
                <Bars3Icon className="h-5 w-5 transition-transform duration-300" aria-hidden="true" />
              </button>
            </Tooltip>

            {/* Breadcrumbs — desktop only */}
            {breadcrumbs.length > 0 && (
              <nav className="hidden md:flex items-center space-x-1 text-sm min-w-0" aria-label="Breadcrumb">
                <Link
                  href={user?.role && ['super_admin', 'admin', 'tenant_admin', 'team_manager'].includes(user.role) ? '/admin' : '/dashboard'}
                  className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors duration-200 flex-shrink-0"
                  aria-label="Ir para a página inicial"
                >
                  <HomeIcon className="h-4 w-4" />
                </Link>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    <ChevronRightIcon className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600 flex-shrink-0" aria-hidden="true" />
                    {index === breadcrumbs.length - 1 ? (
                      <span className="text-neutral-700 dark:text-neutral-200 font-medium truncate max-w-[160px]" aria-current="page">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors duration-200 truncate max-w-[120px]"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            )}

            {/* Search toggle for mobile */}
            <Tooltip content="Buscar" placement="bottom">
              <button
                onClick={() => setShowSearch(true)}
                className="inline-flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200 active:scale-95 sm:hidden"
                aria-label="Abrir busca"
              >
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>

          {/* Center section — Search bar (desktop) */}
          <div className="hidden sm:flex flex-1 justify-center max-w-xl mx-4">
            <GlobalSearchWithAutocomplete
              placeholder="Buscar tickets, artigos, usuários..."
              className=""
            />
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-1 sm:space-x-2" role="group" aria-label="Ações do usuário">
            {/* Theme toggle */}
            <AdvancedThemeToggle />

            {/* Notifications */}
            <NotificationBell />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-1.5 sm:p-2 min-h-[44px] rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all duration-200"
                aria-label={`Menu do usuário ${user?.name || 'Usuário'}`}
                aria-expanded={showUserMenu}
                aria-controls="user-menu-dropdown"
                aria-haspopup="true"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-brand rounded-full flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-neutral-800" aria-hidden="true">
                  <span className="text-white text-sm font-semibold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 max-w-[120px] lg:max-w-[160px] truncate leading-tight">
                    {user?.name || 'Usuário'}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-tight">
                    {roleLabels[user?.role || 'user']}
                  </span>
                </div>
              </button>

              {/* User dropdown */}
              {showUserMenu && (
                <div
                  id="user-menu-dropdown"
                  className="absolute right-0 mt-2 w-64 sm:w-72 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden"
                  role="menu"
                  aria-label="Menu do usuário"
                  onKeyDown={handleUserMenuKeyDown}
                >
                  {/* User info header */}
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-brand rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                        <span className="text-white text-base font-semibold">
                          {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {user?.name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center mt-2.5 px-2 py-0.5 text-[10px] font-semibold rounded-full ${roleBadgeColors[user?.role || 'user']}`}>
                      {roleLabels[user?.role || 'user']}
                    </span>
                  </div>

                  {/* Menu items */}
                  <div className="py-1" role="group">
                    <button
                      onClick={() => {
                        router.push('/profile')
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-2.5 text-sm min-h-[44px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-200"
                      role="menuitem"
                      aria-label="Ir para meu perfil"
                    >
                      <UserIcon className="h-4 w-4 mr-3 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                      Meu Perfil
                    </button>

                    <button
                      onClick={() => {
                        router.push('/settings')
                        setShowUserMenu(false)
                      }}
                      className="flex items-center w-full px-4 py-2.5 text-sm min-h-[44px] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors duration-200"
                      role="menuitem"
                      aria-label="Ir para configurações"
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-3 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                      Configurações
                    </button>

                    <div className="mx-3 my-1 border-t border-neutral-100 dark:border-neutral-700" role="separator" />

                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2.5 text-sm min-h-[44px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                      role="menuitem"
                      aria-label="Sair da conta"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" aria-hidden="true" />
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
          onClick={() => setShowSearch(false)}
        >
          <div
            className="bg-white dark:bg-neutral-900 p-4 safe-top shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
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
