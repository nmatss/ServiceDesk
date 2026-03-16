'use client'

import { useState, useEffect } from 'react'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      // Delay showing to avoid layout shift
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleConsent = (type: 'all' | 'essential') => {
    localStorage.setItem('cookie-consent', type)
    setVisible(false)

    // Fire and forget — save to DB
    fetch('/api/privacy/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent_type: 'cookies', consent_value: type }),
      credentials: 'include',
    }).catch(() => {})
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 animate-fade-in">
      <div className="max-w-4xl mx-auto bg-white/95 dark:bg-neutral-800/95 backdrop-blur-xl rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              Uso de Cookies
            </h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Utilizamos cookies para melhorar sua experiencia. Ao continuar navegando, voce concorda com nossa{' '}
              <a href="/privacy" className="text-brand-600 dark:text-brand-400 hover:underline">
                Politica de Privacidade
              </a>.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => handleConsent('essential')}
              className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
            >
              Apenas Necessarios
            </button>
            <button
              onClick={() => handleConsent('all')}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-sm"
            >
              Aceitar Todos
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
