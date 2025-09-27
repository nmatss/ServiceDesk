'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ModernDashboard from '@/src/components/dashboard/ModernDashboard'

export default function DashboardPage() {
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

    setUserRole(role)

    // Redirecionar admins para o painel admin
    if (role === 'admin') {
      router.push('/admin')
      return
    }

    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return <ModernDashboard userRole={userRole} />
}