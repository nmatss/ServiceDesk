'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BuildingOffice2Icon,
  UserGroupIcon,
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard'

interface DashboardStats {
  total_orgs: number
  active_orgs: number
  total_users: number
  total_tickets: number
  open_tickets: number
  tickets_last_30_days: number
}

interface RecentOrg {
  id: number
  name: string
  slug: string
  subscription_plan: string
  subscription_status: string
  is_active: number | boolean
  created_at: string
  user_count: number
}

interface Alert {
  type: 'warning' | 'error' | 'info'
  title: string
  message: string
}

interface DashboardData {
  stats: DashboardStats
  recent_orgs: RecentOrg[]
  alerts: Alert[]
}

export default function SuperAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/admin/super/dashboard', {
          credentials: 'include',
        })
        if (!res.ok) {
          throw new Error('Falha ao carregar dados do dashboard')
        }
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        } else {
          throw new Error(json.error || 'Erro desconhecido')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (error) {
    return (
      <div className="p-8">
        <PageHeader
          title="Super Admin"
          description="Painel de administração do sistema"
          icon={ShieldCheckIcon}
        />
        <div className="mt-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
          <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-red-500 dark:text-red-400" />
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  const stats = data?.stats

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Super Admin"
        description="Painel de administração do sistema"
        icon={ShieldCheckIcon}
      />

      {/* Stats Grid */}
      <StatsGrid cols={3}>
        <StatsCard
          title="Organizações"
          value={stats?.total_orgs ?? 0}
          icon={BuildingOffice2Icon}
          color="brand"
          loading={loading}
        />
        <StatsCard
          title="Usuários"
          value={stats?.total_users ?? 0}
          icon={UserGroupIcon}
          color="info"
          loading={loading}
        />
        <StatsCard
          title="Tickets Totais"
          value={stats?.total_tickets ?? 0}
          icon={TicketIcon}
          color="warning"
          loading={loading}
        />
        <StatsCard
          title="Orgs Ativas"
          value={stats?.active_orgs ?? 0}
          icon={CheckCircleIcon}
          color="success"
          loading={loading}
        />
        <StatsCard
          title="Tickets (30 dias)"
          value={stats?.tickets_last_30_days ?? 0}
          icon={ClockIcon}
          color="neutral"
          loading={loading}
        />
        <StatsCard
          title="Em Aberto"
          value={stats?.open_tickets ?? 0}
          icon={ExclamationTriangleIcon}
          color="error"
          loading={loading}
        />
      </StatsGrid>

      {/* Alerts Section */}
      {!loading && data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Alertas
          </h2>
          <div className="space-y-2">
            {data.alerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                  alert.type === 'error'
                    ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    : alert.type === 'warning'
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                      : 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/20'
                }`}
              >
                <ExclamationTriangleIcon
                  className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                    alert.type === 'error'
                      ? 'text-red-500 dark:text-red-400'
                      : alert.type === 'warning'
                        ? 'text-amber-500 dark:text-amber-400'
                        : 'text-brand-500 dark:text-brand-400'
                  }`}
                />
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      alert.type === 'error'
                        ? 'text-red-800 dark:text-red-200'
                        : alert.type === 'warning'
                          ? 'text-amber-800 dark:text-amber-200'
                          : 'text-brand-800 dark:text-brand-200'
                    }`}
                  >
                    {alert.title}
                  </p>
                  <p
                    className={`mt-0.5 text-sm ${
                      alert.type === 'error'
                        ? 'text-red-700 dark:text-red-300'
                        : alert.type === 'warning'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-brand-700 dark:text-brand-300'
                    }`}
                  >
                    {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Organizations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Organizações Recentes
          </h2>
          <Link
            href="/admin/super/organizations"
            className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
          >
            Ver todas
          </Link>
        </div>

        {loading ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 sm:px-6 sm:py-4 border-b border-neutral-100 dark:border-neutral-700 last:border-b-0 animate-pulse"
              >
                <div className="h-10 w-10 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded" />
                  <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.recent_orgs && data.recent_orgs.length > 0 ? (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                    <th className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Organização
                    </th>
                    <th className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hidden sm:table-cell">
                      Plano
                    </th>
                    <th className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hidden md:table-cell">
                      Criado em
                    </th>
                    <th className="px-4 py-3 sm:px-6 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Usuários
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {data.recent_orgs.map((org) => (
                    <tr
                      key={org.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-sm font-bold text-white">
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                              {org.name}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                              {org.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                        <PlanBadge plan={org.subscription_plan} />
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-neutral-500 dark:text-neutral-400 hidden md:table-cell">
                        {new Date(org.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-right text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        {org.user_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-8 text-center">
            <BuildingOffice2Icon className="mx-auto h-8 w-8 text-neutral-400 dark:text-neutral-500" />
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Nenhuma organização encontrada.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    enterprise: {
      bg: 'bg-brand-100 dark:bg-brand-900/30',
      text: 'text-brand-700 dark:text-brand-300',
    },
    professional: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    basic: {
      bg: 'bg-neutral-100 dark:bg-neutral-700',
      text: 'text-neutral-600 dark:text-neutral-300',
    },
  }

  const style = config[plan] ?? config.basic

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  )
}
