'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon, LockClosedIcon, EnvelopeIcon, UserIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [passwordStrengthMessage, setPasswordStrengthMessage] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      setLoading(false)
      return
    }

    try {
      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Enable cookies
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        // SECURITY: Token is now stored in httpOnly cookies by the backend
        // Only store non-sensitive display data in localStorage for UX
        localStorage.setItem('user_name', data.user.name)
        localStorage.setItem('user_role', data.user.role)
        setStatusMessage('Conta criada com sucesso. Redirecionando...')
        setTimeout(() => {
          router.push('/dashboard')
        }, 500)
      } else {
        const errorMsg = data.error || 'Erro ao registrar'
        setError(errorMsg)
        setStatusMessage(`Erro: ${errorMsg}`)
      }
    } catch (err) {
      const errorMsg = 'Erro de rede ou servidor'
      setError(errorMsg)
      setStatusMessage(`Erro: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const passwordRequirements = [
    { text: 'Pelo menos 6 caracteres', met: password.length >= 6 },
    { text: 'Letra maiúscula', met: /[A-Z]/.test(password) },
    { text: 'Número', met: /\d/.test(password) },
  ]

  // Check if all requirements are met
  // const allRequirementsMet = passwordRequirements.every(req => req.met)

  // Announce password strength to screen readers
  useEffect(() => {
    if (password) {
      const metCount = passwordRequirements.filter(req => req.met).length
      // const total = passwordRequirements.length
      if (metCount === 0) {
        setPasswordStrengthMessage('Senha muito fraca')
      } else if (metCount === 1) {
        setPasswordStrengthMessage('Senha fraca. 1 de 3 requisitos atendidos')
      } else if (metCount === 2) {
        setPasswordStrengthMessage('Senha média. 2 de 3 requisitos atendidos')
      } else {
        setPasswordStrengthMessage('Senha forte. Todos os 3 requisitos atendidos')
      }
    } else {
      setPasswordStrengthMessage('')
    }
  }, [password])

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-brand-50/30 to-neutral-100 dark:from-neutral-900 dark:via-brand-950/20 dark:to-neutral-950 flex animate-fade-in">
      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="false">
        {passwordStrengthMessage}
      </div>

      {/* Left Side - Brand Background */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 dark:from-brand-700 dark:via-brand-800 dark:to-brand-900 items-center justify-center animate-fade-in" role="complementary" aria-label="Informações sobre o ServiceDesk">
        <div className="text-center text-white px-12">
          <h2 className="text-5xl font-bold mb-4 animate-slide-up">Junte-se a nós</h2>
          <p className="text-xl text-brand-100 dark:text-brand-200 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Crie sua conta e comece a gerenciar seus tickets de forma profissional
          </p>
          <div className="mt-12 space-y-4">
            <div className="flex items-center text-left animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-brand-500 dark:bg-brand-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Rápido e Fácil</p>
                <p className="text-sm text-brand-100 dark:text-brand-200">Configure sua conta em minutos</p>
              </div>
            </div>
            <div className="flex items-center text-left animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-brand-500 dark:bg-brand-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Seguro</p>
                <p className="text-sm text-brand-100 dark:text-brand-200">Seus dados protegidos</p>
              </div>
            </div>
            <div className="flex items-center text-left animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-brand-500 dark:bg-brand-600 rounded-lg flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Suporte 24/7</p>
                <p className="text-sm text-brand-100 dark:text-brand-200">Sempre disponível para ajudar</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8" role="main">
        <div className="max-w-md w-full space-y-8 animate-slide-up">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
              Criar Conta
            </h1>
            <p className="mt-2 text-sm text-description">
              Preencha os dados para criar sua conta
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5 glass-panel p-8 rounded-xl" aria-label="Formulário de criação de conta" noValidate>
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                  <UserIcon className="h-5 w-5 text-icon-muted" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  aria-required="true"
                  aria-label="Nome completo"
                  aria-describedby="name-description"
                  aria-invalid={error ? 'true' : 'false'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 focus:border-transparent transition-shadow"
                  placeholder="Seu nome completo"
                />
                <span id="name-description" className="sr-only">Digite seu nome completo para criar a conta</span>
              </div>
            </div>

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
                  className="block w-full pl-10 pr-3 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 focus:border-transparent transition-shadow"
                  placeholder="seu@email.com"
                />
                <span id="email-description" className="sr-only">Digite um endereço de email válido</span>
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
                  autoComplete="new-password"
                  required
                  aria-required="true"
                  aria-label="Senha"
                  aria-describedby="password-requirements"
                  aria-invalid={error ? 'true' : 'false'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 focus:border-transparent transition-shadow"
                  placeholder="••••••••"
                />
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
              {password && (
                <div className="mt-2 space-y-1" id="password-requirements">
                  <p className="sr-only" role="status" aria-live="polite">
                    {passwordStrengthMessage}
                  </p>
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center text-xs">
                      <CheckCircleIcon className={`h-4 w-4 mr-1 ${req.met ? 'text-green-500 dark:text-green-400' : 'text-neutral-300 dark:text-neutral-600'}`} aria-hidden="true" />
                      <span className={req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-content'}>
                        {req.text}
                        <span className="sr-only">{req.met ? ' - atendido' : ' - não atendido'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                  <LockClosedIcon className="h-5 w-5 text-icon-muted" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  aria-required="true"
                  aria-label="Confirmar senha"
                  aria-describedby="confirm-password-description"
                  aria-invalid={error ? 'true' : 'false'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 focus:border-transparent transition-shadow"
                  placeholder="••••••••"
                />
                <span id="confirm-password-description" className="sr-only">Digite a senha novamente para confirmação</span>
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-icon-muted hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-icon-muted hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert" aria-live="assertive">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              aria-label="Criar conta"
              aria-busy={loading}
              className="w-full flex justify-center items-center py-3 px-4 bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-600 dark:focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-600/20 dark:shadow-brand-500/20"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Criando conta...
                </div>
              ) : (
                'Criar Conta'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-300 dark:border-neutral-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gradient-to-br from-neutral-50 via-brand-50/30 to-neutral-100 dark:from-neutral-900 dark:via-brand-950/20 dark:to-neutral-950 text-muted-content">Já tem uma conta?</span>
            </div>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              Fazer login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
