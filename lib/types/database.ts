/**
 * ServiceDesk Database Type Definitions
 *
 * Comprehensive TypeScript interfaces for all database entities in the ServiceDesk application.
 * This file serves as the single source of truth for data structures across the application.
 *
 * ORGANIZATION:
 * - Core entities (User, Ticket, Category, Priority, Status, Comment, Attachment)
 * - SLA management (SLAPolicy, SLATracking, SLAEscalation)
 * - Knowledge base (KnowledgeArticle)
 * - Notifications and templates
 * - Audit logging
 * - Authentication and RBAC (Role, Permission, UserRole)
 * - Workflows and approvals
 * - Integrations and webhooks
 * - AI features (classification, suggestions, embeddings)
 * - Multi-tenant (Organization, Department)
 * - Analytics and metrics
 * - Communication channels (Email, WhatsApp, Teams, Slack)
 * - Brazil-specific features (Gov.br, LGPD, WhatsApp)
 *
 * TYPE PATTERNS:
 * - Base interfaces: Full entity with all fields
 * - Create types: Omit<Entity, 'id' | 'created_at' | 'updated_at'>
 * - Update types: Partial<Omit<Entity, 'id' | 'created_at'>> & { id: number }
 * - WithDetails types: Include related entities via JOINs
 *
 * FIELD CONVENTIONS:
 * - id: number (auto-increment primary key)
 * - *_id: number (foreign key references)
 * - created_at: string (ISO timestamp)
 * - updated_at: string (ISO timestamp)
 * - *_at: string (ISO timestamp for events)
 * - is_*: boolean (boolean flags)
 * - JSON fields: string (JSON.parse/stringify required)
 *
 * @module lib/types/database
 */

/**
 * User entity
 *
 * Represents a user in the system with role-based access control.
 * Supports multi-factor authentication, SSO, and enterprise security features.
 *
 * SECURITY FEATURES:
 * - Password hashing (bcrypt)
 * - Two-factor authentication (TOTP)
 * - Failed login tracking and account locking
 * - SSO integration (SAML, OAuth, OIDC)
 * - Session management
 *
 * ROLES:
 * - admin: Full system access
 * - agent: Support agent with ticket assignment
 * - user: End user creating tickets
 * - manager: Team management capabilities
 * - read_only: View-only access
 * - api_client: API access for integrations
 */
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user' | 'manager' | 'read_only' | 'api_client' | 'tenant_admin';
  password_hash?: string;
  organization_id: number;
  is_active: boolean;
  is_email_verified: boolean;
  email_verified_at?: string;
  last_login_at?: string;
  password_changed_at?: string;
  failed_login_attempts: number;
  locked_until?: string;
  two_factor_enabled: boolean;
  two_factor_secret?: string;
  two_factor_backup_codes?: string; // JSON array
  sso_provider?: string;
  sso_user_id?: string;
  avatar_url?: string;
  timezone: string;
  language: string;
  metadata?: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Priority {
  id: number;
  name: string;
  level: number; // 1 = baixa, 2 = média, 3 = alta, 4 = crítica
  color: string;
  response_time?: number; // Hours for initial response
  resolution_time?: number; // Hours for resolution
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: number;
  name: string;
  description?: string;
  color: string;
  is_final: boolean; // se é um status final (resolvido, fechado, etc.)
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  user_id: number;
  assigned_to?: number; // agente responsável
  category_id: number;
  priority_id: number;
  status_id: number;
  organization_id: number;
  sla_policy_id?: number;
  sla_deadline?: string;
  sla_status?: 'on_track' | 'at_risk' | 'breached';
  sla_first_response_at?: string;
  sla_resolution_at?: string;
  escalation_level?: number;
  escalated_at?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  is_internal: boolean; // se é um comentário interno (só agentes veem)
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  ticket_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
  created_at: string;
}

// Tipos para criação (sem id e timestamps)
export type CreateUser = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type CreateCategory = Omit<Category, 'id' | 'created_at' | 'updated_at'>;
export type CreatePriority = Omit<Priority, 'id' | 'created_at' | 'updated_at'>;
export type CreateStatus = Omit<Status, 'id' | 'created_at' | 'updated_at'>;
export type CreateTicket = Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'resolved_at'>;
export type CreateComment = Omit<Comment, 'id' | 'created_at' | 'updated_at'>;
export type CreateAttachment = Omit<Attachment, 'id' | 'created_at'>;

// Tipos para atualização (todos os campos opcionais exceto id)
export type UpdateUser = Partial<Omit<User, 'id' | 'created_at'>> & { id: number };
export type UpdateCategory = Partial<Omit<Category, 'id' | 'created_at'>> & { id: number };
export type UpdatePriority = Partial<Omit<Priority, 'id' | 'created_at'>> & { id: number };
export type UpdateStatus = Partial<Omit<Status, 'id' | 'created_at'>> & { id: number };
export type UpdateTicket = Partial<Omit<Ticket, 'id' | 'created_at'>> & { id: number };
export type UpdateComment = Partial<Omit<Comment, 'id' | 'created_at'>> & { id: number };

// Tipos para consultas com joins
export interface TicketWithDetails extends Ticket {
  user: User;
  assigned_agent?: User;
  category: Category;
  priority: Priority;
  status: Status;
  comments_count: number;
  attachments_count: number;
}

export interface CommentWithDetails extends Comment {
  user: User;
}

// Tipos SLA
export interface SLAPolicy {
  id: number;
  name: string;
  description?: string;
  priority_id?: number;
  category_id?: number;
  organization_id: number;
  response_time_hours: number;
  resolution_time_hours: number;
  business_hours_only: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SLATracking {
  id: number;
  ticket_id: number;
  policy_id: number;
  organization_id: number;
  response_due_at: string;
  resolution_due_at: string;
  first_response_at?: string;
  resolved_at?: string;
  response_breached: boolean;
  resolution_breached: boolean;
  created_at: string;
  updated_at: string;
}

export interface SLAEscalation {
  id: number;
  ticket_id: number;
  escalated_from?: number;
  escalated_to: number;
  escalation_level: number;
  reason: string;
  escalated_at: string;
}

// Tipos Notificações
export interface Notification {
  id: number;
  user_id: number;
  ticket_id?: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  sent_via_email: boolean;
  email_sent_at?: string;
  created_at: string;
}

export interface NotificationWithDetails extends Notification {
  user_name: string;
  user_email: string;
  ticket_title?: string;
  ticket_number?: number;
}

// Tipos Templates
export interface Template {
  id: number;
  name: string;
  description?: string;
  type: 'ticket' | 'comment' | 'email' | 'knowledge' | 'response';
  category_id?: number;
  organization_id: number;
  title_template?: string;
  content_template: string;
  variables?: string; // JSON string
  is_active: boolean;
  tags?: string; // JSON string
  usage_count: number;
  last_used_at?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateWithDetails extends Template {
  category_name?: string;
  category_color?: string;
  created_by_name: string;
  created_by_email: string;
}

export interface TemplateUsage {
  id: number;
  template_id: number;
  used_by: number;
  ticket_id?: number;
  used_at: string;
}

// Tipos Knowledge Base - see complete definition below at line 365

// Tipos Auditoria
export interface AuditLog {
  id: number;
  user_id?: number;
  organization_id?: number;
  action: string;
  resource_type: string;
  resource_id?: number;
  old_values?: string; // JSON string
  new_values?: string; // JSON string
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditLogWithDetails extends AuditLog {
  user_name?: string;
  user_email?: string;
}

// Tipos para criação
export type CreateSLAPolicy = Omit<SLAPolicy, 'id' | 'created_at' | 'updated_at'>;
export type CreateTemplate = Omit<Template, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'last_used_at'>;

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  is_public: boolean;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

export interface Automation {
  id: number;
  name: string;
  description?: string;
  organization_id: number;
  trigger_type: 'ticket_created' | 'ticket_updated' | 'sla_warning' | 'time_based';
  conditions: string; // JSON
  actions: string; // JSON
  is_active: boolean;
  execution_count: number;
  last_executed_at?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  summary?: string;
  slug?: string;
  category_id?: number;
  organization_id: number;
  tags?: string; // JSON array
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  author_id: number;
  reviewed_by?: number;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Alias for KnowledgeArticle - for backward compatibility
 */
export type KBArticle = KnowledgeArticle;

/**
 * Team entity - Represents a team of agents for ticket assignment
 */
export interface Team {
  id: number;
  name: string;
  description?: string;
  organization_id: number;
  lead_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SatisfactionSurvey {
  id: number;
  ticket_id: number;
  user_id: number;
  organization_id: number;
  rating: number; // 1-5
  feedback?: string;
  agent_rating?: number; // 1-5
  resolution_speed_rating?: number; // 1-5
  communication_rating?: number; // 1-5
  additional_comments?: string;
  created_at: string;
}

// Tipos para criação das novas entidades
export type CreateSLATracking = Omit<SLATracking, 'id' | 'created_at' | 'updated_at'>;
export type CreateEscalation = Omit<SLAEscalation, 'id' | 'escalated_at'>;
export type CreateNotification = Omit<Notification, 'id' | 'created_at'>;
export type CreateTicketTemplate = Omit<Template, 'id' | 'created_at' | 'updated_at'>;
export type CreateAuditLog = Omit<AuditLog, 'id' | 'created_at'>;
export type CreateSystemSetting = Omit<SystemSetting, 'id' | 'created_at' | 'updated_at'>;
export type CreateAutomation = Omit<Automation, 'id' | 'execution_count' | 'last_executed_at' | 'created_at' | 'updated_at'>;
export type CreateKnowledgeArticle = Omit<KnowledgeArticle, 'id' | 'view_count' | 'helpful_count' | 'not_helpful_count' | 'created_at' | 'updated_at'>;
export type CreateSatisfactionSurvey = Omit<SatisfactionSurvey, 'id' | 'created_at'>;

// Tipos para atualização das novas entidades
export type UpdateSLAPolicy = Partial<Omit<SLAPolicy, 'id' | 'created_at'>> & { id: number };
export type UpdateSLATracking = Partial<Omit<SLATracking, 'id' | 'created_at'>> & { id: number };
export type UpdateTicketTemplate = Partial<Omit<Template, 'id' | 'created_at'>> & { id: number };
export type UpdateSystemSetting = Partial<Omit<SystemSetting, 'id' | 'created_at'>> & { id: number };
export type UpdateAutomation = Partial<Omit<Automation, 'id' | 'created_at'>> & { id: number };
export type UpdateKnowledgeArticle = Partial<Omit<KnowledgeArticle, 'id' | 'created_at'>> & { id: number };

// Tipos com relacionamentos
export interface TicketWithSLA extends TicketWithDetails {
  sla_tracking?: SLATracking & {
    sla_policy: SLAPolicy;
  };
  escalations?: SLAEscalation[];
}

export interface SLAPolicyWithStats extends SLAPolicy {
  priority: Priority;
  category?: Category;
  tickets_count: number;
  compliance_rate: number;
}

export interface NotificationWithDetails extends Notification {
  user: User;
  ticket?: Ticket;
}

export interface TemplateWithDetails extends Template {
  category?: Category;
  priority?: Priority;
  created_by_user: User;
}

export interface AuditLogWithUser extends AuditLog {
  user?: User;
}

export interface KnowledgeArticleWithDetails extends KnowledgeArticle {
  category?: Category;
  author: User;
  reviewer?: User;
}

// ========================================
// TIPOS DO SISTEMA DE AUTENTICAÇÃO ENTERPRISE
// ========================================

export interface RefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at?: string;
  device_info?: string; // JSON
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
}

export interface Permission {
  id: number;
  name: string;
  description?: string;
  resource: string;
  action: string;
  conditions?: string; // JSON
  created_at: string;
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: number;
  role_id: number;
  permission_id: number;
  granted_by?: number;
  granted_at: string;
}

export interface UserRole {
  id: number;
  user_id: number;
  role_id: number;
  granted_by?: number;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
}

export interface PasswordPolicy {
  id: number;
  name: string;
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  min_special_chars: number;
  max_age_days: number;
  prevent_reuse_last: number;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  is_active: boolean;
  applies_to_roles?: string; // JSON array
  created_at: string;
  updated_at: string;
}

export interface PasswordHistory {
  id: number;
  user_id: number;
  password_hash: string;
  created_at: string;
}

export interface RateLimit {
  id: number;
  identifier: string;
  identifier_type: 'ip' | 'user' | 'email';
  endpoint: string;
  attempts: number;
  first_attempt_at: string;
  last_attempt_at: string;
  blocked_until?: string;
}

export interface SSOProvider {
  id: number;
  name: string;
  display_name: string;
  type: 'saml2' | 'oauth2' | 'oidc' | 'ldap';
  is_active: boolean;
  configuration: string; // JSON
  metadata?: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface LoginAttempt {
  id: number;
  user_id?: number;
  email: string;
  ip_address: string;
  user_agent?: string;
  success: boolean;
  failure_reason?: string;
  two_factor_required: boolean;
  two_factor_success: boolean;
  session_id?: string;
  created_at: string;
}

export interface WebAuthnCredential {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name?: string;
  device_type?: string;
  aaguid?: string;
  last_used_at?: string;
  created_at: string;
  is_active: boolean;
}

export interface VerificationCode {
  id: number;
  user_id?: number;
  email?: string;
  code: string;
  code_hash: string;
  type: 'email_verification' | 'password_reset' | 'two_factor_backup' | 'login_verification';
  expires_at: string;
  used_at?: string;
  attempts: number;
  max_attempts: number;
  created_at: string;
}

export interface AuthAuditLog {
  id: number;
  user_id?: number;
  event_type: string;
  ip_address?: string;
  user_agent?: string;
  details?: string; // JSON
  consent_given?: boolean;
  data_retention_expires_at?: string;
  created_at: string;
}

// Tipos com relacionamentos
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface UserWithRoles extends User {
  roles: Role[];
  permissions: Permission[];
}

export interface LoginAttemptWithUser extends LoginAttempt {
  user?: User;
}

export interface RefreshTokenWithUser extends RefreshToken {
  user: User;
}

export interface AuthAuditLogWithUser extends AuthAuditLog {
  user?: User;
}

// Tipos para criação das novas entidades
export type CreateRefreshToken = Omit<RefreshToken, 'id' | 'created_at'>;
export type CreatePermission = Omit<Permission, 'id' | 'created_at'>;
export type CreateRole = Omit<Role, 'id' | 'created_at' | 'updated_at'>;
export type CreateRolePermission = Omit<RolePermission, 'id' | 'granted_at'>;
export type CreateUserRole = Omit<UserRole, 'id' | 'granted_at'>;
export type CreatePasswordPolicy = Omit<PasswordPolicy, 'id' | 'created_at' | 'updated_at'>;
export type CreatePasswordHistory = Omit<PasswordHistory, 'id' | 'created_at'>;
export type CreateRateLimit = Omit<RateLimit, 'id' | 'first_attempt_at' | 'last_attempt_at'>;
export type CreateSSOProvider = Omit<SSOProvider, 'id' | 'created_at' | 'updated_at'>;
export type CreateLoginAttempt = Omit<LoginAttempt, 'id' | 'created_at'>;
export type CreateWebAuthnCredential = Omit<WebAuthnCredential, 'id' | 'created_at'>;
export type CreateVerificationCode = Omit<VerificationCode, 'id' | 'created_at'>;
export type CreateAuthAuditLog = Omit<AuthAuditLog, 'id' | 'created_at'>;

// Tipos para atualização das novas entidades
export type UpdateRole = Partial<Omit<Role, 'id' | 'created_at'>> & { id: number };
export type UpdatePasswordPolicy = Partial<Omit<PasswordPolicy, 'id' | 'created_at'>> & { id: number };
export type UpdateSSOProvider = Partial<Omit<SSOProvider, 'id' | 'created_at'>> & { id: number };
export type UpdateUserExtended = Partial<Omit<User, 'id' | 'created_at'>> & { id: number };

// Interfaces para JWT e autenticação
export interface JWTPayload {
  id: number;
  email: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID para tracking
  aud?: string; // Audience
  iss?: string; // Issuer
}

export interface AuthSession {
  sessionId: string;
  userId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  deviceInfo?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Enums para conveniência
export const UserRole = {
  ADMIN: 'admin',
  AGENT: 'agent',
  USER: 'user',
  MANAGER: 'manager',
  READ_ONLY: 'read_only',
  API_CLIENT: 'api_client',
  TENANT_ADMIN: 'tenant_admin'
} as const;

export const AuthEventType = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  ROLE_CHANGE: 'role_change',
  TWO_FACTOR_ENABLED: 'two_factor_enabled',
  TWO_FACTOR_DISABLED: 'two_factor_disabled',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_UNLOCKED: 'account_unlocked',
  EMAIL_VERIFIED: 'email_verified',
  SSO_LOGIN: 'sso_login',
  PERMISSION_GRANTED: 'permission_granted',
  PERMISSION_REVOKED: 'permission_revoked'
} as const;

export const PermissionResource = {
  TICKETS: 'tickets',
  USERS: 'users',
  REPORTS: 'reports',
  ADMIN: 'admin',
  SETTINGS: 'settings',
  KNOWLEDGE_BASE: 'knowledge_base',
  ANALYTICS: 'analytics',
  AUDIT: 'audit'
} as const;

export const PermissionAction = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
  EXPORT: 'export',
  IMPORT: 'import'
} as const;

// ========================================
// TIPOS PARA SISTEMA DE WORKFLOWS
// ========================================

export interface Workflow {
  id: number;
  name: string;
  description?: string;
  organization_id: number;
  trigger_type: 'ticket_created' | 'ticket_updated' | 'status_changed' | 'sla_warning' | 'time_based' | 'manual' | 'comment_added' | 'assignment_changed';
  trigger_conditions?: string; // JSON
  version: number;
  is_active: boolean;
  is_template: boolean;
  category?: string;
  priority: number;
  execution_count: number;
  success_count: number;
  failure_count: number;
  last_executed_at?: string;
  created_by: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: number;
  workflow_id: number;
  step_order: number;
  step_type: 'action' | 'condition' | 'approval' | 'delay' | 'parallel' | 'webhook' | 'script' | 'notification';
  name: string;
  description?: string;
  configuration: string; // JSON
  timeout_minutes: number;
  retry_count: number;
  retry_delay_minutes: number;
  is_optional: boolean;
  parent_step_id?: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: number;
  workflow_id: number;
  organization_id: number;
  trigger_entity_type: string;
  trigger_entity_id?: number;
  trigger_user_id?: number;
  trigger_data?: string; // JSON
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  current_step_id?: number;
  progress_percentage: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  execution_log?: string; // JSON
  retry_count: number;
}

export interface WorkflowStepExecution {
  id: number;
  execution_id: number;
  step_id: number;
  organization_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'timeout';
  input_data?: string; // JSON
  output_data?: string; // JSON
  error_message?: string;
  started_at: string;
  completed_at?: string;
  execution_time_ms?: number;
  retry_count: number;
}

export interface WorkflowDefinition {
  id: number;
  name: string;
  description?: string;
  organization_id: number;
  trigger_conditions: string; // JSON
  steps_json: string; // JSON
  is_active: boolean;
  version: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowApproval {
  id: number;
  execution_id: number;
  approver_id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  comments?: string;
  approved_at?: string;
  created_at: string;
}

// ========================================
// TIPOS PARA SISTEMA DE APROVAÇÕES
// ========================================

export interface Approval {
  id: number;
  entity_type: string;
  entity_id: number;
  approval_type: string;
  requested_by: number;
  assigned_to?: number;
  assigned_group?: string; // JSON
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'timeout';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason?: string;
  approval_data?: string; // JSON
  approved_by?: number;
  approved_at?: string;
  rejection_reason?: string;
  due_date?: string;
  auto_approve_after?: string;
  notification_sent: boolean;
  escalation_level: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovalHistory {
  id: number;
  approval_id: number;
  action: string;
  performed_by?: number;
  previous_status?: string;
  new_status?: string;
  comment?: string;
  metadata?: string; // JSON
  created_at: string;
}

// ========================================
// TIPOS PARA SISTEMA DE INTEGRAÇÕES
// ========================================

export interface Integration {
  id: number;
  name: string;
  type: string;
  provider: string;
  configuration: string; // JSON
  credentials?: string; // JSON
  is_active: boolean;
  is_system: boolean;
  sync_frequency?: string;
  last_sync_at?: string;
  last_sync_status?: string;
  error_count: number;
  success_count: number;
  created_by: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

export interface IntegrationLog {
  id: number;
  integration_id: number;
  operation: string;
  status: string;
  message?: string;
  request_data?: string; // JSON
  response_data?: string; // JSON
  error_details?: string; // JSON
  execution_time_ms?: number;
  created_at: string;
}

export interface Webhook {
  id: number;
  integration_id?: number;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  event_types: string; // JSON
  headers?: string; // JSON
  secret_token?: string;
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
  success_count: number;
  failure_count: number;
  last_triggered_at?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: number;
  webhook_id: number;
  event_type: string;
  payload: string; // JSON
  request_headers?: string; // JSON
  response_status?: number;
  response_body?: string;
  response_headers?: string; // JSON
  success: boolean;
  error_message?: string;
  delivery_time_ms?: number;
  retry_count: number;
  delivered_at: string;
  next_retry_at?: string;
}

// ========================================
// TIPOS PARA SISTEMA DE IA
// ========================================

export interface AIClassification {
  id: number;
  entity_type: string;
  entity_id: number;
  classification_type: string;
  model_name: string;
  model_version?: string;
  predicted_value: string;
  confidence_score?: number;
  probability_distribution?: string; // JSON
  input_tokens?: number;
  output_tokens?: number;
  processing_time_ms?: number;
  was_correct?: boolean;
  corrected_value?: string;
  feedback_by?: number;
  feedback_at?: string;
  created_at: string;
}

export interface AISuggestion {
  id: number;
  entity_type: string;
  entity_id: number;
  suggestion_type: string;
  suggested_content: string;
  reasoning?: string;
  source_type?: string;
  source_references?: string; // JSON
  confidence_score?: number;
  model_name?: string;
  was_used: boolean;
  was_helpful?: boolean;
  feedback_comment?: string;
  used_by?: number;
  used_at?: string;
  feedback_by?: number;
  feedback_at?: string;
  created_at: string;
}

// Ticket-specific AI types (use generic AIClassification and AISuggestion above)
export interface AITicketClassification extends AIClassification {
  ticket_id: number;
  suggested_category_id?: number;
  suggested_priority_id?: number;
  suggested_category?: string;
  was_accepted?: boolean;
  corrected_category_id?: number;
}

export interface AITicketSuggestion extends AISuggestion {
  ticket_id: number;
}

export interface AITrainingData {
  id: number;
  input: string;
  output: string;
  feedback?: string;
  model_version: string;
  data_type: string;
  quality_score: number;
  source_entity_type?: string;
  source_entity_id?: number;
  created_by?: number;
  reviewed_by?: number;
  reviewed_at?: string;
  is_validated: boolean;
  created_at: string;
}

export interface VectorEmbedding {
  id: number;
  entity_type: string;
  entity_id: number;
  embedding_vector: string; // JSON array
  model_name: string;
  model_version: string;
  vector_dimension: number;
  created_at: string;
  updated_at: string;
}

// ========================================
// TIPOS PARA ORGANIZAÇÕES E DEPARTAMENTOS
// ========================================

export interface Organization {
  id: number;
  name: string;
  slug: string;
  domain?: string;
  settings?: string; // JSON
  subscription_plan: string;
  subscription_status: string;
  subscription_expires_at?: string;
  max_users: number;
  max_tickets_per_month: number;
  features?: string; // JSON
  billing_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantConfiguration {
  id: number;
  organization_id: number;
  feature_flags: string; // JSON
  limits: string; // JSON
  customizations?: string; // JSON
  api_settings?: string; // JSON
  integrations_config?: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface AuditAdvanced {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  old_values?: string; // JSON
  new_values?: string; // JSON
  user_id?: number;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  api_endpoint?: string;
  organization_id: number;
  created_at: string;
}

export interface ApiUsageTracking {
  id: number;
  endpoint: string;
  method: string;
  tenant_id: number;
  user_id?: number;
  api_key_id?: number;
  response_time_ms: number;
  status_code: number;
  request_size_bytes?: number;
  response_size_bytes?: number;
  error_message?: string;
  rate_limit_hit: boolean;
  timestamp: string;
  date: string;
  hour: number;
}

export interface Department {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  parent_id?: number;
  manager_id?: number;
  email?: string;
  phone?: string;
  cost_center?: string;
  is_active: boolean;
  business_hours?: string; // JSON
  escalation_rules?: string; // JSON
  sla_policy_id?: number;
  created_at: string;
  updated_at: string;
}

export interface UserDepartment {
  id: number;
  user_id: number;
  department_id: number;
  role: 'member' | 'lead' | 'manager' | 'admin';
  is_primary: boolean;
  joined_at: string;
  left_at?: string;
}

// ========================================
// TIPOS PARA ANALYTICS AVANÇADO
// ========================================

export interface AnalyticsRealtimeMetric {
  id: number;
  organization_id: number;
  metric_name: string;
  metric_value: number;
  dimension_filters?: string; // JSON
  timestamp: string;
  expires_at?: string;
}

export interface AnalyticsEvent {
  id: number;
  organization_id: number;
  event_type: string;
  user_id?: number;
  session_id?: string;
  entity_type?: string;
  entity_id?: number;
  properties?: string; // JSON
  user_agent?: string;
  ip_address?: string;
  referrer?: string;
  created_at: string;
}

export interface AnalyticsAgentPerformance {
  id: number;
  agent_id: number;
  organization_id: number;
  period_start: string;
  period_end: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  tickets_assigned: number;
  tickets_resolved: number;
  tickets_escalated: number;
  avg_first_response_minutes?: number;
  avg_resolution_minutes?: number;
  satisfaction_score?: number;
  satisfaction_responses: number;
  sla_breaches: number;
  knowledge_articles_created: number;
  peer_help_given: number;
  peer_help_received: number;
  overtime_hours: number;
  computed_at: string;
}

// ========================================
// TIPOS PARA COMUNICAÇÃO UNIFICADA
// ========================================

export interface CommunicationChannel {
  id: number;
  name: string;
  type: string;
  configuration: string; // JSON
  is_active: boolean;
  is_default: boolean;
  priority: number;
  success_rate?: number;
  avg_response_time_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface CommunicationMessage {
  id: number;
  channel_id: number;
  ticket_id?: number;
  user_id: number;
  sender_id?: number;
  message_type: string;
  subject?: string;
  content: string;
  content_format: string;
  template_id?: number;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
  external_id?: string;
  delivery_attempts: number;
  delivered_at?: string;
  read_at?: string;
  failed_reason?: string;
  cost_cents?: number;
  created_at: string;
}

// ========================================
// TIPOS BRASIL-SPECIFIC
// ========================================

export interface WhatsAppSession {
  id: number;
  phone_number: string;
  session_data?: string; // JSON
  last_activity: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppContact {
  id: number;
  user_id?: number;
  phone_number: string;
  display_name?: string;
  profile_picture_url?: string;
  is_business: boolean;
  is_verified: boolean;
  last_seen?: string;
  status_message?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: number;
  contact_id: number;
  ticket_id?: number;
  message_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content?: string;
  media_url?: string;
  media_mime_type?: string;
  media_caption?: string;
  status: string;
  timestamp: string;
  created_at: string;
}

export interface GovBrIntegration {
  id: number;
  user_id?: number;
  cpf?: string;
  cnpj?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  profile_data?: string; // JSON
  verification_level: string;
  last_sync_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LGPDConsent {
  id: number;
  user_id: number;
  consent_type: string;
  purpose: string;
  legal_basis: string;
  is_given: boolean;
  consent_method?: string;
  consent_evidence?: string; // JSON
  ip_address?: string;
  user_agent?: string;
  expires_at?: string;
  withdrawn_at?: string;
  withdrawal_reason?: string;
  created_at: string;
}

// ========================================
// TIPOS COM RELACIONAMENTOS
// ========================================

export interface WorkflowWithSteps extends Workflow {
  steps: WorkflowStep[];
}

export interface WorkflowExecutionWithSteps extends WorkflowExecution {
  workflow: Workflow;
  step_executions: WorkflowStepExecution[];
}

export interface ApprovalWithHistory extends Approval {
  history: ApprovalHistory[];
  requested_by_user: User;
  assigned_to_user?: User;
  approved_by_user?: User;
}

export interface IntegrationWithLogs extends Integration {
  logs: IntegrationLog[];
  webhooks: Webhook[];
}

export interface DepartmentWithUsers extends Department {
  manager?: User;
  users: (User & { department_role: string; is_primary: boolean })[];
  children?: Department[];
}

export interface OrganizationWithDepartments extends Organization {
  departments: Department[];
  user_count: number;
  ticket_count: number;
}

export interface AIClassificationWithFeedback extends AIClassification {
  feedback_user?: User;
}

export interface AISuggestionWithFeedback extends AISuggestion {
  used_by_user?: User;
  feedback_by_user?: User;
}

// ========================================
// TIPOS PARA CRIAÇÃO
// ========================================

export type CreateWorkflow = Omit<Workflow, 'id' | 'execution_count' | 'success_count' | 'failure_count' | 'last_executed_at' | 'created_at' | 'updated_at'>;
export type CreateWorkflowStep = Omit<WorkflowStep, 'id' | 'created_at' | 'updated_at'>;
export type CreateWorkflowExecution = Omit<WorkflowExecution, 'id' | 'current_step_id' | 'progress_percentage' | 'started_at' | 'completed_at' | 'retry_count'>;
export type CreateWorkflowStepExecution = Omit<WorkflowStepExecution, 'id' | 'started_at' | 'completed_at' | 'execution_time_ms' | 'retry_count'>;

export type CreateApproval = Omit<Approval, 'id' | 'approved_by' | 'approved_at' | 'notification_sent' | 'escalation_level' | 'created_at' | 'updated_at'>;
export type CreateApprovalHistory = Omit<ApprovalHistory, 'id' | 'created_at'>;

export type CreateIntegration = Omit<Integration, 'id' | 'last_sync_at' | 'last_sync_status' | 'error_count' | 'success_count' | 'created_at' | 'updated_at'>;
export type CreateIntegrationLog = Omit<IntegrationLog, 'id' | 'created_at'>;
export type CreateWebhook = Omit<Webhook, 'id' | 'success_count' | 'failure_count' | 'last_triggered_at' | 'created_at' | 'updated_at'>;
export type CreateWebhookDelivery = Omit<WebhookDelivery, 'id' | 'retry_count' | 'delivered_at'>;

export type CreateAIClassification = Omit<AIClassification, 'id' | 'was_correct' | 'corrected_value' | 'feedback_by' | 'feedback_at' | 'created_at'>;
export type CreateAISuggestion = Omit<AISuggestion, 'id' | 'was_used' | 'was_helpful' | 'feedback_comment' | 'used_by' | 'used_at' | 'feedback_by' | 'feedback_at' | 'created_at'>;
export type CreateAITrainingData = Omit<AITrainingData, 'id' | 'reviewed_by' | 'reviewed_at' | 'is_validated' | 'created_at'>;

export type CreateOrganization = Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
export type CreateDepartment = Omit<Department, 'id' | 'created_at' | 'updated_at'>;
export type CreateUserDepartment = Omit<UserDepartment, 'id' | 'joined_at' | 'left_at'>;

export type CreateAnalyticsRealtimeMetric = Omit<AnalyticsRealtimeMetric, 'id' | 'timestamp'>;
export type CreateAnalyticsEvent = Omit<AnalyticsEvent, 'id' | 'created_at'>;
export type CreateAnalyticsAgentPerformance = Omit<AnalyticsAgentPerformance, 'id' | 'computed_at'>;

export type CreateCommunicationChannel = Omit<CommunicationChannel, 'id' | 'success_rate' | 'avg_response_time_minutes' | 'created_at' | 'updated_at'>;
export type CreateCommunicationMessage = Omit<CommunicationMessage, 'id' | 'delivery_attempts' | 'delivered_at' | 'read_at' | 'created_at'>;

export type CreateWhatsAppContact = Omit<WhatsAppContact, 'id' | 'created_at' | 'updated_at'>;
export type CreateWhatsAppMessage = Omit<WhatsAppMessage, 'id' | 'created_at'>;
export type CreateGovBrIntegration = Omit<GovBrIntegration, 'id' | 'last_sync_at' | 'created_at' | 'updated_at'>;
export type CreateLGPDConsent = Omit<LGPDConsent, 'id' | 'created_at'>;

// Additional Enterprise Types (AI types defined earlier in file)
export type CreateVectorEmbedding = Omit<VectorEmbedding, 'id' | 'created_at' | 'updated_at'>;
export type CreateWorkflowDefinition = Omit<WorkflowDefinition, 'id' | 'version' | 'created_at' | 'updated_at'>;
export type CreateWorkflowApproval = Omit<WorkflowApproval, 'id' | 'approved_at' | 'created_at'>;
export type CreateTenantConfiguration = Omit<TenantConfiguration, 'id' | 'created_at' | 'updated_at'>;
export type CreateAuditAdvanced = Omit<AuditAdvanced, 'id' | 'created_at'>;
export type CreateApiUsageTracking = Omit<ApiUsageTracking, 'id' | 'timestamp' | 'date' | 'hour'>;
export type CreateWhatsAppSession = Omit<WhatsAppSession, 'id' | 'created_at' | 'updated_at'>;

// ========================================
// TIPOS PARA ATUALIZAÇÃO
// ========================================

export type UpdateWorkflow = Partial<Omit<Workflow, 'id' | 'created_at'>> & { id: number };
export type UpdateWorkflowStep = Partial<Omit<WorkflowStep, 'id' | 'created_at'>> & { id: number };
export type UpdateApproval = Partial<Omit<Approval, 'id' | 'created_at'>> & { id: number };
export type UpdateIntegration = Partial<Omit<Integration, 'id' | 'created_at'>> & { id: number };
export type UpdateWebhook = Partial<Omit<Webhook, 'id' | 'created_at'>> & { id: number };
export type UpdateOrganization = Partial<Omit<Organization, 'id' | 'created_at'>> & { id: number };
export type UpdateDepartment = Partial<Omit<Department, 'id' | 'created_at'>> & { id: number };
export type UpdateCommunicationChannel = Partial<Omit<CommunicationChannel, 'id' | 'created_at'>> & { id: number };
export type UpdateWhatsAppContact = Partial<Omit<WhatsAppContact, 'id' | 'created_at'>> & { id: number };
export type UpdateGovBrIntegration = Partial<Omit<GovBrIntegration, 'id' | 'created_at'>> & { id: number };

// New Enterprise Update Types
export type UpdateWorkflowDefinition = Partial<Omit<WorkflowDefinition, 'id' | 'created_at'>> & { id: number };
export type UpdateWorkflowApproval = Partial<Omit<WorkflowApproval, 'id' | 'created_at'>> & { id: number };
export type UpdateTenantConfiguration = Partial<Omit<TenantConfiguration, 'id' | 'created_at'>> & { id: number };
export type UpdateVectorEmbedding = Partial<Omit<VectorEmbedding, 'id' | 'created_at'>> & { id: number };
export type UpdateWhatsAppSession = Partial<Omit<WhatsAppSession, 'id' | 'created_at'>> & { id: number };

// ========================================
// ENUMS E CONSTANTES ADICIONAIS
// ========================================

export const WorkflowTriggerType = {
  TICKET_CREATED: 'ticket_created',
  TICKET_UPDATED: 'ticket_updated',
  STATUS_CHANGED: 'status_changed',
  SLA_WARNING: 'sla_warning',
  TIME_BASED: 'time_based',
  MANUAL: 'manual',
  COMMENT_ADDED: 'comment_added',
  ASSIGNMENT_CHANGED: 'assignment_changed'
} as const;

export const WorkflowStepType = {
  ACTION: 'action',
  CONDITION: 'condition',
  APPROVAL: 'approval',
  DELAY: 'delay',
  PARALLEL: 'parallel',
  WEBHOOK: 'webhook',
  SCRIPT: 'script',
  NOTIFICATION: 'notification'
} as const;

export const ExecutionStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
} as const;

export const ApprovalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
} as const;

export const IntegrationType = {
  WEBHOOK: 'webhook',
  API: 'api',
  SSO: 'sso',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  TEAMS: 'teams',
  SLACK: 'slack',
  GOV_BR: 'gov_br'
} as const;

export const CommunicationChannelType = {
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
  TEAMS: 'teams',
  SLACK: 'slack',
  SMS: 'sms',
  VOICE: 'voice',
  CHAT: 'chat'
} as const;

export const LGPDConsentType = {
  DATA_PROCESSING: 'data_processing',
  MARKETING: 'marketing',
  ANALYTICS: 'analytics',
  COOKIES: 'cookies'
} as const;

export const LGPDLegalBasis = {
  CONSENT: 'consent',
  CONTRACT: 'contract',
  LEGAL_OBLIGATION: 'legal_obligation',
  LEGITIMATE_INTEREST: 'legitimate_interest'
} as const;

// ========================================
// CMDB (Configuration Management Database) Types
// ========================================

/**
 * CI Type - Classification of Configuration Items
 * (e.g., Server, Network Device, Application, Database)
 */
export interface CIType {
  id: number;
  name: string;
  description?: string;
  icon: string;
  color: string;
  parent_type_id?: number;
  attributes_schema?: string; // JSON schema for custom attributes
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * CI Status - Lifecycle status of Configuration Items
 * (e.g., Active, Inactive, Under Maintenance, Retired)
 */
export interface CIStatus {
  id: number;
  name: string;
  description?: string;
  color: string;
  is_operational: boolean;
  created_at: string;
}

/**
 * Configuration Item (CI) - Core CMDB entity
 * Represents any hardware, software, or service that needs to be managed
 */
export interface ConfigurationItem {
  id: number;
  ci_number: string;
  name: string;
  description?: string;
  ci_type_id: number;
  status_id: number;
  organization_id: number;

  // Ownership
  owner_id?: number;
  managed_by_team_id?: number;
  vendor?: string;
  manufacturer?: string;

  // Location
  location?: string;
  environment?: 'production' | 'staging' | 'development' | 'test' | 'dr';
  data_center?: string;
  rack_position?: string;

  // Lifecycle
  purchase_date?: string;
  installation_date?: string;
  warranty_expiry?: string;
  end_of_life_date?: string;
  retirement_date?: string;

  // Technical
  serial_number?: string;
  asset_tag?: string;
  ip_address?: string;
  mac_address?: string;
  hostname?: string;
  os_version?: string;

  // Business
  business_service?: string;
  criticality?: 'critical' | 'high' | 'medium' | 'low';
  business_impact?: string;
  recovery_time_objective?: number;
  recovery_point_objective?: number;

  custom_attributes?: string; // JSON

  created_by?: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

/**
 * CI Relationship Type - Types of relationships between CIs
 * (e.g., depends_on, hosts, connects_to)
 */
export interface CIRelationshipType {
  id: number;
  name: string;
  description?: string;
  inverse_name?: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

/**
 * CI Relationship - Links between Configuration Items
 */
export interface CIRelationship {
  id: number;
  source_ci_id: number;
  target_ci_id: number;
  relationship_type_id: number;
  description?: string;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

/**
 * CI History - Audit trail for Configuration Items
 */
export interface CIHistory {
  id: number;
  ci_id: number;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'relationship_added' | 'relationship_removed';
  field_name?: string;
  old_value?: string;
  new_value?: string;
  changed_by?: number;
  change_reason?: string;
  related_ticket_id?: number;
  related_change_id?: number;
  created_at: string;
}

/**
 * CI-Ticket Link - Associates CIs with tickets
 */
export interface CITicketLink {
  id: number;
  ci_id: number;
  ticket_id: number;
  link_type: 'affected' | 'caused_by' | 'related' | 'changed';
  notes?: string;
  created_by?: number;
  created_at: string;
}

// With Details Types
export interface ConfigurationItemWithDetails extends ConfigurationItem {
  ci_type?: CIType;
  status?: CIStatus;
  owner?: User;
  managed_by_team?: Team;
  relationships?: CIRelationshipWithDetails[];
  linked_tickets?: Ticket[];
}

export interface CIRelationshipWithDetails extends CIRelationship {
  source_ci?: ConfigurationItem;
  target_ci?: ConfigurationItem;
  relationship_type?: CIRelationshipType;
}

// ========================================
// SERVICE CATALOG Types
// ========================================

/**
 * Service Category - Grouping for catalog items
 * (e.g., IT Services, HR Services, Facilities)
 */
export interface ServiceCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  color: string;
  parent_category_id?: number;
  display_order: number;
  is_public: boolean;
  is_active: boolean;
  organization_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Service Catalog Item - Service offering in the catalog
 */
export interface ServiceCatalogItem {
  id: number;
  name: string;
  slug: string;
  short_description?: string;
  description?: string;
  category_id: number;
  organization_id: number;

  // Display
  icon: string;
  image_url?: string;
  display_order: number;

  // Request configuration
  form_schema?: string; // JSON schema
  default_priority_id?: number;
  default_category_id?: number;

  // SLA and fulfillment
  sla_policy_id?: number;
  estimated_fulfillment_time?: number;
  fulfillment_team_id?: number;

  // Approval
  requires_approval: boolean;
  approval_workflow_id?: number;
  auto_approve_roles?: string; // JSON array

  // Cost
  cost_type: 'free' | 'fixed' | 'variable' | 'quote';
  base_cost: number;
  cost_currency: string;

  // Visibility
  is_public: boolean;
  is_featured: boolean;
  is_active: boolean;
  available_from?: string;
  available_until?: string;

  // Usage
  request_count: number;
  avg_fulfillment_time: number;
  satisfaction_rating: number;

  tags?: string; // JSON array
  keywords?: string;
  created_by?: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Service Request - Instance of a catalog item request
 */
export interface ServiceRequest {
  id: number;
  request_number: string;
  catalog_item_id: number;
  ticket_id?: number;

  // Requester
  requester_id: number;
  requester_name?: string;
  requester_email?: string;
  requester_department?: string;
  on_behalf_of_id?: number;

  // Request details
  form_data: string; // JSON
  justification?: string;
  requested_date?: string;

  // Status
  status: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'in_progress' | 'fulfilled' | 'cancelled' | 'failed';
  approval_status?: 'pending' | 'approved' | 'rejected' | 'not_required';
  approved_by?: number;
  approved_at?: string;
  rejection_reason?: string;

  // Fulfillment
  fulfilled_by?: number;
  fulfilled_at?: string;
  fulfillment_notes?: string;

  // Cost
  estimated_cost?: number;
  actual_cost?: number;

  // Satisfaction
  satisfaction_rating?: number;
  satisfaction_comment?: string;

  organization_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Service Request Approval - Multi-level approval tracking
 */
export interface ServiceRequestApproval {
  id: number;
  service_request_id: number;
  approval_level: number;
  approver_id?: number;
  approver_role?: string;

  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'expired';
  decision_at?: string;
  comments?: string;
  delegated_to?: number;

  due_date?: string;
  reminded_at?: string;
  reminder_count: number;

  created_at: string;
  updated_at: string;
}

/**
 * Service Request Task - Fulfillment tasks
 */
export interface ServiceRequestTask {
  id: number;
  service_request_id: number;
  task_order: number;
  title: string;
  description?: string;

  assigned_to?: number;
  assigned_team_id?: number;

  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  completion_notes?: string;

  estimated_minutes?: number;
  actual_minutes?: number;

  created_at: string;
  updated_at: string;
}

// With Details Types
export interface ServiceCatalogItemWithDetails extends ServiceCatalogItem {
  category?: ServiceCategory;
  sla_policy?: SLAPolicy;
  fulfillment_team?: Team;
}

export interface ServiceRequestWithDetails extends ServiceRequest {
  catalog_item?: ServiceCatalogItem;
  requester?: User;
  approved_by_user?: User;
  fulfilled_by_user?: User;
  ticket?: Ticket;
  approvals?: ServiceRequestApproval[];
  tasks?: ServiceRequestTask[];
}

// ========================================
// CHANGE MANAGEMENT ENHANCEMENTS (CAB)
// ========================================

/**
 * Change Type - Classification of change requests
 * (e.g., Standard, Normal, Emergency, Major)
 */
export interface ChangeType {
  id: number;
  name: string;
  description?: string;
  requires_cab_approval: boolean;
  default_risk_level?: 'low' | 'medium' | 'high' | 'critical';
  lead_time_days: number;
  created_at: string;
}

/**
 * CAB Configuration - Change Advisory Board setup
 */
export interface CABConfiguration {
  id: number;
  name: string;
  description?: string;
  organization_id: number;

  // Schedule
  meeting_day?: string;
  meeting_time?: string;
  meeting_duration: number;
  meeting_location?: string;
  meeting_url?: string;

  // Members
  chair_user_id?: number;
  secretary_user_id?: number;

  // Quorum
  minimum_members: number;
  quorum_percentage: number;

  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * CAB Member - Member of a Change Advisory Board
 */
export interface CABMember {
  id: number;
  cab_id: number;
  user_id: number;
  role: 'chair' | 'secretary' | 'member' | 'advisor';
  is_voting_member: boolean;
  expertise_areas?: string; // JSON array
  is_active: boolean;
  joined_at: string;
}

/**
 * CAB Meeting - Change Advisory Board meeting instance
 */
export interface CABMeeting {
  id: number;
  cab_id: number;
  title: string;
  scheduled_date: string;
  meeting_date: string;
  meeting_type: 'regular' | 'emergency' | 'virtual';

  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

  attendees?: string; // JSON array
  actual_start?: string;
  actual_end?: string;

  agenda?: string;
  minutes?: string;
  decisions?: string; // JSON array
  action_items?: string; // JSON array

  created_by?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Change Request (RFC) - Request for Change
 */
export interface ChangeRequest {
  id: number;
  change_number: string;
  title: string;
  description: string;

  // Classification
  change_type_id?: number;
  category: 'standard' | 'normal' | 'emergency';
  priority: 'low' | 'medium' | 'high' | 'critical';

  // Risk
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  risk_assessment?: string;
  impact_assessment?: string;

  // Planning
  reason_for_change?: string;
  business_justification?: string;
  implementation_plan?: string;
  backout_plan?: string;
  test_plan?: string;
  communication_plan?: string;

  // Schedule
  requested_start_date?: string;
  requested_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;

  // Stakeholders
  requester_id: number;
  owner_id?: number;
  implementer_id?: number;

  // Approval
  cab_meeting_id?: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'withdrawn';
  approved_by?: number;
  approved_at?: string;
  approval_notes?: string;

  // Status
  status: 'draft' | 'submitted' | 'under_review' | 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';

  // PIR
  pir_required: boolean;
  pir_completed: boolean;
  pir_notes?: string;
  pir_success_rating?: number;

  affected_cis?: string; // JSON array

  organization_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Change Request Approval - CAB voting record
 */
export interface ChangeRequestApproval {
  id: number;
  change_request_id: number;
  cab_member_id: number;

  vote?: 'approve' | 'reject' | 'defer' | 'abstain';
  voted_at?: string;
  comments?: string;
  conditions?: string;

  created_at: string;
}

/**
 * Change Calendar - Blackout/freeze periods
 */
export interface ChangeCalendar {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;

  type: 'blackout' | 'freeze' | 'preferred' | 'maintenance';
  severity: 'soft' | 'hard';

  affected_environments?: string; // JSON array
  affected_change_types?: string; // JSON array

  is_recurring: boolean;
  recurrence_pattern?: string; // JSON

  organization_id: number;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

// With Details Types
export interface ChangeRequestWithDetails extends ChangeRequest {
  change_type?: ChangeType;
  requester?: User;
  owner?: User;
  implementer?: User;
  cab_meeting?: CABMeeting;
  approvals?: ChangeRequestApprovalWithDetails[];
  affected_configuration_items?: ConfigurationItem[];
}

export interface ChangeRequestApprovalWithDetails extends ChangeRequestApproval {
  cab_member?: CABMemberWithDetails;
}

export interface CABMemberWithDetails extends CABMember {
  user?: User;
}

export interface CABMeetingWithDetails extends CABMeeting {
  cab_configuration?: CABConfiguration;
  change_requests?: ChangeRequest[];
  attendee_details?: User[];
}

// ========================================
// CMDB Create Types
// ========================================

export type CreateCIType = Omit<CIType, 'id' | 'created_at' | 'updated_at'>;
export type CreateCIStatus = Omit<CIStatus, 'id' | 'created_at'>;
export type CreateConfigurationItem = Omit<ConfigurationItem, 'id' | 'ci_number' | 'created_at' | 'updated_at'>;
export type CreateCIRelationshipType = Omit<CIRelationshipType, 'id' | 'created_at'>;
export type CreateCIRelationship = Omit<CIRelationship, 'id' | 'created_at' | 'updated_at'>;
export type CreateCIHistory = Omit<CIHistory, 'id' | 'created_at'>;
export type CreateCITicketLink = Omit<CITicketLink, 'id' | 'created_at'>;

// ========================================
// Service Catalog Create Types
// ========================================

export type CreateServiceCategory = Omit<ServiceCategory, 'id' | 'created_at' | 'updated_at'>;
export type CreateServiceCatalogItem = Omit<ServiceCatalogItem, 'id' | 'request_count' | 'avg_fulfillment_time' | 'satisfaction_rating' | 'created_at' | 'updated_at'>;
export type CreateServiceRequest = Omit<ServiceRequest, 'id' | 'request_number' | 'approved_by' | 'approved_at' | 'fulfilled_by' | 'fulfilled_at' | 'satisfaction_rating' | 'satisfaction_comment' | 'created_at' | 'updated_at'>;
export type CreateServiceRequestApproval = Omit<ServiceRequestApproval, 'id' | 'decision_at' | 'reminded_at' | 'reminder_count' | 'created_at' | 'updated_at'>;
export type CreateServiceRequestTask = Omit<ServiceRequestTask, 'id' | 'started_at' | 'completed_at' | 'actual_minutes' | 'created_at' | 'updated_at'>;

// ========================================
// Change Management Create Types
// ========================================

export type CreateChangeType = Omit<ChangeType, 'id' | 'created_at'>;
export type CreateCABConfiguration = Omit<CABConfiguration, 'id' | 'created_at' | 'updated_at'>;
export type CreateCABMember = Omit<CABMember, 'id' | 'joined_at'>;
export type CreateCABMeeting = Omit<CABMeeting, 'id' | 'actual_start' | 'actual_end' | 'created_at' | 'updated_at'>;
export type CreateChangeRequest = Omit<ChangeRequest, 'id' | 'change_number' | 'cab_meeting_id' | 'approved_by' | 'approved_at' | 'actual_start_date' | 'actual_end_date' | 'pir_completed' | 'pir_notes' | 'pir_success_rating' | 'created_at' | 'updated_at'>;
export type CreateChangeRequestApproval = Omit<ChangeRequestApproval, 'id' | 'voted_at' | 'created_at'>;
export type CreateChangeCalendar = Omit<ChangeCalendar, 'id' | 'created_at' | 'updated_at'>;

// ========================================
// CMDB Update Types
// ========================================

export type UpdateCIType = Partial<Omit<CIType, 'id' | 'created_at'>> & { id: number };
export type UpdateConfigurationItem = Partial<Omit<ConfigurationItem, 'id' | 'ci_number' | 'created_at'>> & { id: number };
export type UpdateCIRelationship = Partial<Omit<CIRelationship, 'id' | 'created_at'>> & { id: number };

// ========================================
// Service Catalog Update Types
// ========================================

export type UpdateServiceCategory = Partial<Omit<ServiceCategory, 'id' | 'created_at'>> & { id: number };
export type UpdateServiceCatalogItem = Partial<Omit<ServiceCatalogItem, 'id' | 'created_at'>> & { id: number };
export type UpdateServiceRequest = Partial<Omit<ServiceRequest, 'id' | 'request_number' | 'created_at'>> & { id: number };
export type UpdateServiceRequestTask = Partial<Omit<ServiceRequestTask, 'id' | 'created_at'>> & { id: number };

// ========================================
// Change Management Update Types
// ========================================

export type UpdateCABConfiguration = Partial<Omit<CABConfiguration, 'id' | 'created_at'>> & { id: number };
export type UpdateCABMember = Partial<Omit<CABMember, 'id' | 'joined_at'>> & { id: number };
export type UpdateCABMeeting = Partial<Omit<CABMeeting, 'id' | 'created_at'>> & { id: number };
export type UpdateChangeRequest = Partial<Omit<ChangeRequest, 'id' | 'change_number' | 'created_at'>> & { id: number };
export type UpdateChangeCalendar = Partial<Omit<ChangeCalendar, 'id' | 'created_at'>> & { id: number };

// ========================================
// CMDB/Change Management Enums
// ========================================

export const CICriticality = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

export const CIEnvironment = {
  PRODUCTION: 'production',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
  TEST: 'test',
  DR: 'dr'
} as const;

export const ChangeCategory = {
  STANDARD: 'standard',
  NORMAL: 'normal',
  EMERGENCY: 'emergency'
} as const;

export const ChangeRequestStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  ROLLED_BACK: 'rolled_back'
} as const;

export const CABVote = {
  APPROVE: 'approve',
  REJECT: 'reject',
  DEFER: 'defer',
  ABSTAIN: 'abstain'
} as const;

export const ServiceRequestStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  IN_PROGRESS: 'in_progress',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
} as const;

