/**
 * Integration Test Setup
 *
 * Provides test database setup, teardown, and utilities for API integration tests.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { hashPassword } from '@/lib/auth/sqlite-auth';
import * as jose from 'jose';

// Test database instance
let testDb: Database.Database;

// Test tenant and users
export const TEST_TENANT = {
  id: 1,
  slug: 'test-tenant',
  name: 'Test Organization',
  is_active: 1
};

export const TEST_USERS = {
  admin: {
    id: 1,
    name: 'Admin User',
    email: 'admin@test.com',
    password: 'AdminPass123!',
    role: 'admin',
    tenant_id: 1
  },
  agent: {
    id: 2,
    name: 'Agent User',
    email: 'agent@test.com',
    password: 'AgentPass123!',
    role: 'agent',
    tenant_id: 1
  },
  user: {
    id: 3,
    name: 'Regular User',
    email: 'user@test.com',
    password: 'UserPass123!',
    role: 'user',
    tenant_id: 1
  }
};

// JWT secret for testing (must match api-helpers validation secret)
const TEST_JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || '9f5c2e7d4a1b8c3f6e0d2c7a4b9e1f5c2d7a8b3e6f1c4a9d2e5b8f0a3c6d1e4f'
);

/**
 * Initialize test database with schema
 */
beforeAll(async () => {
  // Create in-memory database
  testDb = new Database(':memory:');
  (globalThis as typeof globalThis & { __SERVICEDESK_TEST_DB__?: Database.Database }).__SERVICEDESK_TEST_DB__ = testDb;

  // Read and execute test schema (simplified for testing)
  const schemaPath = join(process.cwd(), 'tests', 'integration', 'test-schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  testDb.exec(schema);

  // Seed test data
  await seedTestData();

  console.log('✅ Test database initialized');
});

/**
 * Clean up after all tests
 */
afterAll(() => {
  if (testDb) {
    testDb.close();
    delete (globalThis as typeof globalThis & { __SERVICEDESK_TEST_DB__?: Database.Database }).__SERVICEDESK_TEST_DB__;
    console.log('✅ Test database closed');
  }
});

/**
 * Clear test data before each test
 */
beforeEach(async () => {
  // Clear tables but keep schema
  const tables = [
    'ticket_tags',
    'ticket_followers',
    'ticket_relationships',
    'ticket_activities',
    'tags',
    'tickets',
    'comments',
    'attachments',
    'kb_articles',
    'kb_article_tags',
    'notifications',
    'audit_logs',
    'login_attempts',
    'refresh_tokens',
    'sla_tracking'
  ];

  for (const table of tables) {
    testDb.prepare(`DELETE FROM ${table}`).run();
  }
});

/**
 * Seed test data (tenant, users, categories, priorities, statuses)
 */
async function seedTestData() {
  // Insert organization (current auth routes resolve tenant via organizations)
  testDb.prepare(`
    INSERT INTO organizations (id, name, slug, is_active)
    VALUES (?, ?, ?, ?)
  `).run(TEST_TENANT.id, TEST_TENANT.name, TEST_TENANT.slug, TEST_TENANT.is_active);

  // Insert test tenant
  testDb.prepare(`
    INSERT INTO tenants (id, name, slug, is_active)
    VALUES (?, ?, ?, ?)
  `).run(TEST_TENANT.id, TEST_TENANT.name, TEST_TENANT.slug, TEST_TENANT.is_active);

  // Insert test users with hashed passwords
  for (const [key, user] of Object.entries(TEST_USERS)) {
    const passwordHash = await hashPassword(user.password);
    testDb.prepare(`
      INSERT INTO users (id, organization_id, tenant_id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(user.id, user.tenant_id, user.tenant_id, user.name, user.email, passwordHash, user.role);
  }

  // Insert teams for workflow auto-assignment
  testDb.prepare(`
    INSERT INTO teams (id, tenant_id, name, slug, team_type, capabilities, is_active)
    VALUES
      (1, 1, 'Service Desk', 'service-desk', 'technical', '["incident_response","problem_analysis"]', 1),
      (2, 1, 'Change Management', 'change-management', 'management', '["change_approval"]', 1)
  `).run();

  // Insert team members (agent available for auto-assignment)
  testDb.prepare(`
    INSERT INTO team_members (team_id, user_id, workload_percentage, is_active, availability_status)
    VALUES
      (1, 2, 10, 1, 'available'),
      (2, 1, 20, 1, 'available')
  `).run();

  // Insert test categories
  testDb.prepare(`
    INSERT INTO categories (id, tenant_id, name, description, default_team_id, requires_approval, color, is_active)
    VALUES
      (1, 1, 'Technical', 'Technical issues', 1, 0, '#3B82F6', 1),
      (2, 1, 'Billing', 'Billing questions', 1, 1, '#10B981', 1),
      (3, 1, 'General', 'General inquiries', 1, 0, '#6B7280', 1)
  `).run();

  // Insert test priorities
  testDb.prepare(`
    INSERT INTO priorities (id, tenant_id, name, level, color, is_active)
    VALUES
      (1, 1, 'Low', 1, '#10B981', 1),
      (2, 1, 'Medium', 2, '#F59E0B', 1),
      (3, 1, 'High', 3, '#EF4444', 1),
      (4, 1, 'Critical', 4, '#DC2626', 1)
  `).run();

  // Insert test statuses
  testDb.prepare(`
    INSERT INTO statuses (id, tenant_id, name, description, status_type, is_initial, sort_order, color, is_final, is_active)
    VALUES
      (1, 1, 'Open', 'Ticket is open', 'open', 1, 1, '#3B82F6', 0, 1),
      (2, 1, 'In Progress', 'Ticket is being worked on', 'in_progress', 0, 2, '#F59E0B', 0, 1),
      (3, 1, 'Resolved', 'Ticket is resolved', 'resolved', 0, 3, '#10B981', 1, 1),
      (4, 1, 'Closed', 'Ticket is closed', 'closed', 0, 4, '#6B7280', 1, 1),
      (5, 1, 'Waiting Approval', 'Waiting for approval', 'waiting', 0, 5, '#8B5CF6', 0, 1)
  `).run();

  // Insert test ticket types
  testDb.prepare(`
    INSERT INTO ticket_types (
      id, tenant_id, name, slug, description, icon, workflow_type, color,
      sla_required, approval_required, escalation_enabled, auto_assignment_enabled,
      customer_visible, sort_order, is_active
    )
    VALUES
      (1, 1, 'Incident', 'incident', 'System incident', 'alert-circle', 'incident', '#EF4444', 1, 0, 1, 1, 1, 1, 1),
      (2, 1, 'Request', 'request', 'Service request', 'clipboard-list', 'request', '#3B82F6', 1, 0, 0, 1, 1, 2, 1),
      (3, 1, 'Problem', 'problem', 'Problem investigation', 'search', 'problem', '#F59E0B', 1, 0, 0, 1, 1, 3, 1)
  `).run();

  // Insert KB categories
  testDb.prepare(`
    INSERT INTO kb_categories (id, tenant_id, name, slug, description, color, is_active)
    VALUES
      (1, 1, 'Getting Started', 'getting-started', 'Getting started guides', '#3B82F6', 1),
      (2, 1, 'Troubleshooting', 'troubleshooting', 'Troubleshooting articles', '#EF4444', 1)
  `).run();
}

/**
 * Get test database instance
 */
export function getTestDb(): Database.Database {
  return testDb;
}

/**
 * Generate JWT token for testing
 */
export async function generateTestToken(userId: number, role: string = 'user'): Promise<string> {
  const user = Object.values(TEST_USERS).find(u => u.id === userId);

  if (!user) {
    throw new Error(`User with id ${userId} not found`);
  }

  const tokenPayload = {
    id: user.id,
    user_id: user.id,
    organization_id: user.tenant_id,
    tenant_id: user.tenant_id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenant_slug: TEST_TENANT.slug,
    tenant_name: TEST_TENANT.name,
    type: 'access'
  };

  return await new jose.SignJWT(tokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('servicedesk')
    .setAudience('servicedesk-users')
    .setSubject(user.id.toString())
    .setExpirationTime('1h')
    .sign(TEST_JWT_SECRET);
}

/**
 * Create authenticated request headers
 */
export async function getAuthHeaders(userId: number): Promise<Record<string, string>> {
  const user = Object.values(TEST_USERS).find(u => u.id === userId);
  if (!user) {
    throw new Error(`User with id ${userId} not found`);
  }

  const token = await generateTestToken(userId);
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Cookie': `auth_token=${token}; tenant-context=${encodeURIComponent(JSON.stringify(TEST_TENANT))}; tenant_context=${encodeURIComponent(JSON.stringify(TEST_TENANT))}`,
    'x-organization-id': TEST_TENANT.id.toString(),
    'x-tenant-id': TEST_TENANT.id.toString(),
    'x-tenant-slug': TEST_TENANT.slug,
    'x-tenant-name': TEST_TENANT.name,
    'x-user-id': user.id.toString(),
    'x-user-role': user.role,
    'x-user-email': user.email,
    'x-user-name': user.name
  };
}

/**
 * Create test ticket
 */
export function createTestTicket(data: {
  title: string;
  description: string;
  user_id: number;
  category_id?: number;
  priority_id?: number;
  status_id?: number;
  ticket_type_id?: number;
}): number {
  const result = testDb.prepare(`
    INSERT INTO tickets (
      tenant_id, title, description, user_id, category_id,
      priority_id, status_id, ticket_type_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    TEST_TENANT.id,
    data.title,
    data.description,
    data.user_id,
    data.category_id || 1,
    data.priority_id || 2,
    data.status_id || 1,
    data.ticket_type_id || 2
  );

  return result.lastInsertRowid as number;
}

/**
 * Create test KB article
 */
export function createTestArticle(data: {
  title: string;
  content: string;
  author_id: number;
  category_id?: number;
  status?: string;
  slug?: string;
}): number {
  const uniqueSlug = data.slug || `test-article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = testDb.prepare(`
    INSERT INTO kb_articles (
      tenant_id, title, slug, content, author_id, category_id,
      status, visibility, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'public', datetime('now'))
  `).run(
    TEST_TENANT.id,
    data.title,
    uniqueSlug,
    data.content,
    data.author_id,
    data.category_id || 1,
    data.status || 'published'
  );

  return result.lastInsertRowid as number;
}

/**
 * Mock Next.js request with authentication
 */
export async function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    userId?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<NextRequest> {
  const { method = 'GET', body, userId, headers = {} } = options;

  const authHeaders = userId ? await getAuthHeaders(userId) : {};
  const requestHeaders = new Headers({
    ...authHeaders,
    ...headers
  });
  if (body && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(`http://localhost:3000${url}`, requestInit);
}

/**
 * Extract response JSON safely
 */
export async function getResponseJSON(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}
