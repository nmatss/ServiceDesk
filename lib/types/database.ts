// Tipos para o banco de dados do ServiceDesk

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user' | 'manager' | 'read_only' | 'api_client';
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

// Tipos Knowledge Base
export interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  summary?: string;
  category_id?: number;
  tags?: string; // JSON string
  is_published: boolean;
  views_count: number;
  helpful_count: number;
  not_helpful_count: number;
  created_by: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeArticleWithDetails extends KnowledgeArticle {
  category_name?: string;
  category_color?: string;
  created_by_name: string;
  updated_by_name?: string;
}

// Tipos Auditoria
export interface AuditLog {
  id: number;
  user_id?: number;
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
  category_id?: number;
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

export interface SatisfactionSurvey {
  id: number;
  ticket_id: number;
  user_id: number;
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
  API_CLIENT: 'api_client'
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

export interface AIClassification {
  id: number;
  ticket_id: number;
  suggested_category_id?: number;
  suggested_priority_id?: number;
  suggested_category?: string;
  confidence_score?: number;
  reasoning?: string;
  model_name: string;
  model_version?: string;
  probability_distribution?: string; // JSON
  input_tokens?: number;
  output_tokens?: number;
  processing_time_ms?: number;
  was_accepted?: boolean;
  corrected_category_id?: number;
  feedback_by?: number;
  feedback_at?: string;
  created_at: string;
}

export interface AISuggestion {
  id: number;
  ticket_id: number;
  suggestion_type: string;
  content: string;
  confidence_score?: number;
  model_name?: string;
  source_type?: string;
  source_references?: string; // JSON
  reasoning?: string;
  was_used: boolean;
  was_helpful?: boolean;
  feedback_comment?: string;
  used_by?: number;
  used_at?: string;
  feedback_by?: number;
  feedback_at?: string;
  created_at: string;
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
  metric_name: string;
  metric_value: number;
  dimension_filters?: string; // JSON
  timestamp: string;
  expires_at?: string;
}

export interface AnalyticsEvent {
  id: number;
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

// New Enterprise Types
export type CreateAIClassification = Omit<AIClassification, 'id' | 'was_accepted' | 'feedback_by' | 'feedback_at' | 'created_at'>;
export type CreateAISuggestion = Omit<AISuggestion, 'id' | 'was_used' | 'was_helpful' | 'used_by' | 'used_at' | 'feedback_by' | 'feedback_at' | 'created_at'>;
export type CreateAITrainingData = Omit<AITrainingData, 'id' | 'reviewed_by' | 'reviewed_at' | 'is_validated' | 'created_at'>;
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

