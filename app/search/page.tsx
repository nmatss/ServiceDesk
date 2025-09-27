'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdvancedSearch from '@/src/components/search/AdvancedSearch'

export default function SearchPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')

    if (!token) {
      router.push('/auth/login')
      return
    }

    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Carregando busca...</p>
        </div>
      </div>
    )
  }

  return <AdvancedSearch />
}