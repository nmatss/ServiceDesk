'use client';

/**
 * SPRINT 2: Node Configurator Component
 * Dynamic configuration forms for each node type with validation
 */

import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import {
  WorkflowNodeType,
  ActionNodeConfig,
  ApprovalNodeConfig,
  ConditionNodeConfig,
  NotificationNodeConfig,
  WebhookNodeConfig,
  ScriptNodeConfig,
  DelayNodeConfig,
  FilterCondition,
} from '@/lib/types/workflow';
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

interface NodeConfiguratorProps {
  node: Node;
  onUpdate: (data: any) => void;
  onClose: () => void;
}

export const NodeConfigurator: React.FC<NodeConfiguratorProps> = ({
  node,
  onUpdate,
  onClose,
}) => {
  const [config, setConfig] = useState(node.data.configuration || {});
  const [label, setLabel] = useState(node.data.label || '');
  const [description, setDescription] = useState(node.data.description || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update parent when config changes
  useEffect(() => {
    onUpdate({
      label,
      description,
      configuration: config,
    });
  }, [config, label, description]);

  const updateConfig = (field: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [field]: value }));
  };

  const renderConfigForm = () => {
    const nodeType = node.type as WorkflowNodeType;

    switch (nodeType) {
      case 'action':
        return <ActionNodeConfigurator config={config} onUpdate={updateConfig} />;
      case 'approval':
        return <ApprovalNodeConfigurator config={config} onUpdate={updateConfig} />;
      case 'condition':
        return <ConditionNodeConfigurator config={config} onUpdate={updateConfig} />;
      case 'notification':
        return <NotificationNodeConfigurator config={config} onUpdate={updateConfig} />;
      case 'webhook':
        return <WebhookNodeConfigurator config={config} onUpdate={updateConfig} />;
      case 'script':
        return <ScriptNodeConfigurator config={config} onUpdate={updateConfig} />;
      case 'delay':
        return <DelayNodeConfigurator config={config} onUpdate={updateConfig} />;
      default:
        return <GenericNodeConfigurator config={config} onUpdate={updateConfig} />;
    }
  };

  return (
    <div className="node-configurator">
      {/* Basic Info */}
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Node Name
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter node name..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter description..."
          />
        </div>
      </div>

      <div className="border-t border-gray-200"></div>

      {/* Node-specific configuration */}
      <div className="p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Configuration</h4>
        {renderConfigForm()}
      </div>
    </div>
  );
};

// Action Node Configurator
const ActionNodeConfigurator: React.FC<{
  config: ActionNodeConfig;
  onUpdate: (field: string, value: any) => void;
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Action Type
        </label>
        <select
          value={config.actionType || 'assign'}
          onChange={(e) => onUpdate('actionType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="assign">Assign Ticket</option>
          <option value="update_status">Update Status</option>
          <option value="add_comment">Add Comment</option>
          <option value="send_notification">Send Notification</option>
          <option value="update_priority">Update Priority</option>
          <option value="add_tag">Add Tag</option>
          <option value="remove_tag">Remove Tag</option>
          <option value="escalate">Escalate</option>
          <option value="close_ticket">Close Ticket</option>
          <option value="create_subtask">Create Subtask</option>
          <option value="custom_script">Custom Script</option>
        </select>
      </div>

      {config.actionType === 'assign' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assign To (User ID or Expression)
          </label>
          <input
            type="text"
            value={config.parameters?.assignee || ''}
            onChange={(e) => onUpdate('parameters', { ...config.parameters, assignee: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="e.g., 123 or ${variables.assignedTo}"
          />
        </div>
      )}

      {config.actionType === 'update_status' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Status
          </label>
          <select
            value={config.parameters?.status || ''}
            onChange={(e) => onUpdate('parameters', { ...config.parameters, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select status...</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      )}

      {config.actionType === 'add_comment' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comment Text
          </label>
          <textarea
            value={config.parameters?.comment || ''}
            onChange={(e) => onUpdate('parameters', { ...config.parameters, comment: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Enter comment text... Use ${variable} for variables"
          />
        </div>
      )}
    </div>
  );
};

// Approval Node Configurator
const ApprovalNodeConfigurator: React.FC<{
  config: ApprovalNodeConfig;
  onUpdate: (field: string, value: any) => void;
}> = ({ config, onUpdate }) => {
  const [approvers, setApprovers] = useState(config.approvers || []);

  const addApprover = () => {
    const newApprovers = [...approvers, { type: 'user' as const, value: '', order: approvers.length + 1 }];
    setApprovers(newApprovers);
    onUpdate('approvers', newApprovers);
  };

  const removeApprover = (index: number) => {
    const newApprovers = approvers.filter((_, i) => i !== index);
    setApprovers(newApprovers);
    onUpdate('approvers', newApprovers);
  };

  const updateApprover = (index: number, field: string, value: any) => {
    const newApprovers = approvers.map((approver, i) =>
      i === index ? { ...approver, [field]: value } : approver
    );
    setApprovers(newApprovers);
    onUpdate('approvers', newApprovers);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Approval Type
        </label>
        <select
          value={config.approvalType || 'single'}
          onChange={(e) => onUpdate('approvalType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="single">Single Approver (any one)</option>
          <option value="multiple">Multiple Approvers (sequential)</option>
          <option value="majority">Majority Vote</option>
          <option value="unanimous">Unanimous (all must approve)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Approvers
        </label>
        <div className="space-y-2">
          {approvers.map((approver, index) => (
            <div key={index} className="flex items-center space-x-2">
              <select
                value={approver.type}
                onChange={(e) => updateApprover(index, 'type', e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="user">User</option>
                <option value="role">Role</option>
                <option value="department">Department</option>
                <option value="dynamic">Dynamic</option>
              </select>
              <input
                type="text"
                value={approver.value}
                onChange={(e) => updateApprover(index, 'value', e.target.value)}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder={approver.type === 'user' ? 'User ID' : approver.type === 'role' ? 'Role name' : 'Value'}
              />
              <button
                onClick={() => removeApprover(index)}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addApprover}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center"
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Approver
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Auto-approve after (hours)
        </label>
        <input
          type="number"
          value={config.autoApproveAfter || 24}
          onChange={(e) => onUpdate('autoApproveAfter', parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          min="1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Automatically approve if no response within this time
        </p>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={config.allowDelegation || false}
          onChange={(e) => onUpdate('allowDelegation', e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded"
        />
        <label className="ml-2 text-sm text-gray-700">
          Allow delegation to other users
        </label>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={config.requireComments || false}
          onChange={(e) => onUpdate('requireComments', e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded"
        />
        <label className="ml-2 text-sm text-gray-700">
          Require comments with approval/rejection
        </label>
      </div>
    </div>
  );
};

// Condition Node Configurator
const ConditionNodeConfigurator: React.FC<{
  config: ConditionNodeConfig;
  onUpdate: (field: string, value: any) => void;
}> = ({ config, onUpdate }) => {
  const [conditions, setConditions] = useState<FilterCondition[]>(config.conditions || []);

  const addCondition = () => {
    const newConditions = [
      ...conditions,
      { field: '', operator: 'equals' as const, value: '', dataType: 'string' as const },
    ];
    setConditions(newConditions);
    onUpdate('conditions', newConditions);
  };

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    setConditions(newConditions);
    onUpdate('conditions', newConditions);
  };

  const updateCondition = (index: number, field: string, value: any) => {
    const newConditions = conditions.map((cond, i) =>
      i === index ? { ...cond, [field]: value } : cond
    );
    setConditions(newConditions);
    onUpdate('conditions', newConditions);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Condition Type
        </label>
        <select
          value={config.conditionType || 'if_else'}
          onChange={(e) => onUpdate('conditionType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="if_else">If/Else</option>
          <option value="switch">Switch/Case</option>
          <option value="expression">Custom Expression</option>
        </select>
      </div>

      {config.conditionType !== 'expression' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logical Operator
            </label>
            <select
              value={config.logicalOperator || 'AND'}
              onChange={(e) => onUpdate('logicalOperator', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="AND">AND (all conditions must match)</option>
              <option value="OR">OR (any condition must match)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conditions
            </label>
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={condition.field}
                      onChange={(e) => updateCondition(index, 'field', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Field name"
                    />
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not Equals</option>
                      <option value="contains">Contains</option>
                      <option value="not_contains">Not Contains</option>
                      <option value="greater_than">Greater Than</option>
                      <option value="less_than">Less Than</option>
                      <option value="in">In List</option>
                      <option value="is_null">Is Null</option>
                      <option value="is_not_null">Is Not Null</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Value"
                    />
                    <button
                      onClick={() => removeCondition(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addCondition}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add Condition
            </button>
          </div>
        </>
      )}

      {config.conditionType === 'expression' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom Expression
          </label>
          <textarea
            value={config.customExpression || ''}
            onChange={(e) => onUpdate('customExpression', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder="e.g., ticket.priority === 'high' && ticket.category === 'urgent'"
          />
        </div>
      )}
    </div>
  );
};

// Notification Node Configurator
const NotificationNodeConfigurator: React.FC<{
  config: NotificationNodeConfig;
  onUpdate: (field: string, value: any) => void;
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notification Type
        </label>
        <select
          value={config.notificationType || 'email'}
          onChange={(e) => onUpdate('notificationType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="slack">Slack</option>
          <option value="teams">Microsoft Teams</option>
          <option value="push">Push Notification</option>
          <option value="in_app">In-App Notification</option>
        </select>
      </div>

      {config.notificationType === 'email' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={config.template?.subject || ''}
              onChange={(e) => onUpdate('template', { ...config.template, subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Email subject..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body
            </label>
            <textarea
              value={config.template?.body || ''}
              onChange={(e) => onUpdate('template', { ...config.template, body: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Email body... Use ${variable} for variables"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Recipients (comma-separated emails or user IDs)
        </label>
        <input
          type="text"
          value={config.recipients?.map(r => r.value).join(', ') || ''}
          onChange={(e) => {
            const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
            const recipients = values.map(value => ({ type: 'email' as const, value }));
            onUpdate('recipients', recipients);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="email@example.com, user@domain.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Priority
        </label>
        <select
          value={config.deliveryOptions?.priority || 'normal'}
          onChange={(e) => onUpdate('deliveryOptions', { ...config.deliveryOptions, priority: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
    </div>
  );
};

// Webhook Node Configurator
const WebhookNodeConfigurator: React.FC<{
  config: WebhookNodeConfig;
  onUpdate: (field: string, value: any) => void;
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL
        </label>
        <input
          type="url"
          value={config.url || ''}
          onChange={(e) => onUpdate('url', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="https://api.example.com/endpoint"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Method
        </label>
        <select
          value={config.method || 'POST'}
          onChange={(e) => onUpdate('method', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Headers (JSON)
        </label>
        <textarea
          value={JSON.stringify(config.headers || {}, null, 2)}
          onChange={(e) => {
            try {
              onUpdate('headers', JSON.parse(e.target.value));
            } catch {}
          }}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
          placeholder='{"Content-Type": "application/json"}'
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payload (JSON)
        </label>
        <textarea
          value={JSON.stringify(config.payload || {}, null, 2)}
          onChange={(e) => {
            try {
              onUpdate('payload', JSON.parse(e.target.value));
            } catch {}
          }}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
          placeholder='{"key": "value"}'
        />
      </div>
    </div>
  );
};

// Script Node Configurator
const ScriptNodeConfigurator: React.FC<{
  config: ScriptNodeConfig;
  onUpdate: (field: string, value: any) => void;
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Script Type
        </label>
        <select
          value={config.scriptType || 'javascript'}
          onChange={(e) => onUpdate('scriptType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="sql">SQL</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Code
        </label>
        <textarea
          value={config.code || ''}
          onChange={(e) => onUpdate('code', e.target.value)}
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
          placeholder="// Enter your code here
// Available: ticket, user, variables
// Return: { success: true, data: {...} }"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Timeout (seconds)
        </label>
        <input
          type="number"
          value={config.timeout || 30}
          onChange={(e) => onUpdate('timeout', parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          min="1"
          max="300"
        />
      </div>
    </div>
  );
};

// Delay Node Configurator
const DelayNodeConfigurator: React.FC<{
  config: DelayNodeConfig;
  onUpdate: (field: string, value: any) => void;
}> = ({ config, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Delay Type
        </label>
        <select
          value={config.delayType || 'fixed'}
          onChange={(e) => onUpdate('delayType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="fixed">Fixed Duration</option>
          <option value="dynamic">Dynamic (from variable)</option>
          <option value="business_hours">Business Hours Only</option>
          <option value="until_date">Until Specific Date</option>
        </select>
      </div>

      {config.delayType === 'fixed' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={config.amount || 5}
              onChange={(e) => onUpdate('amount', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <select
              value={config.unit || 'minutes'}
              onChange={(e) => onUpdate('unit', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
            </select>
          </div>
        </div>
      )}

      {config.delayType === 'dynamic' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dynamic Expression
          </label>
          <input
            type="text"
            value={config.dynamicExpression || ''}
            onChange={(e) => onUpdate('dynamicExpression', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="${variables.delayMinutes}"
          />
        </div>
      )}

      {config.delayType === 'until_date' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Until Date (ISO format or expression)
          </label>
          <input
            type="text"
            value={config.untilDate || ''}
            onChange={(e) => onUpdate('untilDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="2024-12-31T23:59:59Z or ${ticket.dueDate}"
          />
        </div>
      )}

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={config.businessHoursOnly || false}
          onChange={(e) => onUpdate('businessHoursOnly', e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded"
        />
        <label className="ml-2 text-sm text-gray-700">
          Only count business hours (Mon-Fri, 9am-5pm)
        </label>
      </div>
    </div>
  );
};

// Generic Node Configurator
const GenericNodeConfigurator: React.FC<{
  config: any;
  onUpdate: (field: string, value: any) => void;
}> = ({ config, onUpdate }) => {
  const [jsonConfig, setJsonConfig] = useState(JSON.stringify(config, null, 2));
  const [error, setError] = useState('');

  const handleJsonChange = (value: string) => {
    setJsonConfig(value);
    try {
      const parsed = JSON.parse(value);
      Object.keys(parsed).forEach(key => {
        onUpdate(key, parsed[key]);
      });
      setError('');
    } catch (e) {
      setError('Invalid JSON');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Configuration (JSON)
        </label>
        <textarea
          value={jsonConfig}
          onChange={(e) => handleJsonChange(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
          placeholder="{}"
        />
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" />
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">Generic Configuration</p>
            <p>This node type uses generic JSON configuration. Edit the JSON above to configure this node.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeConfigurator;
