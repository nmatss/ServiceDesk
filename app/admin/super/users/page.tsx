'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Menu, Transition } from '@headlessui/react';
import {
  ChevronDownIcon,
  EllipsisVerticalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: number;
  organization_id: number;
  organization_name: string;
  organization_slug: string;
  last_login_at: string | null;
  created_at: string;
}

interface Organization {
  id: number;
  name: string;
}

const ROLE_OPTIONS = [
  { value: '', label: 'Todas as Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agente' },
  { value: 'user', label: 'Usuário' },
  { value: 'manager', label: 'Gerente' },
  { value: 'read_only', label: 'Somente Leitura' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os Status' },
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' },
];

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    super_admin: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    manager: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    agent: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300',
    user: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    read_only: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
    api_client: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[role] || styles.user}`}>
      {role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
      Ativo
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      Inativo
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (orgFilter) params.set('org_id', orgFilter);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('sort', 'created_at');
      params.set('order', 'desc');

      const res = await fetch(`/api/admin/super/users?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
        setTotal(data.meta?.total || 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, orgFilter, roleFilter, statusFilter]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/super/organizations?limit=100', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setOrganizations(data.data || []);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, orgFilter, roleFilter, statusFilter]);

  const handleAction = async (userId: number, action: string, newRole?: string) => {
    setActionLoading(userId);
    try {
      const body: Record<string, string> = { action };
      if (newRole) body.new_role = newRole;

      const res = await fetch(`/api/admin/super/users/${userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (action === 'reset_password' && data.data?.temp_password) {
          alert(`Senha temporária: ${data.data.temp_password}\n\nCopie e envie ao usuário.`);
        }
        fetchUsers();
      } else {
        alert(data.error || 'Erro ao executar ação');
      }
    } catch {
      alert('Erro de conexão');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários Globais"
        description="Gerenciar usuários de todas as organizações"
        icon={UserGroupIcon}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 px-4 text-base rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>
        <div>
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="w-full h-11 px-4 text-base rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          >
            <option value="">Todas as Organizações</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full h-11 px-4 text-base rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-11 px-4 text-base rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        {total} usuário{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hidden md:table-cell">
                  Organização
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hidden sm:table-cell">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider hidden lg:table-cell">
                  Último Login
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    Carregando...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                      {user.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300 whitespace-nowrap hidden md:table-cell">
                      <span className="text-neutral-900 dark:text-neutral-100">{user.organization_name}</span>
                      <span className="text-neutral-400 dark:text-neutral-500 ml-1 text-xs">({user.organization_slug})</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap hidden sm:table-cell">
                      <StatusBadge active={!!user.is_active} />
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400 whitespace-nowrap hidden lg:table-cell">
                      {formatDate(user.last_login_at)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                          disabled={actionLoading === user.id}
                          aria-label={`Ações para ${user.name}`}
                        >
                          {actionLoading === user.id ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <EllipsisVerticalIcon className="h-5 w-5" />
                          )}
                        </Menu.Button>
                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-100"
                          enterFrom="transform opacity-0 scale-95"
                          enterTo="transform opacity-100 scale-100"
                          leave="transition ease-in duration-75"
                          leaveFrom="transform opacity-100 scale-100"
                          leaveTo="transform opacity-0 scale-95"
                        >
                          <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg bg-white dark:bg-neutral-800 shadow-lg ring-1 ring-neutral-200 dark:ring-neutral-700 focus:outline-none">
                            <div className="py-1">
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    type="button"
                                    onClick={() => handleAction(user.id, 'reset_password')}
                                    className={`${
                                      active ? 'bg-neutral-100 dark:bg-neutral-700' : ''
                                    } block w-full px-4 py-2 text-left text-sm text-neutral-700 dark:text-neutral-200`}
                                  >
                                    Reset Senha
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAction(
                                        user.id,
                                        user.is_active ? 'deactivate' : 'activate'
                                      )
                                    }
                                    className={`${
                                      active ? 'bg-neutral-100 dark:bg-neutral-700' : ''
                                    } block w-full px-4 py-2 text-left text-sm ${
                                      user.is_active
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-green-600 dark:text-green-400'
                                    }`}
                                  >
                                    {user.is_active ? 'Desativar' : 'Ativar'}
                                  </button>
                                )}
                              </Menu.Item>
                            </div>
                          </Menu.Items>
                        </Transition>
                      </Menu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Página anterior"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Próxima página"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
