/**
 * Datadog Distributed Tracing
 * Tracer customizado para monitorar operações críticas
 */

import { trace, context, SpanStatusCode } from '@opentelemetry/api';

// Nome do serviço
const SERVICE_NAME = process.env.DD_SERVICE || 'servicedesk';
const ENV = process.env.DD_ENV || process.env.NODE_ENV || 'development';
const VERSION = process.env.DD_VERSION || '1.0.0';

// Tags globais
const GLOBAL_TAGS = {
  service: SERVICE_NAME,
  env: ENV,
  version: VERSION,
};

// Interface para atributos de span
export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

// Interface para contexto de trace
export interface TraceContext {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  userId?: number;
  organizationId?: number;
  tenantSlug?: string;
  requestId?: string;
}

/**
 * Classe para gerenciar traces do Datadog
 */
export class DatadogTracer {
  private tracer;
  private serviceName: string;

  constructor(serviceName: string = SERVICE_NAME) {
    this.serviceName = serviceName;
    this.tracer = trace.getTracer(serviceName);
  }

  /**
   * Criar um novo span
   */
  createSpan(
    name: string,
    attributes: SpanAttributes = {},
    parentContext?: any
  ) {
    const ctx = parentContext || context.active();
    const span = this.tracer.startSpan(
      name,
      {
        attributes: {
          ...GLOBAL_TAGS,
          ...attributes,
        },
      },
      ctx
    );

    return span;
  }

  /**
   * Executar função com trace
   */
  async trace<T>(
    operationName: string,
    fn: (span: any) => Promise<T>,
    attributes: SpanAttributes = {}
  ): Promise<T> {
    const span = this.createSpan(operationName, attributes);

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        async () => {
          return await fn(span);
        }
      );

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Executar função síncrona com trace
   */
  traceSync<T>(
    operationName: string,
    fn: (span: any) => T,
    attributes: SpanAttributes = {}
  ): T {
    const span = this.createSpan(operationName, attributes);

    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Adicionar tags ao span atual
   */
  setTags(tags: SpanAttributes) {
    const span = trace.getSpan(context.active());
    if (span) {
      Object.entries(tags).forEach(([key, value]) => {
        if (value !== undefined) {
          span.setAttribute(key, value);
        }
      });
    }
  }

  /**
   * Adicionar evento ao span atual
   */
  addEvent(name: string, attributes?: SpanAttributes) {
    const span = trace.getSpan(context.active());
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Registrar erro no span atual
   */
  recordError(error: Error, attributes?: SpanAttributes) {
    const span = trace.getSpan(context.active());
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          if (value !== undefined) {
            span.setAttribute(key, value);
          }
        });
      }
    }
  }

  /**
   * Obter contexto do span atual
   */
  getCurrentContext(): TraceContext {
    const span = trace.getSpan(context.active());
    if (!span) {
      return {};
    }

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };
  }

  /**
   * Criar child span
   */
  createChildSpan(name: string, attributes: SpanAttributes = {}) {
    return this.createSpan(name, attributes, context.active());
  }
}

// Instância global do tracer
export const ddTracer = new DatadogTracer();

/**
 * Decorator para trace automático de métodos
 */
export function Trace(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const spanName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      return await ddTracer.trace(
        spanName,
        async (span) => {
          span.setAttribute('method', propertyKey);
          span.setAttribute('class', target.constructor.name);
          return await originalMethod.apply(this, args);
        }
      );
    };

    return descriptor;
  };
}

/**
 * Decorator para trace de métodos síncronos
 */
export function TraceSync(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const spanName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = function (...args: any[]) {
      return ddTracer.traceSync(
        spanName,
        (span) => {
          span.setAttribute('method', propertyKey);
          span.setAttribute('class', target.constructor.name);
          return originalMethod.apply(this, args);
        }
      );
    };

    return descriptor;
  };
}

export default ddTracer;
