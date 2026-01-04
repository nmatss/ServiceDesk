/**
 * Test utilities for authentication API tests
 */

import { NextRequest } from 'next/server';
import Database from 'better-sqlite3';
import { hashPassword } from '@/lib/auth/sqlite-auth';
import * as jose from 'jose';

// Test database instance
let testDb: Database.Database;

export const TEST_JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long-for-testing';
export const JWT_SECRET = new TextEncoder().encode(TEST_JWT_SECRET);

// Test tenant data
export const TEST_TENANT = {
  id: 1,
  name: 'Test Organization',
  slug: 'test-org',
  is_active: 1
};

// Test user credentials
export const TEST_USERS = {
  admin: {
    id: 1,
    name: 'Test Admin',
    email: 'admin@test.com',
    password: 'AdminPassword123!',
    role: 'admin',
    organization_id: TEST_TENANT.id
  },
  agent: {
    id: 2,
    name: 'Test Agent',
    email: 'agent@test.com',
    password: 'AgentPassword123!',
    role: 'agent',
    organization_id: TEST_TENANT.id
  },
  user: {
    id: 3,
    name: 'Test User',
    email: 'user@test.com',
    password: 'UserPassword123!',
    role: 'user',
    organization_id: TEST_TENANT.id
  }
};

/**
 * Initialize test database with schema
 */
export async function initTestDatabase() {
  // Use in-memory database for tests
  testDb = new Database(':memory:');

  // Create organizations table
  testDb.exec(`
    CREATE TABLE organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create users table
  testDb.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      tenant_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'agent', 'user', 'manager', 'read_only', 'api_client', 'tenant_admin')),
      job_title TEXT,
      department TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      must_change_password INTEGER DEFAULT 0,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(email, organization_id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )
  `);

  // Create login_attempts table
  testDb.exec(`
    CREATE TABLE login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      email TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER NOT NULL,
      failure_reason TEXT,
      organization_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )
  `);

  // Create audit_logs table
  testDb.exec(`
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER,
      tenant_id INTEGER,
      user_id INTEGER,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )
  `);

  // Create rate_limits table
  testDb.exec(`
    CREATE TABLE rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      reset_time DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert test organization
  testDb.prepare(`
    INSERT INTO organizations (id, name, slug, is_active)
    VALUES (?, ?, ?, ?)
  `).run(TEST_TENANT.id, TEST_TENANT.name, TEST_TENANT.slug, TEST_TENANT.is_active);

  // Insert test users
  for (const userData of Object.values(TEST_USERS)) {
    const passwordHash = await hashPassword(userData.password);
    testDb.prepare(`
      INSERT INTO users (id, organization_id, name, email, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(userData.id, userData.organization_id, userData.name, userData.email, passwordHash, userData.role);
  }
}

/**
 * Clean up test database
 */
export function cleanupTestDatabase() {
  if (testDb) {
    testDb.close();
  }
}

/**
 * Get test database instance
 */
export function getTestDb(): Database.Database {
  return testDb;
}

/**
 * Reset test data between tests
 */
export function resetTestData() {
  // Clear tables that accumulate data
  testDb.exec('DELETE FROM login_attempts');
  testDb.exec('DELETE FROM audit_logs');
  testDb.exec('DELETE FROM rate_limits');

  // Reset user states
  testDb.exec(`
    UPDATE users SET
      failed_login_attempts = 0,
      locked_until = NULL,
      last_login_at = NULL
  `);
}

/**
 * Create mock NextRequest for testing
 */
export async function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    ip?: string;
  } = {}
): Promise<NextRequest> {
  const {
    method = 'GET',
    body,
    headers = {},
    cookies = {},
    ip = '127.0.0.1'
  } = options;

  // Default headers
  const defaultHeaders = {
    'content-type': 'application/json',
    'user-agent': 'vitest-test-agent',
    'x-forwarded-for': ip,
    ...headers
  };

  // Create request init
  const requestInit: RequestInit = {
    method,
    headers: defaultHeaders
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = JSON.stringify(body);
  }

  // Create NextRequest
  const request = new NextRequest(new Request(url, requestInit));

  // Manually set cookies (NextRequest doesn't support this in constructor)
  for (const [name, value] of Object.entries(cookies)) {
    Object.defineProperty(request.cookies, 'get', {
      value: (cookieName: string) => {
        if (cookieName === name) {
          return { name, value };
        }
        return undefined;
      },
      writable: true
    });
  }

  return request;
}

/**
 * Extract JSON from response
 */
export async function getResponseJSON(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'Invalid JSON response', text };
  }
}

/**
 * Generate valid JWT token for testing
 */
export async function generateTestToken(userId: number, role: string = 'user'): Promise<string> {
  const user = Object.values(TEST_USERS).find(u => u.id === userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  const token = await new jose.SignJWT({
    id: user.id,
    organization_id: user.organization_id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenant_slug: TEST_TENANT.slug,
    type: 'access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('servicedesk')
    .setAudience('servicedesk-users')
    .setExpirationTime('15m')
    .sign(JWT_SECRET);

  return token;
}

/**
 * Generate expired JWT token for testing
 */
export async function generateExpiredToken(userId: number): Promise<string> {
  const user = Object.values(TEST_USERS).find(u => u.id === userId);
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  const token = await new jose.SignJWT({
    id: user.id,
    organization_id: user.organization_id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenant_slug: TEST_TENANT.slug,
    type: 'access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('servicedesk')
    .setAudience('servicedesk-users')
    .setExpirationTime('-1h') // Expired 1 hour ago
    .sign(JWT_SECRET);

  return token;
}

/**
 * Extract cookies from response
 */
export function getCookiesFromResponse(response: Response): Record<string, string> {
  const cookies: Record<string, string> = {};
  const setCookieHeader = response.headers.get('set-cookie');

  if (setCookieHeader) {
    // Parse Set-Cookie header(s)
    const cookiePairs = setCookieHeader.split(', ').map(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      return { name: name.trim(), value: value?.trim() };
    });

    for (const { name, value } of cookiePairs) {
      if (name && value) {
        cookies[name] = value;
      }
    }
  }

  return cookies;
}

/**
 * Wait for a specified time (for testing async operations)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a user in test database
 */
export async function createTestUser(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
  organization_id?: number;
}): Promise<number> {
  const passwordHash = await hashPassword(data.password);
  const result = testDb.prepare(`
    INSERT INTO users (organization_id, name, email, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(
    data.organization_id || TEST_TENANT.id,
    data.name,
    data.email,
    passwordHash,
    data.role || 'user'
  );

  return result.lastInsertRowid as number;
}

/**
 * Lock a user account for testing
 */
export function lockUserAccount(userId: number, minutes: number = 15) {
  const lockedUntil = new Date(Date.now() + minutes * 60 * 1000);
  testDb.prepare(`
    UPDATE users
    SET locked_until = ?, failed_login_attempts = 5
    WHERE id = ?
  `).run(lockedUntil.toISOString(), userId);
}

/**
 * Get login attempts for a user
 */
export function getLoginAttempts(email: string): any[] {
  return testDb.prepare(`
    SELECT * FROM login_attempts
    WHERE email = ?
    ORDER BY created_at DESC
  `).all(email);
}

/**
 * Get audit logs for a user
 */
export function getAuditLogs(userId: number, action?: string): any[] {
  if (action) {
    return testDb.prepare(`
      SELECT * FROM audit_logs
      WHERE user_id = ? AND action = ?
      ORDER BY created_at DESC
    `).all(userId, action);
  }
  return testDb.prepare(`
    SELECT * FROM audit_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);
}
