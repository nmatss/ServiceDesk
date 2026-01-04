/**
 * Unit tests for testHelpers utilities
 * Verifies general test helper functions work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  sleep,
  waitFor,
  withTimeout,
  retry,
  createMockFn,
  randomData,
  assertSchema,
  assertApiSuccess,
  assertApiError,
  expectToThrow,
  testDate,
  formatDbDate,
  parseDbDate,
  deepClone,
  compareObjectsIgnoring,
  env,
  ConsoleCapture,
  PerformanceTimer,
  createTimer,
} from '../testHelpers'

describe('testHelpers - Async Utilities', () => {
  it('should sleep for specified time', async () => {
    const start = Date.now()
    await sleep(100)
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(90)
    expect(elapsed).toBeLessThan(200)
  })

  it('should wait for condition to be true', async () => {
    let counter = 0

    const condition = () => {
      counter++
      return counter >= 3
    }

    await waitFor(condition, { interval: 10 })

    expect(counter).toBeGreaterThanOrEqual(3)
  })

  it('should timeout if condition not met', async () => {
    const condition = () => false

    await expect(
      waitFor(condition, { timeout: 100, interval: 10 })
    ).rejects.toThrow()
  })

  it('should execute promise with timeout', async () => {
    const promise = sleep(50).then(() => 'success')

    const result = await withTimeout(promise, 100)
    expect(result).toBe('success')
  })

  it('should timeout slow promise', async () => {
    const promise = sleep(200).then(() => 'success')

    await expect(withTimeout(promise, 50)).rejects.toThrow(/timeout/)
  })
})

describe('testHelpers - Retry Logic', () => {
  it('should retry failed operations', async () => {
    let attempts = 0

    const fn = async () => {
      attempts++
      if (attempts < 3) {
        throw new Error('Failed')
      }
      return 'success'
    }

    const result = await retry(fn, { retries: 3, delay: 10 })

    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })

  it('should throw after max retries', async () => {
    const fn = async () => {
      throw new Error('Always fails')
    }

    await expect(retry(fn, { retries: 2, delay: 10 })).rejects.toThrow('Always fails')
  })
})

describe('testHelpers - Mock Functions', () => {
  it('should create a mock function', () => {
    const mockFn = createMockFn()

    expect(mockFn).toBeDefined()
    expect(typeof mockFn).toBe('function')
  })

  it('should track function calls', () => {
    const mockFn = createMockFn<(a: number, b: number) => number>()

    mockFn(1, 2)
    mockFn(3, 4)

    expect(mockFn.calls).toHaveLength(2)
    expect(mockFn.calls[0]).toEqual([1, 2])
    expect(mockFn.calls[1]).toEqual([3, 4])
  })

  it('should mock return value', () => {
    const mockFn = createMockFn<() => string>()
    mockFn.mockReturnValue('test')

    expect(mockFn()).toBe('test')
    expect(mockFn.results).toEqual(['test'])
  })

  it('should mock implementation', () => {
    const mockFn = createMockFn<(a: number, b: number) => number>()
    mockFn.mockImplementation((a, b) => a + b)

    expect(mockFn(2, 3)).toBe(5)
    expect(mockFn(10, 20)).toBe(30)
  })

  it('should reset mock function', () => {
    const mockFn = createMockFn<() => string>()
    mockFn.mockReturnValue('test')

    mockFn()
    mockFn()

    expect(mockFn.calls).toHaveLength(2)

    mockFn.reset()

    expect(mockFn.calls).toHaveLength(0)
    expect(mockFn.results).toHaveLength(0)
  })
})

describe('testHelpers - Random Data Generation', () => {
  it('should generate random string', () => {
    const str1 = randomData.string(10)
    const str2 = randomData.string(10)

    expect(str1).toHaveLength(10)
    expect(str2).toHaveLength(10)
    expect(str1).not.toBe(str2)
  })

  it('should generate random email', () => {
    const email = randomData.email()

    expect(email).toContain('@example.com')
    expect(email).toMatch(/^test-[a-z0-9]+@example\.com$/)
  })

  it('should generate random number', () => {
    const num = randomData.number(1, 10)

    expect(num).toBeGreaterThanOrEqual(1)
    expect(num).toBeLessThanOrEqual(10)
  })

  it('should generate random boolean', () => {
    const bool = randomData.boolean()
    expect(typeof bool).toBe('boolean')
  })

  it('should generate random date', () => {
    const date = randomData.date()
    expect(date instanceof Date).toBe(true)
  })

  it('should generate random UUID', () => {
    const uuid = randomData.uuid()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('should generate random array', () => {
    const arr = randomData.array(() => randomData.number(1, 10), 5)

    expect(arr).toHaveLength(5)
    expect(arr.every(n => n >= 1 && n <= 10)).toBe(true)
  })
})

describe('testHelpers - Schema Assertions', () => {
  it('should validate object schema', () => {
    const obj = {
      id: 1,
      name: 'Test',
      email: 'test@example.com',
    }

    expect(() => {
      assertSchema(obj, {
        id: 'number',
        name: 'string',
        email: 'string',
      })
    }).not.toThrow()
  })

  it('should assert API success response', () => {
    const response = { success: true, data: { id: 1 } }

    expect(() => assertApiSuccess(response)).not.toThrow()
  })

  it('should assert API error response', () => {
    const response = { success: false, error: 'Something went wrong' }

    expect(() => assertApiError(response)).not.toThrow()
  })
})

describe('testHelpers - Error Handling', () => {
  it('should expect function to throw', async () => {
    const fn = () => {
      throw new Error('Test error')
    }

    await expectToThrow(fn, 'Test error')
  })

  it('should expect async function to throw', async () => {
    const fn = async () => {
      throw new Error('Async error')
    }

    await expectToThrow(fn, 'Async error')
  })

  it('should fail if function does not throw', async () => {
    const fn = () => 'success'

    await expect(expectToThrow(fn)).rejects.toThrow('Expected function to throw')
  })
})

describe('testHelpers - Date Utilities', () => {
  it('should create consistent test date', () => {
    const date1 = testDate()
    const date2 = testDate()

    expect(date1.getTime()).toBe(date2.getTime())
  })

  it('should create test date with offset', () => {
    const base = testDate()
    const offset = testDate(1000)

    expect(offset.getTime() - base.getTime()).toBe(1000)
  })

  it('should format date for database', () => {
    const date = new Date('2024-01-01T12:00:00.000Z')
    const formatted = formatDbDate(date)

    expect(formatted).toBe('2024-01-01T12:00:00.000Z')
  })

  it('should parse database date', () => {
    const dateStr = '2024-01-01T12:00:00.000Z'
    const parsed = parseDbDate(dateStr)

    expect(parsed instanceof Date).toBe(true)
    expect(parsed.toISOString()).toBe(dateStr)
  })
})

describe('testHelpers - Object Utilities', () => {
  it('should deep clone object', () => {
    const obj = { a: 1, b: { c: 2 } }
    const cloned = deepClone(obj)

    expect(cloned).toEqual(obj)
    expect(cloned).not.toBe(obj)
    expect(cloned.b).not.toBe(obj.b)
  })

  it('should compare objects ignoring fields', () => {
    const obj1 = { id: 1, name: 'Test', createdAt: '2024-01-01' }
    const obj2 = { id: 1, name: 'Test', createdAt: '2024-01-02' }

    expect(compareObjectsIgnoring(obj1, obj2, ['createdAt'])).toBe(true)
    expect(compareObjectsIgnoring(obj1, obj2, [])).toBe(false)
  })
})

describe('testHelpers - Environment Variables', () => {
  it('should get environment variable', () => {
    process.env.TEST_VAR = 'test-value'
    expect(env.get('TEST_VAR')).toBe('test-value')
  })

  it('should set environment variable', () => {
    env.set('TEST_VAR_2', 'value')
    expect(process.env.TEST_VAR_2).toBe('value')
  })

  it('should delete environment variable', () => {
    env.set('TEST_VAR_3', 'value')
    env.delete('TEST_VAR_3')
    expect(process.env.TEST_VAR_3).toBeUndefined()
  })

  it('should execute with temporary env vars', async () => {
    const original = process.env.TEMP_VAR

    await env.withEnv({ TEMP_VAR: 'temp-value' }, () => {
      expect(process.env.TEMP_VAR).toBe('temp-value')
    })

    expect(process.env.TEMP_VAR).toBe(original)
  })
})

describe('testHelpers - Console Capture', () => {
  let capture: ConsoleCapture

  beforeEach(() => {
    capture = new ConsoleCapture()
  })

  it('should capture console.log', () => {
    capture.start()
    console.log('test message')
    capture.stop()

    expect(capture.getLogs()).toContain('test message')
  })

  it('should capture console.error', () => {
    capture.start()
    console.error('error message')
    capture.stop()

    expect(capture.getErrors()).toContain('error message')
  })

  it('should capture console.warn', () => {
    capture.start()
    console.warn('warning message')
    capture.stop()

    expect(capture.getWarns()).toContain('warning message')
  })

  it('should clear captured output', () => {
    capture.start()
    console.log('test')
    capture.clear()
    capture.stop()

    expect(capture.getLogs()).toHaveLength(0)
  })
})

describe('testHelpers - Performance Timer', () => {
  it('should measure execution time', async () => {
    const timer = createTimer()

    timer.start()
    await sleep(50)
    const duration = timer.end()

    expect(duration).toBeGreaterThanOrEqual(40)
  })

  it('should measure labeled operations', async () => {
    const timer = createTimer()

    timer.start()
    await sleep(50)
    timer.end('test-operation')

    const stats = timer.getStats('test-operation')

    expect(stats).toBeDefined()
    expect(stats!.count).toBe(1)
    expect(stats!.total).toBeGreaterThanOrEqual(40)
  })

  it('should measure function execution', async () => {
    const timer = createTimer()

    await timer.measure('test', async () => {
      await sleep(50)
    })

    const stats = timer.getStats('test')
    expect(stats!.count).toBe(1)
  })

  it('should calculate statistics', async () => {
    const timer = createTimer()

    for (let i = 0; i < 5; i++) {
      timer.start()
      await sleep(10)
      timer.end('multi-test')
    }

    const stats = timer.getStats('multi-test')

    expect(stats).toBeDefined()
    expect(stats!.count).toBe(5)
    expect(stats!.average).toBeGreaterThan(0)
    expect(stats!.min).toBeLessThanOrEqual(stats!.max)
  })
})
