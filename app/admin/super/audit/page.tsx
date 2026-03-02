'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ClipboardDocumentListIcon, ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface AuditLog {
  id: number;
  user_id: number | null;
  organization_id: number | null;
  entity_type: string;
  entity_id: number | null;
  action: string;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  organization_name: string | null;
}

interface Organization {
  id: number;
  name: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Criar',
  update: 'Atualizar',
  delete: 'Excluir',
  view: 'Visualizar',
  login_success: 'Login',
  login_failed: 'Login falhou',
  access_denied: 'Acesso negado',
  export: 'Exportar',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  update: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  view: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  login_success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  login_failed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  access_denied: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  export: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function parseJsonSafe(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orgId, setOrgId] = useState('');
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/super/organizations?limit=100');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setOrganizations(json.data);
        }
      }
    } catch {
      // silently fail
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (orgId) params.set('org_id', orgId);
      if (action) params.set('action', action);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/super/audit?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao carregar logs');

      const json = await res.json();
      if (json.success) {
        setLogs(json.data || []);
        setTotal(json.meta?.total || 0);
        setTotalPages(json.meta?.totalPages || 1);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo, orgId, action, search]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleFilter() {
    setPage(1);
    fetchLogs();
  }

  function handleClearFilters() {
    setDateFrom('');
    setDateTo('');
    setOrgId('');
    setAction('');
    setSearch('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria do Sistema"
        description="Logs de auditoria de todas as organizações"
        icon={ClipboardDocumentListIcon}
      />

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div>
            <label htmlFor="filter-date-from" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Data início
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-11 text-base sm:text-sm px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label htmlFor="filter-date-to" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Data fim
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-11 text-base sm:text-sm px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label htmlFor="filter-org" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Organização
            </label>
            <select
              id="filter-org"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full h-11 text-base sm:text-sm px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100"
            >
              <option value="">Todas</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-action" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Ação
            </label>
            <select
              id="filter-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full h-11 text-base sm:text-sm px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100"
            >
              <option value="">Todas</option>
              <option value="create">Criar</option>
              <option value="update">Atualizar</option>
              <option value="delete">Excluir</option>
              <option value="view">Visualizar</option>
              <option value="login_success">Login</option>
              <option value="login_failed">Login falhou</option>
              <option value="access_denied">Acesso negado</option>
              <option value="export">Exportar</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-search" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Buscar
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                id="filter-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                placeholder="Usuário, e-mail, org..."
                className="w-full h-11 text-base sm:text-sm pl-9 pr-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" size="sm" onClick={handleFilter}>
            Filtrar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Limpar filtros
          </Button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        {total} {total === 1 ? 'registro encontrado' : 'registros encontrados'}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900">
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Data/Hora</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap hidden md:table-cell">Organização</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Ação</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap hidden lg:table-cell">Entidade</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap w-12">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    Carregando...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-500 dark:text-neutral-400">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  const oldVals = parseJsonSafe(log.old_values);
                  const newVals = parseJsonSafe(log.new_values);
                  const hasDetails = oldVals || newVals;

                  return (
                    <Fragment key={log.id}>
                      <tr className="group">
                        <td className="px-4 py-3 whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-neutral-900 dark:text-neutral-100">{log.user_name || 'Sistema'}</div>
                          {log.user_email && (
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">{log.user_email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300 hidden md:table-cell">
                          {log.organization_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300 hidden lg:table-cell">
                          <span className="font-mono text-xs">{log.entity_type}</span>
                          {log.entity_id && (
                            <span className="text-neutral-500 dark:text-neutral-400 ml-1">#{log.entity_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {hasDetails ? (
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                              aria-label={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? (
                                <ChevronUpIcon className="h-4 w-4 text-neutral-500" />
                              ) : (
                                <ChevronDownIcon className="h-4 w-4 text-neutral-500" />
                              )}
                            </button>
                          ) : (
                            <span className="text-neutral-400 dark:text-neutral-600">-</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasDetails && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 bg-neutral-50 dark:bg-neutral-900">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {oldVals && (
                                <div>
                                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-2">Valores anteriores</h4>
                                  <div className="space-y-1">
                                    {Object.entries(oldVals).map(([key, val]) => (
                                      <div key={key} className="flex text-xs">
                                        <span className="font-medium text-neutral-600 dark:text-neutral-400 min-w-[100px]">{key}:</span>
                                        <span className="text-neutral-800 dark:text-neutral-200 break-all">{String(val ?? '-')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {newVals && (
                                <div>
                                  <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase mb-2">Novos valores</h4>
                                  <div className="space-y-1">
                                    {Object.entries(newVals).map(([key, val]) => (
                                      <div key={key} className="flex text-xs">
                                        <span className="font-medium text-neutral-600 dark:text-neutral-400 min-w-[100px]">{key}:</span>
                                        <span className="text-neutral-800 dark:text-neutral-200 break-all">{String(val ?? '-')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {log.ip_address && (
                              <div className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                                IP: {log.ip_address}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                leftIcon={<ChevronLeftIcon className="h-4 w-4" />}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                rightIcon={<ChevronRightIcon className="h-4 w-4" />}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
