'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  UsersIcon,
  BanknotesIcon,
  ScaleIcon,
  BuildingOfficeIcon,
  CogIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  XMarkIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import { customToast } from '@/components/ui/toast'
import { logger } from '@/lib/monitoring/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateItem {
  id: string
  name: string
  description: string
  category: string
  priority: string
  fields: FieldDef[]
  source: string
  usage_count?: number
  db_id?: number
}

interface FieldDef {
  name: string
  label: string
  type: string
  required: boolean
  options?: string[]
  placeholder?: string
}

interface WorkspaceDetail {
  id: string
  name: string
  department: string
  icon: string
  color: string
  description: string
  active: boolean
  categories: { name: string; description: string; icon: string }[]
  templates: TemplateItem[]
  workflows: { id: string; name: string; description: string; steps: number }[]
  sla_defaults: { priority: string; response_hours: number; resolution_hours: number }[]
}

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const DEPT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  hr: UsersIcon,
  finance: BanknotesIcon,
  legal: ScaleIcon,
  facilities: BuildingOfficeIcon,
  operations: CogIcon,
}

const DEPT_WS_MAP: Record<string, string> = {
  hr: 'ws-hr',
  finance: 'ws-finance',
  legal: 'ws-legal',
  facilities: 'ws-facilities',
  operations: 'ws-operations',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DepartmentConfigPage() {
  const params = useParams()
  const router = useRouter()
  const department = params.department as string
  const workspaceId = DEPT_WS_MAP[department]

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: '',
    priority: 'medium',
  })

  const Icon = DEPT_ICON_MAP[department] || CogIcon

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) return
    try {
      const res = await fetch(`/api/esm/workspaces/${workspaceId}`)
      if (res.ok) {
        const data = await res.json()
        setWorkspace(data.data)
      } else {
        customToast.error('Workspace nao encontrado')
        router.push('/admin/esm')
      }
    } catch (error) {
      logger.error('Erro ao buscar workspace', error)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, router])

  useEffect(() => {
    fetchWorkspace()
  }, [fetchWorkspace])

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) {
      customToast.error('Nome e obrigatorio')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/esm/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...newTemplate,
          fields: [],
        }),
      })
      if (res.ok) {
        customToast.success('Template criado com sucesso')
        setShowModal(false)
        setNewTemplate({ name: '', description: '', category: '', priority: 'medium' })
        fetchWorkspace()
      } else {
        const err = await res.json()
        customToast.error(err.error || 'Erro ao criar template')
      }
    } catch (error) {
      logger.error('Erro ao criar template', error)
      customToast.error('Erro ao criar template')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return
    try {
      const res = await fetch(`/api/esm/templates/${templateId}`, { method: 'DELETE' })
      if (res.ok) {
        customToast.success('Template excluido')
        fetchWorkspace()
      } else {
        const err = await res.json()
        customToast.error(err.error || 'Erro ao excluir template')
      }
    } catch (error) {
      logger.error('Erro ao excluir template', error)
    }
  }

  if (!workspaceId) {
    return (
      <div className="p-8 text-center text-neutral-500 dark:text-neutral-400">
        Departamento nao encontrado.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (!workspace) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title={workspace.name}
        description={workspace.description}
        icon={Icon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'ESM', href: '/admin/esm' },
          { label: workspace.name },
        ]}
        actions={[
          {
            label: 'Novo Template',
            icon: PlusIcon,
            onClick: () => setShowModal(true),
            variant: 'primary',
          },
          {
            label: 'Voltar',
            icon: ArrowLeftIcon,
            href: '/admin/esm',
            variant: 'secondary',
          },
        ]}
      />

      {/* Categories */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Categorias ({workspace.categories.length})
        </h2>
        <div className="flex flex-wrap gap-2">
          {workspace.categories.map((cat) => (
            <span
              key={cat.name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {cat.name}
            </span>
          ))}
        </div>
      </section>

      {/* Templates Table */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          Templates ({workspace.templates.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Categoria
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Prioridade
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Campos
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Uso
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Origem
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700 bg-white dark:bg-neutral-900">
              {workspace.templates.map((tpl) => (
                <tr key={tpl.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {tpl.name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
                        {tpl.description}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                    {tpl.category}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[tpl.priority] || PRIORITY_COLORS.medium}`}
                    >
                      {tpl.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
                    {tpl.fields?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
                    {tpl.usage_count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        tpl.source === 'builtin'
                          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {tpl.source === 'builtin' ? 'Nativo' : 'Personalizado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {tpl.source === 'custom' && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
                          title="Excluir"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Workflows */}
      {workspace.workflows.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            Workflows Vinculados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspace.workflows.map((wf) => (
              <div
                key={wf.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4"
              >
                <h3 className="font-medium text-neutral-900 dark:text-neutral-100">{wf.name}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  {wf.description}
                </p>
                <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                  {wf.steps} etapas
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SLA Defaults */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
          SLA Padrao
        </h2>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
            <thead className="bg-neutral-50 dark:bg-neutral-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                  Prioridade
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                  Tempo de Resposta
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase">
                  Tempo de Resolucao
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700 bg-white dark:bg-neutral-900">
              {workspace.sla_defaults.map((sla) => (
                <tr key={sla.priority}>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[sla.priority] || ''}`}
                    >
                      {sla.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
                    {sla.response_hours}h
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-neutral-600 dark:text-neutral-400">
                    {sla.resolution_hours}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* New Template Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Novo Template
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <XMarkIcon className="h-5 w-5 text-neutral-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Nome do template"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Descricao
                </label>
                <textarea
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Descricao do template"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Categoria
                </label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="">Selecione uma categoria</option>
                  {workspace.categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Prioridade Padrao
                </label>
                <select
                  value={newTemplate.priority}
                  onChange={(e) => setNewTemplate({ ...newTemplate, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Critica</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Criar Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
