'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon, LockClosedIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import { customToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const loadingToast = customToast.loading('Autenticando...')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // SECURITY: Enable cookies
      })

      const data = await response.json()

      customToast.dismiss(loadingToast)

      if (response.ok) {
        // SECURITY: Token is now stored in httpOnly cookies by the backend
        // Only store non-sensitive display data in localStorage for UX
        localStorage.setItem('user_name', data.user.name)
        localStorage.setItem('user_role', data.user.role)

        customToast.success(`Bem-vindo de volta, ${data.user.name}!`)
        setStatusMessage('Login realizado com sucesso. Redirecionando...')

        setTimeout(() => {
          // Redirect based on user role
          const role = data.user.role
          if (role === 'admin' || role === 'super_admin' || role === 'tenant_admin') {
            router.push('/admin')
          } else if (role === 'agent' || role === 'team_manager') {
            router.push('/dashboard')
          } else {
            router.push('/portal/tickets')
          }
        }, 800)
      } else {
        const errorMsg = data.error || 'Erro ao fazer login'
        setError(errorMsg)
        setStatusMessage(`Erro: ${errorMsg}`)
        customToast.error(errorMsg)
      }
    } catch (err) {
      customToast.dismiss(loadingToast)
      const errorMsg = 'Erro de rede ou servidor'
      setError(errorMsg)
      setStatusMessage(`Erro: ${errorMsg}`)
      customToast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-brand-50/30 to-neutral-100 dark:from-neutral-900 dark:via-brand-950/20 dark:to-neutral-950 flex animate-fade-in">
      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8" role="main">
        <div className="max-w-md w-full space-y-8 animate-slide-up">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
              Bem-vindo de volta
            </h1>
            <p className="mt-2 text-sm text-description">
              Faça login para acessar sua conta
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 glass-panel p-8 rounded-xl" aria-label="Formulário de login" noValidate>
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                  <EnvelopeIcon className="h-5 w-5 text-icon-muted" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-label="Endereço de email"
                  aria-describedby="email-description"
                  aria-invalid={error ? 'true' : 'false'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`input pl-10 hover-lift ${error ? 'input-error' : ''}`}
                  placeholder="seu@email.com"
                />
                <span id="email-description" className="sr-only">Digite seu endereço de email para fazer login</span>
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                  <LockClosedIcon className="h-5 w-5 text-icon-muted" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  aria-label="Senha"
                  aria-describedby="password-description"
                  aria-invalid={error ? 'true' : 'false'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`input pl-10 pr-10 hover-lift ${error ? 'input-error' : ''}`}
                  placeholder="••••••••"
                />
                <span id="password-description" className="sr-only">Digite sua senha para fazer login</span>
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-icon-muted hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-icon-muted hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  aria-label="Lembrar de mim"
                  className="h-4 w-4 text-brand-600 focus:ring-brand-600 border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral-700 dark:text-neutral-300">
                  Lembrar de mim
                </label>
              </div>
              <Link href="#" className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                Esqueceu a senha?
              </Link>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert" aria-live="assertive">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              loadingText="Entrando..."
              className="hover-lift shadow-lg"
              aria-label="Entrar no sistema"
            >
              Entrar
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-300 dark:border-neutral-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gradient-to-br from-neutral-50 via-brand-50/30 to-neutral-100 dark:from-neutral-900 dark:via-brand-950/20 dark:to-neutral-950 text-muted-content">Novo por aqui?</span>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <Link
              href="/auth/register"
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              Criar nova conta →
            </Link>
          </div>

          {/* Test Credentials - Only shown in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-center bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
              <p className="text-xs text-description mb-2">
                <strong className="text-neutral-900 dark:text-neutral-100">Admin:</strong> admin@servicedesk.com<br/>
                <strong className="text-neutral-900 dark:text-neutral-100">Senha:</strong> 123456
              </p>
              <p className="text-xs text-description">
                <strong className="text-neutral-900 dark:text-neutral-100">Usuário:</strong> teste@servicedesk.com<br/>
                <strong className="text-neutral-900 dark:text-neutral-100">Senha:</strong> 123456
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Brand Background */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 dark:from-brand-700 dark:via-brand-800 dark:to-brand-900 items-center justify-center animate-fade-in" role="complementary" aria-label="Informações sobre o ServiceDesk">
        <div className="text-center text-white px-12">
          <h2 className="text-5xl font-bold mb-4 animate-slide-up">ServiceDesk</h2>
          <p className="text-xl text-brand-100 dark:text-brand-200 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Sistema profissional de gestão de atendimento
          </p>
          <div className="mt-12 space-y-4">
            <div className="flex items-center text-left animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-brand-500 dark:bg-brand-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Gerenciamento de Tickets</p>
                <p className="text-sm text-brand-100 dark:text-brand-200">Organize e priorize atendimentos</p>
              </div>
            </div>
            <div className="flex items-center text-left animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-brand-500 dark:bg-brand-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Análises e Relatórios</p>
                <p className="text-sm text-brand-100 dark:text-brand-200">Acompanhe métricas em tempo real</p>
              </div>
            </div>
            <div className="flex items-center text-left animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-brand-500 dark:bg-brand-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Colaboração em Equipe</p>
                <p className="text-sm text-brand-100 dark:text-brand-200">Trabalhe junto com sua equipe</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
