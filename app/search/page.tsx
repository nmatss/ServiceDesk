'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdvancedSearch from '@/src/components/search/AdvancedSearch'

export default function SearchPage() {
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
          <p className="text-description">Carregando busca...</p>
        </div>
      </div>
    )
  }

  return <AdvancedSearch />
}