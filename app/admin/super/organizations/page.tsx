'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormField } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { FormModal, AlertModal } from '@/components/ui/Modal'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { customToast } from '@/components/ui/toast'
import { logger } from '@/lib/monitoring/logger'
import {
  BuildingOffice2Icon,
  PlusIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  TrashIcon,
  UsersIcon,
  TicketIcon,
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
  created_at: string
  user_count?: number
  ticket_count?: number
}

interface CreateOrgForm {
  name: string
  slug: string
  domain: string
  subscription_plan: string
  max_users: number
  max_tickets_per_month: number
  billing_email: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
        Ativa
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      Suspensa
    </span>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const config: Record<string, { classes: string; label: string }> = {
    basic: {
      classes: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
      label: 'Basic',
    },
    professional: {
      classes: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
      label: 'Professional',
    },
    enterprise: {
      classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      label: 'Enterprise',
    },
  }
  const c = config[plan] || config.basic
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.classes}`}>
      {c.label}
    </span>
  )
}

const emptyForm: CreateOrgForm = {
  name: '',
  slug: '',
  domain: '',
  subscription_plan: 'basic',
  max_users: 50,
  max_tickets_per_month: 1000,
  billing_email: '',
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [statusFilter, setStatusFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<CreateOrgForm>({ ...emptyForm })
  const [creating, setCreating] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Suspend/reactivate
  const [suspending, setSuspending] = useState<string | null>(null)

  const fetchOrganizations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusFilter) params.set('status', statusFilter)
      if (planFilter) params.set('plan', planFilter)

      const res = await fetch(`/api/admin/super/organizations?${params}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao carregar organizações')
      const data = await res.json()
      setOrganizations(data.data || [])
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
    } catch (err) {
      logger.error('Failed to fetch organizations', err)
      customToast.error('Erro ao carregar organizações')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, planFilter])

  useEffect(() => {
    fetchOrganizations()
  }, [fetchOrganizations])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, planFilter])

  const handleCreateFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setCreateForm((prev) => {
      const updated = { ...prev, [name]: name === 'max_users' || name === 'max_tickets_per_month' ? Number(value) : value }
      if (name === 'name') {
        updated.slug = slugify(value)
      }
      return updated
    })
  }

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      customToast.error('Nome e slug são obrigatórios')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/super/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao criar organização')
      }
      customToast.success('Organização criada com sucesso')
      setShowCreateModal(false)
      setCreateForm({ ...emptyForm })
      fetchOrganizations()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar organização'
      customToast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const handleSuspendToggle = async (org: Organization) => {
    const action = org.status === 'active' ? 'suspend' : 'reactivate'
    setSuspending(org.id)
    try {
      const res = await fetch(`/api/admin/super/organizations/${org.id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(`Erro ao ${action === 'suspend' ? 'suspender' : 'reativar'} organização`)
      customToast.success(action === 'suspend' ? 'Organização suspensa' : 'Organização reativada')
      fetchOrganizations()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro na operação'
      customToast.error(message)
    } finally {
      setSuspending(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/super/organizations/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro ao excluir organização')
      customToast.success('Organização excluída com sucesso')
      setDeleteTarget(null)
      fetchOrganizations()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir organização'
      customToast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizações"
        description="Gerenciar organizações do sistema"
        icon={BuildingOffice2Icon}
        actions={[
          {
            label: 'Nova Organização',
            onClick: () => setShowCreateModal(true),
            icon: PlusIcon,
            variant: 'primary',
          },
        ]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 dark:text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 h-11 text-base sm:text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 h-11 text-base sm:text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
        >
          <option value="">Todas</option>
          <option value="active">Ativas</option>
          <option value="suspended">Suspensas</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-4 py-2.5 h-11 text-base sm:text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
        >
          <option value="">Todos os planos</option>
          <option value="basic">Basic</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-700 rounded" />
                  <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && organizations.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
          <BuildingOffice2Icon className="mx-auto h-12 w-12 text-neutral-400 dark:text-neutral-500" />
          <h3 className="mt-4 text-lg font-medium text-neutral-900 dark:text-neutral-100">
            Nenhuma organização encontrada
          </h3>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {debouncedSearch || statusFilter || planFilter
              ? 'Tente ajustar os filtros de busca.'
              : 'Crie a primeira organização para começar.'}
          </p>
        </div>
      )}

      {/* Cards (mobile) */}
      {!loading && organizations.length > 0 && (
        <div className="block lg:hidden space-y-4">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {org.name}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {org.slug}
                  </p>
                </div>
                <StatusBadge status={org.status} />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <PlanBadge plan={org.subscription_plan} />
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <UsersIcon className="h-3.5 w-3.5" />
                  {org.user_count ?? 0}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <TicketIcon className="h-3.5 w-3.5" />
                  {org.ticket_count ?? 0}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatDate(org.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/super/organizations/${org.id}`}>
                    <EyeIcon className="h-4 w-4 mr-1" />
                    Detalhes
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSuspendToggle(org)}
                  disabled={suspending === org.id}
                >
                  {org.status === 'active' ? (
                    <>
                      <PauseCircleIcon className="h-4 w-4 mr-1" />
                      Suspender
                    </>
                  ) : (
                    <>
                      <PlayCircleIcon className="h-4 w-4 mr-1" />
                      Reativar
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(org)}
                  className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table (desktop) */}
      {!loading && organizations.length > 0 && (
        <div className="hidden lg:block overflow-x-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl">
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Plano
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Usuários
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Tickets
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {org.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 font-mono">
                      {org.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge plan={org.subscription_plan} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {org.user_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {org.ticket_count ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={org.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {formatDate(org.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/super/organizations/${org.id}`}>
                          <EyeIcon className="h-4 w-4" />
                          <span className="sr-only">Ver detalhes</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuspendToggle(org)}
                        disabled={suspending === org.id}
                        title={org.status === 'active' ? 'Suspender' : 'Reativar'}
                      >
                        {org.status === 'active' ? (
                          <PauseCircleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <PlayCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                        <span className="sr-only">{org.status === 'active' ? 'Suspender' : 'Reativar'}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(org)}
                        title="Excluir"
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span className="sr-only">Excluir</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {total} organização{total !== 1 ? 'ões' : ''} encontrada{total !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-sm text-neutral-700 dark:text-neutral-300 px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <FormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setCreateForm({ ...emptyForm })
        }}
        title="Nova Organização"
        description="Preencha os dados para criar uma nova organização"
        size="lg"
        onSubmit={handleCreate}
        submitText="Criar Organização"
        loading={creating}
      >
        <div className="space-y-4">
          <FormField
            label="Nome"
            name="name"
            required
            placeholder="Nome da organização"
            value={createForm.name}
            onChange={handleCreateFormChange}
          />
          <FormField
            label="Slug"
            name="slug"
            required
            placeholder="slug-da-organizacao"
            value={createForm.slug}
            onChange={handleCreateFormChange}
            helpText="Identificador único. Gerado automaticamente a partir do nome."
          />
          <FormField
            label="Domínio"
            name="domain"
            placeholder="exemplo.com.br"
            value={createForm.domain}
            onChange={handleCreateFormChange}
            helpText="Domínio personalizado da organização (opcional)"
          />
          <FormField
            label="Plano"
            name="subscription_plan"
            type="select"
            value={createForm.subscription_plan}
            onChange={handleCreateFormChange}
          >
            <option value="basic">Basic</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Max Usuários"
              name="max_users"
              type="number"
              value={createForm.max_users}
              onChange={handleCreateFormChange}
            />
            <FormField
              label="Max Tickets/Mês"
              name="max_tickets_per_month"
              type="number"
              value={createForm.max_tickets_per_month}
              onChange={handleCreateFormChange}
            />
          </div>
          <FormField
            label="Email Faturamento"
            name="billing_email"
            type="email"
            placeholder="faturamento@exemplo.com.br"
            value={createForm.billing_email}
            onChange={handleCreateFormChange}
          />
        </div>
      </FormModal>

      {/* Delete Confirmation */}
      <AlertModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        type="warning"
        title="Excluir Organização"
        message={`Tem certeza que deseja excluir a organização "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        showCancel
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
