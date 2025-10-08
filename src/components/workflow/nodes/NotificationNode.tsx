'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  BellIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/solid';
import { NotificationNodeConfig } from '@/lib/types/workflow';

interface NotificationNodeData {
  label: string;
  configuration: NotificationNodeConfig;
  description?: string;
  timeout?: number;
  isOptional?: boolean;
}

const notificationTypeIcons = {
  email: EnvelopeIcon,
  sms: DevicePhoneMobileIcon,
  slack: ChatBubbleLeftRightIcon,
  teams: ChatBubbleLeftRightIcon,
  whatsapp: ChatBubbleLeftRightIcon,
  push: BellIcon,
  in_app: BellIcon,
};

const notificationTypeColors = {
  email: 'blue',
  sms: 'green',
  slack: 'purple',
  teams: 'indigo',
  whatsapp: 'emerald',
  push: 'orange',
  in_app: 'cyan',
};

export default function NotificationNode({ data, selected }: NodeProps<NotificationNodeData>) {
  const { label, configuration, description, timeout, isOptional } = data;
  const notificationType = configuration.notificationType;
  const color = notificationTypeColors[notificationType] || 'blue';
  const IconComponent = notificationTypeIcons[notificationType] || BellIcon;

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: {
        bg: 'from-blue-50 to-blue-100',
        border: 'border-blue-300',
        iconBg: 'bg-blue-500',
        text: 'text-blue-900',
        subtext: 'text-blue-700',
        ring: 'ring-blue-400',
        badge: 'bg-blue-100 text-blue-800',
      },
      green: {
        bg: 'from-green-50 to-green-100',
        border: 'border-green-300',
        iconBg: 'bg-green-500',
        text: 'text-green-900',
        subtext: 'text-green-700',
        ring: 'ring-green-400',
        badge: 'bg-green-100 text-green-800',
      },
      purple: {
        bg: 'from-purple-50 to-purple-100',
        border: 'border-purple-300',
        iconBg: 'bg-purple-500',
        text: 'text-purple-900',
        subtext: 'text-purple-700',
        ring: 'ring-purple-400',
        badge: 'bg-purple-100 text-purple-800',
      },
      orange: {
        bg: 'from-orange-50 to-orange-100',
        border: 'border-orange-300',
        iconBg: 'bg-orange-500',
        text: 'text-orange-900',
        subtext: 'text-orange-700',
        ring: 'ring-orange-400',
        badge: 'bg-orange-100 text-orange-800',
      },
      emerald: {
        bg: 'from-emerald-50 to-emerald-100',
        border: 'border-emerald-300',
        iconBg: 'bg-emerald-500',
        text: 'text-emerald-900',
        subtext: 'text-emerald-700',
        ring: 'ring-emerald-400',
        badge: 'bg-emerald-100 text-emerald-800',
      },
      cyan: {
        bg: 'from-cyan-50 to-cyan-100',
        border: 'border-cyan-300',
        iconBg: 'bg-cyan-500',
        text: 'text-cyan-900',
        subtext: 'text-cyan-700',
        ring: 'ring-cyan-400',
        badge: 'bg-cyan-100 text-cyan-800',
      },
      indigo: {
        bg: 'from-indigo-50 to-indigo-100',
        border: 'border-indigo-300',
        iconBg: 'bg-indigo-500',
        text: 'text-indigo-900',
        subtext: 'text-indigo-700',
        ring: 'ring-indigo-400',
        badge: 'bg-indigo-100 text-indigo-800',
      },
    };
    return colorMap[color] || colorMap.blue;
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
        id="notification-input"
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
            Notification Node
          </p>
        </div>
      </div>

      {/* Notification Type and Priority */}
      <div className="mb-2 flex items-center space-x-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses.badge}`}>
          {notificationType.toUpperCase()}
        </span>
        {configuration.deliveryOptions?.priority && configuration.deliveryOptions.priority !== 'normal' && (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            configuration.deliveryOptions.priority === 'urgent' ? 'bg-red-100 text-red-800' :
            configuration.deliveryOptions.priority === 'high' ? 'bg-orange-100 text-orange-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {configuration.deliveryOptions.priority.toUpperCase()}
          </span>
        )}
      </div>

      {/* Node Body */}
      <div className="space-y-2">
        {/* Recipients Summary */}
        {configuration.recipients && configuration.recipients.length > 0 && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">
              Recipients ({configuration.recipients.length}):
            </div>
            <div className="space-y-1">
              {configuration.recipients.slice(0, 2).map((recipient, index) => (
                <div key={index} className="flex items-center space-x-1">
                  <span className="w-1 h-1 bg-current rounded-full"></span>
                  <span className="truncate">
                    {recipient.type}: {recipient.value}
                  </span>
                </div>
              ))}
              {configuration.recipients.length > 2 && (
                <div className="italic opacity-75">
                  +{configuration.recipients.length - 2} more...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Template Summary */}
        {configuration.template && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Template:</div>
            {configuration.template.subject && (
              <div className="mb-1">
                <span className="font-medium">Subject:</span>
                <div className="truncate">{configuration.template.subject}</div>
              </div>
            )}
            <div>
              <span className="font-medium">Format:</span> {configuration.template.format}
            </div>
            {configuration.template.variables && configuration.template.variables.length > 0 && (
              <div className="mt-1">
                <span className="font-medium">Variables:</span> {configuration.template.variables.length}
              </div>
            )}
          </div>
        )}

        {/* Delivery Options */}
        {configuration.deliveryOptions && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Delivery:</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {configuration.deliveryOptions.retryAttempts && (
                <div>Retries: {configuration.deliveryOptions.retryAttempts}</div>
              )}
              {configuration.deliveryOptions.retryDelay && (
                <div>Delay: {configuration.deliveryOptions.retryDelay}m</div>
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

      {/* Notification Status Indicator */}
      <div className="absolute top-2 right-2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full animate-pulse`}></div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="notification-output"
        className={`w-3 h-3 ${colorClasses.iconBg} border-2 border-white`}
        style={{ right: -6 }}
      />

      {/* Error Output Handle (for delivery failures) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="notification-error"
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

      {/* Delivery Status Visual */}
      <div className="absolute bottom-1 left-1">
        <SpeakerWaveIcon className={`w-4 h-4 ${colorClasses.text} opacity-60`} />
      </div>

      {/* Priority Indicator */}
      {configuration.deliveryOptions?.priority === 'urgent' && (
        <div className="absolute bottom-1 right-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
        </div>
      )}

      {/* Hover Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        {notificationType} notification
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>
    </div>
  );
}