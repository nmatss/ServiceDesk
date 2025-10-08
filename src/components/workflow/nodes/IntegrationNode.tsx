'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CubeTransparentIcon } from '@heroicons/react/24/solid';

interface IntegrationNodeData {
  label: string;
  configuration: any;
  description?: string;
}

export default function IntegrationNode({ data, selected }: NodeProps<IntegrationNodeData>) {
  return (
    <div className={`relative bg-gradient-to-br from-lime-50 to-lime-100 border-2 border-lime-300 rounded-lg p-4 min-w-[160px] shadow-sm hover:shadow-md transition-all duration-200 ${selected ? 'ring-2 ring-lime-400 ring-opacity-75' : ''}`}>
      <Handle type="target" position={Position.Left} id="integration-input" className="w-3 h-3 bg-lime-500 border-2 border-white" style={{ left: -6 }} />
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-8 h-8 bg-lime-500 rounded-full flex items-center justify-center">
          <CubeTransparentIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-lime-900 truncate">{data.label}</h3>
          <p className="text-xs text-lime-700">Integration</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="integration-output" className="w-3 h-3 bg-lime-500 border-2 border-white" style={{ right: -6 }} />
    </div>
  );
}