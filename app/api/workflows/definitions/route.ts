/**
 * Workflow Definitions API
 * CRUD operations for workflow definitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getConnection } from '@/lib/db/connection';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
// Validation schemas
const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  triggerType: z.enum([
    'ticket_created',
    'ticket_updated',
    'status_changed',
    'sla_warning',
    'time_based',
    'manual',
    'comment_added',
    'assignment_changed',
    'priority_changed',
    'category_changed',
    'webhook',
    'api_call',
    'user_action'
  ]),
  triggerConditions: z.object({
    filters: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.any(),
      dataType: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object'])
    })),
    timeConstraints: z.object({
      businessHoursOnly: z.boolean().optional(),
      allowedDaysOfWeek: z.array(z.number()).optional(),
      allowedTimeRange: z.object({
        startHour: z.number(),
        endHour: z.number()
      }).optional(),
      timezone: z.string().optional(),
      delay: z.object({
        amount: z.number(),
        unit: z.enum(['minutes', 'hours', 'days', 'weeks'])
      }).optional()
    }).optional(),
    userConstraints: z.object({
      roles: z.array(z.string()).optional(),
      departments: z.array(z.number()).optional(),
      permissions: z.array(z.string()).optional(),
      excludeUsers: z.array(z.number()).optional(),
      includeUsers: z.array(z.number()).optional()
    }).optional(),
    entityConstraints: z.object({
      categories: z.array(z.number()).optional(),
      priorities: z.array(z.number()).optional(),
      statuses: z.array(z.number()).optional(),
      assignees: z.array(z.number()).optional(),
      reporters: z.array(z.number()).optional(),
      customFields: z.record(z.string(), z.any()).optional()
    }).optional(),
    customScript: z.string().optional()
  }),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum([
      'start',
      'end',
      'action',
      'condition',
      'approval',
      'delay',
      'parallel',
      'webhook',
      'script',
      'notification',
      'integration',
      'ml_prediction',
      'human_task',
      'loop',
      'subworkflow'
    ]),
    name: z.string(),
    description: z.string().optional(),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    configuration: z.record(z.string(), z.any()),
    timeout: z.number().optional(),
    retryConfig: z.object({
      maxAttempts: z.number(),
      backoffStrategy: z.enum(['fixed', 'linear', 'exponential', 'random']),
      initialDelay: z.number(),
      maxDelay: z.number(),
      multiplier: z.number().optional(),
      retryConditions: z.array(z.object({
        errorType: z.enum(['timeout', 'http_error', 'network_error', 'validation_error', 'custom']),
        errorCodes: z.array(z.string()).optional(),
        shouldRetry: z.boolean()
      }))
    }).optional(),
    isOptional: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: z.enum(['default', 'conditional', 'error', 'timeout', 'loop', 'parallel']),
    configuration: z.object({
      label: z.string().optional(),
      color: z.string().optional(),
      animated: z.boolean().optional(),
      style: z.record(z.string(), z.any()).optional(),
      dataTransformation: z.string().optional(),
      validationRules: z.array(z.object({
        field: z.string(),
        rule: z.enum(['required', 'min_length', 'max_length', 'pattern', 'type', 'custom']),
        value: z.any().optional(),
        message: z.string().optional()
      })).optional()
    }).optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.any(),
      dataType: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object'])
    })).optional(),
    priority: z.number().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  })),
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'date', 'object', 'array']),
    defaultValue: z.any().optional(),
    description: z.string().optional(),
    scope: z.enum(['global', 'local', 'output']),
    isRequired: z.boolean().optional(),
    validation: z.array(z.object({
      field: z.string(),
      rule: z.enum(['required', 'min_length', 'max_length', 'pattern', 'type', 'custom']),
      value: z.any().optional(),
      message: z.string().optional()
    })).optional()
  })).optional(),
  category: z.enum(['ticket_automation', 'notification', 'escalation', 'approval', 'integration', 'ml_optimization']).optional(),
  priority: z.number().optional(),
  isActive: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  metadata: z.object({
    tags: z.array(z.string()),
    documentation: z.string().optional(),
    version: z.string(),
    author: z.string(),
    lastModifiedBy: z.string(),
    changeLog: z.array(z.object({
      version: z.string(),
      date: z.date(),
      author: z.string(),
      changes: z.array(z.string()),
      breaking: z.boolean().optional()
    })),
    dependencies: z.array(z.string()),
    testCases: z.array(z.object({
      name: z.string(),
      description: z.string(),
      input: z.record(z.string(), z.any()),
      expectedOutput: z.record(z.string(), z.any()),
      status: z.enum(['pending', 'passed', 'failed']),
      lastRun: z.date().optional()
    })),
    performance: z.object({
      avgExecutionTime: z.number(),
      maxExecutionTime: z.number(),
      minExecutionTime: z.number(),
      successRate: z.number(),
      errorRate: z.number(),
      resourceUsage: z.object({
        memoryMB: z.number(),
        cpuPercent: z.number(),
        networkKB: z.number(),
        storageKB: z.number()
      })
    })
  }).optional()
});

const UpdateWorkflowSchema = CreateWorkflowSchema.partial().omit({
  triggerType: true,
  triggerConditions: true
}).extend({
  triggerType: z.enum([
    'ticket_created',
    'ticket_updated',
    'status_changed',
    'sla_warning',
    'time_based',
    'manual',
    'comment_added',
    'assignment_changed',
    'priority_changed',
    'category_changed',
    'webhook',
    'api_call',
    'user_action'
  ]).optional(),
  triggerConditions: CreateWorkflowSchema.shape.triggerConditions.optional()
});

/**
 * GET /api/workflows/definitions
 * List all workflow definitions with optional filtering
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WORKFLOW_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const isTemplate = searchParams.get('isTemplate');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    const db = getConnection();

    // Build query with filters
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (isActive !== null) {
      whereClause += ' AND is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    if (isTemplate !== null) {
      whereClause += ' AND is_template = ?';
      params.push(isTemplate === 'true' ? 1 : 0);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM workflows
      ${whereClause}
    `;

    const countResult = db.prepare(countQuery).get(...params) as { total: number };
    const total = countResult.total;

    // Get workflows
    const query = `
      SELECT
        id,
        name,
        description,
        trigger_type,
        trigger_conditions,
        version,
        is_active,
        is_template,
        category,
        priority,
        execution_count,
        success_count,
        failure_count,
        last_executed_at,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM workflows
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `;

    const workflows = db.prepare(query).all(...params, limit, offset);

    // Get workflow steps for each workflow
    const workflowsWithSteps = workflows.map((workflow: any) => {
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
          parent_step_id
        FROM workflow_steps
        WHERE workflow_id = ?
        ORDER BY step_order
      `).all(workflow.id);

      return {
        ...workflow,
        trigger_conditions: JSON.parse(workflow.trigger_conditions || '{}'),
        steps: steps.map((step: any) => ({
          ...step,
          configuration: JSON.parse(step.configuration || '{}')
        }))
      };
    });

    return NextResponse.json({
      workflows: workflowsWithSteps,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching workflows', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows/definitions
 * Create a new workflow definition
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WORKFLOW_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

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

    const body = await request.json();
    const validationResult = CreateWorkflowSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const workflowData = validationResult.data;
    const db = getConnection();

    // Start transaction
    const createWorkflow = db.transaction((data: any) => {
      // Insert workflow
      const workflowResult = db.prepare(`
        INSERT INTO workflows (
          name,
          description,
          trigger_type,
          trigger_conditions,
          version,
          is_active,
          is_template,
          category,
          priority,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        data.name,
        data.description || null,
        data.triggerType,
        JSON.stringify(data.triggerConditions),
        1,
        data.isActive !== false ? 1 : 0,
        data.isTemplate ? 1 : 0,
        data.category || 'ticket_automation',
        data.priority || 0,
        authResult.user!.id
      );

      const workflowId = workflowResult.lastInsertRowid;

      // Insert workflow steps (nodes)
      if (data.nodes && data.nodes.length > 0) {
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
            node.timeout ? Math.round(node.timeout / 60000) : 60, // Convert ms to minutes
            node.retryConfig?.maxAttempts || 3,
            node.retryConfig?.initialDelay ? Math.round(node.retryConfig.initialDelay / 60000) : 5,
            node.isOptional ? 1 : 0,
            null
          );
        });
      }

      // Store workflow definition (complete structure) in new table
      db.prepare(`
        INSERT INTO workflow_definitions (
          id,
          name,
          description,
          trigger_conditions,
          steps_json,
          is_active,
          version,
          created_by,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        workflowId,
        data.name,
        data.description || null,
        JSON.stringify(data.triggerConditions),
        JSON.stringify({
          nodes: data.nodes,
          edges: data.edges,
          variables: data.variables || [],
          metadata: data.metadata
        }),
        data.isActive !== false ? 1 : 0,
        1,
        authResult.user!.id
      );

      return workflowId;
    });

    const workflowId = createWorkflow(workflowData);

    // Fetch the created workflow
    const workflow = db.prepare(`
      SELECT
        w.*,
        wd.steps_json,
        u.name as created_by_name
      FROM workflows w
      LEFT JOIN workflow_definitions wd ON w.id = wd.id
      LEFT JOIN users u ON w.created_by = u.id
      WHERE w.id = ?
    `).get(workflowId);

    if (!workflow) {
      return NextResponse.json(
        { error: 'Failed to create workflow' },
        { status: 500 }
      );
    }

    const workflowTyped = workflow as Record<string, unknown>
    const parsedWorkflow = {
      ...workflowTyped,
      trigger_conditions: JSON.parse((workflowTyped.trigger_conditions as string) || '{}'),
      steps_json: JSON.parse((workflowTyped.steps_json as string) || '{}')
    };

    return NextResponse.json(
      {
        message: 'Workflow created successfully',
        workflow: parsedWorkflow
      },
      { status: 201 }
    );

  } catch (error) {
    logger.error('Error creating workflow', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}