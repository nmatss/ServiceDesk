'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlusIcon, TicketIcon } from '@heroicons/react/24/outline'
import TicketList from '@/src/components/tickets/TicketList'

export default function TicketsPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<'admin' | 'agent' | 'user'>('user')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const role = localStorage.getItem('user_role') as 'admin' | 'agent' | 'user'

    if (!token) {
      router.push('/auth/login')
      return
    }

    setUserRole(role || 'user')
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Carregando tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <TicketIcon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {userRole === 'user' ? 'Meus Tickets' : 'Tickets'}
            </h1>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            {userRole === 'user'
              ? 'Gerencie seus tickets de suporte'
              : userRole === 'agent'
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
        userRole={userRole}
        showUserTickets={userRole === 'user'}
        showFilters={true}
        showStats={true}
        showSearch={true}
      />
    </div>
  )
}