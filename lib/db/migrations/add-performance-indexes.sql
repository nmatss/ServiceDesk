-- Performance Optimization Indexes
-- Run this migration to improve query performance

-- ===========================================
-- COMPOSITE INDEXES FOR HIGH-TRAFFIC QUERIES
-- ===========================================

-- Tickets: Optimize listing by tenant + status + priority (most common filter combination)
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status_priority
ON tickets(tenant_id, status_id, priority_id);

-- Tickets: Optimize listing by tenant + user (for user's own tickets)
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_user_created
ON tickets(tenant_id, user_id, created_at DESC);

-- Tickets: Optimize listing by tenant + assigned agent
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_assigned_created
ON tickets(tenant_id, assigned_to, created_at DESC);

-- Tickets: Optimize filtering by tenant + category
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_category
ON tickets(tenant_id, category_id);

-- Tickets: Covering index for common SELECT queries
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_listing
ON tickets(tenant_id, created_at DESC, status_id, priority_id, category_id, user_id);

-- ===========================================
-- LOOKUP TABLE INDEXES
-- ===========================================

-- Statuses: Optimize lookups by tenant
CREATE INDEX IF NOT EXISTS idx_statuses_tenant_name
ON statuses(tenant_id, name);

-- Priorities: Optimize lookups by tenant
CREATE INDEX IF NOT EXISTS idx_priorities_tenant_name
ON priorities(tenant_id, name);

-- Categories: Optimize lookups by tenant (including active filter)
CREATE INDEX IF NOT EXISTS idx_categories_tenant_active
ON categories(tenant_id, is_active);

-- ===========================================
-- USER-RELATED INDEXES
-- ===========================================

-- Users: Optimize lookups by email within tenant
CREATE INDEX IF NOT EXISTS idx_users_tenant_email
ON users(tenant_id, email);

-- Users: Optimize lookups by role within tenant
CREATE INDEX IF NOT EXISTS idx_users_tenant_role
ON users(tenant_id, role);

-- Users: Optimize active user queries
CREATE INDEX IF NOT EXISTS idx_users_tenant_active
ON users(tenant_id, is_active);

-- ===========================================
-- NOTIFICATION INDEXES
-- ===========================================

-- Notifications: Optimize unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, is_read, created_at DESC);

-- Notifications: Optimize tenant-based notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user
ON notifications(tenant_id, user_id, created_at DESC);

-- ===========================================
-- AUDIT LOG INDEXES
-- ===========================================

-- Audit logs: Optimize by entity type + entity id (for ticket history)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON audit_logs(entity_type, entity_id, created_at DESC);

-- Audit logs: Optimize by tenant + created_at (for admin viewing)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
ON audit_logs(tenant_id, created_at DESC);

-- ===========================================
-- COMMENTS INDEXES
-- ===========================================

-- Comments: Optimize thread loading
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created
ON comments(ticket_id, created_at ASC);

-- ===========================================
-- SLA TRACKING INDEXES
-- ===========================================

-- SLA: Optimize breach detection queries
CREATE INDEX IF NOT EXISTS idx_sla_tracking_breach
ON sla_tracking(response_breached, resolution_breached, ticket_id);

-- ===========================================
-- KNOWLEDGE BASE INDEXES
-- ===========================================

-- KB Articles: Optimize search and listing
CREATE INDEX IF NOT EXISTS idx_kb_articles_tenant_published
ON kb_articles(tenant_id, is_published, created_at DESC);

-- KB Articles: Full-text search preparation (title + content)
CREATE INDEX IF NOT EXISTS idx_kb_articles_search
ON kb_articles(tenant_id, title, slug);

-- ===========================================
-- ANALYTICS INDEXES
-- ===========================================

-- Daily metrics: Optimize date range queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_tenant_date
ON analytics_daily_metrics(tenant_id, date DESC);

-- Agent metrics: Optimize agent performance queries
CREATE INDEX IF NOT EXISTS idx_analytics_agent_tenant_date
ON analytics_agent_metrics(tenant_id, date DESC, agent_id);

-- ===========================================
-- ANALYZE TABLES (SQLite)
-- ===========================================

-- Run ANALYZE to update statistics for query optimizer
ANALYZE tickets;
ANALYZE users;
ANALYZE notifications;
ANALYZE comments;
ANALYZE statuses;
ANALYZE priorities;
ANALYZE categories;
ANALYZE audit_logs;
