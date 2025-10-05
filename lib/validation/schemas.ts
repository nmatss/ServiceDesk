/**
 * Zod Validation Schemas
 * Type-safe validation for all API inputs
 */

import { z } from 'zod'

/**
 * Common validation schemas used across the application
 */
export const commonSchemas = {
  id: z.number().int().positive(),
  email: z.string().email().max(254),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  organizationId: z.number().int().positive(),
  url: z.string().url(),
  hexColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
  domain: z.string().regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  timezone: z.string().min(1).max(50),
}

/**
 * User validation schemas
 */
export const userSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    email: commonSchemas.email,
    password: commonSchemas.password,
    role: z.enum(['super_admin', 'tenant_admin', 'team_manager', 'admin', 'agent', 'user']),
    organization_id: commonSchemas.organizationId,
    phone: commonSchemas.phoneNumber.optional(),
    avatar_url: commonSchemas.url.optional(),
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    email: commonSchemas.email.optional(),
    password: commonSchemas.password.optional(),
    role: z.enum(['super_admin', 'tenant_admin', 'team_manager', 'admin', 'agent', 'user']).optional(),
    phone: commonSchemas.phoneNumber.optional(),
    avatar_url: commonSchemas.url.optional(),
    is_active: z.boolean().optional(),
  }),

  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1),
  }),

  query: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(25),
    role: z.enum(['super_admin', 'tenant_admin', 'team_manager', 'admin', 'agent', 'user']).optional(),
    is_active: z.boolean().optional(),
    search: z.string().max(255).optional(),
  }),
}

/**
 * Ticket validation schemas
 */
export const ticketSchemas = {
  create: z.object({
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(10000),
    category_id: commonSchemas.id,
    priority_id: commonSchemas.id,
    organization_id: commonSchemas.organizationId,
    user_id: commonSchemas.id,
    assigned_to: commonSchemas.id.optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),

  update: z.object({
    id: commonSchemas.id,
    title: z.string().min(1).max(500).optional(),
    description: z.string().min(1).max(10000).optional(),
    category_id: commonSchemas.id.optional(),
    priority_id: commonSchemas.id.optional(),
    status_id: commonSchemas.id.optional(),
    assigned_to: commonSchemas.id.nullable().optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),

  query: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(25),
    status_id: commonSchemas.id.optional(),
    priority_id: commonSchemas.id.optional(),
    category_id: commonSchemas.id.optional(),
    assigned_to: commonSchemas.id.optional(),
    user_id: commonSchemas.id.optional(),
    search: z.string().max(255).optional(),
    tags: z.array(z.string()).optional(),
  }),
}

/**
 * Comment validation schemas
 */
export const commentSchemas = {
  create: z.object({
    ticket_id: commonSchemas.id,
    user_id: commonSchemas.id,
    content: z.string().min(1).max(10000),
    is_internal: z.boolean().default(false),
  }),

  update: z.object({
    id: commonSchemas.id,
    content: z.string().min(1).max(10000),
    is_internal: z.boolean().optional(),
  }),
}

/**
 * Attachment validation schemas
 */
export const attachmentSchemas = {
  create: z.object({
    ticket_id: commonSchemas.id,
    filename: z.string().min(1).max(255),
    file_path: z.string().min(1).max(500),
    mime_type: z.string().min(1).max(100),
    file_size: z.number().int().min(1).max(52428800), // 50MB max
    uploaded_by: commonSchemas.id,
  }),
}

/**
 * Category validation schemas
 */
export const categorySchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    color: commonSchemas.hexColor.default('#6B7280'),
    icon: z.string().max(50).optional(),
    organization_id: commonSchemas.organizationId,
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    color: commonSchemas.hexColor.optional(),
    icon: z.string().max(50).optional(),
  }),
}

/**
 * Priority validation schemas
 */
export const prioritySchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    level: z.number().int().min(1).max(10),
    color: commonSchemas.hexColor.default('#6B7280'),
    response_time_hours: z.number().int().min(1).optional(),
    resolution_time_hours: z.number().int().min(1).optional(),
    organization_id: commonSchemas.organizationId,
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    level: z.number().int().min(1).max(10).optional(),
    color: commonSchemas.hexColor.optional(),
    response_time_hours: z.number().int().min(1).optional(),
    resolution_time_hours: z.number().int().min(1).optional(),
  }),
}

/**
 * Status validation schemas
 */
export const statusSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    color: commonSchemas.hexColor.default('#6B7280'),
    is_final: z.boolean().default(false),
    order_index: z.number().int().min(0).default(0),
    organization_id: commonSchemas.organizationId,
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    color: commonSchemas.hexColor.optional(),
    is_final: z.boolean().optional(),
    order_index: z.number().int().min(0).optional(),
  }),
}

/**
 * SLA Policy validation schemas
 */
export const slaSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    priority_id: commonSchemas.id,
    response_time_hours: z.number().int().positive(),
    resolution_time_hours: z.number().int().positive(),
    organization_id: commonSchemas.organizationId,
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    response_time_hours: z.number().int().positive().optional(),
    resolution_time_hours: z.number().int().positive().optional(),
  }),
}

/**
 * Organization validation schemas
 */
export const organizationSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    slug: commonSchemas.slug,
    domain: commonSchemas.domain.optional(),
    settings: z.record(z.unknown()).optional(),
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    domain: commonSchemas.domain.optional(),
    settings: z.record(z.unknown()).optional(),
    is_active: z.boolean().optional(),
  }),
}

/**
 * Knowledge Base Article schemas
 */
export const kbArticleSchemas = {
  create: z.object({
    title: z.string().min(1).max(500),
    content: z.string().min(1),
    slug: commonSchemas.slug,
    category_id: commonSchemas.id,
    author_id: commonSchemas.id,
    organization_id: commonSchemas.organizationId,
    is_published: z.boolean().default(false),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),

  update: z.object({
    id: commonSchemas.id,
    title: z.string().min(1).max(500).optional(),
    content: z.string().min(1).optional(),
    category_id: commonSchemas.id.optional(),
    is_published: z.boolean().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
}
