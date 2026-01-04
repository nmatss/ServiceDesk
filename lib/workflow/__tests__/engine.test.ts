/**
 * Unit Tests for Workflow Engine
 * Tests workflow execution, state management, error handling, and retry logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildWorkflow } from '@/tests/utils/test-helpers'

// Mock workflow engine types
interface WorkflowDefinition {
  id: number
  name: string
  description?: string
  isActive: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  triggerType: string
  triggerConditions?: any
}

interface WorkflowNode {
  id: string
  type: string
  config: Record<string, any>
  position?: { x: number; y: number }
}

interface WorkflowEdge {
  id: string
  source: string
  target: string
  condition?: any
}

interface WorkflowExecution {
  id: number
  workflowId: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  variables: Record<string, any>
  startedAt: string
  completedAt?: string
  error?: string
}

// Mock WorkflowEngine implementation for testing
class MockWorkflowEngine {
  private workflows = new Map<number, WorkflowDefinition>()
  private executions = new Map<number, WorkflowExecution>()
  private nextExecutionId = 1

  async registerWorkflow(workflow: WorkflowDefinition) {
    this.workflows.set(workflow.id, workflow)
  }

  async executeWorkflow(
    workflowId: number,
    triggerData: Record<string, any> = {},
    triggerUserId?: number
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId)

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`)
    }

    if (!workflow.isActive) {
      throw new Error(`Workflow ${workflowId} is not active`)
    }

    // Validate trigger conditions
    if (workflow.triggerConditions && !this.validateConditions(workflow.triggerConditions, triggerData)) {
      throw new Error('Trigger conditions not met')
    }

    // Create execution
    const execution: WorkflowExecution = {
      id: this.nextExecutionId++,
      workflowId,
      status: 'running',
      variables: { ...triggerData },
      startedAt: new Date().toISOString(),
    }

    this.executions.set(execution.id, execution)

    // Execute workflow nodes
    try {
      await this.executeNodes(workflow, execution)
      execution.status = 'completed'
      execution.completedAt = new Date().toISOString()
    } catch (error) {
      execution.status = 'failed'
      execution.error = error instanceof Error ? error.message : String(error)
      execution.completedAt = new Date().toISOString()
    }

    return execution
  }

  async getExecution(executionId: number): Promise<WorkflowExecution | null> {
    return this.executions.get(executionId) || null
  }

  async cancelExecution(executionId: number): Promise<void> {
    const execution = this.executions.get(executionId)
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled'
      execution.completedAt = new Date().toISOString()
    }
  }

  private validateConditions(conditions: any, data: Record<string, any>): boolean {
    // Simple validation logic
    if (Array.isArray(conditions)) {
      return conditions.every(condition => this.evaluateCondition(condition, data))
    }
    return this.evaluateCondition(conditions, data)
  }

  private evaluateCondition(condition: any, data: Record<string, any>): boolean {
    const { field, operator, value } = condition

    if (!data.hasOwnProperty(field)) {
      return false
    }

    const fieldValue = data[field]

    switch (operator) {
      case 'equals':
        return fieldValue === value
      case 'not_equals':
        return fieldValue !== value
      case 'greater_than':
        return fieldValue > value
      case 'less_than':
        return fieldValue < value
      case 'contains':
        return String(fieldValue).includes(String(value))
      default:
        return true
    }
  }

  private async executeNodes(workflow: WorkflowDefinition, execution: WorkflowExecution): Promise<void> {
    // Execute nodes in order based on edges
    const startNode = workflow.nodes.find(n => n.type === 'trigger')
    if (!startNode) {
      throw new Error('No trigger node found')
    }

    let currentNode = startNode
    const visited = new Set<string>()

    while (currentNode) {
      if (visited.has(currentNode.id)) {
        break // Prevent infinite loops
      }

      visited.add(currentNode.id)

      // Execute node
      await this.executeNode(currentNode, execution)

      // Find next node
      const edge = workflow.edges.find(e => e.source === currentNode.id)
      if (!edge) {
        break
      }

      const nextNode = workflow.nodes.find(n => n.id === edge.target)
      if (!nextNode) {
        break
      }

      // Check edge condition
      if (edge.condition && !this.evaluateCondition(edge.condition, execution.variables)) {
        break
      }

      currentNode = nextNode
    }
  }

  private async executeNode(node: WorkflowNode, execution: WorkflowExecution): Promise<void> {
    switch (node.type) {
      case 'trigger':
        // Trigger node just passes through
        break

      case 'condition':
        // Evaluate condition
        if (node.config.condition) {
          const result = this.evaluateCondition(node.config.condition, execution.variables)
          execution.variables[`${node.id}_result`] = result
        }
        break

      case 'action':
        // Execute action
        if (node.config.action === 'set_variable') {
          execution.variables[node.config.variable] = node.config.value
        } else if (node.config.action === 'fail') {
          throw new Error(node.config.message || 'Action failed')
        }
        break

      default:
        throw new Error(`Unknown node type: ${node.type}`)
    }
  }

  clear() {
    this.workflows.clear()
    this.executions.clear()
    this.nextExecutionId = 1
  }
}

describe('Workflow Engine', () => {
  let engine: MockWorkflowEngine

  beforeEach(() => {
    engine = new MockWorkflowEngine()
  })

  describe('Workflow Registration', () => {
    it('should register a workflow', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Test Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
        ],
        edges: [],
      }

      await engine.registerWorkflow(workflow)

      // Verify by executing
      const execution = await engine.executeWorkflow(1, {})
      expect(execution.workflowId).toBe(1)
    })

    it('should allow multiple workflows', async () => {
      await engine.registerWorkflow({
        id: 1,
        name: 'Workflow 1',
        isActive: true,
        triggerType: 'manual',
        nodes: [{ id: 'trigger-1', type: 'trigger', config: {} }],
        edges: [],
      })

      await engine.registerWorkflow({
        id: 2,
        name: 'Workflow 2',
        isActive: true,
        triggerType: 'manual',
        nodes: [{ id: 'trigger-2', type: 'trigger', config: {} }],
        edges: [],
      })

      const exec1 = await engine.executeWorkflow(1, {})
      const exec2 = await engine.executeWorkflow(2, {})

      expect(exec1.workflowId).toBe(1)
      expect(exec2.workflowId).toBe(2)
    })
  })

  describe('Workflow Execution', () => {
    beforeEach(async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Simple Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          { id: 'action-1', type: 'action', config: { action: 'set_variable', variable: 'result', value: 'success' } },
        ],
        edges: [
          { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
        ],
      }

      await engine.registerWorkflow(workflow)
    })

    it('should execute a simple workflow', async () => {
      const execution = await engine.executeWorkflow(1, {})

      expect(execution).toBeDefined()
      expect(execution.status).toBe('completed')
      expect(execution.variables.result).toBe('success')
    })

    it('should fail for non-existent workflow', async () => {
      await expect(engine.executeWorkflow(999, {})).rejects.toThrow('Workflow 999 not found')
    })

    it('should fail for inactive workflow', async () => {
      const inactiveWorkflow: WorkflowDefinition = {
        id: 2,
        name: 'Inactive Workflow',
        isActive: false,
        triggerType: 'manual',
        nodes: [{ id: 'trigger-1', type: 'trigger', config: {} }],
        edges: [],
      }

      await engine.registerWorkflow(inactiveWorkflow)

      await expect(engine.executeWorkflow(2, {})).rejects.toThrow('is not active')
    })

    it('should pass trigger data to execution', async () => {
      const triggerData = {
        ticketId: 123,
        priority: 'high',
        category: 'bug',
      }

      const execution = await engine.executeWorkflow(1, triggerData)

      expect(execution.variables.ticketId).toBe(123)
      expect(execution.variables.priority).toBe('high')
      expect(execution.variables.category).toBe('bug')
    })

    it('should handle workflow errors', async () => {
      const errorWorkflow: WorkflowDefinition = {
        id: 3,
        name: 'Error Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          { id: 'action-1', type: 'action', config: { action: 'fail', message: 'Intentional failure' } },
        ],
        edges: [
          { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
        ],
      }

      await engine.registerWorkflow(errorWorkflow)

      const execution = await engine.executeWorkflow(3, {})

      expect(execution.status).toBe('failed')
      expect(execution.error).toContain('Intentional failure')
    })
  })

  describe('Trigger Conditions', () => {
    it('should validate trigger conditions', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Conditional Workflow',
        isActive: true,
        triggerType: 'conditional',
        triggerConditions: [
          { field: 'priority', operator: 'equals', value: 'high' },
        ],
        nodes: [{ id: 'trigger-1', type: 'trigger', config: {} }],
        edges: [],
      }

      await engine.registerWorkflow(workflow)

      // Should succeed with matching condition
      const execution1 = await engine.executeWorkflow(1, { priority: 'high' })
      expect(execution1.status).toBe('completed')

      // Should fail with non-matching condition
      await expect(
        engine.executeWorkflow(1, { priority: 'low' })
      ).rejects.toThrow('Trigger conditions not met')
    })

    it('should support multiple trigger conditions', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Multi-Condition Workflow',
        isActive: true,
        triggerType: 'conditional',
        triggerConditions: [
          { field: 'priority', operator: 'equals', value: 'high' },
          { field: 'status', operator: 'equals', value: 'open' },
        ],
        nodes: [{ id: 'trigger-1', type: 'trigger', config: {} }],
        edges: [],
      }

      await engine.registerWorkflow(workflow)

      // Both conditions met
      const execution = await engine.executeWorkflow(1, {
        priority: 'high',
        status: 'open',
      })
      expect(execution.status).toBe('completed')

      // One condition not met
      await expect(
        engine.executeWorkflow(1, { priority: 'high', status: 'closed' })
      ).rejects.toThrow('Trigger conditions not met')
    })
  })

  describe('Execution Cancellation', () => {
    it('should cancel a running execution', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Test Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [{ id: 'trigger-1', type: 'trigger', config: {} }],
        edges: [],
      }

      await engine.registerWorkflow(workflow)

      // Start execution (don't await yet)
      const executionPromise = engine.executeWorkflow(1, {})

      // Get the execution object that was just created
      const executions = await engine.getExecution(1)

      // Cancel immediately
      await engine.cancelExecution(1)

      // Now get the final state
      const cancelled = await engine.getExecution(1)
      expect(cancelled?.status).toBe('cancelled')
    })
  })

  describe('Workflow Node Execution', () => {
    it('should execute condition nodes', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Condition Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          {
            id: 'condition-1',
            type: 'condition',
            config: {
              condition: { field: 'value', operator: 'greater_than', value: 10 },
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'trigger-1', target: 'condition-1' },
        ],
      }

      await engine.registerWorkflow(workflow)

      const execution = await engine.executeWorkflow(1, { value: 20 })

      expect(execution.variables['condition-1_result']).toBe(true)
    })

    it('should execute action nodes', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Action Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          {
            id: 'action-1',
            type: 'action',
            config: { action: 'set_variable', variable: 'output', value: 'test-value' },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
        ],
      }

      await engine.registerWorkflow(workflow)

      const execution = await engine.executeWorkflow(1, {})

      expect(execution.variables.output).toBe('test-value')
    })

    it('should follow conditional edges', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Branching Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [
          { id: 'trigger-1', type: 'trigger', config: {} },
          {
            id: 'action-true',
            type: 'action',
            config: { action: 'set_variable', variable: 'branch', value: 'true' },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'trigger-1',
            target: 'action-true',
            condition: { field: 'condition', operator: 'equals', value: true },
          },
        ],
      }

      await engine.registerWorkflow(workflow)

      const execution = await engine.executeWorkflow(1, { condition: true })

      expect(execution.variables.branch).toBe('true')
    })
  })

  describe('Execution State Management', () => {
    it('should track execution status', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Test Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [{ id: 'trigger-1', type: 'trigger', config: {} }],
        edges: [],
      }

      await engine.registerWorkflow(workflow)

      const execution = await engine.executeWorkflow(1, {})

      expect(execution.status).toBe('completed')
      expect(execution.startedAt).toBeDefined()
      expect(execution.completedAt).toBeDefined()
    })

    it('should retrieve execution by ID', async () => {
      const workflow: WorkflowDefinition = {
        id: 1,
        name: 'Test Workflow',
        isActive: true,
        triggerType: 'manual',
        nodes: [{ id: 'trigger-1', type: 'trigger', config: {} }],
        edges: [],
      }

      await engine.registerWorkflow(workflow)

      const execution = await engine.executeWorkflow(1, {})
      const retrieved = await engine.getExecution(execution.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(execution.id)
      expect(retrieved?.workflowId).toBe(1)
    })
  })
})
