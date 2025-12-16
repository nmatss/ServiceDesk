'use client';

/**
 * Error Edge Component
 * Edge for error/failure paths
 */

import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

export default function ErrorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const label = data?.configuration?.label || data?.label || 'Error';

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: '#ef4444',
          strokeWidth: 2,
          strokeDasharray: '8, 4',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div className="flex items-center space-x-1 bg-red-50 border border-red-300 rounded px-2 py-1 text-xs font-medium text-red-700 shadow-sm">
              <ExclamationTriangleIcon className="w-3 h-3" />
              <span>{label}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
