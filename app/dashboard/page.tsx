'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ModernDashboard from '@/src/components/dashboard/ModernDashboard'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'

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

  return <ModernDashboard userRole={user?.role || 'user'} />
}