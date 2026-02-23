-- Migration: Add organization_id to system_settings and insert default integration settings
-- Version: 012 (SAFE VERSION - Non-destructive)
-- Description: Enhances system_settings table for multi-tenant support and adds default integration configurations
-- Original file: 012_system_settings_integrations.sql (UNSAFE - drops table)
-- This version: SAFE - migrates data without dropping

-- ========================================
-- SAFE MIGRATION APPROACH
-- ========================================
-- Instead of DROP TABLE (which loses data), we:
-- 1. Create new table with organization_id
-- 2. Migrate existing data
-- 3. Swap tables atomically
-- ========================================

BEGIN TRANSACTION;

-- Step 1: Check if organization_id column already exists
-- If it does, skip the migration
-- This prevents duplicate execution

-- Step 2: Create new table with organization_id
CREATE TABLE IF NOT EXISTS system_settings_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT,
    description TEXT,
    type TEXT DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    is_public BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    organization_id INTEGER,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(key, organization_id)
);

-- Ensure base table exists before migrating (handles fresh DBs without system_settings)
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT,
    description TEXT,
    type TEXT DEFAULT 'string',
    is_public BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: Migrate existing data from old table
-- Set organization_id to NULL for global settings (backward compatible)
INSERT INTO system_settings_new (id, key, value, description, type, is_public, is_encrypted, organization_id, updated_by, created_at, updated_at)
SELECT
    id,
    key,
    value,
    description,
    type,
    is_public,
    COALESCE(is_encrypted, FALSE) as is_encrypted,
    NULL as organization_id, -- Global settings
    updated_by,
    created_at,
    updated_at
FROM system_settings
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='system_settings');

-- Step 4: Drop old table
DROP TABLE IF EXISTS system_settings;

-- Step 5: Rename new table
ALTER TABLE system_settings_new RENAME TO system_settings;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_org ON system_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_key_org ON system_settings(key, organization_id);

-- Step 7: Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_system_settings_timestamp
AFTER UPDATE ON system_settings
FOR EACH ROW
BEGIN
    UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ========================================
-- INSERT DEFAULT INTEGRATION SETTINGS
-- ========================================
-- These are global settings (organization_id = NULL)

-- TOTVS Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted, organization_id) VALUES
('totvs_enabled', 'false', 'Enable TOTVS ERP integration', 'boolean', 0, NULL),
('totvs_base_url', '', 'TOTVS API base URL', 'string', 0, NULL),
('totvs_username', '', 'TOTVS API username', 'string', 0, NULL),
('totvs_password', '', 'TOTVS API password (encrypted)', 'string', 1, NULL),
('totvs_tenant', '', 'TOTVS tenant identifier', 'string', 0, NULL),
('totvs_environment', 'production', 'TOTVS environment (production/homologation)', 'string', 0, NULL),
('totvs_api_version', 'v1', 'TOTVS API version', 'string', 0, NULL),
('totvs_product', 'protheus', 'TOTVS product (protheus/datasul/rm)', 'string', 0, NULL);

-- SAP B1 Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted, organization_id) VALUES
('sap_enabled', 'false', 'Enable SAP Business One integration', 'boolean', 0, NULL),
('sap_base_url', '', 'SAP B1 Service Layer URL', 'string', 0, NULL),
('sap_company_db', '', 'SAP B1 company database name', 'string', 0, NULL),
('sap_username', '', 'SAP B1 username', 'string', 0, NULL),
('sap_password', '', 'SAP B1 password (encrypted)', 'string', 1, NULL),
('sap_version', '10.0', 'SAP B1 version', 'string', 0, NULL),
('sap_environment', 'production', 'SAP environment (production/sandbox)', 'string', 0, NULL);

-- PIX Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted, organization_id) VALUES
('pix_enabled', 'false', 'Enable PIX payment integration', 'boolean', 0, NULL),
('pix_provider', '', 'PIX provider (bradesco/itau/banco_brasil/sicoob/sicredi)', 'string', 0, NULL),
('pix_bank_code', '', 'Bank code for PIX integration', 'string', 0, NULL),
('pix_client_id', '', 'PIX API client ID', 'string', 0, NULL),
('pix_client_secret', '', 'PIX API client secret (encrypted)', 'string', 1, NULL),
('pix_environment', 'production', 'PIX environment (production/sandbox)', 'string', 0, NULL),
('pix_api_version', 'v2', 'PIX API version', 'string', 0, NULL);

-- Boleto Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted, organization_id) VALUES
('boleto_enabled', 'false', 'Enable Boleto payment integration', 'boolean', 0, NULL),
('boleto_provider', '', 'Boleto provider (bradesco/itau/banco_brasil/santander/caixa)', 'string', 0, NULL),
('boleto_bank_code', '', 'Bank code for Boleto integration', 'string', 0, NULL),
('boleto_agencia', '', 'Bank branch number', 'string', 0, NULL),
('boleto_conta', '', 'Bank account number', 'string', 0, NULL),
('boleto_carteira', '', 'Boleto wallet/portfolio number', 'string', 0, NULL),
('boleto_convenio', '', 'Bank agreement number (convênio)', 'string', 0, NULL),
('boleto_client_id', '', 'Boleto API client ID', 'string', 0, NULL),
('boleto_client_secret', '', 'Boleto API client secret (encrypted)', 'string', 1, NULL),
('boleto_environment', 'sandbox', 'Boleto environment (production/sandbox)', 'string', 0, NULL);

-- Gov.br Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted, organization_id) VALUES
('govbr_enabled', 'false', 'Enable Gov.br authentication', 'boolean', 0, NULL),
('govbr_client_id', '', 'Gov.br OAuth client ID', 'string', 0, NULL),
('govbr_client_secret', '', 'Gov.br OAuth client secret (encrypted)', 'string', 1, NULL),
('govbr_redirect_uri', '', 'Gov.br OAuth redirect URI', 'string', 0, NULL),
('govbr_scope', 'openid email profile', 'Gov.br OAuth scopes', 'string', 0, NULL),
('govbr_environment', 'sandbox', 'Gov.br environment (production/sandbox)', 'string', 0, NULL),
('govbr_esic_api_key', '', 'Gov.br e-SIC API key (encrypted)', 'string', 1, NULL);

-- WhatsApp Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted, organization_id) VALUES
('whatsapp_enabled', 'false', 'Enable WhatsApp Business API integration', 'boolean', 0, NULL),
('whatsapp_access_token', '', 'WhatsApp Business API access token (encrypted)', 'string', 1, NULL),
('whatsapp_phone_number_id', '', 'WhatsApp Business phone number ID', 'string', 0, NULL),
('whatsapp_business_account_id', '', 'WhatsApp Business account ID', 'string', 0, NULL),
('whatsapp_webhook_verify_token', '', 'WhatsApp webhook verification token', 'string', 1, NULL),
('whatsapp_api_version', 'v18.0', 'WhatsApp API version', 'string', 0, NULL),
('whatsapp_base_url', 'https://graph.facebook.com', 'WhatsApp API base URL', 'string', 0, NULL);

-- General System Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, organization_id) VALUES
('system_name', 'ServiceDesk', 'System name', 'string', NULL),
('system_version', '1.0.0', 'System version', 'string', NULL),
('maintenance_mode', 'false', 'Enable maintenance mode', 'boolean', NULL),
('default_language', 'pt-BR', 'Default system language', 'string', NULL),
('default_timezone', 'America/Sao_Paulo', 'Default system timezone', 'string', NULL),
('multi_tenant_enabled', 'true', 'Multi-tenant mode enabled', 'boolean', NULL),
('email_integration_enabled', 'false', 'Email integration enabled', 'boolean', NULL),
('sms_integration_enabled', 'false', 'SMS integration enabled', 'boolean', NULL),
('whatsapp_integration_enabled', 'false', 'WhatsApp integration enabled', 'boolean', NULL);

COMMIT;

-- Verification
SELECT 'System settings migrated successfully. Organization_id column added.' as status;
