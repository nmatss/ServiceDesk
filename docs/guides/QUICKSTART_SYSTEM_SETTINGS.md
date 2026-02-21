# System Settings Quick Start Guide

## Overview

The system settings feature provides centralized configuration management for all integrations and system-wide settings. No more hardcoded credentials!

## Quick Setup (5 minutes)

### Step 1: Run Migration
```bash
cd /home/nic20/ProjetosWeb/ServiceDesk

# Apply the migration
sqlite3 servicedesk.db < lib/db/migrations/012_system_settings_integrations.sql

# Or if using the init script
npm run init-db
```

### Step 2: Verify Installation
```bash
# Check if settings table exists
sqlite3 servicedesk.db "SELECT COUNT(*) FROM system_settings;"

# Should return: 50 (default settings)
```

### Step 3: Configure Your Integrations

#### Option A: Via Database
```sql
-- Enable TOTVS Integration
UPDATE system_settings SET value = 'true' WHERE key = 'totvs_enabled';
UPDATE system_settings SET value = 'https://your-totvs-api.com' WHERE key = 'totvs_base_url';
UPDATE system_settings SET value = 'your_username' WHERE key = 'totvs_username';
UPDATE system_settings SET value = 'your_password' WHERE key = 'totvs_password';
UPDATE system_settings SET value = 'your_tenant' WHERE key = 'totvs_tenant';

-- Enable PIX Integration
UPDATE system_settings SET value = 'true' WHERE key = 'pix_enabled';
UPDATE system_settings SET value = 'bradesco' WHERE key = 'pix_provider';
UPDATE system_settings SET value = '237' WHERE key = 'pix_bank_code';
UPDATE system_settings SET value = 'your_client_id' WHERE key = 'pix_client_id';
UPDATE system_settings SET value = 'your_client_secret' WHERE key = 'pix_client_secret';
```

#### Option B: Via API (Recommended)
```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}' \
  | jq -r '.token')

# Update settings
curl -X PUT http://localhost:3000/api/admin/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "totvs_enabled",
    "value": "true"
  }'

# Get all settings
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/settings
```

### Step 4: Test Integration Factory
```typescript
import { TotvsClient } from '@/lib/integrations/erp/totvs';

// Factory automatically reads from system_settings table
const client = await TotvsClient.createFromSystemSettings();

// Now you can use the client
const customers = await client.getCustomers();
```

## Available Settings

### TOTVS ERP Integration
- `totvs_enabled` - Enable/disable integration (boolean)
- `totvs_base_url` - API base URL
- `totvs_username` - API username
- `totvs_password` - API password (encrypted)
- `totvs_tenant` - Tenant identifier
- `totvs_environment` - production/homologation
- `totvs_api_version` - v1, v2, etc.
- `totvs_product` - protheus/datasul/rm

### SAP Business One Integration
- `sap_enabled` - Enable/disable integration
- `sap_base_url` - Service Layer URL
- `sap_company_db` - Company database name
- `sap_username` - Username
- `sap_password` - Password (encrypted)
- `sap_version` - SAP B1 version
- `sap_environment` - production/sandbox

### PIX Payment Integration
- `pix_enabled` - Enable/disable integration
- `pix_provider` - bradesco/itau/banco_brasil/sicoob/sicredi
- `pix_bank_code` - Bank code
- `pix_client_id` - API client ID
- `pix_client_secret` - API client secret (encrypted)
- `pix_environment` - production/sandbox
- `pix_api_version` - v2, v3, etc.

### Boleto Payment Integration
- `boleto_enabled` - Enable/disable integration
- `boleto_provider` - bradesco/itau/banco_brasil/santander/caixa
- `boleto_bank_code` - Bank code
- `boleto_agencia` - Branch number
- `boleto_conta` - Account number
- `boleto_carteira` - Wallet number
- `boleto_convenio` - Agreement number
- `boleto_client_id` - API client ID
- `boleto_client_secret` - API client secret (encrypted)
- `boleto_environment` - production/sandbox

### Gov.br Authentication
- `govbr_enabled` - Enable/disable integration
- `govbr_client_id` - OAuth client ID
- `govbr_client_secret` - OAuth client secret (encrypted)
- `govbr_redirect_uri` - OAuth redirect URI
- `govbr_scope` - OAuth scopes
- `govbr_environment` - production/sandbox
- `govbr_esic_api_key` - e-SIC API key (encrypted)

### WhatsApp Business API
- `whatsapp_enabled` - Enable/disable integration
- `whatsapp_access_token` - API access token (encrypted)
- `whatsapp_phone_number_id` - Phone number ID
- `whatsapp_business_account_id` - Business account ID
- `whatsapp_webhook_verify_token` - Webhook token (encrypted)
- `whatsapp_api_version` - v18.0, v19.0, etc.
- `whatsapp_base_url` - API base URL

## Multi-Tenant Usage

Settings support multi-tenancy! You can have:
- **Global settings** (applies to all organizations)
- **Organization-specific settings** (overrides global)

```typescript
// Get global setting
const globalUrl = getSystemSetting('totvs_base_url');

// Get organization-specific setting (with fallback to global)
const org1Url = getSystemSetting('totvs_base_url', 1);
const org2Url = getSystemSetting('totvs_base_url', 2);

// Set organization-specific setting
setSystemSetting('totvs_base_url', 'https://org1.totvs.com', 1);
setSystemSetting('totvs_base_url', 'https://org2.totvs.com', 2);
```

## API Reference

### GET /api/admin/settings
Retrieve all settings (admin only)

**Query Parameters:**
- `organizationId` (optional) - Filter by organization
- `includeEncrypted` (optional) - Show encrypted values (false by default)

**Response:**
```json
{
  "success": true,
  "settings": [
    {
      "id": 1,
      "key": "totvs_enabled",
      "value": "true",
      "description": "Enable TOTVS ERP integration",
      "type": "boolean",
      "is_encrypted": false,
      "organization_id": null,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 50
}
```

### PUT /api/admin/settings
Update a single setting

**Request Body:**
```json
{
  "key": "totvs_enabled",
  "value": "true",
  "organizationId": 1
}
```

**Response:**
```json
{
  "success": true,
  "key": "totvs_enabled",
  "value": "true"
}
```

### POST /api/admin/settings
Bulk update settings

**Request Body:**
```json
{
  "settings": [
    { "key": "totvs_enabled", "value": "true" },
    { "key": "totvs_base_url", "value": "https://api.totvs.com" },
    { "key": "sap_enabled", "value": "false" }
  ]
}
```

### DELETE /api/admin/settings?key=setting_key
Delete a setting

## Code Examples

### Using in Integration Factories
```typescript
// lib/integrations/erp/totvs.ts
import { getSystemSetting } from '@/lib/db/queries';

export class TotvsClient {
  static async createFromSystemSettings(): Promise<TotvsClient> {
    const baseUrl = getSystemSetting('totvs_base_url');
    const username = getSystemSetting('totvs_username');
    const password = getSystemSetting('totvs_password');

    if (!baseUrl || !username || !password) {
      throw new Error('TOTVS configuration incomplete');
    }

    return new TotvsClient({ baseUrl, username, password });
  }
}
```

### Using in API Routes
```typescript
// app/api/some-route/route.ts
import { getSystemSetting } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  const pixEnabled = getSystemSetting('pix_enabled') === 'true';

  if (!pixEnabled) {
    return NextResponse.json(
      { error: 'PIX integration is disabled' },
      { status: 503 }
    );
  }

  // Process PIX payment...
}
```

## Troubleshooting

### Error: "TOTVS configuration incomplete"
```bash
# Check if settings exist
sqlite3 servicedesk.db "SELECT key, value FROM system_settings WHERE key LIKE 'totvs_%';"

# If empty, run migration again
sqlite3 servicedesk.db < lib/db/migrations/012_system_settings_integrations.sql
```

### Error: "Token inválido" when calling /api/admin/settings
```bash
# Make sure you're logged in as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}'
```

### Settings not updating
```bash
# Check updated_at timestamp
sqlite3 servicedesk.db \
  "SELECT key, value, updated_at FROM system_settings WHERE key = 'totvs_enabled';"

# Check for database locks
lsof servicedesk.db
```

## Security Best Practices

1. **Never commit credentials** - Use system_settings table instead of .env
2. **Use encrypted flag** - Mark sensitive settings with is_encrypted = true
3. **Admin-only access** - Settings API requires admin role
4. **Audit logging** - All changes are logged with user ID and timestamp
5. **Mask values** - Encrypted settings show '***encrypted***' in API responses

## Next Steps

1. ✅ Migration applied
2. ✅ Settings configured
3. ✅ Integrations tested
4. 🔄 Create admin UI for settings management (future enhancement)
5. 🔄 Implement at-rest encryption for sensitive values (future enhancement)

## Support

For issues or questions:
- Check `/SYSTEM_SETTINGS_IMPLEMENTATION.md` for detailed documentation
- Run test script: `node scripts/test-system-settings.ts`
- Check logs: `tail -f logs/app.log | grep -i settings`

---

**Happy integrating!** 🚀
