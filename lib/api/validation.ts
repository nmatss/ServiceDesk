/**
 * Enhanced Input Validation with Zod Schemas
 * Enterprise-grade validation system for API endpoints
 */

import { z } from 'zod'
import { NextRequest } from 'next/server'
import { ApiContext, ValidationResult, ValidationError } from './types'

// Base validation schemas
export const BaseSchemas = {
  // Pagination
  Pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Search
  Search: z.object({
    q: z.string().min(1).max(200).trim(),
    fields: z.string().optional(),
    filters: z.record(z.any()).optional(),
  }),

  // ID parameter
  IdParam: z.object({
    id: z.coerce.number().int().positive(),
  }),

  // Slug parameter
  SlugParam: z.object({
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  }),

  // Date range
  DateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate)
      }
      return true
    },
    { message: 'Start date must be before or equal to end date' }
  ),

  // Metadata object
  Metadata: z.record(z.any()).optional(),
}

// User validation schemas
export const UserSchemas = {
  // User registration
  Register: z.object({
    name: z.string().min(2).max(100).trim(),
    email: z.string().email().max(254).toLowerCase(),
    password: z.string()
      .min(8)
      .max(128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    role: z.enum(['admin', 'agent', 'user', 'manager', 'read_only', 'api_client']).default('user'),
    timezone: z.string().default('UTC'),
    language: z.string().length(2).default('en'),
  }),

  // User login
  Login: z.object({
    email: z.string().email().max(254).toLowerCase(),
    password: z.string().min(1).max(128),
    rememberMe: z.boolean().default(false),
    twoFactorCode: z.string().length(6).optional(),
  }),

  // Password change
  ChangePassword: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string()
      .min(8)
      .max(128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmPassword: z.string(),
  }).refine(
    (data) => data.newPassword === data.confirmPassword,
    { message: 'Passwords do not match', path: ['confirmPassword'] }
  ),

  // User profile update
  UpdateProfile: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    timezone: z.string().optional(),
    language: z.string().length(2).optional(),
    avatarUrl: z.string().url().optional(),
    metadata: BaseSchemas.Metadata,
  }),

  // Admin user update
  AdminUpdateUser: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    email: z.string().email().max(254).toLowerCase().optional(),
    role: z.enum(['admin', 'agent', 'user', 'manager', 'read_only', 'api_client']).optional(),
    isActive: z.boolean().optional(),
    isEmailVerified: z.boolean().optional(),
    timezone: z.string().optional(),
    language: z.string().length(2).optional(),
  }),
}

// Ticket validation schemas
export const TicketSchemas = {
  // Create ticket
  Create: z.object({
    title: z.string().min(5).max(200).trim(),
    description: z.string().min(10).max(5000).trim(),
    priorityId: z.number().int().positive(),
    categoryId: z.number().int().positive(),
    assignedTo: z.number().int().positive().optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    customFields: z.record(z.any()).optional(),
  }),

  // Update ticket
  Update: z.object({
    title: z.string().min(5).max(200).trim().optional(),
    description: z.string().min(10).max(5000).trim().optional(),
    priorityId: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
    statusId: z.number().int().positive().optional(),
    assignedTo: z.number().int().positive().nullable().optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    customFields: z.record(z.any()).optional(),
  }),

  // Ticket filters
  Filters: z.object({
    status: z.union([z.string(), z.array(z.string())]).optional(),
    priority: z.union([z.string(), z.array(z.string())]).optional(),
    category: z.union([z.string(), z.array(z.string())]).optional(),
    assignedTo: z.union([z.string(), z.array(z.string())]).optional(),
    createdBy: z.union([z.string(), z.array(z.string())]).optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    ...BaseSchemas.DateRange.shape,
  }),

  // Bulk update
  BulkUpdate: z.object({
    ticketIds: z.array(z.number().int().positive()).min(1).max(100),
    updates: z.object({
      statusId: z.number().int().positive().optional(),
      priorityId: z.number().int().positive().optional(),
      categoryId: z.number().int().positive().optional(),
      assignedTo: z.number().int().positive().nullable().optional(),
      tags: z.array(z.string().max(50)).max(10).optional(),
    }),
  }),
}

// Comment validation schemas
export const CommentSchemas = {
  // Create comment
  Create: z.object({
    content: z.string().min(1).max(2000).trim(),
    isInternal: z.boolean().default(false),
    attachments: z.array(z.string().uuid()).max(10).optional(),
  }),

  // Update comment
  Update: z.object({
    content: z.string().min(1).max(2000).trim(),
  }),
}

// File upload validation schemas
export const FileSchemas = {
  // File upload metadata
  Upload: z.object({
    filename: z.string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Filename contains invalid characters'),
    size: z.number().int().min(1).max(50 * 1024 * 1024), // 50MB
    mimeType: z.enum([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-zip-compressed',
    ]),
    checksum: z.string().optional(),
  }),

  // Batch upload
  BatchUpload: z.object({
    files: z.array(z.object({
      filename: z.string().min(1).max(255),
      size: z.number().int().min(1).max(50 * 1024 * 1024),
      mimeType: z.string(),
    })).min(1).max(20),
  }),
}

// Knowledge base validation schemas
export const KnowledgeSchemas = {
  // Create article
  CreateArticle: z.object({
    title: z.string().min(5).max(200).trim(),
    content: z.string().min(50).max(50000).trim(),
    summary: z.string().max(500).trim().optional(),
    categoryId: z.number().int().positive().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    isPublished: z.boolean().default(false),
  }),

  // Update article
  UpdateArticle: z.object({
    title: z.string().min(5).max(200).trim().optional(),
    content: z.string().min(50).max(50000).trim().optional(),
    summary: z.string().max(500).trim().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    isPublished: z.boolean().optional(),
  }),

  // Article feedback
  Feedback: z.object({
    helpful: z.boolean(),
    comment: z.string().max(1000).trim().optional(),
  }),
}

// Admin validation schemas
export const AdminSchemas = {
  // System settings
  UpdateSetting: z.object({
    key: z.string().min(1).max(100),
    value: z.any(),
    description: z.string().max(500).optional(),
    type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
    isPublic: z.boolean().default(false),
  }),

  // SLA policy
  CreateSLAPolicy: z.object({
    name: z.string().min(2).max(100).trim(),
    description: z.string().max(500).trim().optional(),
    priorityId: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
    responseTimeHours: z.number().min(0.1).max(8760), // Max 1 year
    resolutionTimeHours: z.number().min(0.1).max(8760),
    businessHoursOnly: z.boolean().default(true),
    isActive: z.boolean().default(true),
  }),

  // Automation rule
  CreateAutomation: z.object({
    name: z.string().min(2).max(100).trim(),
    description: z.string().max(500).trim().optional(),
    triggerType: z.enum(['ticket_created', 'ticket_updated', 'sla_warning', 'time_based']),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in']),
      value: z.any(),
    })),
    actions: z.array(z.object({
      type: z.enum(['assign', 'change_status', 'change_priority', 'add_comment', 'send_email', 'escalate']),
      parameters: z.record(z.any()),
    })),
    isActive: z.boolean().default(true),
  }),
}

// Webhook validation schemas
export const WebhookSchemas = {
  // Create webhook endpoint
  CreateEndpoint: z.object({
    url: z.string().url().max(2000),
    events: z.array(z.string()).min(1).max(50),
    secret: z.string().min(16).max(128).optional(),
    headers: z.record(z.string()).optional(),
    retryPolicy: z.object({
      maxRetries: z.number().int().min(0).max(10).default(3),
      retryDelay: z.number().int().min(1000).max(3600000).default(5000), // 1s to 1h
    }).optional(),
  }),

  // Update webhook endpoint
  UpdateEndpoint: z.object({
    url: z.string().url().max(2000).optional(),
    events: z.array(z.string()).min(1).max(50).optional(),
    secret: z.string().min(16).max(128).optional(),
    headers: z.record(z.string()).optional(),
    active: z.boolean().optional(),
    retryPolicy: z.object({
      maxRetries: z.number().int().min(0).max(10),
      retryDelay: z.number().int().min(1000).max(3600000),
    }).optional(),
  }),

  // Webhook delivery retry
  RetryDelivery: z.object({
    deliveryIds: z.array(z.string().uuid()).min(1).max(100),
  }),
}

// Integration validation schemas
export const IntegrationSchemas = {
  // OAuth2 configuration
  OAuth2Config: z.object({
    clientId: z.string().min(1).max(500),
    clientSecret: z.string().min(1).max(500),
    authorizationUrl: z.string().url(),
    tokenUrl: z.string().url(),
    scope: z.string().optional(),
    redirectUri: z.string().url(),
  }),

  // API key configuration
  ApiKeyConfig: z.object({
    apiKey: z.string().min(1).max(500),
    headerName: z.string().default('X-API-Key'),
    baseUrl: z.string().url(),
  }),

  // Test connection
  TestConnection: z.object({
    endpoint: z.string().url(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('GET'),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
  }),
}

// Validation middleware
export async function validateRequest<T extends z.ZodSchema>(
  schema: T,
  req: NextRequest,
  source: 'body' | 'query' | 'params' = 'body'
): Promise<ValidationResult> {
  try {
    let data: any

    switch (source) {
      case 'body':
        data = await req.json().catch(() => ({}))
        break
      case 'query':
        data = Object.fromEntries(req.nextUrl.searchParams.entries())
        break
      case 'params':
        // This would be passed from the route context
        data = {}
        break
    }

    const result = schema.safeParse(data)

    if (result.success) {
      return {
        success: true,
        data: result.data,
      }
    }

    const errors: ValidationError[] = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      value: issue.path.reduce((obj, key) => obj?.[key], data),
    }))

    return {
      success: false,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'request',
        message: error instanceof Error ? error.message : 'Invalid request format',
        code: 'invalid_format',
      }],
    }
  }
}

// Validation decorator
export function withValidation<T extends z.ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (req: NextRequest, context?: ApiContext) {
      const validation = await validateRequest(schema, req, source)

      if (!validation.success) {
        return Response.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: { errors: validation.errors },
              timestamp: new Date().toISOString(),
              path: req.nextUrl.pathname,
              requestId: context?.requestId || 'unknown',
            },
          },
          { status: 400 }
        )
      }

      // Add validated data to context
      if (context) {
        (context as any).validatedData = validation.data
      }

      return originalMethod.call(this, req, context)
    }

    return descriptor
  }
}

// Schema registry for documentation
export const SchemaRegistry = {
  // Base schemas
  Pagination: BaseSchemas.Pagination,
  Search: BaseSchemas.Search,
  IdParam: BaseSchemas.IdParam,
  SlugParam: BaseSchemas.SlugParam,
  DateRange: BaseSchemas.DateRange,

  // User schemas
  UserRegister: UserSchemas.Register,
  UserLogin: UserSchemas.Login,
  UserChangePassword: UserSchemas.ChangePassword,
  UserUpdateProfile: UserSchemas.UpdateProfile,
  AdminUpdateUser: UserSchemas.AdminUpdateUser,

  // Ticket schemas
  TicketCreate: TicketSchemas.Create,
  TicketUpdate: TicketSchemas.Update,
  TicketFilters: TicketSchemas.Filters,
  TicketBulkUpdate: TicketSchemas.BulkUpdate,

  // Comment schemas
  CommentCreate: CommentSchemas.Create,
  CommentUpdate: CommentSchemas.Update,

  // File schemas
  FileUpload: FileSchemas.Upload,
  FileBatchUpload: FileSchemas.BatchUpload,

  // Knowledge schemas
  KnowledgeCreateArticle: KnowledgeSchemas.CreateArticle,
  KnowledgeUpdateArticle: KnowledgeSchemas.UpdateArticle,
  KnowledgeFeedback: KnowledgeSchemas.Feedback,

  // Admin schemas
  AdminUpdateSetting: AdminSchemas.UpdateSetting,
  AdminCreateSLAPolicy: AdminSchemas.CreateSLAPolicy,
  AdminCreateAutomation: AdminSchemas.CreateAutomation,

  // Webhook schemas
  WebhookCreateEndpoint: WebhookSchemas.CreateEndpoint,
  WebhookUpdateEndpoint: WebhookSchemas.UpdateEndpoint,
  WebhookRetryDelivery: WebhookSchemas.RetryDelivery,

  // Integration schemas
  IntegrationOAuth2Config: IntegrationSchemas.OAuth2Config,
  IntegrationApiKeyConfig: IntegrationSchemas.ApiKeyConfig,
  IntegrationTestConnection: IntegrationSchemas.TestConnection,
}

export type SchemaType<T extends keyof typeof SchemaRegistry> = z.infer<typeof SchemaRegistry[T]>

export default {
  BaseSchemas,
  UserSchemas,
  TicketSchemas,
  CommentSchemas,
  FileSchemas,
  KnowledgeSchemas,
  AdminSchemas,
  WebhookSchemas,
  IntegrationSchemas,
  validateRequest,
  withValidation,
  SchemaRegistry,
}