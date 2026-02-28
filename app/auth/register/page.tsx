'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { EyeIcon, EyeSlashIcon, LockClosedIcon, EnvelopeIcon, UserIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { customToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/Button'

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

    const loadingToast = customToast.loading('Criando conta...')

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

      customToast.dismiss(loadingToast)

      if (response.ok) {
        // SECURITY: Token is now stored in httpOnly cookies by the backend
        // Only store non-sensitive display data in localStorage for UX
        localStorage.setItem('user_name', data.user.name)
        localStorage.setItem('user_role', data.user.role)
        setStatusMessage('Conta criada com sucesso. Redirecionando...')
        customToast.success('Conta criada com sucesso!')
        setTimeout(() => {
          router.push('/dashboard')
        }, 500)
      } else {
        const errorMsg = data.error || 'Erro ao registrar'
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

  const passwordRequirements = [
    { text: 'Pelo menos 6 caracteres', met: password.length >= 6 },
    { text: 'Letra maiúscula', met: /[A-Z]/.test(password) },
    { text: 'Número', met: /\d/.test(password) },
  ]

  // Announce password strength to screen readers
  useEffect(() => {
    if (password) {
      const metCount = passwordRequirements.filter(req => req.met).length
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
    <div className="min-h-screen flex animate-fade-in">
      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="false">
        {passwordStrengthMessage}
      </div>

      {/* Left Side - Brand Panel */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden items-center justify-center" role="complementary" aria-label="Informações sobre o ServiceDesk">
        {/* Deep gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c1929] via-[#0f2847] to-[#1a1a2e]" />

        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-violet-500 blur-[100px]" />
          <div className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full bg-brand-500 blur-[80px]" />
          <div className="absolute top-2/3 right-1/2 w-32 h-32 rounded-full bg-brand-400 blur-[60px]" />
        </div>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />

        {/* Content */}
        <div className="relative z-10 text-center text-white px-12 max-w-lg">
          {/* Logo */}
          <div className="flex justify-center mb-8 animate-slide-up">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 shadow-2xl">
              <Image
                src="/favicon.svg"
                alt="ServiceDesk Logo"
                width={64}
                height={64}
                className="rounded-xl"
                priority
              />
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-3 animate-slide-up tracking-tight">
            Junte-se a nós
          </h2>
          <p className="text-lg text-blue-200 animate-slide-up mb-12" style={{ animationDelay: '0.1s' }}>
            Crie sua conta e comece a gerenciar seus tickets de forma profissional
          </p>

          {/* Feature list */}
          <div className="space-y-5 text-left">
            <div className="flex items-center animate-slide-up group" style={{ animationDelay: '0.2s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-colors shadow-lg">
                <svg className="w-6 h-6 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-semibold text-white">Rápido e Fácil</p>
                <p className="text-sm text-blue-200/80">Configure sua conta em minutos</p>
              </div>
            </div>

            <div className="flex items-center animate-slide-up group" style={{ animationDelay: '0.3s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-colors shadow-lg">
                <svg className="w-6 h-6 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-semibold text-white">Seguro</p>
                <p className="text-sm text-blue-200/80">Seus dados protegidos com criptografia</p>
              </div>
            </div>

            <div className="flex items-center animate-slide-up group" style={{ animationDelay: '0.4s' }}>
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-colors shadow-lg">
                <svg className="w-6 h-6 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-semibold text-white">Suporte 24/7</p>
                <p className="text-sm text-blue-200/80">Sempre disponível para ajudar</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 dark:from-neutral-900 dark:via-brand-950/20 dark:to-neutral-950" role="main">
        <div className="max-w-md w-full space-y-6 animate-slide-up">
          {/* Logo + Header */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 lg:hidden">
              <Image
                src="/favicon.svg"
                alt="ServiceDesk Logo"
                width={48}
                height={48}
                className="rounded-xl shadow-md"
                priority
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                Criar Conta
              </h1>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Preencha os dados para criar sua conta
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-neutral-800/80 dark:backdrop-blur-xl p-8 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 shadow-xl" aria-label="Formulário de criação de conta" noValidate>
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                  <UserIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
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
                  className="input pl-10 hover-lift"
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
                  <EnvelopeIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
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
                  className="input pl-10 hover-lift"
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
                  <LockClosedIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
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
                  className="input pl-10 pr-10 hover-lift"
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
                    <EyeSlashIcon className="h-5 w-5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400 transition-colors" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400 transition-colors" aria-hidden="true" />
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
                      <span className={req.met ? 'text-green-600 dark:text-green-400' : 'text-neutral-500 dark:text-neutral-400'}>
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
                  <LockClosedIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
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
                  className="input pl-10 pr-10 hover-lift"
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
                    <EyeSlashIcon className="h-5 w-5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400 transition-colors" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400 transition-colors" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4" role="alert" aria-live="assertive">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              loadingText="Criando conta..."
              className="hover-lift shadow-lg"
              aria-label="Criar conta"
            >
              Criar Conta
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-300 dark:border-neutral-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 rounded-full text-xs font-medium">
                Já tem uma conta?
              </span>
            </div>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              Fazer login &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
