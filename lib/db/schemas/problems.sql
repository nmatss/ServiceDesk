-- ============================================
-- PROBLEM MANAGEMENT SCHEMA
-- ITIL 4 Compliant - Supabase Ready
-- ============================================

-- Enable UUID extension (Supabase uses UUIDs)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROBLEMS TABLE
-- Core Problem Management entity
-- ============================================
CREATE TABLE IF NOT EXISTS problems (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  problem_number TEXT NOT NULL, -- PRB-2024-0001 format
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'investigation', 'root_cause_identified', 'known_error', 'resolved', 'closed')
  ),

  -- Classification
  category_id INTEGER REFERENCES categories(id),
  priority_id INTEGER REFERENCES priorities(id),
  impact TEXT CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')),

  -- Root Cause Analysis
  root_cause TEXT,
  root_cause_category TEXT, -- software, hardware, network, process, human_error, external
  symptoms TEXT, -- JSON array of symptoms

  -- Solutions
  workaround TEXT,
  workaround_effectiveness TEXT CHECK (workaround_effectiveness IN ('none', 'partial', 'full')),
  permanent_fix TEXT,

  -- Scope
  affected_services TEXT, -- JSON array of service IDs
  affected_cis TEXT, -- JSON array of CI IDs (Configuration Items)
  affected_users_count INTEGER DEFAULT 0,
  business_impact TEXT,

  -- Assignment
  assigned_to INTEGER REFERENCES users(id),
  assigned_group_id INTEGER REFERENCES teams(id),

  -- Known Error link
  known_error_id INTEGER, -- Will reference known_errors table

  -- Source tracking
  source_type TEXT CHECK (source_type IN ('incident', 'proactive', 'monitoring', 'trend_analysis')),
  source_incident_id INTEGER REFERENCES tickets(id),

  -- Metrics
  incident_count INTEGER DEFAULT 0,
  time_to_identify_hours INTEGER, -- Time to identify root cause
  time_to_resolve_hours INTEGER, -- Time to implement permanent fix

  -- Audit
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  identified_at TIMESTAMP WITH TIME ZONE, -- When root cause was identified
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by INTEGER REFERENCES users(id),

  -- Constraints
  UNIQUE(organization_id, problem_number)
);

-- ============================================
-- PROBLEM_INCIDENTS (Many-to-Many link)
-- Links problems to related incidents
-- ============================================
CREATE TABLE IF NOT EXISTS problem_incidents (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,

  -- Relationship type
  relationship_type TEXT DEFAULT 'caused_by' CHECK (
    relationship_type IN ('caused_by', 'related', 'duplicate', 'regression')
  ),

  -- Audit
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  linked_by INTEGER NOT NULL REFERENCES users(id),
  notes TEXT,

  -- Prevent duplicates
  UNIQUE(problem_id, ticket_id)
);

-- ============================================
-- KNOWN ERRORS DATABASE (KEDB)
-- Documented problems with known workarounds
-- ============================================
CREATE TABLE IF NOT EXISTS known_errors (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identification
  ke_number TEXT NOT NULL, -- KE-2024-0001 format
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Source
  problem_id INTEGER REFERENCES problems(id),

  -- Documentation
  symptoms TEXT NOT NULL, -- JSON array of symptom descriptions
  root_cause TEXT NOT NULL,
  workaround TEXT NOT NULL,
  workaround_instructions TEXT, -- Step-by-step guide

  -- Fix status
  permanent_fix_status TEXT DEFAULT 'pending' CHECK (
    permanent_fix_status IN ('pending', 'planned', 'in_progress', 'completed', 'wont_fix')
  ),
  permanent_fix_eta DATE,
  permanent_fix_notes TEXT,

  -- Scope
  affected_cis TEXT, -- JSON array of CI IDs
  affected_services TEXT, -- JSON array
  affected_versions TEXT, -- JSON array of affected software versions

  -- Status
  is_active INTEGER DEFAULT 1,
  is_public INTEGER DEFAULT 0, -- Visible to end users?

  -- Metrics
  times_referenced INTEGER DEFAULT 0, -- How many times this KE helped

  -- Audit
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by INTEGER REFERENCES users(id),

  UNIQUE(organization_id, ke_number)
);

-- ============================================
-- PROBLEM ACTIVITIES (Timeline/History)
-- Tracks all activities on a problem
-- ============================================
CREATE TABLE IF NOT EXISTS problem_activities (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,

  -- Activity type
  activity_type TEXT NOT NULL CHECK (
    activity_type IN (
      'created', 'status_changed', 'assigned', 'comment',
      'root_cause_updated', 'workaround_added', 'incident_linked',
      'known_error_created', 'resolved', 'closed', 'reopened'
    )
  ),

  -- Content
  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata TEXT, -- JSON for additional data

  -- Visibility
  is_internal INTEGER DEFAULT 1, -- Internal note vs visible to affected users

  -- Audit
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ROOT CAUSE CATEGORIES
-- Standardized root cause classification
-- ============================================
CREATE TABLE IF NOT EXISTS root_cause_categories (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES root_cause_categories(id),

  -- Examples: software_bug, hardware_failure, network_issue,
  -- configuration_error, capacity_issue, human_error, external_dependency
  code TEXT NOT NULL,

  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,

  UNIQUE(organization_id, code)
);

-- ============================================
-- PROBLEM ATTACHMENTS
-- Files related to problem investigation
-- ============================================
CREATE TABLE IF NOT EXISTS problem_attachments (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  storage_provider TEXT DEFAULT 'local', -- local, s3, supabase_storage

  -- Classification
  attachment_type TEXT CHECK (
    attachment_type IN ('evidence', 'logs', 'screenshot', 'diagram', 'report', 'other')
  ),

  description TEXT,

  -- Audit
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Problems indexes
CREATE INDEX IF NOT EXISTS idx_problems_org ON problems(organization_id);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_problems_assigned ON problems(organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_problems_category ON problems(organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_problems_priority ON problems(organization_id, priority_id);
CREATE INDEX IF NOT EXISTS idx_problems_created ON problems(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_problems_number ON problems(organization_id, problem_number);

-- Problem_incidents indexes
CREATE INDEX IF NOT EXISTS idx_problem_incidents_problem ON problem_incidents(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_incidents_ticket ON problem_incidents(ticket_id);
CREATE INDEX IF NOT EXISTS idx_problem_incidents_org ON problem_incidents(organization_id);

-- Known errors indexes
CREATE INDEX IF NOT EXISTS idx_known_errors_org ON known_errors(organization_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_active ON known_errors(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_known_errors_problem ON known_errors(problem_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_number ON known_errors(organization_id, ke_number);

-- Problem activities indexes
CREATE INDEX IF NOT EXISTS idx_problem_activities_problem ON problem_activities(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_activities_created ON problem_activities(problem_id, created_at DESC);

-- Problem attachments indexes
CREATE INDEX IF NOT EXISTS idx_problem_attachments_problem ON problem_attachments(problem_id);

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Update timestamp trigger function (PostgreSQL)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to problems table
DROP TRIGGER IF EXISTS update_problems_updated_at ON problems;
CREATE TRIGGER update_problems_updated_at
  BEFORE UPDATE ON problems
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to known_errors table
DROP TRIGGER IF EXISTS update_known_errors_updated_at ON known_errors;
CREATE TRIGGER update_known_errors_updated_at
  BEFORE UPDATE ON known_errors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (SUPABASE)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_cause_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_attachments ENABLE ROW LEVEL SECURITY;

-- Problems policies
CREATE POLICY "Users can view problems in their organization"
  ON problems FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

CREATE POLICY "Agents can insert problems in their organization"
  ON problems FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::INTEGER);

CREATE POLICY "Agents can update problems in their organization"
  ON problems FOR UPDATE
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::INTEGER);

CREATE POLICY "Admins can delete problems in their organization"
  ON problems FOR DELETE
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

-- Problem incidents policies
CREATE POLICY "Users can view problem_incidents in their organization"
  ON problem_incidents FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

CREATE POLICY "Agents can manage problem_incidents in their organization"
  ON problem_incidents FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::INTEGER);

-- Known errors policies
CREATE POLICY "Users can view active known_errors in their organization"
  ON known_errors FOR SELECT
  USING (
    organization_id = current_setting('app.current_organization_id')::INTEGER
    AND (is_active = 1 OR current_setting('app.current_user_role') IN ('admin', 'agent'))
  );

CREATE POLICY "Agents can manage known_errors in their organization"
  ON known_errors FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::INTEGER);

-- Problem activities policies
CREATE POLICY "Users can view problem_activities in their organization"
  ON problem_activities FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

CREATE POLICY "Agents can insert problem_activities in their organization"
  ON problem_activities FOR INSERT
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::INTEGER);

-- Root cause categories policies
CREATE POLICY "Users can view root_cause_categories in their organization"
  ON root_cause_categories FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

CREATE POLICY "Admins can manage root_cause_categories in their organization"
  ON root_cause_categories FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::INTEGER);

-- Problem attachments policies
CREATE POLICY "Users can view problem_attachments in their organization"
  ON problem_attachments FOR SELECT
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER);

CREATE POLICY "Agents can manage problem_attachments in their organization"
  ON problem_attachments FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::INTEGER)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::INTEGER);

-- ============================================
-- SEED DATA FOR ROOT CAUSE CATEGORIES
-- ============================================
-- Note: Run this separately for each organization
-- INSERT INTO root_cause_categories (organization_id, name, code, description) VALUES
-- (1, 'Software Bug', 'software_bug', 'Defect in application code'),
-- (1, 'Hardware Failure', 'hardware_failure', 'Physical hardware malfunction'),
-- (1, 'Network Issue', 'network_issue', 'Network connectivity or performance problem'),
-- (1, 'Configuration Error', 'configuration_error', 'Incorrect system configuration'),
-- (1, 'Capacity Issue', 'capacity_issue', 'Resource exhaustion or scaling problem'),
-- (1, 'Human Error', 'human_error', 'Mistake made by operator or user'),
-- (1, 'External Dependency', 'external_dependency', 'Issue with third-party service or vendor'),
-- (1, 'Security Incident', 'security_incident', 'Security-related root cause'),
-- (1, 'Data Corruption', 'data_corruption', 'Data integrity issue'),
-- (1, 'Unknown', 'unknown', 'Root cause not yet determined');
