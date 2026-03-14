'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ModernDashboard from '@/src/components/dashboard/ModernDashboard'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import { CalendarDaysIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getGreetingIcon() {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 18) return SunIcon
  return MoonIcon
}

export default function DashboardPage() {
  const router = useRouter()

  // Use the centralized auth hook - eliminates 50+ lines of duplicate code
  const { user, loading, error } = useRequireAuth()

  // Redirect admins to admin panel
  useEffect(() => {
    if (!loading && user?.role === 'admin') {
      router.push('/admin')
    }
  }, [loading, user, router])

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }, [])

  const greeting = useMemo(() => getGreeting(), [])
  const GreetingIcon = useMemo(() => getGreetingIcon(), [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <p className="text-description">
            {error ? error.message : 'Carregando dashboard...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 dark:from-brand-700 dark:to-brand-800 rounded-xl p-5 sm:p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 bg-white/20 rounded-xl items-center justify-center flex-shrink-0">
              <GreetingIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                {greeting}, {user?.name?.split(' ')[0] || 'Colaborador'}!
              </h2>
              <p className="text-white/80 text-sm mt-1">
                Aqui esta seu resumo de hoje.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <CalendarDaysIcon className="h-4 w-4" />
            <span className="capitalize">{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <ModernDashboard userRole={user?.role || 'user'} />
    </div>
  )
}
