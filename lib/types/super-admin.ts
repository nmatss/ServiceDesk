/**
 * TypeScript types for the Super Admin area.
 */

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export interface OrganizationListItem {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  subscription_plan: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  max_users: number;
  max_tickets_per_month: number;
  is_active: boolean | number;
  billing_email: string | null;
  created_at: string;
  updated_at: string;
  user_count: number;
  ticket_count: number;
}

export interface OrganizationDetail extends OrganizationListItem {
  settings: string | null;
  features: string | null;
}

export interface OrgFormData {
  name: string;
  slug: string;
  domain?: string;
  subscription_plan: string;
  max_users: number;
  max_tickets_per_month: number;
  billing_email?: string;
  features?: string[];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface SuperAdminDashboardStats {
  total_orgs: number;
  active_orgs: number;
  total_users: number;
  total_tickets: number;
  tickets_last_30_days: number;
  open_tickets: number;
}

export interface DashboardAlert {
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  org_id?: number;
  org_name?: string;
}

export interface RecentOrganization {
  id: number;
  name: string;
  slug: string;
  subscription_plan: string;
  created_at: string;
  user_count: number;
}

// ---------------------------------------------------------------------------
// Cross-Tenant Users
// ---------------------------------------------------------------------------

export interface CrossTenantUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean | number;
  organization_id: number;
  organization_name: string;
  organization_slug: string;
  last_login: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  organization_id: number;
  organization_name: string;
  entity_type: string;
  entity_id: number | null;
  action: string;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// System Settings
// ---------------------------------------------------------------------------

export interface SystemSettings {
  // Geral
  system_name: string;
  base_url: string;
  maintenance_mode: boolean;

  // Limites globais
  max_organizations: number;
  default_max_users_per_org: number;
  default_max_tickets_per_org: number;

  // Email / SMTP
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_from_email: string;
  smtp_from_name: string;

  // Segurança
  password_min_length: number;
  session_timeout_minutes: number;
  require_2fa: boolean;
  max_login_attempts: number;
}
