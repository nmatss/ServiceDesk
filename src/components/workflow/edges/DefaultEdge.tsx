'use client';

/**
 * Default Edge Component
 * Standard workflow edge with label
 */

import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

export default function DefaultEdge({
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

  const label = data?.configuration?.label || data?.label;

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: data?.configuration?.color || '#b1b1b7',
          strokeWidth: 2,
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
            <div className="bg-white border border-gray-300 rounded px-2 py-1 text-xs font-medium text-gray-700 shadow-sm">
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
