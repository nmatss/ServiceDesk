'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ModernDashboard from '@/src/components/dashboard/ModernDashboard'

export default function DashboardPage() {
  const router = useRouter()
  const [userRole, setUserRole] = useState<'admin' | 'agent' | 'user'>('user')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch user data - middleware already handles authentication/redirect
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include' // Use httpOnly cookies
        })

        if (!response.ok) {
          setError('Erro ao carregar dados do usuário')
          setLoading(false)
          return
        }

        const data = await response.json()

        if (!data.success || !data.user) {
          setError('Dados do usuário inválidos')
          setLoading(false)
          return
        }

        // Set user role from server response
        setUserRole(data.user.role)

        // Redirecionar admins para o painel admin
        if (data.user.role === 'admin') {
          router.push('/admin')
          return
        }

        setLoading(false)
      } catch (err) {
        console.error('Failed to fetch user data:', err)
        setError('Erro ao carregar dados do usuário')
        setLoading(false)
      }
    }

    fetchUserData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">
            {error ? error : 'Carregando dashboard...'}
          </p>
        </div>
      </div>
    )
  }

  return <ModernDashboard userRole={userRole} />
}