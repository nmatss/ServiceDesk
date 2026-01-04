'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckIcon, XMarkIcon, UserIcon } from '@heroicons/react/24/outline'
import { logger } from '@/lib/monitoring/logger'
import PageHeader from '@/components/ui/PageHeader'

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
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-4 text-description">Carregando usuário...</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center animate-fade-in">
          <div className="text-error-600 dark:text-error-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Erro</h1>
          <p className="text-description mb-4">{error || 'Usuário não encontrado'}</p>
          <button className="btn btn-primary" onClick={() => router.back()}>
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Usuário"
        description={`Editar informações do usuário ${user.name}`}
        icon={UserIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Usuários', href: '/admin/users' },
          { label: 'Editar' }
        ]}
      />

      {/* Formulário */}
      <div className="glass-panel p-6 animate-slide-up">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Nome Completo *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`input ${
                errors.name ? 'border-error-300 dark:border-error-700 focus:ring-error-500' : ''
              }`}
              placeholder="Digite o nome completo"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-error-600 dark:text-error-400 animate-fade-in">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`input ${
                errors.email ? 'border-error-300 dark:border-error-700 focus:ring-error-500' : ''
              }`}
              placeholder="Digite o email"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-error-600 dark:text-error-400 animate-fade-in">{errors.email}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Tipo de Usuário *
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="input"
            >
              <option value="user">Usuário</option>
              <option value="agent">Agente</option>
              <option value="admin">Administrador</option>
            </select>
            <div className="mt-3 space-y-2 text-sm text-description">
              <div className="flex items-start space-x-2">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 min-w-[120px]">Usuário:</span>
                <span>Pode criar e visualizar seus próprios tickets</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 min-w-[120px]">Agente:</span>
                <span>Pode gerenciar tickets atribuídos a ele</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="font-semibold text-neutral-700 dark:text-neutral-300 min-w-[120px]">Administrador:</span>
                <span>Acesso completo ao sistema</span>
              </div>
            </div>
          </div>

          {/* Informações do usuário */}
          <div className="bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-xl border border-neutral-200 dark:border-neutral-700 animate-fade-in">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Informações do Usuário</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-content uppercase tracking-wider">ID</span>
                <p className="text-neutral-900 dark:text-neutral-100 font-mono">#{user.id}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-content uppercase tracking-wider">Criado em</span>
                <p className="text-neutral-900 dark:text-neutral-100">
                  {new Date(user.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-secondary"
            >
              <XMarkIcon className="h-5 w-5 mr-2" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <CheckIcon className="h-5 w-5 mr-2" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
