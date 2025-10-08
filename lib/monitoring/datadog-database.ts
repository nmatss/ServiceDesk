/**
 * Datadog Database Query Tracing
 * Wraps SQLite queries with distributed tracing spans
 */

import Database from 'better-sqlite3'
import { getTracer } from './datadog-config'

/**
 * Trace a database query operation
 */
export async function traceQuery<T>(
  queryText: string,
  operation: () => T,
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' = 'OTHER'
): Promise<T> {
  const tracer = getTracer()
  const span = tracer.startSpan('sqlite.query', {
    resource: queryText.substring(0, 100), // Limit query length
    tags: {
      'db.system': 'sqlite',
      'db.statement': queryText,
      'db.type': type,
      'span.kind': 'client',
      'component': 'better-sqlite3',
    },
  })

  const startTime = Date.now()

  return tracer.scope().activate(span, async () => {
    try {
      const result = await Promise.resolve(operation())

      const duration = Date.now() - startTime
      span.setTag('db.duration_ms', duration)
      span.setTag('success', true)

      return result
    } catch (error) {
      span.setTag('error', true)
      span.setTag('error.type', error instanceof Error ? error.name : 'Error')
      span.setTag('error.message', error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      span.finish()
    }
  })
}

/**
 * Wrap a Database.Statement to automatically trace all executions
 */
export class TracedStatement<T = any> {
  constructor(
    private statement: Database.Statement,
    private queryText: string,
    private queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
  ) {}

  get(...params: any[]): T | undefined {
    return traceQuery(
      this.queryText,
      () => this.statement.get(...params) as T | undefined,
      this.queryType
    ) as T | undefined
  }

  all(...params: any[]): T[] {
    return traceQuery(
      this.queryText,
      () => this.statement.all(...params) as T[],
      this.queryType
    ) as T[]
  }

  run(...params: any[]): Database.RunResult {
    return traceQuery(
      this.queryText,
      () => this.statement.run(...params),
      this.queryType
    ) as Database.RunResult
  }

  iterate(...params: any[]): IterableIterator<T> {
    return this.statement.iterate(...params)
  }

  finalize(): void {
    this.statement.finalize()
  }
}

/**
 * Wrap a Database instance to automatically trace all queries
 */
export class TracedDatabase {
  constructor(private db: Database.Database) {}

  prepare(sql: string): TracedStatement {
    const queryType = this.detectQueryType(sql)
    const statement = this.db.prepare(sql)
    return new TracedStatement(statement, sql, queryType)
  }

  exec(sql: string): this {
    traceQuery(sql, () => this.db.exec(sql), this.detectQueryType(sql))
    return this
  }

  pragma(source: string, options?: Database.PragmaOptions): any {
    return traceQuery(
      `PRAGMA ${source}`,
      () => this.db.pragma(source, options),
      'OTHER'
    )
  }

  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    const tracer = getTracer()

    return (...args: any[]): T => {
      const span = tracer.startSpan('sqlite.transaction', {
        resource: 'transaction',
        tags: {
          'db.system': 'sqlite',
          'span.kind': 'client',
        },
      })

      return tracer.scope().activate(span, () => {
        try {
          const transactionFn = this.db.transaction(fn)
          const result = transactionFn(...args)
          span.setTag('success', true)
          return result
        } catch (error) {
          span.setTag('error', true)
          span.setTag('error.type', error instanceof Error ? error.name : 'Error')
          span.setTag('error.message', error instanceof Error ? error.message : String(error))
          throw error
        } finally {
          span.finish()
        }
      })
    }
  }

  close(): void {
    this.db.close()
  }

  get inTransaction(): boolean {
    return this.db.inTransaction
  }

  private detectQueryType(sql: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' {
    const normalized = sql.trim().toUpperCase()
    if (normalized.startsWith('SELECT')) return 'SELECT'
    if (normalized.startsWith('INSERT')) return 'INSERT'
    if (normalized.startsWith('UPDATE')) return 'UPDATE'
    if (normalized.startsWith('DELETE')) return 'DELETE'
    return 'OTHER'
  }
}

/**
 * Create a traced database connection
 */
export function createTracedDatabase(db: Database.Database): TracedDatabase {
  return new TracedDatabase(db)
}
