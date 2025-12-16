/**
 * Workflow Queue Manager
 * Simple in-memory queue for workflow execution
 * Can be extended to use Bull/Redis for production
 */

import logger from '@/lib/monitoring/structured-logger';

interface QueueJob {
  id: string;
  type: string;
  data: any;
  retries: number;
  maxRetries: number;
  createdAt: Date;
}

export class WorkflowQueueManager {
  private queue: QueueJob[] = [];
  private processing: Map<string, boolean> = new Map();
  private processingLocks: Map<string, boolean> = new Map();
  private handlers: Map<string, (job: QueueJob) => Promise<void>> = new Map();

  /**
   * Enqueue a job
   */
  async enqueue(job: Omit<QueueJob, 'id' | 'createdAt' | 'retries'>): Promise<void> {
    const queueJob: QueueJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retries: 0,
      createdAt: new Date(),
    };

    this.queue.push(queueJob);
    logger.info('Job enqueued', { jobId: queueJob.id, type: queueJob.type });

    // Start processing if not already processing
    if (!this.processing.get(job.type)) {
      this.processQueue(job.type);
    }
  }

  /**
   * Register a job handler
   */
  process(type: string, handler: (job: any) => Promise<void>): void {
    this.handlers.set(type, handler as any);
  }

  /**
   * Process queue for a specific job type
   */
  private async processQueue(type: string): Promise<void> {
    // Usar lock atômico
    if (this.processingLocks.get(type)) {
      return;
    }

    this.processingLocks.set(type, true);

    try {
      while (true) {
        const job = this.queue.find((j) => j.type === type && !this.processing.has(j.id));

        if (!job) {
          break;
        }

        this.processing.set(job.id, true);

        try {
          const handler = this.handlers.get(type);
          if (handler) {
            await handler(job);
            this.removeJob(job.id);
            logger.info('Job completed', { jobId: job.id, type: job.type });
          } else {
            logger.warn('No handler registered for job type', { type });
            this.removeJob(job.id);
          }
        } catch (error: any) {
          logger.error('Job execution failed', { jobId: job.id, error: error.message });

          job.retries++;
          if (job.retries >= job.maxRetries) {
            logger.error('Job max retries exceeded', { jobId: job.id });
            this.removeJob(job.id);
          }
        } finally {
          this.processing.delete(job.id);
        }
      }
    } finally {
      this.processingLocks.set(type, false);
    }
  }

  /**
   * Remove job from queue
   */
  private removeJob(jobId: string): void {
    const index = this.queue.findIndex((j) => j.id === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Get queue stats
   */
  getStats(): {
    queueSize: number;
    processing: number;
    handlers: number;
  } {
    return {
      queueSize: this.queue.length,
      processing: Array.from(this.processing.values()).filter(Boolean).length,
      handlers: this.handlers.size,
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
    this.processing.clear();
  }
}

export default WorkflowQueueManager;
