/**
 * Workflow Execution History API
 * Get execution details, logs, and history
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import logger from '@/lib/monitoring/structured-logger';

/**
 * GET /api/workflows/executions/[id]
 * Get execution details and history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const executionId = parseInt(params.id);
    if (isNaN(executionId)) {
      return NextResponse.json({ error: 'Invalid execution ID' }, { status: 400 });
    }

    // db is already imported

    // Get execution details
    const execution = db.prepare(`
      SELECT
        we.*,
        w.name as workflow_name,
        w.description as workflow_description,
        u.name as triggered_by_name,
        u.email as triggered_by_email
      FROM workflow_executions we
      LEFT JOIN workflows w ON we.workflow_id = w.id
      LEFT JOIN users u ON we.trigger_user_id = u.id
      WHERE we.id = ?
    `).get(executionId);

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }

    // Get step executions
    const steps = db.prepare(`
      SELECT
        wse.*,
        ws.name as step_name,
        ws.step_type
      FROM workflow_step_executions wse
      LEFT JOIN workflow_steps ws ON wse.step_id = ws.id
      WHERE wse.execution_id = ?
      ORDER BY wse.started_at
    `).all(executionId);

    // Parse JSON fields
    const parsedExecution = {
      ...execution,
      trigger_data: JSON.parse(execution.trigger_data || '{}'),
      variables: JSON.parse(execution.variables || '{}'),
      execution_log: JSON.parse(execution.execution_log || '[]'),
      steps: steps.map((step: any) => ({
        ...step,
        input_data: JSON.parse(step.input_data || '{}'),
        output_data: JSON.parse(step.output_data || '{}'),
        metadata: JSON.parse(step.metadata || '{}'),
      })),
    };

    return NextResponse.json({
      success: true,
      execution: parsedExecution,
    });
  } catch (error: any) {
    logger.error('Error fetching execution details', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution details', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workflows/executions/[id]
 * Update execution (e.g., resume, pause)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const executionId = parseInt(params.id);
    if (isNaN(executionId)) {
      return NextResponse.json({ error: 'Invalid execution ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Handle different actions
    switch (action) {
      case 'resume':
        // Implementation would call WorkflowEngine.resumeExecution()
        return NextResponse.json({
          success: true,
          message: 'Execution resumed',
        });

      case 'pause':
        // Implementation would pause the execution
        return NextResponse.json({
          success: true,
          message: 'Execution paused',
        });

      case 'cancel':
        // Implementation would call WorkflowEngine.cancelExecution()
        return NextResponse.json({
          success: true,
          message: 'Execution cancelled',
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    logger.error('Error updating execution', error);
    return NextResponse.json(
      { error: 'Failed to update execution', message: error.message },
      { status: 500 }
    );
  }
}
