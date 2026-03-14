'use client'

import Link from 'next/link'
import { PlusIcon, TicketIcon, HomeIcon } from '@heroicons/react/24/outline'
import TicketList from '@/src/components/tickets/TicketList'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function TicketsPage() {
  // Use the centralized auth hook - eliminates 35+ lines of duplicate code
  const { user, loading } = useRequireAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <p className="text-description">Carregando tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/', icon: HomeIcon },
          { label: user?.role === 'user' ? 'Meus Tickets' : 'Tickets' }
        ]}
      />

      {/* Page Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <TicketIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {user?.role === 'user' ? 'Meus Tickets' : 'Tickets'}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {user?.role === 'user'
                  ? 'Gerencie seus tickets de suporte'
                  : user?.role === 'agent'
                  ? 'Visualize e gerencie tickets atribuidos a voce'
                  : 'Gerencie todos os tickets do sistema'
                }
              </p>
            </div>
          </div>

          <Link
            href="/tickets/new"
            className="inline-flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] shadow-sm"
            aria-label="Criar novo ticket"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Novo Ticket
          </Link>
        </div>
      </div>

      {/* Tickets List with built-in filters and stats */}
      <TicketList
        userRole={user?.role || 'user'}
        showUserTickets={user?.role === 'user'}
        showFilters={true}
        showStats={true}
        showSearch={true}
      />
    </div>
  )
}
