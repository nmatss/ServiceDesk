'use client'

import { useState } from 'react'
import {
  DocumentTextIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  EyeIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'

interface Template {
  id: string
  name: string
  type: 'email' | 'ticket_response' | 'notification' | 'internal_note'
  category: string
  subject?: string
  content: string
  variables: string[]
  usage_count: number
  last_used?: string
  created_by: string
  created_at: string
  active: boolean
}

const mockTemplates: Template[] = [
  {
    id: '1',
    name: 'Confirmação de Abertura de Ticket',
    type: 'email',
    category: 'Tickets',
    subject: 'Seu ticket #{{ticket_id}} foi aberto',
    content: 'Olá {{user_name}},\n\nSeu ticket foi registrado com sucesso.\n\n**Número:** #{{ticket_id}}\n**Assunto:** {{ticket_subject}}\n**Prioridade:** {{ticket_priority}}\n\nNossa equipe irá analisar sua solicitação e retornar em breve.\n\nAtenciosamente,\nEquipe de Suporte',
    variables: ['user_name', 'ticket_id', 'ticket_subject', 'ticket_priority'],
    usage_count: 1547,
    last_used: '2024-12-14',
    created_by: 'Admin',
    created_at: '2024-01-15',
    active: true
  },
  {
    id: '2',
    name: 'Ticket Resolvido',
    type: 'email',
    category: 'Tickets',
    subject: 'Seu ticket #{{ticket_id}} foi resolvido',
    content: 'Olá {{user_name}},\n\nSeu ticket #{{ticket_id}} foi resolvido.\n\n**Solução:** {{solution}}\n\nCaso o problema persista, responda este e-mail para reabrir o chamado.\n\nAtenciosamente,\nEquipe de Suporte',
    variables: ['user_name', 'ticket_id', 'solution'],
    usage_count: 892,
    last_used: '2024-12-14',
    created_by: 'Admin',
    created_at: '2024-01-15',
    active: true
  },
  {
    id: '3',
    name: 'Resposta Padrão - Aguardando Informações',
    type: 'ticket_response',
    category: 'Respostas',
    content: 'Olá {{user_name}},\n\nPara prosseguirmos com seu atendimento, precisamos de algumas informações adicionais:\n\n1. \n2. \n3. \n\nFavor responder este chamado com os dados solicitados.\n\nAtenciosamente,\n{{agent_name}}',
    variables: ['user_name', 'agent_name'],
    usage_count: 456,
    last_used: '2024-12-13',
    created_by: 'Admin',
    created_at: '2024-01-20',
    active: true
  },
  {
    id: '4',
    name: 'Alerta de SLA',
    type: 'notification',
    category: 'Alertas',
    content: 'O ticket #{{ticket_id}} está próximo de violar o SLA.\n\nTempo restante: {{time_remaining}}\nPrioridade: {{priority}}\nAgente: {{agent_name}}',
    variables: ['ticket_id', 'time_remaining', 'priority', 'agent_name'],
    usage_count: 234,
    last_used: '2024-12-14',
    created_by: 'Admin',
    created_at: '2024-02-01',
    active: true
  },
  {
    id: '5',
    name: 'Nota Interna - Escalonamento',
    type: 'internal_note',
    category: 'Notas Internas',
    content: 'Ticket escalonado para {{team_name}}.\n\nMotivo: {{reason}}\n\nHistórico: {{summary}}',
    variables: ['team_name', 'reason', 'summary'],
    usage_count: 123,
    last_used: '2024-12-12',
    created_by: 'Admin',
    created_at: '2024-02-15',
    active: true
  }
]

const typeIcons = {
  email: EnvelopeIcon,
  ticket_response: ChatBubbleLeftRightIcon,
  notification: BellIcon,
  internal_note: DocumentTextIcon
}

const typeLabels = {
  email: 'E-mail',
  ticket_response: 'Resposta',
  notification: 'Notificação',
  internal_note: 'Nota Interna'
}

const typeColors = {
  email: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  ticket_response: 'bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-400',
  notification: 'bg-warning-100 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400',
  internal_note: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [showPreview, setShowPreview] = useState<Template | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === 'all' || template.type === filterType
    return matchesSearch && matchesType
  })

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setShowModal(true)
  }

  const handleDuplicate = (template: Template) => {
    const newTemplate: Template = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Cópia)`,
      usage_count: 0,
      last_used: undefined,
      created_at: new Date().toISOString().split('T')[0]
    }
    setTemplates([...templates, newTemplate])
  }

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      setTemplates(templates.filter(t => t.id !== id))
    }
  }

  const toggleActive = (id: string) => {
    setTemplates(templates.map(t =>
      t.id === id ? { ...t, active: !t.active } : t
    ))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header moderno com breadcrumbs */}
      <PageHeader
        title="Templates"
        description="Gerencie templates de e-mail, respostas e notificações"
        icon={DocumentTextIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Configurações', href: '/admin/settings' },
          { label: 'Templates' }
        ]}
        actions={[
          {
            label: 'Novo Template',
            icon: PlusIcon,
            variant: 'primary',
            onClick: () => {
              setEditingTemplate(null)
              setShowModal(true)
            }
          }
        ]}
      />

      <div className="space-y-6">
        {/* Search and Filters - Glass Panel */}
        <div className="glass-panel animate-slide-up">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-icon-muted" />
              <input
                type="text"
                placeholder="Buscar templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  filterType === 'all'
                    ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                Todos
              </button>
              {Object.entries(typeLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    filterType === key
                      ? 'bg-brand-600 dark:bg-brand-500 text-white shadow-lg shadow-brand-500/30'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="glass-panel group hover:shadow-lg hover:shadow-brand-500/10 transition-all duration-300">
            <div className="text-sm text-description">Total</div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {templates.length}
            </div>
          </div>
          <div className="glass-panel group hover:shadow-lg hover:shadow-success-500/10 transition-all duration-300">
            <div className="text-sm text-description">Ativos</div>
            <div className="text-2xl font-bold text-success-600 dark:text-success-400 mt-1 group-hover:scale-110 transition-transform">
              {templates.filter(t => t.active).length}
            </div>
          </div>
          <div className="glass-panel group hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
            <div className="text-sm text-description">Usos Totais</div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {templates.reduce((sum, t) => sum + t.usage_count, 0).toLocaleString()}
            </div>
          </div>
          <div className="glass-panel group hover:shadow-lg hover:shadow-warning-500/10 transition-all duration-300">
            <div className="text-sm text-description">Categorias</div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 group-hover:text-warning-600 dark:group-hover:text-warning-400 transition-colors">
              {new Set(templates.map(t => t.category)).size}
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((template, index) => {
            const TypeIcon = typeIcons[template.type]
            return (
              <div
                key={template.id}
                className={`glass-panel group hover:shadow-xl transition-all duration-300 animate-slide-up ${
                  template.active ? '' : 'opacity-60'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-transform group-hover:scale-110 ${typeColors[template.type]}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{template.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[template.type]}`}>
                            {typeLabels[template.type]}
                          </span>
                          <span className="text-xs text-muted-content">{template.category}</span>
                        </div>
                      </div>
                    </div>
                    {!template.active && (
                      <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-description rounded text-xs font-medium">
                        Inativo
                      </span>
                    )}
                  </div>

                  {template.subject && (
                    <div className="text-sm text-description mb-2">
                      <span className="font-medium">Assunto:</span> {template.subject}
                    </div>
                  )}

                  <div className="text-sm text-description line-clamp-2 mb-3">
                    {template.content.substring(0, 150)}...
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.variables.slice(0, 4).map((variable) => (
                      <span
                        key={variable}
                        className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-description rounded text-xs font-mono"
                      >
                        {`{{${variable}}}`}
                      </span>
                    ))}
                    {template.variables.length > 4 && (
                      <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-description rounded text-xs">
                        +{template.variables.length - 4}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="text-xs text-muted-content">
                      <span className="font-medium">{template.usage_count}</span> usos
                      {template.last_used && (
                        <span className="ml-2">• Último: {template.last_used}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowPreview(template)}
                        className="p-2 text-icon-muted hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Visualizar"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-2 text-icon-muted hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="p-2 text-icon-muted hover:text-success-600 dark:hover:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20 rounded-lg transition-all"
                        title="Duplicar"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 text-icon-muted hover:text-error-600 dark:hover:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-all"
                        title="Excluir"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="glass-panel p-8 text-center animate-fade-in">
            <DocumentTextIcon className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">Nenhum template encontrado</h3>
            <p className="text-description">
              {searchQuery || filterType !== 'all'
                ? 'Tente ajustar os filtros ou termos de busca'
                : 'Comece criando seu primeiro template'}
            </p>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up border border-neutral-200 dark:border-neutral-800">
            <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${typeColors[showPreview.type]}`}>
                    {(() => {
                      const TypeIcon = typeIcons[showPreview.type]
                      return <TypeIcon className="w-5 h-5" />
                    })()}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{showPreview.name}</h2>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[showPreview.type]}`}>
                      {typeLabels[showPreview.type]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(null)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-muted-content" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {showPreview.subject && (
                <div className="mb-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <div className="text-xs text-muted-content mb-1">Assunto</div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">{showPreview.subject}</div>
                </div>
              )}
              <div className="mb-4">
                <div className="text-xs text-muted-content mb-2">Conteúdo</div>
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                  {showPreview.content}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-content mb-2">Variáveis disponíveis</div>
                <div className="flex flex-wrap gap-2">
                  {showPreview.variables.map((variable) => (
                    <span
                      key={variable}
                      className="px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-lg text-sm font-mono"
                    >
                      {`{{${variable}}}`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(null)}
                className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setShowPreview(null)
                  handleEdit(showPreview)
                }}
                className="px-4 py-2 bg-brand-600 dark:bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/30"
              >
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up border border-neutral-200 dark:border-neutral-800">
            <div className="p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {editingTemplate ? 'Editar Template' : 'Novo Template'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-muted-content" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  defaultValue={editingTemplate?.name || ''}
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                  placeholder="Nome do template"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Tipo *
                  </label>
                  <select
                    defaultValue={editingTemplate?.type || 'email'}
                    className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                  >
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    defaultValue={editingTemplate?.category || ''}
                    className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                    placeholder="Ex: Tickets, Alertas"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Assunto (para e-mails)
                </label>
                <input
                  type="text"
                  defaultValue={editingTemplate?.subject || ''}
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 transition-all"
                  placeholder="Assunto do e-mail (use {{variavel}} para campos dinâmicos)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Conteúdo *
                </label>
                <textarea
                  defaultValue={editingTemplate?.content || ''}
                  rows={8}
                  className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent font-mono text-sm text-neutral-900 dark:text-neutral-100 transition-all"
                  placeholder="Conteúdo do template (use {{variavel}} para campos dinâmicos)"
                />
                <p className="mt-1 text-xs text-muted-content">
                  Use {`{{variavel}}`} para inserir campos dinâmicos. Ex: {`{{user_name}}`}, {`{{ticket_id}}`}
                </p>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-neutral-200 dark:border-neutral-700 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-brand-600 dark:bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/30"
              >
                {editingTemplate ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
