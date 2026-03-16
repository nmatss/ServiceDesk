'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  UsersIcon,
  BanknotesIcon,
  ScaleIcon,
  BuildingOfficeIcon,
  CogIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import { customToast } from '@/components/ui/toast'
import { logger } from '@/lib/monitoring/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceCard {
  id: string
  name: string
  department: string
  icon: string
  color: string
  description: string
  active: boolean
  template_count: number
}

interface TemplateItem {
  id: string
  name: string
  description: string
  category: string
  priority: string
  fields: FieldDef[]
  source: string
}

interface FieldDef {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'email' | 'file' | 'checkbox'
  required: boolean
  options?: string[]
  placeholder?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  UsersIcon,
  BanknotesIcon,
  ScaleIcon,
  BuildingOfficeIcon,
  CogIcon,
}

const COLOR_BG: Record<string, string> = {
  purple: 'bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
  amber: 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30',
  sky: 'bg-sky-50 dark:bg-sky-900/20 hover:bg-sky-100 dark:hover:bg-sky-900/30',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30',
}

const COLOR_TEXT: Record<string, string> = {
  purple: 'text-purple-700 dark:text-purple-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  sky: 'text-sky-700 dark:text-sky-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
}

const COLOR_BORDER: Record<string, string> = {
  purple: 'border-purple-200 dark:border-purple-800',
  emerald: 'border-emerald-200 dark:border-emerald-800',
  amber: 'border-amber-200 dark:border-amber-800',
  sky: 'border-sky-200 dark:border-sky-800',
  indigo: 'border-indigo-200 dark:border-indigo-800',
}

// ---------------------------------------------------------------------------
// View states
// ---------------------------------------------------------------------------

type ViewState =
  | { type: 'workspaces' }
  | { type: 'templates'; workspace: WorkspaceCard }
  | { type: 'form'; workspace: WorkspaceCard; template: TemplateItem }
  | { type: 'success'; ticketId: number; title: string }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalESMPage() {
  const [view, setView] = useState<ViewState>({ type: 'workspaces' })
  const [workspaces, setWorkspaces] = useState<WorkspaceCard[]>([])
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch workspaces
  const fetchWorkspaces = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/esm/workspaces')
      if (res.ok) {
        const data = await res.json()
        const active = (data.data || []).filter((w: WorkspaceCard) => w.active)
        setWorkspaces(active)
      }
    } catch (error) {
      logger.error('Erro ao buscar workspaces', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  // Fetch templates for a workspace
  const handleSelectWorkspace = async (ws: WorkspaceCard) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/esm/templates?workspace_id=${ws.id}`)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.data || [])
        setView({ type: 'templates', workspace: ws })
      }
    } catch (error) {
      logger.error('Erro ao buscar templates', error)
    } finally {
      setLoading(false)
    }
  }

  // Select template -> open form
  const handleSelectTemplate = (ws: WorkspaceCard, tpl: TemplateItem) => {
    setFormData({})
    setView({ type: 'form', workspace: ws, template: tpl })
  }

  // Update form field
  const handleFieldChange = (fieldName: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
  }

  // Submit form
  const handleSubmit = async () => {
    if (view.type !== 'form') return
    setSubmitting(true)
    try {
      const res = await fetch('/api/esm/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: view.workspace.id,
          template_id: view.template.id,
          form_data: formData,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        customToast.success('Solicitacao criada com sucesso!')
        setView({ type: 'success', ticketId: data.data.ticket_id, title: data.data.title })
      } else {
        customToast.error(data.error || 'Erro ao enviar solicitacao')
      }
    } catch (error) {
      logger.error('Erro ao submeter ESM', error)
      customToast.error('Erro ao enviar solicitacao')
    } finally {
      setSubmitting(false)
    }
  }

  // Filter templates
  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // ────────────────────────────────────────────────────────────────────────
  // Render: Success view
  // ────────────────────────────────────────────────────────────────────────
  if (view.type === 'success') {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircleIcon className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Solicitacao Enviada!
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Sua solicitacao <span className="font-semibold">#{view.ticketId}</span> foi criada com sucesso.
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {view.title}
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => {
              setView({ type: 'workspaces' })
              setFormData({})
            }}
            className="px-5 py-2.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            Nova Solicitacao
          </button>
          <a
            href={`/portal/tickets`}
            className="px-5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Minhas Solicitacoes
          </a>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: Form view
  // ────────────────────────────────────────────────────────────────────────
  if (view.type === 'form') {
    const { workspace: ws, template: tpl } = view
    const Icon = ICON_MAP[ws.icon] || CogIcon

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => handleSelectWorkspace(ws)}
          className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para {ws.name}
        </button>

        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">
          {/* Header */}
          <div className={`px-6 py-5 ${COLOR_BG[ws.color] || ''} border-b ${COLOR_BORDER[ws.color] || ''}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white/80 dark:bg-neutral-800/80 ${COLOR_TEXT[ws.color] || ''}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {tpl.name}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">{tpl.description}</p>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="px-6 py-5 space-y-5">
            {tpl.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === 'text' && (
                  <input
                    type="text"
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                )}

                {field.type === 'email' && (
                  <input
                    type="email"
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                )}

                {field.type === 'number' && (
                  <input
                    type="number"
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value ? Number(e.target.value) : '')}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                )}

                {field.type === 'date' && (
                  <input
                    type="date"
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                )}

                {field.type === 'select' && (
                  <select
                    value={(formData[field.name] as string) || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">Selecione...</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === 'file' && (
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      handleFieldChange(field.name, file?.name || '')
                    }}
                    className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-900/30 dark:file:text-brand-300"
                  />
                )}

                {field.type === 'checkbox' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(formData[field.name] as boolean) || false}
                      onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {field.placeholder || 'Sim'}
                    </span>
                  </label>
                )}
              </div>
            ))}
          </div>

          {/* Submit */}
          <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
            <button
              onClick={() => handleSelectWorkspace(ws)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {submitting ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PaperAirplaneIcon className="h-4 w-4" />
              )}
              Enviar Solicitacao
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: Templates view
  // ────────────────────────────────────────────────────────────────────────
  if (view.type === 'templates') {
    const ws = view.workspace
    const Icon = ICON_MAP[ws.icon] || CogIcon

    return (
      <div className="space-y-6">
        <button
          onClick={() => setView({ type: 'workspaces' })}
          className="flex items-center gap-1 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar aos departamentos
        </button>

        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${COLOR_BG[ws.color] || ''} ${COLOR_TEXT[ws.color] || ''}`}>
            <Icon className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{ws.name}</h2>
            <p className="text-neutral-500 dark:text-neutral-400">{ws.description}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar servico..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(ws, tpl)}
                className="text-left rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {tpl.name}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                      {tpl.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                        {tpl.category}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {tpl.fields?.length || 0} campos
                      </span>
                    </div>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-neutral-400 group-hover:text-brand-500 transition-colors flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && filteredTemplates.length === 0 && (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            Nenhum servico encontrado.
          </div>
        )}
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: Workspaces view (home)
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
          Como podemos ajudar?
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">
          Selecione o departamento para ver os servicos disponiveis
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-16 text-neutral-500 dark:text-neutral-400">
          <BuildingOfficeIcon className="h-12 w-12 mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
          <p>Nenhum departamento configurado ainda.</p>
          <p className="text-sm mt-1">Entre em contato com o administrador para ativar os servicos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {workspaces.map((ws) => {
            const Icon = ICON_MAP[ws.icon] || CogIcon
            const bg = COLOR_BG[ws.color] || COLOR_BG.sky
            const text = COLOR_TEXT[ws.color] || COLOR_TEXT.sky
            const border = COLOR_BORDER[ws.color] || COLOR_BORDER.sky

            return (
              <button
                key={ws.id}
                onClick={() => handleSelectWorkspace(ws)}
                className={`text-left rounded-2xl border ${border} ${bg} p-6 transition-all hover:shadow-lg hover:scale-[1.02] group`}
              >
                <div className={`p-3 rounded-xl bg-white/80 dark:bg-neutral-800/80 w-fit ${text}`}>
                  <Icon className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {ws.name}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                  {ws.description}
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                  Ver servicos
                  <ChevronRightIcon className="h-4 w-4" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
