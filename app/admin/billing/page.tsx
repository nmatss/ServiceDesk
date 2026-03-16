'use client'

import { useState, useEffect } from 'react'
import {
  CreditCardIcon,
  ArrowUpCircleIcon,
  ChartBarIcon,
  CheckIcon,
  UsersIcon,
  TicketIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

interface BillingStatus {
  plan: string
  status: string
  currentPeriodEnd: string | null
  usage: {
    users: number
    tickets: number
  }
}

const PLANS = [
  {
    name: 'Starter',
    price: 'Gratuito',
    period: '',
    priceId: null,
    features: [
      '3 usuarios',
      '100 tickets/mes',
      'Base de conhecimento',
      'Suporte por email',
    ],
    limits: { users: 3, tickets: 100 },
    highlight: false,
  },
  {
    name: 'Professional',
    price: 'R$ 109',
    period: '/mes',
    priceId: 'professional',
    features: [
      '15 usuarios',
      '1.000 tickets/mes',
      'IA & Copilot',
      'ESM',
      'SLA avancado',
      'Integracoes',
      'Suporte prioritario',
    ],
    limits: { users: 15, tickets: 1000 },
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'R$ 179',
    period: '/mes',
    priceId: 'enterprise',
    features: [
      'Usuarios ilimitados',
      'Tickets ilimitados',
      'Tudo do Professional',
      'SSO/SAML',
      'Audit log avancado',
      'SLA customizado',
      'Suporte dedicado',
    ],
    limits: { users: -1, tickets: -1 },
    highlight: false,
  },
]

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [managingPortal, setManagingPortal] = useState(false)

  useEffect(() => {
    fetchBillingStatus()
  }, [])

  const fetchBillingStatus = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch('/api/billing/status', { credentials: 'include' })
      if (!res.ok) {
        throw new Error('Erro ao carregar dados de faturamento')
      }
      const data = await res.json()
      setBilling(data.data || data)
    } catch (err) {
      setError('Nao foi possivel carregar as informacoes de faturamento. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (priceId: string) => {
    try {
      setUpgrading(priceId)
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId }),
      })
      if (!res.ok) {
        throw new Error('Erro ao iniciar checkout')
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Erro ao processar upgrade. Tente novamente.')
    } finally {
      setUpgrading(null)
    }
  }

  const handleManageSubscription = async () => {
    try {
      setManagingPortal(true)
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error('Erro ao abrir portal')
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Erro ao abrir portal de gerenciamento. Tente novamente.')
    } finally {
      setManagingPortal(false)
    }
  }

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit <= 0) return 0
    return Math.min(Math.round((current / limit) * 100), 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-brand-500'
  }

  const currentPlan = PLANS.find((p) => p.name.toLowerCase() === (billing?.plan || 'starter').toLowerCase()) || PLANS[0]

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumbs skeleton */}
          <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-6" />
          <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-8" />

          {/* Cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white dark:bg-neutral-800 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-4" />
                <div className="h-8 w-24 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Plan cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-neutral-800 rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700 h-80 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumbs */}
        <nav className="text-sm text-neutral-500 dark:text-neutral-400 mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>
              <a href="/admin" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                Admin
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-neutral-900 dark:text-neutral-50 font-medium">Faturamento</li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-3">
              <CreditCardIcon className="h-7 w-7 text-brand-600 dark:text-brand-400" />
              Faturamento e Planos
            </h1>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">
              Gerencie sua assinatura, veja o uso e compare planos.
            </p>
          </div>
          {billing && billing.plan !== 'starter' && (
            <button
              onClick={handleManageSubscription}
              disabled={managingPortal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <CreditCardIcon className="h-4 w-4" />
              {managingPortal ? 'Abrindo...' : 'Gerenciar Assinatura'}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3" role="alert">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              <button
                onClick={fetchBillingStatus}
                className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* Current Plan & Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Current Plan Card */}
          <div className="bg-white dark:bg-neutral-800/80 dark:backdrop-blur-xl rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Plano Atual
              </h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                billing?.status === 'active'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
              }`}>
                {billing?.status === 'active' ? 'Ativo' : billing?.status || 'Gratuito'}
              </span>
            </div>
            <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
              {currentPlan.name}
            </p>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              {currentPlan.price}{currentPlan.period}
            </p>
            {billing?.currentPeriodEnd && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-3">
                Proxima renovacao: {new Date(billing.currentPeriodEnd).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>

          {/* Usage Card */}
          <div className="bg-white dark:bg-neutral-800/80 dark:backdrop-blur-xl rounded-2xl p-6 border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ChartBarIcon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Uso Atual
              </h2>
            </div>

            {/* Users Usage */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <UsersIcon className="h-4 w-4" />
                  <span>Usuarios</span>
                </div>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {billing?.usage?.users || 0} / {currentPlan.limits.users === -1 ? 'Ilimitado' : currentPlan.limits.users}
                </span>
              </div>
              {currentPlan.limits.users > 0 && (
                <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getUsageColor(
                      getUsagePercentage(billing?.usage?.users || 0, currentPlan.limits.users)
                    )}`}
                    style={{ width: `${getUsagePercentage(billing?.usage?.users || 0, currentPlan.limits.users)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Tickets Usage */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <TicketIcon className="h-4 w-4" />
                  <span>Tickets este mes</span>
                </div>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {billing?.usage?.tickets || 0} / {currentPlan.limits.tickets === -1 ? 'Ilimitado' : currentPlan.limits.tickets.toLocaleString('pt-BR')}
                </span>
              </div>
              {currentPlan.limits.tickets > 0 && (
                <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getUsageColor(
                      getUsagePercentage(billing?.usage?.tickets || 0, currentPlan.limits.tickets)
                    )}`}
                    style={{ width: `${getUsagePercentage(billing?.usage?.tickets || 0, currentPlan.limits.tickets)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plan Comparison */}
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-6">
          Comparar Planos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {PLANS.map((plan) => {
            const isCurrent = plan.name.toLowerCase() === currentPlan.name.toLowerCase()
            const isDowngrade =
              PLANS.indexOf(plan) < PLANS.indexOf(currentPlan)

            return (
              <div
                key={plan.name}
                className={`relative bg-white dark:bg-neutral-800/80 dark:backdrop-blur-xl rounded-2xl border transition-shadow ${
                  plan.highlight
                    ? 'border-brand-500 dark:border-brand-400 shadow-lg shadow-brand-500/10'
                    : 'border-neutral-200 dark:border-neutral-700 shadow-sm'
                } ${isCurrent ? 'ring-2 ring-brand-500 dark:ring-brand-400' : ''}`}
              >
                {/* Popular badge */}
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-600 text-white shadow-sm">
                      Mais Popular
                    </span>
                  </div>
                )}

                <div className="p-6">
                  {/* Plan header */}
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                    {plan.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-neutral-900 dark:text-neutral-50">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-neutral-500 dark:text-neutral-400 text-sm">
                        {plan.period}
                      </span>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                        <CheckIcon className="h-4 w-4 text-brand-500 dark:text-brand-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Action button */}
                  <div className="mt-8">
                    {isCurrent ? (
                      <div className="w-full text-center py-2.5 text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 rounded-lg border border-brand-200 dark:border-brand-800">
                        Plano Atual
                      </div>
                    ) : isDowngrade ? (
                      <button
                        disabled
                        className="w-full py-2.5 text-sm font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded-lg cursor-not-allowed"
                      >
                        Downgrade
                      </button>
                    ) : plan.priceId ? (
                      <button
                        onClick={() => handleUpgrade(plan.priceId!)}
                        disabled={upgrading === plan.priceId}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                          plan.highlight
                            ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
                            : 'bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900'
                        }`}
                      >
                        <ArrowUpCircleIcon className="h-4 w-4" />
                        {upgrading === plan.priceId ? 'Processando...' : 'Fazer Upgrade'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ / Info */}
        <div className="bg-white dark:bg-neutral-800/80 dark:backdrop-blur-xl rounded-2xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 mb-4">
            Perguntas Frequentes
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                Como funciona a cobranca?
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                A cobranca e mensal e automatica via Stripe. Voce pode cancelar a qualquer momento pelo painel de gerenciamento.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                Posso trocar de plano a qualquer momento?
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Sim. Ao fazer upgrade, o valor sera ajustado proporcionalmente (pro-rata) ao periodo restante da assinatura atual.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                O que acontece se eu exceder os limites do plano?
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Voce recebera notificacoes ao atingir 80% e 100% do limite. Ao atingir o limite, novos tickets ou usuarios nao poderao ser criados ate o proximo ciclo ou upgrade de plano.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
