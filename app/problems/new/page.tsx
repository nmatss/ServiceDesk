'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type {
  ProblemImpact,
  ProblemUrgency,
  ProblemSourceType,
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
  const searchParams = useSearchParams();
  const sourceIncidentId = searchParams.get('incident_id');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [priorityId, setPriorityId] = useState<number | ''>('');
  const [impact, setImpact] = useState<ProblemImpact | ''>('');
  const [urgency, setUrgency] = useState<ProblemUrgency | ''>('');
  const [sourceType, setSourceType] = useState<ProblemSourceType>(
    sourceIncidentId ? 'incident' : 'proactive'
  );
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [assignedGroupId, setAssignedGroupId] = useState<number | ''>('');
  const [symptoms, setSymptoms] = useState<string[]>(['']);
  const [businessImpact, setBusinessImpact] = useState('');

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

  const handleAddSymptom = () => {
    setSymptoms([...symptoms, '']);
  };

  const handleRemoveSymptom = (index: number) => {
    setSymptoms(symptoms.filter((_, i) => i !== index));
  };

  const handleSymptomChange = (index: number, value: string) => {
    const newSymptoms = [...symptoms];
    newSymptoms[index] = value;
    setSymptoms(newSymptoms);
  };

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
        source_type: sourceType,
        source_incident_id: sourceIncidentId ? parseInt(sourceIncidentId, 10) : undefined,
        assigned_to: assignedTo || undefined,
        assigned_group_id: assignedGroupId || undefined,
        symptoms: symptoms.filter((s) => s.trim()),
        business_impact: businessImpact || undefined,
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/problems"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-500" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Registrar Novo Problema
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Documente um problema para investigação de causa raiz
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <p className="text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Informações Básicas
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Descreva o problema de forma resumida"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o problema em detalhes, incluindo quando e como foi identificado"
                  required
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Origem do Problema
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as ProblemSourceType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="incident">Incidente</option>
                  <option value="proactive">Proativo</option>
                  <option value="monitoring">Monitoramento</option>
                  <option value="trend_analysis">Análise de Tendência</option>
                </select>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Classificação
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Categoria
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prioridade
                </label>
                <select
                  value={priorityId}
                  onChange={(e) => setPriorityId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Impacto
                </label>
                <select
                  value={impact}
                  onChange={(e) => setImpact(e.target.value as ProblemImpact | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  <option value="low">Baixo</option>
                  <option value="medium">Médio</option>
                  <option value="high">Alto</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Urgência
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as ProblemUrgency | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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

          {/* Symptoms */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Sintomas
              </h2>
              <button
                type="button"
                onClick={handleAddSymptom}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Adicionar Sintoma
              </button>
            </div>

            <div className="space-y-2">
              {symptoms.map((symptom, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={symptom}
                    onChange={(e) => handleSymptomChange(index, e.target.value)}
                    placeholder={`Sintoma ${index + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {symptoms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSymptom(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Liste os sintomas observados que indicam a existência do problema
            </p>
          </div>

          {/* Assignment */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Atribuição
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Equipe Responsável
                </label>
                <select
                  value={assignedGroupId}
                  onChange={(e) => setAssignedGroupId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Responsável Individual
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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

          {/* Business Impact */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Impacto no Negócio
            </h2>

            <textarea
              value={businessImpact}
              onChange={(e) => setBusinessImpact(e.target.value)}
              placeholder="Descreva como este problema afeta as operações do negócio"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/problems"
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Criando...' : 'Criar Problema'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
