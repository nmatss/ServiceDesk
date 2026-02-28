'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ExclamationTriangleIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import PageHeader from '@/components/ui/PageHeader';
import type {
  ProblemImpact,
  ProblemUrgency,
  CreateProblemInput,
} from '@/lib/types/problem';

interface Category {
  id: number;
  name: string;
  color: string | null;
}

interface Priority {
  id: number;
  name: string;
  color: string | null;
  level: number;
}

interface Team {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
  email: string;
}

export default function NewProblemPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [priorityId, setPriorityId] = useState<number | ''>('');
  const [impact, setImpact] = useState<ProblemImpact | ''>('');
  const [urgency, setUrgency] = useState<ProblemUrgency | ''>('');
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [assignedTeamId, setAssignedTeamId] = useState<number | ''>('');

  // Options
  const [categories, setCategories] = useState<Category[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Fetch options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [categoriesRes, prioritiesRes] = await Promise.all([
          fetch('/api/categories', { credentials: 'include' }),
          fetch('/api/priorities', { credentials: 'include' }),
        ]);

        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setCategories(data.data || data.categories || []);
        }

        if (prioritiesRes.ok) {
          const data = await prioritiesRes.json();
          setPriorities(data.data || data.priorities || []);
        }

        // Fetch teams and users for assignment
        const [teamsRes, usersRes] = await Promise.all([
          fetch('/api/teams', { credentials: 'include' }),
          fetch('/api/admin/users?role=agent', { credentials: 'include' }),
        ]);

        if (teamsRes.ok) {
          const data = await teamsRes.json();
          setTeams(data.data || data.teams || []);
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.data || data.users || []);
        }
      } catch (err) {
        console.error('Error fetching options:', err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!title.trim() || !description.trim()) {
        setError('Título e descrição são obrigatórios');
        setLoading(false);
        return;
      }

      const input: CreateProblemInput = {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId || undefined,
        priority_id: priorityId || undefined,
        impact: impact || undefined,
        urgency: urgency || undefined,
        assigned_to: assignedTo || undefined,
        assigned_team_id: assignedTeamId || undefined,
      };

      const response = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        router.push(`/problems/${data.data.id}`);
      } else {
        setError(data.error || 'Erro ao criar problema');
      }
    } catch (err) {
      console.error('Error creating problem:', err);
      setError('Erro ao criar problema');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <PageHeader
        title="Registrar Novo Problema"
        description="Documente um problema para investigação de causa raiz"
        breadcrumbs={[
          { label: 'Início', href: '/', icon: HomeIcon },
          { label: 'Problemas', href: '/problems' },
          { label: 'Novo', href: '/problems/new' },
        ]}
      />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3 animate-slide-down">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <p className="text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-medium text-neutral-900 dark:text-white mb-4">
              Informações Básicas
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Descreva o problema de forma resumida"
                  required
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Descrição *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o problema em detalhes, incluindo quando e como foi identificado"
                  required
                  rows={5}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

            </div>
          </div>

          {/* Classification */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-medium text-neutral-900 dark:text-white mb-4">
              Classificação
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Categoria
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  disabled={loadingOptions}
                >
                  <option value="">Selecione...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Prioridade
                </label>
                <select
                  value={priorityId}
                  onChange={(e) => setPriorityId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  disabled={loadingOptions}
                >
                  <option value="">Selecione...</option>
                  {priorities.map((pri) => (
                    <option key={pri.id} value={pri.id}>
                      {pri.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Impacto
                </label>
                <select
                  value={impact}
                  onChange={(e) => setImpact(e.target.value as ProblemImpact | '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  <option value="low">Baixo</option>
                  <option value="medium">Médio</option>
                  <option value="high">Alto</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Urgência
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as ProblemUrgency | '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="glass-panel p-6">
            <h2 className="text-lg font-medium text-neutral-900 dark:text-white mb-4">
              Atribuição
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Equipe Responsável
                </label>
                <select
                  value={assignedTeamId}
                  onChange={(e) => setAssignedTeamId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  disabled={loadingOptions}
                >
                  <option value="">Selecione...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Responsável Individual
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  disabled={loadingOptions}
                >
                  <option value="">Selecione...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/problems"
              className="px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all duration-200"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? 'Criando...' : 'Criar Problema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
