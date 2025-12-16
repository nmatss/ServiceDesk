'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  ExclamationTriangleIcon,
  PlusCircleIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  ExclamationCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

interface TicketType {
  id: number
  name: string
  slug: string
  description: string
  icon: string
  color: string
  workflow_type: 'incident' | 'request' | 'change' | 'problem'
  sla_required: boolean
  approval_required: boolean
}

interface Category {
  id: number
  name: string
  description: string
  color: string
  icon: string
}

interface Priority {
  id: number
  name: string
  level: number
  color: string
  description: string
}

const impactOptions = [
  { value: 1, label: 'Crítico', description: 'Organização inteira afetada', color: '#EF4444' },
  { value: 2, label: 'Alto', description: 'Departamento inteiro afetado', color: '#F97316' },
  { value: 3, label: 'Médio', description: 'Múltiplos usuários afetados', color: '#EAB308' },
  { value: 4, label: 'Baixo', description: 'Usuário individual afetado', color: '#22C55E' },
  { value: 5, label: 'Mínimo', description: 'Impacto insignificante', color: '#6B7280' }
]

const urgencyOptions = [
  { value: 1, label: 'Crítica', description: 'Trabalho parado', color: '#EF4444' },
  { value: 2, label: 'Alta', description: 'Trabalho severamente prejudicado', color: '#F97316' },
  { value: 3, label: 'Média', description: 'Trabalho pode continuar', color: '#EAB308' },
  { value: 4, label: 'Baixa', description: 'Trabalho minimamente afetado', color: '#22C55E' },
  { value: 5, label: 'Planejamento', description: 'Pode aguardar', color: '#6B7280' }
]

export default function CreateTicketPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const typeSlug = searchParams.get('type')

  const [ticketType, setTicketType] = useState<TicketType | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    priority_id: '',
    impact: 3,
    urgency: 3,
    affected_users_count: 1,
    business_service: '',
    location: '',
    contact_name: '',
    contact_email: '',
    contact_phone: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (typeSlug) {
      fetchTicketType(typeSlug)
    }
    fetchCategories()
    fetchPriorities()
  }, [typeSlug])

  const fetchTicketType = async (slug: string) => {
    try {
      const response = await fetch('/api/ticket-types?customer_visible=true')
      const data = await response.json()

      if (data.success) {
        const type = data.ticket_types.find((t: TicketType) => t.slug === slug)
        if (type) {
          setTicketType(type)
        } else {
          router.push('/portal')
        }
      }
    } catch (error) {
      logger.error('Error fetching ticket type', error)
      router.push('/portal')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      if (data.success) {
        setCategories(data.categories)
      }
    } catch (error) {
      logger.error('Error fetching categories', error)
    }
  }

  const fetchPriorities = async () => {
    try {
      const response = await fetch('/api/priorities')
      const data = await response.json()
      if (data.success) {
        setPriorities(data.priorities)
      }
    } catch (error) {
      logger.error('Error fetching priorities', error)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Título é obrigatório'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Descrição é obrigatória'
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Categoria é obrigatória'
    }

    if (!formData.priority_id) {
      newErrors.priority_id = 'Prioridade é obrigatória'
    }

    if (!formData.contact_name.trim()) {
      newErrors.contact_name = 'Nome é obrigatório'
    }

    if (!formData.contact_email.trim()) {
      newErrors.contact_email = 'Email é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Email inválido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    if (!ticketType) {
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/tickets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          ticket_type_id: ticketType.id
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/portal/ticket/${data.ticket.id}?created=true`)
      } else {
        setErrors({ submit: data.error || 'Erro ao criar ticket' })
      }
    } catch (error) {
      logger.error('Error creating ticket', error)
      setErrors({ submit: 'Erro ao criar ticket' })
    } finally {
      setSubmitting(false)
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const getWorkflowInfo = () => {
    if (!ticketType) return null

    switch (ticketType.workflow_type) {
      case 'incident':
        return {
          color: '#EF4444',
          icon: ExclamationTriangleIcon,
          helpText: 'Incidentes são priorizados para resolução rápida. Nossa equipe será notificada imediatamente.'
        }
      case 'request':
        return {
          color: '#10B981',
          icon: PlusCircleIcon,
          helpText: ticketType.approval_required
            ? 'Esta solicitação passará por aprovação antes do atendimento.'
            : 'Sua solicitação será processada em ordem de chegada.'
        }
      case 'change':
        return {
          color: '#F59E0B',
          icon: ArrowPathIcon,
          helpText: 'Mudanças são analisadas pelo comitê de mudanças antes da implementação.'
        }
      default:
        return {
          color: '#6B7280',
          icon: InformationCircleIcon,
          helpText: 'Sua solicitação será analisada pela equipe técnica.'
        }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!ticketType) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationCircleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tipo de ticket não encontrado</h2>
          <button
            onClick={() => router.push('/portal')}
            className="text-blue-600 hover:text-blue-700"
          >
            Voltar à página inicial
          </button>
        </div>
      </div>
    )
  }

  const workflowInfo = getWorkflowInfo()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/portal')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: ticketType.color + '20', color: ticketType.color }}
              >
                {workflowInfo && <workflowInfo.icon className="w-6 h-6" />}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Criar {ticketType.name}
                </h1>
                <p className="text-gray-600">{ticketType.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workflow Info */}
        {workflowInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5" />
              <p className="text-blue-800">{workflowInfo.helpText}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" aria-label="Formulário de criação de ticket">
          {/* Basic Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Informações Básicas
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="ticket-title" className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  id="ticket-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateFormData('title', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Descreva brevemente o problema ou solicitação"
                  required
                  aria-required="true"
                  aria-label="Título do ticket"
                  aria-describedby={errors.title ? 'title-error' : 'title-help'}
                  aria-invalid={errors.title ? 'true' : 'false'}
                />
                {errors.title ? (
                  <p id="title-error" className="text-red-600 text-sm mt-1" role="alert">{errors.title}</p>
                ) : (
                  <span id="title-help" className="sr-only">Digite um título breve e descritivo para o ticket</span>
                )}
              </div>

              <div>
                <label htmlFor="ticket-description" className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição Detalhada *
                </label>
                <textarea
                  id="ticket-description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Descreva detalhadamente o problema ou solicitação, incluindo passos para reproduzir (se aplicável)"
                  required
                  aria-required="true"
                  aria-label="Descrição detalhada"
                  aria-describedby={errors.description ? 'description-error' : 'description-help'}
                  aria-invalid={errors.description ? 'true' : 'false'}
                />
                {errors.description ? (
                  <p id="description-error" className="text-red-600 text-sm mt-1" role="alert">{errors.description}</p>
                ) : (
                  <span id="description-help" className="sr-only">Descreva detalhadamente o problema ou solicitação</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    id="category"
                    value={formData.category_id}
                    onChange={(e) => updateFormData('category_id', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.category_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                    aria-required="true"
                    aria-label="Categoria do ticket"
                    aria-describedby={errors.category_id ? 'category-error' : undefined}
                    aria-invalid={errors.category_id ? 'true' : 'false'}
                  >
                    <option value="">Selecione uma categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errors.category_id && <p id="category-error" className="text-red-600 text-sm mt-1" role="alert">{errors.category_id}</p>}
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridade *
                  </label>
                  <select
                    id="priority"
                    value={formData.priority_id}
                    onChange={(e) => updateFormData('priority_id', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.priority_id ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                    aria-required="true"
                    aria-label="Prioridade do ticket"
                    aria-describedby={errors.priority_id ? 'priority-error' : undefined}
                    aria-invalid={errors.priority_id ? 'true' : 'false'}
                  >
                    <option value="">Selecione uma prioridade</option>
                    {priorities.map((priority) => (
                      <option key={priority.id} value={priority.id}>
                        {priority.name}
                      </option>
                    ))}
                  </select>
                  {errors.priority_id && <p id="priority-error" className="text-red-600 text-sm mt-1" role="alert">{errors.priority_id}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Impact and Urgency (for incidents) */}
          {ticketType.workflow_type === 'incident' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Impacto e Urgência
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Impacto
                  </label>
                  <div className="space-y-2">
                    {impactOptions.map((option) => (
                      <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="impact"
                          value={option.value}
                          checked={formData.impact === option.value}
                          onChange={(e) => updateFormData('impact', parseInt(e.target.value))}
                          className="text-blue-600"
                          aria-label={`Impacto ${option.label}: ${option.description}`}
                        />
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: option.color }}
                            aria-hidden="true"
                          ></span>
                          <div>
                            <span className="font-medium">{option.label}</span>
                            <span className="text-sm text-gray-500 ml-2">{option.description}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Urgência
                  </label>
                  <div className="space-y-2">
                    {urgencyOptions.map((option) => (
                      <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="urgency"
                          value={option.value}
                          checked={formData.urgency === option.value}
                          onChange={(e) => updateFormData('urgency', parseInt(e.target.value))}
                          className="text-blue-600"
                          aria-label={`Urgência ${option.label}: ${option.description}`}
                        />
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: option.color }}
                            aria-hidden="true"
                          ></span>
                          <div>
                            <span className="font-medium">{option.label}</span>
                            <span className="text-sm text-gray-500 ml-2">{option.description}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Informações Adicionais
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuários Afetados
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.affected_users_count}
                  onChange={(e) => updateFormData('affected_users_count', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Localização
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => updateFormData('location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Prédio, sala, andar..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Serviço de Negócio Afetado
                </label>
                <input
                  type="text"
                  value={formData.business_service}
                  onChange={(e) => updateFormData('business_service', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sistema, aplicação ou serviço específico"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Informações de Contato
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => updateFormData('contact_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.contact_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Seu nome completo"
                />
                {errors.contact_name && <p className="text-red-600 text-sm mt-1">{errors.contact_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => updateFormData('contact_email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.contact_email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="seu.email@empresa.com"
                />
                {errors.contact_email && <p className="text-red-600 text-sm mt-1">{errors.contact_email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => updateFormData('contact_phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push('/portal')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              aria-label={`Criar ${ticketType.name}`}
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" aria-hidden="true"></div>
                  <span>Criando...</span>
                </>
              ) : (
                <span>Criar {ticketType.name}</span>
              )}
            </button>
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert" aria-live="assertive">
              <p className="text-red-800">{errors.submit}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}