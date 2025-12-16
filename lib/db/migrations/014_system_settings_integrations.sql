-- Migration: Add organization_id to system_settings and insert default integration settings
-- Version: 012
-- Description: Enhances system_settings table for multi-tenant support and adds default integration configurations

-- Add organization_id column to system_settings if it doesn't exist
-- SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we need to check and recreate
-- This is safe because system_settings likely has minimal data at this stage

-- Step 1: Backup existing data
CREATE TABLE IF NOT EXISTS system_settings_backup AS SELECT * FROM system_settings;

-- Step 2: Drop old table
DROP TABLE IF EXISTS system_settings;

-- Step 3: Recreate with organization_id
CREATE TABLE system_settings (
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

-- Step 4: Restore backup data (if any)
INSERT INTO system_settings (id, key, value, description, type, is_public, organization_id, updated_by, created_at, updated_at)
SELECT id, key, value, description, type, is_public, NULL, updated_by, created_at, updated_at
FROM system_settings_backup;

-- Step 5: Drop backup table
DROP TABLE system_settings_backup;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_org ON system_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_key_org ON system_settings(key, organization_id);

-- Step 7: Insert default integration settings (global, no organization_id)

-- TOTVS Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted) VALUES
('totvs_enabled', 'false', 'Enable TOTVS ERP integration', 'boolean', 0),
('totvs_base_url', '', 'TOTVS API base URL', 'string', 0),
('totvs_username', '', 'TOTVS API username', 'string', 0),
('totvs_password', '', 'TOTVS API password (encrypted)', 'string', 1),
('totvs_tenant', '', 'TOTVS tenant identifier', 'string', 0),
('totvs_environment', 'production', 'TOTVS environment (production/homologation)', 'string', 0),
('totvs_api_version', 'v1', 'TOTVS API version', 'string', 0),
('totvs_product', 'protheus', 'TOTVS product (protheus/datasul/rm)', 'string', 0);

-- SAP B1 Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted) VALUES
('sap_enabled', 'false', 'Enable SAP Business One integration', 'boolean', 0),
('sap_base_url', '', 'SAP B1 Service Layer URL', 'string', 0),
('sap_company_db', '', 'SAP B1 company database name', 'string', 0),
('sap_username', '', 'SAP B1 username', 'string', 0),
('sap_password', '', 'SAP B1 password (encrypted)', 'string', 1),
('sap_version', '10.0', 'SAP B1 version', 'string', 0),
('sap_environment', 'production', 'SAP environment (production/sandbox)', 'string', 0);

-- PIX Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted) VALUES
('pix_enabled', 'false', 'Enable PIX payment integration', 'boolean', 0),
('pix_provider', '', 'PIX provider (bradesco/itau/banco_brasil/sicoob/sicredi)', 'string', 0),
('pix_bank_code', '', 'Bank code for PIX integration', 'string', 0),
('pix_client_id', '', 'PIX API client ID', 'string', 0),
('pix_client_secret', '', 'PIX API client secret (encrypted)', 'string', 1),
('pix_environment', 'production', 'PIX environment (production/sandbox)', 'string', 0),
('pix_api_version', 'v2', 'PIX API version', 'string', 0);

-- Boleto Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted) VALUES
('boleto_enabled', 'false', 'Enable Boleto payment integration', 'boolean', 0),
('boleto_provider', '', 'Boleto provider (bradesco/itau/banco_brasil/santander/caixa)', 'string', 0),
('boleto_bank_code', '', 'Bank code for Boleto integration', 'string', 0),
('boleto_agencia', '', 'Bank branch number', 'string', 0),
('boleto_conta', '', 'Bank account number', 'string', 0),
('boleto_carteira', '', 'Boleto wallet/portfolio number', 'string', 0),
('boleto_convenio', '', 'Bank agreement number (convênio)', 'string', 0),
('boleto_client_id', '', 'Boleto API client ID', 'string', 0),
('boleto_client_secret', '', 'Boleto API client secret (encrypted)', 'string', 1),
('boleto_environment', 'sandbox', 'Boleto environment (production/sandbox)', 'string', 0);

-- Gov.br Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted) VALUES
('govbr_enabled', 'false', 'Enable Gov.br authentication', 'boolean', 0),
('govbr_client_id', '', 'Gov.br OAuth client ID', 'string', 0),
('govbr_client_secret', '', 'Gov.br OAuth client secret (encrypted)', 'string', 1),
('govbr_redirect_uri', '', 'Gov.br OAuth redirect URI', 'string', 0),
('govbr_scope', 'openid email profile', 'Gov.br OAuth scopes', 'string', 0),
('govbr_environment', 'sandbox', 'Gov.br environment (production/sandbox)', 'string', 0),
('govbr_esic_api_key', '', 'Gov.br e-SIC API key (encrypted)', 'string', 1);

-- WhatsApp Integration Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type, is_encrypted) VALUES
('whatsapp_enabled', 'false', 'Enable WhatsApp Business API integration', 'boolean', 0),
('whatsapp_access_token', '', 'WhatsApp Business API access token (encrypted)', 'string', 1),
('whatsapp_phone_number_id', '', 'WhatsApp Business phone number ID', 'string', 0),
('whatsapp_business_account_id', '', 'WhatsApp Business account ID', 'string', 0),
('whatsapp_webhook_verify_token', '', 'WhatsApp webhook verification token', 'string', 1),
('whatsapp_api_version', 'v18.0', 'WhatsApp API version', 'string', 0),
('whatsapp_base_url', 'https://graph.facebook.com', 'WhatsApp API base URL', 'string', 0);

-- General System Settings
INSERT OR IGNORE INTO system_settings (key, value, description, type) VALUES
('system_name', 'ServiceDesk', 'System name', 'string'),
('system_version', '1.0.0', 'System version', 'string'),
('maintenance_mode', 'false', 'Enable maintenance mode', 'boolean'),
('default_language', 'pt-BR', 'Default system language', 'string'),
('default_timezone', 'America/Sao_Paulo', 'Default system timezone', 'string');

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_system_settings_timestamp
AFTER UPDATE ON system_settings
FOR EACH ROW
BEGIN
    UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
