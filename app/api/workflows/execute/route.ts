/**
 * SPRINT 2: Workflow Execution API
 * Execute workflows with validation, error handling, and progress tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { WorkflowEngine } from '@/lib/workflow/engine';
import { logger } from '@/lib/monitoring/logger';
import {
  WorkflowDefinition,
  WorkflowExecution,
  ExecutionStatus,
} from '@/lib/types/workflow';
import { z } from 'zod';

// Request validation schema
const ExecuteWorkflowSchema = z.object({
  workflowId: z.number().optional(),
  workflow: z.object({
    id: z.number().optional(),
    name: z.string(),
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    triggerType: z.string().optional(),
    triggerConditions: z.any().optional(),
  }).optional(),
  triggerData: z.record(z.string(), z.any()),
  entityType: z.string().optional(),
  entityId: z.number().optional(),
  userId: z.number().optional(),
  async: z.boolean().optional().default(true),
});

/**
 * POST /api/workflows/execute
 * Execute a workflow with given trigger data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validationResult = ExecuteWorkflowSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { workflowId, workflow, triggerData, entityType, entityId, userId, async } =
      validationResult.data;

    // Validate that either workflowId or workflow is provided
    if (!workflowId && !workflow) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either workflowId or workflow definition must be provided',
        },
        { status: 400 }
      );
    }

    // Get workflow definition
    let workflowDefinition: WorkflowDefinition | null = null;

    if (workflowId) {
      // Load from database
      workflowDefinition = await getWorkflowById(workflowId);
      if (!workflowDefinition) {
        return NextResponse.json(
          {
            success: false,
            error: `Workflow ${workflowId} not found`,
          },
          { status: 404 }
        );
      }
    } else if (workflow) {
      // Use provided workflow (for testing)
      workflowDefinition = workflow as WorkflowDefinition;
    }

    if (!workflowDefinition) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow definition not available',
        },
        { status: 400 }
      );
    }

    // Validate workflow structure
    const validationErrors = validateWorkflow(workflowDefinition);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow validation failed',
          validationErrors,
        },
        { status: 400 }
      );
    }

    // Initialize workflow engine
    const engine = await initializeWorkflowEngine();

    // Execute workflow
    if (async) {
      // Async execution - return immediately with execution ID
      const execution = await engine.executeWorkflow(
        workflowDefinition.id || 0,
        triggerData,
        userId,
        {
          entityType,
          entityId,
          environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
        }
      );

      return NextResponse.json({
        success: true,
        executionId: execution.id,
        status: execution.status,
        message: 'Workflow execution started',
      });
    } else {
      // Sync execution - wait for completion
      const execution = await engine.executeWorkflow(
        workflowDefinition.id || 0,
        triggerData,
        userId,
        {
          entityType,
          entityId,
          environment: process.env.NODE_ENV as 'development' | 'staging' | 'production',
        }
      );

      // Wait for completion (with timeout)
      const result = await waitForExecution(engine, execution.id, 300000); // 5 min timeout

      return NextResponse.json({
        success: result.status === 'completed',
        executionId: execution.id,
        status: result.status,
        progress: result.progress,
        output: result.variables,
        error: result.error,
        logs: result.logs,
      });
    }
  } catch (error: any) {
    logger.error('Workflow execution error', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Workflow execution failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workflows/execute?executionId=123
 * Get execution status and progress
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');

    if (!executionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'executionId parameter is required',
        },
        { status: 400 }
      );
    }

    const engine = await initializeWorkflowEngine();
    const status = await engine.getExecutionStatus(parseInt(executionId));

    return NextResponse.json({
      success: true,
      execution: {
        executionId: parseInt(executionId),
        status: status.status,
        progress: status.progress,
        currentStep: status.currentStep,
        variables: status.variables,
        logs: status.logs,
        error: status.error,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching execution status', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch execution status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/execute?executionId=123
 * Cancel a running execution
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');
    const reason = searchParams.get('reason') || 'User cancelled';

    if (!executionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'executionId parameter is required',
        },
        { status: 400 }
      );
    }

    const engine = await initializeWorkflowEngine();
    await engine.cancelExecution(parseInt(executionId), reason);

    return NextResponse.json({
      success: true,
      message: 'Execution cancelled successfully',
    });
  } catch (error: any) {
    logger.error('Error cancelling execution', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel execution',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// Helper functions

import { getWorkflowById as dbGetWorkflowById } from '@/lib/db/queries';
import { WorkflowPersistenceAdapter } from '@/lib/workflow/persistence-adapter';
import { WorkflowQueueManager } from '@/lib/workflow/queue-manager';
import { WorkflowMetricsCollector } from '@/lib/workflow/metrics-collector';

async function getWorkflowById(workflowId: number): Promise<WorkflowDefinition | null> {
  try {
    return dbGetWorkflowById(workflowId);
  } catch (error) {
    logger.error('Error fetching workflow from database', error);
    throw error;
  }
}

// Singleton instances for workflow infrastructure
let persistenceAdapter: WorkflowPersistenceAdapter | null = null;
let queueManager: WorkflowQueueManager | null = null;
let metricsCollector: WorkflowMetricsCollector | null = null;

async function initializeWorkflowEngine(): Promise<WorkflowEngine> {
  // Initialize singleton instances if not already created
  if (!persistenceAdapter) {
    persistenceAdapter = new WorkflowPersistenceAdapter();
    logger.info('WorkflowPersistenceAdapter initialized');
  }

  if (!queueManager) {
    queueManager = new WorkflowQueueManager();
    logger.info('WorkflowQueueManager initialized');
  }

  if (!metricsCollector) {
    metricsCollector = new WorkflowMetricsCollector();
    logger.info('WorkflowMetricsCollector initialized');
  }

  return new WorkflowEngine(
    persistenceAdapter,
    queueManager,
    metricsCollector
  );
}

function validateWorkflow(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];

  // Check for start node
  const startNodes = workflow.nodes.filter((n) => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Workflow must have at least one Start node');
  } else if (startNodes.length > 1) {
    errors.push('Workflow can only have one Start node');
  }

  // Check for end node
  const endNodes = workflow.nodes.filter((n) => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('Workflow must have at least one End node');
  }

  // Check for disconnected nodes
  workflow.nodes.forEach((node) => {
    if (node.type === 'start') {
      const outgoing = workflow.edges.filter((e) => e.source === node.id);
      if (outgoing.length === 0) {
        errors.push(`Start node has no outgoing connections`);
      }
    } else if (node.type === 'end') {
      const incoming = workflow.edges.filter((e) => e.target === node.id);
      if (incoming.length === 0) {
        errors.push(`End node "${node.name}" has no incoming connections`);
      }
    } else {
      const incoming = workflow.edges.filter((e) => e.target === node.id);
      const outgoing = workflow.edges.filter((e) => e.source === node.id);
      if (incoming.length === 0 && outgoing.length === 0) {
        errors.push(`Node "${node.name}" is disconnected`);
      }
    }
  });

  // Check for cycles (simplified check)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoingEdges = workflow.edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.target)) {
        if (hasCycle(edge.target)) return true;
      } else if (recursionStack.has(edge.target)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  const startNode = startNodes[0];
  if (startNode && hasCycle(startNode.id)) {
    errors.push('Workflow contains cycles (infinite loops)');
  }

  return errors;
}

async function waitForExecution(
  engine: WorkflowEngine,
  executionId: number,
  timeoutMs: number
): Promise<{
  status: ExecutionStatus;
  progress: number;
  variables: Record<string, any>;
  error?: string;
  logs: any[];
}> {
  const startTime = Date.now();
  const pollInterval = 1000; // Poll every second

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await engine.getExecutionStatus(executionId);

        // Check if execution is complete
        if (
          status.status === 'completed' ||
          status.status === 'failed' ||
          status.status === 'cancelled'
        ) {
          resolve({
            status: status.status,
            progress: status.progress,
            variables: status.variables,
            error: status.error,
            logs: status.logs,
          });
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          resolve({
            status: 'timeout' as ExecutionStatus,
            progress: status.progress,
            variables: status.variables,
            error: 'Execution timed out',
            logs: status.logs,
          });
          return;
        }

        // Continue polling
        setTimeout(poll, pollInterval);
      } catch (error: any) {
        reject(error);
      }
    };

    poll();
  });
}
