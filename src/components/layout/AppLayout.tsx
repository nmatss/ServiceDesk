'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import { ThemeProvider } from '@/src/contexts/ThemeContext'
import { NotificationProvider } from '@/src/components/notifications/NotificationProvider'
import { logger } from '@/lib/monitoring/logger';

interface AppLayoutProps {
  children: React.ReactNode
}

interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'agent' | 'user'
}

// Public routes that don't require authentication
const publicRoutes = ['/landing', '/auth/login', '/auth/register', '/auth/forgot-password']

// Routes that don't need the full layout (auth pages and landing)
const authRoutes = ['/landing', '/auth/login', '/auth/register', '/auth/forgot-password']

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AppLayoutContent>{children}</AppLayoutContent>
      </NotificationProvider>
    </ThemeProvider>
  )
}

function AppLayoutContent({ children }: AppLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthPage, setIsAuthPage] = useState(false)

  // Check if current route is an auth page
  useEffect(() => {
    setIsAuthPage(authRoutes.includes(pathname))
  }, [pathname])

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        const userId = localStorage.getItem('user_id')
        const userRole = localStorage.getItem('user_role') as 'admin' | 'agent' | 'user'
        const userName = localStorage.getItem('user_name')

        // If no token and not on public route, redirect to login
        if (!token && !publicRoutes.includes(pathname)) {
          router.push('/auth/login')
          return
        }

        // If token exists, verify it
        if (token && userId && userRole && userName) {
          // Verify token with server
          const response = await fetch('/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            const userData = await response.json()
            setUser({
              id: parseInt(userId),
              name: userName,
              email: userData.email || '',
              role: userRole
            })

            // Redirect to appropriate dashboard based on role
            if (pathname === '/' || pathname === '/auth/login') {
              if (userRole === 'admin') {
                router.push('/admin')
              } else {
                router.push('/dashboard')
              }
            }
          } else {
            // Token is invalid, clear storage and redirect to login
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user_id')
            localStorage.removeItem('user_role')
            localStorage.removeItem('user_name')

            if (!publicRoutes.includes(pathname)) {
              router.push('/auth/login')
            }
          }
        }
      } catch (error) {
        logger.error('Auth check failed', error)

        // Clear potentially corrupted auth data
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_role')
        localStorage.removeItem('user_name')

        if (!publicRoutes.includes(pathname)) {
          router.push('/auth/login')
        }
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [pathname, router])

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    // Set initial state
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            ServiceDesk
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Carregando...
          </p>
        </div>
      </div>
    )
  }

  // Auth pages don't need the full layout
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {children}
      </div>
    )
  }

  // Main application layout
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        userRole={user?.role || 'user'}
      />

      {/* Main content area */}
      <div className="flex flex-col min-h-screen lg:pl-0">
        {/* Header */}
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user || undefined}
        />

        {/* Page content */}
        <main
          id="main-content"
          className="flex-1 relative"
          role="main"
          aria-label="Conteúdo principal"
        >
          <div className="container-responsive py-6">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer
          className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 py-4"
          role="contentinfo"
          aria-label="Rodapé"
        >
          <div className="container-responsive">
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                © 2024 ServiceDesk Pro. Todos os direitos reservados.
              </div>
              <nav className="flex items-center space-x-4 mt-2 sm:mt-0" aria-label="Links do rodapé">
                <a
                  href="/docs"
                  className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  aria-label="Ir para documentação"
                >
                  Documentação
                </a>
                <a
                  href="/support"
                  className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  aria-label="Ir para suporte"
                >
                  Suporte
                </a>
                <a
                  href="/privacy"
                  className="text-sm text-neutral-600 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  aria-label="Ir para política de privacidade"
                >
                  Privacidade
                </a>
              </nav>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

// Error boundary component
export class AppLayoutErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    logger.error('Layout error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-error-100 dark:bg-error-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5C3.498 20.333 4.46 22 6 22z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Algo deu errado
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                Ocorreu um erro inesperado. Tente recarregar a página.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}

// HOC for pages that need authentication
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles?: ('admin' | 'agent' | 'user')[]
) {
  return function AuthenticatedComponent(props: P) {
    const router = useRouter()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      const checkAuth = () => {
        const token = localStorage.getItem('auth_token')
        const userRole = localStorage.getItem('user_role') as 'admin' | 'agent' | 'user'

        if (!token) {
          router.push('/auth/login')
          return
        }

        if (allowedRoles && !allowedRoles.includes(userRole)) {
          router.push('/unauthorized')
          return
        }

        setIsAuthorized(true)
        setLoading(false)
      }

      checkAuth()
    }, [router])

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-16 h-16 loading-spinner"></div>
        </div>
      )
    }

    if (!isAuthorized) {
      return null
    }

    return <Component {...props} />
  }
}