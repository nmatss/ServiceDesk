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
    .min(12, 'Password must be at least 12 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain at least one special character'),
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
    status_id: commonSchemas.id.optional(),
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
    settings: z.record(z.string(), z.unknown()).optional(),
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    domain: commonSchemas.domain.optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
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

/**
 * CAB (Change Advisory Board) validation schemas
 */
export const cabSchemas = {
  createMeeting: z.object({
    cab_id: commonSchemas.id,
    meeting_date: z.string().min(1, 'Data é obrigatória'),
    meeting_type: z.enum(['regular', 'emergency', 'virtual']).default('regular'),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('scheduled'),
    attendees: z.array(commonSchemas.id).optional(),
    agenda: z.string().max(10000).optional(),
    minutes: z.string().max(50000).optional(),
    decisions: z.array(z.string()).optional(),
    action_items: z.array(z.string()).optional(),
  }),

  updateMeeting: z.object({
    id: commonSchemas.id,
    meeting_date: z.string().optional(),
    meeting_type: z.enum(['regular', 'emergency', 'virtual']).optional(),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
    attendees: z.array(commonSchemas.id).optional(),
    agenda: z.string().max(10000).optional(),
    minutes: z.string().max(50000).optional(),
    decisions: z.array(z.string()).optional(),
    action_items: z.array(z.string()).optional(),
  }),

  queryMeetings: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
    meeting_type: z.enum(['regular', 'emergency', 'virtual']).optional(),
    upcoming: z.coerce.boolean().optional(),
  }),

  addMember: z.object({
    cab_id: commonSchemas.id,
    user_id: commonSchemas.id,
    role: z.enum(['chair', 'secretary', 'member', 'advisor']).default('member'),
    is_voting_member: z.boolean().default(true),
    expertise_areas: z.array(z.string().max(100)).max(20).optional(),
  }),

  createChangeRequest: z.object({
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(10000),
    change_type_id: commonSchemas.id.optional(),
    category: z.enum(['standard', 'normal', 'emergency']).default('normal'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    risk_assessment: z.string().max(5000).optional(),
    impact_assessment: z.string().max(5000).optional(),
    reason_for_change: z.string().max(2000).optional(),
    business_justification: z.string().max(2000).optional(),
    implementation_plan: z.string().max(10000).optional(),
    backout_plan: z.string().max(10000).optional(),
    test_plan: z.string().max(10000).optional(),
    communication_plan: z.string().max(5000).optional(),
    requested_start_date: z.string().optional(),
    requested_end_date: z.string().optional(),
    requester_id: commonSchemas.id,
    owner_id: commonSchemas.id.optional(),
    implementer_id: commonSchemas.id.optional(),
  }),

  updateChangeRequest: z.object({
    id: commonSchemas.id,
    title: z.string().min(1).max(500).optional(),
    description: z.string().min(1).max(10000).optional(),
    status: z.enum(['draft', 'submitted', 'under_review', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled', 'rolled_back']).optional(),
    approval_status: z.enum(['pending', 'approved', 'rejected', 'deferred', 'withdrawn']).optional(),
    risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    cab_meeting_id: commonSchemas.id.nullable().optional(),
    approved_by: commonSchemas.id.nullable().optional(),
    approved_at: z.string().nullable().optional(),
    approval_notes: z.string().max(5000).nullable().optional(),
  }),

  recordVote: z.object({
    change_request_id: commonSchemas.id,
    cab_member_id: commonSchemas.id,
    vote: z.enum(['approve', 'reject', 'defer', 'abstain']),
    comments: z.string().max(2000).optional(),
    conditions: z.string().max(2000).optional(),
  }),
}

/**
 * Problem Management validation schemas
 */
export const problemSchemas = {
  create: z.object({
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(10000),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    category_id: commonSchemas.id.optional(),
    organization_id: commonSchemas.organizationId,
    assigned_to: commonSchemas.id.optional(),
    root_cause: z.string().max(5000).optional(),
    impact_assessment: z.string().max(5000).optional(),
    workaround: z.string().max(5000).optional(),
  }),

  update: z.object({
    id: commonSchemas.id,
    title: z.string().min(1).max(500).optional(),
    description: z.string().min(1).max(10000).optional(),
    status: z.enum(['open', 'investigating', 'known_error', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    assigned_to: commonSchemas.id.nullable().optional(),
    root_cause: z.string().max(5000).optional(),
    impact_assessment: z.string().max(5000).optional(),
    workaround: z.string().max(5000).optional(),
  }),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(['open', 'investigating', 'known_error', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    search: z.string().max(255).optional(),
  }),
}

/**
 * CMDB (Configuration Management Database) validation schemas
 */
export const cmdbSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    description: z.string().max(2000).optional(),
    organization_id: commonSchemas.organizationId,
    status: z.enum(['active', 'inactive', 'retired', 'maintenance']).default('active'),
    location: z.string().max(255).optional(),
    owner_id: commonSchemas.id.optional(),
    purchase_date: z.string().optional(),
    warranty_expiry: z.string().optional(),
    serial_number: z.string().max(255).optional(),
    asset_tag: z.string().max(255).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    type: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(['active', 'inactive', 'retired', 'maintenance']).optional(),
    location: z.string().max(255).optional(),
    owner_id: commonSchemas.id.nullable().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  }),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    type: z.string().optional(),
    status: z.enum(['active', 'inactive', 'retired', 'maintenance']).optional(),
    search: z.string().max(255).optional(),
  }),

  relationship: z.object({
    ci_id: commonSchemas.id,
    related_ci_id: commonSchemas.id,
    relationship_type: z.enum(['depends_on', 'uses', 'connects_to', 'runs_on', 'hosted_by']),
    description: z.string().max(500).optional(),
  }),
}

/**
 * Team validation schemas
 */
export const teamSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    organization_id: commonSchemas.organizationId,
    manager_id: commonSchemas.id.optional(),
    email: commonSchemas.email.optional(),
    is_active: z.boolean().default(true),
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    manager_id: commonSchemas.id.nullable().optional(),
    email: commonSchemas.email.optional(),
    is_active: z.boolean().optional(),
  }),

  addMember: z.object({
    team_id: commonSchemas.id,
    user_id: commonSchemas.id,
    role: z.enum(['member', 'lead', 'manager']).default('member'),
  }),
}

/**
 * Workflow validation schemas
 */
export const workflowSchemas = {
  createDefinition: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    trigger_type: z.enum(['ticket_created', 'ticket_updated', 'status_changed', 'manual', 'scheduled']),
    organization_id: commonSchemas.organizationId,
    is_active: z.boolean().default(true),
    definition: z.record(z.string(), z.unknown()),
  }),

  execute: z.object({
    workflow_id: commonSchemas.id,
    context: z.record(z.string(), z.unknown()),
    triggered_by: commonSchemas.id.optional(),
  }),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    trigger_type: z.enum(['ticket_created', 'ticket_updated', 'status_changed', 'manual', 'scheduled']).optional(),
    is_active: z.boolean().optional(),
  }),
}

/**
 * Notification validation schemas
 */
export const notificationSchemas = {
  create: z.object({
    user_id: commonSchemas.id,
    organization_id: commonSchemas.organizationId,
    type: z.enum(['ticket', 'comment', 'assignment', 'sla_warning', 'system', 'mention']),
    title: z.string().min(1).max(255),
    message: z.string().min(1).max(1000),
    entity_type: z.string().max(50).optional(),
    entity_id: commonSchemas.id.optional(),
    action_url: z.string().max(500).optional(),
  }),

  markRead: z.object({
    notification_id: commonSchemas.id,
    user_id: commonSchemas.id,
  }),

  markAllRead: z.object({
    user_id: commonSchemas.id,
  }),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    is_read: z.boolean().optional(),
    type: z.enum(['ticket', 'comment', 'assignment', 'sla_warning', 'system', 'mention']).optional(),
  }),
}

/**
 * Analytics validation schemas
 */
export const analyticsSchemas = {
  query: z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    metric: z.enum(['tickets', 'response_time', 'resolution_time', 'sla', 'csat', 'agent_performance']).optional(),
    group_by: z.enum(['day', 'week', 'month', 'category', 'priority', 'agent']).optional(),
  }),

  webVitals: z.object({
    metric_name: z.enum(['FCP', 'LCP', 'FID', 'CLS', 'TTFB', 'INP']),
    value: z.number().min(0),
    page: z.string().max(500),
    user_agent: z.string().max(500).optional(),
  }),
}

/**
 * Automation validation schemas
 */
export const automationSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    organization_id: commonSchemas.organizationId,
    trigger_event: z.enum(['ticket_created', 'ticket_updated', 'status_changed', 'priority_changed', 'assigned', 'commented']),
    conditions: z.array(z.record(z.string(), z.unknown())).max(20),
    actions: z.array(z.record(z.string(), z.unknown())).max(20),
    is_active: z.boolean().default(true),
    priority: z.number().int().min(0).max(100).default(50),
  }),

  update: z.object({
    id: commonSchemas.id,
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
    conditions: z.array(z.record(z.string(), z.unknown())).optional(),
    actions: z.array(z.record(z.string(), z.unknown())).optional(),
    is_active: z.boolean().optional(),
    priority: z.number().int().min(0).max(100).optional(),
  }),
}

/**
 * File Upload validation schemas
 */
export const fileUploadSchemas = {
  upload: z.object({
    filename: z.string().min(1).max(255),
    mime_type: z.string().regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i),
    file_size: z.number().int().min(1).max(52428800), // 50MB max
    entity_type: z.enum(['ticket', 'comment', 'knowledge', 'user', 'cmdb']),
    entity_id: commonSchemas.id,
  }),

  validate: z.object({
    mime_type: z.string(),
    file_size: z.number(),
    allowed_types: z.array(z.string()).default(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']),
    max_size: z.number().default(52428800),
  }),
}

/**
 * Integration validation schemas
 */
export const integrationSchemas = {
  email: z.object({
    to: z.array(commonSchemas.email).min(1).max(50),
    subject: z.string().min(1).max(255),
    body: z.string().min(1).max(100000),
    from: commonSchemas.email.optional(),
    cc: z.array(commonSchemas.email).max(50).optional(),
    bcc: z.array(commonSchemas.email).max(50).optional(),
    attachments: z.array(z.object({
      filename: z.string(),
      content: z.string(),
      contentType: z.string(),
    })).max(10).optional(),
  }),

  whatsapp: z.object({
    to: commonSchemas.phoneNumber,
    message: z.string().min(1).max(4096),
    template_name: z.string().max(100).optional(),
    template_params: z.array(z.string()).max(10).optional(),
  }),

  webhook: z.object({
    url: commonSchemas.url,
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).default('POST'),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    signature: z.string().optional(),
    timestamp: z.string().optional(),
  }),
}

/**
 * Search validation schemas
 */
export const searchSchemas = {
  query: z.object({
    q: z.string().min(1).max(500),
    type: z.enum(['tickets', 'knowledge', 'users', 'all']).default('all'),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  }),

  semantic: z.object({
    query: z.string().min(1).max(500),
    limit: z.coerce.number().int().min(1).max(20).default(5),
    threshold: z.number().min(0).max(1).default(0.7),
  }),

  suggest: z.object({
    q: z.string().min(1).max(100),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  }),
}

/**
 * AI/ML validation schemas
 */
export const aiSchemas = {
  classifyTicket: z.object({
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(10000),
    suggest_category: z.boolean().default(true),
    suggest_priority: z.boolean().default(true),
    suggest_assignment: z.boolean().default(false),
  }),

  generateResponse: z.object({
    ticket_id: commonSchemas.id,
    context: z.string().max(5000).optional(),
    tone: z.enum(['professional', 'friendly', 'technical', 'empathetic']).default('professional'),
    max_length: z.number().int().min(50).max(2000).default(500),
  }),

  analyzeSentiment: z.object({
    text: z.string().min(1).max(10000),
    language: z.string().length(2).default('pt'),
  }),

  detectDuplicates: z.object({
    ticket_id: commonSchemas.id,
    threshold: z.number().min(0).max(1).default(0.8),
    limit: z.coerce.number().int().min(1).max(20).default(5),
  }),

  suggestSolutions: z.object({
    ticket_id: commonSchemas.id,
    limit: z.coerce.number().int().min(1).max(10).default(3),
  }),

  feedback: z.object({
    prediction_id: z.string().min(1).max(255),
    was_helpful: z.boolean(),
    feedback_text: z.string().max(1000).optional(),
  }),
}

/**
 * Catalog/Service Request validation schemas
 */
export const catalogSchemas = {
  createRequest: z.object({
    service_id: commonSchemas.id,
    requester_id: commonSchemas.id,
    organization_id: commonSchemas.organizationId,
    request_data: z.record(z.string(), z.unknown()),
    description: z.string().max(5000).optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
  }),

  approveRequest: z.object({
    request_id: commonSchemas.id,
    approver_id: commonSchemas.id,
    approved: z.boolean(),
    comments: z.string().max(2000).optional(),
  }),
}

/**
 * Macro validation schemas
 */
export const macroSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    organization_id: commonSchemas.organizationId,
    actions: z.array(z.object({
      field: z.string().min(1).max(100),
      action: z.enum(['set', 'add', 'append']),
      value: z.unknown(),
    })).min(1).max(20),
    is_active: z.boolean().default(true),
  }),

  apply: z.object({
    macro_id: commonSchemas.id,
    ticket_ids: z.array(commonSchemas.id).min(1).max(100),
    applied_by: commonSchemas.id,
  }),
}

/**
 * Template validation schemas
 */
export const templateSchemas = {
  create: z.object({
    name: z.string().min(1).max(255),
    type: z.enum(['ticket', 'email', 'comment', 'knowledge']),
    organization_id: commonSchemas.organizationId,
    content: z.string().min(1).max(50000),
    variables: z.array(z.string()).max(50).optional(),
    is_active: z.boolean().default(true),
  }),

  apply: z.object({
    template_id: commonSchemas.id,
    variables: z.record(z.string(), z.string()).optional(),
  }),
}

/**
 * Report validation schemas
 */
export const reportSchemas = {
  generate: z.object({
    report_type: z.enum(['tickets', 'sla', 'agents', 'categories', 'trends', 'custom']),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    format: z.enum(['json', 'csv', 'pdf', 'excel']).default('json'),
    filters: z.record(z.string(), z.unknown()).optional(),
    group_by: z.array(z.string()).max(5).optional(),
  }),
}

/**
 * Gamification validation schemas
 */
export const gamificationSchemas = {
  recordAchievement: z.object({
    user_id: commonSchemas.id,
    achievement_type: z.string().min(1).max(100),
    points: z.number().int().min(1).max(1000),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
}

/**
 * PWA/Push notification validation schemas
 */
export const pwaSchemas = {
  subscribe: z.object({
    user_id: commonSchemas.id,
    subscription: z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
    }),
  }),

  send: z.object({
    user_ids: z.array(commonSchemas.id).min(1).max(1000),
    title: z.string().min(1).max(100),
    body: z.string().min(1).max(300),
    icon: z.string().url().optional(),
    badge: z.string().url().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
}
