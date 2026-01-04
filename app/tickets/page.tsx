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
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/', icon: HomeIcon },
          { label: user?.role === 'user' ? 'Meus Tickets' : 'Tickets' }
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <TicketIcon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {user?.role === 'user' ? 'Meus Tickets' : 'Tickets'}
            </h1>
          </div>
          <p className="text-description">
            {user?.role === 'user'
              ? 'Gerencie seus tickets de suporte'
              : user?.role === 'agent'
              ? 'Visualize e gerencie tickets atribuídos a você'
              : 'Gerencie todos os tickets do sistema'
            }
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/tickets/new"
            className="btn btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Novo Ticket
          </Link>
        </div>
      </div>

      {/* Tickets List */}
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