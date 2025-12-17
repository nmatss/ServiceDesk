'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ExclamationTriangleIcon,
  HomeIcon,
  ArrowLeftIcon,
  TicketIcon,
  ChartBarIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

export default function NotFound() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const quickLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: ChartBarIcon, description: 'Visão geral do sistema' },
    { href: '/tickets', label: 'Tickets', icon: TicketIcon, description: 'Gerenciar chamados' },
    { href: '/knowledge', label: 'Base de Conhecimento', icon: BookOpenIcon, description: 'Artigos e documentação' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full">
        {/* Main Error Card */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 px-8 py-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center animate-pulse-soft">
                <ExclamationTriangleIcon className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-6xl font-bold text-white text-center mb-2">
              404
            </h1>
            <h2 className="text-xl font-semibold text-white/90 text-center">
              Página Não Encontrada
            </h2>
          </div>

          {/* Content Section */}
          <div className="px-8 py-8 text-center">
            <p className="text-neutral-600 dark:text-neutral-300 mb-8 text-lg">
              Desculpe, a página que você está procurando não existe ou foi movida para outro local.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/"
                className="btn btn-primary flex items-center justify-center gap-2 min-h-touch"
              >
                <HomeIcon className="w-5 h-5" />
                Ir para Início
              </Link>

              <button
                onClick={() => router.back()}
                className="btn btn-secondary flex items-center justify-center gap-2 min-h-touch"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                Voltar
              </button>

              <button
                onClick={() => setShowSearch(!showSearch)}
                className="btn btn-ghost flex items-center justify-center gap-2 min-h-touch"
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
                Buscar
              </button>
            </div>

            {/* Search Box (Collapsible) */}
            {showSearch && (
              <div className="mb-8 animate-slide-down">
                <form onSubmit={handleSearch} className="relative max-w-md mx-auto">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar tickets, artigos..."
                      className="input pl-10 pr-10 w-full"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowSearch(false)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Quick Links Grid */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-8 mt-8">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-6">
                Páginas Populares
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {quickLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group p-4 rounded-lg border border-neutral-200 dark:border-neutral-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-md transition-all duration-200 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100 text-sm mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {link.label}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                            {link.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Help Section */}
            <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                Precisa de ajuda?
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link
                  href="/knowledge"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors"
                >
                  Documentação
                </Link>
                <span className="text-neutral-300 dark:text-neutral-600">|</span>
                <Link
                  href="/portal/create"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors"
                >
                  Abrir Ticket de Suporte
                </Link>
                <span className="text-neutral-300 dark:text-neutral-600">|</span>
                <Link
                  href="/landing"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors"
                >
                  Sobre o ServiceDesk
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Código do erro: 404 - Página não encontrada
          </p>
        </div>
      </div>
    </div>
  )
}