'use client';

/**
 * Workflow Management Page
 * List, create, edit, and manage workflows
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import { WorkflowDefinition } from '@/lib/types/workflow';
import { logger } from '@/lib/monitoring/logger';
import PageHeader from '@/components/ui/PageHeader';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadWorkflows();
  }, [filter]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('category', filter);
      }

      const response = await fetch(`/api/workflows/definitions?${params}`);
      const data = await response.json();

      if (data.workflows) {
        setWorkflows(data.workflows);
      }
    } catch (error) {
      logger.error('Erro ao carregar workflows', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = () => {
    router.push('/workflows/builder');
  };

  const handleEditWorkflow = (workflowId: number) => {
    router.push(`/workflows/builder?id=${workflowId}`);
  };

  const handleViewAnalytics = (workflowId: number) => {
    router.push(`/workflows/${workflowId}/analytics`);
  };

  const handleDuplicateWorkflow = async (workflow: WorkflowDefinition) => {
    try {
      const response = await fetch('/api/workflows/definitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...workflow,
          name: `${workflow.name} (Copy)`,
          isActive: false,
        }),
      });

      if (response.ok) {
        loadWorkflows();
      }
    } catch (error) {
      logger.error('Erro ao duplicar workflow', error);
    }
  };

  const handleDeleteWorkflow = async (workflowId: number) => {
    if (!confirm('Tem certeza que deseja excluir este workflow?')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/definitions/${workflowId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadWorkflows();
      }
    } catch (error) {
      logger.error('Erro ao excluir workflow', error);
    }
  };

  const handleToggleActive = async (workflow: WorkflowDefinition) => {
    try {
      const response = await fetch(`/api/workflows/definitions/${workflow.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !workflow.isActive,
        }),
      });

      if (response.ok) {
        loadWorkflows();
      }
    } catch (error) {
      logger.error('Erro ao alterar estado do workflow', error);
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      ticket_automation: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
      notification: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      escalation: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      approval: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      integration: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      ml_optimization: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    };
    return colors[category] || 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <PageHeader
        title="Workflows"
        description="Automatize o gerenciamento de tickets com fluxos visuais"
        breadcrumbs={[
          { label: 'Início', href: '/', icon: HomeIcon },
          { label: 'Workflows', href: '/workflows' },
        ]}
        actions={
          <button
            onClick={handleCreateWorkflow}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Criar Workflow</span>
          </button>
        }
      />

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 animate-fade-in">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap min-h-[44px] ${
              filter === 'all'
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                : 'text-description hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('ticket_automation')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap min-h-[44px] ${
              filter === 'ticket_automation'
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                : 'text-description hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Automação de Tickets
          </button>
          <button
            onClick={() => setFilter('notification')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap min-h-[44px] ${
              filter === 'notification'
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                : 'text-description hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Notificações
          </button>
          <button
            onClick={() => setFilter('approval')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap min-h-[44px] ${
              filter === 'approval'
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                : 'text-description hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Aprovações
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {loading ? (
          <div className="flex items-center justify-center py-12 animate-fade-in">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12 animate-slide-up">
            <div className="text-neutral-400 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Nenhum workflow encontrado
            </h3>
            <p className="text-sm text-description mb-6">
              Comece criando seu primeiro workflow
            </p>
            <button
              onClick={handleCreateWorkflow}
              className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-all duration-200 min-h-[44px]"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Criar Workflow</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow, index) => (
              <div
                key={workflow.id}
                className="glass-panel border border-neutral-200 dark:border-neutral-700 hover:shadow-lg transition-all duration-200 hover:scale-[1.02] animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Card Header */}
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white truncate">
                        {workflow.name}
                      </h3>
                      {workflow.description && (
                        <p className="text-sm text-description mt-1 line-clamp-2">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryBadgeColor(
                        workflow.category
                      )}`}
                    >
                      {workflow.category.replace('_', ' ')}
                    </span>
                    {workflow.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Stats */}
                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                        Execuções
                      </div>
                      <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mt-1">
                        {workflow.executionCount || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                        Sucesso
                      </div>
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">
                        {workflow.successCount || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                        Falhas
                      </div>
                      <div className="text-lg font-semibold text-red-600 dark:text-red-400 mt-1">
                        {workflow.failureCount || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEditWorkflow(workflow.id)}
                      className="p-2 text-description hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Editar"
                      aria-label="Editar workflow"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicateWorkflow(workflow)}
                      className="p-2 text-description hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Duplicar"
                      aria-label="Duplicar workflow"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleViewAnalytics(workflow.id)}
                      className="p-2 text-description hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Análises"
                      aria-label="Ver análises do workflow"
                    >
                      <ChartBarIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Excluir"
                      aria-label="Excluir workflow"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleToggleActive(workflow)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      workflow.isActive
                        ? 'text-neutral-700 dark:text-neutral-300 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
                        : 'text-white bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {workflow.isActive ? (
                      <>
                        <span>Desativar</span>
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4" />
                        <span>Ativar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
