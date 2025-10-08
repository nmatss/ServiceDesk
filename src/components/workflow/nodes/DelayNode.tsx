'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ClockIcon, CalendarIcon, PauseIcon } from '@heroicons/react/24/solid';
import { DelayNodeConfig } from '@/lib/types/workflow';

interface DelayNodeData {
  label: string;
  configuration: DelayNodeConfig;
  description?: string;
  timeout?: number;
  isOptional?: boolean;
}

const delayTypeIcons = {
  fixed: ClockIcon,
  dynamic: ClockIcon,
  business_hours: CalendarIcon,
  until_date: CalendarIcon,
};

export default function DelayNode({ data, selected }: NodeProps<DelayNodeData>) {
  const { label, configuration, description, timeout, isOptional } = data;
  const delayType = configuration.delayType;
  const IconComponent = delayTypeIcons[delayType] || PauseIcon;

  const colorClasses = {
    bg: 'from-indigo-50 to-indigo-100',
    border: 'border-indigo-300',
    iconBg: 'bg-indigo-500',
    text: 'text-indigo-900',
    subtext: 'text-indigo-700',
    ring: 'ring-indigo-400',
    badge: 'bg-indigo-100 text-indigo-800',
  };

  const formatDelayDuration = () => {
    if (configuration.delayType === 'until_date') {
      return configuration.untilDate ? `Until: ${configuration.untilDate}` : 'Until specified date';
    }

    if (configuration.delayType === 'dynamic') {
      return configuration.dynamicExpression || 'Dynamic delay';
    }

    if (configuration.amount && configuration.unit) {
      return `${configuration.amount} ${configuration.unit}`;
    }

    return 'Configured delay';
  };

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
        id="delay-input"
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
            Delay Node
          </p>
        </div>
      </div>

      {/* Delay Type and Duration */}
      <div className="mb-2 space-y-1">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses.badge}`}>
          {delayType.replace(/_/g, ' ').toUpperCase()}
        </span>
        <div className={`text-xs ${colorClasses.text} font-medium`}>
          {formatDelayDuration()}
        </div>
      </div>

      {/* Node Body */}
      <div className="space-y-2">
        {/* Business Hours Indicator */}
        {configuration.businessHoursOnly && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="flex items-center space-x-1">
              <CalendarIcon className="w-3 h-3" />
              <span className="font-medium">Business Hours Only</span>
            </div>
          </div>
        )}

        {/* Dynamic Expression */}
        {configuration.dynamicExpression && configuration.delayType === 'dynamic' && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Expression:</div>
            <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
              {configuration.dynamicExpression.length > 25
                ? `${configuration.dynamicExpression.substring(0, 25)}...`
                : configuration.dynamicExpression
              }
            </code>
          </div>
        )}

        {/* Until Date */}
        {configuration.untilDate && configuration.delayType === 'until_date' && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Target Date:</div>
            <div className="flex items-center space-x-1">
              <CalendarIcon className="w-3 h-3" />
              <span>{configuration.untilDate}</span>
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
              ⏱ {Math.round(timeout / 1000 / 60)}m max
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

      {/* Delay Progress Indicator */}
      <div className="absolute top-2 right-2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full animate-pulse`}></div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="delay-output"
        className={`w-3 h-3 ${colorClasses.iconBg} border-2 border-white`}
        style={{ right: -6 }}
      />

      {/* Connection Points Visual Indicators */}
      <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full opacity-50`}></div>
      </div>
      <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full opacity-50`}></div>
      </div>

      {/* Timer Visual */}
      <div className="absolute bottom-1 left-1">
        <ClockIcon className="w-4 h-4 text-indigo-400 opacity-75" />
      </div>

      {/* Countdown/Timer Display (placeholder for real-time display) */}
      <div className="absolute bottom-1 right-1">
        <div className={`text-xs font-mono ${colorClasses.text} bg-white bg-opacity-75 px-1 rounded`}>
          --:--
        </div>
      </div>

      {/* Hover Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        {delayType.replace(/_/g, ' ')} delay
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>
    </div>
  );
}