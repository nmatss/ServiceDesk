'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlusIcon, TicketIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import TicketList from '@/src/components/tickets/TicketList'

export default function AdminTicketsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // SECURITY: Verify authentication via httpOnly cookies only
    const verifyAuth = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include' // Use httpOnly cookies
        })

        if (!response.ok) {
          router.push('/auth/login')
          return
        }

        const data = await response.json()

        if (!data.success || !data.user) {
          router.push('/auth/login')
          return
        }

        if (data.user.role !== 'admin') {
          router.push('/dashboard')
          return
        }

        setLoading(false)
      } catch {
        router.push('/auth/login')
      }
    }

    verifyAuth()
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
              Gerenciar Tickets
            </h1>
          </div>
          <p className="text-neutral-600 dark:text-neutral-400">
            Visualize e gerencie todos os tickets do sistema
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button className="btn btn-outline">
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            Exportar
          </button>
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
        userRole="admin"
        showUserTickets={false}
        showFilters={true}
        showStats={true}
        showSearch={true}
      />
    </div>
  )
}
