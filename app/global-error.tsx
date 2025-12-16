'use client'

/**
 * Global Error Boundary
 *
 * This is the root error boundary that catches errors not caught by other error boundaries.
 * It MUST be in the app directory and MUST define its own <html> and <body> tags.
 *
 * Use cases:
 * - Errors in root layout
 * - Critical application failures
 * - Errors before other error boundaries can catch them
 *
 * NOTE: This is a client component. Do NOT import server-only modules.
 * Using inline styles because CSS might not be available during critical errors.
 */

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log critical error to console
    console.error('[GlobalError] Critical error:', error)

    // Report error to monitoring service (if available)
    // Using dynamic import to avoid Edge Runtime issues
    const reportError = async () => {
      try {
        // Only import Sentry in the browser, not during SSR/Edge
        if (typeof window !== 'undefined') {
          const Sentry = await import('@sentry/nextjs')
          Sentry.captureException(error, {
            level: 'fatal',
            tags: {
              errorBoundary: 'global',
              critical: 'true',
            },
            contexts: {
              errorInfo: {
                digest: error.digest,
                message: error.message,
                name: error.name,
                stack: error.stack,
              },
            },
          })
        }
      } catch (e) {
        // Silently fail if Sentry is not available
        console.error('[GlobalError] Failed to report error:', e)
      }
    }

    reportError()
  }, [error])

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Erro Crítico - ServiceDesk</title>
      </head>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(to bottom, #f9fafb, #f3f4f6)',
            padding: '1rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div style={{ maxWidth: '28rem', width: '100%' }}>
            <div
              style={{
                background: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '2rem',
                textAlign: 'center',
              }}
            >
              {/* Icon */}
              <div
                style={{
                  marginBottom: '1.5rem',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    borderRadius: '50%',
                    background: '#fee2e2',
                    padding: '1rem',
                    width: '80px',
                    height: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="#dc2626"
                    style={{ width: '48px', height: '48px' }}
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
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#111827',
                  marginBottom: '0.5rem',
                }}
              >
                Erro Crítico
              </h1>

              {/* Description */}
              <p
                style={{
                  color: '#6b7280',
                  marginBottom: '1.5rem',
                  lineHeight: '1.5',
                }}
              >
                Ocorreu um erro crítico na aplicação. Nossa equipe foi notificada automaticamente. Por favor, tente recarregar a página.
              </p>

              {/* Error details (dev only) */}
              {process.env.NODE_ENV === 'development' && (
                <div
                  style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: '#fef2f2',
                    borderRadius: '0.5rem',
                    textAlign: 'left',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#991b1b',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Detalhes do erro (apenas desenvolvimento):
                  </p>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: '#b91c1c',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {error.message}
                  </p>
                  {error.digest && (
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: '#dc2626',
                      }}
                    >
                      Digest: {error.digest}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={reset}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1.5rem',
                    background: '#2563eb',
                    color: 'white',
                    fontWeight: '500',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#1d4ed8'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#2563eb'
                  }}
                >
                  Tentar novamente
                </button>

                <a
                  href="/"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.75rem 1.5rem',
                    background: '#f3f4f6',
                    color: '#111827',
                    fontWeight: '500',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#e5e7eb'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#f3f4f6'
                  }}
                >
                  Recarregar página
                </a>
              </div>

              {/* Support */}
              <p
                style={{
                  marginTop: '1.5rem',
                  fontSize: '0.875rem',
                  color: '#6b7280',
                }}
              >
                Se o problema persistir,{' '}
                <a
                  href="/portal"
                  style={{
                    color: '#2563eb',
                    fontWeight: '500',
                    textDecoration: 'none',
                  }}
                >
                  entre em contato com o suporte
                </a>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
