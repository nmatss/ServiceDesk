/**
 * Individual Workflow Definition API
 * CRUD operations for specific workflow definitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getConnection } from '@/lib/db/connection';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/workflows/definitions/[id]
 * Get a specific workflow definition
 */
export async function GET(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WORKFLOW_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workflowId = parseInt(params.id);
    if (isNaN(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }

    const db = getConnection();

    // Get workflow with full definition
    const workflow = db.prepare(`
      SELECT
        w.*,
        wd.steps_json,
        u.name as created_by_name,
        u2.name as updated_by_name
      FROM workflows w
      LEFT JOIN workflow_definitions wd ON w.id = wd.id
      LEFT JOIN users u ON w.created_by = u.id
      LEFT JOIN users u2 ON w.updated_by = u2.id
      WHERE w.id = ?
    `).get(workflowId);

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get workflow steps
    const steps = db.prepare(`
      SELECT
        id,
        step_order,
        step_type,
        name,
        description,
        configuration,
        timeout_minutes,
        retry_count,
        retry_delay_minutes,
        is_optional,
        parent_step_id,
        created_at,
        updated_at
      FROM workflow_steps
      WHERE workflow_id = ?
      ORDER BY step_order
    `).all(workflowId);

    // Get workflow executions summary
    const executionStats = db.prepare(`
      SELECT
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_executions,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_executions,
        AVG(CASE WHEN completed_at IS NOT NULL
            THEN (julianday(completed_at) - julianday(started_at)) * 24 * 60 * 60 * 1000
            ELSE NULL END) as avg_execution_time_ms,
        MAX(started_at) as last_execution_at
      FROM workflow_executions
      WHERE workflow_id = ?
    `).get(workflowId);

    const parsedWorkflow = {
      ...(workflow as Record<string, unknown>),
      trigger_conditions: JSON.parse((workflow as any).trigger_conditions || '{}'),
      steps_json: JSON.parse((workflow as any).steps_json || '{}'),
      steps: steps.map((step: any) => ({
        ...step,
        configuration: JSON.parse(step.configuration || '{}')
      })),
      stats: executionStats
    };

    return NextResponse.json({ workflow: parsedWorkflow });

  } catch (error) {
    logger.error('Error fetching workflow', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workflows/definitions/[id]
 * Update a workflow definition
 */
export async function PUT(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WORKFLOW_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!['admin', 'agent'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workflowId = parseInt(params.id);
    if (isNaN(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }

    const body = await request.json();
    const db = getConnection();

    // Check if workflow exists
    const existingWorkflow = db.prepare('SELECT id, created_by FROM workflows WHERE id = ?').get(workflowId);
    if (!existingWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Check ownership or admin rights
    if (authResult.user.role !== 'admin' && (existingWorkflow as any).created_by !== authResult.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Start transaction
    const updateWorkflow = db.transaction((data: any) => {
      // Update main workflow record
      const updateFields: string[] = [];
      const updateParams: any[] = [];

      if (data.name !== undefined) {
        updateFields.push('name = ?');
        updateParams.push(data.name);
      }

      if (data.description !== undefined) {
        updateFields.push('description = ?');
        updateParams.push(data.description);
      }

      if (data.triggerType !== undefined) {
        updateFields.push('trigger_type = ?');
        updateParams.push(data.triggerType);
      }

      if (data.triggerConditions !== undefined) {
        updateFields.push('trigger_conditions = ?');
        updateParams.push(JSON.stringify(data.triggerConditions));
      }

      if (data.isActive !== undefined) {
        updateFields.push('is_active = ?');
        updateParams.push(data.isActive ? 1 : 0);
      }

      if (data.category !== undefined) {
        updateFields.push('category = ?');
        updateParams.push(data.category);
      }

      if (data.priority !== undefined) {
        updateFields.push('priority = ?');
        updateParams.push(data.priority);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
        updateParams.push(authResult.user!.id);

        db.prepare(`
          UPDATE workflows
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `).run(...updateParams, workflowId);
      }

      // Update workflow definition if nodes/edges/variables are provided
      if (data.nodes || data.edges || data.variables || data.metadata) {
        const currentDefinition = db.prepare('SELECT steps_json FROM workflow_definitions WHERE id = ?').get(workflowId) as { steps_json?: string } | undefined;
        const currentStepsJson = currentDefinition ? JSON.parse(currentDefinition.steps_json || '{}') : {};

        const newStepsJson = {
          nodes: data.nodes || currentStepsJson.nodes || [],
          edges: data.edges || currentStepsJson.edges || [],
          variables: data.variables || currentStepsJson.variables || [],
          metadata: data.metadata || currentStepsJson.metadata || {}
        };

        db.prepare(`
          UPDATE workflow_definitions
          SET steps_json = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(JSON.stringify(newStepsJson), workflowId);

        // Update workflow_steps table if nodes are provided
        if (data.nodes) {
          // Delete existing steps
          db.prepare('DELETE FROM workflow_steps WHERE workflow_id = ?').run(workflowId);

          // Insert new steps
          const insertStep = db.prepare(`
            INSERT INTO workflow_steps (
              workflow_id,
              step_order,
              step_type,
              name,
              description,
              configuration,
              timeout_minutes,
              retry_count,
              retry_delay_minutes,
              is_optional,
              parent_step_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          data.nodes.forEach((node: any, index: number) => {
            insertStep.run(
              workflowId,
              index,
              node.type,
              node.name,
              node.description || null,
              JSON.stringify({
                ...node.configuration,
                position: node.position,
                retryConfig: node.retryConfig,
                metadata: node.metadata
              }),
              node.timeout ? Math.round(node.timeout / 60000) : 60,
              node.retryConfig?.maxAttempts || 3,
              node.retryConfig?.initialDelay ? Math.round(node.retryConfig.initialDelay / 60000) : 5,
              node.isOptional ? 1 : 0,
              null
            );
          });
        }
      }

      return workflowId;
    });

    updateWorkflow(body);

    // Fetch updated workflow
    const updatedWorkflow = db.prepare(`
      SELECT
        w.*,
        wd.steps_json,
        u.name as created_by_name,
        u2.name as updated_by_name
      FROM workflows w
      LEFT JOIN workflow_definitions wd ON w.id = wd.id
      LEFT JOIN users u ON w.created_by = u.id
      LEFT JOIN users u2 ON w.updated_by = u2.id
      WHERE w.id = ?
    `).get(workflowId);

    const parsedWorkflow = {
      ...(updatedWorkflow as Record<string, unknown>),
      trigger_conditions: JSON.parse((updatedWorkflow as any).trigger_conditions || '{}'),
      steps_json: JSON.parse((updatedWorkflow as any).steps_json || '{}')
    };

    return NextResponse.json({
      message: 'Workflow updated successfully',
      workflow: parsedWorkflow
    });

  } catch (error) {
    logger.error('Error updating workflow', error);
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/definitions/[id]
 * Delete a workflow definition
 */
export async function DELETE(
  request: NextRequest,
  {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WORKFLOW_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;
 params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!['admin'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workflowId = parseInt(params.id);
    if (isNaN(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }

    const db = getConnection();

    // Check if workflow exists
    const workflow = db.prepare('SELECT id, name FROM workflows WHERE id = ?').get(workflowId) as { id: number; name: string } | undefined;
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Check if workflow has active executions
    const activeExecutions = db.prepare(`
      SELECT COUNT(*) as count
      FROM workflow_executions
      WHERE workflow_id = ? AND status IN ('pending', 'running', 'waiting_approval', 'waiting_input', 'paused')
    `).get(workflowId) as { count: number };

    if (activeExecutions.count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete workflow with active executions',
          activeExecutions: activeExecutions.count
        },
        { status: 409 }
      );
    }

    // Start transaction to delete workflow and related data
    const deleteWorkflow = db.transaction(() => {
      // Delete in correct order due to foreign key constraints
      db.prepare('DELETE FROM workflow_step_executions WHERE execution_id IN (SELECT id FROM workflow_executions WHERE workflow_id = ?)').run(workflowId);
      db.prepare('DELETE FROM workflow_approvals WHERE execution_id IN (SELECT id FROM workflow_executions WHERE workflow_id = ?)').run(workflowId);
      db.prepare('DELETE FROM workflow_executions WHERE workflow_id = ?').run(workflowId);
      db.prepare('DELETE FROM workflow_steps WHERE workflow_id = ?').run(workflowId);
      db.prepare('DELETE FROM workflow_definitions WHERE id = ?').run(workflowId);
      db.prepare('DELETE FROM workflows WHERE id = ?').run(workflowId);
    });

    deleteWorkflow();

    return NextResponse.json({
      message: 'Workflow deleted successfully',
      workflowId,
      workflowName: workflow.name
    });

  } catch (error) {
    logger.error('Error deleting workflow', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow' },
      { status: 500 }
    );
  }
}