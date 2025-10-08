'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  StopIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { EndNodeConfig } from '@/lib/types/workflow';

interface EndNodeData {
  label: string;
  configuration: EndNodeConfig;
  description?: string;
  isOptional?: boolean;
}

const endTypeIcons = {
  success: CheckCircleIcon,
  failure: XCircleIcon,
  cancelled: ExclamationTriangleIcon,
};

const endTypeColors = {
  success: {
    bg: 'from-green-50 to-green-100',
    border: 'border-green-300',
    iconBg: 'bg-green-500',
    text: 'text-green-900',
    subtext: 'text-green-700',
    ring: 'ring-green-400',
    badge: 'bg-green-100 text-green-800',
  },
  failure: {
    bg: 'from-red-50 to-red-100',
    border: 'border-red-300',
    iconBg: 'bg-red-500',
    text: 'text-red-900',
    subtext: 'text-red-700',
    ring: 'ring-red-400',
    badge: 'bg-red-100 text-red-800',
  },
  cancelled: {
    bg: 'from-orange-50 to-orange-100',
    border: 'border-orange-300',
    iconBg: 'bg-orange-500',
    text: 'text-orange-900',
    subtext: 'text-orange-700',
    ring: 'ring-orange-400',
    badge: 'bg-orange-100 text-orange-800',
  },
};

export default function EndNode({ data, selected }: NodeProps<EndNodeData>) {
  const { label, configuration, description } = data;
  const endType = configuration.endType;
  const IconComponent = endTypeIcons[endType] || StopIcon;
  const colorClasses = endTypeColors[endType] || endTypeColors.success;

  return (
    <div
      className={`
        relative bg-gradient-to-br ${colorClasses.bg}
        border-2 ${colorClasses.border} rounded-lg p-4 min-w-[160px] max-w-[200px]
        shadow-sm hover:shadow-md transition-all duration-200
        ${selected ? `ring-2 ${colorClasses.ring} ring-opacity-75` : ''}
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="end-input"
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
            End Node
          </p>
        </div>
      </div>

      {/* End Type Badge */}
      <div className="mb-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses.badge}`}>
          {endType.toUpperCase()}
        </span>
      </div>

      {/* Node Body */}
      <div className="space-y-2">
        {/* Output Data Summary */}
        {configuration.outputData && Object.keys(configuration.outputData).length > 0 && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Output Data:</div>
            <div className="space-y-1">
              {Object.entries(configuration.outputData).slice(0, 2).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="truncate">{key}:</span>
                  <span className="font-medium truncate ml-1">{String(value)}</span>
                </div>
              ))}
              {Object.keys(configuration.outputData).length > 2 && (
                <div className="italic opacity-75">
                  +{Object.keys(configuration.outputData).length - 2} more...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cleanup Actions */}
        {configuration.cleanupActions && configuration.cleanupActions.length > 0 && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Cleanup Actions:</div>
            <div className="space-y-1">
              {configuration.cleanupActions.slice(0, 2).map((action, index) => (
                <div key={index} className="flex items-center">
                  <span className="w-1 h-1 bg-current rounded-full mr-2"></span>
                  <span className="truncate">{action}</span>
                </div>
              ))}
              {configuration.cleanupActions.length > 2 && (
                <div className="italic opacity-75">
                  +{configuration.cleanupActions.length - 2} more...
                </div>
              )}
            </div>
          </div>
        )}

        {/* End Notifications */}
        {configuration.notifications && configuration.notifications.length > 0 && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">End Notifications:</div>
            <div className="space-y-1">
              {configuration.notifications.slice(0, 2).map((notification, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="w-1 h-1 bg-current rounded-full"></span>
                  <span className="truncate">
                    {notification.notificationType}: {notification.recipients.length} recipients
                  </span>
                </div>
              ))}
              {configuration.notifications.length > 2 && (
                <div className="italic opacity-75">
                  +{configuration.notifications.length - 2} more...
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
      </div>

      {/* Node Status Indicator */}
      <div className="absolute -top-1 -right-1">
        <div className={`w-3 h-3 ${colorClasses.iconBg} rounded-full border-2 border-white shadow-sm`}></div>
      </div>

      {/* Final State Indicator */}
      <div className="absolute top-2 right-2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full`}></div>
      </div>

      {/* Connection Point Visual Indicator */}
      <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full opacity-50`}></div>
      </div>

      {/* End Type Specific Visual Elements */}
      {endType === 'success' && (
        <div className="absolute bottom-1 right-1">
          <CheckCircleIcon className="w-4 h-4 text-green-500 opacity-50" />
        </div>
      )}

      {endType === 'failure' && (
        <div className="absolute bottom-1 right-1">
          <XCircleIcon className="w-4 h-4 text-red-500 opacity-50" />
        </div>
      )}

      {endType === 'cancelled' && (
        <div className="absolute bottom-1 right-1">
          <ExclamationTriangleIcon className="w-4 h-4 text-orange-500 opacity-50" />
        </div>
      )}

      {/* Progress Indicator - Always 100% for end nodes */}
      <div className="absolute -bottom-2 left-0 right-0">
        <div className="w-full h-1 bg-gray-200 rounded-full">
          <div className={`h-full ${colorClasses.iconBg} rounded-full`} style={{ width: '100%' }}></div>
        </div>
      </div>

      {/* Hover Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        Workflow ends with {endType}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>

      {/* Terminal Node Indicator */}
      <div className="absolute -bottom-1 -left-1">
        <div className="w-3 h-3 bg-gray-700 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
          <div className="w-1 h-1 bg-white rounded-full"></div>
        </div>
      </div>
    </div>
  );
}