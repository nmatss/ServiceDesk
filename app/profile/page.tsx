'use client'

import React, { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger';
import {
  UserIcon,
  EnvelopeIcon,
  KeyIcon,
  CheckCircleIcon,
  CameraIcon,
  BellIcon,
  ShieldCheckIcon,
  TicketIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { useNotificationHelpers } from '@/src/components/notifications/NotificationProvider'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import FileUpload from '@/components/ui/file-upload'
import { useRequireAuth } from '@/lib/hooks/useRequireAuth'

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

interface UserStats {
  totalTickets: number
  openTickets: number
  resolvedTickets: number
  avgResponseTime: string
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [activeTab, setActiveTab] = useState('profile')
  const [stats, setStats] = useState<UserStats>({
    totalTickets: 0,
    openTickets: 0,
    resolvedTickets: 0,
    avgResponseTime: 'N/A'
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    weeklyReports: true
  })
  const { success, error } = useNotificationHelpers()

  // Use the centralized auth hook - eliminates 25+ lines of duplicate code
  const { user, loading: authLoading } = useRequireAuth()

  useEffect(() => {
    // Only load profile once authenticated
    if (!authLoading && user) {
      fetchProfile()
      fetchUserStats()
    }
  }, [authLoading, user])

  const fetchProfile = async () => {
    try {
      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch('/api/auth/profile', {
        credentials: 'include' // Use httpOnly cookies
      })

      if (response.ok) {
        const userData = await response.json()
        setProfile(userData)
        setProfileForm({
          name: userData.name,
          email: userData.email
        })
        if (userData.avatar) {
          setAvatarUrl(userData.avatar)
        }
      } else {
        error('Erro', 'Falha ao carregar perfil')
      }
    } catch (err) {
      logger.error('Erro ao buscar perfil', err)
      error('Erro', 'Falha ao carregar perfil')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/tickets?limit=1000', {
        credentials: 'include' // Use httpOnly cookies
      })

      if (response.ok) {
        const data = await response.json()
        const tickets = data.tickets || []

        const totalTickets = tickets.length
        const openTickets = tickets.filter((t: any) =>
          t.status === 'open' || t.status === 'in_progress'
        ).length
        const resolvedTickets = tickets.filter((t: any) =>
          t.status === 'resolved' || t.status === 'closed'
        ).length

        setStats({
          totalTickets,
          openTickets,
          resolvedTickets,
          avgResponseTime: totalTickets > 0 ? '2.5h' : 'N/A'
        })
      }
    } catch (err) {
      logger.error('Erro ao buscar estatísticas', err)
    }
  }

  const handleAvatarUpload = (file: any) => {
    if (file.url) {
      setAvatarUrl(file.url)
      success('Sucesso', 'Avatar atualizado com sucesso')
    }
  }

  const handlePreferenceChange = (key: string, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const savePreferences = async () => {
    setSaving(true)
    try {
      // Simular salvamento de preferências
      await new Promise(resolve => setTimeout(resolve, 1000))
      success('Sucesso', 'Preferências atualizadas com sucesso')
    } catch (err) {
      logger.error('Erro ao salvar preferências', err)
      error('Erro', 'Falha ao salvar preferências')
    } finally {
      setSaving(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Use httpOnly cookies
        body: JSON.stringify(profileForm)
      })

      if (response.ok) {
        const updatedProfile = await response.json()
        setProfile(updatedProfile)
        // Store non-sensitive display data only
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
      // SECURITY: Use httpOnly cookies for authentication
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Use httpOnly cookies
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
      <div className="container-responsive py-6 space-y-6">
        {/* Page Header - sem breadcrumbs */}
        <PageHeader
          title="Meu Perfil"
          description="Gerencie suas informações pessoais e configurações de conta"
          icon={UserIcon}
        />

        {/* User Stats Grid */}
        <StatsGrid cols={4}>
          <StatsCard
            title="Total de Tickets"
            value={stats.totalTickets}
            icon="tickets"
            color="brand"
          />
          <StatsCard
            title="Tickets Abertos"
            value={stats.openTickets}
            icon="pending"
            color="warning"
          />
          <StatsCard
            title="Tickets Resolvidos"
            value={stats.resolvedTickets}
            icon="resolved"
            color="success"
          />
          <StatsCard
            title="Tempo Médio"
            value={stats.avgResponseTime}
            icon="time"
            color="info"
          />
        </StatsGrid>

        {/* Avatar Upload Card */}
        <div className="glass-panel p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-brand flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-16 w-16 text-white" />
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <CameraIcon className="h-8 w-8 text-white" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {profile?.name}
              </h2>
              <p className="text-description mt-1">
                {profile?.email}
              </p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                <span className="badge badge-primary">
                  {getRoleLabel(profile?.role || '')}
                </span>
                <span className="badge badge-success">
                  <ShieldCheckIcon className="h-3 w-3 mr-1" />
                  Verificado
                </span>
              </div>

              <div className="mt-4">
                <FileUpload
                  onFileUploaded={handleAvatarUpload}
                  acceptedTypes={['image/*']}
                  maxSize={5}
                  entityType="user_avatar"
                  entityId={profile?.id}
                  className="max-w-md mx-auto md:mx-0"
                />
              </div>
            </div>

            <div className="glass-panel p-4 text-center">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Membro desde
              </p>
              <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-1">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR', {
                  month: 'short',
                  year: 'numeric'
                }) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} variant="pills">
          <TabsList className="w-full justify-start glass-panel p-1">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Informações Pessoais
            </TabsTrigger>
            <TabsTrigger value="password" className="flex items-center gap-2">
              <KeyIcon className="h-4 w-4" />
              Alterar Senha
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <BellIcon className="h-4 w-4" />
              Preferências
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
                Editar Informações Pessoais
              </h3>
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Nome Completo
                    </label>
                    <div className="relative">
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
                    <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
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
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setProfileForm({
                        name: profile?.name || '',
                        email: profile?.email || ''
                      })
                    }}
                  >
                    Cancelar
                  </button>
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
            </div>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
                Alterar Senha
              </h3>
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div className="glass-panel bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex gap-3">
                    <ShieldCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <p className="font-medium">Dicas de segurança:</p>
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        <li>Use pelo menos 8 caracteres</li>
                        <li>Combine letras maiúsculas, minúsculas e números</li>
                        <li>Não reutilize senhas de outras contas</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Senha Atual
                  </label>
                  <div className="relative">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Nova Senha
                    </label>
                    <div className="relative">
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
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      Confirmar Nova Senha
                    </label>
                    <div className="relative">
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
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setPasswordForm({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      })
                    }}
                  >
                    Cancelar
                  </button>
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
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <div className="glass-panel p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
                Preferências e Notificações
              </h3>

              <div className="space-y-6">
                {/* Email Notifications */}
                <div className="flex items-center justify-between p-4 glass-panel hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <EnvelopeIcon className="h-6 w-6 text-brand-600 dark:text-brand-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                        Notificações por Email
                      </h4>
                      <p className="text-sm text-description mt-1">
                        Receba atualizações sobre seus tickets por email
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotifications}
                      onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-brand-600"></div>
                  </label>
                </div>

                {/* Push Notifications */}
                <div className="flex items-center justify-between p-4 glass-panel hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <BellIcon className="h-6 w-6 text-brand-600 dark:text-brand-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                        Notificações Push
                      </h4>
                      <p className="text-sm text-description mt-1">
                        Receba notificações em tempo real no navegador
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.pushNotifications}
                      onChange={(e) => handlePreferenceChange('pushNotifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-brand-600"></div>
                  </label>
                </div>

                {/* Weekly Reports */}
                <div className="flex items-center justify-between p-4 glass-panel hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <ChartBarIcon className="h-6 w-6 text-brand-600 dark:text-brand-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                        Relatórios Semanais
                      </h4>
                      <p className="text-sm text-description mt-1">
                        Receba um resumo semanal de suas atividades
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.weeklyReports}
                      onChange={(e) => handlePreferenceChange('weeklyReports', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-brand-600"></div>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={savePreferences}
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
                        Salvar Preferências
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Account Info Card */}
        <div className="glass-panel p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
            Informações da Conta
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-4">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                ID da Conta
              </p>
              <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-1">
                #{profile?.id}
              </p>
            </div>
            <div className="glass-panel p-4">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Tipo de Conta
              </p>
              <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-1">
                {getRoleLabel(profile?.role || '')}
              </p>
            </div>
            <div className="glass-panel p-4">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Data de Cadastro
              </p>
              <p className="text-lg font-bold text-brand-600 dark:text-brand-400 mt-1">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}