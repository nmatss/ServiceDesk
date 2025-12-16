'use client';

/**
 * Workflow Sidebar Component
 * Sidebar with node palette and workflow metadata
 */

import React, { useState } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import NodePalette from './NodePalette';

interface WorkflowSidebarProps {
  onClose?: () => void;
  readOnly?: boolean;
  className?: string;
}

export default function WorkflowSidebar({
  onClose,
  readOnly = false,
  className = '',
}: WorkflowSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'nodes' | 'info'>('nodes');

  return (
    <div
      className={`workflow-sidebar bg-white border-r border-gray-200 flex flex-col ${className}`}
      style={{ width: '320px', minWidth: '320px' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Workflow Builder
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              title="Close Sidebar"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('nodes')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'nodes'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Nodes
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'info'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Info
          </button>
        </div>

        {/* Search (only for nodes tab) */}
        {activeTab === 'nodes' && (
          <div className="mt-3 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'nodes' && (
          <NodePalette className="h-full" />
        )}

        {activeTab === 'info' && (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                About Workflow Builder
              </h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Create powerful automated workflows by connecting nodes together.
                Drag nodes from the palette and drop them onto the canvas to build
                your workflow.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Quick Tips
              </h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>Every workflow must start with a Start node and end with an End node</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>Click on a node to configure its properties</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>Connect nodes by dragging from the edge handles</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>Use Condition nodes to create branching logic</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>Test your workflow before deploying to production</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Node Categories
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium text-gray-700">Flow Control:</span> Start, End, Condition, Parallel, Loop
                </div>
                <div>
                  <span className="font-medium text-gray-700">Actions:</span> Action, Delay, Script
                </div>
                <div>
                  <span className="font-medium text-gray-700">Human Interaction:</span> Approval, Human Task
                </div>
                <div>
                  <span className="font-medium text-gray-700">Integration:</span> Notification, Webhook, Integration
                </div>
                <div>
                  <span className="font-medium text-gray-700">Advanced:</span> ML Prediction, Subworkflow
                </div>
              </div>
            </div>

            {!readOnly && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Need Help?
                </h4>
                <p className="text-xs text-blue-700">
                  Check out our documentation for detailed guides on building
                  complex workflows and automation.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
