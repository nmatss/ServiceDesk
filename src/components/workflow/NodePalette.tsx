'use client';

/**
 * SPRINT 2: Node Palette Component
 * Drag-and-drop library of available workflow nodes
 */

import React from 'react';
import { WorkflowNodeType } from '@/lib/types/workflow';
import {
  PlayCircleIcon,
  StopCircleIcon,
  BoltIcon,
  BeakerIcon,
  CheckCircleIcon,
  ClockIcon,
  BellIcon,
  GlobeAltIcon,
  CodeBracketIcon,
  CpuChipIcon,
  UserCircleIcon,
  ArrowPathIcon,
  RectangleStackIcon,
  Square3Stack3DIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/24/outline';

interface NodeCategory {
  name: string;
  nodes: NodeDefinition[];
}

interface NodeDefinition {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}

const nodeCategories: NodeCategory[] = [
  {
    name: 'Flow Control',
    nodes: [
      {
        type: 'start',
        label: 'Start',
        description: 'Workflow entry point with trigger configuration',
        icon: PlayCircleIcon,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-300',
      },
      {
        type: 'end',
        label: 'End',
        description: 'Workflow exit point with output data',
        icon: StopCircleIcon,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
      },
      {
        type: 'condition',
        label: 'Condition',
        description: 'Branch workflow based on conditions',
        icon: BeakerIcon,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-300',
      },
      {
        type: 'parallel',
        label: 'Parallel',
        description: 'Execute multiple branches simultaneously',
        icon: Square3Stack3DIcon,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-300',
      },
      {
        type: 'loop',
        label: 'Loop',
        description: 'Repeat actions for each item in collection',
        icon: ArrowPathIcon,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-300',
      },
    ],
  },
  {
    name: 'Actions',
    nodes: [
      {
        type: 'action',
        label: 'Action',
        description: 'Perform ticket operations (assign, update, etc.)',
        icon: BoltIcon,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
      },
      {
        type: 'delay',
        label: 'Delay',
        description: 'Wait for specified time period',
        icon: ClockIcon,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-300',
      },
      {
        type: 'script',
        label: 'Script',
        description: 'Execute custom JavaScript code',
        icon: CodeBracketIcon,
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300',
      },
    ],
  },
  {
    name: 'Human Interaction',
    nodes: [
      {
        type: 'approval',
        label: 'Approval',
        description: 'Multi-level approval with escalation',
        icon: CheckCircleIcon,
        color: 'text-violet-600',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-300',
      },
      {
        type: 'human_task',
        label: 'Human Task',
        description: 'Request human input or review',
        icon: UserCircleIcon,
        color: 'text-pink-600',
        bgColor: 'bg-pink-50',
        borderColor: 'border-pink-300',
      },
    ],
  },
  {
    name: 'Notifications & Integration',
    nodes: [
      {
        type: 'notification',
        label: 'Notification',
        description: 'Send email, SMS, WhatsApp, or push notifications',
        icon: BellIcon,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-300',
      },
      {
        type: 'webhook',
        label: 'Webhook',
        description: 'Call external HTTP APIs',
        icon: GlobeAltIcon,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50',
        borderColor: 'border-cyan-300',
      },
      {
        type: 'integration',
        label: 'Integration',
        description: 'Connect to external systems',
        icon: PuzzlePieceIcon,
        color: 'text-teal-600',
        bgColor: 'bg-teal-50',
        borderColor: 'border-teal-300',
      },
    ],
  },
  {
    name: 'Advanced',
    nodes: [
      {
        type: 'ml_prediction',
        label: 'ML Prediction',
        description: 'AI/ML model predictions and recommendations',
        icon: CpuChipIcon,
        color: 'text-fuchsia-600',
        bgColor: 'bg-fuchsia-50',
        borderColor: 'border-fuchsia-300',
      },
      {
        type: 'subworkflow',
        label: 'Subworkflow',
        description: 'Execute another workflow as a step',
        icon: RectangleStackIcon,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-300',
      },
    ],
  },
];

interface NodePaletteProps {
  className?: string;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ className = '' }) => {
  const onDragStart = (event: React.DragEvent, nodeType: WorkflowNodeType, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className={`node-palette ${className}`}>
      <div className="p-4 space-y-6">
        {nodeCategories.map((category) => (
          <div key={category.name} className="category-section">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {category.name}
            </h4>
            <div className="space-y-2">
              {category.nodes.map((node) => {
                const IconComponent = node.icon;
                return (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, node.type, node.label)}
                    className={`
                      node-palette-item
                      flex items-start p-3 rounded-lg border-2
                      ${node.bgColor} ${node.borderColor}
                      cursor-move hover:shadow-md transition-all duration-200
                      group
                    `}
                  >
                    <div className={`flex-shrink-0 ${node.color}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${node.color} truncate`}>
                        {node.label}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                        {node.description}
                      </div>
                    </div>
                    <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-xs text-gray-400">
                        Drag
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Drag hint */}
      <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
        <div className="text-xs text-blue-700 flex items-start">
          <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <div className="font-medium mb-1">How to use:</div>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>Drag a node from the palette</li>
              <li>Drop it onto the canvas</li>
              <li>Connect nodes by dragging from edge handles</li>
              <li>Click a node to configure its properties</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodePalette;
