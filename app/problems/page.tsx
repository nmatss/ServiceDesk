'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentMagnifyingGlassIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import type {
  ProblemWithRelations,
  ProblemStatus,
  ProblemImpact,
  PaginatedResult,
} from '@/lib/types/problem';

const STATUS_BADGES: Record<ProblemStatus, { label: string; color: string; icon: React.ReactNode }> = {
  new: {
    label: 'Novo',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <ClockIcon className="w-4 h-4" />,
  },
  investigation: {
    label: 'Investigando',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <DocumentMagnifyingGlassIcon className="w-4 h-4" />,
  },
  root_cause_identified: {
    label: 'Causa Identificada',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    icon: <LightBulbIcon className="w-4 h-4" />,
  },
  known_error: {
    label: 'Erro Conhecido',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: <ExclamationTriangleIcon className="w-4 h-4" />,
  },
  resolved: {
    label: 'Resolvido',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircleIcon className="w-4 h-4" />,
  },
  closed: {
    label: 'Fechado',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    icon: <CheckCircleIcon className="w-4 h-4" />,
  },
};

const IMPACT_BADGES: Record<ProblemImpact, { label: string; color: string }> = {
  low: { label: 'Baixo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  medium: { label: 'Médio', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  high: { label: 'Alto', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Crítico', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

export default function ProblemsPage() {
  const router = useRouter();
  const [problems, setProblems] = useState<ProblemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProblemStatus | ''>('');
  const [impactFilter, setImpactFilter] = useState<ProblemImpact | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter) params.set('status', statusFilter);
      if (impactFilter) params.set('impact', impactFilter);

      const response = await fetch(`/api/problems?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to fetch problems');
      }

      const data = await response.json();

      if (data.success) {
        const result: PaginatedResult<ProblemWithRelations> = data.data;
        setProblems(result.data);
        setPagination((prev) => ({
          ...prev,
          total: result.total,
          totalPages: result.totalPages,
        }));
      } else {
        setError(data.error || 'Failed to fetch problems');
      }
    } catch (err) {
      console.error('Error fetching problems:', err);
      setError('Failed to load problems');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, statusFilter, impactFilter, router]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchProblems();
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Gerenciamento de Problemas
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                ITIL Problem Management - Identificação e resolução de causas raiz
              </p>
            </div>
            <Link
              href="/problems/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Novo Problema
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar problemas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FunnelIcon className="w-5 h-5" />
              Filtros
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Buscar
            </button>
          </form>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProblemStatus | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Todos</option>
                  <option value="new">Novo</option>
                  <option value="investigation">Investigando</option>
                  <option value="root_cause_identified">Causa Identificada</option>
                  <option value="known_error">Erro Conhecido</option>
                  <option value="resolved">Resolvido</option>
                  <option value="closed">Fechado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Impacto
                </label>
                <select
                  value={impactFilter}
                  onChange={(e) => setImpactFilter(e.target.value as ProblemImpact | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Todos</option>
                  <option value="low">Baixo</option>
                  <option value="medium">Médio</option>
                  <option value="high">Alto</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('');
                    setImpactFilter('');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Carregando problemas...</p>
          </div>
        ) : problems.length === 0 ? (
          /* Empty State */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Nenhum problema encontrado
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Não há problemas registrados com os filtros atuais.
            </p>
            <Link
              href="/problems/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Registrar Problema
            </Link>
          </div>
        ) : (
          /* Problems List */
          <div className="space-y-4">
            {problems.map((problem) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-4"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Problem Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                        {problem.problem_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[problem.status].color}`}
                      >
                        {STATUS_BADGES[problem.status].icon}
                        {STATUS_BADGES[problem.status].label}
                      </span>
                      {problem.impact && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${IMPACT_BADGES[problem.impact].color}`}
                        >
                          {IMPACT_BADGES[problem.impact].label}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                      {problem.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                      {problem.description}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                    {problem.incident_count > 0 && (
                      <div className="flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span>{problem.incident_count} incidentes</span>
                      </div>
                    )}
                    {problem.category && (
                      <div className="flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: problem.category.color || '#6B7280' }}
                        ></span>
                        <span>{problem.category.name}</span>
                      </div>
                    )}
                    {problem.assignee && (
                      <div className="flex items-center gap-1">
                        <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium">
                          {problem.assignee.name.charAt(0).toUpperCase()}
                        </span>
                        <span>{problem.assignee.name}</span>
                      </div>
                    )}
                    <div>
                      {new Date(problem.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
              {pagination.total} problemas
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
