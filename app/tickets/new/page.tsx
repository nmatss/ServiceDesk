'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline'
import TicketForm from '@/src/components/tickets/TicketForm'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/tickets"
          className="btn btn-ghost btn-sm min-h-[44px]"
          aria-label="Voltar para lista de tickets"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Voltar
        </Link>
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <PlusIcon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              Novo Ticket
            </h1>
          </div>
          <p className="text-description">
            Crie um novo ticket de suporte
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <TicketForm
          mode="create"
          userRole={userRole}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}

