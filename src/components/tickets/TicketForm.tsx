'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  PaperClipIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TagIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import { Ticket } from './TicketCard'
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

interface TicketFormProps {
  ticket?: Partial<Ticket>
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
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const [categoriesRes, prioritiesRes, agentsRes] = await Promise.all([
        fetch('/api/categories', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/priorities', { headers: { 'Authorization': `Bearer ${token}` } }),
        userRole === 'admin' || userRole === 'agent'
          ? fetch('/api/agents', { headers: { 'Authorization': `Bearer ${token}` } })
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
      console.error('Error fetching form data:', error)
    }
  }

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
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
    if (!formData.title.trim()) {
      setError('O título é obrigatório')
      return false
    }
    if (!formData.description.trim()) {
      setError('A descrição é obrigatória')
      return false
    }
    if (!formData.category_id) {
      setError('Selecione uma categoria')
      return false
    }
    if (!formData.priority_id) {
      setError('Selecione uma prioridade')
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
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/auth/login')
        return
      }

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
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      })

      const data = await response.json()

      if (response.ok) {
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
      <div className="card-header">
        <h2 className="text-xl font-semibold">
          {mode === 'create' ? 'Novo Ticket' : 'Editar Ticket'}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {mode === 'create'
            ? 'Preencha as informações para criar um novo ticket'
            : 'Atualize as informações do ticket'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card-body space-y-6">
        {/* Title */}
        <div>
          <label className="label label-text font-medium">
            Título do Ticket *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="Descreva brevemente o problema ou solicitação"
            className="input input-bordered w-full"
            maxLength={255}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="label label-text font-medium">
            Descrição Detalhada *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Forneça todos os detalhes relevantes sobre o problema ou solicitação..."
            className="textarea textarea-bordered w-full h-32"
            required
          />
        </div>

        {/* Category and Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label label-text font-medium">
              Categoria *
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => handleInputChange('category_id', e.target.value)}
              className="select select-bordered w-full"
              required
            >
              <option value="">Selecione uma categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label label-text font-medium">
              Prioridade *
            </label>
            <select
              value={formData.priority_id}
              onChange={(e) => handleInputChange('priority_id', e.target.value)}
              className="select select-bordered w-full"
              required
            >
              <option value="">Selecione uma prioridade</option>
              {priorities.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.name} - {priority.description}
                </option>
              ))}
            </select>
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
            <label className="label label-text font-medium">
              <UserIcon className="h-4 w-4 mr-1" />
              Agente Responsável
            </label>
            <select
              value={formData.assigned_agent_id}
              onChange={(e) => handleInputChange('assigned_agent_id', e.target.value)}
              className="select select-bordered w-full"
            >
              <option value="">Não atribuído</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.email})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="label label-text font-medium">
            <TagIcon className="h-4 w-4 mr-1" />
            Tags
          </label>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="badge badge-outline flex items-center gap-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleTagRemove(tag)}
                    className="hover:text-error-500"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
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
              />
              <button
                type="button"
                onClick={() => handleTagAdd(tagInput)}
                className="btn btn-outline"
                disabled={!tagInput.trim()}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>

        {/* File Attachments */}
        <div>
          <label className="label label-text font-medium">
            <PaperClipIcon className="h-4 w-4 mr-1" />
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
          >
            <PaperClipIcon className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <input
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFileChange(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="btn btn-outline btn-sm cursor-pointer"
            >
              Selecionar Arquivos
            </label>
          </div>

          {/* File List */}
          {formData.attachments.length > 0 && (
            <div className="mt-4 space-y-2">
              {formData.attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <PaperClipIcon className="h-4 w-4 text-neutral-400" />
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
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="alert alert-error">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <CheckCircleIcon className="h-5 w-5" />
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
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn btn-primary order-1 sm:order-2 sm:ml-auto"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
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