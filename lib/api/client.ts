/**
 * Optimized API Client
 * High-performance fetch wrapper with caching, deduplication, and retry logic
 */

import { LRUCache } from 'lru-cache'

// ===========================
// TYPES
// ===========================

export interface ApiClientOptions extends Omit<RequestInit, 'cache'> {
  /**
   * Enable response caching
   * @default true
   */
  cache?: boolean

  /**
   * Cache TTL in milliseconds
   * @default 60000 (1 minute)
   */
  cacheTTL?: number

  /**
   * Retry failed requests
   * @default true
   */
  retry?: boolean

  /**
   * Number of retry attempts
   * @default 3
   */
  retryAttempts?: number

  /**
   * Retry delay in milliseconds
   * @default 1000
   */
  retryDelay?: number

  /**
   * Timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number

  /**
   * Enable request deduplication
   * @default true
   */
  deduplicate?: boolean

  /**
   * Custom error handler
   */
  onError?: (error: Error) => void

  /**
   * Custom success handler
   */
  onSuccess?: (data: any) => void
}

interface CachedResponse {
  data: any
  timestamp: number
  etag?: string
}

// ===========================
// CACHE SETUP
// ===========================

// LRU cache for API responses
const responseCache = new LRUCache<string, CachedResponse>({
  max: 500, // Maximum 500 cached responses
  ttl: 1000 * 60, // 1 minute default TTL
  updateAgeOnGet: true,
  updateAgeOnHas: false,
})

// Inflight requests map for deduplication
const inflightRequests = new Map<string, Promise<any>>()

// ===========================
// UTILITIES
// ===========================

/**
 * Generate cache key from URL and options
 */
function getCacheKey(url: string, options?: ApiClientOptions): string {
  const method = options?.method || 'GET'
  const body = options?.body ? JSON.stringify(options.body) : ''
  return `${method}:${url}:${body}`
}

/**
 * Check if response is cacheable
 */
function isCacheable(method: string, status: number): boolean {
  // Only cache successful GET requests
  return method === 'GET' && status >= 200 && status < 300
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exponential backoff delay
 */
function getBackoffDelay(attempt: number, baseDelay: number): number {
  return baseDelay * Math.pow(2, attempt - 1)
}

// ===========================
// API CLIENT
// ===========================

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public response?: Response
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Optimized fetch wrapper with caching and retry logic
 */
async function fetchWithRetry(
  url: string,
  options: ApiClientOptions,
  attempt: number = 1
): Promise<Response> {
  const {
    retry = true,
    retryAttempts = 3,
    retryDelay = 1000,
    timeout = 30000,
    cache: _cache,
    cacheTTL: _cacheTTL,
    deduplicate: _deduplicate,
    onError: _onError,
    ...fetchOptions
  } = options

  try {
    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Retry on 5xx errors
    if (response.status >= 500 && retry && attempt < retryAttempts) {
      const delay = getBackoffDelay(attempt, retryDelay)
      console.warn(
        `[ApiClient] Request failed with ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${retryAttempts})`,
        url
      )
      await sleep(delay)
      return fetchWithRetry(url, options, attempt + 1)
    }

    return response
  } catch (error) {
    // Retry on network errors
    if (retry && attempt < retryAttempts) {
      const delay = getBackoffDelay(attempt, retryDelay)
      console.warn(
        `[ApiClient] Network error, retrying in ${delay}ms (attempt ${attempt}/${retryAttempts})`,
        error
      )
      await sleep(delay)
      return fetchWithRetry(url, options, attempt + 1)
    }

    throw error
  }
}

/**
 * Main API client function
 */
export async function apiClient<T = any>(
  url: string,
  options: ApiClientOptions = {}
): Promise<T> {
  const {
    cache = true,
    cacheTTL = 60000,
    deduplicate = true,
    onError,
    onSuccess,
    ...fetchOptions
  } = options

  const method = fetchOptions.method || 'GET'
  const cacheKey = getCacheKey(url, fetchOptions)

  // Check cache for GET requests
  if (method === 'GET' && cache) {
    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      console.log('[ApiClient] Cache hit:', url)
      return cached.data as T
    }
  }

  // Deduplicate inflight requests
  if (deduplicate && inflightRequests.has(cacheKey)) {
    console.log('[ApiClient] Deduplicating request:', url)
    return inflightRequests.get(cacheKey) as Promise<T>
  }

  // Create request promise
  const requestPromise = (async () => {
    try {
      // Perform request with retry logic
      const response = await fetchWithRetry(url, fetchOptions)

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = new ApiError(
          errorData.message || `Request failed with status ${response.status}`,
          response.status,
          response.statusText,
          response
        )

        if (onError) {
          onError(error)
        }

        throw error
      }

      // Parse response
      const contentType = response.headers.get('content-type')
      let data: any

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else if (contentType?.includes('text/')) {
        data = await response.text()
      } else {
        data = await response.blob()
      }

      // Cache successful GET responses
      if (isCacheable(method, response.status) && cache) {
        responseCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          etag: response.headers.get('etag') || undefined,
        })
      }

      if (onSuccess) {
        onSuccess(data)
      }

      return data as T
    } finally {
      // Remove from inflight requests
      inflightRequests.delete(cacheKey)
    }
  })()

  // Add to inflight requests
  if (deduplicate) {
    inflightRequests.set(cacheKey, requestPromise)
  }

  return requestPromise
}

// ===========================
// CONVENIENCE METHODS
// ===========================

/**
 * GET request
 */
export async function get<T = any>(
  url: string,
  options?: ApiClientOptions
): Promise<T> {
  return apiClient<T>(url, { ...options, method: 'GET' })
}

/**
 * POST request
 */
export async function post<T = any>(
  url: string,
  data?: any,
  options?: ApiClientOptions
): Promise<T> {
  return apiClient<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(data),
    cache: false, // Don't cache POST requests
  })
}

/**
 * PUT request
 */
export async function put<T = any>(
  url: string,
  data?: any,
  options?: ApiClientOptions
): Promise<T> {
  return apiClient<T>(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(data),
    cache: false, // Don't cache PUT requests
  })
}

/**
 * PATCH request
 */
export async function patch<T = any>(
  url: string,
  data?: any,
  options?: ApiClientOptions
): Promise<T> {
  return apiClient<T>(url, {
    ...options,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify(data),
    cache: false, // Don't cache PATCH requests
  })
}

/**
 * DELETE request
 */
export async function del<T = any>(
  url: string,
  options?: ApiClientOptions
): Promise<T> {
  return apiClient<T>(url, {
    ...options,
    method: 'DELETE',
    cache: false, // Don't cache DELETE requests
  })
}

// ===========================
// CACHE MANAGEMENT
// ===========================

/**
 * Clear all cache
 */
export function clearCache(): void {
  responseCache.clear()
  console.log('[ApiClient] Cache cleared')
}

/**
 * Clear cache for specific URL pattern
 */
export function clearCachePattern(pattern: string | RegExp): void {
  const keys = Array.from(responseCache.keys())
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern

  keys.forEach((key) => {
    if (regex.test(key)) {
      responseCache.delete(key)
    }
  })

  console.log('[ApiClient] Cache cleared for pattern:', pattern)
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number
  maxSize: number
  hitRate: number
} {
  return {
    size: responseCache.size,
    maxSize: responseCache.max,
    hitRate: 0, // LRU cache doesn't track hit rate
  }
}

// ===========================
// PREFETCH
// ===========================

/**
 * Prefetch data for future use
 */
export async function prefetch<T = any>(
  url: string,
  options?: ApiClientOptions
): Promise<void> {
  try {
    await apiClient<T>(url, { ...options, cache: true })
    console.log('[ApiClient] Prefetched:', url)
  } catch (error) {
    console.error('[ApiClient] Prefetch failed:', url, error)
  }
}

/**
 * Prefetch multiple URLs
 */
export async function prefetchMultiple(
  urls: string[],
  options?: ApiClientOptions
): Promise<void> {
  await Promise.allSettled(
    urls.map((url) => prefetch(url, options))
  )
}

// ===========================
// EXPORT DEFAULT
// ===========================

export default {
  get,
  post,
  put,
  patch,
  del,
  clearCache,
  clearCachePattern,
  getCacheStats,
  prefetch,
  prefetchMultiple,
}
