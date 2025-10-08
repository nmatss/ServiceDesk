'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  EdgeChange,
  NodeChange,
  ReactFlowProvider,
  ReactFlowInstance,
  Panel,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { WorkflowDefinition, WorkflowNode, WorkflowEdge, WorkflowNodeType } from '@/lib/types/workflow';
import StartNode from './nodes/StartNode';
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import ApprovalNode from './nodes/ApprovalNode';
import EndNode from './nodes/EndNode';
import DelayNode from './nodes/DelayNode';
import NotificationNode from './nodes/NotificationNode';
import WebhookNode from './nodes/WebhookNode';
import ScriptNode from './nodes/ScriptNode';
import MLPredictionNode from './nodes/MLPredictionNode';
import HumanTaskNode from './nodes/HumanTaskNode';
import LoopNode from './nodes/LoopNode';
import SubworkflowNode from './nodes/SubworkflowNode';
import ParallelNode from './nodes/ParallelNode';
import IntegrationNode from './nodes/IntegrationNode';
import ConditionalEdge from './edges/ConditionalEdge';
import DefaultEdge from './edges/DefaultEdge';
import ErrorEdge from './edges/ErrorEdge';
import WorkflowToolbar from './WorkflowToolbar';
import WorkflowSidebar from './WorkflowSidebar';
import WorkflowProperties from './WorkflowProperties';
import WorkflowValidation from './WorkflowValidation';
import WorkflowMinimap from './WorkflowMinimap';

interface WorkflowBuilderProps {
  workflow?: WorkflowDefinition;
  onSave?: (workflow: WorkflowDefinition) => void;
  onTest?: (workflow: WorkflowDefinition) => void;
  onDeploy?: (workflow: WorkflowDefinition) => void;
  readOnly?: boolean;
  className?: string;
}

const nodeTypes = {
  start: StartNode,
  action: ActionNode,
  condition: ConditionNode,
  approval: ApprovalNode,
  end: EndNode,
  delay: DelayNode,
  notification: NotificationNode,
  webhook: WebhookNode,
  script: ScriptNode,
  ml_prediction: MLPredictionNode,
  human_task: HumanTaskNode,
  loop: LoopNode,
  subworkflow: SubworkflowNode,
  parallel: ParallelNode,
  integration: IntegrationNode,
};

const edgeTypes = {
  default: DefaultEdge,
  conditional: ConditionalEdge,
  error: ErrorEdge,
};

export default function WorkflowBuilder({
  workflow,
  onSave,
  onTest,
  onDeploy,
  readOnly = false,
  className = '',
}: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [workflowData, setWorkflowData] = useState<Partial<WorkflowDefinition>>(
    workflow || {
      name: 'New Workflow',
      description: '',
      version: 1,
      isActive: true,
      isTemplate: false,
      category: 'ticket_automation',
      priority: 0,
      triggerType: 'manual',
      triggerConditions: { filters: [] },
      nodes: [],
      edges: [],
      variables: [],
      metadata: {
        tags: [],
        documentation: '',
        version: '1.0',
        author: '',
        lastModifiedBy: '',
        changeLog: [],
        dependencies: [],
        testCases: [],
        performance: {
          avgExecutionTime: 0,
          maxExecutionTime: 0,
          minExecutionTime: 0,
          successRate: 0,
          errorRate: 0,
          resourceUsage: {
            memoryMB: 0,
            cpuPercent: 0,
            networkKB: 0,
            storageKB: 0,
          },
        },
      },
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      createdBy: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Load workflow data
  useEffect(() => {
    if (workflow) {
      setWorkflowData(workflow);

      // Convert workflow nodes to React Flow nodes
      const flowNodes = workflow.nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          label: node.name,
          configuration: node.configuration,
          description: node.description,
          timeout: node.timeout,
          retryConfig: node.retryConfig,
          isOptional: node.isOptional,
          metadata: node.metadata,
        },
        deletable: !readOnly,
        draggable: !readOnly,
      }));

      // Convert workflow edges to React Flow edges
      const flowEdges = workflow.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        data: {
          configuration: edge.configuration,
          conditions: edge.conditions,
          priority: edge.priority,
          metadata: edge.metadata,
        },
        deletable: !readOnly,
        updatable: !readOnly,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [workflow, setNodes, setEdges, readOnly]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (readOnly) return;

      const newEdge = {
        ...params,
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'default',
        data: {
          configuration: {
            label: '',
            color: '#b1b1b7',
            animated: false,
          },
          conditions: [],
          priority: 0,
          metadata: {},
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, readOnly]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (readOnly) return;
    setSelectedNode(node);
    setSelectedEdge(null);
    setPropertiesOpen(true);
  }, [readOnly]);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    if (readOnly) return;
    setSelectedEdge(edge);
    setSelectedNode(null);
    setPropertiesOpen(true);
  }, [readOnly]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setPropertiesOpen(false);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (readOnly) return;

      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type || !reactFlowBounds || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const nodeId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newNode = {
        id: nodeId,
        type: type as WorkflowNodeType,
        position,
        data: {
          label: getDefaultNodeLabel(type as WorkflowNodeType),
          configuration: getDefaultNodeConfiguration(type as WorkflowNodeType),
          description: '',
          timeout: 300000, // 5 minutes default
          retryConfig: {
            maxAttempts: 3,
            backoffStrategy: 'exponential' as const,
            initialDelay: 1000,
            maxDelay: 30000,
            retryConditions: [],
          },
          isOptional: false,
          metadata: {},
        },
        deletable: true,
        draggable: true,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, readOnly]
  );

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<Node>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node
      )
    );
  }, [setNodes]);

  const handleEdgeUpdate = useCallback((edgeId: string, updates: Partial<Edge>) => {
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === edgeId ? { ...edge, ...updates } : edge
      )
    );
  }, [setEdges]);

  const handleWorkflowSave = useCallback(() => {
    if (!onSave) return;

    // Convert React Flow data back to workflow format
    const workflowNodes: WorkflowNode[] = nodes.map(node => ({
      id: node.id,
      type: node.type as WorkflowNodeType,
      name: node.data.label,
      description: node.data.description,
      position: node.position,
      configuration: node.data.configuration,
      timeout: node.data.timeout,
      retryConfig: node.data.retryConfig,
      isOptional: node.data.isOptional,
      metadata: node.data.metadata,
    }));

    const workflowEdges: WorkflowEdge[] = edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type as any,
      configuration: edge.data?.configuration || {},
      conditions: edge.data?.conditions || [],
      priority: edge.data?.priority || 0,
      metadata: edge.data?.metadata || {},
    }));

    const updatedWorkflow: WorkflowDefinition = {
      ...workflowData as WorkflowDefinition,
      nodes: workflowNodes,
      edges: workflowEdges,
      updatedAt: new Date(),
    };

    onSave(updatedWorkflow);
  }, [nodes, edges, workflowData, onSave]);

  const handleWorkflowTest = useCallback(() => {
    if (!onTest) return;

    const testWorkflow: WorkflowDefinition = {
      ...workflowData as WorkflowDefinition,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type as WorkflowNodeType,
        name: node.data.label,
        description: node.data.description,
        position: node.position,
        configuration: node.data.configuration,
        timeout: node.data.timeout,
        retryConfig: node.data.retryConfig,
        isOptional: node.data.isOptional,
        metadata: node.data.metadata,
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type as any,
        configuration: edge.data?.configuration || {},
        conditions: edge.data?.conditions || [],
        priority: edge.data?.priority || 0,
        metadata: edge.data?.metadata || {},
      })),
    };

    onTest(testWorkflow);
  }, [nodes, edges, workflowData, onTest]);

  const handleWorkflowDeploy = useCallback(() => {
    if (!onDeploy) return;

    const deployWorkflow: WorkflowDefinition = {
      ...workflowData as WorkflowDefinition,
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type as WorkflowNodeType,
        name: node.data.label,
        description: node.data.description,
        position: node.position,
        configuration: node.data.configuration,
        timeout: node.data.timeout,
        retryConfig: node.data.retryConfig,
        isOptional: node.data.isOptional,
        metadata: node.data.metadata,
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type as any,
        configuration: edge.data?.configuration || {},
        conditions: edge.data?.conditions || [],
        priority: edge.data?.priority || 0,
        metadata: edge.data?.metadata || {},
      })),
      isActive: true,
      updatedAt: new Date(),
    };

    onDeploy(deployWorkflow);
  }, [nodes, edges, workflowData, onDeploy]);

  const handleValidateWorkflow = useCallback(() => {
    setValidationOpen(true);
  }, []);

  const proOptions = {
    hideAttribution: true,
  };

  return (
    <div className={`workflow-builder h-full flex ${className}`}>
      <ReactFlowProvider>
        {/* Sidebar */}
        {sidebarOpen && (
          <WorkflowSidebar
            onClose={() => setSidebarOpen(false)}
            readOnly={readOnly}
          />
        )}

        {/* Main Canvas */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <WorkflowToolbar
            workflow={workflowData}
            onSave={handleWorkflowSave}
            onTest={handleWorkflowTest}
            onDeploy={handleWorkflowDeploy}
            onValidate={handleValidateWorkflow}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleProperties={() => setPropertiesOpen(!propertiesOpen)}
            readOnly={readOnly}
            hasChanges={nodes.length > 0 || edges.length > 0}
          />

          {/* React Flow Canvas */}
          <div className="flex-1 relative" ref={reactFlowWrapper}>
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
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              proOptions={proOptions}
              fitView
              attributionPosition="bottom-left"
              className="workflow-canvas"
            >
              <Controls
                position="bottom-left"
                showZoom={true}
                showFitView={true}
                showInteractive={!readOnly}
              />

              <Background
                variant="dots"
                gap={20}
                size={1}
                color="#e2e8f0"
              />

              <MiniMap
                nodeColor={(node) => {
                  switch (node.type) {
                    case 'start': return '#10b981';
                    case 'end': return '#ef4444';
                    case 'condition': return '#f59e0b';
                    case 'approval': return '#8b5cf6';
                    case 'action': return '#3b82f6';
                    default: return '#6b7280';
                  }
                }}
                nodeStrokeWidth={2}
                position="bottom-right"
                className="workflow-minimap"
              />

              {/* Canvas Panels */}
              <Panel position="top-center" className="workflow-info-panel">
                <div className="bg-white shadow-sm border rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900">{workflowData.name}</span>
                  {workflowData.description && (
                    <span className="text-gray-500 ml-2">• {workflowData.description}</span>
                  )}
                </div>
              </Panel>

              {/* Node/Edge Count Panel */}
              <Panel position="top-right" className="workflow-stats-panel">
                <div className="bg-white shadow-sm border rounded-lg px-3 py-2 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nodes:</span>
                    <span className="font-medium">{nodes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Edges:</span>
                    <span className="font-medium">{edges.length}</span>
                  </div>
                </div>
              </Panel>
            </ReactFlow>
          </div>
        </div>

        {/* Properties Panel */}
        {propertiesOpen && (
          <WorkflowProperties
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            workflow={workflowData}
            onNodeUpdate={handleNodeUpdate}
            onEdgeUpdate={handleEdgeUpdate}
            onWorkflowUpdate={setWorkflowData}
            onClose={() => setPropertiesOpen(false)}
            readOnly={readOnly}
          />
        )}

        {/* Validation Panel */}
        {validationOpen && (
          <WorkflowValidation
            workflow={{
              ...workflowData as WorkflowDefinition,
              nodes: nodes.map(node => ({
                id: node.id,
                type: node.type as WorkflowNodeType,
                name: node.data.label,
                description: node.data.description,
                position: node.position,
                configuration: node.data.configuration,
                timeout: node.data.timeout,
                retryConfig: node.data.retryConfig,
                isOptional: node.data.isOptional,
                metadata: node.data.metadata,
              })),
              edges: edges.map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                type: edge.type as any,
                configuration: edge.data?.configuration || {},
                conditions: edge.data?.conditions || [],
                priority: edge.data?.priority || 0,
                metadata: edge.data?.metadata || {},
              })),
            }}
            onClose={() => setValidationOpen(false)}
          />
        )}
      </ReactFlowProvider>
    </div>
  );
}

// Helper functions
function getDefaultNodeLabel(type: WorkflowNodeType): string {
  switch (type) {
    case 'start': return 'Start';
    case 'end': return 'End';
    case 'action': return 'Action';
    case 'condition': return 'Condition';
    case 'approval': return 'Approval';
    case 'delay': return 'Delay';
    case 'notification': return 'Notification';
    case 'webhook': return 'Webhook';
    case 'script': return 'Script';
    case 'ml_prediction': return 'ML Prediction';
    case 'human_task': return 'Human Task';
    case 'loop': return 'Loop';
    case 'subworkflow': return 'Subworkflow';
    case 'parallel': return 'Parallel';
    case 'integration': return 'Integration';
    default: return 'Node';
  }
}

function getDefaultNodeConfiguration(type: WorkflowNodeType): any {
  switch (type) {
    case 'start':
      return {
        triggerType: 'manual',
        conditions: { filters: [] },
        inputSchema: {},
      };
    case 'end':
      return {
        endType: 'success',
        outputData: {},
        cleanupActions: [],
        notifications: [],
      };
    case 'action':
      return {
        actionType: 'assign',
        parameters: {},
        outputMapping: {},
      };
    case 'condition':
      return {
        conditionType: 'if_else',
        conditions: [],
        logicalOperator: 'AND',
        outputPaths: [],
      };
    case 'approval':
      return {
        approvalType: 'single',
        approvers: [],
        autoApproveAfter: 24,
        allowDelegation: true,
        requireComments: false,
      };
    case 'delay':
      return {
        delayType: 'fixed',
        amount: 5,
        unit: 'minutes',
        businessHoursOnly: false,
      };
    case 'notification':
      return {
        notificationType: 'email',
        recipients: [],
        template: {
          subject: '',
          body: '',
          format: 'html',
          variables: [],
        },
        deliveryOptions: {
          priority: 'normal',
          retryAttempts: 3,
          retryDelay: 5,
        },
      };
    case 'webhook':
      return {
        url: '',
        method: 'POST',
        headers: {},
        payload: {},
        expectedResponseCodes: [200, 201],
      };
    case 'script':
      return {
        scriptType: 'javascript',
        code: '// Enter your script here\nreturn { success: true };',
        environment: 'sandbox',
        inputVariables: [],
        outputVariables: [],
        timeout: 30,
      };
    default:
      return {};
  }
}