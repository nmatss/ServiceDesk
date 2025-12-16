'use client';

/**
 * Workflow Tester Component
 * Test workflow execution in sandbox environment
 */

import React, { useState } from 'react';
import {
  XMarkIcon,
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { WorkflowDefinition, ExecutionStatus } from '@/lib/types/workflow';

interface ExecutionResult {
  executionId: number;
  status: ExecutionStatus;
  progress: number;
  currentStep?: string;
  variables: Record<string, any>;
  logs: any[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

interface WorkflowTesterProps {
  workflow: WorkflowDefinition;
  onClose?: () => void;
  className?: string;
}

export default function WorkflowTester({
  workflow,
  onClose,
  className = '',
}: WorkflowTesterProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [triggerData, setTriggerData] = useState<Record<string, any>>({
    ticketId: 123,
    priority: 'high',
    category: 'technical',
    status: 'open',
  });
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartTest = async () => {
    setIsRunning(true);
    setError(null);
    setExecutionResult(null);

    try {
      // Call the workflow execution API
      const response = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow: workflow,
          triggerData: triggerData,
          async: false, // Synchronous execution for testing
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute workflow');
      }

      if (data.success) {
        setExecutionResult({
          executionId: data.executionId,
          status: data.status,
          progress: data.progress || 100,
          currentStep: data.currentStep,
          variables: data.output || {},
          logs: data.logs || [],
          error: data.error,
          startedAt: new Date(),
          completedAt: data.status === 'completed' ? new Date() : undefined,
        });
      } else {
        throw new Error(data.error || 'Workflow execution failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopTest = async () => {
    if (executionResult?.executionId) {
      try {
        await fetch(`/api/workflows/execute?executionId=${executionResult.executionId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Error stopping execution:', err);
      }
    }
    setIsRunning(false);
  };

  const handleReset = () => {
    setExecutionResult(null);
    setError(null);
    setIsRunning(false);
  };

  const handleTriggerDataChange = (key: string, value: any) => {
    setTriggerData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className={`workflow-tester fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Test Workflow
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {workflow.name}
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Trigger Data
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ticket ID
                  </label>
                  <input
                    type="number"
                    value={triggerData.ticketId || ''}
                    onChange={(e) => handleTriggerDataChange('ticketId', parseInt(e.target.value))}
                    disabled={isRunning}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={triggerData.priority || 'medium'}
                    onChange={(e) => handleTriggerDataChange('priority', e.target.value)}
                    disabled={isRunning}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={triggerData.category || ''}
                    onChange={(e) => handleTriggerDataChange('category', e.target.value)}
                    disabled={isRunning}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <input
                    type="text"
                    value={triggerData.status || ''}
                    onChange={(e) => handleTriggerDataChange('status', e.target.value)}
                    disabled={isRunning}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom JSON Data
                  </label>
                  <textarea
                    value={JSON.stringify(triggerData, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setTriggerData(parsed);
                      } catch (err) {
                        // Invalid JSON, ignore
                      }
                    }}
                    disabled={isRunning}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Output Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Execution Results
              </h3>

              {!executionResult && !error && !isRunning && (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-300 rounded-lg">
                  <PlayIcon className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600">
                    Click "Run Test" to execute the workflow
                  </p>
                </div>
              )}

              {isRunning && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ArrowPathIcon className="w-12 h-12 text-blue-500 animate-spin mb-3" />
                  <p className="text-sm font-medium text-gray-900">
                    Running workflow...
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Please wait while we execute your workflow
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-red-800">
                        Execution Failed
                      </h4>
                      <p className="text-sm text-red-700 mt-1">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {executionResult && (
                <div className="space-y-4">
                  {/* Status */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Status
                      </span>
                      <div className="flex items-center space-x-2">
                        {executionResult.status === 'completed' && (
                          <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        )}
                        {executionResult.status === 'failed' && (
                          <XCircleIcon className="w-5 h-5 text-red-500" />
                        )}
                        {executionResult.status === 'running' && (
                          <ClockIcon className="w-5 h-5 text-blue-500" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            executionResult.status === 'completed'
                              ? 'text-green-700'
                              : executionResult.status === 'failed'
                              ? 'text-red-700'
                              : 'text-blue-700'
                          }`}
                        >
                          {executionResult.status}
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Progress</span>
                        <span className="text-xs font-medium text-gray-900">
                          {executionResult.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${executionResult.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Output Variables */}
                  {Object.keys(executionResult.variables).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Output Variables
                      </h4>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <pre className="text-xs font-mono text-gray-800 overflow-auto">
                          {JSON.stringify(executionResult.variables, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Execution Logs */}
                  {executionResult.logs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Execution Logs
                      </h4>
                      <div className="bg-gray-900 rounded-lg p-3 max-h-64 overflow-auto">
                        {executionResult.logs.map((log: any, index: number) => (
                          <div key={index} className="text-xs font-mono mb-1">
                            <span className="text-gray-500">
                              [{new Date(log.timestamp).toLocaleTimeString()}]
                            </span>
                            <span
                              className={`ml-2 ${
                                log.level === 'error'
                                  ? 'text-red-400'
                                  : log.level === 'warn'
                                  ? 'text-yellow-400'
                                  : 'text-green-400'
                              }`}
                            >
                              {log.level.toUpperCase()}
                            </span>
                            <span className="text-gray-300 ml-2">
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {executionResult.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-red-800 mb-1">
                        Error
                      </h4>
                      <p className="text-sm text-red-700">
                        {executionResult.error}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {workflow.nodes.length} nodes • {workflow.edges.length} edges
            </div>
            <div className="flex items-center space-x-3">
              {executionResult && (
                <button
                  onClick={handleReset}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              )}

              {isRunning ? (
                <button
                  onClick={handleStopTest}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  <StopIcon className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  onClick={handleStartTest}
                  disabled={!workflow.nodes.length}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>Run Test</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
