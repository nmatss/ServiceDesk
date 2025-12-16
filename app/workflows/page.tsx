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
} from '@heroicons/react/24/outline';
import { WorkflowDefinition } from '@/lib/types/workflow';

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
      console.error('Error loading workflows:', error);
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
      console.error('Error duplicating workflow:', error);
    }
  };

  const handleDeleteWorkflow = async (workflowId: number) => {
    if (!confirm('Are you sure you want to delete this workflow?')) {
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
      console.error('Error deleting workflow:', error);
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
      console.error('Error toggling workflow:', error);
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      ticket_automation: 'bg-blue-100 text-blue-700',
      notification: 'bg-orange-100 text-orange-700',
      escalation: 'bg-red-100 text-red-700',
      approval: 'bg-purple-100 text-purple-700',
      integration: 'bg-green-100 text-green-700',
      ml_optimization: 'bg-pink-100 text-pink-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
              <p className="text-sm text-gray-600 mt-1">
                Automate your ticket management with visual workflows
              </p>
            </div>
            <button
              onClick={handleCreateWorkflow}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Create Workflow</span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-2 mt-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('ticket_automation')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === 'ticket_automation'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Ticket Automation
            </button>
            <button
              onClick={() => setFilter('notification')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === 'notification'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Notifications
            </button>
            <button
              onClick={() => setFilter('approval')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filter === 'approval'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Approvals
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No workflows yet
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Get started by creating your first workflow
            </p>
            <button
              onClick={handleCreateWorkflow}
              className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Create Workflow</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
              >
                {/* Card Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {workflow.name}
                      </h3>
                      {workflow.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Stats */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-sm font-medium text-gray-500">
                        Executions
                      </div>
                      <div className="text-lg font-semibold text-gray-900 mt-1">
                        {workflow.executionCount || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">
                        Success
                      </div>
                      <div className="text-lg font-semibold text-green-600 mt-1">
                        {workflow.successCount || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500">
                        Failed
                      </div>
                      <div className="text-lg font-semibold text-red-600 mt-1">
                        {workflow.failureCount || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-4 py-3 flex items-center justify-between space-x-2">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEditWorkflow(workflow.id)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicateWorkflow(workflow)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleViewAnalytics(workflow.id)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Analytics"
                    >
                      <ChartBarIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleToggleActive(workflow)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      workflow.isActive
                        ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                        : 'text-white bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {workflow.isActive ? (
                      <>
                        <span>Deactivate</span>
                      </>
                    ) : (
                      <>
                        <PlayIcon className="w-4 h-4" />
                        <span>Activate</span>
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
