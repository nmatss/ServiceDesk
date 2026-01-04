'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import { ThemeProvider } from '@/src/contexts/ThemeContext'
import { NotificationProvider } from '@/src/components/notifications/NotificationProvider'

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

// Routes that have their own layout (admin section)
const customLayoutRoutes = ['/admin']

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
  const [hasCustomLayout, setHasCustomLayout] = useState(false)

  // Check if current route is an auth page or has custom layout
  useEffect(() => {
    setIsAuthPage(authRoutes.includes(pathname))
    setHasCustomLayout(customLayoutRoutes.some(route => pathname.startsWith(route)))
  }, [pathname])

  // Authentication check using httpOnly cookies
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verify auth using httpOnly cookies
        const response = await fetch('/api/auth/verify', {
          credentials: 'include'
        })

        if (response.ok) {
          const responseData = await response.json()
          if (responseData.success && responseData.user) {
            setUser({
              id: responseData.user.id,
              name: responseData.user.name,
              email: responseData.user.email,
              role: responseData.user.role as 'admin' | 'agent' | 'user'
            })
          } else if (!publicRoutes.includes(pathname)) {
            router.push('/auth/login')
          }
        } else {
          if (!publicRoutes.includes(pathname)) {
            router.push('/auth/login')
          }
        }
      } catch (error) {
        console.error('[AppLayout] Auth check failed:', error)
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
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 loading-spinner mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            ServiceDesk
          </h2>
          <p className="text-description">
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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0c] bg-pattern">
      {/* Sidebar - Single Source of Truth */}
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        userRole={user?.role || 'user'}
      />

      {/* Main content area */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
        {/* Header - Single Source of Truth */}
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
              <div className="text-sm text-description">
                © 2024 ServiceDesk Pro. Todos os direitos reservados.
              </div>
              <nav className="flex items-center space-x-4 mt-2 sm:mt-0" aria-label="Links do rodapé">
                <a
                  href="/knowledge"
                  className="text-sm text-description hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  aria-label="Ir para base de conhecimento"
                >
                  Documentação
                </a>
                <a
                  href="/portal/create"
                  className="text-sm text-description hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  aria-label="Abrir novo ticket de suporte"
                >
                  Suporte
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

  override componentDidCatch(error: Error, errorInfo: any) {
    console.error('[AppLayout] Layout error:', error, errorInfo)
  }

  override render() {
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
              <p className="text-description mb-4">
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
      const checkAuth = async () => {
        try {
          // Verify auth using httpOnly cookies
          const response = await fetch('/api/auth/verify', {
            credentials: 'include'
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

          const userRole = data.user.role as 'admin' | 'agent' | 'user'

          if (allowedRoles && !allowedRoles.includes(userRole)) {
            router.push('/unauthorized')
            return
          }

          setIsAuthorized(true)
        } catch (error) {
          console.error('[withAuth] Auth check failed:', error)
          router.push('/auth/login')
        } finally {
          setLoading(false)
        }
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