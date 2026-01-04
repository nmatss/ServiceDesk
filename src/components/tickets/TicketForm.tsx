'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger'
import {
  PaperClipIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TagIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { TicketData as Ticket } from '../../../components/ui/TicketCard'
import { useNotificationHelpers } from '@/src/components/notifications/NotificationProvider'

interface Category {
  id: number
  name: string
  description: string
  color: string
}

interface Priority {
  id: number
  name: string
  level: number
  color: string
  description: string
}

interface Agent {
  id: number
  name: string
  email: string
}

interface ExtendedTicket extends Partial<Ticket> {
  assigned_agent_id?: number
}

interface TicketFormProps {
  ticket?: ExtendedTicket
  mode: 'create' | 'edit'
  userRole?: 'admin' | 'agent' | 'user'
  onSubmit?: (data: any) => void
  onCancel?: () => void
  className?: string
}

interface FormData {
  title: string
  description: string
  category_id: string
  priority_id: string
  assigned_agent_id?: string
  tags: string[]
  attachments: File[]
}

const initialFormData: FormData = {
  title: '',
  description: '',
  category_id: '',
  priority_id: '',
  assigned_agent_id: '',
  tags: [],
  attachments: []
}

export default function TicketForm({
  ticket,
  mode = 'create',
  userRole = 'user',
  onSubmit,
  onCancel,
  className = ''
}: TicketFormProps) {
  const router = useRouter()
  const notifications = useNotificationHelpers()
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [categories, setCategories] = useState<Category[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    fetchFormData()
    if (ticket) {
      setFormData({
        title: ticket.title || '',
        description: ticket.description || '',
        category_id: ticket.category || '',
        priority_id: ticket.priority || '',
        assigned_agent_id: ticket.assigned_agent_id?.toString() || '',
        tags: ticket.tags || [],
        attachments: []
      })
    }
  }, [ticket])

  const fetchFormData = async () => {
    try {
      // SECURITY: Use httpOnly cookies for authentication
      const [categoriesRes, prioritiesRes, agentsRes] = await Promise.all([
        fetch('/api/categories', { credentials: 'include' }),
        fetch('/api/priorities', { credentials: 'include' }),
        userRole === 'admin' || userRole === 'agent'
          ? fetch('/api/agents', { credentials: 'include' })
          : Promise.resolve({ ok: false })
      ])

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(data.categories || [])
      }

      if (prioritiesRes.ok) {
        const data = await prioritiesRes.json()
        setPriorities(data.priorities || [])
      }

      if (agentsRes.ok) {
        const data = await (agentsRes as Response).json()
        setAgents(data.agents || [])
      }
    } catch (error) {
      logger.error('Error fetching form data', error)
    }
  }

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
    // Clear field-specific error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleTagAdd = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }))
    }
    setTagInput('')
  }

  const handleTagRemove = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleFileChange = (files: FileList) => {
    const newFiles = Array.from(files)
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newFiles]
    }))
  }

  const handleFileRemove = (indexToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, index) => index !== indexToRemove)
    }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    if (e.dataTransfer.files) {
      handleFileChange(e.dataTransfer.files)
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.title.trim()) {
      errors.title = 'O título é obrigatório'
    }
    if (!formData.description.trim()) {
      errors.description = 'A descrição é obrigatória'
    }
    if (!formData.category_id) {
      errors.category_id = 'Selecione uma categoria'
    }
    if (!formData.priority_id) {
      errors.priority_id = 'Selecione uma prioridade'
    }

    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      const errorMessage = Object.values(errors).join('. ')
      setError(errorMessage)
      setStatusMessage(`Erro de validação: ${errorMessage}`)
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)
    setError('')

    try {
      // SECURITY: Use httpOnly cookies for authentication
      // Create FormData for file upload
      const submitData = new FormData()
      submitData.append('title', formData.title.trim())
      submitData.append('description', formData.description.trim())
      submitData.append('category_id', formData.category_id)
      submitData.append('priority_id', formData.priority_id)

      if (formData.assigned_agent_id) {
        submitData.append('assigned_agent_id', formData.assigned_agent_id)
      }

      if (formData.tags.length > 0) {
        submitData.append('tags', JSON.stringify(formData.tags))
      }

      formData.attachments.forEach((file, index) => {
        submitData.append(`attachments[${index}]`, file)
      })

      const url = mode === 'create'
        ? '/api/tickets'
        : `/api/tickets/${ticket?.id}`

      const method = mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        credentials: 'include', // Use httpOnly cookies
        body: submitData
      })

      const data = await response.json()

      if (response.ok) {
        const successMsg = mode === 'create'
          ? `Ticket criado com sucesso. ID: ${data.ticket.id}`
          : `Ticket atualizado com sucesso`
        setSuccess(successMsg)
        setStatusMessage(successMsg)

        if (mode === 'create') {
          notifications.ticketCreated(data.ticket.id)
        } else {
          notifications.ticketUpdated(data.ticket.id)
        }

        if (onSubmit) {
          onSubmit(data.ticket)
        } else {
          setTimeout(() => {
            router.push(`/tickets/${data.ticket.id}`)
          }, 1000)
        }
      } else {
        notifications.error(
          `Erro ao ${mode === 'create' ? 'criar' : 'atualizar'} ticket`,
          data.error || 'Tente novamente ou entre em contato com o suporte.'
        )
        setError(data.error || `Erro ao ${mode === 'create' ? 'criar' : 'atualizar'} ticket`)
      }
    } catch (error) {
      notifications.error('Erro de conexão', 'Verifique sua conexão e tente novamente.')
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      router.back()
    }
  }

  const getPriorityColor = (priority: Priority) => {
    switch (priority.level) {
      case 1: return 'text-success-600 bg-success-50 border-success-200'
      case 2: return 'text-warning-600 bg-warning-50 border-warning-200'
      case 3: return 'text-orange-600 bg-orange-50 border-orange-200'
      case 4: return 'text-error-600 bg-error-50 border-error-200'
      default: return 'text-neutral-600 bg-neutral-50 border-neutral-200'
    }
  }

  return (
    <div className={`card ${className}`}>
      {/* Status announcements for screen readers */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </div>

      <div className="card-header">
        <h1 className="text-xl font-semibold">
          {mode === 'create' ? 'Novo Ticket' : 'Editar Ticket'}
        </h1>
        <p className="text-sm text-description">
          {mode === 'create'
            ? 'Preencha as informações para criar um novo ticket'
            : 'Atualize as informações do ticket'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card-body space-y-6" aria-label={mode === 'create' ? 'Formulário de criação de ticket' : 'Formulário de edição de ticket'} noValidate>
        {/* Title */}
        <div>
          <label htmlFor="ticket-title" className="label label-text font-medium">
            Título do Ticket *
          </label>
          <input
            id="ticket-title"
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Descreva brevemente o problema ou solicitação"
            className="input input-bordered w-full"
            maxLength={255}
            required
            aria-required="true"
            aria-label="Título do ticket"
            aria-describedby={fieldErrors.title ? "title-error title-description" : "title-description"}
            aria-invalid={fieldErrors.title ? 'true' : 'false'}
          />
          <span id="title-description" className="sr-only">Digite um título breve e descritivo para o ticket, máximo de 255 caracteres</span>
          {fieldErrors.title && (
            <p id="title-error" className="mt-1 text-sm text-error-600" role="alert">
              {fieldErrors.title}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="ticket-description" className="label label-text font-medium">
            Descrição Detalhada *
          </label>
          <textarea
            id="ticket-description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Forneça todos os detalhes relevantes sobre o problema ou solicitação..."
            className="textarea textarea-bordered w-full h-32"
            required
            aria-required="true"
            aria-label="Descrição detalhada do ticket"
            aria-describedby={fieldErrors.description ? "description-error description-help" : "description-help"}
            aria-invalid={fieldErrors.description ? 'true' : 'false'}
          />
          <span id="description-help" className="sr-only">Forneça todos os detalhes relevantes sobre o problema ou solicitação</span>
          {fieldErrors.description && (
            <p id="description-error" className="mt-1 text-sm text-error-600" role="alert">
              {fieldErrors.description}
            </p>
          )}
        </div>

        {/* Category and Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="ticket-category" className="label label-text font-medium">
              Categoria *
            </label>
            <select
              id="ticket-category"
              value={formData.category_id}
              onChange={(e) => handleInputChange('category_id', e.target.value)}
              className="select select-bordered w-full"
              required
              aria-required="true"
              aria-label="Categoria do ticket"
              aria-describedby={fieldErrors.category_id ? "category-error category-help" : "category-help"}
              aria-invalid={fieldErrors.category_id ? 'true' : 'false'}
            >
              <option value="">Selecione uma categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <span id="category-help" className="sr-only">Selecione a categoria que melhor se aplica ao ticket</span>
            {fieldErrors.category_id && (
              <p id="category-error" className="mt-1 text-sm text-error-600" role="alert">
                {fieldErrors.category_id}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ticket-priority" className="label label-text font-medium">
              Prioridade *
            </label>
            <select
              id="ticket-priority"
              value={formData.priority_id}
              onChange={(e) => handleInputChange('priority_id', e.target.value)}
              className="select select-bordered w-full"
              required
              aria-required="true"
              aria-label="Prioridade do ticket"
              aria-describedby={fieldErrors.priority_id ? "priority-error priority-help" : "priority-help"}
              aria-invalid={fieldErrors.priority_id ? 'true' : 'false'}
            >
              <option value="">Selecione uma prioridade</option>
              {priorities.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.name} - {priority.description}
                </option>
              ))}
            </select>
            <span id="priority-help" className="sr-only">Selecione o nível de prioridade do ticket</span>
            {fieldErrors.priority_id && (
              <p id="priority-error" className="mt-1 text-sm text-error-600" role="alert">
                {fieldErrors.priority_id}
              </p>
            )}
            {formData.priority_id && (
              <div className="mt-2">
                {(() => {
                  const selectedPriority = priorities.find(p => p.id.toString() === formData.priority_id)
                  if (!selectedPriority) return null
                  return (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(selectedPriority)}`}>
                      {selectedPriority.name}
                    </span>
                  )
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Assigned Agent (Admin/Agent only) */}
        {(userRole === 'admin' || userRole === 'agent') && (
          <div>
            <label htmlFor="assigned-agent" className="label label-text font-medium">
              <UserIcon className="h-4 w-4 mr-1" aria-hidden="true" />
              Agente Responsável
            </label>
            <select
              id="assigned-agent"
              value={formData.assigned_agent_id}
              onChange={(e) => handleInputChange('assigned_agent_id', e.target.value)}
              className="select select-bordered w-full"
              aria-label="Agente responsável pelo ticket"
              aria-describedby="agent-help"
            >
              <option value="">Não atribuído</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.email})
                </option>
              ))}
            </select>
            <span id="agent-help" className="sr-only">Selecione o agente que será responsável por este ticket</span>
          </div>
        )}

        {/* Tags */}
        <div>
          <label htmlFor="tag-input" className="label label-text font-medium">
            <TagIcon className="h-4 w-4 mr-1" aria-hidden="true" />
            Tags
          </label>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2" role="list" aria-label="Tags do ticket">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="badge badge-outline flex items-center gap-1"
                  role="listitem"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleTagRemove(tag)}
                    className="hover:text-error-500"
                    aria-label={`Remover tag ${tag}`}
                  >
                    <XMarkIcon className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleTagAdd(tagInput)
                  }
                }}
                placeholder="Digite uma tag e pressione Enter"
                className="input input-bordered flex-1"
                aria-label="Adicionar nova tag"
                aria-describedby="tag-help"
              />
              <span id="tag-help" className="sr-only">Digite uma tag e pressione Enter ou clique no botão Adicionar</span>
              <button
                type="button"
                onClick={() => handleTagAdd(tagInput)}
                className="btn btn-outline"
                disabled={!tagInput.trim()}
                aria-label="Adicionar tag"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* File Attachments */}
        <div>
          <label className="label label-text font-medium">
            <PaperClipIcon className="h-4 w-4 mr-1" aria-hidden="true" />
            Anexos
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="region"
            aria-label="Área de upload de arquivos"
          >
            <PaperClipIcon className="h-8 w-8 mx-auto text-neutral-400 mb-2" aria-hidden="true" />
            <p className="text-sm text-description mb-2">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFileChange(e.target.files)}
              className="hidden"
              id="file-upload"
              aria-label="Selecionar arquivos para upload"
              aria-describedby="file-upload-description"
            />
            <span id="file-upload-description" className="sr-only">Selecione um ou mais arquivos para anexar ao ticket</span>
            <label
              htmlFor="file-upload"
              className="btn btn-outline btn-sm cursor-pointer"
              role="button"
              tabIndex={0}
            >
              Selecionar Arquivos
            </label>
          </div>

          {/* File List */}
          {formData.attachments.length > 0 && (
            <div className="mt-4 space-y-2" role="list" aria-label="Arquivos anexados">
              {formData.attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                  role="listitem"
                >
                  <div className="flex items-center space-x-3">
                    <PaperClipIcon className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {file.name}
                    </span>
                    <span className="text-xs text-neutral-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFileRemove(index)}
                    className="text-error-500 hover:text-error-600"
                    aria-label={`Remover arquivo ${file.name}`}
                  >
                    <XMarkIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="alert alert-error" role="alert" aria-live="assertive">
            <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="status" aria-live="polite">
            <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
            <span>{success}</span>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-outline order-2 sm:order-1"
            disabled={loading}
            aria-label="Cancelar e voltar"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary order-1 sm:order-2 sm:ml-auto"
            disabled={loading}
            aria-label={mode === 'create' ? 'Criar ticket' : 'Salvar alterações do ticket'}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm" aria-hidden="true"></span>
                {mode === 'create' ? 'Criando...' : 'Salvando...'}
              </>
            ) : (
              mode === 'create' ? 'Criar Ticket' : 'Salvar Alterações'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}