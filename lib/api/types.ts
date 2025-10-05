/**
 * Enterprise API Types
 * Comprehensive type definitions for API layer
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Base API Response Structure
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ResponseMeta
  links?: ResponseLinks
}

// Error Structure
export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: string
  path: string
  requestId: string
}

// Response Metadata
export interface ResponseMeta {
  pagination?: PaginationMeta
  cache?: CacheMeta
  timing?: TimingMeta
  version: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface CacheMeta {
  cached: boolean
  ttl?: number
  key?: string
  createdAt?: string
}

export interface TimingMeta {
  processTime: number
  dbTime?: number
  cacheTime?: number
}

// Response Links (HATEOAS)
export interface ResponseLinks {
  self: string
  next?: string
  prev?: string
  first?: string
  last?: string
}

// API Handler Types
export type ApiHandler = (
  req: NextRequest,
  context?: ApiContext
) => Promise<NextResponse>

export interface ApiContext {
  params?: Record<string, string>
  user?: AuthenticatedUser
  requestId: string
  startTime: number
  version: string
}

// Authentication Types
export interface AuthenticatedUser {
  id: number
  email: string
  name: string
  role: 'admin' | 'agent' | 'user'
  permissions: string[]
  sessionId?: string
}

// Rate Limiting Types
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

// Cache Types
export interface CacheOptions {
  ttl?: number
  key?: string
  tags?: string[]
  namespace?: string
}

// Validation Types
export interface ValidationResult {
  success: boolean
  data?: any
  errors?: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
  value?: any
}

// Webhook Types
export interface WebhookEvent {
  id: string
  type: string
  data: Record<string, any>
  timestamp: string
  version: string
  source: string
}

export interface WebhookEndpoint {
  id: string
  url: string
  events: string[]
  secret: string
  active: boolean
  createdAt: string
  lastDelivery?: string
}

export interface WebhookDelivery {
  id: string
  endpointId: string
  eventId: string
  status: 'pending' | 'success' | 'failed' | 'retry'
  attempts: number
  response?: {
    status: number
    body: string
    headers: Record<string, string>
  }
  createdAt: string
  deliveredAt?: string
}

// Event Types
export interface SystemEvent {
  id: string
  type: string
  source: string
  data: Record<string, any>
  userId?: number
  sessionId?: string
  timestamp: string
  correlationId?: string
}

// Integration Types
export interface IntegrationConfig {
  name: string
  type: 'oauth2' | 'api_key' | 'basic_auth' | 'bearer_token'
  credentials: Record<string, any>
  endpoints: Record<string, string>
  settings: Record<string, any>
  active: boolean
}

// API Versioning Types
export interface ApiVersion {
  version: string
  deprecated: boolean
  deprecationDate?: string
  supportEndDate?: string
  changes: string[]
}

// Request/Response Schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export const SearchSchema = z.object({
  q: z.string().min(1).max(200),
  fields: z.string().optional(),
  filters: z.record(z.any()).optional(),
})

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const SlugParamSchema = z.object({
  slug: z.string().min(1).max(100),
})

// HTTP Method Types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'

// Middleware Types
export type ApiMiddleware = (
  req: NextRequest,
  context: ApiContext,
  next: () => Promise<NextResponse>
) => Promise<NextResponse>

// Error Codes
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource Management
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Server Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Business Logic
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',
  SLA_VIOLATION = 'SLA_VIOLATION',

  // Integration
  WEBHOOK_DELIVERY_FAILED = 'WEBHOOK_DELIVERY_FAILED',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  API_VERSION_DEPRECATED = 'API_VERSION_DEPRECATED',
}

// HTTP Status Codes Mapping
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS]

// Request Context Type Guards
export function isAuthenticated(context: ApiContext): context is ApiContext & { user: AuthenticatedUser } {
  return !!context.user
}

export function hasRole(context: ApiContext, role: string): boolean {
  return context.user?.role === role
}

export function hasPermission(context: ApiContext, permission: string): boolean {
  return context.user?.permissions.includes(permission) ?? false
}