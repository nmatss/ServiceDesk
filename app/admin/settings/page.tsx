'use client'

import { AdminCard } from '@/src/components/admin/AdminCard'
import { AdminButton } from '@/src/components/admin/AdminButton'
import { useState } from 'react'
import { logger } from '@/lib/monitoring/logger'
import { CogIcon, BellIcon, TicketIcon, ServerIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    siteName: '',
    siteDescription: '',
    emailNotifications: true,
    autoAssignTickets: false,
    maxTicketsPerUser: 10,
    ticketTimeout: 24,
    maintenanceMode: false,
  })
  const [hasChanges, setHasChanges] = useState(false)

  const updateSettings = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setLoading(true)
    // Simular salvamento
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(false)
    setHasChanges(false)
    // Aqui você implementaria a lógica de salvamento
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Modern PageHeader with Icon */}
        <PageHeader
          title="Configurações"
          description="Gerencie as configurações gerais do ServiceDesk Pro"
          icon={CogIcon}
          breadcrumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Configurações' },
          ]}
        />

        {/* General Settings - Glass Panel */}
        <div className="glass-panel p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-10 w-10 bg-gradient-brand rounded-lg flex items-center justify-center">
              <CogIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Configurações Gerais
            </h3>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Nome do Site
                </label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => updateSettings('siteName', e.target.value)}
                  placeholder="Ex: Suporte Técnico da Empresa"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Descrição do Site
                </label>
                <input
                  type="text"
                  value={settings.siteDescription}
                  onChange={(e) => updateSettings('siteDescription', e.target.value)}
                  placeholder="Ex: Central de atendimento ao cliente"
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notification Settings - Glass Panel */}
        <div className="glass-panel p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <BellIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Configurações de Notificação
            </h3>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <div>
                <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Notificações por Email
                </h4>
                <p className="text-sm text-description mt-1">
                  Enviar notificações por email para usuários
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => updateSettings('emailNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-brand shadow-sm"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <div>
                <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Atribuição Automática de Tickets
                </h4>
                <p className="text-sm text-description mt-1">
                  Atribuir automaticamente tickets para agentes disponíveis
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoAssignTickets}
                  onChange={(e) => updateSettings('autoAssignTickets', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-brand shadow-sm"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Ticket Settings - Glass Panel */}
        <div className="glass-panel p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <TicketIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Configurações de Tickets
            </h3>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Máximo de Tickets por Usuário
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.maxTicketsPerUser}
                  onChange={(e) => updateSettings('maxTicketsPerUser', parseInt(e.target.value))}
                  className="input"
                />
                <p className="mt-2 text-sm text-description">
                  Número máximo de tickets que um usuário pode ter abertos
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Timeout de Tickets (horas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={settings.ticketTimeout}
                  onChange={(e) => updateSettings('ticketTimeout', parseInt(e.target.value))}
                  className="input"
                />
                <p className="mt-2 text-sm text-description">
                  Tempo limite para resposta de tickets em horas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* System Settings - Glass Panel */}
        <div className="glass-panel p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
              <ServerIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Configurações do Sistema
            </h3>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              <div>
                <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Modo de Manutenção
                </h4>
                <p className="text-sm text-description mt-1">
                  Ativar modo de manutenção para manutenções do sistema
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => updateSettings('maintenanceMode', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-brand shadow-sm"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Danger Zone - Glass Panel with Red Theme */}
        <div className="glass-panel p-6 border-2 border-red-200 dark:border-red-900/50">
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-10 w-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
              Zona de Perigo
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900/50">
              <div>
                <h4 className="text-sm font-medium text-red-900 dark:text-red-100">
                  Limpar Cache do Sistema
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Remove todos os dados em cache do sistema
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja limpar o cache do sistema?')) {
                    // Implementar limpeza de cache
                    logger.info('Cache limpo')
                  }
                }}
                className="btn bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 shadow-sm whitespace-nowrap"
              >
                Limpar Cache
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900/50">
              <div>
                <h4 className="text-sm font-medium text-red-900 dark:text-red-100">
                  Resetar Configurações
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Restaura todas as configurações para os valores padrão
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja resetar todas as configurações? Esta ação não pode ser desfeita.')) {
                    // Implementar reset das configurações
                    setSettings({
                      siteName: '',
                      siteDescription: '',
                      emailNotifications: true,
                      autoAssignTickets: false,
                      maxTicketsPerUser: 10,
                      ticketTimeout: 24,
                      maintenanceMode: false,
                    })
                    setHasChanges(false)
                  }
                }}
                className="btn bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 shadow-sm whitespace-nowrap"
              >
                Resetar
              </button>
            </div>
          </div>
        </div>

        {/* Spacer for sticky button */}
        <div className="h-20"></div>
      </div>

      {/* Modern Sticky Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-700 p-4 shadow-2xl z-50 animate-slide-up">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse"></div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Você tem alterações não salvas
              </p>
            </div>
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  setSettings({
                    siteName: '',
                    siteDescription: '',
                    emailNotifications: true,
                    autoAssignTickets: false,
                    maxTicketsPerUser: 10,
                    ticketTimeout: 24,
                    maintenanceMode: false,
                  })
                  setHasChanges(false)
                }}
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="btn btn-primary flex-1 sm:flex-none"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </>
                ) : (
                  'Salvar Configurações'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

