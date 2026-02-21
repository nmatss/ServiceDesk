'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import {
  CheckIcon,
  XMarkIcon,
  UserPlusIcon,
  EnvelopeIcon,
  LockClosedIcon,
  UserCircleIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'
import { logger } from '@/lib/monitoring/logger'

export default function NewUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

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

    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não coincidem'
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
      setLoading(true)

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.error === 'Email já está em uso') {
          setErrors({ email: 'Email já está em uso' })
        } else {
          toast.error('Erro ao criar usuário: ' + (errorData.error || 'Erro desconhecido'))
        }
        return
      }

      router.push('/admin/users')
    } catch (error) {
      logger.error('Erro ao criar usuário', error)
      toast.error('Erro ao criar usuário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-blue-50/20 to-neutral-50 dark:from-neutral-950 dark:via-blue-950/20 dark:to-neutral-950">
      {/* Modern PageHeader with Breadcrumbs */}
      <div className="glass-panel sticky top-0 z-20 border-b border-neutral-200/50 dark:border-neutral-800/50 backdrop-blur-lg bg-white/80 dark:bg-neutral-900/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <PageHeader
            title="Novo Usuário"
            description="Criar um novo usuário no sistema"
            icon={UserPlusIcon}
            breadcrumbs={[
              { label: 'Admin', href: '/admin' },
              { label: 'Usuários', href: '/admin/users' },
              { label: 'Novo Usuário' }
            ]}
          />
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8">
        <div className="glass-panel rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm overflow-hidden animate-fade-in">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Nome */}
            <div className="animate-slide-up">
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Nome Completo *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserCircleIcon className="h-5 w-5 text-icon-muted" />
                </div>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-all ${
                    errors.name
                      ? 'border-red-300 dark:border-red-700 focus:ring-red-500 dark:focus:ring-red-400 bg-red-50 dark:bg-red-900/10'
                      : 'border-neutral-200 dark:border-neutral-700 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800'
                  } text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500`}
                  placeholder="Digite o nome completo"
                />
                {errors.name && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                  </div>
                )}
              </div>
              {errors.name && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Email *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-icon-muted" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-all ${
                    errors.email
                      ? 'border-red-300 dark:border-red-700 focus:ring-red-500 dark:focus:ring-red-400 bg-red-50 dark:bg-red-900/10'
                      : 'border-neutral-200 dark:border-neutral-700 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800'
                  } text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500`}
                  placeholder="Digite o email"
                />
                {errors.email && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                  </div>
                )}
              </div>
              {errors.email && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Senha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Senha *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-icon-muted" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-all ${
                      errors.password
                        ? 'border-red-300 dark:border-red-700 focus:ring-red-500 dark:focus:ring-red-400 bg-red-50 dark:bg-red-900/10'
                        : 'border-neutral-200 dark:border-neutral-700 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800'
                    } text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500`}
                    placeholder="Digite a senha"
                  />
                  {errors.password && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                    </div>
                  )}
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <ExclamationCircleIcon className="h-4 w-4" />
                    {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Confirmar Senha *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-icon-muted" />
                  </div>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-all ${
                      errors.confirmPassword
                        ? 'border-red-300 dark:border-red-700 focus:ring-red-500 dark:focus:ring-red-400 bg-red-50 dark:bg-red-900/10'
                        : 'border-neutral-200 dark:border-neutral-700 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800'
                    } text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500`}
                    placeholder="Confirme a senha"
                  />
                  {errors.confirmPassword && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                    </div>
                  )}
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <ExclamationCircleIcon className="h-4 w-4" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            {/* Role */}
            <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <label htmlFor="role" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Tipo de Usuário *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ShieldCheckIcon className="h-5 w-5 text-icon-muted" />
                </div>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent bg-white/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800 transition-all text-neutral-900 dark:text-neutral-100 appearance-none cursor-pointer"
                >
                  <option value="user">Usuário</option>
                  <option value="agent">Agente</option>
                  <option value="admin">Administrador</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-icon-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50">
                <p className="text-sm text-description space-y-1">
                  <span className="flex items-start gap-2">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300 min-w-fit">Usuário:</span>
                    <span>Pode criar e visualizar seus próprios tickets</span>
                  </span>
                  <span className="flex items-start gap-2">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300 min-w-fit">Agente:</span>
                    <span>Pode gerenciar tickets atribuídos a ele</span>
                  </span>
                  <span className="flex items-start gap-2">
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300 min-w-fit">Administrador:</span>
                    <span>Acesso completo ao sistema</span>
                  </span>
                </p>
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 sm:gap-4 pt-6 border-t border-neutral-200/50 dark:border-neutral-700/50 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 sm:px-5 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow"
              >
                <XMarkIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Cancelar</span>
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 sm:px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 dark:from-brand-500 dark:to-brand-600 text-white font-medium hover:from-brand-700 hover:to-brand-800 dark:hover:from-brand-600 dark:hover:to-brand-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Criando...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-5 w-5" />
                    <span>Criar Usuário</span>
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
