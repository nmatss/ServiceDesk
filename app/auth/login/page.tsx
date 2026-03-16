'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current) }
  }, [])

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
        credentials: 'include'
      })

      const data = await response.json()

      customToast.dismiss(loadingToast)

      if (response.ok) {
        localStorage.setItem('user_name', data.user.name)
        localStorage.setItem('user_role', data.user.role)

        customToast.success(`Bem-vindo de volta, ${data.user.name}!`)
        setStatusMessage('Login realizado com sucesso. Redirecionando...')

        redirectTimerRef.current = setTimeout(() => {
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      {/* Left Side - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 lg:px-16 py-12 bg-neutral-50 dark:bg-neutral-900 relative overflow-hidden animate-fade-in" role="main">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-100/40 dark:bg-brand-900/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-100/30 dark:bg-violet-900/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="max-w-[420px] w-full relative z-10 animate-slide-up">
          {/* Logo + Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
                <Image
                  src="/favicon.svg"
                  alt="ServiceDesk Logo"
                  width={36}
                  height={36}
                  className="rounded-lg"
                  priority
                />
              </div>
              <div className="leading-none">
                <span className="font-bold text-lg text-neutral-900 dark:text-neutral-100 tracking-tight">ServiceDesk</span>
                <span className="text-[10px] font-semibold text-brand-500 block -mt-0.5 tracking-wider">PRO</span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
              Bem-vindo de volta
            </h1>
            <p className="mt-2 text-base text-neutral-500 dark:text-neutral-400">
              Entre com suas credenciais para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" aria-label="Formulario de login" noValidate>
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" aria-hidden="true">
                  <EnvelopeIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500 group-focus-within:text-brand-500 dark:group-focus-within:text-brand-400 transition-colors" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-label="Endereco de email"
                  aria-describedby="email-description"
                  aria-invalid={error ? 'true' : 'false'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full h-12 pl-11 pr-4 rounded-xl border bg-white dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-base transition-all duration-200 outline-none ${
                    error
                      ? 'border-red-300 dark:border-red-700 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:focus:border-brand-400 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                  placeholder="seu@email.com"
                />
                <span id="email-description" className="sr-only">Digite seu endereco de email para fazer login</span>
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Senha
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" aria-hidden="true">
                  <LockClosedIcon className="h-5 w-5 text-neutral-400 dark:text-neutral-500 group-focus-within:text-brand-500 dark:group-focus-within:text-brand-400 transition-colors" />
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
                  className={`w-full h-12 pl-11 pr-12 rounded-xl border bg-white dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-base transition-all duration-200 outline-none ${
                    error
                      ? 'border-red-300 dark:border-red-700 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-neutral-200 dark:border-neutral-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:focus:border-brand-400 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                  placeholder="••••••••"
                />
                <span id="password-description" className="sr-only">Digite sua senha para fazer login</span>
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center min-w-[44px] min-h-[44px] justify-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  aria-label="Lembrar de mim"
                  className="h-4 w-4 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                  Lembrar de mim
                </label>
              </div>
              <Link
                href="/auth/forgot-password"
                className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-xl p-4 animate-fade-in" role="alert" aria-live="assertive">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="h-5 w-5 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                rounded="xl"
                fullWidth
                loading={loading}
                loadingText="Entrando..."
                className="h-12 text-base font-semibold shadow-lg shadow-brand-600/20 dark:shadow-brand-500/10 hover:shadow-xl hover:shadow-brand-600/25"
                aria-label="Entrar no sistema"
              >
                Entrar
              </Button>
            </div>
          </form>

          {/* Divider + Register */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-700/60"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-neutral-50 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-500 text-xs font-medium">
                  Novo por aqui?
                </span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors group"
              >
                Criar nova conta
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-12 text-center text-xs text-neutral-400 dark:text-neutral-600">
            &copy; {new Date().getFullYear()} ServiceDesk. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right Side - Brand Showcase Panel */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden items-center justify-center" role="complementary" aria-label="Informacoes sobre o ServiceDesk">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1a2e] via-[#0e2444] to-[#141432]" />

        {/* Decorative blurred orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-[15%] left-[20%] w-80 h-80 rounded-full bg-brand-500/15 blur-[120px]" />
          <div className="absolute bottom-[20%] right-[15%] w-60 h-60 rounded-full bg-violet-500/15 blur-[100px]" />
          <div className="absolute top-[55%] left-[50%] w-40 h-40 rounded-full bg-brand-400/10 blur-[80px]" />
        </div>

        {/* Dot grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '28px 28px'
        }} />

        {/* Content */}
        <div className="relative z-10 text-white px-12 xl:px-16 max-w-xl w-full">
          {/* Logo badge */}
          <div className="mb-10 animate-slide-up">
            <div className="inline-flex p-3.5 rounded-2xl bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] shadow-2xl">
              <Image
                src="/favicon.svg"
                alt="ServiceDesk Logo"
                width={52}
                height={52}
                className="rounded-xl"
                priority
              />
            </div>
          </div>

          <h2 className="text-4xl xl:text-5xl font-bold mb-4 animate-slide-up tracking-tight leading-tight">
            Gerencie seu suporte com{' '}
            <span className="bg-gradient-to-r from-brand-300 to-brand-400 bg-clip-text text-transparent">
              eficiencia
            </span>
          </h2>
          <p className="text-lg text-brand-200/70 animate-slide-up mb-14 leading-relaxed max-w-md" style={{ animationDelay: '0.1s' }}>
            Plataforma completa para gestao de atendimento, tickets e equipes de suporte.
          </p>

          {/* Feature cards */}
          <div className="space-y-4">
            {[
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                ),
                title: 'Gerenciamento de Tickets',
                desc: 'Organize, priorize e resolva atendimentos com agilidade'
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                ),
                title: 'Analises em Tempo Real',
                desc: 'Dashboards e metricas para decisoes inteligentes'
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                ),
                title: 'Colaboracao em Equipe',
                desc: 'Fluxos de trabalho e comunicacao centralizados'
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.05] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.08] transition-colors animate-slide-up group"
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}
              >
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-brand-500/15 flex items-center justify-center border border-brand-400/10 group-hover:bg-brand-500/25 transition-colors">
                  <svg className="w-5 h-5 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {feature.icon}
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white/95 text-[15px]">{feature.title}</p>
                  <p className="text-sm text-brand-200/55 mt-0.5 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-12 pt-8 border-t border-white/[0.06] animate-slide-up" style={{ animationDelay: '0.5s' }}>
            {[
              { value: '99.9%', label: 'Disponibilidade' },
              { value: '117', label: 'Modulos' },
              { value: '<2s', label: 'Tempo de resposta' }
            ].map((stat, i) => (
              <div key={i} className="text-center flex-1">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-brand-200/50 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
