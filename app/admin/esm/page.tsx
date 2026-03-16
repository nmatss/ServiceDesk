'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  UsersIcon,
  BanknotesIcon,
  ScaleIcon,
  BuildingOfficeIcon,
  CogIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'
import { customToast } from '@/components/ui/toast'
import { logger } from '@/lib/monitoring/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceItem {
  id: string
  name: string
  department: string
  icon: string
  color: string
  description: string
  active: boolean
  template_count: number
  category_count: number
  request_count: number
}

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UsersIcon,
  BanknotesIcon,
  ScaleIcon,
  BuildingOfficeIcon,
  CogIcon,
}

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  },
  sky: {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  },
}

function getColors(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.sky
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminESMPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/esm/workspaces')
      if (res.ok) {
        const data = await res.json()
        setWorkspaces(data.data || [])
      }
    } catch (error) {
      logger.error('Erro ao buscar workspaces ESM', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  const toggleWorkspace = async (ws: WorkspaceItem) => {
    setToggling(ws.id)
    try {
      if (ws.active) {
        // Deactivate
        const res = await fetch(`/api/esm/workspaces/${ws.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        })
        if (res.ok) {
          customToast.success(`${ws.name} desativado`)
          fetchWorkspaces()
        }
      } else {
        // Activate
        const res = await fetch('/api/esm/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: ws.id }),
        })
        if (res.ok) {
          customToast.success(`${ws.name} ativado com sucesso`)
          fetchWorkspaces()
        } else {
          const err = await res.json()
          // 409 = already active, just refresh
          if (res.status === 409) {
            fetchWorkspaces()
          } else {
            customToast.error(err.error || 'Erro ao ativar workspace')
          }
        }
      }
    } catch (error) {
      logger.error('Erro ao alternar workspace', error)
      customToast.error('Erro ao alternar workspace')
    } finally {
      setToggling(null)
    }
  }

  // Stats
  const totalRequests = workspaces.reduce((s, w) => s + w.request_count, 0)
  const activeCount = workspaces.filter((w) => w.active).length
  const topDept = workspaces.reduce((best, w) => (w.request_count > (best?.request_count ?? 0) ? w : best), workspaces[0])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Management Empresarial"
        description="Gerencie servicos multi-departamento: RH, Financeiro, Juridico, Facilities e Operacoes"
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'ESM' },
        ]}
      />

      {/* Stats Row */}
      <StatsGrid cols={4}>
        <StatsCard
          title="Total de Solicitacoes"
          value={totalRequests}
          icon={DocumentTextIcon}
          color="brand"
        />
        <StatsCard
          title="Departamentos Ativos"
          value={activeCount}
          icon={CheckCircleIcon}
          color="success"
        />
        <StatsCard
          title="Total de Templates"
          value={workspaces.reduce((s, w) => s + w.template_count, 0)}
          icon={ClockIcon}
          color="info"
        />
        <StatsCard
          title="Departamento Mais Ativo"
          value={topDept?.name || '-'}
          icon={ChartBarIcon}
          color="brand"
        />
      </StatsGrid>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      )}

      {/* Department Cards Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((ws) => {
            const colors = getColors(ws.color)
            const Icon = ICON_MAP[ws.icon] || CogIcon

            return (
              <div
                key={ws.id}
                className={`rounded-xl border ${colors.border} bg-white dark:bg-neutral-900 shadow-sm overflow-hidden transition-shadow hover:shadow-md`}
              >
                {/* Header */}
                <div className={`px-5 py-4 ${colors.bg} flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-white/80 dark:bg-neutral-800/80 ${colors.text}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {ws.name}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {ws.category_count} categorias
                      </p>
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => toggleWorkspace(ws)}
                    disabled={toggling === ws.id}
                    className="flex items-center gap-1.5 text-sm font-medium"
                    title={ws.active ? 'Desativar' : 'Ativar'}
                  >
                    {toggling === ws.id ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin text-neutral-400" />
                    ) : ws.active ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircleIcon className="h-5 w-5" />
                        Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-neutral-400">
                        <XCircleIcon className="h-5 w-5" />
                        Inativo
                      </span>
                    )}
                  </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                    {ws.description}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {ws.template_count} templates
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                      {ws.request_count} solicitacoes
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <Link
                      href={`/admin/esm/${ws.department}`}
                      className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                    >
                      Configurar &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
