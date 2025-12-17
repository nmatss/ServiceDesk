'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ShieldExclamationIcon,
  HomeIcon,
  ArrowLeftIcon,
  LockClosedIcon,
  UserCircleIcon,
  EnvelopeIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

export default function Unauthorized() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<{ email?: string; role?: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Get error reason from URL params
  const reason = searchParams.get('reason') || 'insufficient_permissions'
  const requiredRole = searchParams.get('required_role')
  const resource = searchParams.get('resource')

  useEffect(() => {
    // Try to get current user info
    const checkUser = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.user) {
            setUser({
              email: data.user.email,
              role: data.user.role
            })
          }
        }
      } catch (error) {
        console.error('[Unauthorized] Failed to fetch user:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [])

  const getErrorMessage = () => {
    switch (reason) {
      case 'insufficient_permissions':
        return 'Você não tem permissão para acessar este recurso.'
      case 'role_mismatch':
        return `Este recurso requer a função de ${requiredRole || 'administrador'}.`
      case 'tenant_mismatch':
        return 'Você não tem acesso a esta organização.'
      case 'session_expired':
        return 'Sua sessão expirou. Por favor, faça login novamente.'
      default:
        return 'Acesso negado a este recurso.'
    }
  }

  const getRecommendations = () => {
    const recommendations = []

    if (reason === 'session_expired' || !user) {
      recommendations.push({
        icon: LockClosedIcon,
        title: 'Faça login novamente',
        description: 'Sua sessão pode ter expirado',
        action: 'Login',
        href: '/auth/login'
      })
    }

    if (user && reason === 'insufficient_permissions') {
      recommendations.push({
        icon: EnvelopeIcon,
        title: 'Solicitar Acesso',
        description: 'Entre em contato com o administrador',
        action: 'Solicitar',
        href: '/portal/create?type=access_request'
      })
    }

    recommendations.push({
      icon: HomeIcon,
      title: 'Voltar ao Dashboard',
      description: 'Retornar à página inicial',
      action: 'Dashboard',
      href: '/dashboard'
    })

    return recommendations
  }

  const recommendations = getRecommendations()

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-neutral-50 to-orange-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 flex items-center justify-center px-4 py-8">
      <div className="max-w-3xl w-full">
        {/* Main Error Card */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 dark:from-red-600 dark:to-orange-600 px-8 py-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center animate-pulse-soft">
                <ShieldExclamationIcon className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white text-center mb-2">
              Acesso Negado
            </h1>
            <h2 className="text-lg font-medium text-white/90 text-center">
              403 - Forbidden
            </h2>
          </div>

          {/* Content Section */}
          <div className="px-8 py-8">
            {/* Error Message */}
            <div className="text-center mb-8">
              <p className="text-neutral-600 dark:text-neutral-300 text-lg mb-4">
                {getErrorMessage()}
              </p>

              {resource && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg text-sm text-neutral-700 dark:text-neutral-300">
                  <LockClosedIcon className="w-4 h-4" />
                  <span>Recurso: <span className="font-mono font-semibold">{resource}</span></span>
                </div>
              )}
            </div>

            {/* User Info */}
            {!loading && user && (
              <div className="mb-8 p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600">
                <div className="flex items-center gap-3">
                  <UserCircleIcon className="w-6 h-6 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Conectado como:
                    </p>
                    <p className="text-base font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {user.email}
                    </p>
                    {user.role && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        Função: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                          {user.role}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <button
                onClick={() => router.back()}
                className="btn btn-secondary flex items-center justify-center gap-2 min-h-touch"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                Voltar
              </button>

              <Link
                href="/dashboard"
                className="btn btn-primary flex items-center justify-center gap-2 min-h-touch"
              >
                <HomeIcon className="w-5 h-5" />
                Ir para Dashboard
              </Link>
            </div>

            {/* Recommendations */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-8 mt-8">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-6 text-center">
                O que você pode fazer?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendations.map((rec, index) => {
                  const Icon = rec.icon
                  return (
                    <Link
                      key={index}
                      href={rec.href}
                      className="group p-5 rounded-lg border border-neutral-200 dark:border-neutral-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="p-3 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors mb-3">
                          <Icon className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {rec.title}
                        </h3>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                          {rec.description}
                        </p>
                        <div className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 group-hover:gap-2 transition-all">
                          {rec.action}
                          <ArrowRightIcon className="w-4 h-4" />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Help Section */}
            <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 text-center">
                Precisa de mais ajuda?
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link
                  href="/knowledge"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors"
                >
                  Base de Conhecimento
                </Link>
                <span className="text-neutral-300 dark:text-neutral-600">|</span>
                <Link
                  href="/portal/create"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors"
                >
                  Abrir Ticket de Suporte
                </Link>
                <span className="text-neutral-300 dark:text-neutral-600">|</span>
                <Link
                  href="/admin"
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline transition-colors"
                >
                  Área Administrativa
                </Link>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex gap-3">
                <ShieldExclamationIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
                    Aviso de Segurança
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Esta tentativa de acesso foi registrada. Se você acredita que deveria ter acesso a este recurso,
                    entre em contato com o administrador do sistema ou abra um ticket de suporte.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Código do erro: 403 - Acesso negado
          </p>
        </div>
      </div>
    </div>
  )
}
