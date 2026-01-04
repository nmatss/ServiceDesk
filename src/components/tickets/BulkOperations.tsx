'use client';

/**
 * BulkOperations - Advanced bulk operations component for ticket management
 * Supports mass assign, close, escalate, update, and batch processing
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { Ticket, User, Category, Priority, Status } from '../../../lib/types/database';

// Icons
import { logger } from '@/lib/monitoring/logger';
import {
  CheckIcon,
  XMarkIcon,
  UserGroupIcon,
  TagIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  DocumentTextIcon,
  ArrowUpIcon,
  TrashIcon,
  Cog6ToothIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline';

interface BulkOperationConfig {
  type: 'assign' | 'category' | 'priority' | 'status' | 'close' | 'escalate' | 'delete' | 'tag' | 'comment' | 'custom';
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresValue: boolean;
  requiresConfirmation: boolean;
  dangerLevel: 'low' | 'medium' | 'high';
  batchSize?: number;
  estimatedTimePerTicket?: number; // in milliseconds
}

interface BulkOperationJob {
  id: string;
  operation: BulkOperationConfig;
  tickets: Ticket[];
  value?: any;
  comment?: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: {
    total: number;
    completed: number;
    failed: number;
    errors: Array<{ ticketId: number; error: string }>;
  };
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
}

interface BulkOperationsProps {
  selectedTickets: Ticket[];
  availableOperations: BulkOperationConfig[];
  users: User[];
  categories: Category[];
  priorities: Priority[];
  statuses: Status[];
  onOperationExecute: (operation: BulkOperationConfig, tickets: Ticket[], value?: any, comment?: string) => Promise<{ success: boolean; results: Array<{ ticketId: number; success: boolean; error?: string }> }>;
  onClearSelection: () => void;
  maxBatchSize?: number;
  showProgress?: boolean;
  className?: string;
}

export function BulkOperations({
  selectedTickets,
  availableOperations,
  users,
  categories,
  priorities,
  statuses,
  onOperationExecute,
  onClearSelection,
  maxBatchSize = 100,
  showProgress = true,
  className = ''
}: BulkOperationsProps) {
  // State
  const [selectedOperation, setSelectedOperation] = useState<BulkOperationConfig | null>(null);
  const [operationValue, setOperationValue] = useState<any>(null);
  const [operationComment, setOperationComment] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [activeJobs, setActiveJobs] = useState<Map<string, BulkOperationJob>>(new Map());
  const [jobHistory, setJobHistory] = useState<BulkOperationJob[]>([]);

  // Default operations
  const defaultOperations: BulkOperationConfig[] = [
    {
      type: 'assign',
      name: 'Assign to Agent',
      description: 'Assign selected tickets to a specific agent',
      icon: UserGroupIcon,
      requiresValue: true,
      requiresConfirmation: true,
      dangerLevel: 'low',
      batchSize: 50,
      estimatedTimePerTicket: 500
    },
    {
      type: 'category',
      name: 'Change Category',
      description: 'Update category for selected tickets',
      icon: TagIcon,
      requiresValue: true,
      requiresConfirmation: true,
      dangerLevel: 'medium',
      batchSize: 100,
      estimatedTimePerTicket: 300
    },
    {
      type: 'priority',
      name: 'Change Priority',
      description: 'Update priority level for selected tickets',
      icon: ExclamationTriangleIcon,
      requiresValue: true,
      requiresConfirmation: true,
      dangerLevel: 'medium',
      batchSize: 100,
      estimatedTimePerTicket: 300
    },
    {
      type: 'status',
      name: 'Change Status',
      description: 'Update status for selected tickets',
      icon: ClockIcon,
      requiresValue: true,
      requiresConfirmation: true,
      dangerLevel: 'medium',
      batchSize: 75,
      estimatedTimePerTicket: 400
    },
    {
      type: 'close',
      name: 'Close Tickets',
      description: 'Mark selected tickets as resolved and closed',
      icon: CheckIcon,
      requiresValue: false,
      requiresConfirmation: true,
      dangerLevel: 'high',
      batchSize: 50,
      estimatedTimePerTicket: 600
    },
    {
      type: 'escalate',
      name: 'Escalate',
      description: 'Escalate selected tickets to higher priority',
      icon: ArrowUpIcon,
      requiresValue: false,
      requiresConfirmation: true,
      dangerLevel: 'medium',
      batchSize: 25,
      estimatedTimePerTicket: 800
    },
    {
      type: 'comment',
      name: 'Add Comment',
      description: 'Add a comment to all selected tickets',
      icon: DocumentTextIcon,
      requiresValue: true,
      requiresConfirmation: false,
      dangerLevel: 'low',
      batchSize: 50,
      estimatedTimePerTicket: 400
    },
    {
      type: 'delete',
      name: 'Delete Tickets',
      description: 'Permanently delete selected tickets',
      icon: TrashIcon,
      requiresValue: false,
      requiresConfirmation: true,
      dangerLevel: 'high',
      batchSize: 25,
      estimatedTimePerTicket: 1000
    }
  ];

  const operations = [...defaultOperations, ...availableOperations];

  // Calculate statistics
  const stats = useMemo(() => {
    if (selectedTickets.length === 0) return null;

    const byStatus = selectedTickets.reduce((acc, ticket) => {
      acc[ticket.status_id] = (acc[ticket.status_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const byPriority = selectedTickets.reduce((acc, ticket) => {
      acc[ticket.priority_id] = (acc[ticket.priority_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const byCategory = selectedTickets.reduce((acc, ticket) => {
      acc[ticket.category_id] = (acc[ticket.category_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const byAssignment = selectedTickets.reduce((acc, ticket) => {
      const key = ticket.assigned_to || 'unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { byStatus, byPriority, byCategory, byAssignment };
  }, [selectedTickets]);

  // Validation
  const isOperationValid = useMemo(() => {
    if (!selectedOperation) return false;
    if (selectedTickets.length === 0) return false;
    if (selectedTickets.length > maxBatchSize) return false;
    if (selectedOperation.requiresValue && !operationValue) return false;
    return true;
  }, [selectedOperation, selectedTickets, operationValue, maxBatchSize]);

  // Handle operation selection
  const handleOperationSelect = useCallback((operation: BulkOperationConfig) => {
    setSelectedOperation(operation);
    setOperationValue(null);
    setOperationComment('');
    setShowConfirmation(false);
  }, []);

  // Handle operation execution
  const handleExecute = useCallback(async () => {
    if (!selectedOperation || !isOperationValid) return;

    if (selectedOperation.requiresConfirmation && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    const jobId = `${selectedOperation.type}-${Date.now()}`;
    const estimatedDuration = (selectedOperation.estimatedTimePerTicket || 500) * selectedTickets.length;

    const job: BulkOperationJob = {
      id: jobId,
      operation: selectedOperation,
      tickets: [...selectedTickets],
      value: operationValue,
      comment: operationComment || undefined,
      status: 'pending',
      progress: {
        total: selectedTickets.length,
        completed: 0,
        failed: 0,
        errors: []
      },
      estimatedDuration
    };

    // Add to active jobs
    setActiveJobs(prev => new Map(prev).set(jobId, job));

    try {
      // Start execution
      await executeJob(job);
    } catch (error) {
      logger.error('Job execution failed', error);
      // Update job status
      setActiveJobs(prev => {
        const updated = new Map(prev);
        const currentJob = updated.get(jobId);
        if (currentJob) {
          updated.set(jobId, {
            ...currentJob,
            status: 'failed',
            completedAt: new Date()
          });
        }
        return updated;
      });
    }

    // Reset form
    setSelectedOperation(null);
    setOperationValue(null);
    setOperationComment('');
    setShowConfirmation(false);
  }, [selectedOperation, isOperationValid, showConfirmation, selectedTickets, operationValue, operationComment]);

  // Execute bulk operation job
  const executeJob = useCallback(async (job: BulkOperationJob) => {
    const batchSize = job.operation.batchSize || 25;
    const tickets = [...job.tickets];

    // Update job status to running
    setActiveJobs(prev => {
      const updated = new Map(prev);
      updated.set(job.id, {
        ...job,
        status: 'running',
        startedAt: new Date()
      });
      return updated;
    });

    // Process in batches
    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, Math.min(i + batchSize, tickets.length));

      try {
        const result = await onOperationExecute(
          job.operation,
          batch,
          job.value,
          job.comment
        );

        // Update progress
        setActiveJobs(prev => {
          const updated = new Map(prev);
          const currentJob = updated.get(job.id);
          if (currentJob) {
            const successCount = result.results.filter(r => r.success).length;
            const failureCount = result.results.filter(r => !r.success).length;
            const newErrors = result.results
              .filter(r => !r.success)
              .map(r => ({ ticketId: r.ticketId, error: r.error || 'Unknown error' }));

            updated.set(job.id, {
              ...currentJob,
              progress: {
                ...currentJob.progress,
                completed: currentJob.progress.completed + successCount,
                failed: currentJob.progress.failed + failureCount,
                errors: [...currentJob.progress.errors, ...newErrors]
              }
            });
          }
          return updated;
        });

        // Add delay between batches to avoid overwhelming the system
        if (i + batchSize < tickets.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        // Handle batch failure
        setActiveJobs(prev => {
          const updated = new Map(prev);
          const currentJob = updated.get(job.id);
          if (currentJob) {
            const batchErrors = batch.map(ticket => ({
              ticketId: ticket.id,
              error: error instanceof Error ? error.message : 'Batch processing failed'
            }));

            updated.set(job.id, {
              ...currentJob,
              progress: {
                ...currentJob.progress,
                failed: currentJob.progress.failed + batch.length,
                errors: [...currentJob.progress.errors, ...batchErrors]
              }
            });
          }
          return updated;
        });
      }
    }

    // Mark job as completed
    setActiveJobs(prev => {
      const updated = new Map(prev);
      const currentJob = updated.get(job.id);
      if (currentJob) {
        const completedJob = {
          ...currentJob,
          status: 'completed' as const,
          completedAt: new Date()
        };

        // Move to history
        setJobHistory(prevHistory => [completedJob, ...prevHistory.slice(0, 49)]); // Keep last 50 jobs

        // Remove from active jobs
        updated.delete(job.id);
      }
      return updated;
    });
  }, [onOperationExecute]);

  // Pause/Resume job
  const handleJobControl = useCallback((jobId: string, action: 'pause' | 'resume' | 'cancel') => {
    setActiveJobs(prev => {
      const updated = new Map(prev);
      const job = updated.get(jobId);
      if (job) {
        let newStatus = job.status;
        switch (action) {
          case 'pause':
            newStatus = job.status === 'running' ? 'paused' : job.status;
            break;
          case 'resume':
            newStatus = job.status === 'paused' ? 'running' : job.status;
            break;
          case 'cancel':
            newStatus = 'cancelled';
            break;
        }
        updated.set(jobId, { ...job, status: newStatus });
      }
      return updated;
    });
  }, []);

  // Render value input based on operation type
  const renderValueInput = () => {
    if (!selectedOperation?.requiresValue) return null;

    switch (selectedOperation.type) {
      case 'assign':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assign to Agent
            </label>
            <select
              value={operationValue || ''}
              onChange={(e) => setOperationValue(parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select an agent...</option>
              {users.filter(u => u.role === 'agent' || u.role === 'admin').map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
        );

      case 'category':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Category
            </label>
            <select
              value={operationValue || ''}
              onChange={(e) => setOperationValue(parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a category...</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        );

      case 'priority':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Priority
            </label>
            <select
              value={operationValue || ''}
              onChange={(e) => setOperationValue(parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a priority...</option>
              {priorities.map(priority => (
                <option key={priority.id} value={priority.id}>
                  {priority.name} (Level {priority.level})
                </option>
              ))}
            </select>
          </div>
        );

      case 'status':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Status
            </label>
            <select
              value={operationValue || ''}
              onChange={(e) => setOperationValue(parseInt(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a status...</option>
              {statuses.map(status => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </div>
        );

      case 'comment':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comment Text
            </label>
            <textarea
              value={operationValue || ''}
              onChange={(e) => setOperationValue(e.target.value)}
              rows={3}
              placeholder="Enter comment to add to all selected tickets..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            />
          </div>
        );

      default:
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Value
            </label>
            <input
              type="text"
              value={operationValue || ''}
              onChange={(e) => setOperationValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        );
    }
  };

  if (selectedTickets.length === 0) {
    return (
      <div className={`p-6 text-center text-gray-500 dark:text-gray-400 ${className}`}>
        <Cog6ToothIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Select tickets to perform bulk operations</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Selection Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Bulk Operations ({selectedTickets.length} tickets selected)
          </h3>
          <button
            onClick={onClearSelection}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Selection Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {selectedTickets.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Selected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {Object.keys(stats.byStatus).length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Different Statuses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {Object.keys(stats.byPriority).length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Priority Levels</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {Object.keys(stats.byCategory).length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Categories</div>
            </div>
          </div>
        )}

        {/* Warning for large selections */}
        {selectedTickets.length > 50 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg mb-4">
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-orange-800 dark:text-orange-200">
                Large selection detected. Operations will be processed in batches to ensure system stability.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Operation Selection */}
      {!selectedOperation && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Choose Operation
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {operations.map((operation) => (
              <button
                key={operation.type}
                onClick={() => handleOperationSelect(operation)}
                className={`p-4 border rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  operation.dangerLevel === 'high'
                    ? 'border-red-200 dark:border-red-800 hover:border-red-300'
                    : operation.dangerLevel === 'medium'
                    ? 'border-orange-200 dark:border-orange-800 hover:border-orange-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <operation.icon className={`h-6 w-6 ${
                    operation.dangerLevel === 'high' ? 'text-red-500' :
                    operation.dangerLevel === 'medium' ? 'text-orange-500' :
                    'text-blue-500'
                  }`} />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {operation.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {operation.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Operation Configuration */}
      {selectedOperation && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <selectedOperation.icon className="h-5 w-5 mr-2" />
              {selectedOperation.name}
            </h4>
            <button
              onClick={() => setSelectedOperation(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {renderValueInput()}

            {/* Optional comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Optional Comment
              </label>
              <input
                type="text"
                value={operationComment}
                onChange={(e) => setOperationComment(e.target.value)}
                placeholder="Add a comment to this operation..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Confirmation */}
            {showConfirmation && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-800 dark:text-red-200">
                    Confirm Operation
                  </span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  This action will affect {selectedTickets.length} tickets and cannot be undone.
                  Are you sure you want to proceed?
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={handleExecute}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSelectedOperation(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={!isOperationValid}
                className={`px-4 py-2 rounded-lg text-white ${
                  selectedOperation.dangerLevel === 'high'
                    ? 'bg-red-600 hover:bg-red-700'
                    : selectedOperation.dangerLevel === 'medium'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {selectedOperation.requiresConfirmation && !showConfirmation ? 'Preview' : 'Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Jobs */}
      {showProgress && activeJobs.size > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Active Operations
          </h4>
          <div className="space-y-4">
            {Array.from(activeJobs.values()).map((job) => (
              <div key={job.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <job.operation.icon className="h-5 w-5 text-blue-500" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {job.operation.name}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      job.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      job.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      job.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    {job.status === 'running' && (
                      <button
                        onClick={() => handleJobControl(job.id, 'pause')}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <PauseIcon className="h-4 w-4" />
                      </button>
                    )}
                    {job.status === 'paused' && (
                      <button
                        onClick={() => handleJobControl(job.id, 'resume')}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <PlayIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleJobControl(job.id, 'cancel')}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-sm text-description mb-1">
                    <span>
                      {job.progress.completed} of {job.progress.total} completed
                    </span>
                    <span>
                      {((job.progress.completed / job.progress.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(job.progress.completed / job.progress.total) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Error Summary */}
                {job.progress.failed > 0 && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {job.progress.failed} failed
                    {job.progress.errors.length > 0 && (
                      <button className="ml-2 underline hover:no-underline">
                        View Errors
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job History */}
      {jobHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Recent Operations
          </h4>
          <div className="space-y-2">
            {jobHistory.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center space-x-2">
                  <job.operation.icon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {job.operation.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({job.progress.total} tickets)
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <span className={job.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {job.status}
                  </span>
                  {job.completedAt && (
                    <span className="text-gray-500 dark:text-gray-400">
                      {job.completedAt.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}