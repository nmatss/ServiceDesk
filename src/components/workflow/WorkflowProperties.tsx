'use client';

/**
 * Workflow Properties Panel
 * Configuration panel for selected nodes, edges, and workflow settings
 */

import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Node, Edge } from 'reactflow';
import { WorkflowDefinition, WorkflowNodeType } from '@/lib/types/workflow';

interface WorkflowPropertiesProps {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  workflow: Partial<WorkflowDefinition>;
  onNodeUpdate?: (nodeId: string, updates: Partial<Node>) => void;
  onEdgeUpdate?: (edgeId: string, updates: Partial<Edge>) => void;
  onWorkflowUpdate?: (updates: Partial<WorkflowDefinition>) => void;
  onClose?: () => void;
  readOnly?: boolean;
  className?: string;
}

export default function WorkflowProperties({
  selectedNode,
  selectedEdge,
  workflow,
  onNodeUpdate,
  onEdgeUpdate,
  onWorkflowUpdate,
  onClose,
  readOnly = false,
  className = '',
}: WorkflowPropertiesProps) {
  const [activeTab, setActiveTab] = useState<'node' | 'edge' | 'workflow'>('node');

  // Auto-switch tabs based on selection
  useEffect(() => {
    if (selectedNode) {
      setActiveTab('node');
    } else if (selectedEdge) {
      setActiveTab('edge');
    } else {
      setActiveTab('workflow');
    }
  }, [selectedNode, selectedEdge]);

  const handleNodeDataChange = (key: string, value: any) => {
    if (selectedNode && onNodeUpdate && !readOnly) {
      onNodeUpdate(selectedNode.id, {
        data: {
          ...selectedNode.data,
          [key]: value,
        },
      });
    }
  };

  const handleNodeConfigChange = (key: string, value: any) => {
    if (selectedNode && onNodeUpdate && !readOnly) {
      onNodeUpdate(selectedNode.id, {
        data: {
          ...selectedNode.data,
          configuration: {
            ...selectedNode.data.configuration,
            [key]: value,
          },
        },
      });
    }
  };

  const handleEdgeDataChange = (key: string, value: any) => {
    if (selectedEdge && onEdgeUpdate && !readOnly) {
      onEdgeUpdate(selectedEdge.id, {
        data: {
          ...selectedEdge.data,
          [key]: value,
        },
      });
    }
  };

  return (
    <div
      className={`workflow-properties bg-white border-l border-gray-200 flex flex-col ${className}`}
      style={{ width: '400px', minWidth: '400px' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Properties
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Close Properties"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mt-3">
          {selectedNode && (
            <button
              onClick={() => setActiveTab('node')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'node'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Node
            </button>
          )}
          {selectedEdge && (
            <button
              onClick={() => setActiveTab('edge')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'edge'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Edge
            </button>
          )}
          <button
            onClick={() => setActiveTab('workflow')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'workflow'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Workflow
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node Properties */}
        {activeTab === 'node' && selectedNode && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Basic Information
              </h4>

              {/* Node Name */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={selectedNode.data.label || ''}
                  onChange={(e) => handleNodeDataChange('label', e.target.value)}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Node Description */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={selectedNode.data.description || ''}
                  onChange={(e) => handleNodeDataChange('description', e.target.value)}
                  disabled={readOnly}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Node Type (Read-only) */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <input
                  type="text"
                  value={selectedNode.type || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              {/* Timeout */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timeout (minutes)
                </label>
                <input
                  type="number"
                  value={selectedNode.data.timeout ? selectedNode.data.timeout / 60000 : 5}
                  onChange={(e) => handleNodeDataChange('timeout', parseInt(e.target.value) * 60000)}
                  disabled={readOnly}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Is Optional */}
              <div className="mb-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedNode.data.isOptional || false}
                    onChange={(e) => handleNodeDataChange('isOptional', e.target.checked)}
                    disabled={readOnly}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Optional step (can fail without stopping workflow)</span>
                </label>
              </div>
            </div>

            {/* Node-Specific Configuration */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Configuration
              </h4>

              {renderNodeSpecificConfig(selectedNode, handleNodeConfigChange, readOnly)}
            </div>

            {/* Retry Configuration */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Retry Settings
              </h4>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Attempts
                </label>
                <input
                  type="number"
                  value={selectedNode.data.retryConfig?.maxAttempts || 3}
                  onChange={(e) => handleNodeDataChange('retryConfig', {
                    ...selectedNode.data.retryConfig,
                    maxAttempts: parseInt(e.target.value)
                  })}
                  disabled={readOnly}
                  min="0"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Backoff Strategy
                </label>
                <select
                  value={selectedNode.data.retryConfig?.backoffStrategy || 'exponential'}
                  onChange={(e) => handleNodeDataChange('retryConfig', {
                    ...selectedNode.data.retryConfig,
                    backoffStrategy: e.target.value
                  })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="fixed">Fixed</option>
                  <option value="linear">Linear</option>
                  <option value="exponential">Exponential</option>
                  <option value="random">Random</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Edge Properties */}
        {activeTab === 'edge' && selectedEdge && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Edge Configuration
              </h4>

              {/* Edge Label */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={selectedEdge.data?.configuration?.label || ''}
                  onChange={(e) => handleEdgeDataChange('configuration', {
                    ...selectedEdge.data?.configuration,
                    label: e.target.value
                  })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Edge Type */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <input
                  type="text"
                  value={selectedEdge.type || 'default'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              {/* Animated */}
              <div className="mb-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedEdge.data?.configuration?.animated || false}
                    onChange={(e) => handleEdgeDataChange('configuration', {
                      ...selectedEdge.data?.configuration,
                      animated: e.target.checked
                    })}
                    disabled={readOnly}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Animated edge</span>
                </label>
              </div>

              {/* Priority */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  value={selectedEdge.data?.priority || 0}
                  onChange={(e) => handleEdgeDataChange('priority', parseInt(e.target.value))}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Higher priority edges are evaluated first
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Properties */}
        {activeTab === 'workflow' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Workflow Settings
              </h4>

              {/* Workflow Name */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={workflow.name || ''}
                  onChange={(e) => onWorkflowUpdate?.({ name: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Workflow Description */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={workflow.description || ''}
                  onChange={(e) => onWorkflowUpdate?.({ description: e.target.value })}
                  disabled={readOnly}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Category */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={workflow.category || 'ticket_automation'}
                  onChange={(e) => onWorkflowUpdate?.({ category: e.target.value as any })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="ticket_automation">Ticket Automation</option>
                  <option value="notification">Notification</option>
                  <option value="escalation">Escalation</option>
                  <option value="approval">Approval</option>
                  <option value="integration">Integration</option>
                  <option value="ml_optimization">ML Optimization</option>
                </select>
              </div>

              {/* Priority */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  value={workflow.priority || 0}
                  onChange={(e) => onWorkflowUpdate?.({ priority: parseInt(e.target.value) })}
                  disabled={readOnly}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>

              {/* Is Active */}
              <div className="mb-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={workflow.isActive || false}
                    onChange={(e) => onWorkflowUpdate?.({ isActive: e.target.checked })}
                    disabled={readOnly}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active (workflow will execute when triggered)</span>
                </label>
              </div>

              {/* Is Template */}
              <div className="mb-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={workflow.isTemplate || false}
                    onChange={(e) => onWorkflowUpdate?.({ isTemplate: e.target.checked })}
                    disabled={readOnly}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">Save as template</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedNode && !selectedEdge && activeTab === 'node' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">
              Select a node to view and edit its properties
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to render node-specific configuration fields
function renderNodeSpecificConfig(
  node: Node,
  onChange: (key: string, value: any) => void,
  readOnly: boolean
) {
  const nodeType = node.type as WorkflowNodeType;

  switch (nodeType) {
    case 'action':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action Type
            </label>
            <select
              value={node.data.configuration?.actionType || 'assign'}
              onChange={(e) => onChange('actionType', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="assign">Assign Ticket</option>
              <option value="update_status">Update Status</option>
              <option value="add_comment">Add Comment</option>
              <option value="send_notification">Send Notification</option>
              <option value="update_priority">Update Priority</option>
              <option value="add_tag">Add Tag</option>
              <option value="remove_tag">Remove Tag</option>
              <option value="escalate">Escalate</option>
              <option value="close_ticket">Close Ticket</option>
            </select>
          </div>
        </div>
      );

    case 'condition':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Condition Type
            </label>
            <select
              value={node.data.configuration?.conditionType || 'if_else'}
              onChange={(e) => onChange('conditionType', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="if_else">If/Else</option>
              <option value="switch">Switch</option>
              <option value="expression">Expression</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logical Operator
            </label>
            <select
              value={node.data.configuration?.logicalOperator || 'AND'}
              onChange={(e) => onChange('logicalOperator', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="AND">AND (all conditions must match)</option>
              <option value="OR">OR (any condition must match)</option>
            </select>
          </div>
        </div>
      );

    case 'delay':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delay Amount
            </label>
            <input
              type="number"
              value={node.data.configuration?.amount || 5}
              onChange={(e) => onChange('amount', parseInt(e.target.value))}
              disabled={readOnly}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <select
              value={node.data.configuration?.unit || 'minutes'}
              onChange={(e) => onChange('unit', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>
      );

    case 'notification':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notification Type
            </label>
            <select
              value={node.data.configuration?.notificationType || 'email'}
              onChange={(e) => onChange('notificationType', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="slack">Slack</option>
              <option value="teams">Microsoft Teams</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="push">Push Notification</option>
              <option value="in_app">In-App</option>
            </select>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-500 italic">
          No specific configuration available for this node type
        </div>
      );
  }
}
