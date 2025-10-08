# API Testing Quick Start Guide

Quick reference for running API tests and using the testing artifacts.

---

## 🚀 Quick Start (5 Minutes)

### 1. Run All Tests
```bash
# Start dev server (terminal 1)
PORT=4000 npm run dev

# Run tests (terminal 2)
npx playwright test tests/api/complete-api.spec.ts
```

### 2. View Results
```bash
# Generate and open HTML report
npx playwright test tests/api/ --reporter=html
npx playwright show-report
```

### 3. Import Postman Collection
1. Open Postman
2. Import → File → Select `postman_collection.json`
3. Set environment variable: `base_url = http://localhost:4000`
4. Run "Login" request to get auth token

---

## 📁 Files Overview

| File | Purpose | Lines |
|------|---------|-------|
| `tests/api/complete-api.spec.ts` | Automated test suite | 550+ |
| `API_REFERENCE.md` | Complete API docs | 700+ |
| `INTEGRATION_TEST_REPORT.md` | Test results & analysis | 400+ |
| `postman_collection.json` | Postman collection | 900+ |
| `AGENT5_API_TESTING_SUMMARY.md` | Overall summary | 300+ |

---

## 🧪 Running Tests

### All Tests
```bash
npx playwright test tests/api/complete-api.spec.ts
```

### Specific Test Suite
```bash
# Authentication tests only
npx playwright test tests/api/complete-api.spec.ts --grep "Authentication"

# Tickets tests only
npx playwright test tests/api/complete-api.spec.ts --grep "Tickets"

# Security tests only
npx playwright test tests/api/complete-api.spec.ts --grep "Validation"
```

### Debug Mode
```bash
# Visual debugging
npx playwright test tests/api/complete-api.spec.ts --ui

# With browser
npx playwright test tests/api/complete-api.spec.ts --debug
```

### Watch Mode
```bash
npx playwright test tests/api/complete-api.spec.ts --watch
```

---

## 📊 Test Coverage

### ✅ Fully Tested (85%)
- Authentication (register, login, profile)
- Tickets (CRUD, comments, attachments)
- Reference data (categories, priorities, statuses)
- Notifications (list, read, mark)
- Knowledge base (search, articles)
- Error handling & validation
- Security (XSS, SQL injection)
- Performance benchmarks

### ⚠️ Partial (10%)
- Admin endpoints
- Advanced analytics
- File uploads

### ❌ Not Tested (5%)
- SSO integrations
- Webhooks
- Real-time features

---

## 🔧 Common Commands

```bash
# List all tests
npx playwright test tests/api/complete-api.spec.ts --list

# Run single test
npx playwright test tests/api/complete-api.spec.ts --grep "should register"

# Run with verbose output
npx playwright test tests/api/complete-api.spec.ts --workers=1

# Update snapshots (if any)
npx playwright test tests/api/complete-api.spec.ts --update-snapshots

# Show test report
npx playwright show-report
```

---

## 📖 API Documentation Quick Links

### Core Endpoints
- **Auth:** `/api/auth/login`, `/api/auth/register`
- **Tickets:** `/api/tickets` (GET, POST)
- **Categories:** `/api/categories` (public)
- **Search:** `/api/knowledge/search?q=query`

### Authentication
```bash
# Get token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@empresa-demo.com","password":"admin123","tenant_slug":"empresa-demo"}'

# Use token
curl http://localhost:4000/api/tickets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 Key Test Scenarios

### 1. Happy Path - Create Ticket
```typescript
// Register → Login → Create Ticket
test('happy path', async ({ request }) => {
  const auth = await request.post('/api/auth/login', {...});
  const token = (await auth.json()).token;

  const ticket = await request.post('/api/tickets', {
    headers: { 'Authorization': `Bearer ${token}` },
    data: { title: 'Test', description: '...', ... }
  });

  expect(ticket.status()).toBe(200);
});
```

### 2. Error Case - Invalid Input
```typescript
test('validation error', async ({ request }) => {
  const response = await request.post('/api/tickets', {
    headers: { 'Authorization': `Bearer ${token}` },
    data: { title: 'Missing required fields' }
  });

  expect(response.status()).toBe(400);
});
```

### 3. Security - Unauthorized Access
```typescript
test('requires auth', async ({ request }) => {
  const response = await request.get('/api/tickets');
  expect(response.status()).toBe(401);
});
```

---

## 🔍 Debugging Failed Tests

### Check Server Logs
```bash
# Start server with detailed logging
DEBUG=* PORT=4000 npm run dev
```

### Check Database
```bash
# SQLite CLI
sqlite3 servicedesk.db "SELECT * FROM tickets LIMIT 5;"
```

### Playwright Trace
```bash
# Run with trace
npx playwright test tests/api/complete-api.spec.ts --trace on

# View trace
npx playwright show-trace trace.zip
```

---

## 📈 Performance Thresholds

| Endpoint Type | Expected | Max Acceptable |
|---------------|----------|----------------|
| Read (simple) | < 100ms | 1000ms |
| Read (complex) | < 200ms | 2000ms |
| Write (create) | < 150ms | 2000ms |
| Write (update) | < 100ms | 1500ms |
| Search | < 300ms | 3000ms |

---

## 🔐 Security Checklist

- ✅ All passwords hashed with bcrypt
- ✅ JWT tokens properly signed
- ✅ HttpOnly cookies for auth
- ✅ CSRF protection enabled
- ✅ SQL injection prevented
- ✅ XSS protection active
- ✅ Rate limiting on auth endpoints
- ✅ Tenant isolation enforced

---

## 📝 Postman Quick Tips

### Environment Setup
Create environment with:
```json
{
  "base_url": "http://localhost:4000",
  "tenant_slug": "empresa-demo",
  "auth_token": "",
  "user_id": "",
  "ticket_id": ""
}
```

### Auto-save Token
Login request has this test script:
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set('auth_token', jsonData.token);
    pm.environment.set('user_id', jsonData.user.id);
}
```

### Run Collection
1. Import collection
2. Select environment
3. Run "Register" or "Login"
4. Run any authenticated request

---

## 🐛 Common Issues

### Issue: Port 4000 already in use
```bash
# Find process
lsof -i :4000

# Kill process
kill -9 PID
```

### Issue: Database locked
```bash
# Reinitialize database
npm run init-db
```

### Issue: Auth token expired
```bash
# Re-run login in Postman or regenerate in test
```

### Issue: Tests timeout
```bash
# Increase timeout in playwright.config.ts
# Or run with --timeout flag
npx playwright test --timeout=60000
```

---

## 📚 Additional Resources

### Documentation
- **API Reference:** See `API_REFERENCE.md`
- **Test Report:** See `INTEGRATION_TEST_REPORT.md`
- **Full Summary:** See `AGENT5_API_TESTING_SUMMARY.md`

### Tools
- **Playwright Docs:** https://playwright.dev/
- **Postman Docs:** https://learning.postman.com/
- **SQLite Browser:** https://sqlitebrowser.org/

### CI/CD
```yaml
# GitHub Actions example
- name: Run API Tests
  run: |
    npm run init-db
    PORT=4000 npm run dev &
    npx playwright test tests/api/
```

---

## 🎓 Learning Path

1. **Beginner**
   - Read `API_REFERENCE.md`
   - Import Postman collection
   - Run a few requests manually
   - Read test file to understand structure

2. **Intermediate**
   - Run full test suite
   - Add new test case
   - Debug failing test
   - Review test report

3. **Advanced**
   - Add untested endpoint
   - Optimize test performance
   - Set up CI/CD pipeline
   - Create custom test fixtures

---

## ⚡ Pro Tips

1. **Use Postman environments** for different servers (dev, staging, prod)
2. **Run tests before commits** to catch regressions early
3. **Check test report** for performance insights
4. **Use --grep** to run specific tests during development
5. **Keep auth tokens fresh** - they expire after 8 hours

---

## 📞 Getting Help

### Test Failures
1. Check server is running on port 4000
2. Check database is initialized
3. Review test output for specific error
4. Check `INTEGRATION_TEST_REPORT.md` for known issues

### API Questions
1. Search `API_REFERENCE.md`
2. Try request in Postman first
3. Check request/response headers
4. Verify authentication token

---

**Quick Start Guide**
**Version:** 1.0.0
**Last Updated:** 2025-01-05
**Maintained By:** Agent 5 - API Testing Team
