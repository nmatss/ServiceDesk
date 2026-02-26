'use client'

import { PlusIcon, TicketIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import TicketList from '@/src/components/tickets/TicketList'
import { useRequireAdmin } from '@/lib/hooks/useRequireAuth'

export default function AdminTicketsPage() {
  // Use the centralized admin auth hook - eliminates 45+ lines of duplicate code
  const { loading } = useRequireAdmin()

  const handleExport = () => {
    // TODO: Implement export functionality
  }

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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gerenciar Tickets"
        description="Visualize e gerencie todos os tickets do sistema"
        icon={TicketIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Tickets' }
        ]}
        actions={[
          {
            label: 'Exportar',
            icon: DocumentArrowDownIcon,
            variant: 'secondary',
            onClick: handleExport
          },
          {
            label: 'Novo Ticket',
            icon: PlusIcon,
            variant: 'primary',
            href: '/tickets/new'
          }
        ]}
      />

      {/* Tickets List */}
      <div className="animate-slide-up">
        <TicketList
          userRole="admin"
          showUserTickets={false}
          showFilters={true}
          showStats={true}
          showSearch={true}
        />
      </div>
    </div>
  )
}
