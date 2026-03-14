'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, PlusIcon, HomeIcon, TicketIcon } from '@heroicons/react/24/outline'
import TicketForm from '@/src/components/tickets/TicketForm'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function NewTicketPage() {
  const router = useRouter()
  const { user, loading } = useRequireAuth()

  const userRole = (user?.role as 'admin' | 'agent' | 'user') || 'user'

  const handleFormSubmit = (ticket: { id: string | number }) => {
    router.push(`/tickets/${ticket.id}`)
  }

  const handleCancel = () => {
    router.back()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <p className="text-description">Carregando...</p>
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
          { label: 'Tickets', href: '/tickets', icon: TicketIcon },
          { label: 'Novo Ticket' }
        ]}
      />

      {/* Page Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Link
            href="/tickets"
            className="h-10 w-10 flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors min-h-[44px] min-w-[44px]"
            aria-label="Voltar para lista de tickets"
          >
            <ArrowLeftIcon className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <PlusIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                Novo Ticket
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Preencha os campos abaixo para criar um novo ticket de suporte
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Container - Centered */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-5 sm:p-6">
          <TicketForm
            mode="create"
            userRole={userRole}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  )
}
