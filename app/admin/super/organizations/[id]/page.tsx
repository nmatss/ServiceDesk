'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard'
import { AlertModal } from '@/components/ui/Modal'
import { customToast } from '@/components/ui/toast'
import { logger } from '@/lib/monitoring/logger'
import {
  BuildingOffice2Icon,
  UsersIcon,
  TicketIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  PauseCircleIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline'

interface Organization {
  id: string
  name: string
  slug: string
  domain: string | null
  subscription_plan: string
  status: string
  max_users: number
  max_tickets_per_month: number
  billing_email: string | null
  features: string | null
  created_at: string
  updated_at: string
}

interface OrgUser {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
  last_login_at: string | null
}

interface OrgStats {
  total_users: number
  total_tickets: number
  tickets_this_month: number
  sla_compliance: number
}

type TabKey = 'info' | 'users' | 'config' | 'metrics'

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'info', label: 'Informações', icon: InformationCircleIcon },
  { key: 'users', label: 'Usuários', icon: UsersIcon },
  { key: 'config', label: 'Configuração', icon: Cog6ToothIcon },
  { key: 'metrics', label: 'Métricas', icon: ChartBarIcon },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, string> = {
    super_admin: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    admin: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    tenant_admin: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    team_manager: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
    agent: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    user: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config[role] || config.user}`}>
      {role}
    </span>
  )
}

export default function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const router = useRouter()

  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('info')

  // Edit form
  const [editForm, setEditForm] = useState({
    name: '',
    slug: '',
    domain: '',
    billing_email: '',
    subscription_plan: '',
    max_users: 0,
    max_tickets_per_month: 0,
  })

  // Users tab
  const [users, setUsers] = useState<OrgUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Metrics tab
  const [stats, setStats] = useState<OrgStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Suspend confirmation
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [suspending, setSuspending] = useState(false)

  const fetchOrg = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/super/organizations/${id}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Organização não encontrada')
      const data = await res.json()
      const o = data.data || data
      setOrg(o)
      setEditForm({
        name: o.name || '',
        slug: o.slug || '',
        domain: o.domain || '',
        billing_email: o.billing_email || '',
        subscription_plan: o.subscription_plan || 'basic',
        max_users: o.max_users || 50,
        max_tickets_per_month: o.max_tickets_per_month || 1000,
      })
    } catch (err) {
      logger.error('Failed to fetch organization', err)
      customToast.error('Erro ao carregar organização')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch(`/api/admin/super/organizations/${id}/users`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao carregar usuários')
      const data = await res.json()
      setUsers(data.data || data.users || [])
    } catch (err) {
      logger.error('Failed to fetch org users', err)
      customToast.error('Erro ao carregar usuários')
    } finally {
      setLoadingUsers(false)
    }
  }, [id])

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/admin/super/organizations/${id}/stats`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao carregar métricas')
      const data = await res.json()
      setStats(data.data || data)
    } catch (err) {
      logger.error('Failed to fetch org stats', err)
      customToast.error('Erro ao carregar métricas')
    } finally {
      setLoadingStats(false)
    }
  }, [id])

  useEffect(() => {
    fetchOrg()
  }, [fetchOrg])

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) {
      fetchUsers()
    }
    if (activeTab === 'metrics' && !stats) {
      fetchStats()
    }
  }, [activeTab, users.length, stats, fetchUsers, fetchStats])

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setEditForm((prev) => ({
      ...prev,
      [name]: name === 'max_users' || name === 'max_tickets_per_month' ? Number(value) : value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/super/organizations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao salvar')
      }
      customToast.success('Organização atualizada com sucesso')
      fetchOrg()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar'
      customToast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleSuspendToggle = async () => {
    if (!org) return
    const action = org.status === 'active' ? 'suspend' : 'reactivate'
    setSuspending(true)
    try {
      const res = await fetch(`/api/admin/super/organizations/${id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Erro na operação')
      customToast.success(
        action === 'suspend' ? 'Organização suspensa' : 'Organização reativada'
      )
      setShowSuspendModal(false)
      fetchOrg()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro na operação'
      customToast.error(message)
    } finally {
      setSuspending(false)
    }
  }

  const parsedFeatures = React.useMemo(() => {
    if (!org?.features) return {}
    try {
      return typeof org.features === 'string' ? JSON.parse(org.features) : org.features
    } catch {
      return {}
    }
  }, [org?.features])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-700 rounded" />
        <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-700 rounded" />
        <div className="h-96 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="text-center py-12">
        <BuildingOffice2Icon className="mx-auto h-12 w-12 text-neutral-400 dark:text-neutral-500" />
        <h3 className="mt-4 text-lg font-medium text-neutral-900 dark:text-neutral-100">
          Organização não encontrada
        </h3>
        <Button variant="secondary" className="mt-4" onClick={() => router.push('/admin/super/organizations')}>
          Voltar para lista
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.name}
        description={org.slug}
        icon={BuildingOffice2Icon}
        backButton={{
          label: 'Organizações',
          href: '/admin/super/organizations',
        }}
      />

      {/* Tab navigation */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="flex gap-1 overflow-x-auto -mb-px" aria-label="Abas">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${isActive
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }
                `}
                aria-selected={isActive}
                role="tab"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in">
        {/* Tab: Informações */}
        {activeTab === 'info' && (
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Nome"
                name="name"
                required
                value={editForm.name}
                onChange={handleEditChange}
              />
              <FormField
                label="Slug"
                name="slug"
                required
                value={editForm.slug}
                onChange={handleEditChange}
              />
              <FormField
                label="Domínio"
                name="domain"
                placeholder="exemplo.com.br"
                value={editForm.domain}
                onChange={handleEditChange}
              />
              <FormField
                label="Email Faturamento"
                name="billing_email"
                type="email"
                placeholder="faturamento@exemplo.com.br"
                value={editForm.billing_email}
                onChange={handleEditChange}
              />
              <FormField
                label="Plano"
                name="subscription_plan"
                type="select"
                value={editForm.subscription_plan}
                onChange={handleEditChange}
              >
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Max Usuários"
                  name="max_users"
                  type="number"
                  value={editForm.max_users}
                  onChange={handleEditChange}
                />
                <FormField
                  label="Max Tickets/Mês"
                  name="max_tickets_per_month"
                  type="number"
                  value={editForm.max_tickets_per_month}
                  onChange={handleEditChange}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <Button onClick={handleSave} loading={saving}>
                Salvar Alterações
              </Button>
              <Button
                variant={org.status === 'active' ? 'destructive' : 'success'}
                onClick={() => setShowSuspendModal(true)}
                leftIcon={
                  org.status === 'active' ? (
                    <PauseCircleIcon className="h-5 w-5" />
                  ) : (
                    <PlayCircleIcon className="h-5 w-5" />
                  )
                }
              >
                {org.status === 'active' ? 'Suspender Organização' : 'Reativar Organização'}
              </Button>
            </div>
          </div>
        )}

        {/* Tab: Usuários */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
            {loadingUsers ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-8 w-8 bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 bg-neutral-200 dark:bg-neutral-700 rounded" />
                      <div className="h-3 w-56 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12">
                <UsersIcon className="mx-auto h-10 w-10 text-neutral-400 dark:text-neutral-500" />
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  Nenhum usuário encontrado nesta organização.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="block sm:hidden divide-y divide-neutral-200 dark:divide-neutral-700">
                  {users.map((user) => (
                    <div key={user.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {user.name}
                        </span>
                        <RoleBadge role={user.role} />
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{user.email}</p>
                      <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className={user.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {user.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                        {user.last_login_at && (
                          <span>Último login: {formatDate(user.last_login_at)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <table className="hidden sm:table min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                        Último Login
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {user.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                          {user.email}
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.is_active
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {user.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                          {formatDate(user.last_login_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* Tab: Configuração */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Limites da Organização
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Plano
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100 capitalize">
                    {org.subscription_plan}
                  </p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Max Usuários
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {org.max_users}
                  </p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Max Tickets/Mês
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {org.max_tickets_per_month}
                  </p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Status
                  </p>
                  <p className={`mt-1 text-lg font-semibold ${org.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {org.status === 'active' ? 'Ativa' : 'Suspensa'}
                  </p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Criada em
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDate(org.created_at)}
                  </p>
                </div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Última Atualização
                  </p>
                  <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDate(org.updated_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Funcionalidades
              </h3>
              {Object.keys(parsedFeatures).length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Nenhuma funcionalidade configurada.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(parsedFeatures).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg"
                    >
                      <span className="text-sm text-neutral-700 dark:text-neutral-300">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          value
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {value ? 'Ativado' : 'Desativado'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Métricas */}
        {activeTab === 'metrics' && (
          <div>
            {loadingStats ? (
              <StatsGrid cols={4}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-5 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
                        <div className="h-6 w-12 bg-neutral-200 dark:bg-neutral-700 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </StatsGrid>
            ) : stats ? (
              <StatsGrid cols={4}>
                <StatsCard
                  title="Total de Usuários"
                  value={stats.total_users}
                  icon={UsersIcon}
                  color="brand"
                  description={`de ${org.max_users} permitidos`}
                />
                <StatsCard
                  title="Total de Tickets"
                  value={stats.total_tickets}
                  icon={TicketIcon}
                  color="info"
                />
                <StatsCard
                  title="Tickets este Mês"
                  value={stats.tickets_this_month}
                  icon={ClockIcon}
                  color="warning"
                  description={`de ${org.max_tickets_per_month} permitidos`}
                />
                <StatsCard
                  title="Conformidade SLA"
                  value={`${stats.sla_compliance}%`}
                  icon={CheckCircleIcon}
                  color={stats.sla_compliance >= 90 ? 'success' : stats.sla_compliance >= 70 ? 'warning' : 'error'}
                />
              </StatsGrid>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
                <ChartBarIcon className="mx-auto h-10 w-10 text-neutral-400 dark:text-neutral-500" />
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  Não foi possível carregar as métricas.
                </p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={fetchStats}>
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suspend/Reactivate Confirmation */}
      <AlertModal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        type="warning"
        title={org.status === 'active' ? 'Suspender Organização' : 'Reativar Organização'}
        message={
          org.status === 'active'
            ? `Tem certeza que deseja suspender a organização "${org.name}"? Todos os usuários perderão acesso.`
            : `Tem certeza que deseja reativar a organização "${org.name}"?`
        }
        confirmText={org.status === 'active' ? 'Suspender' : 'Reativar'}
        cancelText="Cancelar"
        showCancel
        onConfirm={handleSuspendToggle}
        loading={suspending}
      />
    </div>
  )
}
