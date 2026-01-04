# IDOR Vulnerability Fixes - Testing Guide

This document provides manual testing procedures to verify the IDOR vulnerability fixes.

## Overview

Three critical IDOR vulnerabilities (CVSS 9.8) have been fixed:

1. **`/api/tickets/user/[userId]`** - Now requires authentication and validates ownership
2. **`/api/portal/tickets/[id]`** - Now requires valid UUID token
3. **Tenant isolation** - Cross-organization access is blocked

## Test Scenarios

### 1. Testing `/api/tickets/user/[userId]` Endpoint

#### ❌ Test 1.1: Unauthenticated Access (Should FAIL)

```bash
# Try to access user's tickets without authentication
curl -X GET "http://localhost:3000/api/tickets/user/1" \
  -H "Content-Type: application/json"

# Expected Response:
# Status: 401 Unauthorized
# {
#   "success": false,
#   "error": "Autenticação necessária"
# }
```

#### ✅ Test 1.2: Authenticated Access to Own Tickets (Should SUCCEED)

```bash
# First, login to get auth token
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' \
  -c cookies.txt

# Then access own tickets
curl -X GET "http://localhost:3000/api/tickets/user/1" \
  -H "Content-Type: application/json" \
  -b cookies.txt

# Expected Response:
# Status: 200 OK
# {
#   "success": true,
#   "tickets": [...]
# }
```

#### ❌ Test 1.3: Access to Other User's Tickets (Should FAIL for non-admins)

```bash
# Login as regular user
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' \
  -c cookies.txt

# Try to access another user's tickets
curl -X GET "http://localhost:3000/api/tickets/user/99" \
  -H "Content-Type: application/json" \
  -b cookies.txt

# Expected Response:
# Status: 403 Forbidden
# {
#   "success": false,
#   "error": "Acesso negado"
# }
```

#### ✅ Test 1.4: Admin Access to Any User's Tickets (Should SUCCEED)

```bash
# Login as admin
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }' \
  -c admin-cookies.txt

# Access any user's tickets
curl -X GET "http://localhost:3000/api/tickets/user/5" \
  -H "Content-Type: application/json" \
  -b admin-cookies.txt

# Expected Response:
# Status: 200 OK
# {
#   "success": true,
#   "tickets": [...]
# }
```

### 2. Testing `/api/portal/tickets/[id]` Endpoint

#### ❌ Test 2.1: Access Without Token (Should FAIL)

```bash
# Try to access portal ticket without token
curl -X GET "http://localhost:3000/api/portal/tickets/1" \
  -H "Content-Type: application/json"

# Expected Response:
# Status: 401 Unauthorized
# {
#   "success": false,
#   "error": "Token de acesso obrigatório"
# }
```

#### ❌ Test 2.2: Access With Invalid Token (Should FAIL)

```bash
# Try with fake token
curl -X GET "http://localhost:3000/api/portal/tickets/1?token=invalid-token-123" \
  -H "Content-Type: application/json"

# Expected Response:
# Status: 401 Unauthorized
# {
#   "success": false,
#   "error": "Token inválido"
# }
```

#### ✅ Test 2.3: Access With Valid Token (Should SUCCEED)

```bash
# Generate a token for ticket ID 1 (using script or admin panel)
# For testing, run this script:
npx tsx -e "
import { generateTicketAccessToken } from './lib/db/queries';
const token = generateTicketAccessToken(1, 30);
console.log('Token:', token);
"

# Use the generated token
curl -X GET "http://localhost:3000/api/portal/tickets/1?token=YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Expected Response:
# Status: 200 OK
# {
#   "success": true,
#   "ticket": {...},
#   "comments": [...],
#   "attachments": [...]
# }
```

#### ❌ Test 2.4: Use Token for Wrong Ticket (Should FAIL)

```bash
# Generate token for ticket 1
TOKEN=$(npx tsx -e "
import { generateTicketAccessToken } from './lib/db/queries';
console.log(generateTicketAccessToken(1, 30));
")

# Try to use it for ticket 2
curl -X GET "http://localhost:3000/api/portal/tickets/2?token=$TOKEN" \
  -H "Content-Type: application/json"

# Expected Response:
# Status: 403 Forbidden
# {
#   "success": false,
#   "error": "Token inválido ou expirado"
# }
```

#### ✅ Test 2.5: Add Comment With Valid Token (Should SUCCEED)

```bash
# Generate token for ticket 1
TOKEN=$(npx tsx -e "
import { generateTicketAccessToken } from './lib/db/queries';
console.log(generateTicketAccessToken(1, 30));
")

# Add a comment
curl -X POST "http://localhost:3000/api/portal/tickets/1?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a test comment from customer",
    "customer_name": "John Doe",
    "customer_email": "john@example.com"
  }'

# Expected Response:
# Status: 200 OK
# {
#   "success": true,
#   "message": "Comentário adicionado com sucesso",
#   "comment_id": 123
# }
```

### 3. Testing Token Management Functions

#### Test 3.1: Generate Token Programmatically

```bash
npx tsx -e "
import { generateTicketAccessToken } from './lib/db/queries';

// Generate token for ticket 1, expires in 30 days
const token = generateTicketAccessToken(1, 30, 1);
console.log('Generated token:', token);
"
```

#### Test 3.2: Validate Token

```bash
npx tsx -e "
import { validateTicketAccessToken } from './lib/db/queries';

const token = 'YOUR_TOKEN_HERE';
const tokenData = validateTicketAccessToken(token, 1);

if (tokenData) {
  console.log('Token is valid!');
  console.log('Ticket ID:', tokenData.ticket_id);
  console.log('Expires:', tokenData.expires_at);
  console.log('Usage count:', tokenData.usage_count);
} else {
  console.log('Token is invalid or expired');
}
"
```

#### Test 3.3: Revoke Token

```bash
npx tsx -e "
import { revokeTicketAccessToken } from './lib/db/queries';

const token = 'YOUR_TOKEN_HERE';
const revoked = revokeTicketAccessToken(token);

if (revoked) {
  console.log('Token revoked successfully');
} else {
  console.log('Token not found');
}
"
```

#### Test 3.4: Get All Tokens for Ticket

```bash
npx tsx -e "
import { getTicketTokens } from './lib/db/queries';

const tickets = getTicketTokens(1);
console.log('Active tokens for ticket 1:', tickets.length);
tickets.forEach(token => {
  console.log('- Token:', token.token.substring(0, 8) + '...');
  console.log('  Created:', token.created_at);
  console.log('  Expires:', token.expires_at);
  console.log('  Used:', token.usage_count, 'times');
});
"
```

## Automated Test Suite

Run the comprehensive test suite:

```bash
npx tsx scripts/test-idor-fixes.ts
```

Expected output:
```
✅ Test 1 (Permissions): PASSED
✅ Test 2 (Tokens): PASSED
✅ Test 3 (Database): PASSED

Overall: ✅ ALL TESTS PASSED
```

## Security Verification Checklist

- [ ] Unauthenticated requests to `/api/tickets/user/[userId]` are rejected
- [ ] Users cannot access other users' tickets (unless admin)
- [ ] Admin users can access all tickets
- [ ] Portal endpoint requires valid UUID token
- [ ] Tokens are validated against specific ticket IDs
- [ ] Expired tokens are rejected
- [ ] Revoked tokens cannot be used
- [ ] Token usage is tracked (count, timestamps, metadata)
- [ ] Rate limiting is active on all endpoints
- [ ] Security events are logged
- [ ] Input validation prevents injection attacks
- [ ] Tenant isolation prevents cross-organization access

## Common Issues & Solutions

### Issue: "Token inválido" even with valid token

**Solution**: Check that:
1. Token is not expired (check `expires_at` in database)
2. Token is not revoked (`is_active = 1`, `revoked_at IS NULL`)
3. Token matches the ticket ID you're accessing
4. Token is a valid UUID v4 format

### Issue: "Acesso negado" for own tickets

**Solution**: Verify:
1. JWT authentication cookie is being sent
2. User ID in JWT matches the userId parameter
3. User's organization_id matches ticket's organization_id
4. User is not locked out or inactive

### Issue: Admin cannot access other users' tickets

**Solution**: Check:
1. User role is one of: `super_admin`, `tenant_admin`, `admin`, `manager`
2. Role is correctly set in JWT payload
3. User belongs to same organization as target tickets

## Performance Testing

Test rate limiting:

```bash
# Should succeed for first 100 requests, then be rate limited
for i in {1..105}; do
  curl -X GET "http://localhost:3000/api/portal/tickets/1?token=YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -w "\nStatus: %{http_code}\n"
done
```

After 100 requests within 15 minutes, you should see:
```
Status: 429 Too Many Requests
{
  "error": "Rate limit exceeded"
}
```

## Cleanup

After testing, clean up expired tokens:

```bash
npx tsx -e "
import { cleanupExpiredTokens } from './lib/db/queries';
const deleted = cleanupExpiredTokens();
console.log('Deleted', deleted, 'expired tokens');
"
```

## Next Steps

1. Integrate token generation into ticket creation workflow
2. Email tokens to customers when tickets are created
3. Add frontend UI to display token-protected portal pages
4. Set up cron job for token cleanup
5. Add token regeneration endpoint for support agents
6. Update API documentation with token requirements
