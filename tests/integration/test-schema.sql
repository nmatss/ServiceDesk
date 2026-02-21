-- Minimal test schema for integration tests
-- This schema includes only the tables needed for testing

-- Organizations table (primary tenant source in current auth flows)
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER DEFAULT 1,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    password_hash TEXT,
    phone TEXT,
    job_title TEXT,
    department TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'user', 'manager')),
    is_active BOOLEAN DEFAULT TRUE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Tenants table (for test compatibility)
CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    default_team_id INTEGER,
    requires_approval BOOLEAN DEFAULT FALSE,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Priorities table
CREATE TABLE IF NOT EXISTS priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Statuses table
CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    status_type TEXT DEFAULT 'open',
    is_initial BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    is_final BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ticket types table
CREATE TABLE IF NOT EXISTS ticket_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    icon TEXT DEFAULT 'ticket',
    workflow_type TEXT,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    sla_required BOOLEAN DEFAULT TRUE,
    approval_required BOOLEAN DEFAULT FALSE,
    escalation_enabled BOOLEAN DEFAULT FALSE,
    auto_assignment_enabled BOOLEAN DEFAULT TRUE,
    customer_visible BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    slug TEXT,
    team_type TEXT,
    capabilities TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    workload_percentage INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    availability_status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    organization_id INTEGER,
    ticket_number TEXT,
    title TEXT NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL,
    assigned_to INTEGER,
    assigned_team_id INTEGER,
    category_id INTEGER,
    priority_id INTEGER,
    status_id INTEGER,
    ticket_type_id INTEGER,
    impact INTEGER DEFAULT 3,
    urgency INTEGER DEFAULT 3,
    affected_users_count INTEGER DEFAULT 1,
    business_service TEXT,
    location TEXT,
    source TEXT DEFAULT 'web',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (assigned_team_id) REFERENCES teams(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (priority_id) REFERENCES priorities(id),
    FOREIGN KEY (status_id) REFERENCES statuses(id),
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
);

-- Tags table (ticket tags)
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    organization_id INTEGER,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Ticket tags (many-to-many)
CREATE TABLE IF NOT EXISTS ticket_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    added_by INTEGER,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(ticket_id, tag_id)
);

-- Ticket followers
CREATE TABLE IF NOT EXISTS ticket_followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(ticket_id, user_id)
);

-- Ticket relationships
CREATE TABLE IF NOT EXISTS ticket_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_ticket_id INTEGER NOT NULL,
    target_ticket_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL CHECK (
      relationship_type IN ('parent', 'child', 'related', 'duplicate', 'blocks', 'blocked_by')
    ),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (target_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Ticket activity log
CREATE TABLE IF NOT EXISTS ticket_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER,
    organization_id INTEGER,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    ticket_id INTEGER,
    comment_id INTEGER,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Generic file storage table (compatibility with files/* routes)
CREATE TABLE IF NOT EXISTS file_storage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    organization_id INTEGER DEFAULT 1,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    original_filename TEXT,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    storage_path TEXT,
    storage_type TEXT DEFAULT 'local',
    uploaded_by INTEGER NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    is_public BOOLEAN DEFAULT FALSE,
    virus_scanned BOOLEAN DEFAULT FALSE,
    virus_scan_result TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- KB categories table
CREATE TABLE IF NOT EXISTS kb_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT DEFAULT '#3B82F6',
    parent_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug)
);

-- KB articles table
CREATE TABLE IF NOT EXISTS kb_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'article',
    summary TEXT,
    meta_title TEXT,
    meta_description TEXT,
    author_id INTEGER NOT NULL,
    reviewer_id INTEGER,
    category_id INTEGER,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'private')),
    featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    search_keywords TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES kb_categories(id),
    UNIQUE(tenant_id, slug)
);

-- KB tags table
CREATE TABLE IF NOT EXISTS kb_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug)
);

-- KB article tags (many-to-many)
CREATE TABLE IF NOT EXISTS kb_article_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES kb_tags(id) ON DELETE CASCADE,
    UNIQUE(article_id, tag_id)
);

-- KB article attachments
CREATE TABLE IF NOT EXISTS kb_article_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    alt_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    entity_type TEXT,
    entity_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER DEFAULT 1,
    tenant_id INTEGER DEFAULT 1,
    user_id INTEGER,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    resource_type TEXT,
    resource_id INTEGER,
    action TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Keep KB view counters aligned with article view audit logs
CREATE TRIGGER IF NOT EXISTS trg_kb_article_view_count
AFTER INSERT ON audit_logs
WHEN NEW.entity_type = 'kb_article' AND NEW.action = 'view'
BEGIN
    UPDATE kb_articles
    SET view_count = view_count + 1
    WHERE id = NEW.entity_id;
END;

-- Login attempts table (required by current auth/login flow)
CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT FALSE,
    failure_reason TEXT,
    organization_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- SLA tracking table
CREATE TABLE IF NOT EXISTS sla_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    ticket_id INTEGER NOT NULL,
    sla_policy_id INTEGER,
    target_response_time DATETIME,
    target_resolution_time DATETIME,
    first_response_at DATETIME,
    response_due_at DATETIME,
    resolution_due_at DATETIME,
    response_time_minutes INTEGER,
    resolution_time_minutes INTEGER,
    response_met BOOLEAN DEFAULT FALSE,
    resolution_met BOOLEAN DEFAULT FALSE,
    resolved_at DATETIME,
    is_breached BOOLEAN DEFAULT FALSE,
    breach_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Basic SLA tracking seed on ticket creation (integration test compatibility)
CREATE TRIGGER IF NOT EXISTS trg_ticket_sla_tracking
AFTER INSERT ON tickets
BEGIN
    INSERT INTO sla_tracking (tenant_id, ticket_id)
    VALUES (COALESCE(NEW.tenant_id, 1), NEW.id);
END;

-- Email queue table
CREATE TABLE IF NOT EXISTS email_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER DEFAULT 1,
    to_email TEXT,
    cc_emails TEXT,
    bcc_emails TEXT,
    to_address TEXT,
    cc_address TEXT,
    bcc_address TEXT,
    subject TEXT NOT NULL,
    html_content TEXT,
    text_content TEXT,
    template_code TEXT,
    template_data TEXT,
    attachments TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'bounced')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_at DATETIME,
    sent_at DATETIME,
    error_message TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table (auth/register refresh token persistence)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tenant_id INTEGER DEFAULT 1,
    token_hash TEXT NOT NULL,
    device_fingerprint TEXT,
    device_info TEXT,
    expires_at DATETIME NOT NULL,
    last_used_at DATETIME,
    revoked_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Analytics daily metrics (used by knowledge search routes)
CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
    date DATE PRIMARY KEY,
    kb_searches_performed INTEGER DEFAULT 0,
    kb_article_views INTEGER DEFAULT 0
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_team ON tickets(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_org ON tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket ON ticket_tags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag ON ticket_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_ticket_followers_ticket ON ticket_followers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_followers_user ON ticket_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relationships_source ON ticket_relationships(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_relationships_target ON ticket_relationships(target_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activities_ticket ON ticket_activities(ticket_id);
CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_tenant ON file_storage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_org ON file_storage(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_entity ON file_storage(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_uploaded_by ON file_storage(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_storage_file_path ON file_storage(file_path);
CREATE INDEX IF NOT EXISTS idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_org ON login_attempts(organization_id);
