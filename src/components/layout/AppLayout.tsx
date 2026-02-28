'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import { ThemeProvider } from '@/src/contexts/ThemeContext'
import { NotificationProvider } from '@/src/components/notifications/NotificationProvider'
import { populateAuthCache } from '@/lib/hooks/useRequireAuth'

interface AppLayoutProps {
  children: React.ReactNode
}

interface User {
  id: number
  name: string
  email: string
  role: 'super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user'
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
      <AppLayoutContent>{children}</AppLayoutContent>
    </ThemeProvider>
  )
}

function AppLayoutContent({ children }: AppLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const lastAuthCheckRef = useRef<number>(0)
  // Track whether the user explicitly toggled the sidebar (vs auto behavior)
  const userToggledRef = useRef(false)

  // Wrap setSidebarOpen so Header/Sidebar toggle buttons mark it as user-explicit
  const handleUserToggleSidebar = useCallback((value: boolean) => {
    userToggledRef.current = true
    // Persist preference on desktop
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      try { localStorage.setItem('sidebar-open', String(value)) } catch {}
    }
    setSidebarOpen(value)
  }, [])

  // PERF: Derived values — no state + useEffect needed
  const isAuthPage = useMemo(() => authRoutes.includes(pathname), [pathname])
  const hasCustomLayout = useMemo(() => customLayoutRoutes.some(route => pathname.startsWith(route)), [pathname])
  const isPublicRoute = useMemo(() => publicRoutes.includes(pathname), [pathname])

  // PERF: Auth check with 30s cooldown — catches expired sessions on navigation
  // without calling /api/auth/verify on every single route change.
  const AUTH_CHECK_COOLDOWN_MS = 30_000
  useEffect(() => {
    const checkAuth = async () => {
      if (isPublicRoute || isAuthPage) {
        setLoading(false)
        return
      }

      const now = Date.now()
      const timeSinceLastCheck = now - lastAuthCheckRef.current
      if (lastAuthCheckRef.current > 0 && timeSinceLastCheck < AUTH_CHECK_COOLDOWN_MS) {
        // Skip — last check was recent enough
        return
      }

      try {
        const response = await fetch('/api/auth/verify', {
          credentials: 'include'
        })

        if (response.ok) {
          const responseData = await response.json()
          if (responseData.success && responseData.user) {
            lastAuthCheckRef.current = Date.now()
            const authUser = {
              id: responseData.user.id,
              name: responseData.user.name,
              email: responseData.user.email,
              role: responseData.user.role as 'super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user'
            }
            setUser(authUser)
            // Populate global auth cache so useRequireAuth() on page components
            // can skip redundant /api/auth/verify calls
            populateAuthCache(
              { ...authUser, tenant_id: responseData.user.tenant_id || 0 },
              responseData.tenant || null
            )
          } else {
            router.push('/auth/login')
          }
        } else {
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('[AppLayout] Auth check failed:', error)
        router.push('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router])

  // Keep a ref to router so the 401 interceptor doesn't reinstall on every router change
  const routerRef = useRef(router)
  routerRef.current = router

  // Global 401 interceptor — redirects to login when any API call returns 401.
  // Covers all pages automatically without needing per-page 401 handling.
  useEffect(() => {
    if (isAuthPage || isPublicRoute) return

    const originalFetch = window.fetch
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args)
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : ''
      if (response.status === 401 && url.startsWith('/api/') && !url.includes('/api/auth/')) {
        // Session expired — redirect to login
        lastAuthCheckRef.current = 0
        routerRef.current.push('/auth/login')
      }
      return response
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [isAuthPage, isPublicRoute])

  // Auto-close sidebar on mobile when route changes (desktop keeps user preference)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }, [pathname])

  // PERF: Debounced resize handler — respects user's explicit sidebar preference on desktop
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (window.innerWidth >= 1024) {
          // Desktop: only auto-open if user hasn't explicitly toggled
          if (!userToggledRef.current) {
            setSidebarOpen(true)
          }
        } else {
          // Mobile: always close on resize to mobile
          setSidebarOpen(false)
          userToggledRef.current = false
        }
      }, 150)
    }
    // Initial check: load user preference from localStorage, fallback to open on desktop
    if (window.innerWidth >= 1024) {
      try {
        const saved = localStorage.getItem('sidebar-open')
        if (saved !== null) {
          setSidebarOpen(saved === 'true')
          userToggledRef.current = true
        } else {
          setSidebarOpen(true)
        }
      } catch {
        setSidebarOpen(true)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
    }
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
    <NotificationProvider>
      <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0c] bg-pattern">
        {/* Sidebar - Single Source of Truth */}
        <Sidebar
          open={sidebarOpen}
          setOpen={handleUserToggleSidebar}
          userRole={user?.role || 'user'}
        />

        {/* Main content area */}
        <div className={`flex flex-col min-h-screen transition-[padding] duration-150 ease-out ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'}`}>
          {/* Header - Single Source of Truth */}
          <Header
            sidebarOpen={sidebarOpen}
            setSidebarOpen={handleUserToggleSidebar}
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
    </NotificationProvider>
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
  allowedRoles?: ('super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user')[]
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

          const userRole = data.user.role as 'super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user'

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
