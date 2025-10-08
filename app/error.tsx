'use client'

/**
 * Error Boundary for App Router
 *
 * This component catches errors in the application and provides a fallback UI.
 * It automatically reports errors to Sentry.
 *
 * Triggered by:
 * - Errors thrown in components
 * - Errors in event handlers
 * - Errors in useEffect
 * - Errors in Server Components (passed to nearest error boundary)
 */

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { logger } from '@/lib/monitoring/logger';

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to Sentry
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

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      logger.error('App Error Boundary', error)
    }
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4">
              <ExclamationTriangleIcon className="h-12 w-12 text-red-600 dark:text-red-400" />
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
              href="/suporte"
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
