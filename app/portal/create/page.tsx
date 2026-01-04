'use client'

import { useState, useEffect, useCallback, memo, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { logger } from '@/lib/monitoring/logger';
import { customToast } from '@/components/ui/toast'

// Lazy load heavy components
const Button = dynamic(() => import('@/components/ui/Button').then(mod => ({ default: mod.Button })), {
  loading: () => <button className="h-10 px-4 py-2 bg-neutral-200 animate-pulse rounded-md" />,
  ssr: true
})

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

// Memoized radio option component to prevent re-renders
const RadioOption = memo(({
  option,
  checked,
  name,
  onChange
}: {
  option: { value: number; label: string; description: string; color: string }
  checked: boolean
  name: string
  onChange: (value: number) => void
}) => (
  <label className="flex items-center space-x-3 cursor-pointer">
    <input
      type="radio"
      name={name}
      value={option.value}
      checked={checked}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="text-brand-600"
      aria-label={`${name} ${option.label}: ${option.description}`}
    />
    <div className="flex items-center space-x-2">
      <span
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: option.color }}
        aria-hidden="true"
      ></span>
      <div>
        <span className="font-medium">{option.label}</span>
        <span className="text-sm text-neutral-500 ml-2">{option.description}</span>
      </div>
    </div>
  </label>
))

RadioOption.displayName = 'RadioOption'

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
    // Fetch all data in parallel to reduce loading time
    const fetchAllData = async () => {
      const startTime = performance.now()

      try {
        // Use cache-friendly fetch with stale-while-revalidate
        const fetchOptions = {
          next: { revalidate: 1800 }, // 30 minutes
          headers: {
            'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600'
          }
        }

        const [ticketTypesRes, categoriesRes, prioritiesRes] = await Promise.all([
          fetch('/api/ticket-types?customer_visible=true', fetchOptions),
          fetch('/api/categories', fetchOptions),
          fetch('/api/priorities', fetchOptions)
        ])

        const [ticketTypesData, categoriesData, prioritiesData] = await Promise.all([
          ticketTypesRes.json(),
          categoriesRes.json(),
          prioritiesRes.json()
        ])

        // Set categories and priorities immediately for faster rendering
        if (categoriesData.success) {
          setCategories(categoriesData.categories)
        }
        if (prioritiesData.success) {
          setPriorities(prioritiesData.priorities)
        }

        // Find and set ticket type if slug provided
        if (typeSlug && ticketTypesData.success) {
          const type = ticketTypesData.ticket_types.find((t: TicketType) => t.slug === typeSlug)
          if (type) {
            setTicketType(type)
          } else {
            router.push('/portal')
          }
        }

        const loadTime = performance.now() - startTime
        logger.performance('Portal create page data loaded', loadTime)
      } catch (error) {
        logger.error('Error fetching data', error)
        customToast.error('Erro ao carregar dados. Redirecionando...')
        setTimeout(() => router.push('/portal'), 1500)
      } finally {
        setLoading(false)
      }
    }

    fetchAllData()
  }, [typeSlug, router])

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
      customToast.error('Por favor, preencha todos os campos obrigatórios')
      return
    }

    if (!ticketType) {
      return
    }

    setSubmitting(true)

    // Show loading toast
    const loadingToast = customToast.loading('Criando ticket...')

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

      // Dismiss loading toast
      customToast.dismiss(loadingToast)

      if (data.success) {
        customToast.success('Ticket criado com sucesso!')
        // Small delay to show success message before redirect
        setTimeout(() => {
          router.push(`/portal/ticket/${data.ticket.id}?created=true`)
        }, 500)
      } else {
        setErrors({ submit: data.error || 'Erro ao criar ticket' })
        customToast.error(data.error || 'Erro ao criar ticket')
      }
    } catch (error) {
      logger.error('Error creating ticket', error)
      customToast.dismiss(loadingToast)
      setErrors({ submit: 'Erro ao criar ticket' })
      customToast.error('Erro ao criar ticket. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const updateFormData = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      if (prev[field]) {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      }
      return prev
    })
  }, [])

  const workflowInfo = useMemo(() => {
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
  }, [ticketType])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 animate-fade-in">
        {/* Header Skeleton */}
        <div className="glass-panel shadow-sm border-b backdrop-blur-lg">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="h-6 w-48 bg-neutral-200 rounded animate-pulse mb-3"></div>
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9 bg-neutral-200 rounded-lg animate-pulse"></div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-neutral-200 rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-6 w-48 bg-neutral-200 rounded animate-pulse"></div>
                  <div className="h-4 w-64 bg-neutral-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Skeleton */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            {/* Info Banner Skeleton */}
            <div className="h-16 bg-brand-100 rounded-lg animate-pulse"></div>

            {/* Form Sections */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-panel rounded-lg border border-neutral-200 p-6">
                <div className="h-6 w-40 bg-neutral-200 rounded animate-pulse mb-4"></div>
                <div className="space-y-4">
                  <div className="h-10 bg-neutral-100 rounded animate-pulse"></div>
                  <div className="h-32 bg-neutral-100 rounded animate-pulse"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-10 bg-neutral-100 rounded animate-pulse"></div>
                    <div className="h-10 bg-neutral-100 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}

            {/* Button Skeleton */}
            <div className="flex justify-between">
              <div className="h-10 w-24 bg-neutral-200 rounded animate-pulse"></div>
              <div className="h-10 w-40 bg-brand-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!ticketType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center glass-panel p-8 rounded-xl animate-fade-in">
          <ExclamationCircleIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Tipo de ticket não encontrado</h2>
          <button
            onClick={() => router.push('/portal')}
            className="text-brand-600 hover:text-brand-700 transition-colors"
          >
            Voltar à página inicial
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-indigo-100 animate-fade-in">
      {/* Header */}
      <div className="glass-panel shadow-sm border-b backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Breadcrumbs */}
          <nav className="flex mb-3" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm">
              <li className="flex items-center">
                <Link href="/portal" className="text-neutral-600 hover:text-brand-600">
                  Portal
                </Link>
              </li>
              <li className="flex items-center">
                <svg
                  className="h-4 w-4 text-neutral-400 mx-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-neutral-900 font-medium">Criar Solicitação</span>
              </li>
            </ol>
          </nav>

          <div className="flex items-center space-x-4 animate-slide-up">
            <button
              onClick={() => router.push('/portal')}
              className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all duration-200"
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
                <h1 className="text-xl font-semibold text-neutral-900">
                  Criar {ticketType.name}
                </h1>
                <p className="text-neutral-600">{ticketType.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workflow Info */}
        {workflowInfo && (
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-6 animate-slide-up">
            <div className="flex items-start space-x-3">
              <InformationCircleIcon className="w-5 h-5 text-brand-600 mt-0.5" />
              <p className="text-brand-800">{workflowInfo.helpText}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" aria-label="Formulário de criação de ticket">
          {/* Basic Information */}
          <div className="glass-panel rounded-lg border border-neutral-200 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Informações Básicas
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="ticket-title" className="block text-sm font-medium text-neutral-700 mb-2">
                  Título *
                </label>
                <input
                  id="ticket-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateFormData('title', e.target.value)}
                  className={`input hover-lift ${errors.title ? 'input-error' : ''}`}
                  placeholder="Descreva brevemente o problema ou solicitação"
                  required
                  aria-required="true"
                  aria-label="Título do ticket"
                  aria-describedby={errors.title ? 'title-error' : 'title-help'}
                  aria-invalid={errors.title ? 'true' : 'false'}
                />
                {errors.title ? (
                  <p id="title-error" className="text-error-600 text-sm mt-1" role="alert">{errors.title}</p>
                ) : (
                  <span id="title-help" className="sr-only">Digite um título breve e descritivo para o ticket</span>
                )}
              </div>

              <div>
                <label htmlFor="ticket-description" className="block text-sm font-medium text-neutral-700 mb-2">
                  Descrição Detalhada *
                </label>
                <textarea
                  id="ticket-description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  className={`input hover-lift ${errors.description ? 'input-error' : ''}`}
                  placeholder="Descreva detalhadamente o problema ou solicitação, incluindo passos para reproduzir (se aplicável)"
                  required
                  aria-required="true"
                  aria-label="Descrição detalhada"
                  aria-describedby={errors.description ? 'description-error' : 'description-help'}
                  aria-invalid={errors.description ? 'true' : 'false'}
                />
                {errors.description ? (
                  <p id="description-error" className="text-error-600 text-sm mt-1" role="alert">{errors.description}</p>
                ) : (
                  <span id="description-help" className="sr-only">Descreva detalhadamente o problema ou solicitação</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-neutral-700 mb-2">
                    Categoria *
                  </label>
                  <select
                    id="category"
                    value={formData.category_id}
                    onChange={(e) => updateFormData('category_id', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      errors.category_id ? 'border-error-300' : 'border-neutral-300'
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
                  {errors.category_id && <p id="category-error" className="text-error-600 text-sm mt-1" role="alert">{errors.category_id}</p>}
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-neutral-700 mb-2">
                    Prioridade *
                  </label>
                  <select
                    id="priority"
                    value={formData.priority_id}
                    onChange={(e) => updateFormData('priority_id', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      errors.priority_id ? 'border-error-300' : 'border-neutral-300'
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
                  {errors.priority_id && <p id="priority-error" className="text-error-600 text-sm mt-1" role="alert">{errors.priority_id}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Impact and Urgency (for incidents) */}
          {ticketType.workflow_type === 'incident' && (
            <div className="glass-panel rounded-lg border border-neutral-200 p-6 animate-slide-up">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                Impacto e Urgência
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    Impacto
                  </label>
                  <div className="space-y-2">
                    {impactOptions.map((option) => (
                      <RadioOption
                        key={option.value}
                        option={option}
                        checked={formData.impact === option.value}
                        name="impact"
                        onChange={(value) => updateFormData('impact', value)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-3">
                    Urgência
                  </label>
                  <div className="space-y-2">
                    {urgencyOptions.map((option) => (
                      <RadioOption
                        key={option.value}
                        option={option}
                        checked={formData.urgency === option.value}
                        name="urgency"
                        onChange={(value) => updateFormData('urgency', value)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Information */}
          <div className="glass-panel rounded-lg border border-neutral-200 p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Informações Adicionais
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Usuários Afetados
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.affected_users_count}
                  onChange={(e) => updateFormData('affected_users_count', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Localização
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => updateFormData('location', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Prédio, sala, andar..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Serviço de Negócio Afetado
                </label>
                <input
                  type="text"
                  value={formData.business_service}
                  onChange={(e) => updateFormData('business_service', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Sistema, aplicação ou serviço específico"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="glass-panel rounded-lg border border-neutral-200 p-6 animate-slide-up">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Informações de Contato
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => updateFormData('contact_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.contact_name ? 'border-error-300' : 'border-neutral-300'
                  }`}
                  placeholder="Seu nome completo"
                />
                {errors.contact_name && <p className="text-error-600 text-sm mt-1">{errors.contact_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => updateFormData('contact_email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.contact_email ? 'border-error-300' : 'border-neutral-300'
                  }`}
                  placeholder="seu.email@empresa.com"
                />
                {errors.contact_email && <p className="text-error-600 text-sm mt-1">{errors.contact_email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => updateFormData('contact_phone', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between animate-slide-up">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/portal')}
              className="hover-lift"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              loadingText="Criando..."
              className="hover-lift"
              aria-label={`Criar ${ticketType.name}`}
            >
              Criar {ticketType.name}
            </Button>
          </div>

          {errors.submit && (
            <div className="bg-error-50 border border-error-200 rounded-lg p-4" role="alert" aria-live="assertive">
              <p className="text-error-800">{errors.submit}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
