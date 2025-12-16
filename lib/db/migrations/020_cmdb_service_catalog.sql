-- Migration: 018_cmdb_service_catalog.sql
-- Description: Implements CMDB (Configuration Management Database) and Service Catalog for ITIL compliance
-- Date: 2024-12-14

-- =====================================================
-- CMDB (Configuration Management Database) Tables
-- =====================================================

-- CI Types (e.g., Server, Network Device, Application, Database, etc.)
CREATE TABLE IF NOT EXISTS ci_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT DEFAULT 'server',
    color TEXT DEFAULT 'blue',
    parent_type_id INTEGER REFERENCES ci_types(id),
    attributes_schema TEXT, -- JSON schema for custom attributes
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CI Status (e.g., Active, Inactive, Under Maintenance, Retired)
CREATE TABLE IF NOT EXISTS ci_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT 'gray',
    is_operational BOOLEAN DEFAULT TRUE, -- Whether CI is considered operational
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configuration Items (CIs) - Core CMDB table
CREATE TABLE IF NOT EXISTS configuration_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ci_number TEXT UNIQUE NOT NULL, -- e.g., CI-0001
    name TEXT NOT NULL,
    description TEXT,
    ci_type_id INTEGER NOT NULL REFERENCES ci_types(id),
    status_id INTEGER NOT NULL REFERENCES ci_statuses(id),
    organization_id INTEGER NOT NULL DEFAULT 1,

    -- Ownership and responsibility
    owner_id INTEGER REFERENCES users(id),
    managed_by_team_id INTEGER REFERENCES teams(id),
    vendor TEXT,
    manufacturer TEXT,

    -- Location and environment
    location TEXT,
    environment TEXT CHECK(environment IN ('production', 'staging', 'development', 'test', 'dr')),
    data_center TEXT,
    rack_position TEXT,

    -- Lifecycle
    purchase_date DATE,
    installation_date DATE,
    warranty_expiry DATE,
    end_of_life_date DATE,
    retirement_date DATE,

    -- Technical details
    serial_number TEXT,
    asset_tag TEXT,
    ip_address TEXT,
    mac_address TEXT,
    hostname TEXT,
    os_version TEXT,

    -- Business context
    business_service TEXT,
    criticality TEXT CHECK(criticality IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
    business_impact TEXT,
    recovery_time_objective INTEGER, -- RTO in minutes
    recovery_point_objective INTEGER, -- RPO in minutes

    -- Custom attributes (JSON)
    custom_attributes TEXT DEFAULT '{}',

    -- Audit fields
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    UNIQUE(asset_tag, organization_id),
    UNIQUE(serial_number, organization_id)
);

-- CI Relationship Types (e.g., depends_on, hosts, connects_to, uses)
CREATE TABLE IF NOT EXISTS ci_relationship_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    inverse_name TEXT, -- e.g., if "depends_on", inverse is "depended_by"
    color TEXT DEFAULT 'gray',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CI Relationships (linking CIs together)
CREATE TABLE IF NOT EXISTS ci_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_ci_id INTEGER NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
    target_ci_id INTEGER NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
    relationship_type_id INTEGER NOT NULL REFERENCES ci_relationship_types(id),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(source_ci_id, target_ci_id, relationship_type_id)
);

-- CI History/Audit (track all changes to CIs)
CREATE TABLE IF NOT EXISTS ci_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ci_id INTEGER NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK(action IN ('created', 'updated', 'deleted', 'status_changed', 'relationship_added', 'relationship_removed')),
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    changed_by INTEGER REFERENCES users(id),
    change_reason TEXT,
    related_ticket_id INTEGER REFERENCES tickets(id),
    related_change_id INTEGER, -- Reference to change request
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CI-Ticket Links (link CIs to tickets)
CREATE TABLE IF NOT EXISTS ci_ticket_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ci_id INTEGER NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    link_type TEXT CHECK(link_type IN ('affected', 'caused_by', 'related', 'changed')) DEFAULT 'affected',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(ci_id, ticket_id, link_type)
);

-- =====================================================
-- SERVICE CATALOG Tables
-- =====================================================

-- Service Categories (e.g., IT Services, HR Services, Facilities)
CREATE TABLE IF NOT EXISTS service_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'folder',
    color TEXT DEFAULT 'blue',
    parent_category_id INTEGER REFERENCES service_categories(id),
    display_order INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE, -- Visible in customer portal
    is_active BOOLEAN DEFAULT TRUE,
    organization_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service Catalog Items
CREATE TABLE IF NOT EXISTS service_catalog_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    short_description TEXT,
    description TEXT,
    category_id INTEGER NOT NULL REFERENCES service_categories(id),
    organization_id INTEGER NOT NULL DEFAULT 1,

    -- Display
    icon TEXT DEFAULT 'inbox',
    image_url TEXT,
    display_order INTEGER DEFAULT 0,

    -- Request configuration
    form_schema TEXT, -- JSON schema for request form
    default_priority_id INTEGER REFERENCES priorities(id),
    default_category_id INTEGER REFERENCES categories(id),

    -- SLA and fulfillment
    sla_policy_id INTEGER REFERENCES sla_policies(id),
    estimated_fulfillment_time INTEGER, -- in minutes
    fulfillment_team_id INTEGER REFERENCES teams(id),

    -- Approval workflow
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_workflow_id INTEGER REFERENCES workflow_definitions(id),
    auto_approve_roles TEXT, -- JSON array of roles that bypass approval

    -- Cost and visibility
    cost_type TEXT CHECK(cost_type IN ('free', 'fixed', 'variable', 'quote')) DEFAULT 'free',
    base_cost DECIMAL(10,2) DEFAULT 0,
    cost_currency TEXT DEFAULT 'BRL',
    is_public BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,

    -- Availability
    is_active BOOLEAN DEFAULT TRUE,
    available_from DATE,
    available_until DATE,

    -- Usage tracking
    request_count INTEGER DEFAULT 0,
    avg_fulfillment_time INTEGER DEFAULT 0,
    satisfaction_rating DECIMAL(3,2) DEFAULT 0,

    -- Metadata
    tags TEXT, -- JSON array
    keywords TEXT, -- For search
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service Catalog Item Dependencies (what CIs are needed)
CREATE TABLE IF NOT EXISTS service_catalog_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_item_id INTEGER NOT NULL REFERENCES service_catalog_items(id) ON DELETE CASCADE,
    ci_id INTEGER REFERENCES configuration_items(id),
    dependency_type TEXT CHECK(dependency_type IN ('required', 'optional', 'affected')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service Requests (instances of catalog item requests)
CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number TEXT UNIQUE NOT NULL, -- e.g., SR-0001
    catalog_item_id INTEGER NOT NULL REFERENCES service_catalog_items(id),
    ticket_id INTEGER REFERENCES tickets(id), -- Link to ticket if created

    -- Requester info
    requester_id INTEGER NOT NULL REFERENCES users(id),
    requester_name TEXT,
    requester_email TEXT,
    requester_department TEXT,
    on_behalf_of_id INTEGER REFERENCES users(id),

    -- Request details
    form_data TEXT NOT NULL DEFAULT '{}', -- JSON form submission
    justification TEXT,
    requested_date DATE,

    -- Status and workflow
    status TEXT CHECK(status IN ('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'in_progress', 'fulfilled', 'cancelled', 'failed')) DEFAULT 'submitted',
    approval_status TEXT CHECK(approval_status IN ('pending', 'approved', 'rejected', 'not_required')),
    approved_by INTEGER REFERENCES users(id),
    approved_at DATETIME,
    rejection_reason TEXT,

    -- Fulfillment
    fulfilled_by INTEGER REFERENCES users(id),
    fulfilled_at DATETIME,
    fulfillment_notes TEXT,

    -- Cost tracking
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),

    -- Satisfaction
    satisfaction_rating INTEGER CHECK(satisfaction_rating BETWEEN 1 AND 5),
    satisfaction_comment TEXT,

    organization_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service Request Approvals (multi-level approval tracking)
CREATE TABLE IF NOT EXISTS service_request_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    approval_level INTEGER DEFAULT 1,
    approver_id INTEGER REFERENCES users(id),
    approver_role TEXT,

    status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'delegated', 'expired')) DEFAULT 'pending',
    decision_at DATETIME,
    comments TEXT,
    delegated_to INTEGER REFERENCES users(id),

    due_date DATETIME,
    reminded_at DATETIME,
    reminder_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service Request Tasks (fulfillment tasks)
CREATE TABLE IF NOT EXISTS service_request_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    task_order INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    description TEXT,

    assigned_to INTEGER REFERENCES users(id),
    assigned_team_id INTEGER REFERENCES teams(id),

    status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')) DEFAULT 'pending',
    started_at DATETIME,
    completed_at DATETIME,
    completion_notes TEXT,

    estimated_minutes INTEGER,
    actual_minutes INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- CHANGE MANAGEMENT ENHANCEMENTS (CAB Support)
-- =====================================================

-- Change Types
CREATE TABLE IF NOT EXISTS change_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    requires_cab_approval BOOLEAN DEFAULT FALSE,
    default_risk_level TEXT CHECK(default_risk_level IN ('low', 'medium', 'high', 'critical')),
    lead_time_days INTEGER DEFAULT 0, -- Minimum lead time for this change type
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Change Advisory Board (CAB) Configuration
CREATE TABLE IF NOT EXISTS cab_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    organization_id INTEGER NOT NULL DEFAULT 1,

    -- Schedule
    meeting_day TEXT, -- e.g., 'wednesday'
    meeting_time TEXT, -- e.g., '14:00'
    meeting_duration INTEGER DEFAULT 60, -- minutes
    meeting_location TEXT,
    meeting_url TEXT, -- Virtual meeting link

    -- Members
    chair_user_id INTEGER REFERENCES users(id),
    secretary_user_id INTEGER REFERENCES users(id),

    -- Quorum
    minimum_members INTEGER DEFAULT 3,
    quorum_percentage INTEGER DEFAULT 50,

    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CAB Members
CREATE TABLE IF NOT EXISTS cab_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cab_id INTEGER NOT NULL REFERENCES cab_configurations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT CHECK(role IN ('chair', 'secretary', 'member', 'advisor')) DEFAULT 'member',
    is_voting_member BOOLEAN DEFAULT TRUE,
    expertise_areas TEXT, -- JSON array
    is_active BOOLEAN DEFAULT TRUE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(cab_id, user_id)
);

-- CAB Meetings
CREATE TABLE IF NOT EXISTS cab_meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cab_id INTEGER NOT NULL REFERENCES cab_configurations(id),
    meeting_date DATETIME NOT NULL,
    meeting_type TEXT CHECK(meeting_type IN ('regular', 'emergency', 'virtual')) DEFAULT 'regular',

    status TEXT CHECK(status IN ('scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'scheduled',

    -- Attendance
    attendees TEXT, -- JSON array of user IDs
    actual_start DATETIME,
    actual_end DATETIME,

    -- Notes
    agenda TEXT,
    minutes TEXT,
    decisions TEXT, -- JSON array of decisions made
    action_items TEXT, -- JSON array

    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Change Requests (RFC) - Enhanced
CREATE TABLE IF NOT EXISTS change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_number TEXT UNIQUE NOT NULL, -- e.g., RFC-0001
    title TEXT NOT NULL,
    description TEXT NOT NULL,

    -- Classification
    change_type_id INTEGER REFERENCES change_types(id),
    category TEXT CHECK(category IN ('standard', 'normal', 'emergency')) DEFAULT 'normal',
    priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',

    -- Risk Assessment
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_assessment TEXT,
    impact_assessment TEXT,

    -- Planning
    reason_for_change TEXT,
    business_justification TEXT,
    implementation_plan TEXT,
    backout_plan TEXT,
    test_plan TEXT,
    communication_plan TEXT,

    -- Schedule
    requested_start_date DATETIME,
    requested_end_date DATETIME,
    actual_start_date DATETIME,
    actual_end_date DATETIME,

    -- Stakeholders
    requester_id INTEGER NOT NULL REFERENCES users(id),
    owner_id INTEGER REFERENCES users(id),
    implementer_id INTEGER REFERENCES users(id),

    -- Approval
    cab_meeting_id INTEGER REFERENCES cab_meetings(id),
    approval_status TEXT CHECK(approval_status IN ('pending', 'approved', 'rejected', 'deferred', 'withdrawn')) DEFAULT 'pending',
    approved_by INTEGER REFERENCES users(id),
    approved_at DATETIME,
    approval_notes TEXT,

    -- Status
    status TEXT CHECK(status IN ('draft', 'submitted', 'under_review', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled', 'rolled_back')) DEFAULT 'draft',

    -- Post Implementation Review
    pir_required BOOLEAN DEFAULT FALSE,
    pir_completed BOOLEAN DEFAULT FALSE,
    pir_notes TEXT,
    pir_success_rating INTEGER CHECK(pir_success_rating BETWEEN 1 AND 5),

    -- Affected CIs
    affected_cis TEXT, -- JSON array of CI IDs

    organization_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Change Request Approvals (CAB voting)
CREATE TABLE IF NOT EXISTS change_request_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_request_id INTEGER NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    cab_member_id INTEGER NOT NULL REFERENCES cab_members(id),

    vote TEXT CHECK(vote IN ('approve', 'reject', 'defer', 'abstain')),
    voted_at DATETIME,
    comments TEXT,
    conditions TEXT, -- Any conditions for approval

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(change_request_id, cab_member_id)
);

-- Change Calendar (blackout/freeze periods)
CREATE TABLE IF NOT EXISTS change_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,

    type TEXT CHECK(type IN ('blackout', 'freeze', 'preferred', 'maintenance')) DEFAULT 'blackout',
    severity TEXT CHECK(severity IN ('soft', 'hard')) DEFAULT 'hard', -- soft = warnings, hard = blocked

    affected_environments TEXT, -- JSON array: ['production', 'staging']
    affected_change_types TEXT, -- JSON array of change type IDs

    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern TEXT, -- JSON for recurrence rules

    organization_id INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_configuration_items_type ON configuration_items(ci_type_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_status ON configuration_items(status_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_org ON configuration_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_owner ON configuration_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_team ON configuration_items(managed_by_team_id);
CREATE INDEX IF NOT EXISTS idx_configuration_items_criticality ON configuration_items(criticality);
CREATE INDEX IF NOT EXISTS idx_configuration_items_environment ON configuration_items(environment);

CREATE INDEX IF NOT EXISTS idx_ci_relationships_source ON ci_relationships(source_ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_relationships_target ON ci_relationships(target_ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_relationships_type ON ci_relationships(relationship_type_id);

CREATE INDEX IF NOT EXISTS idx_ci_history_ci ON ci_history(ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_history_date ON ci_history(created_at);

CREATE INDEX IF NOT EXISTS idx_ci_ticket_links_ci ON ci_ticket_links(ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_ticket_links_ticket ON ci_ticket_links(ticket_id);

CREATE INDEX IF NOT EXISTS idx_service_categories_org ON service_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_parent ON service_categories(parent_category_id);

CREATE INDEX IF NOT EXISTS idx_service_catalog_items_category ON service_catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_org ON service_catalog_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_items_active ON service_catalog_items(is_active);

CREATE INDEX IF NOT EXISTS idx_service_requests_catalog ON service_requests(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_requester ON service_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_org ON service_requests(organization_id);

CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_approval ON change_requests(approval_status);
CREATE INDEX IF NOT EXISTS idx_change_requests_org ON change_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_scheduled ON change_requests(requested_start_date);

CREATE INDEX IF NOT EXISTS idx_cab_meetings_date ON cab_meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_cab_meetings_status ON cab_meetings(status);

CREATE INDEX IF NOT EXISTS idx_change_calendar_dates ON change_calendar(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_change_calendar_org ON change_calendar(organization_id);

-- =====================================================
-- Seed Data
-- =====================================================

-- CI Types
INSERT OR IGNORE INTO ci_types (name, description, icon, color) VALUES
('Server', 'Physical or virtual server', 'server', 'blue'),
('Network Device', 'Routers, switches, firewalls', 'network', 'green'),
('Application', 'Software application or service', 'application', 'purple'),
('Database', 'Database server or instance', 'database', 'orange'),
('Storage', 'SAN, NAS, or other storage systems', 'hard-drive', 'gray'),
('Workstation', 'Desktop or laptop computer', 'monitor', 'cyan'),
('Mobile Device', 'Smartphone or tablet', 'smartphone', 'pink'),
('Printer', 'Printer or multifunction device', 'printer', 'brown'),
('Virtual Machine', 'Virtual machine or container', 'cloud', 'indigo'),
('Cloud Service', 'Cloud-based service or resource', 'cloud', 'blue');

-- CI Statuses
INSERT OR IGNORE INTO ci_statuses (name, description, color, is_operational) VALUES
('Active', 'CI is active and in production', 'green', TRUE),
('Inactive', 'CI is not currently in use', 'gray', FALSE),
('Under Maintenance', 'CI is undergoing maintenance', 'yellow', TRUE),
('Failed', 'CI has failed and needs repair', 'red', FALSE),
('Retired', 'CI has been decommissioned', 'gray', FALSE),
('In Stock', 'CI is in inventory, not deployed', 'blue', FALSE),
('Ordered', 'CI has been ordered but not received', 'purple', FALSE);

-- CI Relationship Types
INSERT OR IGNORE INTO ci_relationship_types (name, description, inverse_name, color) VALUES
('depends_on', 'This CI depends on another CI', 'depended_by', 'blue'),
('hosts', 'This CI hosts another CI', 'hosted_by', 'green'),
('connects_to', 'This CI connects to another CI', 'connected_from', 'purple'),
('uses', 'This CI uses another CI', 'used_by', 'orange'),
('backs_up', 'This CI backs up another CI', 'backed_up_by', 'cyan'),
('monitors', 'This CI monitors another CI', 'monitored_by', 'pink');

-- Change Types
INSERT OR IGNORE INTO change_types (name, description, requires_cab_approval, default_risk_level, lead_time_days) VALUES
('Standard', 'Pre-approved, low-risk changes with established procedures', FALSE, 'low', 0),
('Normal', 'Requires assessment, approval, and scheduling', TRUE, 'medium', 3),
('Emergency', 'Urgent changes to restore service or fix critical issues', TRUE, 'high', 0),
('Major', 'Significant changes with high impact or risk', TRUE, 'critical', 7);

-- Service Categories
INSERT OR IGNORE INTO service_categories (name, slug, description, icon, color, display_order) VALUES
('Acesso e Identidade', 'access-identity', 'Solicitacoes de acesso a sistemas e gestao de identidade', 'key', 'blue', 1),
('Hardware', 'hardware', 'Solicitacoes de equipamentos e perifericos', 'laptop', 'green', 2),
('Software', 'software', 'Instalacao e licenciamento de software', 'code', 'purple', 3),
('Rede e Conectividade', 'network', 'Servicos de rede, VPN e conectividade', 'wifi', 'orange', 4),
('E-mail e Comunicacao', 'email-comm', 'E-mail, telefonia e ferramentas de colaboracao', 'mail', 'cyan', 5),
('Suporte', 'support', 'Suporte tecnico geral', 'headphones', 'pink', 6);

-- Sample Service Catalog Items
INSERT OR IGNORE INTO service_catalog_items (name, slug, short_description, description, category_id, icon, requires_approval, estimated_fulfillment_time) VALUES
('Novo Usuario', 'new-user', 'Criacao de novo usuario no dominio', 'Criacao de conta de usuario no Active Directory com acesso basico', 1, 'user-plus', TRUE, 240),
('Reset de Senha', 'password-reset', 'Reset de senha do usuario', 'Redefinicao de senha de acesso ao dominio', 1, 'key', FALSE, 30),
('Acesso VPN', 'vpn-access', 'Liberacao de acesso VPN', 'Configuracao e liberacao de acesso VPN para trabalho remoto', 1, 'shield', TRUE, 480),
('Notebook Novo', 'new-notebook', 'Solicitacao de notebook', 'Solicitacao de novo notebook para colaborador', 2, 'laptop', TRUE, 2880),
('Monitor Adicional', 'extra-monitor', 'Monitor adicional', 'Solicitacao de monitor adicional para estacao de trabalho', 2, 'monitor', TRUE, 1440),
('Instalacao de Software', 'software-install', 'Instalacao de software', 'Solicitacao de instalacao de software aprovado', 3, 'download', FALSE, 120),
('Licenca Office 365', 'office-license', 'Licenca Microsoft 365', 'Atribuicao de licenca Microsoft 365 para usuario', 3, 'file-text', TRUE, 60),
('Configuracao WiFi', 'wifi-setup', 'Configuracao de rede WiFi', 'Configuracao de acesso a rede wireless corporativa', 4, 'wifi', FALSE, 60),
('Caixa de E-mail', 'mailbox', 'Nova caixa de e-mail', 'Criacao de caixa de e-mail corporativa', 5, 'mail', TRUE, 120),
('Lista de Distribuicao', 'distribution-list', 'Lista de distribuicao', 'Criacao ou modificacao de lista de distribuicao de e-mail', 5, 'users', TRUE, 60);
