-- =====================================================
-- CRITICAL INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================
-- Agent 13: Database Optimization
-- Created: 2025-12-25
-- SIMPLIFIED VERSION - Works with actual schema
-- =====================================================

-- 1. DASHBOARD QUERIES - Status + assignment filtering
CREATE INDEX IF NOT EXISTS idx_tickets_status_assigned
  ON tickets(status_id, assigned_to);

-- 2. TIMELINE QUERIES - Date-based sorting with status
CREATE INDEX IF NOT EXISTS idx_tickets_created_status
  ON tickets(created_at DESC, status_id);

-- 3. SEARCH QUERIES - Full-text search on ticket titles
CREATE INDEX IF NOT EXISTS idx_tickets_search_title
  ON tickets(title COLLATE NOCASE);

-- 4. SLA TRACKING - Ticket-based SLA lookups with status
CREATE INDEX IF NOT EXISTS idx_sla_tracking_ticket_status
  ON sla_tracking(ticket_id, response_met, resolution_met);

-- 5. USER PERFORMANCE - Agent-based ticket resolution metrics
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_resolved
  ON tickets(assigned_to, status_id, resolved_at);

-- 6. NOTIFICATIONS - User notification center queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read, created_at DESC);

-- 7. COMMENTS - Comments by ticket (for ticket detail pages)
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created
  ON comments(ticket_id, created_at ASC);

-- 8. ATTACHMENTS - Attachments by ticket (for file listings)
CREATE INDEX IF NOT EXISTS idx_attachments_ticket
  ON attachments(ticket_id, created_at DESC);

-- 9. TICKETS - Category-based filtering
CREATE INDEX IF NOT EXISTS idx_tickets_category
  ON tickets(category_id, status_id);

-- 10. TICKETS - Priority-based filtering
CREATE INDEX IF NOT EXISTS idx_tickets_priority
  ON tickets(priority_id, status_id);

-- Update database statistics
ANALYZE;
