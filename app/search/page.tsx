'use client'

import { useRequireAuth } from '@/lib/hooks/useRequireAuth'
import AdvancedSearch from '@/src/components/search/AdvancedSearch'

export default function SearchPage() {
  const { loading } = useRequireAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <p className="text-description">Carregando busca...</p>
        </div>
      </div>
    )
  }

  return <AdvancedSearch />
}
