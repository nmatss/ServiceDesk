-- Migration: Add organization_id to core tables
-- Version: 002
-- Description: Multi-tenant isolation for core entities

-- Add organization_id to users
ALTER TABLE users ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_users_organization ON users(organization_id);

-- Add organization_id to categories
ALTER TABLE categories ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_categories_organization ON categories(organization_id);

-- Add organization_id to priorities
ALTER TABLE priorities ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_priorities_organization ON priorities(organization_id);

-- Add organization_id to statuses
ALTER TABLE statuses ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_statuses_organization ON statuses(organization_id);

-- Add organization_id to tickets
ALTER TABLE tickets ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_tickets_organization ON tickets(organization_id);

-- Composite indexes for common queries
CREATE INDEX idx_tickets_org_status ON tickets(organization_id, status_id);
CREATE INDEX idx_tickets_org_assigned ON tickets(organization_id, assigned_to);
CREATE INDEX idx_tickets_org_user ON tickets(organization_id, user_id);
CREATE INDEX idx_tickets_org_created ON tickets(organization_id, created_at DESC);
