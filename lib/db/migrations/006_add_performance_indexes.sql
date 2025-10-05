-- ============================================
-- Performance Indexes Migration
-- ============================================
-- Adds critical indexes for query performance optimization
-- Based on common access patterns and audit findings

-- ============================================
-- TICKETS TABLE INDEXES
-- ============================================

-- Index for tenant isolation and status filtering (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status
  ON tickets(tenant_id, status_id, created_at DESC);

-- Index for user's tickets lookup
CREATE INDEX IF NOT EXISTS idx_tickets_user
  ON tickets(user_id, created_at DESC);

-- Index for assigned tickets lookup (agent view)
CREATE INDEX IF NOT EXISTS idx_tickets_assigned
  ON tickets(assigned_to, status_id, created_at DESC);

-- Index for SLA deadline queries
CREATE INDEX IF NOT EXISTS idx_tickets_sla
  ON tickets(sla_deadline, status_id)
  WHERE sla_deadline IS NOT NULL;

-- Index for priority-based filtering
CREATE INDEX IF NOT EXISTS idx_tickets_priority
  ON tickets(tenant_id, priority_id, created_at DESC);

-- Index for category-based filtering
CREATE INDEX IF NOT EXISTS idx_tickets_category
  ON tickets(tenant_id, category_id, created_at DESC);

-- Full-text search index on title and description
CREATE INDEX IF NOT EXISTS idx_tickets_title_fts
  ON tickets(title);

-- ============================================
-- USERS TABLE INDEXES
-- ============================================

-- Index for email lookups (login, password reset)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- Index for tenant user lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant
  ON users(tenant_id, is_active);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(tenant_id, role, is_active);

-- Index for session management
CREATE INDEX IF NOT EXISTS idx_users_last_login
  ON users(last_login_at DESC)
  WHERE last_login_at IS NOT NULL;

-- ============================================
-- COMMENTS TABLE INDEXES
-- ============================================

-- Index for ticket comments retrieval
CREATE INDEX IF NOT EXISTS idx_comments_ticket
  ON comments(ticket_id, created_at ASC);

-- Index for user's comments
CREATE INDEX IF NOT EXISTS idx_comments_user
  ON comments(user_id, created_at DESC);

-- Index for internal/public comment filtering
CREATE INDEX IF NOT EXISTS idx_comments_visibility
  ON comments(ticket_id, is_internal, created_at ASC);

-- ============================================
-- ATTACHMENTS TABLE INDEXES
-- ============================================

-- Index for ticket attachments
CREATE INDEX IF NOT EXISTS idx_attachments_ticket
  ON attachments(ticket_id, created_at DESC);

-- Index for comment attachments
CREATE INDEX IF NOT EXISTS idx_attachments_comment
  ON attachments(comment_id, created_at DESC)
  WHERE comment_id IS NOT NULL;

-- ============================================
-- NOTIFICATIONS TABLE INDEXES
-- ============================================

-- Index for user notifications (unread first)
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, is_read, created_at DESC);

-- Index for cleanup of old read notifications
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup
  ON notifications(is_read, created_at)
  WHERE is_read = 1;

-- ============================================
-- SLA TRACKING INDEXES
-- ============================================

-- Index for active SLA monitoring
CREATE INDEX IF NOT EXISTS idx_sla_tracking_active
  ON sla_tracking(ticket_id, is_breached, resolution_deadline)
  WHERE is_breached = 0;

-- Index for breached SLAs
CREATE INDEX IF NOT EXISTS idx_sla_tracking_breached
  ON sla_tracking(ticket_id, breach_time DESC)
  WHERE is_breached = 1;

-- ============================================
-- KNOWLEDGE BASE INDEXES
-- ============================================

-- Index for published articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_published
  ON kb_articles(is_published, views DESC, created_at DESC);

-- Index for category browsing
CREATE INDEX IF NOT EXISTS idx_kb_articles_category
  ON kb_articles(category_id, is_published, views DESC);

-- Index for author's articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_author
  ON kb_articles(author_id, created_at DESC);

-- Full-text search on articles
CREATE INDEX IF NOT EXISTS idx_kb_articles_title
  ON kb_articles(title);

-- ============================================
-- ANALYTICS INDEXES
-- ============================================

-- Index for daily metrics queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_tenant
  ON analytics_daily_metrics(tenant_id, metric_date DESC);

-- Index for agent performance
CREATE INDEX IF NOT EXISTS idx_analytics_agent
  ON analytics_agent_metrics(tenant_id, agent_id, metric_date DESC);

-- ============================================
-- AUDIT LOGS INDEXES
-- ============================================

-- Index for tenant audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant
  ON audit_logs(tenant_id, created_at DESC);

-- Index for user audit trail
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON audit_logs(user_id, created_at DESC);

-- Index for entity-specific audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at DESC);

-- Index for action-based queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(tenant_id, action, created_at DESC);

-- ============================================
-- AUTHENTICATION INDEXES
-- ============================================

-- Index for refresh token validation
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON refresh_tokens(token_hash, is_active, expires_at)
  WHERE is_active = 1;

-- Index for user's active sessions
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens(user_id, is_active, created_at DESC);

-- Index for login attempts monitoring
CREATE INDEX IF NOT EXISTS idx_login_attempts_email
  ON login_attempts(email, created_at DESC);

-- Index for IP-based login monitoring
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip
  ON login_attempts(ip_address, created_at DESC);

-- ============================================
-- RBAC INDEXES
-- ============================================

-- Index for user role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON user_roles(user_id, is_active);

-- Index for role membership queries
CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles(role_id, is_active);

-- Index for role permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON role_permissions(role_id);

-- ============================================
-- WORKFLOWS & AUTOMATION INDEXES
-- ============================================

-- Index for active automations
CREATE INDEX IF NOT EXISTS idx_automations_active
  ON automations(tenant_id, is_active, trigger_event);

-- Index for workflow execution history
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow
  ON workflow_executions(workflow_id, created_at DESC);

-- Index for failed workflow executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_failed
  ON workflow_executions(status, created_at DESC)
  WHERE status = 'failed';

-- ============================================
-- RATE LIMITING INDEXES
-- ============================================

-- Index for rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier
  ON rate_limits(identifier, identifier_type, endpoint, last_attempt_at DESC);

-- Index for rate limit cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON rate_limits(last_attempt_at)
  WHERE blocked_until IS NULL OR blocked_until < datetime('now');

-- ============================================
-- VERIFICATION CODES INDEXES
-- ============================================

-- Index for code verification
CREATE INDEX IF NOT EXISTS idx_verification_codes_lookup
  ON verification_codes(email, code, type, expires_at)
  WHERE used_at IS NULL;

-- ============================================
-- PASSWORD HISTORY INDEXES
-- ============================================

-- Index for password reuse checking
CREATE INDEX IF NOT EXISTS idx_password_history_user
  ON password_history(user_id, created_at DESC);

-- ============================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================

-- Composite index for tenant + organization queries
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_org
  ON tickets(tenant_id, organization_id, created_at DESC);

-- Composite index for status + priority filtering
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority
  ON tickets(status_id, priority_id, created_at DESC);

-- ============================================
-- PARTIAL INDEXES (SQLITE 3.8.0+)
-- ============================================

-- Index only active users
CREATE INDEX IF NOT EXISTS idx_users_active
  ON users(tenant_id, created_at DESC)
  WHERE is_active = 1;

-- Index only unresolved tickets
CREATE INDEX IF NOT EXISTS idx_tickets_unresolved
  ON tickets(tenant_id, created_at DESC, priority_id)
  WHERE status_id IN (
    SELECT id FROM statuses WHERE name IN ('Novo', 'Em Andamento', 'Aguardando Cliente', 'New', 'In Progress', 'Pending')
  );

-- Index only verified users
CREATE INDEX IF NOT EXISTS idx_users_verified
  ON users(tenant_id)
  WHERE is_email_verified = 1;

-- ============================================
-- COVERING INDEXES (for SELECT without table access)
-- ============================================

-- Covering index for ticket list view
CREATE INDEX IF NOT EXISTS idx_tickets_list_covering
  ON tickets(tenant_id, status_id, priority_id, created_at DESC, id, title);

-- ============================================
-- CLEANUP OLD INDEXES (if any conflicting ones exist)
-- ============================================

-- No old indexes to drop in this migration

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

-- Update statistics for query optimizer
ANALYZE;

-- ============================================
-- VERIFICATION
-- ============================================

-- Count indexes created
SELECT COUNT(*) as index_count
FROM sqlite_master
WHERE type = 'index'
  AND name LIKE 'idx_%';
