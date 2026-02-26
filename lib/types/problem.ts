/**
 * Problem Management Types
 * ITIL 4 Compliant - TypeScript Definitions
 * Aligned with actual DB schema (schema.sql)
 */

// ============================================
// ENUMS
// ============================================

export type ProblemStatus =
  | 'open'
  | 'identified'
  | 'root_cause_analysis'
  | 'known_error'
  | 'resolved'
  | 'closed';

export type ProblemImpact = 'low' | 'medium' | 'high' | 'critical';
export type ProblemUrgency = 'low' | 'medium' | 'high' | 'critical';
export type WorkaroundEffectiveness = 'none' | 'partial' | 'full';
export type ProblemSourceType = 'incident' | 'proactive' | 'monitoring' | 'trend_analysis';
export type IncidentLinkType = 'caused_by' | 'related' | 'duplicate';
export type KnownErrorStatus = 'proposed' | 'active' | 'retired' | 'superseded';
export type ProblemActivityType =
  | 'note'
  | 'status_change'
  | 'assignment'
  | 'escalation'
  | 'rca_update'
  | 'workaround'
  | 'resolution'
  | 'attachment'
  | 'link';
export type PermanentFixStatus = 'pending' | 'planned' | 'in_progress' | 'completed' | 'wont_fix';
export type AttachmentType = 'evidence' | 'logs' | 'screenshot' | 'diagram' | 'report' | 'other';

// Legacy aliases for backward compatibility
export type IncidentRelationshipType = IncidentLinkType;

// ============================================
// PROBLEM ENTITY
// ============================================

export interface Problem {
  id: number;
  problem_number: string;
  title: string;
  description: string | null;
  status: ProblemStatus;
  priority_id: number | null;
  category_id: number | null;
  assigned_to: number | null;
  assigned_team_id: number | null;
  root_cause: string | null;
  root_cause_category_id: number | null;
  workaround: string | null;
  impact: ProblemImpact | null;
  urgency: ProblemUrgency | null;
  affected_services: string | null; // JSON array
  resolution: string | null;
  resolution_date: string | null;
  organization_id: number;
  tenant_id: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

// Extended problem with relations
export interface ProblemWithRelations extends Problem {
  category?: {
    id: number;
    name: string;
    color: string | null;
  };
  priority?: {
    id: number;
    name: string;
    color: string | null;
    level: number;
  };
  assignee?: {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
  };
  assigned_group?: {
    id: number;
    name: string;
  };
  created_by_user?: {
    id: number;
    name: string;
    email: string;
  };
  known_error?: KnownErrorWithRelations | null;
  incidents?: ProblemIncidentLink[];
  activities?: ProblemActivity[];
}

// ============================================
// PROBLEM INCIDENT LINK
// ============================================

export interface ProblemIncidentLink {
  id: number;
  problem_id: number;
  ticket_id: number;
  linked_by: number | null;
  link_type: IncidentLinkType;
  notes: string | null;
  created_at: string;
}

export interface ProblemIncidentLinkWithDetails extends ProblemIncidentLink {
  ticket?: {
    id: number;
    ticket_number: string;
    title: string;
    status: string;
    priority: string | null;
    created_at: string;
  };
  linked_by_user?: {
    id: number;
    name: string;
  };
}

// ============================================
// KNOWN ERROR (KEDB)
// ============================================

export interface KnownError {
  id: number;
  ke_number: string;
  problem_id: number | null;
  title: string;
  description: string | null;
  symptoms: string | null; // JSON array
  root_cause: string | null;
  workaround: string | null;
  permanent_fix: string | null;
  status: KnownErrorStatus;
  affected_cis: string | null; // JSON array
  organization_id: number;
  tenant_id: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface KnownErrorWithRelations extends KnownError {
  problem?: ProblemWithRelations | null;
  created_by_user?: {
    id: number;
    name: string;
    email: string;
  };
  reviewed_by_user?: {
    id: number;
    name: string;
  } | null;
}

// ============================================
// PROBLEM ACTIVITY
// ============================================

export interface ProblemActivity {
  id: number;
  problem_id: number;
  type: ProblemActivityType;
  description: string | null;
  old_value: string | null;
  new_value: string | null;
  user_id: number | null;
  is_internal: number; // SQLite boolean
  created_at: string;
}

export interface ProblemActivityWithUser extends ProblemActivity {
  user?: {
    id: number;
    name: string;
    avatar_url: string | null;
  };
}

// ============================================
// ROOT CAUSE CATEGORY
// ============================================

export interface RootCauseCategory {
  id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
  organization_id: number;
  is_active: number; // SQLite boolean
  created_at: string;
}

export interface RootCauseCategoryTree extends RootCauseCategory {
  children?: RootCauseCategoryTree[];
}

// ============================================
// PROBLEM ATTACHMENT
// ============================================

export interface ProblemAttachment {
  id: number;
  problem_id: number;
  filename: string;
  original_name: string;
  mime_type: string | null;
  size: number | null;
  storage_path: string;
  uploaded_by: number | null;
  created_at: string;
}

export interface ProblemAttachmentWithUser extends ProblemAttachment {
  uploaded_by_user?: {
    id: number;
    name: string;
  };
}

// ============================================
// INPUT/OUTPUT TYPES
// ============================================

// Create Problem Input
export interface CreateProblemInput {
  title: string;
  description: string;
  category_id?: number;
  priority_id?: number;
  impact?: ProblemImpact;
  urgency?: ProblemUrgency;
  assigned_to?: number;
  assigned_team_id?: number;
  root_cause_category_id?: number;
  affected_services?: number[];
}

// Update Problem Input
export interface UpdateProblemInput {
  title?: string;
  description?: string;
  status?: ProblemStatus;
  category_id?: number | null;
  priority_id?: number | null;
  impact?: ProblemImpact | null;
  urgency?: ProblemUrgency | null;
  root_cause?: string | null;
  root_cause_category?: string | null;
  workaround?: string | null;
  resolution?: string | null;
  assigned_to?: number | null;
  assigned_group_id?: number | null;
  affected_services?: number[];
}

// Link Incident to Problem Input
export interface LinkIncidentInput {
  ticket_id: number;
  relationship_type?: IncidentLinkType;
  notes?: string;
}

// Create Known Error Input
export interface CreateKnownErrorInput {
  title: string;
  description: string;
  problem_id?: number;
  symptoms?: string[];
  root_cause: string;
  workaround: string;
  permanent_fix?: string;
  status?: KnownErrorStatus;
  affected_cis?: number[];
}

// Update Known Error Input
export interface UpdateKnownErrorInput {
  title?: string;
  description?: string;
  symptoms?: string[];
  root_cause?: string;
  workaround?: string;
  permanent_fix?: string;
  status?: KnownErrorStatus;
  affected_cis?: number[];
}

// Add Activity Input
export interface AddActivityInput {
  activity_type: ProblemActivityType;
  description: string;
  old_value?: string;
  new_value?: string;
  is_internal?: boolean;
}

// ============================================
// FILTER/QUERY TYPES
// ============================================

export interface ProblemFilters {
  status?: ProblemStatus | ProblemStatus[];
  category_id?: number;
  priority_id?: number;
  impact?: ProblemImpact | ProblemImpact[];
  urgency?: ProblemUrgency | ProblemUrgency[];
  assigned_to?: number;
  assigned_group_id?: number;
  has_workaround?: boolean;
  has_known_error?: boolean;
  source_type?: ProblemSourceType;
  created_by?: number;
  created_after?: string;
  created_before?: string;
  search?: string;
}

export interface KnownErrorFilters {
  status?: KnownErrorStatus | KnownErrorStatus[];
  problem_id?: number;
  search?: string;
  created_after?: string;
  created_before?: string;
}

export interface ProblemSortOptions {
  field: 'created_at' | 'updated_at' | 'priority' | 'status';
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================
// STATISTICS TYPES
// ============================================

export interface ProblemStatistics {
  total: number;
  by_status: Record<ProblemStatus, number>;
  by_impact: Record<ProblemImpact, number>;
  by_category: Array<{ category_id: number; category_name: string; count: number }>;
  average_time_to_identify: number | null;
  average_time_to_resolve: number | null;
  total_incidents_linked: number;
  known_errors_created: number;
  problems_created_this_month: number;
  problems_resolved_this_month: number;
}

export interface KnownErrorStatistics {
  total: number;
  active: number;
  public: number;
  by_fix_status: Record<string, number>;
  total_times_referenced: number;
  recently_added: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ProblemApiResponse {
  success: boolean;
  data?: ProblemWithRelations;
  error?: string;
}

export interface ProblemsListApiResponse {
  success: boolean;
  data?: PaginatedResult<ProblemWithRelations>;
  error?: string;
}

export interface KnownErrorApiResponse {
  success: boolean;
  data?: KnownErrorWithRelations;
  error?: string;
}

export interface KnownErrorsListApiResponse {
  success: boolean;
  data?: PaginatedResult<KnownErrorWithRelations>;
  error?: string;
}

export interface ProblemStatisticsApiResponse {
  success: boolean;
  data?: ProblemStatistics;
  error?: string;
}
