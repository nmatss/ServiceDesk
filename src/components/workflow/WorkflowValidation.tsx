'use client';

/**
 * Workflow Validation Component
 * Validates workflow structure and displays errors/warnings
 */

import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { WorkflowDefinition } from '@/lib/types/workflow';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

interface WorkflowValidationProps {
  workflow: WorkflowDefinition;
  onClose?: () => void;
  className?: string;
}

export default function WorkflowValidation({
  workflow,
  onClose,
  className = '',
}: WorkflowValidationProps) {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    validateWorkflow();
  }, [workflow]);

  const validateWorkflow = () => {
    const validationIssues: ValidationIssue[] = [];

    // Check for start node
    const startNodes = workflow.nodes.filter((n) => n.type === 'start');
    if (startNodes.length === 0) {
      validationIssues.push({
        type: 'error',
        message: 'Workflow must have at least one Start node',
      });
    } else if (startNodes.length > 1) {
      validationIssues.push({
        type: 'error',
        message: 'Workflow can only have one Start node',
      });
    }

    // Check for end node
    const endNodes = workflow.nodes.filter((n) => n.type === 'end');
    if (endNodes.length === 0) {
      validationIssues.push({
        type: 'error',
        message: 'Workflow must have at least one End node',
      });
    }

    // Check for disconnected nodes
    workflow.nodes.forEach((node) => {
      const incoming = workflow.edges.filter((e) => e.target === node.id);
      const outgoing = workflow.edges.filter((e) => e.source === node.id);

      if (node.type === 'start') {
        if (outgoing.length === 0) {
          validationIssues.push({
            type: 'error',
            message: `Start node has no outgoing connections`,
            nodeId: node.id,
          });
        }
      } else if (node.type === 'end') {
        if (incoming.length === 0) {
          validationIssues.push({
            type: 'warning',
            message: `End node "${node.name}" has no incoming connections`,
            nodeId: node.id,
          });
        }
      } else {
        if (incoming.length === 0) {
          validationIssues.push({
            type: 'warning',
            message: `Node "${node.name}" has no incoming connections`,
            nodeId: node.id,
          });
        }
        if (outgoing.length === 0) {
          validationIssues.push({
            type: 'warning',
            message: `Node "${node.name}" has no outgoing connections`,
            nodeId: node.id,
          });
        }
      }
    });

    // Check for cycles (infinite loops)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = workflow.edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          if (hasCycle(edge.target)) return true;
        } else if (recursionStack.has(edge.target)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    const firstStartNode = startNodes[0];
    if (firstStartNode && hasCycle(firstStartNode.id)) {
      validationIssues.push({
        type: 'error',
        message: 'Workflow contains cycles (infinite loops)',
      });
    }

    // Check node configurations
    workflow.nodes.forEach((node) => {
      if (!node.name || node.name.trim() === '') {
        validationIssues.push({
          type: 'warning',
          message: `Node has no name`,
          nodeId: node.id,
        });
      }

      // Type-specific validation
      if (node.type === 'condition' && (!node.configuration || !node.configuration.conditions)) {
        validationIssues.push({
          type: 'warning',
          message: `Condition node "${node.name}" has no conditions configured`,
          nodeId: node.id,
        });
      }

      if (node.type === 'approval' && (!node.configuration || !node.configuration.approvers || (Array.isArray(node.configuration.approvers) && node.configuration.approvers.length === 0))) {
        validationIssues.push({
          type: 'error',
          message: `Approval node "${node.name}" has no approvers configured`,
          nodeId: node.id,
        });
      }

      if (node.type === 'webhook' && (!node.configuration || !node.configuration.url)) {
        validationIssues.push({
          type: 'error',
          message: `Webhook node "${node.name}" has no URL configured`,
          nodeId: node.id,
        });
      }

      if (node.type === 'notification' && (!node.configuration || !node.configuration.recipients || (Array.isArray(node.configuration.recipients) && node.configuration.recipients.length === 0))) {
        validationIssues.push({
          type: 'warning',
          message: `Notification node "${node.name}" has no recipients configured`,
          nodeId: node.id,
        });
      }
    });

    // Check for orphaned edges
    workflow.edges.forEach((edge) => {
      const sourceExists = workflow.nodes.some((n) => n.id === edge.source);
      const targetExists = workflow.nodes.some((n) => n.id === edge.target);

      if (!sourceExists || !targetExists) {
        validationIssues.push({
          type: 'error',
          message: `Edge connects to non-existent node`,
          edgeId: edge.id,
        });
      }
    });

    // Check workflow metadata
    if (!workflow.name || workflow.name.trim() === '') {
      validationIssues.push({
        type: 'error',
        message: 'Workflow must have a name',
      });
    }

    if (workflow.nodes.length === 0) {
      validationIssues.push({
        type: 'error',
        message: 'Workflow must have at least one node',
      });
    }

    if (workflow.nodes.length > 100) {
      validationIssues.push({
        type: 'warning',
        message: 'Workflow has more than 100 nodes, which may impact performance',
      });
    }

    // Performance recommendations
    if (workflow.nodes.length > 50) {
      validationIssues.push({
        type: 'info',
        message: 'Consider breaking down large workflows into smaller subworkflows',
      });
    }

    const approvalNodes = workflow.nodes.filter((n) => n.type === 'approval');
    if (approvalNodes.length > 5) {
      validationIssues.push({
        type: 'info',
        message: 'Workflow has multiple approval steps, which may slow down execution',
      });
    }

    setIssues(validationIssues);
    setIsValid(validationIssues.filter((i) => i.type === 'error').length === 0);
  };

  const errorCount = issues.filter((i) => i.type === 'error').length;
  const warningCount = issues.filter((i) => i.type === 'warning').length;
  const infoCount = issues.filter((i) => i.type === 'info').length;

  return (
    <div className={`workflow-validation fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isValid ? (
                <CheckCircleIcon className="w-8 h-8 text-green-500" />
              ) : (
                <XCircleIcon className="w-8 h-8 text-red-500" />
              )}
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Workflow Validation
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {isValid
                    ? 'Your workflow is valid and ready to deploy'
                    : 'Please fix the errors below before deploying'}
                </p>
              </div>
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

          {/* Summary */}
          <div className="flex items-center space-x-4 mt-4">
            {errorCount > 0 && (
              <div className="flex items-center space-x-1.5 text-red-600">
                <XCircleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">{errorCount} Error{errorCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {warningCount > 0 && (
              <div className="flex items-center space-x-1.5 text-yellow-600">
                <ExclamationTriangleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">{warningCount} Warning{warningCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {infoCount > 0 && (
              <div className="flex items-center space-x-1.5 text-blue-600">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">{infoCount} Info</span>
              </div>
            )}
            {isValid && (
              <div className="flex items-center space-x-1.5 text-green-600">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="text-sm font-medium">All Checks Passed</span>
              </div>
            )}
          </div>
        </div>

        {/* Issues List */}
        <div className="flex-1 overflow-y-auto p-6">
          {issues.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900">
                No issues found!
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Your workflow looks great and is ready to deploy.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    issue.type === 'error'
                      ? 'bg-red-50 border-red-500'
                      : issue.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {issue.type === 'error' ? (
                        <XCircleIcon className="w-5 h-5 text-red-500" />
                      ) : issue.type === 'warning' ? (
                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <CheckCircleIcon className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          issue.type === 'error'
                            ? 'text-red-800'
                            : issue.type === 'warning'
                            ? 'text-yellow-800'
                            : 'text-blue-800'
                        }`}
                      >
                        {issue.message}
                      </p>
                      {(issue.nodeId || issue.edgeId) && (
                        <p className="text-xs text-gray-600 mt-1">
                          {issue.nodeId ? `Node ID: ${issue.nodeId}` : `Edge ID: ${issue.edgeId}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {workflow.nodes.length} node{workflow.nodes.length !== 1 ? 's' : ''} •{' '}
              {workflow.edges.length} edge{workflow.edges.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {isValid ? 'Continue' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
