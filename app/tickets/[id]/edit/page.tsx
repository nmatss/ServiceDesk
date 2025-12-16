'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline'
import { logger } from '@/lib/monitoring/logger';

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
      alert('Título e descrição são obrigatórios')
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
      alert('Erro ao atualizar ticket')
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro</h1>
          <p className="text-gray-600 mb-4">{error || 'Ticket não encontrado'}</p>
          <button
            onClick={() => router.back()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Voltar
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900">Editar Ticket #{ticket.id}</h1>
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Título */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Título *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            {/* Descrição */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Descrição *
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            {/* Categoria e Prioridade */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria *
                </label>
                <select
                  id="category_id"
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                <label htmlFor="priority_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridade *
                </label>
                <select
                  id="priority_id"
                  name="priority_id"
                  value={formData.priority_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="status_id" className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  id="status_id"
                  name="status_id"
                  value={formData.status_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700 mb-2">
                  Atribuir a
                </label>
                <select
                  id="assigned_to"
                  name="assigned_to"
                  value={formData.assigned_to}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Salvar Alterações
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
