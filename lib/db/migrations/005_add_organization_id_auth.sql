-- Migration: Add organization_id to auth tables
-- Version: 005

ALTER TABLE roles ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_roles_organization ON roles(organization_id);

ALTER TABLE permissions ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_permissions_organization ON permissions(organization_id);

ALTER TABLE user_roles ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_user_roles_organization ON user_roles(organization_id);

ALTER TABLE role_permissions ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE refresh_tokens ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_refresh_tokens_organization ON refresh_tokens(organization_id);

ALTER TABLE login_attempts ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_login_attempts_organization ON login_attempts(organization_id);

ALTER TABLE auth_audit_logs ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_auth_audit_organization ON auth_audit_logs(organization_id);
