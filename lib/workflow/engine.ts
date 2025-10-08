/**
 * Advanced Workflow Engine Core
 * Event-driven execution with state management and error handling
 */

import {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowNode,
  WorkflowEdge,
  ExecutionStatus,
  StepExecutionStatus,
  WorkflowEvent,
  WorkflowEventType,
  ExecutionLogEntry,
  WorkflowStepExecution,
  RetryConfiguration,
  MLPredictionResult,
} from '@/lib/types/workflow';

export class WorkflowEngine {
  private executionContext: Map<number, ExecutionContext> = new Map();
  private eventEmitter: WorkflowEventEmitter;
  private nodeExecutors: Map<string, NodeExecutor>;
  private persistenceAdapter: WorkflowPersistenceAdapter;
  private queueManager: WorkflowQueueManager;
  private metricsCollector: WorkflowMetricsCollector;

  constructor(
    persistenceAdapter: WorkflowPersistenceAdapter,
    queueManager: WorkflowQueueManager,
    metricsCollector: WorkflowMetricsCollector
  ) {
    this.persistenceAdapter = persistenceAdapter;
    this.queueManager = queueManager;
    this.metricsCollector = metricsCollector;
    this.eventEmitter = new WorkflowEventEmitter();
    this.nodeExecutors = this.initializeNodeExecutors();
    this.setupEventHandlers();
  }

  /**
   * Execute a workflow with given trigger data
   */
  async executeWorkflow(
    workflowId: number,
    triggerData: Record<string, any>,
    triggerUserId?: number,
    options: ExecutionOptions = {}
  ): Promise<WorkflowExecution> {
    const startTime = Date.now();

    try {
      // Load workflow definition
      const workflow = await this.persistenceAdapter.getWorkflowDefinition(workflowId);
      if (!workflow) {
        throw new WorkflowError(`Workflow ${workflowId} not found`, 'WORKFLOW_NOT_FOUND');
      }

      if (!workflow.isActive) {
        throw new WorkflowError(`Workflow ${workflowId} is not active`, 'WORKFLOW_INACTIVE');
      }

      // Validate trigger conditions
      if (!this.validateTriggerConditions(workflow, triggerData)) {
        throw new WorkflowError('Trigger conditions not met', 'TRIGGER_CONDITIONS_NOT_MET');
      }

      // Create execution record
      const execution = await this.createExecution(workflow, triggerData, triggerUserId, options);

      // Initialize execution context
      const context = new ExecutionContext(execution, workflow, this.eventEmitter);
      this.executionContext.set(execution.id, context);

      // Emit workflow started event
      await this.emitEvent('workflow_started', {
        workflowId: workflow.id,
        executionId: execution.id,
        triggerData,
      });

      // Start execution
      await this.startExecution(context);

      // Record metrics
      this.metricsCollector.recordExecutionStart(workflow.id, Date.now() - startTime);

      return execution;
    } catch (error) {
      this.metricsCollector.recordExecutionError(workflowId, error.message);
      throw error;
    }
  }

  /**
   * Resume a paused or waiting execution
   */
  async resumeExecution(
    executionId: number,
    resumeData: Record<string, any> = {}
  ): Promise<void> {
    const context = this.executionContext.get(executionId);
    if (!context) {
      // Load context from persistence
      const execution = await this.persistenceAdapter.getExecution(executionId);
      if (!execution) {
        throw new WorkflowError(`Execution ${executionId} not found`, 'EXECUTION_NOT_FOUND');
      }

      const workflow = await this.persistenceAdapter.getWorkflowDefinition(execution.workflowId);
      if (!workflow) {
        throw new WorkflowError(`Workflow ${execution.workflowId} not found`, 'WORKFLOW_NOT_FOUND');
      }

      const newContext = new ExecutionContext(execution, workflow, this.eventEmitter);
      this.executionContext.set(executionId, newContext);
      await this.continueExecution(newContext, resumeData);
    } else {
      await this.continueExecution(context, resumeData);
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: number, reason: string = 'User cancelled'): Promise<void> {
    const context = this.executionContext.get(executionId);
    if (context) {
      context.cancel(reason);
      await this.updateExecutionStatus(context, 'cancelled');
      await this.emitEvent('workflow_cancelled', {
        executionId,
        reason,
      });
    }
  }

  /**
   * Get execution status and progress
   */
  async getExecutionStatus(executionId: number): Promise<ExecutionStatusResponse> {
    const context = this.executionContext.get(executionId);
    if (context) {
      return {
        status: context.execution.status,
        progress: context.execution.progressPercentage,
        currentStep: context.execution.currentStepId,
        variables: context.getVariables(),
        logs: context.execution.executionLog,
        error: context.execution.errorMessage,
      };
    }

    // Load from persistence
    const execution = await this.persistenceAdapter.getExecution(executionId);
    if (!execution) {
      throw new WorkflowError(`Execution ${executionId} not found`, 'EXECUTION_NOT_FOUND');
    }

    return {
      status: execution.status,
      progress: execution.progressPercentage,
      currentStep: execution.currentStepId,
      variables: execution.variables,
      logs: execution.executionLog,
      error: execution.errorMessage,
    };
  }

  /**
   * Start workflow execution
   */
  private async startExecution(context: ExecutionContext): Promise<void> {
    try {
      // Find start node
      const startNode = context.workflow.nodes.find(n => n.type === 'start');
      if (!startNode) {
        throw new WorkflowError('No start node found in workflow', 'NO_START_NODE');
      }

      // Update execution status
      await this.updateExecutionStatus(context, 'running');

      // Execute start node
      await this.executeNode(context, startNode);
    } catch (error) {
      await this.handleExecutionError(context, error);
    }
  }

  /**
   * Continue execution from current step
   */
  private async continueExecution(
    context: ExecutionContext,
    resumeData: Record<string, any>
  ): Promise<void> {
    try {
      // Merge resume data into variables
      context.setVariables({ ...context.getVariables(), ...resumeData });

      // Find current node
      const currentNode = context.getCurrentNode();
      if (!currentNode) {
        throw new WorkflowError('No current node found', 'NO_CURRENT_NODE');
      }

      // Continue from current node
      await this.proceedToNextNode(context, currentNode.id, {});
    } catch (error) {
      await this.handleExecutionError(context, error);
    }
  }

  /**
   * Execute a workflow node
   */
  private async executeNode(context: ExecutionContext, node: WorkflowNode): Promise<void> {
    const stepExecution = await this.createStepExecution(context, node);

    try {
      // Log step start
      context.log('info', `Starting execution of node: ${node.name}`, {
        nodeId: node.id,
        nodeType: node.type,
      });

      // Emit step started event
      await this.emitEvent('step_started', {
        executionId: context.execution.id,
        stepId: node.id,
        stepType: node.type,
      });

      // Get node executor
      const executor = this.nodeExecutors.get(node.type);
      if (!executor) {
        throw new WorkflowError(`No executor found for node type: ${node.type}`, 'NO_EXECUTOR');
      }

      // Execute node with timeout
      const result = await this.executeWithTimeout(
        () => executor.execute(node, context),
        node.timeout || 300000 // 5 minutes default
      );

      // Update step execution
      stepExecution.status = 'completed';
      stepExecution.completedAt = new Date();
      stepExecution.outputData = result.outputData;
      stepExecution.executionTimeMs = Date.now() - stepExecution.startedAt.getTime();

      await this.persistenceAdapter.updateStepExecution(stepExecution);

      // Log step completion
      context.log('info', `Completed execution of node: ${node.name}`, {
        nodeId: node.id,
        executionTime: stepExecution.executionTimeMs,
        outputData: result.outputData,
      });

      // Emit step completed event
      await this.emitEvent('step_completed', {
        executionId: context.execution.id,
        stepId: node.id,
        executionTime: stepExecution.executionTimeMs,
        outputData: result.outputData,
      });

      // Handle result
      await this.handleNodeResult(context, node, result);
    } catch (error) {
      // Update step execution with error
      stepExecution.status = 'failed';
      stepExecution.completedAt = new Date();
      stepExecution.errorMessage = error.message;
      stepExecution.executionTimeMs = Date.now() - stepExecution.startedAt.getTime();

      await this.persistenceAdapter.updateStepExecution(stepExecution);

      // Handle node error
      await this.handleNodeError(context, node, error);
    }
  }

  /**
   * Handle node execution result
   */
  private async handleNodeResult(
    context: ExecutionContext,
    node: WorkflowNode,
    result: NodeExecutionResult
  ): Promise<void> {
    // Update context variables
    if (result.outputData) {
      context.setVariables({ ...context.getVariables(), ...result.outputData });
    }

    // Handle different result types
    switch (result.action) {
      case 'continue':
        await this.proceedToNextNode(context, node.id, result.outputData || {});
        break;

      case 'wait':
        await this.updateExecutionStatus(context, 'waiting_input');
        context.execution.currentStepId = node.id;
        await this.persistenceAdapter.updateExecution(context.execution);
        break;

      case 'complete':
        await this.completeExecution(context, result.outputData);
        break;

      case 'fail':
        throw new WorkflowError(result.errorMessage || 'Node execution failed', 'NODE_EXECUTION_FAILED');

      case 'retry':
        await this.retryNode(context, node, result.retryDelay);
        break;

      case 'branch':
        if (result.targetNodeId) {
          await this.executeNodeById(context, result.targetNodeId);
        }
        break;

      case 'parallel':
        if (result.parallelNodeIds) {
          await this.executeNodesInParallel(context, result.parallelNodeIds);
        }
        break;

      default:
        throw new WorkflowError(`Unknown result action: ${result.action}`, 'UNKNOWN_RESULT_ACTION');
    }
  }

  /**
   * Proceed to next node based on edges
   */
  private async proceedToNextNode(
    context: ExecutionContext,
    currentNodeId: string,
    outputData: Record<string, any>
  ): Promise<void> {
    // Find outgoing edges
    const outgoingEdges = context.workflow.edges.filter(e => e.source === currentNodeId);

    if (outgoingEdges.length === 0) {
      // No outgoing edges - check if this is an end node
      const currentNode = context.workflow.nodes.find(n => n.id === currentNodeId);
      if (currentNode?.type === 'end') {
        await this.completeExecution(context, outputData);
      } else {
        throw new WorkflowError('No outgoing edges found and not an end node', 'NO_OUTGOING_EDGES');
      }
      return;
    }

    // Evaluate edge conditions
    const targetEdge = await this.evaluateEdgeConditions(context, outgoingEdges, outputData);
    if (!targetEdge) {
      throw new WorkflowError('No matching edge condition found', 'NO_MATCHING_EDGE');
    }

    // Execute target node
    await this.executeNodeById(context, targetEdge.target);
  }

  /**
   * Execute node by ID
   */
  private async executeNodeById(context: ExecutionContext, nodeId: string): Promise<void> {
    const node = context.workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new WorkflowError(`Node ${nodeId} not found`, 'NODE_NOT_FOUND');
    }

    context.execution.currentStepId = nodeId;
    await this.persistenceAdapter.updateExecution(context.execution);
    await this.executeNode(context, node);
  }

  /**
   * Execute multiple nodes in parallel
   */
  private async executeNodesInParallel(context: ExecutionContext, nodeIds: string[]): Promise<void> {
    const promises = nodeIds.map(async (nodeId) => {
      const childContext = context.createChildContext();
      await this.executeNodeById(childContext, nodeId);
      return childContext;
    });

    try {
      const results = await Promise.allSettled(promises);

      // Check for failures
      const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length > 0) {
        throw new WorkflowError(
          `Parallel execution failed: ${failures.map(f => f.reason.message).join(', ')}`,
          'PARALLEL_EXECUTION_FAILED'
        );
      }

      // Merge results
      const successResults = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<ExecutionContext>[];
      const mergedVariables = successResults.reduce((acc, result) => {
        return { ...acc, ...result.value.getVariables() };
      }, context.getVariables());

      context.setVariables(mergedVariables);
    } catch (error) {
      throw new WorkflowError(`Parallel execution error: ${error.message}`, 'PARALLEL_EXECUTION_ERROR');
    }
  }

  /**
   * Evaluate edge conditions to find the target edge
   */
  private async evaluateEdgeConditions(
    context: ExecutionContext,
    edges: WorkflowEdge[],
    outputData: Record<string, any>
  ): Promise<WorkflowEdge | null> {
    // Sort edges by priority (higher priority first)
    const sortedEdges = edges.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const edge of sortedEdges) {
      if (!edge.conditions || edge.conditions.length === 0) {
        // No conditions - default edge
        return edge;
      }

      // Evaluate conditions
      const conditionsMet = await this.evaluateConditions(context, edge.conditions, outputData);
      if (conditionsMet) {
        return edge;
      }
    }

    return null;
  }

  /**
   * Evaluate conditions
   */
  private async evaluateConditions(
    context: ExecutionContext,
    conditions: any[],
    data: Record<string, any>
  ): Promise<boolean> {
    // Simple condition evaluation - can be extended
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(data, condition.field) ||
                        this.getFieldValue(context.getVariables(), condition.field);

      if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get field value using dot notation
   */
  private getFieldValue(obj: Record<string, any>, field: string): any {
    return field.split('.').reduce((o, i) => o?.[i], obj);
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'contains':
        return String(fieldValue).includes(String(expectedValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(expectedValue));
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
      case 'is_null':
        return fieldValue == null;
      case 'is_not_null':
        return fieldValue != null;
      case 'regex':
        return new RegExp(expectedValue).test(String(fieldValue));
      default:
        return false;
    }
  }

  /**
   * Complete workflow execution
   */
  private async completeExecution(
    context: ExecutionContext,
    outputData?: Record<string, any>
  ): Promise<void> {
    context.execution.status = 'completed';
    context.execution.completedAt = new Date();
    context.execution.progressPercentage = 100;

    if (outputData) {
      context.setVariables({ ...context.getVariables(), ...outputData });
      context.execution.variables = context.getVariables();
    }

    await this.persistenceAdapter.updateExecution(context.execution);

    context.log('info', 'Workflow execution completed successfully', {
      outputData: context.getVariables(),
    });

    await this.emitEvent('workflow_completed', {
      executionId: context.execution.id,
      workflowId: context.workflow.id,
      outputData: context.getVariables(),
    });

    // Update workflow metrics
    await this.persistenceAdapter.incrementWorkflowSuccessCount(context.workflow.id);
    this.metricsCollector.recordExecutionSuccess(context.workflow.id);

    // Cleanup context
    this.executionContext.delete(context.execution.id);
  }

  /**
   * Handle execution error
   */
  private async handleExecutionError(context: ExecutionContext, error: Error): Promise<void> {
    context.execution.status = 'failed';
    context.execution.completedAt = new Date();
    context.execution.errorMessage = error.message;

    await this.persistenceAdapter.updateExecution(context.execution);

    context.log('error', `Workflow execution failed: ${error.message}`, {
      error: error.stack,
    });

    await this.emitEvent('workflow_failed', {
      executionId: context.execution.id,
      workflowId: context.workflow.id,
      error: error.message,
    });

    // Update workflow metrics
    await this.persistenceAdapter.incrementWorkflowFailureCount(context.workflow.id);
    this.metricsCollector.recordExecutionFailure(context.workflow.id, error.message);

    // Cleanup context
    this.executionContext.delete(context.execution.id);
  }

  /**
   * Handle node execution error
   */
  private async handleNodeError(
    context: ExecutionContext,
    node: WorkflowNode,
    error: Error
  ): Promise<void> {
    context.log('error', `Node execution failed: ${node.name}`, {
      nodeId: node.id,
      error: error.message,
    });

    await this.emitEvent('error_occurred', {
      executionId: context.execution.id,
      stepId: node.id,
      error: error.message,
    });

    // Check retry configuration
    if (node.retryConfig && context.getRetryCount(node.id) < node.retryConfig.maxAttempts) {
      await this.retryNode(context, node);
    } else {
      throw error;
    }
  }

  /**
   * Retry node execution
   */
  private async retryNode(
    context: ExecutionContext,
    node: WorkflowNode,
    delay?: number
  ): Promise<void> {
    const retryCount = context.incrementRetryCount(node.id);

    context.log('warn', `Retrying node execution: ${node.name} (attempt ${retryCount})`, {
      nodeId: node.id,
      retryCount,
    });

    await this.emitEvent('retry_attempted', {
      executionId: context.execution.id,
      stepId: node.id,
      retryCount,
    });

    // Calculate retry delay
    const retryDelay = delay || this.calculateRetryDelay(node.retryConfig, retryCount);

    if (retryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    // Retry execution
    await this.executeNode(context, node);
  }

  /**
   * Calculate retry delay based on backoff strategy
   */
  private calculateRetryDelay(retryConfig?: RetryConfiguration, attempt: number = 1): number {
    if (!retryConfig) return 0;

    const { backoffStrategy, initialDelay, maxDelay, multiplier = 2 } = retryConfig;

    switch (backoffStrategy) {
      case 'fixed':
        return Math.min(initialDelay, maxDelay);
      case 'linear':
        return Math.min(initialDelay * attempt, maxDelay);
      case 'exponential':
        return Math.min(initialDelay * Math.pow(multiplier, attempt - 1), maxDelay);
      case 'random':
        return Math.min(initialDelay + Math.random() * initialDelay, maxDelay);
      default:
        return initialDelay;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new WorkflowError('Operation timed out', 'TIMEOUT'));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Initialize node executors
   */
  private initializeNodeExecutors(): Map<string, NodeExecutor> {
    const executors = new Map<string, NodeExecutor>();

    executors.set('start', new StartNodeExecutor());
    executors.set('end', new EndNodeExecutor());
    executors.set('action', new ActionNodeExecutor());
    executors.set('condition', new ConditionNodeExecutor());
    executors.set('approval', new ApprovalNodeExecutor());
    executors.set('delay', new DelayNodeExecutor());
    executors.set('notification', new NotificationNodeExecutor());
    executors.set('webhook', new WebhookNodeExecutor());
    executors.set('script', new ScriptNodeExecutor());
    executors.set('ml_prediction', new MLPredictionNodeExecutor());
    executors.set('human_task', new HumanTaskNodeExecutor());
    executors.set('loop', new LoopNodeExecutor());
    executors.set('subworkflow', new SubworkflowNodeExecutor());
    executors.set('parallel', new ParallelNodeExecutor());
    executors.set('integration', new IntegrationNodeExecutor());

    return executors;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.eventEmitter.on('workflow_triggered', this.handleWorkflowTriggered.bind(this));
    this.eventEmitter.on('approval_received', this.handleApprovalReceived.bind(this));
    this.eventEmitter.on('timeout_occurred', this.handleTimeoutOccurred.bind(this));
    this.eventEmitter.on('escalation_triggered', this.handleEscalationTriggered.bind(this));
  }

  /**
   * Event handlers
   */
  private async handleWorkflowTriggered(event: WorkflowEvent): Promise<void> {
    // Handle workflow trigger events
  }

  private async handleApprovalReceived(event: WorkflowEvent): Promise<void> {
    const { executionId, stepId, approved } = event.payload;
    if (approved) {
      await this.resumeExecution(executionId, { approvalResult: 'approved' });
    } else {
      await this.cancelExecution(executionId, 'Approval rejected');
    }
  }

  private async handleTimeoutOccurred(event: WorkflowEvent): Promise<void> {
    const { executionId } = event.payload;
    await this.cancelExecution(executionId, 'Execution timed out');
  }

  private async handleEscalationTriggered(event: WorkflowEvent): Promise<void> {
    // Handle escalation events
  }

  /**
   * Utility methods
   */
  private async createExecution(
    workflow: WorkflowDefinition,
    triggerData: Record<string, any>,
    triggerUserId?: number,
    options: ExecutionOptions = {}
  ): Promise<WorkflowExecution> {
    const execution: Partial<WorkflowExecution> = {
      workflowId: workflow.id,
      triggerEntityType: options.entityType || 'manual',
      triggerEntityId: options.entityId,
      triggerUserId,
      triggerData,
      status: 'pending',
      progressPercentage: 0,
      startedAt: new Date(),
      executionLog: [],
      retryCount: 0,
      variables: { ...triggerData },
      metadata: {
        triggeredBy: options.triggeredBy || 'manual',
        environment: options.environment || 'production',
        version: workflow.version.toString(),
        correlationId: options.correlationId || this.generateCorrelationId(),
        parentExecution: options.parentExecutionId,
        childExecutions: [],
        tags: options.tags || [],
      },
    };

    return await this.persistenceAdapter.createExecution(execution as WorkflowExecution);
  }

  private async createStepExecution(
    context: ExecutionContext,
    node: WorkflowNode
  ): Promise<WorkflowStepExecution> {
    const stepExecution: Partial<WorkflowStepExecution> = {
      executionId: context.execution.id,
      stepId: node.id,
      status: 'running',
      startedAt: new Date(),
      retryCount: context.getRetryCount(node.id),
      metadata: {
        retryHistory: [],
        resourceUsage: {
          memoryMB: 0,
          cpuPercent: 0,
          networkKB: 0,
          storageKB: 0,
        },
        additionalData: {},
      },
    };

    return await this.persistenceAdapter.createStepExecution(stepExecution as WorkflowStepExecution);
  }

  private async updateExecutionStatus(
    context: ExecutionContext,
    status: ExecutionStatus
  ): Promise<void> {
    context.execution.status = status;
    await this.persistenceAdapter.updateExecution(context.execution);
  }

  private validateTriggerConditions(
    workflow: WorkflowDefinition,
    triggerData: Record<string, any>
  ): boolean {
    // Implement trigger condition validation
    return true;
  }

  private generateCorrelationId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async emitEvent(type: WorkflowEventType, payload: Record<string, any>): Promise<void> {
    const event: WorkflowEvent = {
      id: this.generateCorrelationId(),
      type,
      timestamp: new Date(),
      payload,
      source: 'workflow_engine',
      metadata: {},
    };

    await this.eventEmitter.emit(type, event);
  }
}

// Supporting Classes and Interfaces

interface ExecutionOptions {
  entityType?: string;
  entityId?: number;
  triggeredBy?: string;
  environment?: string;
  correlationId?: string;
  parentExecutionId?: number;
  tags?: string[];
}

interface ExecutionStatusResponse {
  status: ExecutionStatus;
  progress: number;
  currentStep?: string;
  variables: Record<string, any>;
  logs: ExecutionLogEntry[];
  error?: string;
}

interface NodeExecutionResult {
  action: 'continue' | 'wait' | 'complete' | 'fail' | 'retry' | 'branch' | 'parallel';
  outputData?: Record<string, any>;
  errorMessage?: string;
  targetNodeId?: string;
  parallelNodeIds?: string[];
  retryDelay?: number;
}

abstract class NodeExecutor {
  abstract execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult>;
}

class ExecutionContext {
  private variables: Record<string, any> = {};
  private retryCounters: Map<string, number> = new Map();
  private cancelled = false;
  private cancellationReason?: string;

  constructor(
    public execution: WorkflowExecution,
    public workflow: WorkflowDefinition,
    private eventEmitter: WorkflowEventEmitter
  ) {
    this.variables = { ...execution.variables };
  }

  getVariables(): Record<string, any> {
    return { ...this.variables };
  }

  setVariables(variables: Record<string, any>): void {
    this.variables = { ...this.variables, ...variables };
  }

  getVariable(name: string): any {
    return this.variables[name];
  }

  setVariable(name: string, value: any): void {
    this.variables[name] = value;
  }

  getRetryCount(nodeId: string): number {
    return this.retryCounters.get(nodeId) || 0;
  }

  incrementRetryCount(nodeId: string): number {
    const current = this.retryCounters.get(nodeId) || 0;
    const newCount = current + 1;
    this.retryCounters.set(nodeId, newCount);
    return newCount;
  }

  getCurrentNode(): WorkflowNode | undefined {
    if (!this.execution.currentStepId) return undefined;
    return this.workflow.nodes.find(n => n.id === this.execution.currentStepId);
  }

  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: Record<string, any>): void {
    const logEntry: ExecutionLogEntry = {
      stepId: this.execution.currentStepId || 'system',
      timestamp: new Date(),
      level,
      message,
      data,
    };

    this.execution.executionLog.push(logEntry);
  }

  cancel(reason: string): void {
    this.cancelled = true;
    this.cancellationReason = reason;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  getCancellationReason(): string | undefined {
    return this.cancellationReason;
  }

  createChildContext(): ExecutionContext {
    const childContext = new ExecutionContext(this.execution, this.workflow, this.eventEmitter);
    childContext.variables = { ...this.variables };
    return childContext;
  }
}

class WorkflowEventEmitter {
  private listeners: Map<string, Array<(event: WorkflowEvent) => Promise<void>>> = new Map();

  on(eventType: string, listener: (event: WorkflowEvent) => Promise<void>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  async emit(eventType: string, event: WorkflowEvent): Promise<void> {
    const listeners = this.listeners.get(eventType) || [];
    await Promise.all(listeners.map(listener => listener(event)));
  }
}

class WorkflowError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

// Abstract interfaces for dependencies
interface WorkflowPersistenceAdapter {
  getWorkflowDefinition(id: number): Promise<WorkflowDefinition | null>;
  createExecution(execution: WorkflowExecution): Promise<WorkflowExecution>;
  updateExecution(execution: WorkflowExecution): Promise<void>;
  getExecution(id: number): Promise<WorkflowExecution | null>;
  createStepExecution(stepExecution: WorkflowStepExecution): Promise<WorkflowStepExecution>;
  updateStepExecution(stepExecution: WorkflowStepExecution): Promise<void>;
  incrementWorkflowSuccessCount(workflowId: number): Promise<void>;
  incrementWorkflowFailureCount(workflowId: number): Promise<void>;
}

interface WorkflowQueueManager {
  enqueue(job: any): Promise<void>;
  process(handler: (job: any) => Promise<void>): void;
}

interface WorkflowMetricsCollector {
  recordExecutionStart(workflowId: number, duration: number): void;
  recordExecutionSuccess(workflowId: number): void;
  recordExecutionFailure(workflowId: number, error: string): void;
  recordExecutionError(workflowId: number, error: string): void;
}

// Example node executors (placeholder implementations)
class StartNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    return { action: 'continue' };
  }
}

class EndNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    return { action: 'complete' };
  }
}

class ActionNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement action execution logic
    return { action: 'continue' };
  }
}

class ConditionNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement condition evaluation logic
    return { action: 'continue' };
  }
}

class ApprovalNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement approval logic
    return { action: 'wait' };
  }
}

class DelayNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement delay logic
    return { action: 'continue' };
  }
}

class NotificationNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement notification logic
    return { action: 'continue' };
  }
}

class WebhookNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement webhook logic
    return { action: 'continue' };
  }
}

class ScriptNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement script execution logic
    return { action: 'continue' };
  }
}

class MLPredictionNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement ML prediction logic
    return { action: 'continue' };
  }
}

class HumanTaskNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement human task logic
    return { action: 'wait' };
  }
}

class LoopNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement loop logic
    return { action: 'continue' };
  }
}

class SubworkflowNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement subworkflow logic
    return { action: 'continue' };
  }
}

class ParallelNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement parallel execution logic
    return { action: 'continue' };
  }
}

class IntegrationNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    // Implement integration logic
    return { action: 'continue' };
  }
}

export {
  WorkflowEngine,
  WorkflowError,
  ExecutionContext,
  NodeExecutor,
  type ExecutionOptions,
  type ExecutionStatusResponse,
  type NodeExecutionResult,
};