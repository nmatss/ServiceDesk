/**
 * Workflow Metrics Collector
 * Collects and aggregates workflow execution metrics
 */

import logger from '@/lib/monitoring/structured-logger';

interface WorkflowMetrics {
  workflowId: number;
  executionCount: number;
  successCount: number;
  failureCount: number;
  totalExecutionTime: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  errorsByType: Map<string, number>;
  lastExecutedAt?: Date;
}

export class WorkflowMetricsCollector {
  private metrics: Map<number, WorkflowMetrics> = new Map();
  private executionTimes: Map<number, number[]> = new Map();

  /**
   * Record execution start
   */
  recordExecutionStart(workflowId: number, duration: number): void {
    const metrics = this.getOrCreateMetrics(workflowId);
    metrics.executionCount++;
    metrics.lastExecutedAt = new Date();

    logger.debug('Execution started', { workflowId, duration });
  }

  /**
   * Record execution success
   */
  recordExecutionSuccess(workflowId: number): void {
    const metrics = this.getOrCreateMetrics(workflowId);
    metrics.successCount++;

    logger.debug('Execution succeeded', { workflowId });
  }

  /**
   * Record execution failure
   */
  recordExecutionFailure(workflowId: number, error: string): void {
    const metrics = this.getOrCreateMetrics(workflowId);
    metrics.failureCount++;

    // Track error types
    const errorType = this.categorizeError(error);
    const errorCount = metrics.errorsByType.get(errorType) || 0;
    metrics.errorsByType.set(errorType, errorCount + 1);

    logger.debug('Execution failed', { workflowId, error });
  }

  /**
   * Record execution error
   */
  recordExecutionError(workflowId: number, error: string): void {
    this.recordExecutionFailure(workflowId, error);
  }

  /**
   * Record execution time
   */
  recordExecutionTime(workflowId: number, executionTimeMs: number): void {
    const metrics = this.getOrCreateMetrics(workflowId);
    const times = this.executionTimes.get(workflowId) || [];

    times.push(executionTimeMs);
    this.executionTimes.set(workflowId, times);

    metrics.totalExecutionTime += executionTimeMs;
    metrics.avgExecutionTime = metrics.totalExecutionTime / metrics.executionCount;
    metrics.minExecutionTime = Math.min(metrics.minExecutionTime || Infinity, executionTimeMs);
    metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime || 0, executionTimeMs);

    logger.debug('Execution time recorded', { workflowId, executionTimeMs });
  }

  /**
   * Get metrics for a workflow
   */
  getMetrics(workflowId: number): WorkflowMetrics | undefined {
    return this.metrics.get(workflowId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<number, WorkflowMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(workflowId: number): {
    executionCount: number;
    successRate: number;
    failureRate: number;
    avgExecutionTime: number;
    p50ExecutionTime: number;
    p95ExecutionTime: number;
    p99ExecutionTime: number;
  } | null {
    const metrics = this.metrics.get(workflowId);
    if (!metrics) {
      return null;
    }

    const times = this.executionTimes.get(workflowId) || [];
    const sortedTimes = times.slice().sort((a, b) => a - b);

    const successRate =
      metrics.executionCount > 0 ? (metrics.successCount / metrics.executionCount) * 100 : 0;
    const failureRate =
      metrics.executionCount > 0 ? (metrics.failureCount / metrics.executionCount) * 100 : 0;

    return {
      executionCount: metrics.executionCount,
      successRate,
      failureRate,
      avgExecutionTime: metrics.avgExecutionTime,
      p50ExecutionTime: this.percentile(sortedTimes, 50),
      p95ExecutionTime: this.percentile(sortedTimes, 95),
      p99ExecutionTime: this.percentile(sortedTimes, 99),
    };
  }

  /**
   * Clear metrics for a workflow
   */
  clearMetrics(workflowId: number): void {
    this.metrics.delete(workflowId);
    this.executionTimes.delete(workflowId);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.executionTimes.clear();
  }

  /**
   * Get or create metrics for a workflow
   */
  private getOrCreateMetrics(workflowId: number): WorkflowMetrics {
    let metrics = this.metrics.get(workflowId);

    if (!metrics) {
      metrics = {
        workflowId,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        totalExecutionTime: 0,
        avgExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        errorsByType: new Map(),
      };
      this.metrics.set(workflowId, metrics);
    }

    return metrics;
  }

  /**
   * Categorize error for tracking
   */
  private categorizeError(error: string): string {
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('network')) return 'network';
    if (error.includes('validation')) return 'validation';
    if (error.includes('permission')) return 'permission';
    return 'unknown';
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] ?? 0;
  }
}

export default WorkflowMetricsCollector;
