'use client';

/**
 * Conditional Edge Component
 * Edge for condition branches with different styling
 */

import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

export default function ConditionalEdge({
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

  const label = data?.configuration?.label || data?.label || 'Condition';
  const isTrue = label.toLowerCase().includes('true') || label.toLowerCase().includes('yes');
  const isFalse = label.toLowerCase().includes('false') || label.toLowerCase().includes('no');

  let edgeColor = data?.configuration?.color || '#f59e0b';
  if (isTrue) edgeColor = '#10b981';
  if (isFalse) edgeColor = '#ef4444';

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: 2,
          strokeDasharray: '5, 5',
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
            <div
              className="border rounded px-2 py-1 text-xs font-medium shadow-sm"
              style={{
                backgroundColor: isTrue ? '#d1fae5' : isFalse ? '#fee2e2' : '#fef3c7',
                borderColor: edgeColor,
                color: isTrue ? '#065f46' : isFalse ? '#991b1b' : '#92400e',
              }}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
