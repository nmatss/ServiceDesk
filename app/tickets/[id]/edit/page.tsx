'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline'
import { logger } from '@/lib/monitoring/logger'
import { PageHeader } from '@/components/ui/PageHeader'

interface Ticket {
  id: number
  title: string
  description: string
  category_id: number
  priority_id: number
  status_id: number
  assigned_to?: number
}

interface Category {
  id: number
  name: string
  color: string
}

interface Priority {
  id: number
  name: string
  level: number
  color: string
}

interface Status {
  id: number
  name: string
  color: string
  is_final: boolean
}

interface User {
  id: number
  name: string
  email: string
  role: string
}

export default function EditTicketPage() {
  const params = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [priorities, setPriorities] = useState<Priority[]>([])
  const [statuses, setStatuses] = useState<Status[]>([])
  const [agents, setAgents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: 0,
    priority_id: 0,
    status_id: 0,
    assigned_to: 0
  })

  const ticketId = params.id as string

  useEffect(() => {
    fetchData()
  }, [ticketId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // SECURITY: Use httpOnly cookies for authentication
      // Buscar dados em paralelo
      const [ticketRes, categoriesRes, prioritiesRes, statusesRes, agentsRes] = await Promise.all([
        fetch(`/api/tickets/${ticketId}`, {
          credentials: 'include' // Use httpOnly cookies
        }),
        fetch('/api/categories', {
          credentials: 'include' // Use httpOnly cookies
        }),
        fetch('/api/priorities', {
          credentials: 'include' // Use httpOnly cookies
        }),
        fetch('/api/statuses', {
          credentials: 'include' // Use httpOnly cookies
        }),
        fetch('/api/admin/users', {
          credentials: 'include' // Use httpOnly cookies
        })
      ])

      if (!ticketRes.ok) {
        if (ticketRes.status === 404) {
          setError('Ticket não encontrado')
        } else if (ticketRes.status === 403) {
          setError('Acesso negado')
        } else {
          setError('Erro ao carregar ticket')
        }
        return
      }

      const ticketData = await ticketRes.json()
      const categoriesData = await categoriesRes.json()
      const prioritiesData = await prioritiesRes.json()
      const statusesData = await statusesRes.json()
      const agentsData = await agentsRes.json()

      setTicket(ticketData.ticket)
      setCategories(categoriesData.categories)
      setPriorities(prioritiesData.priorities)
      setStatuses(statusesData.statuses)
      setAgents(agentsData.users.filter((user: User) => user.role === 'agent' || user.role === 'admin'))

      // Preencher formulário
      setFormData({
        title: ticketData.ticket.title,
        description: ticketData.ticket.description,
        category_id: ticketData.ticket.category_id,
        priority_id: ticketData.ticket.priority_id,
        status_id: ticketData.ticket.status_id,
        assigned_to: ticketData.ticket.assigned_to || 0
      })
    } catch (error) {
      logger.error('Erro ao buscar dados', error)
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Título e descrição são obrigatórios')
      return
    }

    try {
      setSaving(true)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Use httpOnly cookies
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          category_id: formData.category_id,
          priority_id: formData.priority_id,
          status_id: formData.status_id,
          assigned_to: formData.assigned_to || null
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao atualizar ticket')
      }

      router.push(`/tickets/${ticketId}`)
    } catch (error) {
      logger.error('Erro ao atualizar ticket', error)
      toast.error('Erro ao atualizar ticket')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'assigned_to' ? parseInt(value) || 0 : parseInt(value) || value
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 flex items-center justify-center">
        <div className="glass-panel p-8 text-center animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-neutral-200 dark:border-neutral-700 border-t-brand-600 dark:border-t-brand-400 mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 bg-brand-100 dark:bg-brand-900/30 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="mt-6 text-description font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900 flex items-center justify-center">
        <div className="glass-panel p-10 text-center max-w-md animate-fade-in">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">Erro</h1>
          <p className="text-description mb-6">{error || 'Ticket não encontrado'}</p>
          <button
            onClick={() => router.back()}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Voltar</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Breadcrumbs */}
        <PageHeader
          title={`Editar Ticket #${ticket.id}`}
          breadcrumbs={[
            { label: 'Tickets', href: '/tickets' },
            { label: `#${ticket.id}`, href: `/tickets/${ticket.id}` },
            { label: 'Editar' }
          ]}
        />

        {/* Formulário */}
        <div className="glass-panel animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Título */}
            <div className="animate-slide-up">
              <label htmlFor="title" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Título *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500"
                required
              />
            </div>

            {/* Descrição */}
            <div className="animate-slide-up" style={{ animationDelay: '50ms' }}>
              <label htmlFor="description" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Descrição *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={6}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all resize-none text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500"
                required
              />
            </div>

            {/* Categoria e Prioridade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <div>
                <label htmlFor="category_id" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Categoria *
                </label>
                <select
                  id="category_id"
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all text-neutral-900 dark:text-white"
                  required
                >
                  <option value={0}>Selecione uma categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="priority_id" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Prioridade *
                </label>
                <select
                  id="priority_id"
                  name="priority_id"
                  value={formData.priority_id}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all text-neutral-900 dark:text-white"
                  required
                >
                  <option value={0}>Selecione uma prioridade</option>
                  {priorities.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {priority.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status e Agente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
              <div>
                <label htmlFor="status_id" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Status *
                </label>
                <select
                  id="status_id"
                  name="status_id"
                  value={formData.status_id}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all text-neutral-900 dark:text-white"
                  required
                >
                  <option value={0}>Selecione um status</option>
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="assigned_to" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Atribuir a
                </label>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-brand-500 dark:focus:border-brand-400 transition-all text-neutral-900 dark:text-white"
                >
                  <option value={0}>Nenhum agente</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-neutral-200 dark:border-neutral-700 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary inline-flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    <span>Salvar Alterações</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
