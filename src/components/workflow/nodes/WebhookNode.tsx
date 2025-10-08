'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LinkIcon } from '@heroicons/react/24/solid';

interface WebhookNodeData {
  label: string;
  configuration: any;
  description?: string;
}

export default function WebhookNode({ data, selected }: NodeProps<WebhookNodeData>) {
  return (
    <div className={`relative bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-300 rounded-lg p-4 min-w-[160px] shadow-sm hover:shadow-md transition-all duration-200 ${selected ? 'ring-2 ring-teal-400 ring-opacity-75' : ''}`}>
      <Handle type="target" position={Position.Left} id="webhook-input" className="w-3 h-3 bg-teal-500 border-2 border-white" style={{ left: -6 }} />
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
          <LinkIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-teal-900 truncate">{data.label}</h3>
          <p className="text-xs text-teal-700">Webhook Node</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="webhook-output" className="w-3 h-3 bg-teal-500 border-2 border-white" style={{ right: -6 }} />
    </div>
  );
}