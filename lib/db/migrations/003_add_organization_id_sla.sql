-- Migration: Add organization_id to SLA tables
-- Version: 003
-- Description: Adds multi-tenant support to SLA-related tables

-- Add organization_id to sla_policies table
ALTER TABLE sla_policies ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_sla_policies_organization ON sla_policies(organization_id);
CREATE INDEX idx_sla_policies_org_active ON sla_policies(organization_id, is_active);

-- Add organization_id to sla_tracking table
ALTER TABLE sla_tracking ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_sla_tracking_organization ON sla_tracking(organization_id);

-- Add organization_id to escalations table
ALTER TABLE escalations ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_escalations_organization ON escalations(organization_id);

-- Add organization_id to notifications table
ALTER TABLE notifications ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_organization ON notifications(organization_id);
CREATE INDEX idx_notifications_org_user ON notifications(organization_id, user_id, is_read);
