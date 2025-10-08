'use client'

import { Fragment } from 'react'
import { Disclosure, Menu, Transition } from '@headlessui/react'
import { Bars3Icon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import NotificationDropdown from '../NotificationDropdown'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  return (
    <Disclosure as="nav" className="bg-white shadow-sm border-b border-gray-200">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" role="banner">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <div className="flex flex-shrink-0 items-center">
                  {/* Mobile menu button */}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Abrir menu principal"
                    aria-expanded={open}
                  >
                    <span className="sr-only">Abrir menu principal</span>
                    <Bars3Icon className="h-6 w-6" aria-hidden="true" />
                  </button>

                  {/* Logo */}
                  <div className="ml-4 flex items-center lg:ml-0">
                    <div className="flex-shrink-0">
                      <h1 className="text-xl font-bold text-gray-900">ServiceDesk Pro</h1>
                    </div>
                  </div>
                </div>

                {/* Search bar */}
                <div className="hidden lg:ml-6 lg:flex lg:flex-1 lg:items-center">
                  <div className="w-full max-w-lg lg:max-w-xs">
                    <label htmlFor="search" className="sr-only">
                      Buscar
                    </label>
                    <div className="relative" role="search">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </div>
                      <input
                        id="search"
                        name="search"
                        className="block w-full rounded-md border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                        placeholder="Buscar tickets, usuários..."
                        type="search"
                        aria-label="Campo de busca"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden lg:ml-4 lg:flex lg:items-center">
                {/* Notification dropdown */}
                <NotificationDropdown />

                {/* Profile dropdown */}
                <Menu as="div" className="relative ml-4 flex-shrink-0">
                  <div>
                    <Menu.Button className="relative flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" aria-label="Abrir menu do usuário" aria-haspopup="true">
                      <span className="sr-only">Abrir menu do usuário</span>
                      <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center" aria-hidden="true">
                        <span className="text-sm font-medium text-white">AD</span>
                      </div>
                    </Menu.Button>
                  </div>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none" role="menu" aria-label="Menu do usuário">
                      <Menu.Item>
                        {({ active }) => (
                          <a
                            href="#"
                            className={classNames(
                              active ? 'bg-gray-100' : '',
                              'block px-4 py-2 text-sm text-gray-700'
                            )}
                            role="menuitem"
                            aria-label="Ver seu perfil"
                          >
                            Seu Perfil
                          </a>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <a
                            href="#"
                            className={classNames(
                              active ? 'bg-gray-100' : '',
                              'block px-4 py-2 text-sm text-gray-700'
                            )}
                            role="menuitem"
                            aria-label="Ir para configurações"
                          >
                            Configurações
                          </a>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <a
                            href="#"
                            className={classNames(
                              active ? 'bg-gray-100' : '',
                              'block px-4 py-2 text-sm text-gray-700'
                            )}
                            role="menuitem"
                            aria-label="Sair do sistema"
                          >
                            Sair
                          </a>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>
              </div>

              {/* Mobile menu button */}
              <div className="flex items-center lg:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500" aria-label={open ? "Fechar menu principal" : "Abrir menu principal"} aria-expanded={open}>
                  <span className="sr-only">{open ? "Fechar menu principal" : "Abrir menu principal"}</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <Disclosure.Panel className="lg:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {/* Mobile search */}
              <div className="px-4">
                <label htmlFor="mobile-search" className="sr-only">Buscar</label>
                <div className="relative" role="search">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                  <input
                    id="mobile-search"
                    className="block w-full rounded-md border-0 bg-white py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    placeholder="Buscar..."
                    type="search"
                    aria-label="Buscar tickets, usuários"
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 pb-3 pt-4">
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">AD</span>
                  </div>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">Admin User</div>
                  <div className="text-sm font-medium text-gray-500">admin@servicedesk.com</div>
                </div>
                <div className="ml-auto">
                  <NotificationDropdown />
                </div>
              </div>
              <div className="mt-3 space-y-1" role="menu" aria-label="Menu do usuário móvel">
                <Disclosure.Button
                  as="a"
                  href="#"
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  role="menuitem"
                  aria-label="Ver seu perfil"
                >
                  Seu Perfil
                </Disclosure.Button>
                <Disclosure.Button
                  as="a"
                  href="#"
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  role="menuitem"
                  aria-label="Ir para configurações"
                >
                  Configurações
                </Disclosure.Button>
                <Disclosure.Button
                  as="a"
                  href="#"
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  role="menuitem"
                  aria-label="Sair do sistema"
                >
                  Sair
                </Disclosure.Button>
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}