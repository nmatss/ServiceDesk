/**
 * Base class for all integration connectors.
 * Provides standardized retry, circuit breaker, logging, and health check patterns.
 */

import logger from '@/lib/monitoring/structured-logger';
import crypto from 'crypto';

export interface ConnectorHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  latencyMs?: number;
  message?: string;
}

export interface OperationContext {
  correlationId: string;
  organizationId: number;
  userId?: number;
  operation: string;
}

export abstract class BaseConnector {
  protected name: string;
  protected consecutiveFailures = 0;
  protected circuitOpen = false;
  protected circuitOpenedAt: Date | null = null;
  protected readonly maxFailures = 5;
  protected readonly circuitResetMs = 60_000; // 1 minute

  constructor(name: string) {
    this.name = name;
  }

  /** Generate a correlation ID for request tracing */
  protected generateCorrelationId(): string {
    return `${this.name}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /** Execute an operation with retry and circuit breaker */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: OperationContext,
    options?: { maxRetries?: number; timeoutMs?: number }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const timeoutMs = options?.timeoutMs ?? 30_000;

    // Circuit breaker check
    if (this.circuitOpen) {
      const elapsed = Date.now() - (this.circuitOpenedAt?.getTime() || 0);
      if (elapsed < this.circuitResetMs) {
        throw new Error(
          `Circuit breaker aberto para ${this.name} — tente novamente em ${Math.ceil((this.circuitResetMs - elapsed) / 1000)}s`
        );
      }
      // Half-open: allow one attempt
      this.circuitOpen = false;
      logger.info(`Circuit breaker half-open para ${this.name}`, { correlationId: context.correlationId });
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.logOperation(context, 'start', { attempt });

        // Timeout wrapper
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout após ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);

        // Success — reset circuit breaker
        this.consecutiveFailures = 0;
        this.logOperation(context, 'success', { attempt });
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logOperation(context, 'error', { attempt, error: lastError.message });

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 4s, 16s
          const delay = Math.pow(4, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed — update circuit breaker
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxFailures) {
      this.circuitOpen = true;
      this.circuitOpenedAt = new Date();
      logger.error(
        `Circuit breaker ABERTO para ${this.name} após ${this.maxFailures} falhas consecutivas`
      );
    }

    throw lastError || new Error(`${this.name}: operação falhou após ${maxRetries + 1} tentativas`);
  }

  /** Structured logging with correlation ID */
  protected logOperation(
    context: OperationContext,
    status: 'start' | 'success' | 'error',
    meta?: Record<string, unknown>
  ): void {
    const logData = {
      connector: this.name,
      correlationId: context.correlationId,
      organizationId: context.organizationId,
      operation: context.operation,
      ...meta,
    };

    if (status === 'error') {
      logger.error(`[${this.name}] ${context.operation} falhou`, logData);
    } else if (status === 'start') {
      logger.debug(`[${this.name}] ${context.operation} iniciado`, logData);
    } else {
      logger.info(`[${this.name}] ${context.operation} concluído`, logData);
    }
  }

  /** Mask sensitive values in objects for logging */
  protected maskSensitive(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys =
      /password|secret|token|key|credential|api_key|apikey|auth|authorization/i;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      result[k] = sensitiveKeys.test(k) ? '***' : v;
    }
    return result;
  }

  /** Abstract: implement health check per connector */
  abstract healthCheck(): Promise<ConnectorHealth>;

  /** Get circuit breaker status */
  getCircuitStatus(): { open: boolean; failures: number; openedAt: Date | null } {
    return {
      open: this.circuitOpen,
      failures: this.consecutiveFailures,
      openedAt: this.circuitOpenedAt,
    };
  }
}
