'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon, LockClosedIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

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

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('user_role', data.user.role)
        localStorage.setItem('user_id', data.user.id)

        setStatusMessage('Login realizado com sucesso. Redirecionando...')
        setTimeout(() => {
          router.push('/')
        }, 500)
      } else {
        const errorMsg = data.error || 'Erro ao fazer login'
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

  return (
    <div className="min-h-screen bg-white flex">
      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8" role="main">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Bem-vindo de volta
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Faça login para acessar sua conta
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-6" aria-label="Formulário de login" noValidate>
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
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
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="seu@email.com"
                />
                <span id="email-description" className="sr-only">Digite seu endereço de email para fazer login</span>
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" aria-hidden="true">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
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
                  className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Lembrar de mim
                </label>
              </div>
              <Link href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">
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
            <button
              type="submit"
              disabled={loading}
              aria-label="Entrar no sistema"
              aria-busy={loading}
              className="w-full flex justify-center items-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </div>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Novo por aqui?</span>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <Link
              href="/auth/register"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Criar nova conta →
            </Link>
          </div>

          {/* Test Credentials */}
          <div className="text-center bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-600">
              <strong className="text-gray-900">Teste:</strong> teste@servicedesk.com<br/>
              <strong className="text-gray-900">Senha:</strong> 123456
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Blue Background */}
      <div className="hidden lg:flex lg:flex-1 bg-blue-600 items-center justify-center" role="complementary" aria-label="Informações sobre o ServiceDesk">
        <div className="text-center text-white px-12">
          <h2 className="text-5xl font-bold mb-4">ServiceDesk</h2>
          <p className="text-xl text-blue-100">
            Sistema profissional de gestão de atendimento
          </p>
          <div className="mt-12 space-y-4">
            <div className="flex items-center text-left">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Gerenciamento de Tickets</p>
                <p className="text-sm text-blue-100">Organize e priorize atendimentos</p>
              </div>
            </div>
            <div className="flex items-center text-left">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Análises e Relatórios</p>
                <p className="text-sm text-blue-100">Acompanhe métricas em tempo real</p>
              </div>
            </div>
            <div className="flex items-center text-left">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="font-medium">Colaboração em Equipe</p>
                <p className="text-sm text-blue-100">Trabalhe junto com sua equipe</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
