/**
 * Common Test Utilities and Helpers
 * General-purpose testing utilities used across the test suite
 */

import { expect } from 'vitest'

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number
    interval?: number
    message?: string
  }
): Promise<void> {
  const timeout = options?.timeout || 5000
  const interval = options?.interval || 100
  const message = options?.message || 'Condition not met within timeout'

  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await sleep(interval)
  }

  throw new Error(message)
}

/**
 * Execute a promise with a timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms)
    )
  ])
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    retries?: number
    delay?: number
    backoff?: number
  }
): Promise<T> {
  const maxRetries = options?.retries || 3
  const initialDelay = options?.delay || 100
  const backoffMultiplier = options?.backoff || 2

  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempt)
        await sleep(delay)
      }
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Create a spy/mock function
 */
export interface MockFn<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>
  calls: Array<Parameters<T>>
  results: Array<ReturnType<T>>
  mockReturnValue: (value: ReturnType<T>) => void
  mockImplementation: (fn: T) => void
  reset: () => void
}

export function createMockFn<T extends (...args: any[]) => any>(
  implementation?: T
): MockFn<T> {
  const calls: Array<Parameters<T>> = []
  const results: Array<ReturnType<T>> = []
  let currentImplementation = implementation
  let returnValue: ReturnType<T> | undefined

  const mockFn = ((...args: Parameters<T>) => {
    calls.push(args)

    if (returnValue !== undefined) {
      results.push(returnValue)
      return returnValue
    }

    if (currentImplementation) {
      const result = currentImplementation(...args)
      results.push(result)
      return result
    }

    return undefined
  }) as MockFn<T>

  mockFn.calls = calls
  mockFn.results = results
  mockFn.mockReturnValue = (value: ReturnType<T>) => {
    returnValue = value
  }
  mockFn.mockImplementation = (fn: T) => {
    currentImplementation = fn
  }
  mockFn.reset = () => {
    calls.length = 0
    results.length = 0
    returnValue = undefined
  }

  return mockFn
}

/**
 * Generate random test data
 */
export const randomData = {
  string: (length = 10): string => {
    return Math.random().toString(36).substring(2, 2 + length)
  },

  email: (): string => {
    return `test-${randomData.string(8)}@example.com`
  },

  number: (min = 0, max = 100): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  boolean: (): boolean => {
    return Math.random() > 0.5
  },

  date: (): Date => {
    const start = new Date(2020, 0, 1)
    const end = new Date()
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  },

  uuid: (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  },

  array: <T>(generator: () => T, length = 5): T[] => {
    return Array.from({ length }, generator)
  }
}

/**
 * Assert that a value matches a schema
 */
export function assertSchema<T>(
  value: unknown,
  schema: Record<string, any>
): asserts value is T {
  for (const [key, type] of Object.entries(schema)) {
    expect(value).toHaveProperty(key)

    if (typeof type === 'string') {
      expect(typeof (value as any)[key]).toBe(type)
    } else if (typeof type === 'function') {
      expect(type((value as any)[key])).toBe(true)
    }
  }
}

/**
 * Assert API response structure
 */
export interface ApiResponse {
  success?: boolean
  data?: any
  error?: any
  message?: string
}

export function assertApiSuccess(response: any): asserts response is ApiResponse {
  expect(response).toHaveProperty('success')
  expect(response.success).toBe(true)
}

export function assertApiError(response: any): asserts response is ApiResponse {
  expect(response).toHaveProperty('success')
  expect(response.success).toBe(false)
  expect(response).toHaveProperty('error')
}

/**
 * Test error handling
 */
export async function expectToThrow(
  fn: () => any | Promise<any>,
  errorMessage?: string | RegExp
): Promise<void> {
  try {
    await fn()
    throw new Error('Expected function to throw but it did not')
  } catch (error) {
    if (error instanceof Error && error.message === 'Expected function to throw but it did not') {
      throw error
    }

    if (errorMessage) {
      if (typeof errorMessage === 'string') {
        expect((error as Error).message).toContain(errorMessage)
      } else {
        expect((error as Error).message).toMatch(errorMessage)
      }
    }
  }
}

/**
 * Create a test date (fixed for consistency)
 */
export function testDate(offset = 0): Date {
  const baseDate = new Date('2024-01-01T00:00:00.000Z')
  return new Date(baseDate.getTime() + offset)
}

/**
 * Format date for database
 */
export function formatDbDate(date: Date): string {
  return date.toISOString()
}

/**
 * Parse database date
 */
export function parseDbDate(dateStr: string): Date {
  return new Date(dateStr)
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Compare objects ignoring specific fields
 */
export function compareObjectsIgnoring<T extends Record<string, any>>(
  obj1: T,
  obj2: T,
  ignoreFields: string[]
): boolean {
  const filtered1 = { ...obj1 }
  const filtered2 = { ...obj2 }

  for (const field of ignoreFields) {
    delete filtered1[field]
    delete filtered2[field]
  }

  return JSON.stringify(filtered1) === JSON.stringify(filtered2)
}

/**
 * Test environment helpers
 */
export const env = {
  get: (key: string): string | undefined => {
    return process.env[key]
  },

  set: (key: string, value: string): void => {
    process.env[key] = value
  },

  delete: (key: string): void => {
    delete process.env[key]
  },

  withEnv: async <T>(
    vars: Record<string, string>,
    fn: () => T | Promise<T>
  ): Promise<T> => {
    const original: Record<string, string | undefined> = {}

    // Save original values
    for (const [key, value] of Object.entries(vars)) {
      original[key] = process.env[key]
      process.env[key] = value
    }

    try {
      return await fn()
    } finally {
      // Restore original values
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
    }
  }
}

/**
 * File system helpers for tests
 */
export const fs = {
  createTempFile: (content: string, extension = 'txt'): string => {
    const tmpPath = require('path').join(
      require('os').tmpdir(),
      `test-${Date.now()}.${extension}`
    )
    require('fs').writeFileSync(tmpPath, content)
    return tmpPath
  },

  removeTempFile: (path: string): void => {
    try {
      require('fs').unlinkSync(path)
    } catch {
      // Ignore errors
    }
  },

  withTempFile: async <T>(
    content: string,
    fn: (path: string) => T | Promise<T>,
    extension = 'txt'
  ): Promise<T> => {
    const path = fs.createTempFile(content, extension)
    try {
      return await fn(path)
    } finally {
      fs.removeTempFile(path)
    }
  }
}

/**
 * Console output capture
 */
export class ConsoleCapture {
  private logs: string[] = []
  private errors: string[] = []
  private warns: string[] = []
  private originalLog: typeof console.log
  private originalError: typeof console.error
  private originalWarn: typeof console.warn

  constructor() {
    this.originalLog = console.log
    this.originalError = console.error
    this.originalWarn = console.warn
  }

  start(): void {
    this.logs = []
    this.errors = []
    this.warns = []

    console.log = (...args: any[]) => {
      this.logs.push(args.join(' '))
    }

    console.error = (...args: any[]) => {
      this.errors.push(args.join(' '))
    }

    console.warn = (...args: any[]) => {
      this.warns.push(args.join(' '))
    }
  }

  stop(): void {
    console.log = this.originalLog
    console.error = this.originalError
    console.warn = this.originalWarn
  }

  getLogs(): string[] {
    return [...this.logs]
  }

  getErrors(): string[] {
    return [...this.errors]
  }

  getWarns(): string[] {
    return [...this.warns]
  }

  clear(): void {
    this.logs = []
    this.errors = []
    this.warns = []
  }
}

/**
 * Performance measurement
 */
export class PerformanceTimer {
  private startTime: number = 0
  private measurements: Map<string, number[]> = new Map()

  start(): void {
    this.startTime = Date.now()
  }

  end(label?: string): number {
    const duration = Date.now() - this.startTime

    if (label) {
      if (!this.measurements.has(label)) {
        this.measurements.set(label, [])
      }
      this.measurements.get(label)!.push(duration)
    }

    return duration
  }

  measure<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    this.start()
    const result = fn()

    if (result instanceof Promise) {
      return result.finally(() => this.end(label))
    }

    this.end(label)
    return Promise.resolve(result)
  }

  getStats(label: string): {
    count: number
    total: number
    average: number
    min: number
    max: number
  } | null {
    const measurements = this.measurements.get(label)
    if (!measurements || measurements.length === 0) {
      return null
    }

    const total = measurements.reduce((sum, m) => sum + m, 0)
    const average = total / measurements.length
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)

    return {
      count: measurements.length,
      total,
      average,
      min,
      max
    }
  }

  clear(): void {
    this.measurements.clear()
  }
}

/**
 * Create a performance timer instance
 */
export function createTimer(): PerformanceTimer {
  return new PerformanceTimer()
}
