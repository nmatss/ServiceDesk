-- Migration 014: Add SLA tracking columns to tickets table
-- This migration adds direct SLA tracking columns to the tickets table
-- to support the SLA API and provide faster queries without joining sla_tracking table
-- Created: 2025-12-13

-- Add SLA tracking columns to tickets table
ALTER TABLE tickets ADD COLUMN sla_policy_id INTEGER REFERENCES sla_policies(id);
ALTER TABLE tickets ADD COLUMN sla_deadline DATETIME;
ALTER TABLE tickets ADD COLUMN sla_status TEXT DEFAULT 'on_track' CHECK(sla_status IN ('on_track', 'at_risk', 'breached'));
ALTER TABLE tickets ADD COLUMN sla_first_response_at DATETIME;
ALTER TABLE tickets ADD COLUMN sla_resolution_at DATETIME;
ALTER TABLE tickets ADD COLUMN escalation_level INTEGER DEFAULT 0;
ALTER TABLE tickets ADD COLUMN escalated_at DATETIME;

-- Create indexes for SLA queries
CREATE INDEX IF NOT EXISTS idx_tickets_sla_status ON tickets(sla_status) WHERE sla_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_sla_deadline ON tickets(sla_deadline) WHERE sla_deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_escalation ON tickets(escalation_level) WHERE escalation_level > 0;
CREATE INDEX IF NOT EXISTS idx_tickets_sla_policy ON tickets(sla_policy_id) WHERE sla_policy_id IS NOT NULL;

-- Composite index for SLA dashboard queries
CREATE INDEX IF NOT EXISTS idx_tickets_sla_tracking_dashboard
ON tickets(organization_id, sla_status, sla_deadline, status_id)
WHERE sla_policy_id IS NOT NULL;

-- Trigger to update SLA deadline when ticket is created
CREATE TRIGGER IF NOT EXISTS set_sla_deadline_on_ticket_insert
AFTER INSERT ON tickets
WHEN NEW.sla_policy_id IS NOT NULL
BEGIN
  UPDATE tickets
  SET sla_deadline = datetime(NEW.created_at, '+' ||
    COALESCE((SELECT resolution_time_minutes FROM sla_policies WHERE id = NEW.sla_policy_id), 1440) || ' minutes'),
      sla_status = 'on_track'
  WHERE id = NEW.id;
END;

-- Trigger to update SLA status based on deadline proximity
CREATE TRIGGER IF NOT EXISTS update_sla_status_on_ticket_update
AFTER UPDATE ON tickets
WHEN NEW.sla_deadline IS NOT NULL AND NEW.resolved_at IS NULL
BEGIN
  UPDATE tickets
  SET sla_status = CASE
    -- Already breached
    WHEN datetime('now') > datetime(NEW.sla_deadline) THEN 'breached'
    -- At risk (within 30 minutes of deadline)
    WHEN datetime('now') > datetime(NEW.sla_deadline, '-30 minutes') THEN 'at_risk'
    -- On track
    ELSE 'on_track'
  END
  WHERE id = NEW.id;
END;

-- Trigger to mark first response time
CREATE TRIGGER IF NOT EXISTS mark_sla_first_response
AFTER INSERT ON comments
WHEN NEW.user_id IN (SELECT id FROM users WHERE role IN ('admin', 'agent'))
  AND (SELECT sla_first_response_at FROM tickets WHERE id = NEW.ticket_id) IS NULL
BEGIN
  UPDATE tickets
  SET sla_first_response_at = CURRENT_TIMESTAMP
  WHERE id = NEW.ticket_id;
END;

-- Trigger to mark resolution time when ticket is resolved
CREATE TRIGGER IF NOT EXISTS mark_sla_resolution
AFTER UPDATE ON tickets
WHEN OLD.status_id != NEW.status_id
  AND NEW.status_id IN (SELECT id FROM statuses WHERE is_final = 1)
  AND NEW.sla_resolution_at IS NULL
BEGIN
  UPDATE tickets
  SET sla_resolution_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

-- Migrate existing data from sla_tracking to tickets table
-- This populates the new columns with data from the existing sla_tracking table
UPDATE tickets
SET
  sla_policy_id = (SELECT sla_policy_id FROM sla_tracking WHERE ticket_id = tickets.id LIMIT 1),
  sla_deadline = (SELECT resolution_due_at FROM sla_tracking WHERE ticket_id = tickets.id LIMIT 1),
  sla_status = CASE
    WHEN datetime('now') > (SELECT resolution_due_at FROM sla_tracking WHERE ticket_id = tickets.id LIMIT 1) THEN 'breached'
    WHEN datetime('now') > datetime((SELECT resolution_due_at FROM sla_tracking WHERE ticket_id = tickets.id LIMIT 1), '-30 minutes') THEN 'at_risk'
    ELSE 'on_track'
  END,
  sla_first_response_at = (
    SELECT MIN(created_at)
    FROM comments
    WHERE ticket_id = tickets.id
      AND user_id IN (SELECT id FROM users WHERE role IN ('admin', 'agent'))
  ),
  sla_resolution_at = tickets.resolved_at
WHERE EXISTS (SELECT 1 FROM sla_tracking WHERE ticket_id = tickets.id);

-- Update escalation level from escalations table
UPDATE tickets
SET
  escalation_level = (SELECT COUNT(*) FROM escalations WHERE ticket_id = tickets.id),
  escalated_at = (SELECT MAX(escalated_at) FROM escalations WHERE ticket_id = tickets.id)
WHERE EXISTS (SELECT 1 FROM escalations WHERE ticket_id = tickets.id);

-- Note: This migration maintains backward compatibility with the existing sla_tracking table
-- The sla_tracking table will continue to work and can be used for detailed SLA analytics
-- The new columns in tickets table provide faster queries and simpler API access
