'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline'
import TicketForm from '@/src/components/tickets/TicketForm'

export default function NewTicketPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<'admin' | 'agent' | 'user'>('user')
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

        setUserRole(data.user.role || 'user')
        setLoading(false)
      } catch {
        router.push('/auth/login')
      }
    }

    verifyAuth()
  }, [router])

  const handleFormSubmit = (ticket: any) => {
    // Redirect to the created ticket
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
          <p className="text-neutral-600 dark:text-neutral-400">Carregando...</p>
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
          className="btn btn-ghost btn-sm"
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
          <p className="text-neutral-600 dark:text-neutral-400">
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

