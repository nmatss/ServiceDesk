'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PlayIcon } from '@heroicons/react/24/solid';
import { StartNodeConfig } from '@/lib/types/workflow';

interface StartNodeData {
  label: string;
  configuration: StartNodeConfig;
  description?: string;
  isOptional?: boolean;
}

export default function StartNode({ data, selected }: NodeProps<StartNodeData>) {
  const { label, configuration, description } = data;

  return (
    <div
      className={`
        relative bg-gradient-to-br from-green-50 to-green-100
        border-2 border-green-300 rounded-lg p-4 min-w-[160px] max-w-[200px]
        shadow-sm hover:shadow-md transition-all duration-200
        ${selected ? 'ring-2 ring-green-400 ring-opacity-75' : ''}
      `}
    >
      {/* Node Header */}
      <div className="flex items-center space-x-2 mb-2">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <PlayIcon className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-green-900 truncate">
            {label}
          </h3>
          <p className="text-xs text-green-700">
            Start Node
          </p>
        </div>
      </div>

      {/* Node Body */}
      <div className="space-y-2">
        <div className="text-xs text-green-800">
          <div className="flex items-center justify-between">
            <span>Trigger:</span>
            <span className="font-medium">{configuration.triggerType}</span>
          </div>
        </div>

        {description && (
          <p className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
            {description}
          </p>
        )}

        {/* Trigger Conditions Summary */}
        {configuration.conditions?.filters && configuration.conditions.filters.length > 0 && (
          <div className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
            <div className="font-medium mb-1">Conditions:</div>
            <div className="space-y-1">
              {configuration.conditions.filters.slice(0, 2).map((filter, index) => (
                <div key={index} className="flex items-center space-x-1">
                  <span className="truncate">{filter.field}</span>
                  <span className="text-green-500">{filter.operator}</span>
                  <span className="truncate font-medium">{String(filter.value)}</span>
                </div>
              ))}
              {configuration.conditions.filters.length > 2 && (
                <div className="text-green-600 italic">
                  +{configuration.conditions.filters.length - 2} more...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Node Status Indicator */}
      <div className="absolute -top-1 -right-1">
        <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="start-output"
        className="w-3 h-3 bg-green-500 border-2 border-white"
        style={{ right: -6 }}
      />

      {/* Connection Points Visual Indicator */}
      <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2">
        <div className="w-2 h-2 bg-green-400 rounded-full opacity-50"></div>
      </div>

      {/* Hover Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        Start of workflow execution
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>
    </div>
  );
}