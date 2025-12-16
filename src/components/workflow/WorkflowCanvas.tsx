'use client';

/**
 * Workflow Canvas Component
 * Main visual workflow editor canvas with React Flow
 */

import React, { useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  Connection,
  ReactFlowInstance,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onPaneClick?: () => void;
  onDrop?: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onInit?: (instance: ReactFlowInstance) => void;
  nodeTypes: any;
  edgeTypes: any;
  readOnly?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onDrop,
  onDragOver,
  onInit,
  nodeTypes,
  edgeTypes,
  readOnly = false,
  className = '',
  children,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const defaultEdgeOptions = {
    type: 'default',
    animated: false,
    style: { strokeWidth: 2 },
  };

  const proOptions = {
    hideAttribution: true,
  };

  return (
    <div
      ref={reactFlowWrapper}
      className={`workflow-canvas h-full w-full ${className}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? () => {} : onNodesChange}
        onEdgesChange={readOnly ? () => {} : onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={proOptions}
        fitView
        attributionPosition="bottom-left"
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        selectionKeyCode={readOnly ? null : 'Shift'}
        multiSelectionKeyCode={readOnly ? null : 'Control'}
        panOnScroll
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
      >
        <Controls
          position="bottom-left"
          showZoom={true}
          showFitView={true}
          showInteractive={!readOnly}
        />

        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#e2e8f0"
        />

        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'start':
                return '#10b981';
              case 'end':
                return '#ef4444';
              case 'condition':
                return '#f59e0b';
              case 'approval':
                return '#8b5cf6';
              case 'action':
                return '#3b82f6';
              case 'delay':
                return '#6b7280';
              case 'notification':
                return '#f97316';
              case 'webhook':
                return '#06b6d4';
              case 'script':
                return '#64748b';
              case 'ml_prediction':
                return '#d946ef';
              case 'human_task':
                return '#ec4899';
              case 'loop':
                return '#a855f7';
              case 'subworkflow':
                return '#10b981';
              case 'parallel':
                return '#6366f1';
              case 'integration':
                return '#14b8a6';
              default:
                return '#6b7280';
            }
          }}
          nodeStrokeWidth={2}
          position="bottom-right"
          className="workflow-minimap"
          maskColor="rgba(0, 0, 0, 0.1)"
        />

        {children}
      </ReactFlow>
    </div>
  );
}
