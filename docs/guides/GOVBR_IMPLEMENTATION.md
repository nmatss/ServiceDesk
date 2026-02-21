# Gov.br OAuth Integration - Implementation Summary

## Overview

Complete OAuth 2.0 integration with Brazilian federal government authentication system (Gov.br). This implementation provides secure authentication, CPF/CNPJ validation, verification level tracking, and seamless user synchronization.

## Architecture

### Components Created

#### 1. OAuth Client (`lib/integrations/govbr/oauth-client.ts`)
- Complete OAuth 2.0 authorization code flow
- Token exchange and refresh mechanisms
- User profile retrieval
- CPF/CNPJ validation with check digit verification
- Trust level (bronze/silver/gold) determination
- Token revocation (logout)

**Key Features:**
- Environment-aware (production/staging)
- CSRF protection via state parameter
- Secure credential handling
- Comprehensive error handling

#### 2. Verification Handler (`lib/integrations/govbr/verification.ts`)
- Profile data normalization
- CPF/CNPJ extraction and validation
- User synchronization with database
- Token refresh automation
- Integration status tracking

**Key Features:**
- Multi-tenant support
- Automatic user creation/update
- Secure token storage
- Audit trail logging

#### 3. API Routes

**GET /api/auth/govbr** - OAuth Initiation
- Generates authorization URL
- Sets secure state cookie (CSRF protection)
- Stores return URL for post-auth redirect

**GET /api/auth/govbr/callback** - OAuth Callback
- Validates state parameter
- Exchanges code for tokens
- Fetches user profile
- Creates/updates user
- Generates JWT session
- Redirects to return URL

**POST /api/auth/govbr/refresh** - Token Refresh
- Refreshes expired access tokens
- Updates database with new tokens
- Maintains user session continuity

#### 4. Frontend Page (`app/auth/govbr/page.tsx`)
- Clean, professional UI
- Loading states
- Error handling with user-friendly messages
- Trust level information display
- Security notices
- LGPD compliance messaging

## OAuth Flow

```
1. User clicks "Login com Gov.br"
   ↓
2. GET /api/auth/govbr
   - Generate state (CSRF token)
   - Store state and returnUrl in cookies
   - Redirect to Gov.br authorize endpoint
   ↓
3. User authenticates on Gov.br
   ↓
4. Gov.br redirects to callback
   ↓
5. GET /api/auth/govbr/callback
   - Validate state (CSRF check)
   - Exchange code for tokens
   - Fetch user profile
   - Validate CPF/CNPJ
   - Create/update user in database
   - Store Gov.br integration data
   - Generate JWT session
   - Set auth cookies
   - Redirect to returnUrl
   ↓
6. User logged in successfully
```

## Database Integration

### govbr_integrations Table
The implementation uses the existing `govbr_integrations` table:

```sql
CREATE TABLE govbr_integrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  cpf TEXT,
  cnpj TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  profile_data TEXT, -- JSON
  verification_level TEXT, -- bronze, silver, gold
  last_sync_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### users Table Integration
User records are linked via:
- `sso_provider` = 'gov_br'
- `sso_user_id` = Gov.br sub (unique identifier)
- `metadata` = JSON with CPF, CNPJ, phone, profile data

## Configuration

### Environment Variables Required

```env
# Gov.br OAuth Configuration
GOVBR_CLIENT_ID=your_client_id
GOVBR_CLIENT_SECRET=your_client_secret
GOVBR_REDIRECT_URI=http://localhost:3000/api/auth/govbr/callback
GOVBR_ENVIRONMENT=staging  # or 'production'
```

### Get Credentials
1. Register at https://sso.acesso.gov.br (production) or https://sso.staging.acesso.gov.br (staging)
2. Create OAuth 2.0 application
3. Configure redirect URI
4. Get client ID and secret

## Security Features

### 1. CSRF Protection
- State parameter generated with crypto.randomBytes(32)
- Stored in httpOnly cookie
- Validated on callback

### 2. Token Security
- Access tokens stored in database (encrypted at rest)
- Refresh tokens stored securely
- httpOnly cookies prevent XSS
- Secure flag in production
- SameSite=lax for CSRF protection

### 3. Data Validation
- CPF validation with check digit algorithm
- CNPJ validation with check digit algorithm
- Profile data sanitization
- Multi-tenant isolation

### 4. Audit Trail
- All logins logged to audit_logs table
- User creation/updates tracked
- Integration status changes recorded

## Verification Levels (Selos de Confiabilidade)

### Bronze
- Basic email verification
- Self-reported data
- Minimum security level

### Silver (Prata)
- Internet banking validation
- Government database verification
- Enhanced security

### Gold (Ouro)
- ICP-Brasil digital certificate
- Biometric verification
- In-person validation
- Highest security level

## Usage Examples

### Frontend Integration

```typescript
// Redirect to Gov.br login
window.location.href = '/api/auth/govbr?returnUrl=/dashboard';

// Or use the dedicated page
<Link href="/auth/govbr">Login com Gov.br</Link>
```

### Backend - Check Integration Status

```typescript
import { getGovBrIntegration } from '@/lib/integrations/govbr/verification';

const integration = getGovBrIntegration(userId);
if (integration) {
  console.log('CPF:', integration.cpf);
  console.log('Trust Level:', integration.verificationLevel);
  console.log('Last Sync:', integration.lastSync);
}
```

### Backend - Refresh Tokens

```typescript
import { refreshGovBrTokens } from '@/lib/integrations/govbr/verification';

const result = await refreshGovBrTokens(userId);
if (result.success) {
  console.log('Tokens refreshed');
}
```

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|-----------|-------------|----------|
| `invalid_request` | Missing parameters | Check OAuth flow |
| `invalid_state` | CSRF validation failed | Clear cookies, try again |
| `token_exchange_failed` | Code exchange failed | Check credentials |
| `profile_fetch_failed` | Profile retrieval failed | Check token validity |
| `user_sync_failed` | Database sync failed | Check database connection |
| `tenant_not_found` | Organization not found | Verify tenant configuration |

## Testing

### Test Flow (Staging Environment)

1. Set `GOVBR_ENVIRONMENT=staging`
2. Use staging credentials
3. Visit `/auth/govbr`
4. Authenticate with test account
5. Verify user creation
6. Check integration record
7. Test token refresh

### Test Accounts
Use Gov.br staging environment test accounts provided in their documentation.

## LGPD Compliance

### Data Collection
- Only essential data collected (CPF, name, email)
- User consent implicit in OAuth flow
- Data retention policies applied
- Right to deletion supported

### Data Storage
- CPF stored encrypted
- Tokens stored securely
- Profile data in JSON (metadata)
- Audit trail for compliance

### User Rights
- View stored data via profile
- Request data deletion
- Revoke integration anytime
- Export data (future feature)

## Monitoring & Logging

### Events Logged
- OAuth flow initiation
- Token exchange success/failure
- User creation/update
- Token refresh
- Integration revocation

### Metrics Tracked
- Login success rate
- Token refresh rate
- Verification level distribution
- Error rates by type

## Troubleshooting

### Issue: "Gov.br OAuth not configured"
**Solution:** Set GOVBR_CLIENT_ID and GOVBR_CLIENT_SECRET in .env

### Issue: "State mismatch"
**Solution:** Clear cookies and try again. Check SameSite cookie settings.

### Issue: "Invalid CPF"
**Solution:** Gov.br may return invalid CPF. Contact support.

### Issue: "Token refresh failed"
**Solution:** Refresh token may be expired. Re-authenticate required.

## Future Enhancements

### Planned Features
1. Automatic token refresh background job
2. Multi-factor authentication integration
3. CNPJ-specific workflows
4. Integration with other government services
5. Advanced verification level permissions
6. Batch CPF validation
7. Gov.br logout endpoint integration

### API Extensions
- Webhook support for profile updates
- Batch user sync
- Integration health checks
- Usage analytics

## File Structure

```
lib/integrations/govbr/
  ├── oauth-client.ts       # OAuth 2.0 client
  └── verification.ts       # User sync & validation

app/api/auth/govbr/
  ├── route.ts             # OAuth initiation
  ├── callback/
  │   └── route.ts         # OAuth callback handler
  └── refresh/
      └── route.ts         # Token refresh endpoint

app/auth/govbr/
  └── page.tsx             # Login UI page
```

## Dependencies

### Required Packages (Already Installed)
- `crypto` (Node.js built-in)
- `next` (v15)
- Database connection (`lib/db`)
- Auth utilities (`lib/auth`)
- Monitoring (`lib/monitoring`)

### No Additional Installations Required
All code uses existing project dependencies.

## Support & Resources

### Official Documentation
- Gov.br OAuth: https://manual-roteiro-integracao-login-unico.servicos.gov.br/
- OAuth 2.0 Spec: https://oauth.net/2/

### Internal Documentation
- Database Schema: `lib/db/schema.sql`
- Auth System: `lib/auth/sqlite-auth.ts`
- Environment Config: `lib/config/env.ts`

## Conclusion

The Gov.br OAuth integration is now fully implemented and ready for use. Configure environment variables, test in staging, then deploy to production. The implementation follows security best practices, handles errors gracefully, and provides a seamless user experience.

**Status: ✅ COMPLETE**
