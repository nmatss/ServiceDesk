# ServiceDesk Database Schema Documentation

## Overview

The ServiceDesk application uses a comprehensive SQLite database with 80+ interconnected tables supporting:
- Multi-tenant architecture
- Enterprise authentication & authorization
- SLA tracking & escalations
- Knowledge base management
- Workflow automation
- AI-powered features
- Analytics & reporting
- WhatsApp integration
- LGPD compliance

## Database Architecture

### Technology
- **Database**: SQLite 3 (development), PostgreSQL-ready for production
- **ORM**: Custom query layer with type-safe operations
- **Migrations**: SQL-based migration system
- **Connection**: better-sqlite3 with WAL mode

### Key Features
- **ACID Compliant**: Full transactional support
- **Foreign Key Enforcement**: Cascading deletes and referential integrity
- **Trigger-based Automation**: Auto-updates, SLA tracking, audit logs
- **Comprehensive Indexing**: Optimized for common query patterns
- **Multi-tenant Isolation**: Organization-level data segregation

## Core Tables

### 1. Users Table
**Purpose**: Stores user accounts with enterprise features

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'user', 'manager', 'read_only', 'api_client')),
    organization_id INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at DATETIME,
    last_login_at DATETIME,
    password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    two_factor_backup_codes TEXT, -- JSON array
    sso_provider TEXT,
    sso_user_id TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    language TEXT DEFAULT 'pt-BR',
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_users_active` on `is_active`
- `idx_users_organization` on `organization_id`
- `idx_users_email_verified` on `is_email_verified`
- `idx_users_sso_provider` on `sso_provider`

**Triggers**:
- `update_users_updated_at`: Auto-updates `updated_at` on modification

### 2. Tickets Table
**Purpose**: Core support ticket management

```sql
CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    assigned_to INTEGER,
    category_id INTEGER NOT NULL,
    priority_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    organization_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_tickets_user_id` on `user_id`
- `idx_tickets_assigned_to` on `assigned_to`
- `idx_tickets_category_id` on `category_id`
- `idx_tickets_priority_id` on `priority_id`
- `idx_tickets_status_id` on `status_id`
- `idx_tickets_organization` on `organization_id`
- `idx_tickets_org_status` on `(organization_id, status_id)`
- `idx_tickets_org_assigned` on `(organization_id, assigned_to)`

**Triggers**:
- `update_tickets_updated_at`: Auto-updates `updated_at`
- `create_sla_tracking_on_ticket_insert`: Auto-creates SLA tracking
- `update_sla_on_resolution`: Updates SLA when ticket resolved
- `audit_ticket_changes`: Creates audit log entry

### 3. Categories Table
**Purpose**: Ticket categorization

```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    organization_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

### 4. Priorities Table
**Purpose**: Ticket priority levels

```sql
CREATE TABLE priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 4),
    color TEXT NOT NULL,
    organization_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

**Constraints**:
- CHECK: `level` must be between 1 and 4

### 5. Statuses Table
**Purpose**: Ticket workflow statuses

```sql
CREATE TABLE statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    organization_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

## Authentication & Authorization Tables

### 6. Roles Table
**Purpose**: Granular RBAC role definitions

```sql
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 7. Permissions Table
**Purpose**: Granular permission definitions

```sql
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    conditions TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 8. Role Permissions (Junction Table)
**Purpose**: Many-to-many relationship between roles and permissions

```sql
CREATE TABLE role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted_by INTEGER,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(role_id, permission_id)
);
```

### 9. User Roles (Junction Table)
**Purpose**: Many-to-many relationship between users and roles

```sql
CREATE TABLE user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_by INTEGER,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
);
```

### 10. Refresh Tokens Table
**Purpose**: JWT refresh token management

```sql
CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    device_info TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## SLA Management Tables

### 11. SLA Policies Table
**Purpose**: Define SLA policies by priority/category

```sql
CREATE TABLE sla_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    priority_id INTEGER NOT NULL,
    category_id INTEGER,
    organization_id INTEGER DEFAULT 1,
    response_time_minutes INTEGER NOT NULL,
    resolution_time_minutes INTEGER NOT NULL,
    escalation_time_minutes INTEGER,
    business_hours_only BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

### 12. SLA Tracking Table
**Purpose**: Track SLA compliance for each ticket

```sql
CREATE TABLE sla_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    sla_policy_id INTEGER NOT NULL,
    response_due_at DATETIME,
    resolution_due_at DATETIME,
    escalation_due_at DATETIME,
    response_met BOOLEAN DEFAULT FALSE,
    resolution_met BOOLEAN DEFAULT FALSE,
    response_time_minutes INTEGER,
    resolution_time_minutes INTEGER,
    breach_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sla_policy_id) REFERENCES sla_policies(id) ON DELETE RESTRICT
);
```

**Triggers**:
- Auto-created when ticket is inserted
- Auto-updated when first response given
- Auto-updated when ticket resolved

## Knowledge Base Tables

### 13. KB Articles Table
**Purpose**: Knowledge base article storage

```sql
CREATE TABLE kb_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'html',
    category_id INTEGER,
    organization_id INTEGER DEFAULT 1,
    author_id INTEGER NOT NULL,
    reviewer_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal', 'private')),
    featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    not_helpful_votes INTEGER DEFAULT 0,
    search_keywords TEXT,
    meta_title TEXT,
    meta_description TEXT,
    published_at DATETIME,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

### 14. KB Categories Table
**Purpose**: Knowledge base hierarchical categories

```sql
CREATE TABLE kb_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'DocumentTextIcon',
    color TEXT DEFAULT '#3B82F6',
    parent_id INTEGER,
    organization_id INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
```

## Workflow & Automation Tables

### 15. Workflows Table
**Purpose**: Workflow automation definitions

```sql
CREATE TABLE workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('ticket_created', 'ticket_updated', 'status_changed', 'sla_warning', 'time_based', 'manual', 'comment_added', 'assignment_changed')),
    trigger_conditions TEXT, -- JSON
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,
    category TEXT,
    priority INTEGER DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_executed_at DATETIME,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
```

### 16. Workflow Steps Table
**Purpose**: Individual steps within workflows

```sql
CREATE TABLE workflow_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('action', 'condition', 'approval', 'delay', 'parallel', 'webhook', 'script', 'notification')),
    name TEXT NOT NULL,
    description TEXT,
    configuration TEXT NOT NULL, -- JSON
    timeout_minutes INTEGER DEFAULT 60,
    retry_count INTEGER DEFAULT 3,
    retry_delay_minutes INTEGER DEFAULT 5,
    is_optional BOOLEAN DEFAULT FALSE,
    parent_step_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE,
    UNIQUE(workflow_id, step_order)
);
```

## Analytics Tables

### 17. Analytics Daily Metrics
**Purpose**: Aggregated daily performance metrics

```sql
CREATE TABLE analytics_daily_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    organization_id INTEGER DEFAULT 1,
    tickets_created INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    tickets_reopened INTEGER DEFAULT 0,
    avg_first_response_time INTEGER,
    avg_resolution_time INTEGER,
    satisfaction_score DECIMAL(3,2),
    satisfaction_responses INTEGER DEFAULT 0,
    kb_articles_viewed INTEGER DEFAULT 0,
    kb_searches_performed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE(date, organization_id)
);
```

### 18. Analytics Agent Metrics
**Purpose**: Agent performance tracking

```sql
CREATE TABLE analytics_agent_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    date DATE NOT NULL,
    tickets_assigned INTEGER DEFAULT 0,
    tickets_resolved INTEGER DEFAULT 0,
    avg_first_response_time INTEGER,
    avg_resolution_time INTEGER,
    satisfaction_score DECIMAL(3,2),
    satisfaction_responses INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(agent_id, date)
);
```

## Multi-Tenancy Tables

### 19. Organizations Table
**Purpose**: Multi-tenant organization management

```sql
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    settings TEXT, -- JSON
    subscription_plan TEXT DEFAULT 'basic',
    subscription_status TEXT DEFAULT 'active',
    subscription_expires_at DATETIME,
    max_users INTEGER DEFAULT 50,
    max_tickets_per_month INTEGER DEFAULT 1000,
    features TEXT, -- JSON
    billing_email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Audit & Compliance Tables

### 20. Audit Logs Table
**Purpose**: Comprehensive audit trail

```sql
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### 21. LGPD Consents Table
**Purpose**: LGPD compliance tracking

```sql
CREATE TABLE lgpd_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    consent_type TEXT NOT NULL,
    purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL,
    is_given BOOLEAN NOT NULL,
    consent_method TEXT,
    consent_evidence TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME,
    withdrawn_at DATETIME,
    withdrawal_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Data Integrity Features

### Foreign Key Constraints
1. **CASCADE DELETE**: User deletion cascades to tickets, comments, attachments
2. **SET NULL**: Agent deletion sets ticket.assigned_to to NULL
3. **RESTRICT**: Cannot delete category/priority/status with active tickets

### Unique Constraints
1. `users.email` - Prevents duplicate email addresses
2. `kb_articles.slug` - Ensures unique URL slugs
3. `(user_id, role_id)` - Prevents duplicate role assignments
4. `refresh_tokens.token_hash` - Ensures token uniqueness

### Check Constraints
1. `users.role` - Must be one of: admin, agent, user, manager, read_only, api_client
2. `priorities.level` - Must be between 1 and 4
3. `satisfaction_surveys.rating` - Must be between 1 and 5

### Triggers
1. **Updated At Triggers**: Auto-update timestamps on 15+ tables
2. **SLA Automation**: Auto-create and update SLA tracking
3. **Audit Logging**: Auto-log ticket and user changes
4. **Feedback Counters**: Auto-update KB article vote counts

### Indexes
- **Single Column**: 120+ indexes on foreign keys and frequently queried columns
- **Composite**: Multi-column indexes for complex queries
- **Organization Isolation**: Indexes on organization_id for multi-tenant queries

## Query Optimization Patterns

### Common Query Patterns
1. **Tickets by Organization**: Uses `idx_tickets_organization`
2. **Tickets by Status**: Uses `idx_tickets_org_status` composite index
3. **Agent Dashboard**: Uses `idx_tickets_assigned_to`
4. **User Tickets**: Uses `idx_tickets_user_id`
5. **SLA Breaches**: Uses `idx_sla_tracking_response_due` and `idx_sla_tracking_resolution_due`

### N+1 Query Prevention
All query functions use JOINs to fetch related data in single queries:
```typescript
// Example: Fetch tickets with all related data
SELECT t.*, u.name as user_name, c.name as category_name, ...
FROM tickets t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.organization_id = ?
```

## Migration Strategy

### Current State
- SQLite for development with full schema
- PostgreSQL-compatible schema available
- Migration files in `lib/db/migrations/`

### Migration Files
1. `001_postgresql_schema.sql` - Full PostgreSQL conversion
2. `002_add_organization_id_core.sql` - Multi-tenant migration
3. `003_add_organization_id_sla.sql` - SLA multi-tenant
4. `004_add_organization_id_kb.sql` - KB multi-tenant
5. `005_add_organization_id_auth.sql` - Auth multi-tenant
6. `006_add_performance_indexes.sql` - Performance optimization

## Performance Characteristics

### Connection Settings
```javascript
db.pragma('journal_mode = WAL');      // Write-Ahead Logging
db.pragma('synchronous = NORMAL');    // Balanced durability/performance
db.pragma('cache_size = 1000');       // 1000 pages cache
db.pragma('temp_store = MEMORY');     // Temp tables in memory
db.pragma('foreign_keys = ON');       // Enforce constraints
```

### Expected Performance
- **Simple Queries**: < 1ms
- **Complex Joins**: < 10ms
- **Analytics Queries**: < 100ms
- **Concurrent Writes**: 1000+ transactions/sec (WAL mode)

## Backup & Recovery

### Backup Strategy
1. **Automated Backups**: Daily full backups
2. **WAL Checkpoints**: Regular checkpoints for consistency
3. **Export Tools**: JSON/CSV export for data portability

### Recovery Procedures
1. **Point-in-Time Recovery**: Via WAL file replay
2. **Full Restore**: From backup file
3. **Migration**: To PostgreSQL for scale

## Security Considerations

### Data Protection
1. **Password Hashing**: bcrypt with salt
2. **Token Encryption**: SHA-256 hashing for refresh tokens
3. **SQL Injection**: Parameterized queries throughout
4. **Row-Level Security**: Organization-based isolation

### LGPD Compliance
1. **Consent Tracking**: Full audit trail
2. **Data Retention**: Configurable expiration
3. **Right to Deletion**: Cascade delete support
4. **Access Logging**: Comprehensive audit logs

## Schema Evolution Guidelines

### Adding New Tables
1. Create migration file with timestamp
2. Add foreign keys to existing tables
3. Create necessary indexes
4. Add TypeScript types
5. Add query functions

### Modifying Existing Tables
1. Use ALTER TABLE statements
2. Maintain backward compatibility
3. Update triggers if needed
4. Update TypeScript types
5. Update query functions

### Data Migration
1. Create backup before migration
2. Test migration on copy
3. Run migration in transaction
4. Verify data integrity
5. Update application code

## Related Documentation
- [Data Integrity Report](DATA_INTEGRITY_REPORT.md)
- [Migration Guide](MIGRATION_GUIDE.md)
- [Query Optimization Guide](QUERY_OPTIMIZATION.md)
