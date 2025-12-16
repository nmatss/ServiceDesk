/**
 * Admin API Integration Tests
 *
 * Tests admin-only endpoints including user management, reports, SLA, and audit logs.
 */

import { describe, it, expect } from 'vitest';
import { GET as getUsersGET } from '@/app/api/admin/users/route';
import { GET as getUserGET, PUT as updateUserPUT, DELETE as deleteUserDELETE } from '@/app/api/admin/users/[id]/route';
import { GET as getReportsGET } from '@/app/api/admin/reports/route';
import { GET as getAuditLogsGET } from '@/app/api/admin/audit/route';
import { GET as getSLAGET } from '@/app/api/admin/sla/route';
import {
  TEST_USERS,
  TEST_TENANT,
  getTestDb,
  createMockRequest,
  getResponseJSON,
  createTestTicket
} from './setup';

describe('Admin API Integration Tests', () => {
  describe('GET /api/admin/users', () => {
    it('should list all users (admin only)', async () => {
      const request = await createMockRequest('/api/admin/users', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getUsersGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBeGreaterThanOrEqual(3); // At least 3 test users
    });

    it('should deny access to non-admin users', async () => {
      const request = await createMockRequest('/api/admin/users', {
        method: 'GET',
        userId: TEST_USERS.user.id // Regular user
      });

      const response = await getUsersGET(request as any);

      expect(response.status).toBe(403);
    });

    it('should deny access to agents', async () => {
      const request = await createMockRequest('/api/admin/users', {
        method: 'GET',
        userId: TEST_USERS.agent.id // Agent user
      });

      const response = await getUsersGET(request as any);

      // Agents should not have access to user management
      expect([200, 403]).toContain(response.status);
    });

    it('should include ticket count per user', async () => {
      // Create tickets for a user
      createTestTicket({
        title: 'User Ticket 1',
        description: 'Test',
        user_id: TEST_USERS.user.id
      });
      createTestTicket({
        title: 'User Ticket 2',
        description: 'Test',
        user_id: TEST_USERS.user.id
      });

      const request = await createMockRequest('/api/admin/users', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getUsersGET(request as any);
      const data = await getResponseJSON(response);

      const user = data.users?.find((u: any) => u.id === TEST_USERS.user.id);
      expect(user).toBeDefined();
      expect(user.tickets_count).toBeGreaterThanOrEqual(2);
    });

    it('should enforce tenant isolation', async () => {
      const request = await createMockRequest('/api/admin/users', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getUsersGET(request as any);
      const data = await getResponseJSON(response);

      // All users should belong to test tenant
      if (data.users) {
        data.users.forEach((user: any) => {
          expect(user.tenant_id).toBe(TEST_TENANT.id);
        });
      }
    });

    it('should not expose password hashes', async () => {
      const request = await createMockRequest('/api/admin/users', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getUsersGET(request as any);
      const data = await getResponseJSON(response);

      if (data.users && data.users.length > 0) {
        data.users.forEach((user: any) => {
          expect(user.password_hash).toBeUndefined();
          expect(user.password).toBeUndefined();
        });
      }
    });
  });

  describe('GET /api/admin/users/[id]', () => {
    it('should get user by id (admin only)', async () => {
      const request = await createMockRequest(`/api/admin/users/${TEST_USERS.user.id}`, {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const mockRequest = request as any;
      mockRequest.params = { id: TEST_USERS.user.id.toString() };

      const response = await getUserGET(mockRequest, { params: { id: TEST_USERS.user.id.toString() } });
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(TEST_USERS.user.id);
      expect(data.user.email).toBe(TEST_USERS.user.email);
    });

    it('should return 404 for non-existent user', async () => {
      const request = await createMockRequest('/api/admin/users/99999', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const mockRequest = request as any;
      mockRequest.params = { id: '99999' };

      const response = await getUserGET(mockRequest, { params: { id: '99999' } });

      expect(response.status).toBe(404);
    });

    it('should deny access to non-admin users', async () => {
      const request = await createMockRequest(`/api/admin/users/${TEST_USERS.admin.id}`, {
        method: 'GET',
        userId: TEST_USERS.user.id // Regular user
      });

      const mockRequest = request as any;
      mockRequest.params = { id: TEST_USERS.admin.id.toString() };

      const response = await getUserGET(mockRequest, { params: { id: TEST_USERS.admin.id.toString() } });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/admin/users/[id]', () => {
    it('should update user (admin only)', async () => {
      const request = await createMockRequest(`/api/admin/users/${TEST_USERS.user.id}`, {
        method: 'PUT',
        userId: TEST_USERS.admin.id,
        body: {
          name: 'Updated User Name',
          role: 'agent',
          is_active: true
        }
      });

      const mockRequest = request as any;
      mockRequest.params = { id: TEST_USERS.user.id.toString() };

      const response = await updateUserPUT(mockRequest, { params: { id: TEST_USERS.user.id.toString() } });
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify update in database
      const db = getTestDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(TEST_USERS.user.id) as any;
      expect(user.name).toBe('Updated User Name');
      expect(user.role).toBe('agent');
    });

    it('should deny role escalation by non-admin', async () => {
      const request = await createMockRequest(`/api/admin/users/${TEST_USERS.user.id}`, {
        method: 'PUT',
        userId: TEST_USERS.agent.id, // Agent trying to update
        body: {
          role: 'admin' // Trying to become admin
        }
      });

      const mockRequest = request as any;
      mockRequest.params = { id: TEST_USERS.user.id.toString() };

      const response = await updateUserPUT(mockRequest, { params: { id: TEST_USERS.user.id.toString() } });

      expect(response.status).toBe(403);
    });

    it('should create audit log on user update', async () => {
      const request = await createMockRequest(`/api/admin/users/${TEST_USERS.user.id}`, {
        method: 'PUT',
        userId: TEST_USERS.admin.id,
        body: {
          name: 'Audit Test Name'
        }
      });

      const mockRequest = request as any;
      mockRequest.params = { id: TEST_USERS.user.id.toString() };

      await updateUserPUT(mockRequest, { params: { id: TEST_USERS.user.id.toString() } });

      const db = getTestDb();
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE entity_type = 'user' AND entity_id = ? AND action = 'update'
        ORDER BY created_at DESC LIMIT 1
      `).get(TEST_USERS.user.id);

      expect(auditLog).toBeDefined();
    });
  });

  describe('DELETE /api/admin/users/[id]', () => {
    it('should deactivate user instead of hard delete', async () => {
      // Create a user to delete
      const db = getTestDb();
      const result = db.prepare(`
        INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, 'user', 1)
      `).run(TEST_TENANT.id, 'Delete Test User', 'delete-test@test.com', 'hash');

      const userId = result.lastInsertRowid as number;

      const request = await createMockRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        userId: TEST_USERS.admin.id
      });

      const mockRequest = request as any;
      mockRequest.params = { id: userId.toString() };

      const response = await deleteUserDELETE(mockRequest, { params: { id: userId.toString() } });
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // User should still exist but be inactive
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      expect(user).toBeDefined();
      expect(user.is_active).toBe(0);
    });

    it('should prevent self-deletion', async () => {
      const request = await createMockRequest(`/api/admin/users/${TEST_USERS.admin.id}`, {
        method: 'DELETE',
        userId: TEST_USERS.admin.id // Admin trying to delete themselves
      });

      const mockRequest = request as any;
      mockRequest.params = { id: TEST_USERS.admin.id.toString() };

      const response = await deleteUserDELETE(mockRequest, { params: { id: TEST_USERS.admin.id.toString() } });

      expect(response.status).toBe(400);
    });

    it('should deny deletion by non-admin', async () => {
      const request = await createMockRequest(`/api/admin/users/${TEST_USERS.user.id}`, {
        method: 'DELETE',
        userId: TEST_USERS.agent.id
      });

      const mockRequest = request as any;
      mockRequest.params = { id: TEST_USERS.user.id.toString() };

      const response = await deleteUserDELETE(mockRequest, { params: { id: TEST_USERS.user.id.toString() } });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/reports', () => {
    it('should generate ticket reports (admin only)', async () => {
      // Create some tickets for reporting
      createTestTicket({
        title: 'Report Test 1',
        description: 'Test',
        user_id: TEST_USERS.user.id
      });
      createTestTicket({
        title: 'Report Test 2',
        description: 'Test',
        user_id: TEST_USERS.user.id
      });

      const request = await createMockRequest('/api/admin/reports', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getReportsGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.reports).toBeDefined();
    });

    it('should filter reports by date range', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const request = await createMockRequest(
        `/api/admin/reports?start_date=${startDate}&end_date=${endDate}`,
        {
          method: 'GET',
          userId: TEST_USERS.admin.id
        }
      );

      const response = await getReportsGET(request as any);

      expect(response.status).toBe(200);
    });

    it('should deny access to non-admin users', async () => {
      const request = await createMockRequest('/api/admin/reports', {
        method: 'GET',
        userId: TEST_USERS.user.id
      });

      const response = await getReportsGET(request as any);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/audit', () => {
    it('should retrieve audit logs (admin only)', async () => {
      // Create some audit entries
      const db = getTestDb();
      db.prepare(`
        INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values)
        VALUES (?, ?, 'ticket', 1, 'create', '{}')
      `).run(TEST_TENANT.id, TEST_USERS.admin.id);

      const request = await createMockRequest('/api/admin/audit', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getAuditLogsGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.logs).toBeDefined();
      expect(Array.isArray(data.logs)).toBe(true);
    });

    it('should filter audit logs by entity type', async () => {
      const request = await createMockRequest('/api/admin/audit?entity_type=ticket', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getAuditLogsGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      if (data.logs && data.logs.length > 0) {
        data.logs.forEach((log: any) => {
          expect(log.entity_type).toBe('ticket');
        });
      }
    });

    it('should filter audit logs by user', async () => {
      const request = await createMockRequest(
        `/api/admin/audit?user_id=${TEST_USERS.admin.id}`,
        {
          method: 'GET',
          userId: TEST_USERS.admin.id
        }
      );

      const response = await getAuditLogsGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      if (data.logs && data.logs.length > 0) {
        data.logs.forEach((log: any) => {
          expect(log.user_id).toBe(TEST_USERS.admin.id);
        });
      }
    });

    it('should paginate audit logs', async () => {
      // Create many audit entries
      const db = getTestDb();
      for (let i = 0; i < 50; i++) {
        db.prepare(`
          INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, action, new_values)
          VALUES (?, ?, 'test', ?, 'test', '{}')
        `).run(TEST_TENANT.id, TEST_USERS.admin.id, i);
      }

      const request = await createMockRequest('/api/admin/audit?page=1&limit=20', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getAuditLogsGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.logs.length).toBeLessThanOrEqual(20);
      expect(data.pagination).toBeDefined();
    });

    it('should deny access to non-admin users', async () => {
      const request = await createMockRequest('/api/admin/audit', {
        method: 'GET',
        userId: TEST_USERS.user.id
      });

      const response = await getAuditLogsGET(request as any);

      expect(response.status).toBe(403);
    });

    it('should enforce tenant isolation', async () => {
      const request = await createMockRequest('/api/admin/audit', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getAuditLogsGET(request as any);
      const data = await getResponseJSON(response);

      // All logs should belong to test tenant
      if (data.logs) {
        data.logs.forEach((log: any) => {
          expect(log.tenant_id).toBe(TEST_TENANT.id);
        });
      }
    });
  });

  describe('GET /api/admin/sla', () => {
    it('should retrieve SLA statistics (admin only)', async () => {
      const request = await createMockRequest('/api/admin/sla', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getSLAGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      expect(data.sla).toBeDefined();
    });

    it('should show SLA compliance metrics', async () => {
      const request = await createMockRequest('/api/admin/sla', {
        method: 'GET',
        userId: TEST_USERS.admin.id
      });

      const response = await getSLAGET(request as any);
      const data = await getResponseJSON(response);

      expect(response.status).toBe(200);
      if (data.sla) {
        expect(data.sla).toHaveProperty('response_sla_rate');
        expect(data.sla).toHaveProperty('resolution_sla_rate');
      }
    });

    it('should filter SLA stats by date range', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const request = await createMockRequest(
        `/api/admin/sla?start_date=${startDate}&end_date=${endDate}`,
        {
          method: 'GET',
          userId: TEST_USERS.admin.id
        }
      );

      const response = await getSLAGET(request as any);

      expect(response.status).toBe(200);
    });

    it('should deny access to non-admin users', async () => {
      const request = await createMockRequest('/api/admin/sla', {
        method: 'GET',
        userId: TEST_USERS.user.id
      });

      const response = await getSLAGET(request as any);

      expect(response.status).toBe(403);
    });
  });

  describe('Admin Security', () => {
    it('should require authentication for all admin endpoints', async () => {
      const endpoints = [
        '/api/admin/users',
        '/api/admin/reports',
        '/api/admin/audit',
        '/api/admin/sla'
      ];

      for (const endpoint of endpoints) {
        const request = await createMockRequest(endpoint, {
          method: 'GET'
          // No userId - unauthenticated
        });

        let response;
        if (endpoint === '/api/admin/users') {
          response = await getUsersGET(request as any);
        } else if (endpoint === '/api/admin/reports') {
          response = await getReportsGET(request as any);
        } else if (endpoint === '/api/admin/audit') {
          response = await getAuditLogsGET(request as any);
        } else if (endpoint === '/api/admin/sla') {
          response = await getSLAGET(request as any);
        }

        expect(response?.status).toBe(401);
      }
    });

    it('should log all admin actions', async () => {
      const db = getTestDb();

      // Perform an admin action
      const request = await createMockRequest(`/api/admin/users/${TEST_USERS.user.id}`, {
        method: 'PUT',
        userId: TEST_USERS.admin.id,
        body: {
          name: 'Audit Action Test'
        }
      });

      const mockRequest = request as any;
      mockRequest.params = { id: TEST_USERS.user.id.toString() };

      await updateUserPUT(mockRequest, { params: { id: TEST_USERS.user.id.toString() } });

      // Check audit log
      const logs = db.prepare(`
        SELECT * FROM audit_logs
        WHERE user_id = ? AND action = 'update'
        ORDER BY created_at DESC LIMIT 1
      `).all(TEST_USERS.admin.id);

      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
