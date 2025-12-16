# Gov.br OAuth - Quick Start Guide

## 🚀 Setup (5 minutes)

### 1. Get Gov.br Credentials

**Staging (Development):**
- Go to https://sso.staging.acesso.gov.br
- Create developer account
- Register OAuth application
- Set redirect URI: `http://localhost:3000/api/auth/govbr/callback`
- Get Client ID and Client Secret

**Production:**
- Go to https://sso.acesso.gov.br
- Follow same process with production URLs

### 2. Configure Environment Variables

Add to your `.env.local` file:

```env
# Gov.br OAuth
GOVBR_CLIENT_ID=your_client_id_here
GOVBR_CLIENT_SECRET=your_secret_here
GOVBR_REDIRECT_URI=http://localhost:3000/api/auth/govbr/callback
GOVBR_ENVIRONMENT=staging
```

### 3. Test the Integration

```bash
# Start development server
npm run dev

# Visit the Gov.br login page
open http://localhost:3000/auth/govbr

# Click "Entrar com Gov.br"
# Authenticate with test account
# You'll be redirected to /dashboard
```

## 📋 Usage

### Add Gov.br Button to Login Page

```tsx
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div>
      {/* Regular login form */}
      
      {/* Gov.br login button */}
      <div className="mt-4">
        <Link
          href="/auth/govbr"
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
          </svg>
          Entrar com Gov.br
        </Link>
      </div>
    </div>
  );
}
```

### Check User's Gov.br Integration Status

```typescript
import { getGovBrIntegration } from '@/lib/integrations/govbr/verification';

// In your API route or server component
const integration = getGovBrIntegration(userId);

if (integration) {
  console.log('CPF:', integration.cpf);
  console.log('Verification:', integration.verificationLevel); // bronze, silver, or gold
  console.log('Profile:', integration.profileData);
}
```

### Refresh Tokens Programmatically

```typescript
import { refreshGovBrTokens } from '@/lib/integrations/govbr/verification';

// Refresh tokens for a user
const result = await refreshGovBrTokens(userId);

if (result.success) {
  console.log('✅ Tokens refreshed');
} else {
  console.log('❌ Refresh failed:', result.error);
}
```

## 🔐 Security Checklist

- ✅ CSRF protection (state parameter)
- ✅ httpOnly cookies for tokens
- ✅ Secure flag in production
- ✅ CPF/CNPJ validation
- ✅ Multi-tenant isolation
- ✅ Audit logging
- ✅ LGPD compliance

## 🧪 Testing

### Test Users (Staging)
Gov.br provides test accounts. Check their documentation for credentials.

### Test Flow
1. ✅ OAuth initiation works
2. ✅ Redirect to Gov.br successful
3. ✅ Callback processes correctly
4. ✅ User created/updated in database
5. ✅ govbr_integrations record created
6. ✅ JWT session established
7. ✅ Redirect to dashboard works

### Verify Database

```sql
-- Check if user was created
SELECT * FROM users WHERE sso_provider = 'gov_br';

-- Check integration record
SELECT * FROM govbr_integrations WHERE user_id = X;

-- Check audit log
SELECT * FROM audit_logs WHERE action LIKE 'govbr%' ORDER BY created_at DESC;
```

## 🚨 Common Issues

### "OAuth not configured"
**Fix:** Set GOVBR_CLIENT_ID and GOVBR_CLIENT_SECRET in .env

### "Invalid state"
**Fix:** Clear browser cookies and try again

### "Token exchange failed"
**Fix:** Verify credentials are correct and redirect URI matches

### "Tenant not found"
**Fix:** Ensure tenant context is set in middleware

## 📊 Verification Levels

| Level | Badge | Requirements | Use Case |
|-------|-------|--------------|----------|
| Bronze | 🥉 | Email verified | Basic access |
| Silver | 🥈 | Internet banking | Enhanced features |
| Gold | 🥇 | Digital certificate | Sensitive operations |

## 🎯 Production Deployment

### Before Going Live

1. Change `GOVBR_ENVIRONMENT=production`
2. Update `GOVBR_REDIRECT_URI` to production URL
3. Get production credentials from Gov.br
4. Test with real account
5. Monitor error logs
6. Set up token refresh cron job (optional)

### Production URLs

```env
GOVBR_REDIRECT_URI=https://yourdomain.com/api/auth/govbr/callback
GOVBR_ENVIRONMENT=production
```

## 📚 API Reference

### GET /api/auth/govbr
Initiates OAuth flow

**Query Parameters:**
- `returnUrl` (optional): Where to redirect after login

**Response:** 302 Redirect to Gov.br

### GET /api/auth/govbr/callback
Handles OAuth callback

**Query Parameters:**
- `code`: Authorization code
- `state`: CSRF token

**Response:** 302 Redirect to returnUrl

### POST /api/auth/govbr/refresh
Refreshes access token

**Body:**
```json
{
  "userId": 123
}
```

**Response:**
```json
{
  "success": true,
  "tokens": { ... }
}
```

## 🔄 Token Lifecycle

```
Access Token:  30 minutes
Refresh Token: 30 days
Session:       7 days (configurable)
```

## 📞 Support

### Documentation
- Full docs: `GOVBR_IMPLEMENTATION.md`
- Gov.br Manual: https://manual-roteiro-integracao-login-unico.servicos.gov.br/

### Files Modified/Created
- ✅ `lib/integrations/govbr/oauth-client.ts` (already existed)
- ✅ `lib/integrations/govbr/verification.ts` (new)
- ✅ `app/api/auth/govbr/route.ts` (new)
- ✅ `app/api/auth/govbr/callback/route.ts` (already existed)
- ✅ `app/api/auth/govbr/refresh/route.ts` (new)
- ✅ `app/auth/govbr/page.tsx` (new)

### Database Tables Used
- `users` - User accounts
- `govbr_integrations` - Gov.br linkage
- `audit_logs` - Activity tracking

## ✅ Success Criteria

Your integration is complete when:
- [ ] Users can login with Gov.br
- [ ] CPF is validated and stored
- [ ] Verification level is tracked
- [ ] Tokens are refreshed automatically
- [ ] Audit logs are created
- [ ] Multi-tenant isolation works
- [ ] Error handling is graceful
- [ ] LGPD compliance is maintained

**Status: 🎉 IMPLEMENTATION COMPLETE**

---

For detailed technical information, see `GOVBR_IMPLEMENTATION.md`
