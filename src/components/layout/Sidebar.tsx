'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger'
import {
  HomeIcon,
  TicketIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  BellIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CpuChipIcon,
  UserIcon,
  PlusIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  TicketIcon as TicketIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid
} from '@heroicons/react/24/solid'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
  userRole: 'admin' | 'agent' | 'user'
}

interface MenuItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconSolid: React.ComponentType<{ className?: string }>
  badge?: number | string
  submenu?: SubMenuItem[]
}

interface SubMenuItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
}

export default function Sidebar({ open, setOpen, userRole }: SidebarProps) {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const [ticketCounts, setTicketCounts] = useState({
    total: 0,
    open: 0,
    assigned: 0
  })

  // Fetch ticket counts for badges
  useEffect(() => {
    fetchTicketCounts()
  }, [])

  const fetchTicketCounts = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      // This would typically be a summary endpoint
      const response = await fetch('/api/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTicketCounts({
          total: data.data?.overview?.tickets?.total || 0,
          open: data.data?.overview?.tickets?.open || 0,
          assigned: data.data?.my_assignments?.length || 0
        })
      }
    } catch (error) {
      logger.error('Error fetching ticket counts', error)
    }
  }

  const toggleSubmenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    )
  }

  // Keyboard navigation for submenu items
  const handleSubmenuKeyDown = (e: React.KeyboardEvent, menuName: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleSubmenu(menuName)
    } else if (e.key === 'Escape') {
      setExpandedMenus(prev => prev.filter(name => name !== menuName))
    }
  }

  // Menu items based on user role
  const getMenuItems = (): MenuItem[] => {
    const baseItems: MenuItem[] = [
      {
        name: 'Dashboard',
        href: userRole === 'admin' ? '/admin' : '/dashboard',
        icon: HomeIcon,
        iconSolid: HomeIconSolid
      }
    ]

    if (userRole === 'admin') {
      return [
        ...baseItems,
        {
          name: 'Tickets',
          href: '/admin/tickets',
          icon: TicketIcon,
          iconSolid: TicketIconSolid,
          badge: ticketCounts.total,
          submenu: [
            { name: 'Todos os Tickets', href: '/admin/tickets', icon: TicketIcon },
            { name: 'Novo Ticket', href: '/tickets/new', icon: PlusIcon },
            { name: 'Em Aberto', href: '/admin/tickets?status=open', icon: ClockIcon, badge: ticketCounts.open },
            { name: 'Busca Avançada', href: '/search', icon: MagnifyingGlassIcon }
          ]
        },
        {
          name: 'Usuários',
          href: '/admin/users',
          icon: UserGroupIcon,
          iconSolid: UserGroupIconSolid,
          submenu: [
            { name: 'Todos os Usuários', href: '/admin/users', icon: UserGroupIcon },
            { name: 'Novo Usuário', href: '/admin/users/new', icon: PlusIcon },
            { name: 'Agentes', href: '/admin/users?role=agent', icon: UserIcon },
            { name: 'Administradores', href: '/admin/users?role=admin', icon: ShieldCheckIcon }
          ]
        },
        {
          name: 'Relatórios',
          href: '/admin/reports',
          icon: ChartBarIcon,
          iconSolid: ChartBarIconSolid,
          submenu: [
            { name: 'Dashboard Executivo', href: '/admin/reports?type=executive', icon: ChartBarIcon },
            { name: 'Performance Agentes', href: '/admin/reports?type=agents', icon: UserIcon },
            { name: 'Relatórios SLA', href: '/admin/reports?type=sla', icon: ClockIcon },
            { name: 'Análise de Tendências', href: '/admin/reports?type=trends', icon: ChartBarIcon }
          ]
        },
        {
          name: 'Configurações',
          href: '/admin/settings',
          icon: Cog6ToothIcon,
          iconSolid: Cog6ToothIconSolid,
          submenu: [
            { name: 'Gerais', href: '/admin/settings', icon: Cog6ToothIcon },
            { name: 'SLA', href: '/admin/settings/sla', icon: ClockIcon },
            { name: 'Templates', href: '/admin/settings/templates', icon: DocumentTextIcon },
            { name: 'Automações', href: '/admin/settings/automations', icon: CpuChipIcon },
            { name: 'Auditoria', href: '/admin/settings/audit', icon: ShieldCheckIcon },
            { name: 'Cache', href: '/admin/settings/cache', icon: CpuChipIcon }
          ]
        }
      ]
    } else if (userRole === 'agent') {
      return [
        ...baseItems,
        {
          name: 'Meus Tickets',
          href: '/tickets',
          icon: TicketIcon,
          iconSolid: TicketIconSolid,
          badge: ticketCounts.assigned,
          submenu: [
            { name: 'Atribuídos a mim', href: '/tickets?assigned=me', icon: UserIcon, badge: ticketCounts.assigned },
            { name: 'Novo Ticket', href: '/tickets/new', icon: PlusIcon },
            { name: 'Todos os Tickets', href: '/tickets', icon: TicketIcon },
            { name: 'Buscar', href: '/search', icon: MagnifyingGlassIcon }
          ]
        },
        {
          name: 'Base Conhecimento',
          href: '/knowledge',
          icon: DocumentTextIcon,
          iconSolid: DocumentTextIcon
        },
        {
          name: 'Relatórios',
          href: '/reports',
          icon: ChartBarIcon,
          iconSolid: ChartBarIconSolid,
          submenu: [
            { name: 'Minha Performance', href: '/reports/my-performance', icon: UserIcon },
            { name: 'Tickets por Período', href: '/reports/tickets', icon: ChartBarIcon }
          ]
        }
      ]
    } else {
      return [
        ...baseItems,
        {
          name: 'Meus Tickets',
          href: '/tickets',
          icon: TicketIcon,
          iconSolid: TicketIconSolid,
          submenu: [
            { name: 'Meus Tickets', href: '/tickets', icon: UserIcon },
            { name: 'Novo Ticket', href: '/tickets/new', icon: PlusIcon },
            { name: 'Em Aberto', href: '/tickets?status=open', icon: ClockIcon },
            { name: 'Resolvidos', href: '/tickets?status=resolved', icon: TicketIcon }
          ]
        },
        {
          name: 'Base Conhecimento',
          href: '/knowledge',
          icon: DocumentTextIcon,
          iconSolid: DocumentTextIcon
        }
      ]
    }
  }

  const menuItems = getMenuItems()

  const isActive = (href: string) => {
    if (href === '/admin' && pathname === '/admin') return true
    if (href === '/dashboard' && pathname === '/dashboard') return true
    if (href !== '/admin' && href !== '/dashboard') {
      return pathname.startsWith(href)
    }
    return false
  }

  const hasActiveSubmenu = (submenu?: SubMenuItem[]) => {
    if (!submenu) return false
    return submenu.some(item => isActive(item.href))
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-6 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-brand rounded-lg flex items-center justify-center">
            <TicketIcon className="h-5 w-5 text-white" />
          </div>
          {open && (
            <span className="text-xl font-bold text-gradient">
              ServiceDesk
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 px-4 py-6 space-y-2 overflow-y-auto hide-scrollbar"
        role="navigation"
        aria-label="Menu principal"
      >
        {menuItems.map((item) => {
          const isItemActive = isActive(item.href)
          const hasActiveChild = hasActiveSubmenu(item.submenu)
          const isExpanded = expandedMenus.includes(item.name)
          const shouldExpand = isExpanded || hasActiveChild

          const IconComponent = isItemActive ? item.iconSolid : item.icon

          return (
            <div key={item.name}>
              {/* Main menu item */}
              <div
                className={`relative group ${
                  item.submenu ? 'cursor-pointer' : ''
                }`}
              >
                {item.submenu ? (
                  <button
                    onClick={() => toggleSubmenu(item.name)}
                    onKeyDown={(e) => handleSubmenuKeyDown(e, item.name)}
                    className={`sidebar-item w-full ${
                      isItemActive || hasActiveChild ? 'sidebar-item-active' : ''
                    }`}
                    aria-expanded={shouldExpand}
                    aria-controls={`submenu-${item.name}`}
                    aria-current={isItemActive ? 'page' : undefined}
                    aria-label={`${item.name}${item.badge ? `, ${item.badge} itens` : ''}`}
                  >
                    <IconComponent className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {open && (
                      <>
                        <span className="ml-3 flex-1 text-left">{item.name}</span>
                        {item.badge && (
                          <span className="ml-2 badge badge-primary text-xs" aria-label={`${item.badge} itens`}>
                            {item.badge}
                          </span>
                        )}
                        <svg
                          className={`ml-2 h-4 w-4 transition-transform duration-200 ${
                            shouldExpand ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={`sidebar-item ${isItemActive ? 'sidebar-item-active' : ''}`}
                    aria-current={isItemActive ? 'page' : undefined}
                    aria-label={`${item.name}${item.badge ? `, ${item.badge} itens` : ''}`}
                  >
                    <IconComponent className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {open && (
                      <>
                        <span className="ml-3">{item.name}</span>
                        {item.badge && (
                          <span className="ml-auto badge badge-primary text-xs" aria-label={`${item.badge} itens`}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                )}

                {/* Tooltip for collapsed sidebar */}
                {!open && (
                  <div
                    className="absolute left-full ml-2 px-2 py-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap"
                    role="tooltip"
                  >
                    {item.name}
                    {item.badge && (
                      <span className="ml-2 bg-brand-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submenu */}
              {item.submenu && open && shouldExpand && (
                <div
                  id={`submenu-${item.name}`}
                  className="ml-4 mt-2 space-y-1 animate-slide-down"
                  role="group"
                  aria-label={`${item.name} submenu`}
                >
                  {item.submenu.map((subItem) => {
                    const isSubItemActive = isActive(subItem.href)
                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={`flex items-center px-4 py-2 text-sm rounded-lg transition-colors duration-150 ${
                          isSubItemActive
                            ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
                        }`}
                        aria-current={isSubItemActive ? 'page' : undefined}
                        aria-label={`${subItem.name}${subItem.badge ? `, ${subItem.badge} itens` : ''}`}
                      >
                        <subItem.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span className="ml-3 flex-1">{subItem.name}</span>
                        {subItem.badge && (
                          <span className="ml-2 badge badge-primary text-xs" aria-label={`${subItem.badge} itens`}>
                            {subItem.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User info at bottom */}
      {open && (
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
            ServiceDesk Pro v2.0
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="main-sidebar"
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 transform transition-all duration-300 ease-in-out ${
          open
            ? 'w-64 translate-x-0'
            : 'w-20 -translate-x-full lg:translate-x-0'
        }`}
        aria-label="Barra lateral de navegação"
        aria-hidden={!open && typeof window !== 'undefined' && window.innerWidth < 1024}
      >
        <SidebarContent />
      </aside>

      {/* Spacer for desktop */}
      <div
        className={`hidden lg:block transition-all duration-300 ease-in-out ${
          open ? 'w-64' : 'w-20'
        }`}
      />
    </>
  )
}