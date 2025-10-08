'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  CodeBracketIcon,
  QuestionMarkCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';
import { ConditionNodeConfig } from '@/lib/types/workflow';

interface ConditionNodeData {
  label: string;
  configuration: ConditionNodeConfig;
  description?: string;
  timeout?: number;
  isOptional?: boolean;
}

const conditionTypeIcons = {
  if_else: QuestionMarkCircleIcon,
  switch: ArrowPathIcon,
  expression: CodeBracketIcon,
};

const conditionTypeColors = {
  if_else: 'amber',
  switch: 'orange',
  expression: 'yellow',
};

export default function ConditionNode({ data, selected }: NodeProps<ConditionNodeData>) {
  const { label, configuration, description, timeout, isOptional } = data;
  const conditionType = configuration.conditionType;
  const color = conditionTypeColors[conditionType] || 'amber';
  const IconComponent = conditionTypeIcons[conditionType] || QuestionMarkCircleIcon;

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'amber':
        return {
          bg: 'from-amber-50 to-amber-100',
          border: 'border-amber-300',
          iconBg: 'bg-amber-500',
          text: 'text-amber-900',
          subtext: 'text-amber-700',
          ring: 'ring-amber-400',
          badge: 'bg-amber-100 text-amber-800',
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
      default:
        return {
          bg: 'from-amber-50 to-amber-100',
          border: 'border-amber-300',
          iconBg: 'bg-amber-500',
          text: 'text-amber-900',
          subtext: 'text-amber-700',
          ring: 'ring-amber-400',
          badge: 'bg-amber-100 text-amber-800',
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
        id="condition-input"
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
            Condition Node
          </p>
        </div>
      </div>

      {/* Condition Type Badge */}
      <div className="mb-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses.badge}`}>
          {conditionType.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>

      {/* Node Body */}
      <div className="space-y-2">
        {/* Conditions Summary */}
        {configuration.conditions && configuration.conditions.length > 0 && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">
              Conditions ({configuration.logicalOperator || 'AND'}):
            </div>
            <div className="space-y-1">
              {configuration.conditions.slice(0, 2).map((condition, index) => (
                <div key={index} className="flex items-center space-x-1 text-xs">
                  <span className="truncate font-medium">{condition.field}</span>
                  <span className={`${colorClasses.text} opacity-75`}>{condition.operator}</span>
                  <span className="truncate">{String(condition.value)}</span>
                </div>
              ))}
              {configuration.conditions.length > 2 && (
                <div className="italic opacity-75">
                  +{configuration.conditions.length - 2} more...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Expression */}
        {configuration.customExpression && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Expression:</div>
            <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
              {configuration.customExpression.length > 30
                ? `${configuration.customExpression.substring(0, 30)}...`
                : configuration.customExpression
              }
            </code>
          </div>
        )}

        {/* Output Paths */}
        {configuration.outputPaths && configuration.outputPaths.length > 0 && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Output Paths:</div>
            <div className="space-y-1">
              {configuration.outputPaths.slice(0, 3).map((path, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="truncate">{path.condition || `Path ${index + 1}`}</span>
                  <span className="text-xs opacity-75">→</span>
                </div>
              ))}
              {configuration.outputPaths.length > 3 && (
                <div className="italic opacity-75">
                  +{configuration.outputPaths.length - 3} more...
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

      {/* Output Handles - True/Yes Path */}
      <Handle
        type="source"
        position={Position.Right}
        id="condition-true"
        className="w-3 h-3 bg-green-500 border-2 border-white"
        style={{ right: -6, top: '35%' }}
      />

      {/* Output Handles - False/No Path */}
      <Handle
        type="source"
        position={Position.Right}
        id="condition-false"
        className="w-3 h-3 bg-red-500 border-2 border-white"
        style={{ right: -6, top: '65%' }}
      />

      {/* Default Path (if configured) */}
      {configuration.defaultPath && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="condition-default"
          className="w-3 h-3 bg-gray-500 border-2 border-white"
          style={{ bottom: -6 }}
        />
      )}

      {/* Connection Points Visual Indicators */}
      <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full opacity-50`}></div>
      </div>

      {/* True/False Path Indicators */}
      <div className="absolute right-0 top-1/3 transform translate-x-1 -translate-y-1/2">
        <div className="w-2 h-2 bg-green-400 rounded-full opacity-50"></div>
      </div>
      <div className="absolute right-0 top-2/3 transform translate-x-1 -translate-y-1/2">
        <div className="w-2 h-2 bg-red-400 rounded-full opacity-50"></div>
      </div>

      {configuration.defaultPath && (
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full opacity-50"></div>
        </div>
      )}

      {/* Output Labels */}
      <div className="absolute -right-6 top-1/3 transform -translate-y-1/2">
        <span className="text-xs font-medium text-green-600 bg-white px-1 rounded shadow-sm">
          TRUE
        </span>
      </div>
      <div className="absolute -right-6 top-2/3 transform -translate-y-1/2">
        <span className="text-xs font-medium text-red-600 bg-white px-1 rounded shadow-sm">
          FALSE
        </span>
      </div>

      {/* Hover Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        {conditionType.replace(/_/g, ' ')} condition
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>
    </div>
  );
}