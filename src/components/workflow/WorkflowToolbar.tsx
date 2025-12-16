'use client';

/**
 * Workflow Toolbar Component
 * Top toolbar with save, test, deploy, and validation actions
 */

import React from 'react';
import {
  ArrowDownTrayIcon,
  PlayIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  Bars3Icon,
  Cog6ToothIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { WorkflowDefinition } from '@/lib/types/workflow';

interface WorkflowToolbarProps {
  workflow?: Partial<WorkflowDefinition>;
  onSave?: () => void;
  onTest?: () => void;
  onDeploy?: () => void;
  onValidate?: () => void;
  onToggleSidebar?: () => void;
  onToggleProperties?: () => void;
  readOnly?: boolean;
  hasChanges?: boolean;
}

export default function WorkflowToolbar({
  workflow,
  onSave,
  onTest,
  onDeploy,
  onValidate,
  onToggleSidebar,
  onToggleProperties,
  readOnly = false,
  hasChanges = false,
}: WorkflowToolbarProps) {
  return (
    <div className="workflow-toolbar bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      {/* Left Section */}
      <div className="flex items-center space-x-3">
        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Toggle Sidebar"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>

        {/* Workflow Name */}
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {workflow?.name || 'Untitled Workflow'}
          </h2>
          {hasChanges && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
              Unsaved
            </span>
          )}
          {workflow?.isActive && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
      </div>

      {/* Center Section - Action Buttons */}
      <div className="flex items-center space-x-2">
        {!readOnly && (
          <>
            {/* Validate */}
            <button
              onClick={onValidate}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              title="Validate Workflow"
            >
              <CheckCircleIcon className="w-4 h-4" />
              <span>Validate</span>
            </button>

            {/* Test */}
            <button
              onClick={onTest}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              title="Test Workflow"
            >
              <PlayIcon className="w-4 h-4" />
              <span>Test</span>
            </button>

            {/* Save */}
            <button
              onClick={onSave}
              disabled={!hasChanges}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                hasChanges
                  ? 'text-white bg-blue-600 hover:bg-blue-700'
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}
              title="Save Workflow"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Save</span>
            </button>

            {/* Deploy */}
            <button
              onClick={onDeploy}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              title="Deploy Workflow"
            >
              <RocketLaunchIcon className="w-4 h-4" />
              <span>Deploy</span>
            </button>
          </>
        )}

        {readOnly && (
          <div className="flex items-center space-x-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg">
            <EyeIcon className="w-4 h-4" />
            <span>Read Only Mode</span>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-2">
        {/* Properties Toggle */}
        <button
          onClick={onToggleProperties}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Toggle Properties Panel"
        >
          <Cog6ToothIcon className="w-5 h-5" />
        </button>

        {/* Workflow Info */}
        {workflow && (
          <div className="text-xs text-gray-500">
            v{workflow.version || 1}
          </div>
        )}
      </div>
    </div>
  );
}
