# Agent 7 Security Changes - Quick Reference

## What Changed?

### 🔒 CSRF Protection Now Required for Login/Register

**Before**: Login and register forms worked without CSRF tokens
**Now**: All authentication endpoints require CSRF tokens

### ⚠️ Action Required

If you're a **frontend developer**, you MUST update your code before the next deployment:

```typescript
// ❌ OLD CODE (Will fail with 403 error)
fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});

// ✅ NEW CODE (Required)
import { fetchWithCSRF } from '@/lib/csrf-client';

fetchWithCSRF('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

## Quick Start

1. **Read the full guide**: `CSRF_FRONTEND_INTEGRATION.md`
2. **Copy the helper**: Create `lib/csrf-client.ts` from the guide
3. **Update login page**: Use `fetchWithCSRF` instead of `fetch`
4. **Update register page**: Use `fetchWithCSRF` instead of `fetch`
5. **Test thoroughly**: Ensure all forms work correctly

## What Else Changed?

### 🛡️ Tighter Security Headers
- CSP now blocks `unsafe-eval` and `unsafe-inline` in production
- Only affects production builds, development unchanged

### 📝 Better Logging
- MFA codes are no longer logged (security risk eliminated)
- All auth errors now use structured logging

### 🔐 Stronger CSRF Tokens
- Tokens now expire after 1 hour (was 8 hours)
- Tokens bound to user session (prevents hijacking)
- HMAC-signed for integrity

## New API Endpoint

### GET /api/auth/csrf-token

Get a fresh CSRF token before login/register:

```typescript
const response = await fetch('/api/auth/csrf-token');
const { token } = await response.json();

// Use this token in subsequent POST requests
fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token
  },
  body: JSON.stringify({ email, password })
});
```

## Error Handling

```typescript
const response = await fetchWithCSRF('/api/auth/login', { ... });

if (response.status === 403) {
  const data = await response.json();

  if (data.code === 'CSRF_VALIDATION_FAILED') {
    // Token expired or invalid - refresh page
    window.location.reload();
  }
}
```

## Testing Checklist

- [ ] Login form works with CSRF token
- [ ] Register form works with CSRF token
- [ ] Token refresh works after 1 hour
- [ ] Error messages display correctly
- [ ] SSO login still works (no CSRF needed)

## Need Help?

1. **Full Documentation**: `CSRF_FRONTEND_INTEGRATION.md`
2. **Security Report**: `AGENT7_SECURITY_REPORT.md`
3. **Code Examples**: Both docs include working code samples

## Timeline

- ✅ **Backend Changes**: Complete (deployed)
- ⚠️ **Frontend Changes**: Required before production
- 📅 **Deadline**: Before next production deployment

## Questions?

Contact the security team or check the comprehensive documentation in:
- `CSRF_FRONTEND_INTEGRATION.md` (Frontend guide)
- `AGENT7_SECURITY_REPORT.md` (Technical details)

---

**TL;DR**: Use `fetchWithCSRF` instead of `fetch` for all login/register forms. Read `CSRF_FRONTEND_INTEGRATION.md` for details.
