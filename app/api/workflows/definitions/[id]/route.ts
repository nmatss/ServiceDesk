/**
 * Individual Workflow Definition API
 * CRUD operations for specific workflow definitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeQuery, executeQueryOne, executeRun, executeTransaction, getDatabase } from '@/lib/db/adapter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/workflows/definitions/[id]
 * Get a specific workflow definition
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WORKFLOW_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;

    const workflowId = parseInt(params.id);
    if (isNaN(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }
// Get workflow with full definition
    const workflow = await executeQueryOne(`
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
    `, [workflowId]);

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get workflow steps
    const steps = await executeQuery(`
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
    `, [workflowId]);

    // Get workflow executions summary
    const executionStats = await executeQueryOne(`
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
    `, [workflowId]);

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
  { params }: { params: { id: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WORKFLOW_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'agent'] });
    if (guard.response) return guard.response;
    const { userId, role } = guard.auth!;

    const workflowId = parseInt(params.id);
    if (isNaN(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }

    const body = await request.json();
// Check if workflow exists
    const existingWorkflow = await executeQueryOne('SELECT id, created_by FROM workflows WHERE id = ?', [workflowId]);
    if (!existingWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Check ownership or admin rights
    if (role !== 'admin' && (existingWorkflow as any).created_by !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Start transaction
    const db = getDatabase() as any;
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
        updateParams.push(userId);

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
          data.nodes.forEach((node: any, index: number) => {
            db.prepare(`
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
          `).run(
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
              null);
          });
        }
      }

      return workflowId;
    });

    updateWorkflow(body);

    // Fetch updated workflow
    const updatedWorkflow = await executeQueryOne(`
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
    `, [workflowId]);

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
  { params }: { params: { id: string } }
) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WORKFLOW_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const guardDel = requireTenantUserContext(request, { requireRoles: ['admin'] });
    if (guardDel.response) return guardDel.response;

    const workflowId = parseInt(params.id);
    if (isNaN(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID' }, { status: 400 });
    }
// Check if workflow exists
    const workflow = await executeQueryOne<{ id: number; name: string }>('SELECT id, name FROM workflows WHERE id = ?', [workflowId]);
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Check if workflow has active executions
    const activeExecutions = await executeQueryOne<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM workflow_executions
      WHERE workflow_id = ? AND status IN ('pending', 'running', 'waiting_approval', 'waiting_input', 'paused')
    `, [workflowId]) || { count: 0 };

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
    const dbDel = getDatabase() as any;
    const deleteWorkflow = dbDel.transaction(() => {
      // Delete in correct order due to foreign key constraints
      dbDel.prepare('DELETE FROM workflow_step_executions WHERE execution_id IN (SELECT id FROM workflow_executions WHERE workflow_id = ?)').run(workflowId);
      dbDel.prepare('DELETE FROM workflow_approvals WHERE execution_id IN (SELECT id FROM workflow_executions WHERE workflow_id = ?)').run(workflowId);
      dbDel.prepare('DELETE FROM workflow_executions WHERE workflow_id = ?').run(workflowId);
      dbDel.prepare('DELETE FROM workflow_steps WHERE workflow_id = ?').run(workflowId);
      dbDel.prepare('DELETE FROM workflow_definitions WHERE id = ?').run(workflowId);
      dbDel.prepare('DELETE FROM workflows WHERE id = ?').run(workflowId);
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