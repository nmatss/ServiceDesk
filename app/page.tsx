'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const role = localStorage.getItem('user_role')

    if (!token) {
      // Se não autenticado, redirecionar para landing
      router.push('/landing')
      return
    }

    // Se autenticado, redirecionar para dashboard apropriado
    if (role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
  }, [router])

  // Loading screen enquanto redireciona
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-600 mx-auto mb-4"></div>
        <p className="text-neutral-600 dark:text-neutral-400">Redirecionando...</p>
      </div>
    </div>
  )
}