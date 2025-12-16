-- ============================================
-- PROBLEM MANAGEMENT SCHEMA (SQLite Version)
-- ITIL 4 Compliant - Development Database
-- ============================================

-- ============================================
-- PROBLEMS TABLE
-- Core Problem Management entity
-- ============================================
CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  -- Identification
  problem_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'investigation', 'root_cause_identified', 'known_error', 'resolved', 'closed')
  ),

  -- Classification
  category_id INTEGER,
  priority_id INTEGER,
  impact TEXT CHECK (impact IN ('low', 'medium', 'high', 'critical')),
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')),

  -- Root Cause Analysis
  root_cause TEXT,
  root_cause_category TEXT,
  symptoms TEXT, -- JSON array

  -- Solutions
  workaround TEXT,
  workaround_effectiveness TEXT CHECK (workaround_effectiveness IN ('none', 'partial', 'full')),
  permanent_fix TEXT,

  -- Scope
  affected_services TEXT, -- JSON array
  affected_cis TEXT, -- JSON array
  affected_users_count INTEGER DEFAULT 0,
  business_impact TEXT,

  -- Assignment
  assigned_to INTEGER,
  assigned_group_id INTEGER,

  -- Known Error link
  known_error_id INTEGER,

  -- Source tracking
  source_type TEXT CHECK (source_type IN ('incident', 'proactive', 'monitoring', 'trend_analysis')),
  source_incident_id INTEGER,

  -- Metrics
  incident_count INTEGER DEFAULT 0,
  time_to_identify_hours INTEGER,
  time_to_resolve_hours INTEGER,

  -- Audit
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  identified_at DATETIME,
  resolved_at DATETIME,
  closed_at DATETIME,
  closed_by INTEGER,

  -- Constraints
  UNIQUE(organization_id, problem_number),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (priority_id) REFERENCES priorities(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (assigned_group_id) REFERENCES teams(id),
  FOREIGN KEY (source_incident_id) REFERENCES tickets(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (closed_by) REFERENCES users(id)
);

-- ============================================
-- PROBLEM_INCIDENTS (Many-to-Many link)
-- ============================================
CREATE TABLE IF NOT EXISTS problem_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  problem_id INTEGER NOT NULL,
  ticket_id INTEGER NOT NULL,

  relationship_type TEXT DEFAULT 'caused_by' CHECK (
    relationship_type IN ('caused_by', 'related', 'duplicate', 'regression')
  ),

  linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  linked_by INTEGER NOT NULL,
  notes TEXT,

  UNIQUE(problem_id, ticket_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (linked_by) REFERENCES users(id)
);

-- ============================================
-- KNOWN ERRORS DATABASE (KEDB)
-- ============================================
CREATE TABLE IF NOT EXISTS known_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  ke_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  problem_id INTEGER,

  symptoms TEXT NOT NULL, -- JSON array
  root_cause TEXT NOT NULL,
  workaround TEXT NOT NULL,
  workaround_instructions TEXT,

  permanent_fix_status TEXT DEFAULT 'pending' CHECK (
    permanent_fix_status IN ('pending', 'planned', 'in_progress', 'completed', 'wont_fix')
  ),
  permanent_fix_eta DATE,
  permanent_fix_notes TEXT,

  affected_cis TEXT,
  affected_services TEXT,
  affected_versions TEXT,

  is_active INTEGER DEFAULT 1,
  is_public INTEGER DEFAULT 0,

  times_referenced INTEGER DEFAULT 0,

  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewed_by INTEGER,

  UNIQUE(organization_id, ke_number),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- ============================================
-- PROBLEM ACTIVITIES (Timeline/History)
-- ============================================
CREATE TABLE IF NOT EXISTS problem_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  problem_id INTEGER NOT NULL,

  activity_type TEXT NOT NULL CHECK (
    activity_type IN (
      'created', 'status_changed', 'assigned', 'comment',
      'root_cause_updated', 'workaround_added', 'incident_linked',
      'known_error_created', 'resolved', 'closed', 'reopened'
    )
  ),

  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata TEXT, -- JSON

  is_internal INTEGER DEFAULT 1,

  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- ROOT CAUSE CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS root_cause_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,

  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER,
  code TEXT NOT NULL,

  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,

  UNIQUE(organization_id, code),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES root_cause_categories(id)
);

-- ============================================
-- PROBLEM ATTACHMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS problem_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  problem_id INTEGER NOT NULL,

  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  storage_provider TEXT DEFAULT 'local',

  attachment_type TEXT CHECK (
    attachment_type IN ('evidence', 'logs', 'screenshot', 'diagram', 'report', 'other')
  ),

  description TEXT,

  uploaded_by INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_problems_org ON problems(organization_id);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_problems_assigned ON problems(organization_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_problems_category ON problems(organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_problems_priority ON problems(organization_id, priority_id);
CREATE INDEX IF NOT EXISTS idx_problems_created ON problems(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_problems_number ON problems(organization_id, problem_number);

CREATE INDEX IF NOT EXISTS idx_problem_incidents_problem ON problem_incidents(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_incidents_ticket ON problem_incidents(ticket_id);
CREATE INDEX IF NOT EXISTS idx_problem_incidents_org ON problem_incidents(organization_id);

CREATE INDEX IF NOT EXISTS idx_known_errors_org ON known_errors(organization_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_active ON known_errors(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_known_errors_problem ON known_errors(problem_id);
CREATE INDEX IF NOT EXISTS idx_known_errors_number ON known_errors(organization_id, ke_number);

CREATE INDEX IF NOT EXISTS idx_problem_activities_problem ON problem_activities(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_activities_created ON problem_activities(problem_id, created_at);

CREATE INDEX IF NOT EXISTS idx_problem_attachments_problem ON problem_attachments(problem_id);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_problems_timestamp
  AFTER UPDATE ON problems
  FOR EACH ROW
  BEGIN
    UPDATE problems SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_known_errors_timestamp
  AFTER UPDATE ON known_errors
  FOR EACH ROW
  BEGIN
    UPDATE known_errors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Trigger to update incident count when linking
CREATE TRIGGER IF NOT EXISTS update_problem_incident_count_insert
  AFTER INSERT ON problem_incidents
  FOR EACH ROW
  BEGIN
    UPDATE problems
    SET incident_count = (
      SELECT COUNT(*) FROM problem_incidents WHERE problem_id = NEW.problem_id
    )
    WHERE id = NEW.problem_id;
  END;

CREATE TRIGGER IF NOT EXISTS update_problem_incident_count_delete
  AFTER DELETE ON problem_incidents
  FOR EACH ROW
  BEGIN
    UPDATE problems
    SET incident_count = (
      SELECT COUNT(*) FROM problem_incidents WHERE problem_id = OLD.problem_id
    )
    WHERE id = OLD.problem_id;
  END;
