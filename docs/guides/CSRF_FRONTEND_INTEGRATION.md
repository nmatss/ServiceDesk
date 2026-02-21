# CSRF Protection Frontend Integration Guide

## Overview

As of Agent 7's security improvements, **all authentication endpoints now require CSRF tokens**, including `/api/auth/login` and `/api/auth/register`. This document explains how to integrate CSRF protection in your frontend code.

## What Changed

### Before (Insecure)
```typescript
// Login/register were exempt from CSRF protection
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

### After (Secure)
```typescript
// All POST/PUT/PATCH/DELETE requests require CSRF token
const csrfToken = await getCSRFToken();
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({ email, password })
});
```

## Implementation Guide

### Step 1: Create CSRF Token Helper

Create a utility file at `lib/csrf-client.ts`:

```typescript
/**
 * Client-side CSRF token management
 */

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_COOKIE = 'csrf_token';

/**
 * Get CSRF token from cookie
 */
function getCSRFTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_TOKEN_COOKIE) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Fetch a fresh CSRF token from the server
 */
async function fetchCSRFToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf-token', {
    method: 'GET',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  // Token is available in both cookie and header
  const token = response.headers.get(CSRF_TOKEN_HEADER);
  if (!token) {
    throw new Error('CSRF token not found in response');
  }

  return token;
}

/**
 * Get CSRF token (from cookie or fetch new one)
 */
export async function getCSRFToken(): Promise<string> {
  // Try to get from cookie first
  const cookieToken = getCSRFTokenFromCookie();
  if (cookieToken) {
    return cookieToken;
  }

  // Fetch new token if not in cookie
  return await fetchCSRFToken();
}

/**
 * Create fetch wrapper with automatic CSRF token injection
 */
export async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();

  // Only add CSRF token for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const token = await getCSRFToken();

    options.headers = {
      ...options.headers,
      [CSRF_TOKEN_HEADER]: token
    };
  }

  options.credentials = options.credentials || 'include';

  return fetch(url, options);
}
```

### Step 2: Update Login Component

Update your login form to use CSRF tokens:

```typescript
// app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { fetchWithCSRF } from '@/lib/csrf-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // fetchWithCSRF automatically adds CSRF token
      const response = await fetchWithCSRF('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const data = await response.json();

        // Handle CSRF errors specifically
        if (response.status === 403 && data.code === 'CSRF_VALIDATION_FAILED') {
          setError('Security validation failed. Please refresh the page and try again.');
          return;
        }

        setError(data.error || 'Login failed');
        return;
      }

      const data = await response.json();
      // Redirect to dashboard on success
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Login error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {error && <div className="error">{error}</div>}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### Step 3: Update Register Component

Similarly, update your registration form:

```typescript
// app/auth/register/page.tsx
'use client';

import { useState } from 'react';
import { fetchWithCSRF } from '@/lib/csrf-client';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetchWithCSRF('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          tenant_slug: 'empresa-demo' // Or get from context
        })
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 403 && data.code === 'CSRF_VALIDATION_FAILED') {
          setError('Security validation failed. Please refresh the page and try again.');
          return;
        }

        setError(data.error || 'Registration failed');
        return;
      }

      // Redirect to dashboard on success
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Registration error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister}>
      {error && <div className="error">{error}</div>}

      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Full Name"
        required
      />

      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="Email"
        required
      />

      <input
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        placeholder="Password"
        required
      />

      <input
        type="password"
        value={formData.confirmPassword}
        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
        placeholder="Confirm Password"
        required
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Creating Account...' : 'Register'}
      </button>
    </form>
  );
}
```

### Step 4: Update All API Calls

For all other authenticated API calls, use the same pattern:

```typescript
// Example: Creating a ticket
import { fetchWithCSRF } from '@/lib/csrf-client';

async function createTicket(ticketData) {
  const response = await fetchWithCSRF('/api/tickets/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ticketData)
  });

  if (!response.ok) {
    throw new Error('Failed to create ticket');
  }

  return response.json();
}
```

## Advanced: React Hook for CSRF

Create a custom hook for easier integration:

```typescript
// hooks/useCSRF.ts
import { useState, useEffect } from 'react';
import { getCSRFToken } from '@/lib/csrf-client';

export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getCSRFToken()
      .then(token => {
        setCSRFToken(token);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { csrfToken, loading, error };
}

// Usage in component:
function MyForm() {
  const { csrfToken, loading } = useCSRF();

  if (loading) return <div>Loading...</div>;

  return <form>...</form>;
}
```

## SSO Integration

SSO endpoints are exempt from CSRF protection because they use OAuth state parameters:

```typescript
// SSO login - no CSRF token needed
window.location.href = '/api/auth/sso/google';

// SSO callback - handled automatically by backend
// No frontend action needed
```

## Error Handling

Handle CSRF errors gracefully:

```typescript
async function handleAPICall() {
  try {
    const response = await fetchWithCSRF('/api/some-endpoint', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (response.status === 403) {
      const errorData = await response.json();

      if (errorData.code === 'CSRF_VALIDATION_FAILED') {
        // Token expired or invalid - refresh page to get new token
        alert('Your session has expired. Please refresh the page.');
        window.location.reload();
        return;
      }
    }

    // Handle other errors...
  } catch (error) {
    console.error('API call failed:', error);
  }
}
```

## Testing

### Manual Testing

1. Open browser DevTools > Application > Cookies
2. Verify `csrf_token` cookie is present
3. Check Network tab for requests
4. Verify `X-CSRF-Token` header is included in POST/PUT/PATCH/DELETE requests

### Automated Testing

```typescript
// __tests__/csrf.test.ts
import { fetchWithCSRF } from '@/lib/csrf-client';

describe('CSRF Protection', () => {
  it('should include CSRF token in POST requests', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await fetchWithCSRF('/api/test', {
      method: 'POST',
      body: JSON.stringify({ test: true })
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-csrf-token': expect.any(String)
        })
      })
    );
  });

  it('should not include CSRF token in GET requests', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await fetchWithCSRF('/api/test', { method: 'GET' });

    const callArgs = fetchSpy.mock.calls[0][1];
    expect(callArgs?.headers).not.toHaveProperty('x-csrf-token');
  });
});
```

## Migration Checklist

- [ ] Create `lib/csrf-client.ts` helper
- [ ] Update login page to use `fetchWithCSRF`
- [ ] Update register page to use `fetchWithCSRF`
- [ ] Update all POST/PUT/PATCH/DELETE API calls
- [ ] Add error handling for CSRF failures
- [ ] Test all forms thoroughly
- [ ] Update E2E tests to handle CSRF tokens
- [ ] Document for team members

## Security Benefits

1. **Prevents CSRF attacks**: Attackers cannot forge requests without valid token
2. **Session binding**: Tokens are bound to user session for extra security
3. **Token expiration**: Tokens expire after 1 hour, limiting attack window
4. **HMAC signing**: Tokens are cryptographically signed to prevent tampering

## Troubleshooting

### "CSRF token validation failed"

1. Check if `csrf_token` cookie exists
2. Verify `X-CSRF-Token` header is included in request
3. Check if token has expired (1 hour lifetime)
4. Ensure `credentials: 'include'` in fetch options

### Token not in cookie

1. Call `/api/auth/csrf-token` endpoint explicitly
2. Check browser cookie settings
3. Verify SameSite cookie settings
4. Check for domain/path issues

### SSO login fails

SSO endpoints should NOT require CSRF tokens. If you get CSRF errors on SSO:
- Check that the SSO callback URL includes `/callback`
- Verify middleware exemption is correct

## Additional Resources

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [MDN: CSRF](https://developer.mozilla.org/en-US/docs/Glossary/CSRF)
- ServiceDesk Security Documentation: `/docs/SECURITY.md`
