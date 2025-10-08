'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/monitoring/logger';
import {
  UserIcon,
  EnvelopeIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { useNotificationHelpers } from '@/src/components/notifications/NotificationProvider'

interface UserProfile {
  id: number
  name: string
  email: string
  role: string
  created_at: string
  avatar?: string
}

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile')
  const { success, error } = useNotificationHelpers()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setProfile(userData)
        setProfileForm({
          name: userData.name,
          email: userData.email
        })
      } else {
        error('Erro', 'Falha ao carregar perfil')
        router.push('/auth/login')
      }
    } catch (err) {
      logger.error('Erro ao buscar perfil', err)
      error('Erro', 'Falha ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      })

      if (response.ok) {
        const updatedProfile = await response.json()
        setProfile(updatedProfile)
        localStorage.setItem('user_name', updatedProfile.name)
        success('Sucesso', 'Perfil atualizado com sucesso')
      } else {
        const errorData = await response.json()
        error('Erro', errorData.message || 'Falha ao atualizar perfil')
      }
    } catch (err) {
      logger.error('Erro ao atualizar perfil', err)
      error('Erro', 'Falha ao atualizar perfil')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      error('Erro', 'Nova senha e confirmação não coincidem')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      error('Erro', 'Nova senha deve ter pelo menos 8 caracteres')
      return
    }

    setSaving(true)

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })

      if (response.ok) {
        success('Sucesso', 'Senha alterada com sucesso')
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else {
        const errorData = await response.json()
        error('Erro', errorData.message || 'Falha ao alterar senha')
      }
    } catch (err) {
      logger.error('Erro ao alterar senha', err)
      error('Erro', 'Falha ao alterar senha')
    } finally {
      setSaving(false)
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador'
      case 'agent': return 'Agente'
      case 'user': return 'Usuário'
      default: return role
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <div className="container-responsive py-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              Meu Perfil
            </h1>
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">
              Gerencie suas informações pessoais e configurações de conta
            </p>
          </div>

          {/* Profile Card */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 mb-6">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gradient-brand rounded-full flex items-center justify-center">
                  <UserIcon className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {profile?.name}
                  </h2>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    {profile?.email}
                  </p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 mt-2">
                    {getRoleLabel(profile?.role || '')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700">
            <div className="border-b border-neutral-200 dark:border-neutral-700">
              <nav className="-mb-px flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'profile'
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-300'
                  }`}
                >
                  <UserIcon className="h-5 w-5 inline-block mr-2" />
                  Informações Pessoais
                </button>
                <button
                  onClick={() => setActiveTab('password')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'password'
                      ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-300'
                  }`}
                >
                  <KeyIcon className="h-5 w-5 inline-block mr-2" />
                  Alterar Senha
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'profile' && (
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Nome Completo
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type="text"
                        id="name"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        className="input-primary pl-10"
                        placeholder="Seu nome completo"
                        required
                      />
                      <UserIcon className="h-5 w-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Email
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type="email"
                        id="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        className="input-primary pl-10"
                        placeholder="seu@email.com"
                        required
                      />
                      <EnvelopeIcon className="h-5 w-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-4 w-4 mr-2" />
                          Salvar Alterações
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'password' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Senha Atual
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type="password"
                        id="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="input-primary pl-10"
                        placeholder="Digite sua senha atual"
                        required
                      />
                      <KeyIcon className="h-5 w-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Nova Senha
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type="password"
                        id="newPassword"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="input-primary pl-10"
                        placeholder="Digite a nova senha"
                        minLength={8}
                        required
                      />
                      <KeyIcon className="h-5 w-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      A senha deve ter pelo menos 8 caracteres
                    </p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Confirmar Nova Senha
                    </label>
                    <div className="mt-1 relative">
                      <input
                        type="password"
                        id="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="input-primary pl-10"
                        placeholder="Confirme a nova senha"
                        required
                      />
                      <KeyIcon className="h-5 w-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Alterando...
                        </>
                      ) : (
                        <>
                          <KeyIcon className="h-4 w-4 mr-2" />
                          Alterar Senha
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Account Info */}
          <div className="mt-6 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-6">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">
              Informações da Conta
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">ID da Conta:</span>
                <span className="ml-2 text-neutral-600 dark:text-neutral-400">#{profile?.id}</span>
              </div>
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">Membro desde:</span>
                <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}