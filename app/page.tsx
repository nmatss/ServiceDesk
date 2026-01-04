'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // SECURITY: Verify authentication via httpOnly cookies only
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include' // Use httpOnly cookies
        })

        if (!response.ok) {
          // Se não autenticado, redirecionar para landing
          router.push('/landing')
          return
        }

        const data = await response.json()

        if (!data.success || !data.user) {
          router.push('/landing')
          return
        }

        // Se autenticado, redirecionar para dashboard apropriado
        if (data.user.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
      } catch {
        router.push('/landing')
      }
    }

    checkAuth()
  }, [router])

  // Loading screen enquanto redireciona
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-600 mx-auto mb-4"></div>
        <p className="text-description">Redirecionando...</p>
      </div>
    </div>
  )
}