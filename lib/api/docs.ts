/**
 * Automatic OpenAPI Documentation Generation
 * Enterprise-grade API documentation with Swagger/OpenAPI 3.0
 */

import { z } from 'zod'
import { SchemaRegistry } from './validation'
import { ErrorCode } from './types'
import { logger } from '../monitoring/logger';

// OpenAPI Schema Types
interface OpenAPISchema {
  openapi: string
  info: OpenAPIInfo
  servers: OpenAPIServer[]
  paths: Record<string, Record<string, OpenAPIOperation>>
  components: OpenAPIComponents
  security: OpenAPISecurityRequirement[]
  tags: OpenAPITag[]
}

interface OpenAPIInfo {
  title: string
  description: string
  version: string
  contact: {
    name: string
    email: string
    url: string
  }
  license: {
    name: string
    url: string
  }
  termsOfService: string
}

interface OpenAPIServer {
  url: string
  description: string
  variables?: Record<string, OpenAPIServerVariable>
}

interface OpenAPIServerVariable {
  enum?: string[]
  default: string
  description?: string
}

interface OpenAPIOperation {
  tags: string[]
  summary: string
  description: string
  operationId: string
  parameters?: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
  responses: Record<string, OpenAPIResponse>
  security?: OpenAPISecurityRequirement[]
  deprecated?: boolean
}

interface OpenAPIParameter {
  name: string
  in: 'query' | 'header' | 'path' | 'cookie'
  description?: string
  required?: boolean
  schema: any
  example?: any
}

interface OpenAPIRequestBody {
  description?: string
  content: Record<string, OpenAPIMediaType>
  required?: boolean
}

interface OpenAPIMediaType {
  schema: any
  example?: any
  examples?: Record<string, OpenAPIExample>
}

interface OpenAPIExample {
  summary?: string
  description?: string
  value: any
}

interface OpenAPIResponse {
  description: string
  content?: Record<string, OpenAPIMediaType>
  headers?: Record<string, OpenAPIHeader>
}

interface OpenAPIHeader {
  description?: string
  schema: any
}

interface OpenAPIComponents {
  schemas: Record<string, any>
  responses: Record<string, OpenAPIResponse>
  parameters: Record<string, OpenAPIParameter>
  examples: Record<string, OpenAPIExample>
  requestBodies: Record<string, OpenAPIRequestBody>
  headers: Record<string, OpenAPIHeader>
  securitySchemes: Record<string, OpenAPISecurityScheme>
}

interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect'
  scheme?: string
  bearerFormat?: string
  in?: 'query' | 'header' | 'cookie'
  name?: string
  flows?: any
  openIdConnectUrl?: string
}

interface OpenAPISecurityRequirement {
  [key: string]: string[]
}

interface OpenAPITag {
  name: string
  description: string
  externalDocs?: {
    description: string
    url: string
  }
}

// Route Documentation Interface
interface RouteDocumentation {
  path: string
  method: string
  tags: string[]
  summary: string
  description: string
  parameters?: {
    name: string
    in: 'query' | 'header' | 'path'
    description: string
    required?: boolean
    schema: z.ZodSchema
  }[]
  requestBody?: {
    description: string
    schema: z.ZodSchema
    examples?: Record<string, any>
  }
  responses: {
    [statusCode: string]: {
      description: string
      schema?: z.ZodSchema
      examples?: Record<string, any>
    }
  }
  security?: string[]
  deprecated?: boolean
}

// Documentation Generator
export class OpenAPIGenerator {
  private schema: OpenAPISchema
  private routes: Map<string, RouteDocumentation> = new Map()

  constructor() {
    this.schema = this.initializeSchema()
  }

  private initializeSchema(): OpenAPISchema {
    return {
      openapi: '3.0.3',
      info: {
        title: 'ServiceDesk API',
        description: 'Enterprise Service Desk Management System API',
        version: '1.0.0',
        contact: {
          name: 'ServiceDesk Support',
          email: 'support@servicedesk.com',
          url: 'https://servicedesk.com/support',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
        termsOfService: 'https://servicedesk.com/terms',
      },
      servers: [
        {
          url: 'http://localhost:3000/api',
          description: 'Development server',
        },
        {
          url: 'https://api.servicedesk.com/{version}',
          description: 'Production server',
          variables: {
            version: {
              enum: ['v1', 'v2'],
              default: 'v1',
              description: 'API version',
            },
          },
        },
      ],
      paths: {},
      components: this.initializeComponents(),
      security: [
        { BearerAuth: [] },
        { ApiKeyAuth: [] },
      ],
      tags: this.initializeTags(),
    }
  }

  private initializeComponents(): OpenAPIComponents {
    return {
      schemas: this.generateSchemas(),
      responses: this.generateCommonResponses(),
      parameters: this.generateCommonParameters(),
      examples: {},
      requestBodies: {},
      headers: {},
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
        BasicAuth: {
          type: 'http',
          scheme: 'basic',
        },
      },
    }
  }

  private initializeTags(): OpenAPITag[] {
    return [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Users',
        description: 'User management operations',
      },
      {
        name: 'Tickets',
        description: 'Support ticket operations',
      },
      {
        name: 'Comments',
        description: 'Ticket comment operations',
      },
      {
        name: 'Attachments',
        description: 'File attachment operations',
      },
      {
        name: 'Knowledge Base',
        description: 'Knowledge base article operations',
      },
      {
        name: 'Categories',
        description: 'Category management',
      },
      {
        name: 'Priorities',
        description: 'Priority management',
      },
      {
        name: 'Statuses',
        description: 'Status management',
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting',
      },
      {
        name: 'Admin',
        description: 'Administrative operations',
      },
      {
        name: 'Webhooks',
        description: 'Webhook management',
      },
      {
        name: 'Integrations',
        description: 'External service integrations',
      },
    ]
  }

  private generateSchemas(): Record<string, any> {
    const schemas: Record<string, any> = {}

    // Convert Zod schemas to OpenAPI schemas
    Object.entries(SchemaRegistry).forEach(([name, schema]) => {
      try {
        schemas[name] = this.zodToOpenAPI(schema)
      } catch (error) {
        logger.warn(`Failed to convert schema ${name}:`, error)
      }
    })

    // Add common schemas
    schemas.ApiResponse = {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
        error: { $ref: '#/components/schemas/ApiError' },
        meta: { $ref: '#/components/schemas/ResponseMeta' },
      },
      required: ['success'],
    }

    schemas.ApiError = {
      type: 'object',
      properties: {
        code: { type: 'string', enum: Object.values(ErrorCode) },
        message: { type: 'string' },
        details: { type: 'object' },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string' },
        requestId: { type: 'string' },
      },
      required: ['code', 'message', 'timestamp', 'path', 'requestId'],
    }

    schemas.ResponseMeta = {
      type: 'object',
      properties: {
        pagination: { $ref: '#/components/schemas/PaginationMeta' },
        cache: { $ref: '#/components/schemas/CacheMeta' },
        timing: { $ref: '#/components/schemas/TimingMeta' },
        version: { type: 'string' },
      },
    }

    schemas.PaginationMeta = {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        total: { type: 'integer', minimum: 0 },
        totalPages: { type: 'integer', minimum: 0 },
        hasNext: { type: 'boolean' },
        hasPrev: { type: 'boolean' },
      },
      required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev'],
    }

    schemas.CacheMeta = {
      type: 'object',
      properties: {
        cached: { type: 'boolean' },
        ttl: { type: 'integer' },
        key: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    }

    schemas.TimingMeta = {
      type: 'object',
      properties: {
        processTime: { type: 'number' },
        dbTime: { type: 'number' },
        cacheTime: { type: 'number' },
      },
    }

    return schemas
  }

  private generateCommonResponses(): Record<string, OpenAPIResponse> {
    return {
      BadRequest: {
        description: 'Bad Request - Invalid input parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiResponse' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: { errors: [] },
                timestamp: '2023-01-01T00:00:00Z',
                path: '/api/v1/example',
                requestId: 'req_123',
              },
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiResponse' },
            example: {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
                timestamp: '2023-01-01T00:00:00Z',
                path: '/api/v1/example',
                requestId: 'req_123',
              },
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiResponse' },
          },
        },
      },
      NotFound: {
        description: 'Not Found - Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiResponse' },
          },
        },
      },
      RateLimited: {
        description: 'Too Many Requests - Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiResponse' },
          },
        },
        headers: {
          'X-RateLimit-Limit': {
            description: 'Request limit per window',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Remaining': {
            description: 'Remaining requests in current window',
            schema: { type: 'integer' },
          },
          'X-RateLimit-Reset': {
            description: 'Window reset time',
            schema: { type: 'integer' },
          },
        },
      },
      InternalError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiResponse' },
          },
        },
      },
    }
  }

  private generateCommonParameters(): Record<string, OpenAPIParameter> {
    return {
      Page: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      Sort: {
        name: 'sort',
        in: 'query',
        description: 'Sort field',
        schema: { type: 'string' },
      },
      Order: {
        name: 'order',
        in: 'query',
        description: 'Sort order',
        schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
      },
      ApiVersion: {
        name: 'X-API-Version',
        in: 'header',
        description: 'API version',
        schema: { type: 'string', enum: ['v1', 'v2'], default: 'v1' },
      },
      RequestId: {
        name: 'X-Request-ID',
        in: 'header',
        description: 'Request identifier for tracking',
        schema: { type: 'string' },
      },
    }
  }

  private zodToOpenAPI(schema: z.ZodSchema): any {
    if (schema instanceof z.ZodString) {
      const result: any = { type: 'string' }

      // Add constraints
      if ('minLength' in schema._def && schema._def.minLength !== null) {
        result.minLength = schema._def.minLength.value
      }
      if ('maxLength' in schema._def && schema._def.maxLength !== null) {
        result.maxLength = schema._def.maxLength.value
      }

      // Add format for email, datetime, etc.
      const checks = (schema._def as any).checks || []
      for (const check of checks) {
        if (check.kind === 'email') {
          result.format = 'email'
        } else if (check.kind === 'datetime') {
          result.format = 'date-time'
        } else if (check.kind === 'url') {
          result.format = 'uri'
        } else if (check.kind === 'regex') {
          result.pattern = check.regex.source
        }
      }

      return result
    }

    if (schema instanceof z.ZodNumber) {
      const result: any = { type: 'number' }

      if ('checks' in schema._def) {
        const checks = schema._def.checks as any[]
        for (const check of checks) {
          if (check.kind === 'min') {
            result.minimum = check.value
          } else if (check.kind === 'max') {
            result.maximum = check.value
          } else if (check.kind === 'int') {
            result.type = 'integer'
          }
        }
      }

      return result
    }

    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean' }
    }

    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodToOpenAPI(schema.element),
        minItems: schema._def.minLength?.value,
        maxItems: schema._def.maxLength?.value,
      }
    }

    if (schema instanceof z.ZodObject) {
      const properties: Record<string, any> = {}
      const required: string[] = []

      const shape = schema.shape
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodToOpenAPI(value as z.ZodSchema)

        // Check if field is required
        if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
          required.push(key)
        }
      }

      const result: any = {
        type: 'object',
        properties,
      }

      if (required.length > 0) {
        result.required = required
      }

      return result
    }

    if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: schema.options,
      }
    }

    if (schema instanceof z.ZodOptional) {
      return this.zodToOpenAPI(schema.unwrap())
    }

    if (schema instanceof z.ZodDefault) {
      const innerSchema = this.zodToOpenAPI(schema._def.innerType)
      innerSchema.default = schema._def.defaultValue()
      return innerSchema
    }

    if (schema instanceof z.ZodUnion) {
      return {
        anyOf: schema.options.map((option: z.ZodSchema) => this.zodToOpenAPI(option)),
      }
    }

    // Fallback for unsupported types
    return { type: 'object' }
  }

  // Add route documentation
  addRoute(documentation: RouteDocumentation): void {
    const key = `${documentation.method.toUpperCase()}:${documentation.path}`
    this.routes.set(key, documentation)
  }

  // Generate complete OpenAPI specification
  generateSpec(): OpenAPISchema {
    this.schema.paths = {}

    // Convert route documentation to OpenAPI paths
    for (const [, route] of this.routes) {
      if (!this.schema.paths[route.path]) {
        this.schema.paths[route.path] = {}
      }

      const operation: OpenAPIOperation = {
        tags: route.tags,
        summary: route.summary,
        description: route.description,
        operationId: `${route.method.toLowerCase()}${route.path.replace(/[^a-zA-Z0-9]/g, '')}`,
        responses: {},
      }

      // Add parameters
      if (route.parameters) {
        operation.parameters = route.parameters.map(param => ({
          name: param.name,
          in: param.in,
          description: param.description,
          required: param.required,
          schema: this.zodToOpenAPI(param.schema),
        }))
      }

      // Add request body
      if (route.requestBody) {
        operation.requestBody = {
          description: route.requestBody.description,
          content: {
            'application/json': {
              schema: this.zodToOpenAPI(route.requestBody.schema),
              examples: route.requestBody.examples,
            },
          },
          required: true,
        }
      }

      // Add responses
      for (const [statusCode, response] of Object.entries(route.responses)) {
        operation.responses[statusCode] = {
          description: response.description,
          content: response.schema ? {
            'application/json': {
              schema: this.zodToOpenAPI(response.schema),
              examples: response.examples,
            },
          } : undefined,
        }
      }

      // Add security
      if (route.security) {
        operation.security = route.security.map(scheme => ({ [scheme]: [] }))
      }

      // Add deprecation
      if (route.deprecated) {
        operation.deprecated = true
      }

      this.schema.paths[route.path][route.method.toLowerCase()] = operation
    }

    return this.schema
  }

  // Export as JSON
  toJSON(): string {
    return JSON.stringify(this.generateSpec(), null, 2)
  }

  // Export as YAML
  toYAML(): string {
    // Simple YAML conversion (in production, use a proper YAML library)
    const json = this.generateSpec()
    return JSON.stringify(json, null, 2).replace(/"/g, '').replace(/,\n/g, '\n')
  }
}

// Documentation decorator
export function apiDoc(documentation: Omit<RouteDocumentation, 'path' | 'method'>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Store documentation metadata
    if (!target._apiDocs) {
      target._apiDocs = new Map()
    }
    target._apiDocs.set(propertyKey, documentation)
    return descriptor
  }
}

// Global documentation instance
export const apiDocGenerator = new OpenAPIGenerator()

// Helper functions for common documentation patterns
export const docHelpers = {
  // Create standard CRUD documentation
  crud: (entity: string, schema: z.ZodSchema) => ({
    list: {
      tags: [entity],
      summary: `List ${entity}`,
      description: `Retrieve a paginated list of ${entity}`,
      responses: {
        '200': {
          description: `List of ${entity}`,
          schema: z.object({
            success: z.boolean(),
            data: z.array(schema),
            meta: z.object({
              pagination: z.object({
                page: z.number(),
                limit: z.number(),
                total: z.number(),
                totalPages: z.number(),
                hasNext: z.boolean(),
                hasPrev: z.boolean(),
              }),
            }),
          }),
        },
      },
    },
    create: {
      tags: [entity],
      summary: `Create ${entity}`,
      description: `Create a new ${entity}`,
      requestBody: {
        description: `${entity} data`,
        schema,
      },
      responses: {
        '201': {
          description: `Created ${entity}`,
          schema: z.object({
            success: z.boolean(),
            data: schema,
          }),
        },
      },
    },
    get: {
      tags: [entity],
      summary: `Get ${entity}`,
      description: `Retrieve a specific ${entity} by ID`,
      parameters: [
        {
          name: 'id',
          in: 'path' as const,
          description: `${entity} ID`,
          required: true,
          schema: z.number(),
        },
      ],
      responses: {
        '200': {
          description: `${entity} details`,
          schema: z.object({
            success: z.boolean(),
            data: schema,
          }),
        },
      },
    },
    update: {
      tags: [entity],
      summary: `Update ${entity}`,
      description: `Update an existing ${entity}`,
      parameters: [
        {
          name: 'id',
          in: 'path' as const,
          description: `${entity} ID`,
          required: true,
          schema: z.number(),
        },
      ],
      requestBody: {
        description: `Updated ${entity} data`,
        schema: schema.partial(),
      },
      responses: {
        '200': {
          description: `Updated ${entity}`,
          schema: z.object({
            success: z.boolean(),
            data: schema,
          }),
        },
      },
    },
    delete: {
      tags: [entity],
      summary: `Delete ${entity}`,
      description: `Delete an existing ${entity}`,
      parameters: [
        {
          name: 'id',
          in: 'path' as const,
          description: `${entity} ID`,
          required: true,
          schema: z.number(),
        },
      ],
      responses: {
        '204': {
          description: `${entity} deleted`,
        },
      },
    },
  }),
}

export default {
  OpenAPIGenerator,
  apiDocGenerator,
  apiDoc,
  docHelpers,
}