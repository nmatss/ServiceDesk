'use client'

import AdminDashboard from '@/src/components/admin/AdminDashboard'
import { AdminCard } from '@/src/components/admin/AdminCard'
import { AdminButton } from '@/src/components/admin/AdminButton'
import { useState } from 'react'
import { logger } from '@/lib/monitoring/logger';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState({
    siteName: 'ServiceDesk',
    siteDescription: 'Sistema de gerenciamento de tickets',
    emailNotifications: true,
    autoAssignTickets: false,
    maxTicketsPerUser: 10,
    ticketTimeout: 24,
    maintenanceMode: false,
  })

  const handleSave = async () => {
    setLoading(true)
    // Simular salvamento
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(false)
    // Aqui você implementaria a lógica de salvamento
  }

  return (
    <AdminDashboard currentPage="configurações">
      <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Configurações do Sistema
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie as configurações gerais do sistema
            </p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0">
            <AdminButton 
              variant="primary" 
              onClick={handleSave}
              loading={loading}
            >
              Salvar Configurações
            </AdminButton>
          </div>
        </div>

        {/* General Settings */}
        <AdminCard title="Configurações Gerais">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nome do Site
                </label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => setSettings({...settings, siteName: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Descrição do Site
                </label>
                <input
                  type="text"
                  value={settings.siteDescription}
                  onChange={(e) => setSettings({...settings, siteDescription: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Notification Settings */}
        <AdminCard title="Configurações de Notificação">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Notificações por Email
                </h3>
                <p className="text-sm text-gray-500">
                  Enviar notificações por email para usuários
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Atribuição Automática de Tickets
                </h3>
                <p className="text-sm text-gray-500">
                  Atribuir automaticamente tickets para agentes disponíveis
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoAssignTickets}
                  onChange={(e) => setSettings({...settings, autoAssignTickets: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </AdminCard>

        {/* Ticket Settings */}
        <AdminCard title="Configurações de Tickets">
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Máximo de Tickets por Usuário
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settings.maxTicketsPerUser}
                  onChange={(e) => setSettings({...settings, maxTicketsPerUser: parseInt(e.target.value)})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Número máximo de tickets que um usuário pode ter abertos
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Timeout de Tickets (horas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={settings.ticketTimeout}
                  onChange={(e) => setSettings({...settings, ticketTimeout: parseInt(e.target.value)})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Tempo limite para resposta de tickets em horas
                </p>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* System Settings */}
        <AdminCard title="Configurações do Sistema">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">
                  Modo de Manutenção
                </h3>
                <p className="text-sm text-gray-500">
                  Ativar modo de manutenção para manutenções do sistema
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </AdminCard>

        {/* Danger Zone */}
        <AdminCard title="Zona de Perigo" className="border-red-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <h3 className="text-sm font-medium text-red-900">
                  Limpar Cache do Sistema
                </h3>
                <p className="text-sm text-red-700">
                  Remove todos os dados em cache do sistema
                </p>
              </div>
              <AdminButton
                variant="danger"
                onClick={() => {
                  if (confirm('Tem certeza que deseja limpar o cache do sistema?')) {
                    // Implementar limpeza de cache
                    logger.info('Cache limpo')
                  }
                }}
              >
                Limpar Cache
              </AdminButton>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <h3 className="text-sm font-medium text-red-900">
                  Resetar Configurações
                </h3>
                <p className="text-sm text-red-700">
                  Restaura todas as configurações para os valores padrão
                </p>
              </div>
              <AdminButton
                variant="danger"
                onClick={() => {
                  if (confirm('Tem certeza que deseja resetar todas as configurações? Esta ação não pode ser desfeita.')) {
                    // Implementar reset das configurações
                    setSettings({
                      siteName: 'ServiceDesk',
                      siteDescription: 'Sistema de gerenciamento de tickets',
                      emailNotifications: true,
                      autoAssignTickets: false,
                      maxTicketsPerUser: 10,
                      ticketTimeout: 24,
                      maintenanceMode: false,
                    })
                  }
                }}
              >
                Resetar
              </AdminButton>
            </div>
          </div>
        </AdminCard>
      </div>
    </AdminDashboard>
  )
}

