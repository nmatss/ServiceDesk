/**
 * Workflow Persistence Adapter
 * Database integration for workflow engine
 */

import db from '@/lib/db/connection';
import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStepExecution,
} from '@/lib/types/workflow';
import logger from '@/lib/monitoring/structured-logger';

function getConnection() {
  return db;
}

export class WorkflowPersistenceAdapter {
  private db: ReturnType<typeof getConnection>;

  constructor() {
    this.db = getConnection();
  }

  /**
   * Get workflow definition by ID
   */
  async getWorkflowDefinition(id: number): Promise<WorkflowDefinition | null> {
    try {
      const workflow = this.db.prepare(`
        SELECT
          w.*,
          wd.steps_json
        FROM workflows w
        LEFT JOIN workflow_definitions wd ON w.id = wd.id
        WHERE w.id = ?
      `).get(id) as any;

      if (!workflow) {
        return null;
      }

      // Parse JSON fields
      const triggerConditions = JSON.parse(workflow.trigger_conditions || '{}');
      const stepsJson = JSON.parse(workflow.steps_json || '{}');

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        version: workflow.version,
        isActive: Boolean(workflow.is_active),
        isTemplate: Boolean(workflow.is_template),
        category: workflow.category,
        priority: workflow.priority,
        triggerType: workflow.trigger_type,
        triggerConditions,
        nodes: stepsJson.nodes || [],
        edges: stepsJson.edges || [],
        variables: stepsJson.variables || [],
        metadata: stepsJson.metadata || {
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
        executionCount: workflow.execution_count || 0,
        successCount: workflow.success_count || 0,
        failureCount: workflow.failure_count || 0,
        lastExecutedAt: workflow.last_executed_at ? new Date(workflow.last_executed_at) : undefined,
        createdBy: workflow.created_by,
        updatedBy: workflow.updated_by,
        createdAt: new Date(workflow.created_at),
        updatedAt: new Date(workflow.updated_at),
      };
    } catch (error) {
      logger.error('Error getting workflow definition', error);
      throw error;
    }
  }

  /**
   * Create new execution record
   */
  async createExecution(execution: WorkflowExecution): Promise<WorkflowExecution> {
    try {
      const result = this.db.prepare(`
        INSERT INTO workflow_executions (
          workflow_id,
          trigger_entity_type,
          trigger_entity_id,
          trigger_user_id,
          trigger_data,
          status,
          current_step_id,
          progress_percentage,
          started_at,
          variables,
          execution_log,
          retry_count,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        execution.workflowId,
        execution.triggerEntityType,
        execution.triggerEntityId || null,
        execution.triggerUserId || null,
        JSON.stringify(execution.triggerData),
        execution.status,
        execution.currentStepId || null,
        execution.progressPercentage,
        execution.startedAt.toISOString(),
        JSON.stringify(execution.variables),
        JSON.stringify(execution.executionLog),
        execution.retryCount,
        JSON.stringify(execution.metadata)
      );

      return {
        ...execution,
        id: Number(result.lastInsertRowid),
      };
    } catch (error) {
      logger.error('Error creating execution', error);
      throw error;
    }
  }

  /**
   * Update execution record
   */
  async updateExecution(execution: WorkflowExecution): Promise<void> {
    try {
      this.db.prepare(`
        UPDATE workflow_executions
        SET
          status = ?,
          current_step_id = ?,
          progress_percentage = ?,
          completed_at = ?,
          error_message = ?,
          variables = ?,
          execution_log = ?,
          retry_count = ?,
          metadata = ?
        WHERE id = ?
      `).run(
        execution.status,
        execution.currentStepId || null,
        execution.progressPercentage,
        execution.completedAt ? execution.completedAt.toISOString() : null,
        execution.errorMessage || null,
        JSON.stringify(execution.variables),
        JSON.stringify(execution.executionLog),
        execution.retryCount,
        JSON.stringify(execution.metadata),
        execution.id
      );
    } catch (error) {
      logger.error('Error updating execution', error);
      throw error;
    }
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: number): Promise<WorkflowExecution | null> {
    try {
      const execution = this.db.prepare(`
        SELECT * FROM workflow_executions WHERE id = ?
      `).get(id) as any;

      if (!execution) {
        return null;
      }

      return {
        id: execution.id,
        workflowId: execution.workflow_id,
        triggerEntityType: execution.trigger_entity_type,
        triggerEntityId: execution.trigger_entity_id,
        triggerUserId: execution.trigger_user_id,
        triggerData: JSON.parse(execution.trigger_data || '{}'),
        status: execution.status,
        currentStepId: execution.current_step_id,
        progressPercentage: execution.progress_percentage,
        startedAt: new Date(execution.started_at),
        completedAt: execution.completed_at ? new Date(execution.completed_at) : undefined,
        errorMessage: execution.error_message,
        executionLog: JSON.parse(execution.execution_log || '[]'),
        retryCount: execution.retry_count,
        variables: JSON.parse(execution.variables || '{}'),
        metadata: JSON.parse(execution.metadata || '{}'),
      };
    } catch (error) {
      logger.error('Error getting execution', error);
      throw error;
    }
  }

  /**
   * Create step execution record
   */
  async createStepExecution(stepExecution: WorkflowStepExecution): Promise<WorkflowStepExecution> {
    try {
      const result = this.db.prepare(`
        INSERT INTO workflow_step_executions (
          execution_id,
          step_id,
          status,
          input_data,
          output_data,
          error_message,
          started_at,
          execution_time_ms,
          retry_count,
          metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stepExecution.executionId,
        stepExecution.stepId,
        stepExecution.status,
        JSON.stringify(stepExecution.inputData || {}),
        JSON.stringify(stepExecution.outputData || {}),
        stepExecution.errorMessage || null,
        stepExecution.startedAt.toISOString(),
        stepExecution.executionTimeMs || null,
        stepExecution.retryCount,
        JSON.stringify(stepExecution.metadata)
      );

      return {
        ...stepExecution,
        id: Number(result.lastInsertRowid),
      };
    } catch (error) {
      logger.error('Error creating step execution', error);
      throw error;
    }
  }

  /**
   * Update step execution record
   */
  async updateStepExecution(stepExecution: WorkflowStepExecution): Promise<void> {
    try {
      this.db.prepare(`
        UPDATE workflow_step_executions
        SET
          status = ?,
          output_data = ?,
          error_message = ?,
          completed_at = ?,
          execution_time_ms = ?,
          retry_count = ?,
          metadata = ?
        WHERE id = ?
      `).run(
        stepExecution.status,
        JSON.stringify(stepExecution.outputData || {}),
        stepExecution.errorMessage || null,
        stepExecution.completedAt ? stepExecution.completedAt.toISOString() : null,
        stepExecution.executionTimeMs || null,
        stepExecution.retryCount,
        JSON.stringify(stepExecution.metadata),
        stepExecution.id
      );
    } catch (error) {
      logger.error('Error updating step execution', error);
      throw error;
    }
  }

  /**
   * Increment workflow success count
   */
  async incrementWorkflowSuccessCount(workflowId: number): Promise<void> {
    try {
      this.db.prepare(`
        UPDATE workflows
        SET
          success_count = success_count + 1,
          execution_count = execution_count + 1,
          last_executed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(workflowId);
    } catch (error) {
      logger.error('Error incrementing workflow success count', error);
      throw error;
    }
  }

  /**
   * Increment workflow failure count
   */
  async incrementWorkflowFailureCount(workflowId: number): Promise<void> {
    try {
      this.db.prepare(`
        UPDATE workflows
        SET
          failure_count = failure_count + 1,
          execution_count = execution_count + 1,
          last_executed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(workflowId);
    } catch (error) {
      logger.error('Error incrementing workflow failure count', error);
      throw error;
    }
  }

  /**
   * Get execution history for a workflow
   */
  async getExecutionHistory(
    workflowId: number,
    limit: number = 10,
    offset: number = 0
  ): Promise<WorkflowExecution[]> {
    try {
      const executions = this.db.prepare(`
        SELECT * FROM workflow_executions
        WHERE workflow_id = ?
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?
      `).all(workflowId, limit, offset) as any[];

      return executions.map((execution) => ({
        id: execution.id,
        workflowId: execution.workflow_id,
        triggerEntityType: execution.trigger_entity_type,
        triggerEntityId: execution.trigger_entity_id,
        triggerUserId: execution.trigger_user_id,
        triggerData: JSON.parse(execution.trigger_data || '{}'),
        status: execution.status,
        currentStepId: execution.current_step_id,
        progressPercentage: execution.progress_percentage,
        startedAt: new Date(execution.started_at),
        completedAt: execution.completed_at ? new Date(execution.completed_at) : undefined,
        errorMessage: execution.error_message,
        executionLog: JSON.parse(execution.execution_log || '[]'),
        retryCount: execution.retry_count,
        variables: JSON.parse(execution.variables || '{}'),
        metadata: JSON.parse(execution.metadata || '{}'),
      }));
    } catch (error) {
      logger.error('Error getting execution history', error);
      throw error;
    }
  }

  /**
   * Delete old executions (cleanup)
   */
  async deleteOldExecutions(olderThanDays: number): Promise<number> {
    try {
      const result = this.db.prepare(`
        DELETE FROM workflow_executions
        WHERE started_at < datetime('now', '-${olderThanDays} days')
      `).run();

      return result.changes;
    } catch (error) {
      logger.error('Error deleting old executions', error);
      throw error;
    }
  }
}

export default WorkflowPersistenceAdapter;
