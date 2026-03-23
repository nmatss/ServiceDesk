'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCachedAuth } from '@/lib/hooks/useRequireAuth'
import LandingClient from './landing/landing-client'

export default function HomePage() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const redirect = async () => {
      // Check global auth cache first
      const cached = getCachedAuth()
      if (cached) {
        const role = cached.user?.role
        router.replace(role === 'admin' || role === 'super_admin' || role === 'tenant_admin' ? '/admin' : '/dashboard')
        return
      }

      // Fallback: verify with API
      try {
        const response = await fetch('/api/auth/verify', { credentials: 'include' })
        if (!response.ok) { setChecked(true); return }
        const data = await response.json()
        if (!data.success || !data.user) { setChecked(true); return }
        router.replace(data.user.role === 'admin' ? '/admin' : '/dashboard')
      } catch {
        setChecked(true)
      }
    }

    redirect()
  }, [router])

  // Show loading while checking auth
  if (!checked) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-neutral-200 dark:border-neutral-700 border-t-brand-600 mx-auto mb-4"></div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando...</p>
        </div>
      </div>
    )
  }

  // Show the proper landing page for unauthenticated users
  return <LandingClient />
}
