'use client'

/**
 * Error Boundary for App Router
 *
 * This component catches errors in the application and provides a fallback UI.
 *
 * Triggered by:
 * - Errors thrown in components
 * - Errors in event handlers
 * - Errors in useEffect
 * - Errors in Server Components (passed to nearest error boundary)
 *
 * NOTE: This is a client component. Do NOT import server-only modules.
 */

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] App Error:', error)
    }

    // Report error to monitoring service (if available)
    // Using dynamic import to avoid Edge Runtime issues
    const reportError = async () => {
      try {
        // Only import Sentry in the browser, not during SSR/Edge
        if (typeof window !== 'undefined') {
          const Sentry = await import('@sentry/nextjs')
          Sentry.captureException(error, {
            tags: {
              errorBoundary: 'app',
            },
            contexts: {
              errorInfo: {
                digest: error.digest,
                message: error.message,
                name: error.name,
              },
            },
          })
        }
      } catch (e) {
        // Silently fail if Sentry is not available
        console.error('[ErrorBoundary] Failed to report error:', e)
      }
    }

    reportError()
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-12 w-12 text-red-600 dark:text-red-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Algo deu errado
          </h1>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Ocorreu um erro inesperado. Nossa equipe foi notificada automaticamente e estamos trabalhando para resolver o problema.
          </p>

          {/* Error details (dev only) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg text-left">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                Detalhes do erro (apenas desenvolvimento):
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 font-mono break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm"
            >
              Tentar novamente
            </button>

            <a
              href="/"
              className="block w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors duration-200"
            >
              Voltar para o início
            </a>
          </div>

          {/* Support link */}
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            Precisa de ajuda?{' '}
            <a
              href="/portal"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Entre em contato com o suporte
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
