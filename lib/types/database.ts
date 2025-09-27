// Tipos para o banco de dados do ServiceDesk

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user';
  password_hash?: string;
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

