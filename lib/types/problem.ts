/**
 * Problem Management Types
 * ITIL 4 Compliant - TypeScript Definitions
 */

// ============================================
// ENUMS
// ============================================

export type ProblemStatus =
  | 'new'
  | 'investigation'
  | 'root_cause_identified'
  | 'known_error'
  | 'resolved'
  | 'closed';

export type ProblemImpact = 'low' | 'medium' | 'high' | 'critical';
export type ProblemUrgency = 'low' | 'medium' | 'high' | 'critical';
export type WorkaroundEffectiveness = 'none' | 'partial' | 'full';
export type ProblemSourceType = 'incident' | 'proactive' | 'monitoring' | 'trend_analysis';
export type IncidentRelationshipType = 'caused_by' | 'related' | 'duplicate' | 'regression';
export type PermanentFixStatus = 'pending' | 'planned' | 'in_progress' | 'completed' | 'wont_fix';
export type AttachmentType = 'evidence' | 'logs' | 'screenshot' | 'diagram' | 'report' | 'other';
export type ProblemActivityType =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'comment'
  | 'root_cause_updated'
  | 'workaround_added'
  | 'incident_linked'
  | 'known_error_created'
  | 'resolved'
  | 'closed'
  | 'reopened';

// ============================================
// PROBLEM ENTITY
// ============================================

export interface Problem {
  id: number;
  organization_id: number;

  // Identification
  problem_number: string; // PRB-2024-0001
  title: string;
  description: string;

  // Status
  status: ProblemStatus;

  // Classification
  category_id: number | null;
  priority_id: number | null;
  impact: ProblemImpact | null;
  urgency: ProblemUrgency | null;

  // Root Cause Analysis
  root_cause: string | null;
  root_cause_category: string | null;
  symptoms: string | null; // JSON array

  // Solutions
  workaround: string | null;
  workaround_effectiveness: WorkaroundEffectiveness | null;
  permanent_fix: string | null;

  // Scope
  affected_services: string | null; // JSON array
  affected_cis: string | null; // JSON array
  affected_users_count: number;
  business_impact: string | null;

  // Assignment
  assigned_to: number | null;
  assigned_group_id: number | null;

  // Known Error link
  known_error_id: number | null;

  // Source tracking
  source_type: ProblemSourceType | null;
  source_incident_id: number | null;

  // Metrics
  incident_count: number;
  time_to_identify_hours: number | null;
  time_to_resolve_hours: number | null;

  // Audit
  created_by: number;
  created_at: string;
  updated_at: string;
  identified_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  closed_by: number | null;
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
  known_error?: KnownError | null;
  incidents?: ProblemIncidentLink[];
  activities?: ProblemActivity[];
}

// ============================================
// PROBLEM INCIDENT LINK
// ============================================

export interface ProblemIncidentLink {
  id: number;
  organization_id: number;
  problem_id: number;
  ticket_id: number;
  relationship_type: IncidentRelationshipType;
  linked_at: string;
  linked_by: number;
  notes: string | null;
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
  organization_id: number;

  // Identification
  ke_number: string; // KE-2024-0001
  title: string;
  description: string;

  // Source
  problem_id: number | null;

  // Documentation
  symptoms: string; // JSON array
  root_cause: string;
  workaround: string;
  workaround_instructions: string | null;

  // Fix status
  permanent_fix_status: PermanentFixStatus;
  permanent_fix_eta: string | null;
  permanent_fix_notes: string | null;

  // Scope
  affected_cis: string | null; // JSON array
  affected_services: string | null; // JSON array
  affected_versions: string | null; // JSON array

  // Status
  is_active: number; // SQLite boolean
  is_public: number; // SQLite boolean

  // Metrics
  times_referenced: number;

  // Audit
  created_by: number;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
}

export interface KnownErrorWithRelations extends KnownError {
  problem?: Problem | null;
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
  organization_id: number;
  problem_id: number;
  activity_type: ProblemActivityType;
  description: string;
  old_value: string | null;
  new_value: string | null;
  metadata: string | null; // JSON
  is_internal: number; // SQLite boolean
  created_by: number;
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
  organization_id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
  code: string;
  is_active: number;
  sort_order: number;
}

export interface RootCauseCategoryTree extends RootCauseCategory {
  children?: RootCauseCategoryTree[];
}

// ============================================
// PROBLEM ATTACHMENT
// ============================================

export interface ProblemAttachment {
  id: number;
  organization_id: number;
  problem_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  storage_provider: string;
  attachment_type: AttachmentType | null;
  description: string | null;
  uploaded_by: number;
  uploaded_at: string;
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
  source_type?: ProblemSourceType;
  source_incident_id?: number;
  assigned_to?: number;
  assigned_group_id?: number;
  symptoms?: string[];
  affected_services?: number[];
  affected_cis?: number[];
  business_impact?: string;
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
  symptoms?: string[];
  workaround?: string | null;
  workaround_effectiveness?: WorkaroundEffectiveness | null;
  permanent_fix?: string | null;
  assigned_to?: number | null;
  assigned_group_id?: number | null;
  business_impact?: string | null;
  affected_services?: number[];
  affected_cis?: number[];
  affected_users_count?: number;
}

// Link Incident to Problem Input
export interface LinkIncidentInput {
  ticket_id: number;
  relationship_type?: IncidentRelationshipType;
  notes?: string;
}

// Create Known Error Input
export interface CreateKnownErrorInput {
  title: string;
  description: string;
  problem_id?: number;
  symptoms: string[];
  root_cause: string;
  workaround: string;
  workaround_instructions?: string;
  permanent_fix_status?: PermanentFixStatus;
  permanent_fix_eta?: string;
  affected_cis?: number[];
  affected_services?: number[];
  affected_versions?: string[];
  is_public?: boolean;
}

// Update Known Error Input
export interface UpdateKnownErrorInput {
  title?: string;
  description?: string;
  symptoms?: string[];
  root_cause?: string;
  workaround?: string;
  workaround_instructions?: string | null;
  permanent_fix_status?: PermanentFixStatus;
  permanent_fix_eta?: string | null;
  permanent_fix_notes?: string | null;
  affected_cis?: number[];
  affected_services?: number[];
  affected_versions?: string[];
  is_active?: boolean;
  is_public?: boolean;
}

// Add Activity Input
export interface AddActivityInput {
  activity_type: ProblemActivityType;
  description: string;
  old_value?: string;
  new_value?: string;
  metadata?: Record<string, unknown>;
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
  is_active?: boolean;
  is_public?: boolean;
  permanent_fix_status?: PermanentFixStatus | PermanentFixStatus[];
  problem_id?: number;
  search?: string;
  created_after?: string;
  created_before?: string;
}

export interface ProblemSortOptions {
  field: 'created_at' | 'updated_at' | 'priority' | 'incident_count' | 'status';
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
  by_fix_status: Record<PermanentFixStatus, number>;
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
