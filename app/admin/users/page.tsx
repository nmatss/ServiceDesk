'use client'

import { AdminTable } from '@/src/components/admin/AdminTable'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger';
import { customToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/Button'
import { UserGroupIcon, PlusIcon, DocumentArrowDownIcon, UserIcon, ShieldCheckIcon, UsersIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import PageHeader from '@/components/ui/PageHeader'
import StatsCard, { StatsGrid } from '@/components/ui/StatsCard'
import { AdminTableSkeleton } from '@/components/ui/table-skeleton'
import { StatsCardsSkeleton } from '@/components/ui/loading-states'
import { LoadingError } from '@/components/ui/error-states'
import { NoDataEmptyState } from '@/components/ui/empty-state'

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      } else {
        const errorMsg = 'Erro ao carregar usuários'
        setError(errorMsg)
        customToast.error(errorMsg)
      }
    } catch (error) {
      logger.error('Erro ao buscar usuários', error)
      const errorMsg = 'Erro ao carregar usuários. Verifique sua conexão.'
      setError(errorMsg)
      customToast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    logger.info('Exporting users...')
    customToast.info('Preparando exportação...')
    // Simulate export
    setTimeout(() => {
      customToast.success('Lista de usuários exportada com sucesso!')
    }, 1000)
  }

  const handleDelete = async (userId: number, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?`)) {
      return
    }

    const loadingToast = customToast.loading('Excluindo usuário...')
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      customToast.dismiss(loadingToast)
      customToast.success(`Usuário "${userName}" excluído com sucesso!`)
      fetchUsers()
    } catch (error) {
      customToast.dismiss(loadingToast)
      customToast.error('Erro ao excluir usuário')
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
        <span className={`badge ${
          value === 'admin' ? 'badge-error' :
          value === 'agent' ? 'badge-primary' :
          'badge-neutral'
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
      render: (_value: any, row: any) => (
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<PencilIcon className="w-4 h-4" />}
            className="hover-lift"
            onClick={() => customToast.info('Funcionalidade em desenvolvimento')}
          >
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            leftIcon={<TrashIcon className="w-4 h-4" />}
            className="hover-lift"
            onClick={() => handleDelete(row.id, row.name)}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ]

  const totalUsers = users.length
  const activeUsers = users.filter(u => u.role === 'user').length
  const admins = users.filter(u => u.role === 'admin').length
  const agents = users.filter(u => u.role === 'agent').length

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Gerenciar Usuários"
        description="Gerencie usuários, funções e permissões do sistema"
        icon={UserGroupIcon}
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Usuários' }
        ]}
        actions={[
          {
            label: 'Exportar',
            icon: DocumentArrowDownIcon,
            variant: 'secondary',
            onClick: handleExport
          },
          {
            label: 'Novo Usuário',
            icon: PlusIcon,
            variant: 'primary',
            href: '/admin/users/new'
          }
        ]}
      />

      {/* Stats */}
      {loading ? (
        <StatsCardsSkeleton count={4} />
      ) : (
        <StatsGrid cols={4}>
          <StatsCard
            title="Total de Usuários"
            value={totalUsers}
            icon="users"
            color="brand"
          />
          <StatsCard
            title="Usuários Ativos"
            value={activeUsers}
            icon={UserIcon}
            color="success"
          />
          <StatsCard
            title="Administradores"
            value={admins}
            icon={ShieldCheckIcon}
            color="error"
          />
          <StatsCard
            title="Agentes"
            value={agents}
            icon={UsersIcon}
            color="warning"
          />
        </StatsGrid>
      )}

      {/* Filters */}
      <div className="glass-panel p-6 animate-slide-up">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Filtros
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Função
            </label>
            <select className="input">
              <option>Todas</option>
              <option>Admin</option>
              <option>Agente</option>
              <option>Usuário</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Status
            </label>
            <select className="input">
              <option>Todos</option>
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nome ou email..."
              className="input"
            />
          </div>
          <div className="flex items-end">
            <button className="btn btn-primary w-full">
              Aplicar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
        {error ? (
          <LoadingError message={error} onRetry={fetchUsers} />
        ) : loading ? (
          <div className="p-6">
            <AdminTableSkeleton />
          </div>
        ) : users.length === 0 ? (
          <NoDataEmptyState message="Nenhum usuário encontrado no sistema." />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <AdminTable
                columns={columns}
                data={users}
                loading={false}
                emptyMessage="Nenhum usuário encontrado"
                onRowClick={(row) => logger.info('User clicked', row)}
              />
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-4">
              {users.map(user => (
                <div key={user.id} className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{user.name}</h3>
                    <span className={`badge ${
                      user.role === 'admin' ? 'badge-error' :
                      user.role === 'agent' ? 'badge-primary' :
                      'badge-neutral'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : user.role === 'agent' ? 'Agente' : 'Usuário'}
                    </span>
                  </div>
                  <p className="text-sm text-description mb-2">{user.email}</p>
                  <div className="flex items-center justify-between text-sm text-muted-content mb-3">
                    <span>{user.tickets_count || 0} tickets</span>
                    <span>{new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      leftIcon={<PencilIcon className="w-4 h-4" />}
                      className="hover-lift"
                      onClick={() => customToast.info('Funcionalidade em desenvolvimento')}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      fullWidth
                      leftIcon={<TrashIcon className="w-4 h-4" />}
                      className="hover-lift"
                      onClick={() => handleDelete(user.id, user.name)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
