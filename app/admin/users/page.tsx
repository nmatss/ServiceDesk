'use client'

import AdminDashboard from '@/src/components/admin/AdminDashboard'
import { AdminCard } from '@/src/components/admin/AdminCard'
import { AdminButton } from '@/src/components/admin/AdminButton'
import { AdminTable } from '@/src/components/admin/AdminTable'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger';

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      logger.error('Erro ao buscar usuários', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Nome',
      sortable: true,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
    },
    {
      key: 'role',
      label: 'Função',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'admin' ? 'bg-purple-100 text-purple-800' :
          value === 'agent' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value === 'admin' ? 'Admin' : value === 'agent' ? 'Agente' : 'Usuário'}
        </span>
      ),
    },
    {
      key: 'tickets_count',
      label: 'Tickets',
      sortable: true,
    },
    {
      key: 'created_at',
      label: 'Criado em',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString('pt-BR'),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (value: any, row: any) => (
        <div className="flex space-x-2">
          <AdminButton variant="secondary" size="sm">
            Editar
          </AdminButton>
          <AdminButton variant="danger" size="sm">
            Excluir
          </AdminButton>
        </div>
      ),
    },
  ]

  return (
    <AdminDashboard currentPage="usuários">
      <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Gerenciar Usuários
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie usuários, funções e permissões do sistema
            </p>
          </div>
          <div className="mt-4 flex md:ml-4 md:mt-0 space-x-3">
            <AdminButton variant="secondary">
              Exportar
            </AdminButton>
            <AdminButton variant="primary">
              Novo Usuário
            </AdminButton>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <AdminCard className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">U</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total de Usuários
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {users.length}
                  </dd>
                </dl>
              </div>
            </div>
          </AdminCard>

          <AdminCard className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">A</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Usuários Ativos
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {users.filter(u => u.role === 'user').length}
                  </dd>
                </dl>
              </div>
            </div>
          </AdminCard>

          <AdminCard className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">AD</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Administradores
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {users.filter(u => u.role === 'admin').length}
                  </dd>
                </dl>
              </div>
            </div>
          </AdminCard>

          <AdminCard className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">AG</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Agentes
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {users.filter(u => u.role === 'agent').length}
                  </dd>
                </dl>
              </div>
            </div>
          </AdminCard>
        </div>

        {/* Users Table */}
        <AdminTable
          columns={columns}
          data={users}
          loading={loading}
          emptyMessage="Nenhum usuário encontrado"
          onRowClick={(row) => logger.info('User clicked', row)}
        />

        {/* Filters */}
        <AdminCard title="Filtros">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Função
              </label>
              <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option>Todas</option>
                <option>Admin</option>
                <option>Agente</option>
                <option>Usuário</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option>Todos</option>
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Buscar
              </label>
              <input
                type="text"
                placeholder="Nome ou email..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex items-end">
              <AdminButton variant="primary" className="w-full">
                Aplicar Filtros
              </AdminButton>
            </div>
          </div>
        </AdminCard>
      </div>
    </AdminDashboard>
  )
}
