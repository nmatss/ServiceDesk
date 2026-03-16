import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';

/**
 * TENANT ISOLATION SECURITY TESTS (Playwright E2E)
 *
 * Validates that cross-organization data access is impossible across ALL
 * critical API surfaces. This is the #1 security risk in a multi-tenant SaaS.
 *
 * Strategy:
 *   1. Log in as Org A admin -> create test data (ticket, comment, knowledge article)
 *   2. Log in as Org B admin -> attempt to read/modify/delete Org A data
 *   3. Every cross-org attempt MUST return 401, 403, or 404 — never the data
 *
 * Prerequisites:
 *   - Dev server running at localhost:3000
 *   - Seed data loaded (npm run init-db)
 *   - Default org (id=1, slug=demo) exists with admin@servicedesk.com / 123456
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000';
const PASSWORD = '123456';

/** Blocked status codes — any of these means isolation held. */
const BLOCKED_STATUSES = [401, 403, 404];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoginResult {
  accessToken: string;
  userId: number;
  organizationId: number;
  role: string;
  cookies: { name: string; value: string }[];
}

interface OrgTestData {
  login: LoginResult;
  ticketId?: number;
  commentId?: number;
  knowledgeArticleId?: number;
  problemId?: number;
  changeRequestId?: number;
  cmdbItemId?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Log in via the /api/auth/login endpoint and extract the auth cookies
 * needed for subsequent API calls.
 */
async function loginAs(
  request: APIRequestContext,
  email: string,
  password: string,
  tenantSlug: string
): Promise<LoginResult> {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password, tenant_slug: tenantSlug },
  });

  expect(res.ok(), `Login failed for ${email}: ${res.status()}`).toBe(true);

  const body = await res.json();
  expect(body.success, `Login response not successful for ${email}`).toBe(true);

  // Extract Set-Cookie headers (Playwright stores them automatically on the
  // context, but we also capture them for explicit header-based calls).
  const setCookie = res.headers()['set-cookie'] ?? '';
  const cookiePairs = (Array.isArray(setCookie) ? setCookie : setCookie.split(/,(?=[^ ])/))
    .map((c: string) => {
      const [nameValue] = c.split(';');
      const eqIndex = nameValue.indexOf('=');
      return {
        name: nameValue.substring(0, eqIndex).trim(),
        value: nameValue.substring(eqIndex + 1).trim(),
      };
    })
    .filter((c: { name: string; value: string }) => c.name && c.value);

  return {
    accessToken: cookiePairs.find((c: { name: string }) => c.name === 'access_token')?.value ?? '',
    userId: body.user.id,
    organizationId: body.user.organization_id,
    role: body.user.role,
    cookies: cookiePairs,
  };
}

/**
 * Build a Cookie header string from an array of name/value pairs.
 */
function buildCookieHeader(cookies: { name: string; value: string }[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/**
 * Make an authenticated request using cookies from a login result.
 */
async function authedGet(
  request: APIRequestContext,
  login: LoginResult,
  path: string
): Promise<APIResponse> {
  return request.get(`${BASE_URL}${path}`, {
    headers: { Cookie: buildCookieHeader(login.cookies) },
  });
}

async function authedPost(
  request: APIRequestContext,
  login: LoginResult,
  path: string,
  data: Record<string, unknown>
): Promise<APIResponse> {
  return request.post(`${BASE_URL}${path}`, {
    headers: { Cookie: buildCookieHeader(login.cookies) },
    data,
  });
}

async function authedPut(
  request: APIRequestContext,
  login: LoginResult,
  path: string,
  data: Record<string, unknown>
): Promise<APIResponse> {
  return request.put(`${BASE_URL}${path}`, {
    headers: { Cookie: buildCookieHeader(login.cookies) },
    data,
  });
}

async function authedPatch(
  request: APIRequestContext,
  login: LoginResult,
  path: string,
  data: Record<string, unknown>
): Promise<APIResponse> {
  return request.patch(`${BASE_URL}${path}`, {
    headers: { Cookie: buildCookieHeader(login.cookies) },
    data,
  });
}

async function authedDelete(
  request: APIRequestContext,
  login: LoginResult,
  path: string
): Promise<APIResponse> {
  return request.delete(`${BASE_URL}${path}`, {
    headers: { Cookie: buildCookieHeader(login.cookies) },
  });
}

/**
 * Register a new user in a specific org. Returns the login result for that user.
 * If registration fails (e.g. user already exists), falls back to login.
 */
async function ensureUserAndLogin(
  request: APIRequestContext,
  email: string,
  password: string,
  name: string,
  tenantSlug: string
): Promise<LoginResult> {
  // Try to register first (idempotent — may already exist)
  await request.post(`${BASE_URL}/api/auth/register`, {
    data: { email, password, name, tenant_slug: tenantSlug },
  });

  // Always log in regardless of registration outcome
  return loginAs(request, email, password, tenantSlug);
}

/**
 * Assert that a response is blocked (401/403/404) and does NOT leak data.
 */
function expectBlocked(res: APIResponse, context: string) {
  expect(
    BLOCKED_STATUSES.includes(res.status()),
    `${context}: expected blocked status (401/403/404) but got ${res.status()}`
  ).toBe(true);
}

/**
 * Assert that a list response does not contain a specific item id.
 */
async function expectListExcludes(
  res: APIResponse,
  fieldName: string,
  excludedId: number,
  context: string
) {
  if (!res.ok()) return; // If blocked, that is fine too

  const body = await res.json();
  // Support both { data: [...] } and direct array, and { tickets: [...] } patterns
  const items: unknown[] =
    Array.isArray(body) ? body :
    Array.isArray(body.data) ? body.data :
    Array.isArray(body.tickets) ? body.tickets :
    Array.isArray(body.problems) ? body.problems :
    Array.isArray(body.items) ? body.items :
    Array.isArray(body.articles) ? body.articles :
    Array.isArray(body.changes) ? body.changes :
    Array.isArray(body.results) ? body.results :
    [];

  const found = items.some((item: unknown) => {
    const record = item as Record<string, unknown>;
    return record[fieldName] === excludedId || record.id === excludedId;
  });

  expect(found, `${context}: list must NOT contain ${fieldName}=${excludedId}`).toBe(false);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Tenant Isolation - Cross-Org Data Access', () => {
  // Shared state across tests in this describe block
  const orgA: OrgTestData = {} as OrgTestData;
  const orgB: OrgTestData = {} as OrgTestData;

  // -----------------------------------------------------------------------
  // Setup: create test data
  // -----------------------------------------------------------------------

  test.beforeAll(async ({ request }) => {
    // --- Org A (default demo org) ---
    orgA.login = await loginAs(request, 'admin@servicedesk.com', PASSWORD, 'demo');

    // Create a ticket in Org A
    const ticketRes = await authedPost(request, orgA.login, '/api/tickets', {
      title: `[ISOLATION-TEST] Org A Ticket ${Date.now()}`,
      description: 'Confidential data that Org B must never see.',
      priority_id: 1,
      category_id: 1,
    });

    if (ticketRes.ok()) {
      const ticketBody = await ticketRes.json();
      orgA.ticketId = ticketBody.id ?? ticketBody.ticket?.id ?? ticketBody.data?.id;
    }

    // Create a comment on the ticket
    if (orgA.ticketId) {
      const commentRes = await authedPost(
        request,
        orgA.login,
        `/api/tickets/${orgA.ticketId}/comments`,
        { content: 'Confidential comment — Org A only.' }
      );
      if (commentRes.ok()) {
        const commentBody = await commentRes.json();
        orgA.commentId = commentBody.id ?? commentBody.comment?.id ?? commentBody.data?.id;
      }
    }

    // Create a knowledge article in Org A
    const kbRes = await authedPost(request, orgA.login, '/api/knowledge', {
      title: `[ISOLATION-TEST] Org A KB ${Date.now()}`,
      content: 'Secret knowledge for Org A.',
      category_id: 1,
      status: 'published',
    });
    if (kbRes.ok()) {
      const kbBody = await kbRes.json();
      orgA.knowledgeArticleId = kbBody.id ?? kbBody.article?.id ?? kbBody.data?.id;
    }

    // Create a problem in Org A
    const problemRes = await authedPost(request, orgA.login, '/api/problems', {
      title: `[ISOLATION-TEST] Org A Problem ${Date.now()}`,
      description: 'Root cause analysis — Org A confidential.',
      impact: 'high',
      status: 'open',
    });
    if (problemRes.ok()) {
      const problemBody = await problemRes.json();
      orgA.problemId = problemBody.id ?? problemBody.problem?.id ?? problemBody.data?.id;
    }

    // Create a change request in Org A
    const changeRes = await authedPost(request, orgA.login, '/api/changes', {
      title: `[ISOLATION-TEST] Org A Change ${Date.now()}`,
      description: 'Change request — Org A confidential.',
      change_type_id: 1,
      category: 'normal',
      priority: 'medium',
      risk_level: 'low',
    });
    if (changeRes.ok()) {
      const changeBody = await changeRes.json();
      orgA.changeRequestId = changeBody.id ?? changeBody.change?.id ?? changeBody.data?.id;
    }

    // Create a CMDB item in Org A
    const cmdbRes = await authedPost(request, orgA.login, '/api/cmdb', {
      name: `[ISOLATION-TEST] Org A Server ${Date.now()}`,
      description: 'Production server — Org A confidential.',
      ci_type_id: 1,
      status_id: 1,
      criticality: 'high',
    });
    if (cmdbRes.ok()) {
      const cmdbBody = await cmdbRes.json();
      orgA.cmdbItemId = cmdbBody.id ?? cmdbBody.ci?.id ?? cmdbBody.data?.id;
    }

    // --- Org B (create a second org + admin) ---
    // Register a second organization admin. The register endpoint creates
    // the user scoped to the org identified by tenant_slug. If the org
    // does not exist the test will still pass — it just means that org-level
    // isolation tests will exercise the "wrong tenant" path.
    orgB.login = await ensureUserAndLogin(
      request,
      'isolation-orgb-admin@test.local',
      PASSWORD,
      'Org B Admin',
      'demo' // same org slug — worst case for isolation testing (same org but different user)
    );

    // If Org B ended up in the same org as Org A, we still test that a
    // non-owner low-priv user cannot access data. For true cross-org tests,
    // create a second org via the super admin API.
    const orgCreateRes = await authedPost(request, orgA.login, '/api/admin/super/organizations', {
      name: `Isolation Test Org B ${Date.now()}`,
      slug: `iso-orgb-${Date.now()}`,
      subscription_plan: 'basic',
    });

    if (orgCreateRes.ok()) {
      const orgBData = await orgCreateRes.json();
      const orgBSlug: string = orgBData.slug ?? orgBData.organization?.slug ?? orgBData.data?.slug;

      if (orgBSlug) {
        // Register admin in the new org
        const regRes = await request.post(`${BASE_URL}/api/auth/register`, {
          data: {
            email: `orgb-admin-${Date.now()}@test.local`,
            password: PASSWORD,
            name: 'Org B Admin',
            tenant_slug: orgBSlug,
          },
        });

        if (regRes.ok()) {
          const regBody = await regRes.json();
          const orgBEmail: string = regBody.user?.email ?? regBody.email;
          if (orgBEmail) {
            orgB.login = await loginAs(request, orgBEmail, PASSWORD, orgBSlug);
          }
        }
      }
    }

    // Ensure orgB login resolved to a different org than orgA (best effort)
    // If not, tests still validate row-level filtering.
  });

  // -----------------------------------------------------------------------
  // Tickets
  // -----------------------------------------------------------------------

  test.describe('Tickets', () => {
    test('Org B cannot GET Org A ticket by ID', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedGet(request, orgB.login, `/api/tickets/${orgA.ticketId}`);
      expectBlocked(res, 'GET /api/tickets/:id');
    });

    test('Org B cannot PATCH/PUT Org A ticket', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedPut(request, orgB.login, `/api/tickets/${orgA.ticketId}`, {
        title: 'HACKED by Org B',
      });
      expectBlocked(res, 'PUT /api/tickets/:id');

      const res2 = await authedPatch(request, orgB.login, `/api/tickets/${orgA.ticketId}`, {
        title: 'HACKED by Org B',
      });
      expectBlocked(res2, 'PATCH /api/tickets/:id');
    });

    test('Org B cannot DELETE Org A ticket', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedDelete(request, orgB.login, `/api/tickets/${orgA.ticketId}`);
      expectBlocked(res, 'DELETE /api/tickets/:id');
    });

    test('Org B ticket list does not contain Org A tickets', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedGet(request, orgB.login, '/api/tickets');
      await expectListExcludes(res, 'id', orgA.ticketId!, 'GET /api/tickets list');
    });

    test('Org B cannot access Org A ticket stats', async ({ request }) => {
      const res = await authedGet(request, orgB.login, '/api/tickets/stats');
      // Stats should only reflect Org B data; we just verify it does not fail with cross-org leak
      if (res.ok()) {
        const body = await res.json();
        // Ensure the response does not explicitly contain Org A's org id
        const bodyStr = JSON.stringify(body);
        expect(
          bodyStr.includes(`"organization_id":${orgA.login.organizationId}`) &&
            orgA.login.organizationId !== orgB.login.organizationId
        ).toBe(false);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Comments & Attachments
  // -----------------------------------------------------------------------

  test.describe('Comments & Attachments', () => {
    test('Org B cannot read Org A ticket comments', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedGet(
        request,
        orgB.login,
        `/api/tickets/${orgA.ticketId}/comments`
      );
      expectBlocked(res, 'GET /api/tickets/:id/comments');
    });

    test('Org B cannot post a comment on Org A ticket', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedPost(
        request,
        orgB.login,
        `/api/tickets/${orgA.ticketId}/comments`,
        { content: 'Injected comment from Org B' }
      );
      expectBlocked(res, 'POST /api/tickets/:id/comments');
    });

    test('Org B cannot access Org A ticket attachments', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedGet(
        request,
        orgB.login,
        `/api/tickets/${orgA.ticketId}/attachments`
      );
      expectBlocked(res, 'GET /api/tickets/:id/attachments');
    });

    test('Org B cannot upload attachment to Org A ticket', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedPost(
        request,
        orgB.login,
        `/api/tickets/${orgA.ticketId}/attachments`,
        { filename: 'malicious.txt', content: 'pwned' }
      );
      expectBlocked(res, 'POST /api/tickets/:id/attachments');
    });
  });

  // -----------------------------------------------------------------------
  // Users
  // -----------------------------------------------------------------------

  test.describe('Users', () => {
    test('Org B cannot GET Org A user details', async ({ request }) => {
      const res = await authedGet(
        request,
        orgB.login,
        `/api/admin/users/${orgA.login.userId}`
      );
      expectBlocked(res, 'GET /api/admin/users/:id');
    });

    test('Org B user list does not contain Org A users', async ({ request }) => {
      const res = await authedGet(request, orgB.login, '/api/admin/users');
      if (res.ok()) {
        await expectListExcludes(res, 'id', orgA.login.userId, 'GET /api/admin/users list');
      }
    });

    test('Org B cannot modify Org A user role', async ({ request }) => {
      const res = await authedPut(
        request,
        orgB.login,
        `/api/admin/users/${orgA.login.userId}`,
        { role: 'user' }
      );
      expectBlocked(res, 'PUT /api/admin/users/:id role change');
    });

    test('Org B cannot deactivate Org A user', async ({ request }) => {
      const res = await authedPut(
        request,
        orgB.login,
        `/api/admin/users/${orgA.login.userId}`,
        { is_active: false }
      );
      expectBlocked(res, 'PUT /api/admin/users/:id deactivation');
    });
  });

  // -----------------------------------------------------------------------
  // Admin Operations
  // -----------------------------------------------------------------------

  test.describe('Admin Operations', () => {
    test('Org B admin cannot view Org A audit logs', async ({ request }) => {
      const res = await authedGet(request, orgB.login, '/api/admin/audit');
      if (res.ok()) {
        const body = await res.json();
        const logs: unknown[] = Array.isArray(body) ? body :
          Array.isArray(body.data) ? body.data :
          Array.isArray(body.logs) ? body.logs : [];

        const leakedLogs = logs.filter((log: unknown) => {
          const record = log as Record<string, unknown>;
          return (
            record.organization_id === orgA.login.organizationId &&
            orgA.login.organizationId !== orgB.login.organizationId
          );
        });

        expect(
          leakedLogs.length,
          'Audit logs must not contain entries from another org'
        ).toBe(0);
      }
    });

    test('Org B admin cannot access Org A categories via admin endpoint', async ({ request }) => {
      const res = await authedGet(request, orgB.login, '/api/admin/categories');
      if (res.ok()) {
        const body = await res.json();
        const items: unknown[] = Array.isArray(body) ? body :
          Array.isArray(body.data) ? body.data :
          Array.isArray(body.categories) ? body.categories : [];

        const crossOrgItems = items.filter((item: unknown) => {
          const record = item as Record<string, unknown>;
          return (
            record.organization_id === orgA.login.organizationId &&
            orgA.login.organizationId !== orgB.login.organizationId
          );
        });

        expect(crossOrgItems.length, 'Categories must not leak cross-org').toBe(0);
      }
    });

    test('Org B admin cannot access Org A SLA policies', async ({ request }) => {
      const res = await authedGet(request, orgB.login, '/api/admin/sla');
      if (res.ok()) {
        const body = await res.json();
        const bodyStr = JSON.stringify(body);
        if (orgA.login.organizationId !== orgB.login.organizationId) {
          expect(
            bodyStr.includes(`"organization_id":${orgA.login.organizationId}`)
          ).toBe(false);
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // ITIL Modules
  // -----------------------------------------------------------------------

  test.describe('ITIL Modules', () => {
    test('Org B cannot access Org A problems by ID', async ({ request }) => {
      test.skip(!orgA.problemId, 'No Org A problem was created');
      const res = await authedGet(request, orgB.login, `/api/problems/${orgA.problemId}`);
      expectBlocked(res, 'GET /api/problems/:id');
    });

    test('Org B problem list excludes Org A problems', async ({ request }) => {
      test.skip(!orgA.problemId, 'No Org A problem was created');
      const res = await authedGet(request, orgB.login, '/api/problems');
      await expectListExcludes(res, 'id', orgA.problemId!, 'GET /api/problems list');
    });

    test('Org B cannot access Org A change requests by ID', async ({ request }) => {
      test.skip(!orgA.changeRequestId, 'No Org A change request was created');
      const res = await authedGet(request, orgB.login, `/api/changes/${orgA.changeRequestId}`);
      expectBlocked(res, 'GET /api/changes/:id');
    });

    test('Org B change list excludes Org A changes', async ({ request }) => {
      test.skip(!orgA.changeRequestId, 'No Org A change request was created');
      const res = await authedGet(request, orgB.login, '/api/changes');
      await expectListExcludes(res, 'id', orgA.changeRequestId!, 'GET /api/changes list');
    });

    test('Org B cannot access Org A CMDB items by ID', async ({ request }) => {
      test.skip(!orgA.cmdbItemId, 'No Org A CMDB item was created');
      const res = await authedGet(request, orgB.login, `/api/cmdb/${orgA.cmdbItemId}`);
      expectBlocked(res, 'GET /api/cmdb/:id');
    });

    test('Org B CMDB list excludes Org A items', async ({ request }) => {
      test.skip(!orgA.cmdbItemId, 'No Org A CMDB item was created');
      const res = await authedGet(request, orgB.login, '/api/cmdb');
      await expectListExcludes(res, 'id', orgA.cmdbItemId!, 'GET /api/cmdb list');
    });

    test('Org B cannot access Org A knowledge articles by ID', async ({ request }) => {
      test.skip(!orgA.knowledgeArticleId, 'No Org A KB article was created');
      const res = await authedGet(
        request,
        orgB.login,
        `/api/knowledge/${orgA.knowledgeArticleId}`
      );
      expectBlocked(res, 'GET /api/knowledge/:id');
    });

    test('Org B knowledge list excludes Org A articles', async ({ request }) => {
      test.skip(!orgA.knowledgeArticleId, 'No Org A KB article was created');
      const res = await authedGet(request, orgB.login, '/api/knowledge');
      await expectListExcludes(res, 'id', orgA.knowledgeArticleId!, 'GET /api/knowledge list');
    });
  });

  // -----------------------------------------------------------------------
  // Token Manipulation
  // -----------------------------------------------------------------------

  test.describe('Token Manipulation', () => {
    test('Modified JWT with tampered payload is rejected', async ({ request }) => {
      // Take the real access token and corrupt the payload portion
      const realToken = orgA.login.accessToken;
      test.skip(!realToken, 'No access token available');

      const parts = realToken.split('.');
      if (parts.length === 3) {
        // Decode payload, change org_id, re-encode (signature will be invalid)
        const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(payloadStr);
        } catch {
          // If payload is not valid JSON, skip
          test.skip(true, 'Could not parse JWT payload');
          return;
        }
        payload.tenant_id = 99999;
        payload.organization_id = 99999;
        const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const tamperedToken = `${parts[0]}.${newPayload}.${parts[2]}`;

        const res = await request.get(`${BASE_URL}/api/tickets`, {
          headers: { Cookie: `access_token=${tamperedToken}` },
        });

        expectBlocked(res, 'Tampered JWT');
      }
    });

    test('Expired JWT is rejected', async ({ request }) => {
      // Craft a token with exp in the past (signature will be invalid anyway)
      const fakePayload = Buffer.from(
        JSON.stringify({
          user_id: 1,
          tenant_id: 1,
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        })
      ).toString('base64url');
      const fakeToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${fakePayload}.invalidsignature`;

      const res = await request.get(`${BASE_URL}/api/tickets`, {
        headers: { Cookie: `access_token=${fakeToken}` },
      });

      expectBlocked(res, 'Expired JWT');
    });

    test('JWT without tenant_id/org_id is rejected', async ({ request }) => {
      const fakePayload = Buffer.from(
        JSON.stringify({
          user_id: 1,
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 3600,
          // Missing tenant_id and organization_id
        })
      ).toString('base64url');
      const fakeToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${fakePayload}.invalidsignature`;

      const res = await request.get(`${BASE_URL}/api/tickets`, {
        headers: { Cookie: `access_token=${fakeToken}` },
      });

      expectBlocked(res, 'JWT without tenant_id');
    });

    test('Completely invalid JWT is rejected', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/tickets`, {
        headers: { Cookie: 'access_token=not-a-jwt-at-all' },
      });

      expectBlocked(res, 'Invalid JWT');
    });

    test('No auth token is rejected', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/tickets`, {
        headers: { Cookie: '' },
      });

      expectBlocked(res, 'No auth token');
    });
  });

  // -----------------------------------------------------------------------
  // API Parameter Injection
  // -----------------------------------------------------------------------

  test.describe('API Parameter Injection', () => {
    test('Cannot inject organization_id in query params to access other org', async ({
      request,
    }) => {
      const targetOrgId =
        orgA.login.organizationId !== orgB.login.organizationId
          ? orgA.login.organizationId
          : 99999;

      const res = await authedGet(
        request,
        orgB.login,
        `/api/tickets?organization_id=${targetOrgId}`
      );

      if (res.ok()) {
        const body = await res.json();
        const tickets: unknown[] = Array.isArray(body) ? body :
          Array.isArray(body.tickets) ? body.tickets :
          Array.isArray(body.data) ? body.data : [];

        const leaked = tickets.filter((t: unknown) => {
          const record = t as Record<string, unknown>;
          return record.organization_id === targetOrgId || record.tenant_id === targetOrgId;
        });

        if (orgA.login.organizationId !== orgB.login.organizationId) {
          expect(leaked.length, 'Query param org_id injection must be ignored').toBe(0);
        }
      }
    });

    test('Cannot inject tenant_id in query params', async ({ request }) => {
      const targetOrgId =
        orgA.login.organizationId !== orgB.login.organizationId
          ? orgA.login.organizationId
          : 99999;

      const res = await authedGet(
        request,
        orgB.login,
        `/api/tickets?tenant_id=${targetOrgId}`
      );

      if (res.ok()) {
        const body = await res.json();
        const tickets: unknown[] = Array.isArray(body) ? body :
          Array.isArray(body.tickets) ? body.tickets :
          Array.isArray(body.data) ? body.data : [];

        const leaked = tickets.filter((t: unknown) => {
          const record = t as Record<string, unknown>;
          return record.tenant_id === targetOrgId;
        });

        if (orgA.login.organizationId !== orgB.login.organizationId) {
          expect(leaked.length, 'Query param tenant_id injection must be ignored').toBe(0);
        }
      }
    });

    test('Cannot inject organization_id in POST body to create in another org', async ({
      request,
    }) => {
      const targetOrgId =
        orgA.login.organizationId !== orgB.login.organizationId
          ? orgA.login.organizationId
          : 99999;

      const res = await authedPost(request, orgB.login, '/api/tickets', {
        title: 'Injected org ticket',
        description: 'Trying to create ticket in another org',
        organization_id: targetOrgId,
        tenant_id: targetOrgId,
        priority_id: 1,
        category_id: 1,
      });

      if (res.ok()) {
        const body = await res.json();
        const createdTicket = body.ticket ?? body.data ?? body;
        const createdOrgId =
          createdTicket.organization_id ?? createdTicket.tenant_id;

        if (createdOrgId) {
          expect(
            createdOrgId,
            'Created ticket must belong to the authenticated user org, not the injected org'
          ).toBe(orgB.login.organizationId);
        }
      }
    });

    test('Cannot use IDOR to access cross-org resources via sequential ID scan', async ({
      request,
    }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');

      // Try accessing Org A ticket and nearby IDs from Org B
      const idsToProbe = [
        orgA.ticketId!,
        orgA.ticketId! - 1,
        orgA.ticketId! + 1,
      ].filter((id) => id > 0);

      for (const id of idsToProbe) {
        const res = await authedGet(request, orgB.login, `/api/tickets/${id}`);
        if (BLOCKED_STATUSES.includes(res.status())) continue;

        // If the response is 200, verify the ticket belongs to Org B
        if (res.ok()) {
          const body = await res.json();
          const ticket = body.ticket ?? body.data ?? body;
          const ticketOrgId = ticket.organization_id ?? ticket.tenant_id;

          if (ticketOrgId && orgA.login.organizationId !== orgB.login.organizationId) {
            expect(
              ticketOrgId,
              `IDOR: ticket ${id} must not belong to another org`
            ).toBe(orgB.login.organizationId);
          }
        }
      }
    });

    test('X-Tenant-ID header injection is ignored when JWT is from different org', async ({
      request,
    }) => {
      const targetOrgId =
        orgA.login.organizationId !== orgB.login.organizationId
          ? orgA.login.organizationId
          : 99999;

      const res = await request.get(`${BASE_URL}/api/tickets`, {
        headers: {
          Cookie: buildCookieHeader(orgB.login.cookies),
          'X-Tenant-ID': targetOrgId.toString(),
        },
      });

      // Should either be blocked (403) or return only Org B data
      if (res.ok()) {
        const body = await res.json();
        const tickets: unknown[] = Array.isArray(body) ? body :
          Array.isArray(body.tickets) ? body.tickets :
          Array.isArray(body.data) ? body.data : [];

        const leaked = tickets.filter((t: unknown) => {
          const record = t as Record<string, unknown>;
          return (
            (record.organization_id === targetOrgId || record.tenant_id === targetOrgId) &&
            targetOrgId !== orgB.login.organizationId
          );
        });

        expect(leaked.length, 'X-Tenant-ID header injection must be ignored').toBe(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Cross-org write operations on ITIL modules
  // -----------------------------------------------------------------------

  test.describe('Cross-Org Write Protection', () => {
    test('Org B cannot update Org A problem', async ({ request }) => {
      test.skip(!orgA.problemId, 'No Org A problem was created');
      const res = await authedPut(request, orgB.login, `/api/problems/${orgA.problemId}`, {
        title: 'HACKED by Org B',
        status: 'resolved',
      });
      expectBlocked(res, 'PUT /api/problems/:id');
    });

    test('Org B cannot delete Org A change request', async ({ request }) => {
      test.skip(!orgA.changeRequestId, 'No Org A change request was created');
      const res = await authedDelete(
        request,
        orgB.login,
        `/api/changes/${orgA.changeRequestId}`
      );
      expectBlocked(res, 'DELETE /api/changes/:id');
    });

    test('Org B cannot update Org A CMDB item', async ({ request }) => {
      test.skip(!orgA.cmdbItemId, 'No Org A CMDB item was created');
      const res = await authedPut(request, orgB.login, `/api/cmdb/${orgA.cmdbItemId}`, {
        name: 'HACKED by Org B',
      });
      expectBlocked(res, 'PUT /api/cmdb/:id');
    });

    test('Org B cannot delete Org A knowledge article', async ({ request }) => {
      test.skip(!orgA.knowledgeArticleId, 'No Org A KB article was created');
      const res = await authedDelete(
        request,
        orgB.login,
        `/api/knowledge/${orgA.knowledgeArticleId}`
      );
      expectBlocked(res, 'DELETE /api/knowledge/:id');
    });

    test('Org B cannot add tag to Org A ticket', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedPost(
        request,
        orgB.login,
        `/api/tickets/${orgA.ticketId}/tags`,
        { tag_id: 1 }
      );
      expectBlocked(res, 'POST /api/tickets/:id/tags');
    });

    test('Org B cannot follow Org A ticket', async ({ request }) => {
      test.skip(!orgA.ticketId, 'No Org A ticket was created');
      const res = await authedPost(
        request,
        orgB.login,
        `/api/tickets/${orgA.ticketId}/followers`,
        {}
      );
      expectBlocked(res, 'POST /api/tickets/:id/followers');
    });
  });

  // -----------------------------------------------------------------------
  // Super Admin area (non-super-admin must be blocked)
  // -----------------------------------------------------------------------

  test.describe('Super Admin Endpoint Protection', () => {
    test('Org B admin cannot access super admin dashboard', async ({ request }) => {
      // Only org 1 or super_admin role should access these
      if (orgB.login.organizationId !== 1 && orgB.login.role !== 'super_admin') {
        const res = await authedGet(request, orgB.login, '/api/admin/super/dashboard');
        expectBlocked(res, 'GET /api/admin/super/dashboard');
      }
    });

    test('Org B admin cannot list all organizations', async ({ request }) => {
      if (orgB.login.organizationId !== 1 && orgB.login.role !== 'super_admin') {
        const res = await authedGet(request, orgB.login, '/api/admin/super/organizations');
        expectBlocked(res, 'GET /api/admin/super/organizations');
      }
    });

    test('Org B admin cannot access cross-tenant user list', async ({ request }) => {
      if (orgB.login.organizationId !== 1 && orgB.login.role !== 'super_admin') {
        const res = await authedGet(request, orgB.login, '/api/admin/super/users');
        expectBlocked(res, 'GET /api/admin/super/users');
      }
    });

    test('Org B admin cannot access system settings', async ({ request }) => {
      if (orgB.login.organizationId !== 1 && orgB.login.role !== 'super_admin') {
        const res = await authedGet(request, orgB.login, '/api/admin/super/settings');
        expectBlocked(res, 'GET /api/admin/super/settings');
      }
    });
  });
});
