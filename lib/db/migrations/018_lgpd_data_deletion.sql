-- Migration: LGPD Data Deletion and Portability
-- Created: 2025-01-13
-- Purpose: Tables for LGPD/GDPR compliance - data subject rights (deletion, portability, consent management)

-- ==================================================
-- DATA ERASURE REQUESTS TABLE
-- ==================================================
-- Tracks user requests for data deletion (Right to Erasure - Art. 18 LGPD)
CREATE TABLE IF NOT EXISTS lgpd_data_erasure_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    request_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_reason TEXT NOT NULL, -- 'consent_withdrawn', 'purpose_fulfilled', 'unlawful_processing', 'retention_expired', 'objection'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
    data_types TEXT NOT NULL, -- JSON array of data types to delete
    justification TEXT, -- Reason for approval/rejection
    requested_by INTEGER, -- User ID who made the request (can be different from user_id if admin)
    reviewed_by INTEGER, -- Admin who reviewed the request
    reviewed_at DATETIME,
    scheduled_for DATETIME, -- When deletion is scheduled
    completed_at DATETIME, -- When deletion was completed
    completion_metadata TEXT, -- JSON with deletion details
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ==================================================
-- DATA PORTABILITY REQUESTS TABLE
-- ==================================================
-- Tracks user requests for data export (Right to Data Portability - Art. 18 LGPD)
CREATE TABLE IF NOT EXISTS lgpd_data_portability_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    request_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected', 'expired'
    data_types TEXT NOT NULL, -- JSON array of data types to export
    format TEXT NOT NULL DEFAULT 'json', -- 'json', 'csv', 'xml'
    file_path TEXT, -- Path to generated export file
    file_size_bytes INTEGER,
    download_url TEXT, -- URL for downloading the export
    download_token TEXT, -- Secure token for download
    download_count INTEGER DEFAULT 0,
    expires_at DATETIME, -- When download link expires
    completed_at DATETIME,
    error_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================================================
-- DATA RETENTION POLICIES TABLE
-- ==================================================
-- Defines retention periods for different data types
CREATE TABLE IF NOT EXISTS lgpd_data_retention_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_type TEXT NOT NULL UNIQUE, -- 'tickets', 'comments', 'attachments', 'audit_logs', etc.
    retention_period_days INTEGER NOT NULL, -- How many days to retain
    legal_basis TEXT NOT NULL, -- Legal reason for retention period
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    organization_id INTEGER, -- NULL = applies to all organizations
    auto_delete_enabled BOOLEAN NOT NULL DEFAULT 0, -- Automatically delete expired data
    notification_days_before INTEGER DEFAULT 30, -- Notify X days before deletion
    created_by INTEGER,
    updated_by INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ==================================================
-- CONSENT RECORDS TABLE (Extended from existing lgpd_consents)
-- ==================================================
-- Enhanced consent tracking with full LGPD compliance
CREATE TABLE IF NOT EXISTS lgpd_consent_records (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER NOT NULL,
    purpose TEXT NOT NULL, -- Purpose of data processing
    data_types TEXT NOT NULL, -- JSON array of data types
    consent_given BOOLEAN NOT NULL DEFAULT 1,
    consent_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATETIME, -- When consent expires
    revoked_date DATETIME, -- When consent was revoked
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    lawful_basis TEXT NOT NULL, -- 'consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'
    metadata TEXT, -- JSON with additional information
    revocation_reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==================================================
-- DATA PROCESSING RECORDS TABLE
-- ==================================================
-- Tracks all data processing activities for audit purposes
CREATE TABLE IF NOT EXISTS lgpd_data_processing_records (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER NOT NULL,
    data_type TEXT NOT NULL,
    purpose TEXT NOT NULL,
    processing_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lawful_basis TEXT NOT NULL,
    data_source TEXT NOT NULL, -- Where the data came from
    retention_period_days INTEGER NOT NULL,
    consent_id TEXT, -- Reference to consent record if applicable
    processing_details TEXT, -- JSON with additional details
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (consent_id) REFERENCES lgpd_consent_records(id) ON DELETE SET NULL
);

-- ==================================================
-- ANONYMIZED USERS TABLE
-- ==================================================
-- Stores anonymized user records after deletion (for audit/legal compliance)
CREATE TABLE IF NOT EXISTS lgpd_anonymized_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_user_id INTEGER NOT NULL UNIQUE, -- Original user ID
    anonymization_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    anonymization_method TEXT NOT NULL, -- 'full_deletion', 'pseudonymization', 'aggregation'
    retention_reason TEXT NOT NULL, -- Legal reason for keeping anonymized record
    deletion_request_id INTEGER, -- Reference to erasure request
    data_hash TEXT, -- Hash of original data for verification
    kept_fields TEXT, -- JSON array of fields kept for legal reasons
    legal_hold BOOLEAN NOT NULL DEFAULT 0, -- If data is on legal hold
    legal_hold_reason TEXT,
    legal_hold_until DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deletion_request_id) REFERENCES lgpd_data_erasure_requests(id) ON DELETE SET NULL
);

-- ==================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================

-- Erasure requests indexes
CREATE INDEX IF NOT EXISTS idx_lgpd_erasure_user
ON lgpd_data_erasure_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_lgpd_erasure_status
ON lgpd_data_erasure_requests(status);

CREATE INDEX IF NOT EXISTS idx_lgpd_erasure_scheduled
ON lgpd_data_erasure_requests(scheduled_for)
WHERE status = 'approved';

-- Portability requests indexes
CREATE INDEX IF NOT EXISTS idx_lgpd_portability_user
ON lgpd_data_portability_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_lgpd_portability_status
ON lgpd_data_portability_requests(status);

CREATE INDEX IF NOT EXISTS idx_lgpd_portability_expires
ON lgpd_data_portability_requests(expires_at)
WHERE status = 'completed';

-- Retention policies indexes
CREATE INDEX IF NOT EXISTS idx_lgpd_retention_type
ON lgpd_data_retention_policies(data_type);

CREATE INDEX IF NOT EXISTS idx_lgpd_retention_active
ON lgpd_data_retention_policies(is_active)
WHERE is_active = 1;

-- Consent records indexes
CREATE INDEX IF NOT EXISTS idx_lgpd_consent_records_user
ON lgpd_consent_records(user_id);

CREATE INDEX IF NOT EXISTS idx_lgpd_consent_records_given
ON lgpd_consent_records(consent_given, revoked_date);

CREATE INDEX IF NOT EXISTS idx_lgpd_consent_records_expiry
ON lgpd_consent_records(expiry_date)
WHERE consent_given = 1 AND revoked_date IS NULL;

-- Processing records indexes
CREATE INDEX IF NOT EXISTS idx_lgpd_processing_user
ON lgpd_data_processing_records(user_id);

CREATE INDEX IF NOT EXISTS idx_lgpd_processing_type
ON lgpd_data_processing_records(data_type);

CREATE INDEX IF NOT EXISTS idx_lgpd_processing_date
ON lgpd_data_processing_records(processing_date);

-- Anonymized users indexes
CREATE INDEX IF NOT EXISTS idx_lgpd_anonymized_original
ON lgpd_anonymized_users(original_user_id);

CREATE INDEX IF NOT EXISTS idx_lgpd_anonymized_legal_hold
ON lgpd_anonymized_users(legal_hold, legal_hold_until)
WHERE legal_hold = 1;

-- ==================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ==================================================

CREATE TRIGGER IF NOT EXISTS update_lgpd_erasure_timestamp
AFTER UPDATE ON lgpd_data_erasure_requests
BEGIN
    UPDATE lgpd_data_erasure_requests
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_lgpd_portability_timestamp
AFTER UPDATE ON lgpd_data_portability_requests
BEGIN
    UPDATE lgpd_data_portability_requests
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_lgpd_retention_timestamp
AFTER UPDATE ON lgpd_data_retention_policies
BEGIN
    UPDATE lgpd_data_retention_policies
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_lgpd_consent_records_timestamp
AFTER UPDATE ON lgpd_consent_records
BEGIN
    UPDATE lgpd_consent_records
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- ==================================================
-- DEFAULT RETENTION POLICIES (Brazilian Legal Requirements)
-- ==================================================

INSERT OR IGNORE INTO lgpd_data_retention_policies (data_type, retention_period_days, legal_basis, description, is_active, auto_delete_enabled)
VALUES
    ('tickets', 1825, 'Art. 16 LGPD - Retention for 5 years', 'Support tickets and related data', 1, 0),
    ('comments', 1825, 'Art. 16 LGPD - Retention for 5 years', 'Ticket comments and communications', 1, 0),
    ('attachments', 1825, 'Art. 16 LGPD - Retention for 5 years', 'File attachments and documents', 1, 0),
    ('audit_logs', 2555, 'Art. 37 LGPD - Retention for 7 years', 'Security and compliance audit logs', 1, 0),
    ('auth_logs', 2555, 'Art. 37 LGPD - Retention for 7 years', 'Authentication and access logs', 1, 0),
    ('consent_records', 2555, 'Art. 8 LGPD - Proof of consent retention', 'LGPD consent records', 1, 0),
    ('financial_records', 1825, 'Brazilian Tax Law - 5 years', 'Financial and billing records', 1, 0),
    ('user_profiles', 1095, 'Art. 16 LGPD - Active user data', 'User profile information (deleted after 3 years of inactivity)', 1, 0),
    ('analytics_data', 730, 'Legitimate Interest', 'Aggregated analytics data', 1, 1),
    ('temporary_files', 30, 'Business Necessity', 'Temporary files and caches', 1, 1);
