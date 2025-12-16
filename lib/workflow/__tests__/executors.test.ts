/**
 * Tests for workflow node executors
 */

import {
  ConditionNodeExecutor,
  NotificationNodeExecutor,
  WebhookNodeExecutor,
  ActionNodeExecutor,
  DelayNodeExecutor,
} from '../executors';
import { WorkflowNode } from '@/lib/types/workflow';
import { ExecutionContext } from '../engine';

describe('ConditionNodeExecutor', () => {
  it('should evaluate equals condition correctly', async () => {
    const executor = new ConditionNodeExecutor();
    const node: WorkflowNode = {
      id: 'test-node',
      type: 'condition',
      name: 'Test Condition',
      position: { x: 0, y: 0 },
      configuration: {
        field: 'status',
        operator: 'equals',
        value: 'open',
      },
    };

    // Mock context
    const mockContext = {
      getVariables: () => ({ status: 'open' }),
      setVariables: jest.fn(),
    } as any;

    const result = await executor.execute(node, mockContext);

    expect(result.action).toBe('continue');
    expect(result.outputData?.conditionResult).toBe(true);
  });

  it('should evaluate greater_than condition correctly', async () => {
    const executor = new ConditionNodeExecutor();
    const node: WorkflowNode = {
      id: 'test-node',
      type: 'condition',
      name: 'Test Condition',
      position: { x: 0, y: 0 },
      configuration: {
        field: 'priority',
        operator: 'greater_than',
        value: 2,
      },
    };

    const mockContext = {
      getVariables: () => ({ priority: 3 }),
      setVariables: jest.fn(),
    } as any;

    const result = await executor.execute(node, mockContext);

    expect(result.action).toBe('continue');
    expect(result.outputData?.conditionResult).toBe(true);
  });

  it('should evaluate contains condition correctly', async () => {
    const executor = new ConditionNodeExecutor();
    const node: WorkflowNode = {
      id: 'test-node',
      type: 'condition',
      name: 'Test Condition',
      position: { x: 0, y: 0 },
      configuration: {
        field: 'title',
        operator: 'contains',
        value: 'bug',
      },
    };

    const mockContext = {
      getVariables: () => ({ title: 'Fix bug in login' }),
      setVariables: jest.fn(),
    } as any;

    const result = await executor.execute(node, mockContext);

    expect(result.action).toBe('continue');
    expect(result.outputData?.conditionResult).toBe(true);
  });
});

describe('DelayNodeExecutor', () => {
  it('should delay execution for specified duration', async () => {
    const executor = new DelayNodeExecutor();
    const node: WorkflowNode = {
      id: 'test-node',
      type: 'delay',
      name: 'Test Delay',
      position: { x: 0, y: 0 },
      configuration: {
        duration: 100,
        unit: 'milliseconds',
      },
    };

    const mockContext = {} as any;

    const startTime = Date.now();
    const result = await executor.execute(node, mockContext);
    const endTime = Date.now();

    expect(result.action).toBe('continue');
    expect(result.outputData?.delayCompleted).toBe(true);
    expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some variance
  });
});

describe('WebhookNodeExecutor', () => {
  it('should make HTTP request to webhook URL', async () => {
    const executor = new WebhookNodeExecutor();
    const node: WorkflowNode = {
      id: 'test-node',
      type: 'webhook',
      name: 'Test Webhook',
      position: { x: 0, y: 0 },
      configuration: {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: { test: 'data' },
      },
    };

    const mockContext = {
      getVariables: () => ({ ticketId: 123 }),
      setVariables: jest.fn(),
    } as any;

    const result = await executor.execute(node, mockContext);

    expect(result.action).toBe('continue');
    expect(result.outputData?.webhookSuccess).toBeDefined();
  }, 10000); // Increase timeout for network request
});
