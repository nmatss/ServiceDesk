'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  HomeIcon,
  TicketIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  BookOpenIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon, current: true },
  { name: 'Tickets', href: '/admin/tickets', icon: TicketIcon, current: false },
  { name: 'Usuários', href: '/admin/users', icon: UserGroupIcon, current: false },
  { name: 'Times', href: '/admin/teams', icon: UserGroupIcon, current: false },
  { name: 'Relatórios', href: '/admin/reports', icon: ChartBarIcon, current: false },
  { name: 'Base de Conhecimento', href: '/admin/knowledge', icon: BookOpenIcon, current: false },
  { name: 'SLA', href: '/admin/sla', icon: ClockIcon, current: false },
  { name: 'Incidentes', href: '/admin/incidents', icon: ExclamationTriangleIcon, current: false },
]

const secondaryNavigation = [
  { name: 'Categorias', href: '/admin/categories', icon: DocumentTextIcon },
  { name: 'Prioridades', href: '/admin/priorities', icon: ExclamationTriangleIcon },
  { name: 'Status', href: '/admin/statuses', icon: ChatBubbleLeftRightIcon },
  { name: 'Configurações', href: '/admin/settings', icon: Cog6ToothIcon },
]

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>

                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-2">
                  <div className="flex h-16 shrink-0 items-center">
                    <h1 className="text-xl font-bold text-gray-900">ServiceDesk Pro</h1>
                  </div>
                  <nav className="flex flex-1 flex-col" role="navigation" aria-label="Menu de administração">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <a
                                href={item.href}
                                className={classNames(
                                  item.current
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50',
                                  'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                                )}
                                aria-current={item.current ? 'page' : undefined}
                                aria-label={item.name}
                              >
                                <item.icon
                                  className={classNames(
                                    item.current ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600',
                                    'h-6 w-6 shrink-0'
                                  )}
                                  aria-hidden="true"
                                />
                                {item.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </li>
                      <li>
                        <div
                          className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider"
                          role="heading"
                          aria-level={2}
                        >
                          Configurações
                        </div>
                        <ul role="list" className="-mx-2 mt-2 space-y-1">
                          {secondaryNavigation.map((item) => (
                            <li key={item.name}>
                              <a
                                href={item.href}
                                className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                                aria-label={item.name}
                              >
                                <item.icon
                                  className="text-gray-400 group-hover:text-blue-600 h-6 w-6 shrink-0"
                                  aria-hidden="true"
                                />
                                {item.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <aside
        className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col"
        aria-label="Barra lateral de navegação"
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-gray-900">ServiceDesk Pro</h1>
          </div>
          <nav className="flex flex-1 flex-col" role="navigation" aria-label="Menu de administração">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className={classNames(
                          item.current
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                        )}
                        aria-current={item.current ? 'page' : undefined}
                        aria-label={item.name}
                      >
                        <item.icon
                          className={classNames(
                            item.current ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-600',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
              <li>
                <div
                  className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wider"
                  role="heading"
                  aria-level={2}
                >
                  Configurações
                </div>
                <ul role="list" className="-mx-2 mt-2 space-y-1">
                  {secondaryNavigation.map((item) => (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold"
                        aria-label={item.name}
                      >
                        <item.icon
                          className="text-gray-400 group-hover:text-blue-600 h-6 w-6 shrink-0"
                          aria-hidden="true"
                        />
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>

              {/* Tenant Info */}
              <li className="mt-auto">
                <div className="border-t border-gray-200 pt-4" role="region" aria-label="Informações da organização">
                  <div className="flex items-center gap-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600" aria-hidden="true">
                      <span className="text-sm font-semibold text-white">ED</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900">Empresa Demo</div>
                      <div className="text-xs text-gray-500">Plan Enterprise</div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </aside>
    </>
  )
}