'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AdminCard } from '@/src/components/admin/AdminCard'
import { AdminButton } from '@/src/components/admin/AdminButton'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { logger } from '@/lib/monitoring/logger';

interface User {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

export default function EditUserPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const userId = params.id as string

  useEffect(() => {
    fetchUser()
  }, [userId])

  const fetchUser = async () => {
    try {
      setLoading(true)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/admin/users/${userId}`, {
        credentials: 'include' // Use httpOnly cookies
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Usuário não encontrado')
        } else if (response.status === 403) {
          setError('Acesso negado')
        } else {
          setError('Erro ao carregar usuário')
        }
        return
      }

      const data = await response.json()
      setUser(data.user)
      setFormData({
        name: data.user.name,
        email: data.user.email,
        role: data.user.role
      })
    } catch (error) {
      logger.error('Erro ao buscar usuário', error)
      setError('Erro ao carregar usuário')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Limpar erro do campo quando usuário começar a digitar
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setSaving(true)

      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Use httpOnly cookies
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.error === 'Email já está em uso') {
          setErrors({ email: 'Email já está em uso' })
        } else {
          alert('Erro ao atualizar usuário: ' + (errorData.error || 'Erro desconhecido'))
        }
        return
      }

      router.push('/admin/users')
    } catch (error) {
      logger.error('Erro ao atualizar usuário', error)
      alert('Erro ao atualizar usuário')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando usuário...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro</h1>
          <p className="text-gray-600 mb-4">{error || 'Usuário não encontrado'}</p>
          <AdminButton variant="primary" onClick={() => router.back()}>
            Voltar
          </AdminButton>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Editar Usuário
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Editar informações do usuário {user.name}
            </p>
          </div>
        </div>

        {/* Formulário */}
        <AdminCard>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Digite o nome completo"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Digite o email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Usuário *
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="user">Usuário</option>
                <option value="agent">Agente</option>
                <option value="admin">Administrador</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                <strong>Usuário:</strong> Pode criar e visualizar seus próprios tickets<br/>
                <strong>Agente:</strong> Pode gerenciar tickets atribuídos a ele<br/>
                <strong>Administrador:</strong> Acesso completo ao sistema
              </p>
            </div>

            {/* Informações do usuário */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Informações do Usuário</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-500">ID:</span>
                  <p className="text-gray-900">#{user.id}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Criado em:</span>
                  <p className="text-gray-900">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <AdminButton
                variant="secondary"
                onClick={() => router.back()}
                className="flex items-center"
              >
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cancelar
              </AdminButton>
              <AdminButton
                variant="primary"
                type="submit"
                disabled={saving}
                className="flex items-center"
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
              </AdminButton>
            </div>
          </form>
        </AdminCard>
      </div>
  )
}
