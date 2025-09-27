'use client'

import { useState, Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HomeIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  UserGroupIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'

interface MenuItem {
  name: string
  href: string
  icon?: any
  submenu?: MenuItem[]
  locked?: boolean
  initial?: string
  color?: string
}

const mainMenuItems: MenuItem[] = [
  { 
    name: 'Home', 
    href: '/admin', 
    icon: HomeIcon
  },
  { 
    name: 'Settings', 
    href: '/admin/settings', 
    icon: Cog6ToothIcon,
    submenu: [
      { name: 'Data source', href: '/admin/settings/data-source' },
      { name: 'Targets', href: '/admin/settings/targets' },
      { name: 'Members', href: '/admin/settings/members' },
      { name: 'Upgrade', href: '/admin/settings/upgrade' },
    ]
  },
  { 
    name: 'Help center', 
    href: '/admin/help', 
    icon: QuestionMarkCircleIcon
  }
]

const teamItems: MenuItem[] = [
  { 
    name: 'All teams', 
    href: '/admin/teams', 
    icon: UserGroupIcon
  },
  { 
    name: 'Finance', 
    href: '/admin/teams/finance', 
    initial: 'F', 
    color: 'bg-blue-500',
    locked: true,
  },
  { 
    name: 'Product', 
    href: '/admin/teams/product', 
    initial: 'P', 
    color: 'bg-orange-500',
    locked: true,
  }
]

export default function SidebarMenu() {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const pathname = usePathname()

  const isItemActive = (href: string) => {
    return pathname === href
  }

  const toggleExpanded = (itemName: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemName)) {
      newExpanded.delete(itemName)
    } else {
      newExpanded.add(itemName)
    }
    setExpandedItems(newExpanded)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_id')
    window.location.href = '/auth/login'
  }

  return (
    <div className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 shadow-lg border-r border-gray-200">
        {/* Top Section with colored dots and logo */}
        <div className="flex flex-col items-center py-4">
          {/* Colored dots */}
          <div className="flex gap-1 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
          
          {/* Logo and text */}
          <div className="flex items-center mb-4">
            <div className="h-6 w-6 text-gray-900 flex items-center justify-center">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <rect width="32" height="32" rx="4" fill="#1a1a2e"></rect>
                <g filter="url(#glow)">
                  <path d="M6 12C8 8 12 8 16 12C20 16 24 16 26 12" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" fill="none"></path>
                  <path d="M6 20C8 24 12 24 16 20C20 16 24 16 26 20" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" fill="none"></path>
                </g>
                <defs>
                  <filter id="glow" x="-2" y="-2" width="36" height="36">
                    <feGaussianBlur stdDeviation="1" result="coloredBlur"></feGaussianBlur>
                    <feMerge>
                      <feMergeNode in="coloredBlur"></feMergeNode>
                      <feMergeNode in="SourceGraphic"></feMergeNode>
                    </feMerge>
                  </filter>
                </defs>
              </svg>
            </div>
            {!collapsed && (
              <span className="ml-2 text-lg font-bold text-gray-900">SERVICEDESK</span>
            )}
          </div>
          
          {/* Toggle button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-100 transition-colors duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-gray-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        {/* Search Field */}
        {!collapsed && (
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400" />
            <input
              className="block w-full border-0 py-2 pl-8 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm bg-gray-50 rounded-lg"
              placeholder="Buscar..."
              type="search"
              name="search"
            />
          </div>
        )}

        {/* Main Menu */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              {!collapsed && (
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  MAIN MENU
                </div>
              )}
              <ul role="list" className="-mx-2 space-y-1">
                {mainMenuItems.map((item) => {
                  const isActive = isItemActive(item.href)
                  const isExpanded = expandedItems.has(item.name)
                  const hasSubmenu = item.submenu && item.submenu.length > 0
                  
                  return (
                    <li key={item.name} className="relative">
                      <div
                        className={`group flex items-center rounded-lg transition-all duration-200 p-3 ${
                          isActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        } ${collapsed ? 'justify-center' : ''}`}
                        onMouseEnter={() => setHoveredItem(item.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <Link
                          href={item.href}
                          className={`flex items-center gap-x-3 text-sm font-semibold flex-1 ${
                            collapsed ? 'justify-center' : ''
                          }`}
                        >
                          {item.icon && <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />}
                          {!collapsed && <span className="truncate">{item.name}</span>}
                        </Link>
                        
                        {!collapsed && hasSubmenu && (
                          <button
                            onClick={() => toggleExpanded(item.name)}
                            className="ml-auto p-1 rounded hover:bg-gray-200 transition-colors duration-200"
                          >
                            <ChevronDownIcon 
                              className={`h-4 w-4 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`} 
                            />
                          </button>
                        )}
                      </div>

                      {/* Tooltip for collapsed state */}
                      {collapsed && hoveredItem === item.name && (
                        <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 z-50">
                          <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                            {item.name}
                            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                          </div>
                        </div>
                      )}

                      {/* Submenu */}
                      {!collapsed && hasSubmenu && isExpanded && (
                        <ul className="ml-6 mt-1 space-y-1">
                          {item.submenu?.map((subItem) => (
                            <li key={subItem.name} className="relative">
                              <div
                                className={`group flex items-center rounded-lg transition-all duration-200 p-2 ${
                                  isItemActive(subItem.href)
                                    ? 'bg-gray-100 text-gray-900'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                                onMouseEnter={() => setHoveredItem(subItem.name)}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                <Link
                                  href={subItem.href}
                                  className="flex items-center gap-x-3 text-sm font-medium flex-1"
                                >
                                  <span className="truncate">{subItem.name}</span>
                                </Link>
                              </div>

                              {/* Tooltip for collapsed submenu state */}
                              {collapsed && hoveredItem === subItem.name && (
                                <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 z-50">
                                  <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                                    {subItem.name}
                                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
            
            {/* Teams Section */}
            <li>
              {!collapsed && (
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  TEAMS
                </div>
              )}
              <ul role="list" className="-mx-2 space-y-1">
                {teamItems.map((team) => {
                  const isActive = isItemActive(team.href)
                  
                  return (
                    <li key={team.name} className="relative">
                      <div
                        className={`group flex items-center rounded-lg transition-all duration-200 p-3 ${
                          isActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        } ${collapsed ? 'justify-center' : ''}`}
                        onMouseEnter={() => setHoveredItem(team.name)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <Link
                          href={team.href}
                          className={`flex items-center gap-x-3 text-sm font-semibold flex-1 ${
                            collapsed ? 'justify-center' : ''
                          }`}
                        >
                          {team.color ? (
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white ${team.color}`}>
                              {team.initial}
                            </span>
                          ) : (
                            team.icon && <team.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                          )}
                          {!collapsed && (
                            <div className="flex-1 flex items-center justify-between">
                              <span className="truncate">{team.name}</span>
                              {team.locked && (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-gray-400">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                </svg>
                              )}
                            </div>
                          )}
                        </Link>
                      </div>

                      {/* Tooltip for collapsed state */}
                      {collapsed && hoveredItem === team.name && (
                        <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 z-50">
                          <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                            {team.name}
                            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
            
            {/* User Profile & Logout */}
            <li className="mt-auto">
              <div className="border-t border-gray-200 pt-4">
                {!collapsed && (
                  <div className="flex items-center gap-x-3 px-3 py-2">
                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">A</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Admin</p>
                      <p className="text-xs text-gray-500">Administrador</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-x-3 rounded-lg p-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 ${
                    collapsed ? 'justify-center' : ''
                  }`}
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {!collapsed && <span>Sair</span>}
                </button>
              </div>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}