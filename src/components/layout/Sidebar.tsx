'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  TicketIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ClockIcon,
  CpuChipIcon,
  UserIcon,
  PlusIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  RectangleGroupIcon,
  ClipboardDocumentListIcon,
  PresentationChartLineIcon,
  WrenchScrewdriverIcon,
  ChevronDownIcon,
  BuildingOffice2Icon,
  GlobeAltIcon
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
  userRole: 'super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user'
  organizationId?: number
  userName?: string
  userEmail?: string
}

interface MenuItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconSolid: React.ComponentType<{ className?: string }>
  badge?: number | string
  submenu?: SubMenuItem[]
  section?: string
}

interface SubMenuItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number | string
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  tenant_admin: 'Admin Tenant',
  team_manager: 'Gerente',
  agent: 'Agente',
  user: 'Usuário'
}

const roleBadgeColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  tenant_admin: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  team_manager: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  agent: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  user: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
}

export default function Sidebar({ open, setOpen, userRole, organizationId = 0, userName, userEmail }: SidebarProps) {
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

  // Auto-expand the submenu containing the active page
  useEffect(() => {
    const items = getMenuItems()
    for (const item of items) {
      if (item.submenu) {
        const hasActive = item.submenu.some(sub => {
          if (sub.href === '/admin' && pathname === '/admin') return true
          if (sub.href !== '/admin') return pathname.startsWith(sub.href.split('?')[0])
          return false
        })
        if (hasActive && !expandedMenus.includes(item.name)) {
          setExpandedMenus(prev => [...prev, item.name])
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const fetchTicketCounts = async () => {
    try {
      const response = await fetch('/api/dashboard', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        const overview = data?.data?.overview ?? {}
        const tickets = overview.tickets ?? {}
        setTicketCounts({
          total: tickets.total ?? 0,
          open: tickets.open ?? 0,
          assigned: data?.data?.my_assignments?.length ?? 0
        })
      }
    } catch {
      // Silently fail — sidebar counts are non-critical
    }
  }

  const toggleSubmenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    )
  }

  const handleSubmenuKeyDown = (e: React.KeyboardEvent, menuName: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleSubmenu(menuName)
    } else if (e.key === 'Escape') {
      setExpandedMenus(prev => prev.filter(name => name !== menuName))
    }
  }

  // Menu items based on user role — with section markers for dividers
  const getMenuItems = (): MenuItem[] => {
    const baseItems: MenuItem[] = [
      {
        name: 'Dashboard',
        href: ['super_admin', 'admin', 'tenant_admin', 'team_manager'].includes(userRole) ? '/admin' : '/dashboard',
        icon: HomeIcon,
        iconSolid: HomeIconSolid,
        section: 'principal'
      }
    ]

    if (['super_admin', 'admin', 'tenant_admin', 'team_manager'].includes(userRole)) {
      return [
        ...baseItems,
        {
          name: 'Tickets',
          href: '/admin/tickets',
          icon: TicketIcon,
          iconSolid: TicketIconSolid,
          badge: ticketCounts.total,
          section: 'operacional',
          submenu: [
            { name: 'Todos os Tickets', href: '/admin/tickets', icon: TicketIcon },
            { name: 'Novo Ticket', href: '/tickets/new', icon: PlusIcon },
            { name: 'Em Aberto', href: '/admin/tickets?status=open', icon: ClockIcon, badge: ticketCounts.open },
            { name: 'Busca Avançada', href: '/search', icon: MagnifyingGlassIcon }
          ]
        },
        {
          name: 'Problemas',
          href: '/admin/problems',
          icon: ExclamationTriangleIcon,
          iconSolid: ExclamationTriangleIcon,
          section: 'itil',
          submenu: [
            { name: 'Todos os Problemas', href: '/admin/problems', icon: ExclamationTriangleIcon },
            { name: 'KEDB', href: '/admin/problems/kedb', icon: BookOpenIcon },
            { name: 'Novo Problema', href: '/admin/problems/new', icon: PlusIcon }
          ]
        },
        {
          name: 'Mudanças',
          href: '/admin/changes',
          icon: ArrowPathIcon,
          iconSolid: ArrowPathIcon,
          submenu: [
            { name: 'Todas as RFCs', href: '/admin/changes', icon: ArrowPathIcon },
            { name: 'CAB', href: '/admin/cab', icon: UserGroupIcon },
            { name: 'Calendário', href: '/admin/changes/calendar', icon: CalendarDaysIcon },
            { name: 'Nova RFC', href: '/admin/changes/new', icon: PlusIcon }
          ]
        },
        {
          name: 'CMDB',
          href: '/admin/cmdb',
          icon: ServerStackIcon,
          iconSolid: ServerStackIcon,
          submenu: [
            { name: 'Itens de Configuração', href: '/admin/cmdb', icon: ServerStackIcon },
            { name: 'Novo CI', href: '/admin/cmdb/new', icon: PlusIcon }
          ]
        },
        {
          name: 'Catálogo',
          href: '/portal/catalog',
          icon: RectangleGroupIcon,
          iconSolid: RectangleGroupIcon
        },
        {
          name: 'Usuários',
          href: '/admin/users',
          icon: UserGroupIcon,
          iconSolid: UserGroupIconSolid,
          section: 'gestao',
          submenu: [
            { name: 'Todos os Usuários', href: '/admin/users', icon: UserGroupIcon },
            { name: 'Novo Usuário', href: '/admin/users/new', icon: PlusIcon },
            { name: 'Agentes', href: '/admin/users?role=agent', icon: UserIcon },
            { name: 'Administradores', href: '/admin/users?role=admin', icon: ShieldCheckIcon }
          ]
        },
        {
          name: 'Equipes',
          href: '/admin/teams',
          icon: UserGroupIcon,
          iconSolid: UserGroupIconSolid
        },
        {
          name: 'Relatórios',
          href: '/admin/reports',
          icon: ChartBarIcon,
          iconSolid: ChartBarIconSolid,
          section: 'analitico',
          submenu: [
            { name: 'Dashboard ITIL', href: '/admin/dashboard/itil', icon: PresentationChartLineIcon },
            { name: 'Dashboard Executivo', href: '/admin/reports?type=executive', icon: ChartBarIcon },
            { name: 'Performance Agentes', href: '/admin/reports?type=agents', icon: UserIcon },
            { name: 'Relatórios SLA', href: '/admin/reports?type=sla', icon: ClockIcon }
          ]
        },
        {
          name: 'Governança',
          href: '/admin/governance',
          icon: ShieldCheckIcon,
          iconSolid: ShieldCheckIcon,
          submenu: [
            { name: 'Visão Geral', href: '/admin/governance', icon: ShieldCheckIcon },
            { name: 'Auditoria', href: '/admin/governance?tab=audit', icon: ClipboardDocumentListIcon },
            { name: 'Compliance', href: '/admin/governance?tab=compliance', icon: DocumentTextIcon }
          ]
        },
        {
          name: 'Base de Conhecimento',
          href: '/admin/knowledge',
          icon: BookOpenIcon,
          iconSolid: BookOpenIcon
        },
        {
          name: 'Configurações',
          href: '/admin/settings',
          icon: Cog6ToothIcon,
          iconSolid: Cog6ToothIconSolid,
          section: 'sistema',
          submenu: [
            { name: 'Gerais', href: '/admin/settings', icon: Cog6ToothIcon },
            { name: 'SLA', href: '/admin/settings/sla', icon: ClockIcon },
            { name: 'Templates', href: '/admin/settings/templates', icon: DocumentTextIcon },
            { name: 'Automações', href: '/admin/settings/automations', icon: CpuChipIcon }
          ]
        }
      ]
    } else if (userRole === 'agent') {
      return [
        ...baseItems,
        {
          name: 'Workspace',
          href: '/agent/workspace',
          icon: WrenchScrewdriverIcon,
          iconSolid: WrenchScrewdriverIcon,
          section: 'operacional'
        },
        {
          name: 'Meus Tickets',
          href: '/tickets',
          icon: TicketIcon,
          iconSolid: TicketIconSolid,
          badge: ticketCounts.assigned,
          submenu: [
            { name: 'Atribuídos a mim', href: '/tickets?assigned=me', icon: UserIcon, badge: ticketCounts.assigned },
            { name: 'Novo Ticket', href: '/tickets/new', icon: PlusIcon },
            { name: 'Todos', href: '/tickets', icon: TicketIcon },
            { name: 'Buscar', href: '/search', icon: MagnifyingGlassIcon }
          ]
        },
        {
          name: 'Problemas',
          href: '/admin/problems',
          icon: ExclamationTriangleIcon,
          iconSolid: ExclamationTriangleIcon,
          section: 'itil',
          submenu: [
            { name: 'Todos os Problemas', href: '/admin/problems', icon: ExclamationTriangleIcon },
            { name: 'KEDB', href: '/admin/problems/kedb', icon: BookOpenIcon }
          ]
        },
        {
          name: 'Base Conhecimento',
          href: '/knowledge',
          icon: DocumentTextIcon,
          iconSolid: DocumentTextIcon,
          section: 'recursos'
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
          section: 'operacional',
          submenu: [
            { name: 'Todos', href: '/tickets', icon: UserIcon },
            { name: 'Novo Ticket', href: '/tickets/new', icon: PlusIcon },
            { name: 'Em Aberto', href: '/tickets?status=open', icon: ClockIcon },
            { name: 'Resolvidos', href: '/tickets?status=resolved', icon: TicketIcon }
          ]
        },
        {
          name: 'Base Conhecimento',
          href: '/knowledge',
          icon: DocumentTextIcon,
          iconSolid: DocumentTextIcon,
          section: 'recursos'
        }
      ]
    }
  }

  const menuItems = useMemo(() => getMenuItems(), [userRole, ticketCounts])

  // Super Admin menu — visible only to org 1 users
  const isSuperAdmin = organizationId === 1

  const superAdminItems: SubMenuItem[] = [
    { name: 'Dashboard', href: '/admin/super', icon: GlobeAltIcon },
    { name: 'Organizações', href: '/admin/super/organizations', icon: BuildingOffice2Icon },
    { name: 'Usuários Globais', href: '/admin/super/users', icon: UserGroupIcon },
    { name: 'Auditoria', href: '/admin/super/audit', icon: ClipboardDocumentListIcon },
    { name: 'Configurações', href: '/admin/super/settings', icon: Cog6ToothIcon },
  ]

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

  // Section labels for dividers
  const sectionLabels: Record<string, string> = {
    operacional: 'Operacional',
    itil: 'ITIL',
    gestao: 'Gestão',
    analitico: 'Analítico',
    recursos: 'Recursos',
    sistema: 'Sistema'
  }

  // Track which sections we've rendered dividers for
  let lastSection = 'principal'

  const SidebarContent = () => (
    <div className="flex flex-col h-full safe-top">
      {/* Logo */}
      <div className="flex items-center h-14 sm:h-16 px-4 sm:px-6 border-b border-neutral-200 dark:border-neutral-700/50 flex-shrink-0">
        <div className={`flex items-center ${open ? 'space-x-3' : 'justify-center w-full'}`}>
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-brand rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <TicketIcon className="h-5 w-5 sm:h-5 sm:w-5 text-white" />
          </div>
          {open && (
            <span className="text-lg font-bold text-gradient truncate">
              ServiceDesk Pro
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 px-2 sm:px-3 py-3 sm:py-4 space-y-0.5 overflow-y-auto hide-scrollbar overscroll-contain"
        role="navigation"
        aria-label="Menu principal"
      >
        {/* Super Admin Section */}
        {isSuperAdmin && (
          <div className="mb-2">
            {open && (
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Super Admin
                </span>
              </div>
            )}
            <button
              onClick={() => toggleSubmenu('SuperAdmin')}
              onKeyDown={(e) => handleSubmenuKeyDown(e, 'SuperAdmin')}
              className={`
                group relative flex items-center w-full min-h-[44px] px-3 py-2.5 text-sm font-medium rounded-lg
                transition-all duration-200
                ${pathname.startsWith('/admin/super')
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-l-[3px] border-amber-500'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 border-l-[3px] border-transparent'
                }
              `}
              aria-expanded={expandedMenus.includes('SuperAdmin') || pathname.startsWith('/admin/super')}
              aria-controls="submenu-SuperAdmin"
              aria-label={`${expandedMenus.includes('SuperAdmin') || pathname.startsWith('/admin/super') ? 'Fechar' : 'Abrir'} submenu Super Admin`}
            >
              <ShieldCheckIcon className="h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
              {open && (
                <>
                  <span className="ml-3 flex-1 text-left truncate font-semibold">{!open ? '' : 'Super Admin'}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 ml-1 transition-transform duration-200 text-neutral-400 dark:text-neutral-500 ${
                      expandedMenus.includes('SuperAdmin') || pathname.startsWith('/admin/super') ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </>
              )}

              {/* Collapsed tooltip */}
              {!open && (
                <div
                  className="absolute left-full ml-3 px-2.5 py-1.5 bg-neutral-900 dark:bg-neutral-700 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap pointer-events-none shadow-lg"
                  role="tooltip"
                >
                  Super Admin
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-neutral-900 dark:border-r-neutral-700" />
                </div>
              )}
            </button>

            {open && (expandedMenus.includes('SuperAdmin') || pathname.startsWith('/admin/super')) && (
              <div
                id="submenu-SuperAdmin"
                className="mt-1 ml-3 pl-3 space-y-0.5 border-l-2 border-amber-200 dark:border-amber-800/50"
                role="group"
                aria-label="Super Admin submenu"
              >
                {superAdminItems.map((subItem) => {
                  const isSubActive = subItem.href === '/admin/super'
                    ? pathname === '/admin/super'
                    : pathname.startsWith(subItem.href)
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={`
                        flex items-center px-3 py-2 min-h-[40px] text-sm rounded-md
                        transition-all duration-200
                        ${isSubActive
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
                        }
                      `}
                      aria-current={isSubActive ? 'page' : undefined}
                    >
                      <subItem.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      <span className="ml-2.5 flex-1 truncate">{subItem.name}</span>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Separator after Super Admin */}
            <div className="mt-3 mb-2 mx-3 border-t border-neutral-200 dark:border-neutral-700/50" />
          </div>
        )}

        {menuItems.map((item, index) => {
          const isItemActive = isActive(item.href)
          const hasActiveChild = hasActiveSubmenu(item.submenu)
          const isExpanded = expandedMenus.includes(item.name)
          const shouldExpand = isExpanded || hasActiveChild

          const IconComponent = isItemActive ? item.iconSolid : item.icon

          // Render section divider if section changed
          let sectionDivider = null
          if (item.section && item.section !== lastSection && index > 0) {
            sectionDivider = (
              <div key={`divider-${item.section}`} className="pt-3 pb-1">
                {open && (
                  <div className="px-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                      {sectionLabels[item.section] || item.section}
                    </span>
                  </div>
                )}
                {!open && (
                  <div className="mx-3 border-t border-neutral-200 dark:border-neutral-700/50" />
                )}
              </div>
            )
            lastSection = item.section
          } else if (item.section) {
            lastSection = item.section
          }

          return (
            <React.Fragment key={item.name}>
              {sectionDivider}
              <div>
                {/* Main menu item */}
                <div className="relative group">
                  {item.submenu ? (
                    <button
                      onClick={() => toggleSubmenu(item.name)}
                      onKeyDown={(e) => handleSubmenuKeyDown(e, item.name)}
                      className={`
                        flex items-center w-full min-h-[44px] px-3 py-2.5 text-sm font-medium rounded-lg
                        transition-all duration-200
                        ${isItemActive || hasActiveChild
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-l-[3px] border-brand-500'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 border-l-[3px] border-transparent'
                        }
                      `}
                      aria-expanded={shouldExpand}
                      aria-controls={`submenu-${item.name}`}
                      aria-label={`${shouldExpand ? 'Fechar' : 'Abrir'} submenu de ${item.name}${item.badge ? `. ${item.badge} itens` : ''}`}
                    >
                      <IconComponent className={`h-5 w-5 flex-shrink-0 ${isItemActive || hasActiveChild ? 'text-brand-600 dark:text-brand-400' : ''}`} aria-hidden="true" />
                      {open && (
                        <>
                          <span className="ml-3 flex-1 text-left truncate">{item.name}</span>
                          {item.badge ? (
                            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" aria-label={`${item.badge} itens`}>
                              {item.badge}
                            </span>
                          ) : null}
                          <ChevronDownIcon
                            className={`h-4 w-4 ml-1 transition-transform duration-200 text-neutral-400 dark:text-neutral-500 ${shouldExpand ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                          />
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={`
                        flex items-center min-h-[44px] px-3 py-2.5 text-sm font-medium rounded-lg
                        transition-all duration-200
                        ${isItemActive
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-l-[3px] border-brand-500'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 border-l-[3px] border-transparent'
                        }
                      `}
                      aria-current={isItemActive ? 'page' : undefined}
                      aria-label={`Navegar para ${item.name}${item.badge ? `. ${item.badge} itens` : ''}`}
                    >
                      <IconComponent className={`h-5 w-5 flex-shrink-0 ${isItemActive ? 'text-brand-600 dark:text-brand-400' : ''}`} aria-hidden="true" />
                      {open && (
                        <>
                          <span className="ml-3 flex-1 truncate">{item.name}</span>
                          {item.badge ? (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 animate-fade-in" aria-label={`${item.badge} itens`}>
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      )}
                    </Link>
                  )}

                  {/* Tooltip for collapsed sidebar */}
                  {!open && (
                    <div
                      className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-neutral-900 dark:bg-neutral-700 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap pointer-events-none shadow-lg"
                      role="tooltip"
                    >
                      {item.name}
                      {item.badge ? (
                        <span className="ml-2 bg-brand-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                          {item.badge}
                        </span>
                      ) : null}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-neutral-900 dark:border-r-neutral-700" />
                    </div>
                  )}
                </div>

                {/* Submenu */}
                {item.submenu && open && shouldExpand && (
                  <div
                    id={`submenu-${item.name}`}
                    className="mt-1 ml-3 pl-3 space-y-0.5 border-l-2 border-neutral-200 dark:border-neutral-700/50"
                    role="group"
                    aria-label={`${item.name} submenu`}
                  >
                    {item.submenu.map((subItem) => {
                      const isSubItemActive = isActive(subItem.href)
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          className={`
                            flex items-center px-3 py-2 min-h-[40px] text-sm rounded-md
                            transition-all duration-200
                            ${isSubItemActive
                              ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
                            }
                          `}
                          aria-current={isSubItemActive ? 'page' : undefined}
                          aria-label={`Navegar para ${subItem.name}${subItem.badge ? `. ${subItem.badge} itens` : ''}`}
                        >
                          <subItem.icon className={`h-4 w-4 flex-shrink-0 ${isSubItemActive ? 'text-brand-600 dark:text-brand-400' : ''}`} aria-hidden="true" />
                          <span className="ml-2.5 flex-1 truncate">{subItem.name}</span>
                          {subItem.badge ? (
                            <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 animate-fade-in" aria-label={`${subItem.badge} itens`}>
                              {subItem.badge}
                            </span>
                          ) : null}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Bottom section — user info */}
      <div className={`flex-shrink-0 border-t border-neutral-200 dark:border-neutral-700/50 ${open ? 'p-3' : 'p-2'} pb-safe`}>
        {open ? (
          <div className="flex items-center space-x-3 px-2 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50">
            <div className="w-9 h-9 bg-gradient-brand rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white text-sm font-semibold">
                {userName?.charAt(0).toUpperCase() || userRole.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                {userName || 'Usuário'}
              </p>
              <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${roleBadgeColors[userRole] || roleBadgeColors.user}`}>
                {roleLabels[userRole] || 'Usuário'}
              </span>
            </div>
          </div>
        ) : (
          <div className="group relative flex justify-center">
            <div className="w-9 h-9 bg-gradient-brand rounded-full flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-semibold">
                {userName?.charAt(0).toUpperCase() || userRole.charAt(0).toUpperCase()}
              </span>
            </div>
            {/* Tooltip for collapsed state */}
            <div
              className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-neutral-900 dark:bg-neutral-700 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap pointer-events-none shadow-lg"
              role="tooltip"
            >
              {userName || 'Usuário'} &middot; {roleLabels[userRole]}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-neutral-900 dark:border-r-neutral-700" />
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setOpen(false)}
          onTouchEnd={() => setOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="main-sidebar"
        className={`
          fixed inset-y-0 left-0 z-50 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700/50
          transform transition-all duration-300 ease-in-out will-change-transform
          ${open ? 'w-64 sm:w-72 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'}
          ${open ? 'shadow-xl' : 'shadow-md'}
        `}
        aria-label="Barra lateral de navegação"
      >
        <SidebarContent />
      </aside>

      {/* Spacer for desktop */}
      <div
        className={`hidden lg:block transition-all duration-300 ease-in-out ${open ? 'w-64' : 'w-20'}`}
      />
    </>
  )
}
