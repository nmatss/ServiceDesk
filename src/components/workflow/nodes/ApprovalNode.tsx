'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  CheckBadgeIcon,
  UserGroupIcon,
  UserIcon,
  ClockIcon,
  ArrowUpIcon,
} from '@heroicons/react/24/solid';
import { ApprovalNodeConfig } from '@/lib/types/workflow';

interface ApprovalNodeData {
  label: string;
  configuration: ApprovalNodeConfig;
  description?: string;
  timeout?: number;
  isOptional?: boolean;
}

const approvalTypeIcons = {
  single: UserIcon,
  multiple: UserGroupIcon,
  majority: UserGroupIcon,
  unanimous: UserGroupIcon,
};

export default function ApprovalNode({ data, selected }: NodeProps<ApprovalNodeData>) {
  const { label, configuration, description, timeout, isOptional } = data;
  const approvalType = configuration.approvalType;
  const IconComponent = approvalTypeIcons[approvalType] || CheckBadgeIcon;

  const colorClasses = {
    bg: 'from-purple-50 to-purple-100',
    border: 'border-purple-300',
    iconBg: 'bg-purple-500',
    text: 'text-purple-900',
    subtext: 'text-purple-700',
    ring: 'ring-purple-400',
    badge: 'bg-purple-100 text-purple-800',
  };

  return (
    <div
      className={`
        relative bg-gradient-to-br ${colorClasses.bg}
        border-2 ${colorClasses.border} rounded-lg p-4 min-w-[160px] max-w-[240px]
        shadow-sm hover:shadow-md transition-all duration-200
        ${selected ? `ring-2 ${colorClasses.ring} ring-opacity-75` : ''}
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="approval-input"
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
            Approval Node
          </p>
        </div>
      </div>

      {/* Approval Type Badge */}
      <div className="mb-2 flex items-center space-x-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClasses.badge}`}>
          {approvalType.replace(/_/g, ' ').toUpperCase()}
        </span>
        {configuration.requireComments && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            COMMENTS REQ.
          </span>
        )}
      </div>

      {/* Node Body */}
      <div className="space-y-2">
        {/* Approvers Summary */}
        {configuration.approvers && configuration.approvers.length > 0 && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">
              Approvers ({configuration.approvers.length}):
            </div>
            <div className="space-y-1">
              {configuration.approvers.slice(0, 3).map((approver, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="flex-shrink-0">
                    {approver.type === 'user' ? (
                      <UserIcon className="w-3 h-3" />
                    ) : approver.type === 'role' ? (
                      <UserGroupIcon className="w-3 h-3" />
                    ) : (
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                    )}
                  </div>
                  <span className="truncate">
                    {approver.type}: {approver.value}
                    {approver.isOptional && (
                      <span className="text-xs opacity-75"> (optional)</span>
                    )}
                  </span>
                </div>
              ))}
              {configuration.approvers.length > 3 && (
                <div className="italic opacity-75">
                  +{configuration.approvers.length - 3} more...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Auto-approve and Delegation */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {configuration.autoApproveAfter && (
            <div className={`${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
              <div className="flex items-center space-x-1 mb-1">
                <ClockIcon className="w-3 h-3" />
                <span className="font-medium">Auto-approve:</span>
              </div>
              <span>{configuration.autoApproveAfter}h</span>
            </div>
          )}

          {configuration.allowDelegation && (
            <div className={`${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
              <div className="flex items-center space-x-1 mb-1">
                <ArrowUpIcon className="w-3 h-3" />
                <span className="font-medium">Delegation:</span>
              </div>
              <span>Allowed</span>
            </div>
          )}
        </div>

        {/* Escalation Config */}
        {configuration.escalationConfig && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Escalation:</div>
            <div className="space-y-1">
              {configuration.escalationConfig.levels.slice(0, 2).map((level, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span>Level {index + 1}:</span>
                  <span>{level.timeoutHours}h</span>
                </div>
              ))}
              {configuration.escalationConfig.levels.length > 2 && (
                <div className="italic opacity-75">
                  +{configuration.escalationConfig.levels.length - 2} more levels...
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

        {/* Custom Approval Form */}
        {configuration.customApprovalForm && (
          <div className={`text-xs ${colorClasses.subtext} bg-white bg-opacity-50 p-2 rounded border border-opacity-30`}>
            <div className="font-medium mb-1">Custom Form:</div>
            <span className="italic">
              {Object.keys(configuration.customApprovalForm).length} fields configured
            </span>
          </div>
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

      {/* Waiting Indicator */}
      <div className="absolute top-2 right-2">
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
      </div>

      {/* Output Handles */}
      {/* Approved Path */}
      <Handle
        type="source"
        position={Position.Right}
        id="approval-approved"
        className="w-3 h-3 bg-green-500 border-2 border-white"
        style={{ right: -6, top: '35%' }}
      />

      {/* Rejected Path */}
      <Handle
        type="source"
        position={Position.Right}
        id="approval-rejected"
        className="w-3 h-3 bg-red-500 border-2 border-white"
        style={{ right: -6, top: '65%' }}
      />

      {/* Timeout/Escalation Path */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="approval-timeout"
        className="w-3 h-3 bg-orange-500 border-2 border-white"
        style={{ bottom: -6 }}
      />

      {/* Connection Points Visual Indicators */}
      <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
        <div className={`w-2 h-2 ${colorClasses.iconBg} rounded-full opacity-50`}></div>
      </div>

      {/* Approved/Rejected Path Indicators */}
      <div className="absolute right-0 top-1/3 transform translate-x-1 -translate-y-1/2">
        <div className="w-2 h-2 bg-green-400 rounded-full opacity-50"></div>
      </div>
      <div className="absolute right-0 top-2/3 transform translate-x-1 -translate-y-1/2">
        <div className="w-2 h-2 bg-red-400 rounded-full opacity-50"></div>
      </div>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1">
        <div className="w-2 h-2 bg-orange-400 rounded-full opacity-50"></div>
      </div>

      {/* Output Labels */}
      <div className="absolute -right-8 top-1/3 transform -translate-y-1/2">
        <span className="text-xs font-medium text-green-600 bg-white px-1 rounded shadow-sm">
          APPROVED
        </span>
      </div>
      <div className="absolute -right-8 top-2/3 transform -translate-y-1/2">
        <span className="text-xs font-medium text-red-600 bg-white px-1 rounded shadow-sm">
          REJECTED
        </span>
      </div>
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
        <span className="text-xs font-medium text-orange-600 bg-white px-1 rounded shadow-sm">
          TIMEOUT
        </span>
      </div>

      {/* Approval Progress Indicator */}
      {configuration.approvalType !== 'single' && configuration.approvers && (
        <div className="absolute top-1 left-1">
          <div className="bg-white bg-opacity-75 rounded-full px-1 py-0.5">
            <span className="text-xs font-medium text-purple-800">
              0/{configuration.approvers.length}
            </span>
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      <div className="absolute z-10 invisible group-hover:visible bg-black text-white text-xs rounded py-1 px-2 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        {approvalType} approval required
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
      </div>
    </div>
  );
}