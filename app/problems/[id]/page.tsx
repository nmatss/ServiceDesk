'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  LinkIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentMagnifyingGlassIcon,
  LightBulbIcon,
  UserIcon,
  TagIcon,
  CalendarIcon,
  ChartBarIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import type {
  ProblemWithRelations,
  ProblemStatus,
  ProblemImpact,
  ProblemActivityWithUser,
  ProblemIncidentLinkWithDetails,
} from '@/lib/types/problem';

const STATUS_CONFIG: Record<ProblemStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  new: {
    label: 'Novo',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <ClockIcon className="w-5 h-5" />,
  },
  investigation: {
    label: 'Em Investigação',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: <DocumentMagnifyingGlassIcon className="w-5 h-5" />,
  },
  root_cause_identified: {
    label: 'Causa Raiz Identificada',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: <LightBulbIcon className="w-5 h-5" />,
  },
  known_error: {
    label: 'Erro Conhecido',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    icon: <ExclamationTriangleIcon className="w-5 h-5" />,
  },
  resolved: {
    label: 'Resolvido',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: <CheckCircleIcon className="w-5 h-5" />,
  },
  closed: {
    label: 'Fechado',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    icon: <CheckCircleIcon className="w-5 h-5" />,
  },
};

const IMPACT_CONFIG: Record<ProblemImpact, { label: string; color: string }> = {
  low: { label: 'Baixo', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
  medium: { label: 'Médio', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
  high: { label: 'Alto', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
  critical: { label: 'Crítico', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProblemDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [problem, setProblem] = useState<ProblemWithRelations | null>(null);
  const [activities, setActivities] = useState<ProblemActivityWithUser[]>([]);
  const [incidents, setIncidents] = useState<ProblemIncidentLinkWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'incidents' | 'activities'>('details');
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const response = await fetch(`/api/problems/${id}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          if (response.status === 404) {
            setError('Problema não encontrado');
            return;
          }
          throw new Error('Failed to fetch problem');
        }

        const data = await response.json();

        if (data.success) {
          setProblem(data.data);
          setActivities(data.data.activities || []);
          setIncidents(data.data.incidents || []);
        } else {
          setError(data.error || 'Failed to fetch problem');
        }
      } catch (err) {
        console.error('Error fetching problem:', err);
        setError('Failed to load problem');
      } finally {
        setLoading(false);
      }
    };

    fetchProblem();
  }, [id, router]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/problems/${id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          activity_type: 'comment',
          description: newComment,
          is_internal: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setActivities([data.data, ...activities]);
          setNewComment('');
        }
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: ProblemStatus) => {
    try {
      const response = await fetch(`/api/problems/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setProblem(data.data);
          // Refresh activities
          const activitiesResponse = await fetch(`/api/problems/${id}/activities`, {
            credentials: 'include',
          });
          if (activitiesResponse.ok) {
            const activitiesData = await activitiesResponse.json();
            setActivities(activitiesData.data || []);
          }
        }
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Carregando problema...</p>
        </div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            {error || 'Problema não encontrado'}
          </h2>
          <Link
            href="/problems"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar para lista
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[problem.status];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/problems"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
            </Link>
            <span className="font-mono text-gray-500 dark:text-gray-400">
              {problem.problem_number}
            </span>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.icon}
              <span className="font-medium">{statusConfig.label}</span>
            </div>
            {problem.impact && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${IMPACT_CONFIG[problem.impact].color}`}>
                Impacto: {IMPACT_CONFIG[problem.impact].label}
              </span>
            )}
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {problem.title}
            </h1>
            <div className="flex items-center gap-2">
              <select
                value={problem.status}
                onChange={(e) => handleStatusChange(e.target.value as ProblemStatus)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              >
                <option value="new">Novo</option>
                <option value="investigation">Em Investigação</option>
                <option value="root_cause_identified">Causa Identificada</option>
                <option value="known_error">Erro Conhecido</option>
                <option value="resolved">Resolvido</option>
                <option value="closed">Fechado</option>
              </select>
              <Link
                href={`/problems/${id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <PencilIcon className="w-4 h-4" />
                Editar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex">
                  {[
                    { key: 'details', label: 'Detalhes', icon: DocumentTextIcon },
                    { key: 'incidents', label: `Incidentes (${incidents.length})`, icon: LinkIcon },
                    { key: 'activities', label: 'Histórico', icon: ChartBarIcon },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as typeof activeTab)}
                      className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.key
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Descrição
                      </h3>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                        {problem.description}
                      </p>
                    </div>

                    {problem.root_cause && (
                      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-orange-800 dark:text-orange-400 mb-2">
                          <LightBulbIcon className="w-4 h-4" />
                          Causa Raiz Identificada
                        </h3>
                        <p className="text-orange-900 dark:text-orange-300 whitespace-pre-wrap">
                          {problem.root_cause}
                        </p>
                      </div>
                    )}

                    {problem.workaround && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-400 mb-2">
                          <CheckCircleIcon className="w-4 h-4" />
                          Solução de Contorno
                        </h3>
                        <p className="text-green-900 dark:text-green-300 whitespace-pre-wrap">
                          {problem.workaround}
                        </p>
                        {problem.workaround_effectiveness && (
                          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
                            Efetividade:{' '}
                            {problem.workaround_effectiveness === 'full'
                              ? 'Completa'
                              : problem.workaround_effectiveness === 'partial'
                              ? 'Parcial'
                              : 'Nenhuma'}
                          </p>
                        )}
                      </div>
                    )}

                    {problem.permanent_fix && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
                          Solução Permanente
                        </h3>
                        <p className="text-blue-900 dark:text-blue-300 whitespace-pre-wrap">
                          {problem.permanent_fix}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Incidents Tab */}
                {activeTab === 'incidents' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        Incidentes Relacionados
                      </h3>
                      <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        <PlusIcon className="w-4 h-4" />
                        Vincular Incidente
                      </button>
                    </div>

                    {incidents.length === 0 ? (
                      <div className="text-center py-8">
                        <LinkIcon className="w-8 h-8 text-gray-400 mx-auto" />
                        <p className="mt-2 text-gray-500 dark:text-gray-400">
                          Nenhum incidente vinculado
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {incidents.map((link) => (
                          <Link
                            key={link.id}
                            href={`/tickets/${link.ticket_id}`}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-gray-500">
                                  {link.ticket?.ticket_number || `#${link.ticket_id}`}
                                </span>
                                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                                  {link.relationship_type === 'caused_by'
                                    ? 'Causado por'
                                    : link.relationship_type === 'related'
                                    ? 'Relacionado'
                                    : link.relationship_type === 'duplicate'
                                    ? 'Duplicado'
                                    : 'Regressão'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-900 dark:text-white mt-1">
                                {link.ticket?.title}
                              </p>
                            </div>
                            <span className="text-xs text-gray-500">
                              {link.ticket?.status}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Activities Tab */}
                {activeTab === 'activities' && (
                  <div className="space-y-4">
                    {/* Add Comment Form */}
                    <form onSubmit={handleAddComment} className="space-y-2">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Adicionar comentário interno..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!newComment.trim() || submitting}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {submitting ? 'Enviando...' : 'Adicionar Comentário'}
                        </button>
                      </div>
                    </form>

                    {/* Activities List */}
                    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              {activity.user?.avatar_url ? (
                                <img
                                  src={activity.user.avatar_url}
                                  alt={activity.user.name}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <UserIcon className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {activity.user?.name || 'Sistema'}
                              </span>
                              <span className="text-sm text-gray-500">
                                {new Date(activity.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 mt-1">
                              {activity.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Informações</h3>
              <dl className="space-y-4">
                {problem.assignee && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Responsável</dt>
                    <dd className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium">
                        {problem.assignee.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-900 dark:text-white">{problem.assignee.name}</span>
                    </dd>
                  </div>
                )}

                {problem.category && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Categoria</dt>
                    <dd className="flex items-center gap-2 mt-1">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: problem.category.color || '#6B7280' }}
                      />
                      <span className="text-gray-900 dark:text-white">{problem.category.name}</span>
                    </dd>
                  </div>
                )}

                {problem.priority && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Prioridade</dt>
                    <dd className="flex items-center gap-2 mt-1">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: problem.priority.color || '#6B7280' }}
                      />
                      <span className="text-gray-900 dark:text-white">{problem.priority.name}</span>
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Criado em</dt>
                  <dd className="text-gray-900 dark:text-white mt-1">
                    {new Date(problem.created_at).toLocaleString('pt-BR')}
                  </dd>
                </div>

                {problem.created_by_user && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Criado por</dt>
                    <dd className="text-gray-900 dark:text-white mt-1">
                      {problem.created_by_user.name}
                    </dd>
                  </div>
                )}

                {problem.incident_count > 0 && (
                  <div>
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Incidentes Vinculados</dt>
                    <dd className="text-gray-900 dark:text-white mt-1">
                      {problem.incident_count}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Known Error Card */}
            {problem.known_error && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg shadow p-6 border border-purple-200 dark:border-purple-800">
                <h3 className="flex items-center gap-2 font-medium text-purple-900 dark:text-purple-400 mb-2">
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  Erro Conhecido
                </h3>
                <p className="text-sm text-purple-800 dark:text-purple-300">
                  {problem.known_error.ke_number}
                </p>
                <Link
                  href={`/known-errors/${problem.known_error.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                >
                  Ver detalhes
                  <ArrowLeftIcon className="w-3 h-3 rotate-180" />
                </Link>
              </div>
            )}

            {/* Actions Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Ações</h3>
              <div className="space-y-2">
                {!problem.known_error && problem.root_cause && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    Criar Erro Conhecido
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <LinkIcon className="w-4 h-4" />
                  Vincular Incidente
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
