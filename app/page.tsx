'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCachedAuth } from '@/lib/hooks/useRequireAuth'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      // Check global auth cache first (populated by AppLayout)
      const cached = getCachedAuth()
      if (cached) {
        const role = cached.user?.role
        router.replace(role === 'admin' || role === 'super_admin' || role === 'tenant_admin' ? '/admin' : '/dashboard')
        return
      }

      // Fallback: verify with API
      try {
        const response = await fetch('/api/auth/verify', {
          credentials: 'include'
        })

        if (!response.ok) {
          router.replace('/landing')
          return
        }

        const data = await response.json()
        if (!data.success || !data.user) {
          router.replace('/landing')
          return
        }

        router.replace(data.user.role === 'admin' ? '/admin' : '/dashboard')
      } catch {
        router.replace('/landing')
      }
    }

    redirect()
  }, [router])

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-600 mx-auto mb-4"></div>
        <p className="text-description">Redirecionando...</p>
      </div>
    </div>
  )
}
