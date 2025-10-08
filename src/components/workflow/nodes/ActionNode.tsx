'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  CogIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  ExclamationTriangleIcon,
  TagIcon,
  CheckIcon,
  PlusIcon,
  ArrowUpIcon,
} from '@heroicons/react/24/solid';
import { ActionNodeConfig } from '@/lib/types/workflow';

interface ActionNodeData {
  label: string;
  configuration: ActionNodeConfig;
  description?: string;
  timeout?: number;
  isOptional?: boolean;
}

const actionIcons = {
  assign: UserIcon,
  update_status: ArrowUpIcon,
  add_comment: ChatBubbleLeftIcon,
  send_notification: ExclamationTriangleIcon,
  update_priority: ArrowUpIcon,
  add_tag: TagIcon,
  remove_tag: TagIcon,
  escalate: ArrowUpIcon,
  close_ticket: CheckIcon,
  create_subtask: PlusIcon,
  custom_script: CogIcon,
};

const actionColors = {
  assign: 'blue',
  update_status: 'purple',
  add_comment: 'green',
  send_notification: 'yellow',
  update_priority: 'orange',
  add_tag: 'indigo',
  remove_tag: 'red',
  escalate: 'pink',
  close_ticket: 'emerald',
  create_subtask: 'cyan',
  custom_script: 'gray',
};

export default function ActionNode({ data, selected }: NodeProps<ActionNodeData>) {
  const { label, configuration, description, timeout, isOptional } = data;
  const actionType = configuration.actionType;
  const color = actionColors[actionType] || 'blue';
  const IconComponent = actionIcons[actionType] || CogIcon;

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'from-blue-50 to-blue-100',
          border: 'border-blue-300',
          iconBg: 'bg-blue-500',
          text: 'text-blue-900',
          subtext: 'text-blue-700',
          ring: 'ring-blue-400',
          badge: 'bg-blue-100 text-blue-800',
        };
      case 'purple':
        return {
          bg: 'from-purple-50 to-purple-100',
          border: 'border-purple-300',
          iconBg: 'bg-purple-500',
          text: 'text-purple-900',
          subtext: 'text-purple-700',
          ring: 'ring-purple-400',
          badge: 'bg-purple-100 text-purple-800',
        };
      case 'green':
        return {
          bg: 'from-green-50 to-green-100',
          border: 'border-green-300',
          iconBg: 'bg-green-500',
          text: 'text-green-900',
          subtext: 'text-green-700',
          ring: 'ring-green-400',
          badge: 'bg-green-100 text-green-800',
        };
      case 'yellow':
        return {
          bg: 'from-yellow-50 to-yellow-100',
          border: 'border-yellow-300',
          iconBg: 'bg-yellow-500',
          text: 'text-yellow-900',
          subtext: 'text-yellow-700',
          ring: 'ring-yellow-400',
          badge: 'bg-yellow-100 text-yellow-800',
        };
      case 'orange':
        return {
          bg: 'from-orange-50 to-orange-100',
          border: 'border-orange-300',
          iconBg: 'bg-orange-500',
          text: 'text-orange-900',
          subtext: 'text-orange-700',
          ring: 'ring-orange-400',
          badge: 'bg-orange-100 text-orange-800',
        };
      case 'red':
        return {
          bg: 'from-red-50 to-red-100',
          border: 'border-red-300',
          iconBg: 'bg-red-500',
          text: 'text-red-900',
          subtext: 'text-red-700',
          ring: 'ring-red-400',
          badge: 'bg-red-100 text-red-800',
        };
      default:
        return {
          bg: 'from-gray-50 to-gray-100',
          border: 'border-gray-300',
          iconBg: 'bg-gray-500',
          text: 'text-gray-900',
          subtext: 'text-gray-700',
          ring: 'ring-gray-400',
          badge: 'bg-gray-100 text-gray-800',
        };
    }
  };

  const colorClasses = getColorClasses(color);

  return (
    <div
      className={`
        relative bg-gradient-to-br ${colorClasses.bg}
        border-2 ${colorClasses.border} rounded-lg p-4 min-w-[160px] max-w-[220px]
        shadow-sm hover:shadow-md transition-all duration-200
        ${selected ? `ring-2 ${colorClasses.ring} ring-opacity-75` : ''}
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="action-input"
        className={`w-3 h-3 ${colorClasses.iconBg} border-2 border-white`}
        style={{ left: -6 }}
      />

      {/* Node Header */}
      <div className="flex items-center space-x-2 mb-2">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 ${colorClasses.iconBg} rounded-full flex items-center justify-center`}>
            <IconComponent className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${colorClasses.text} truncate`}>
            {label}
          </h3>
          <p className={`text-xs ${colorClasses.subtext}`}>
            Action Node
          </p>
        </div>
      </div>

      {/* Action Type Badge */}
      <div className="mb-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses.badge}`}>
          {actionType.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>

      {/* Node Body */}
      <div className="space-y-2">
        {/* Action Parameters Summary */}
        {configuration.parameters && Object.keys(configuration.parameters).length > 0 && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Parameters:</div>
            <div className="space-y-1">
              {Object.entries(configuration.parameters).slice(0, 2).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="truncate">{key}:</span>
                  <span className="font-medium truncate ml-1">{String(value)}</span>
                </div>
              ))}
              {Object.keys(configuration.parameters).length > 2 && (
                <div className="italic opacity-75">
                  +{Object.keys(configuration.parameters).length - 2} more...
                </div>
              )}
            </div>
          </div>
        )}

        {description && (
          <p className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            {description}
          </p>
        )}

        {/* Timeout and Optional Indicators */}
        <div className="flex items-center justify-between text-xs">
          {timeout && (
            <span className={`${colorClasses.subtext} opacity-75`}>
              ⏱ {Math.round(timeout / 1000 / 60)}m
            </span>
          )}
          {isOptional && (
            <span className={`${colorClasses.badge} px-1 py-0.5 rounded text-xs`}>
              Optional
            </span>
          )}
        </div>
      </div>

      {/* Node Status Indicators */}
      <div className="absolute -top-1 -right-1">
        <div className={`w-3 h-3 ${colorClasses.iconBg} rounded-full border-2 border-white shadow-sm`}></div>
      </div>

      {isOptional && (
        <div className="absolute -top-1 -left-1">
          <div className="w-3 h-3 bg-yellow-400 rounded-full border-2 border-white shadow-sm"></div>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="action-output"
        className={`w-3 h-3 ${colorClasses.iconBg} border-2 border-white`}
        style={{ right: -6 }}
      />

      {/* Error Output Handle (for error handling) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="action-error"
        className="w-3 h-3 bg-red-500 border-2 border-white"
        style={{ bottom: -6 }}
      />

      {/* Connection Points Visual Indicators */}
      <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full opacity-50`}></div>
      </div>
      <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full opacity-50`}></div>
      </div>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1">
        <div className="w-2 h-2 bg-red-400 rounded-full opacity-50"></div>
      </div>

      {/* Hover Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        {actionType.replace(/_/g, ' ')} action
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>
    </div>
  );
}