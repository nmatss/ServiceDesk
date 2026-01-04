#!/usr/bin/env tsx
/**
 * Production Health Check Script
 *
 * Automated script to check the health of the production ServiceDesk application.
 * Runs comprehensive checks on all critical endpoints and services.
 *
 * Usage:
 *   npm run check:health
 *   tsx scripts/check-production-health.ts
 *   tsx scripts/check-production-health.ts --url https://your-domain.com
 */

interface CheckResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  duration: number
  message?: string
  details?: any
}

interface HealthCheckResponse {
  status: string
  timestamp: string
  uptime: number
  checks: Record<string, any>
  version?: string
}

// Configuration
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const TIMEOUT = 10000 // 10 seconds
const SLOW_THRESHOLD = 2000 // 2 seconds

// Parse command line arguments
const args = process.argv.slice(2)
const urlArg = args.find((arg) => arg.startsWith('--url='))
const BASE_URL = urlArg ? urlArg.replace('--url=', '') : DEFAULT_BASE_URL

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Check health endpoint
 */
async function checkHealth(): Promise<CheckResult> {
  const start = Date.now()
  const url = `${BASE_URL}/api/health`

  try {
    const response = await fetchWithTimeout(url)
    const duration = Date.now() - start
    const data: HealthCheckResponse = await response.json()

    if (response.ok && data.status === 'healthy') {
      return {
        name: 'Health Check',
        status: 'pass',
        duration,
        message: `Application is healthy (uptime: ${Math.floor(data.uptime)}s)`,
        details: data,
      }
    } else if (response.ok && data.status === 'degraded') {
      return {
        name: 'Health Check',
        status: 'warn',
        duration,
        message: 'Application is degraded',
        details: data,
      }
    } else {
      return {
        name: 'Health Check',
        status: 'fail',
        duration,
        message: `Health check failed: ${data.status}`,
        details: data,
      }
    }
  } catch (error) {
    return {
      name: 'Health Check',
      status: 'fail',
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : 'Health check failed',
    }
  }
}

/**
 * Check specific endpoint
 */
async function checkEndpoint(name: string, path: string, expectedStatus: number = 200): Promise<CheckResult> {
  const start = Date.now()
  const url = `${BASE_URL}${path}`

  try {
    const response = await fetchWithTimeout(url)
    const duration = Date.now() - start

    if (response.status === expectedStatus) {
      const status = duration > SLOW_THRESHOLD ? 'warn' : 'pass'
      return {
        name,
        status,
        duration,
        message: `Status: ${response.status}${duration > SLOW_THRESHOLD ? ' (SLOW)' : ''}`,
      }
    } else {
      return {
        name,
        status: 'fail',
        duration,
        message: `Expected ${expectedStatus}, got ${response.status}`,
      }
    }
  } catch (error) {
    return {
      name,
      status: 'fail',
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : 'Request failed',
    }
  }
}

/**
 * Check API endpoint with authentication
 */
async function checkAPIEndpoint(
  name: string,
  path: string,
  method: string = 'GET',
  expectedStatus: number = 200
): Promise<CheckResult> {
  const start = Date.now()
  const url = `${BASE_URL}${path}`

  try {
    const response = await fetchWithTimeout(url, { method })
    const duration = Date.now() - start

    // Accept both success and auth required (401)
    const acceptableStatuses = [expectedStatus, 401, 403]

    if (acceptableStatuses.includes(response.status)) {
      const status = duration > SLOW_THRESHOLD ? 'warn' : 'pass'
      return {
        name,
        status,
        duration,
        message: `Status: ${response.status}${duration > SLOW_THRESHOLD ? ' (SLOW)' : ''}`,
      }
    } else {
      return {
        name,
        status: 'fail',
        duration,
        message: `Unexpected status: ${response.status}`,
      }
    }
  } catch (error) {
    return {
      name,
      status: 'fail',
      duration: Date.now() - start,
      message: error instanceof Error ? error.message : 'Request failed',
    }
  }
}

/**
 * Print result with color
 */
function printResult(result: CheckResult): void {
  const statusIcon = result.status === 'pass' ? '✓' : result.status === 'warn' ? '⚠' : '✗'
  const statusColor = result.status === 'pass' ? colors.green : result.status === 'warn' ? colors.yellow : colors.red

  console.log(
    `${statusColor}${statusIcon}${colors.reset} ${result.name}: ${result.message || result.status} ${colors.cyan}(${result.duration}ms)${colors.reset}`
  )

  if (result.details && process.env.VERBOSE) {
    console.log(`  ${colors.magenta}Details:${colors.reset}`, JSON.stringify(result.details, null, 2))
  }
}

/**
 * Print summary
 */
function printSummary(results: CheckResult[]): void {
  const passed = results.filter((r) => r.status === 'pass').length
  const warned = results.filter((r) => r.status === 'warn').length
  const failed = results.filter((r) => r.status === 'fail').length
  const total = results.length

  console.log('\n' + '='.repeat(60))
  console.log(`${colors.blue}SUMMARY${colors.reset}`)
  console.log('='.repeat(60))
  console.log(`${colors.green}Passed:${colors.reset} ${passed}/${total}`)
  console.log(`${colors.yellow}Warnings:${colors.reset} ${warned}/${total}`)
  console.log(`${colors.red}Failed:${colors.reset} ${failed}/${total}`)

  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
  console.log(`${colors.cyan}Average Response Time:${colors.reset} ${avgDuration.toFixed(2)}ms`)

  const slowRequests = results.filter((r) => r.duration > SLOW_THRESHOLD)
  if (slowRequests.length > 0) {
    console.log(`\n${colors.yellow}Slow Requests (>${SLOW_THRESHOLD}ms):${colors.reset}`)
    slowRequests.forEach((r) => {
      console.log(`  • ${r.name}: ${r.duration}ms`)
    })
  }

  const failedRequests = results.filter((r) => r.status === 'fail')
  if (failedRequests.length > 0) {
    console.log(`\n${colors.red}Failed Checks:${colors.reset}`)
    failedRequests.forEach((r) => {
      console.log(`  • ${r.name}: ${r.message}`)
    })
  }

  console.log('='.repeat(60))

  // Exit with error if any checks failed
  if (failed > 0) {
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.blue}===========================================${colors.reset}`)
  console.log(`${colors.blue}  ServiceDesk Production Health Check${colors.reset}`)
  console.log(`${colors.blue}===========================================${colors.reset}`)
  console.log(`${colors.cyan}Target:${colors.reset} ${BASE_URL}`)
  console.log(`${colors.cyan}Timeout:${colors.reset} ${TIMEOUT}ms`)
  console.log(`${colors.cyan}Time:${colors.reset} ${new Date().toISOString()}`)
  console.log()

  const results: CheckResult[] = []

  // Core health check
  console.log(`${colors.magenta}Core Services${colors.reset}`)
  results.push(await checkHealth())

  // Public endpoints
  console.log(`\n${colors.magenta}Public Endpoints${colors.reset}`)
  results.push(await checkEndpoint('Landing Page', '/'))
  results.push(await checkEndpoint('Login Page', '/auth/login'))
  results.push(await checkEndpoint('Portal', '/portal'))

  // API endpoints
  console.log(`\n${colors.magenta}API Endpoints${colors.reset}`)
  results.push(await checkAPIEndpoint('Statuses API', '/api/statuses'))
  results.push(await checkAPIEndpoint('Priorities API', '/api/priorities'))
  results.push(await checkAPIEndpoint('Categories API', '/api/categories'))
  results.push(await checkAPIEndpoint('Ticket Types API', '/api/ticket-types'))

  // Health endpoints
  console.log(`\n${colors.magenta}Health Endpoints${colors.reset}`)
  results.push(await checkEndpoint('Health', '/api/health'))
  results.push(await checkEndpoint('Health Ready', '/api/health/ready'))
  results.push(await checkEndpoint('Health Live', '/api/health/live'))
  results.push(await checkEndpoint('Health Startup', '/api/health/startup'))

  // Print results
  console.log()
  results.forEach(printResult)

  // Print summary
  printSummary(results)
}

// Run the checks
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error)
  process.exit(1)
})
