import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/adapter', () => ({
  executeQuery: vi.fn(() => []),
  executeQueryOne: vi.fn(() => undefined),
  executeRun: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  executeTransaction: vi.fn(async (cb) => {
    const mockDb = {
      run: vi.fn(() => ({ changes: 1 })),
      get: vi.fn(() => undefined),
    }
    return cb(mockDb)
  }),
  sqlNow: vi.fn(() => "datetime('now')"),
  sqlTrue: vi.fn(() => '1'),
  sqlFalse: vi.fn(() => '0'),
}))

vi.mock('@/lib/monitoring/structured-logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter'
import {
  createPermission,
  getPermissionById,
  createRole,
  deleteRole,
  assignPermissionToRole,
  hasPermission,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  requirePermission,
  requireRole,
  requireAnyRole,
  type AuthenticatedRequest,
  type MiddlewareResponse,
  type NextFunction,
} from '../rbac'

const mockedExecuteQuery = vi.mocked(executeQuery)
const mockedExecuteQueryOne = vi.mocked(executeQueryOne)
const mockedExecuteRun = vi.mocked(executeRun)

function makeMockReq(user?: { id: number }, context?: Record<string, unknown>): AuthenticatedRequest {
  return { user, context } as AuthenticatedRequest
}

function makeMockRes() {
  const res: MiddlewareResponse = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }
  return res
}

const mockPermission = {
  id: 1,
  name: 'tickets:read',
  description: 'View tickets',
  resource: 'tickets',
  action: 'read',
  conditions: null,
  created_at: '2026-01-01T00:00:00Z',
}

const mockRole = {
  id: 1,
  name: 'agent',
  display_name: 'Agente',
  description: 'Atendimento e resolucao de tickets',
  is_system: false,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const systemRole = {
  ...mockRole,
  id: 2,
  name: 'admin',
  display_name: 'Administrador',
  is_system: true,
}

describe('RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================
  // createPermission
  // ===========================================
  describe('createPermission', () => {
    it('returns permission with id on success', async () => {
      mockedExecuteRun.mockResolvedValueOnce({ changes: 1, lastInsertRowid: 1 })
      mockedExecuteQueryOne.mockResolvedValueOnce(mockPermission as any)

      const result = await createPermission({
        name: 'tickets:read',
        description: 'View tickets',
        resource: 'tickets',
        action: 'read',
      })

      expect(result).toEqual(mockPermission)
      expect(mockedExecuteRun).toHaveBeenCalledOnce()
      expect(mockedExecuteQueryOne).toHaveBeenCalledOnce()
    })

    it('returns null on error', async () => {
      mockedExecuteRun.mockRejectedValueOnce(new Error('DB error'))

      const result = await createPermission({
        name: 'tickets:read',
        description: 'View tickets',
        resource: 'tickets',
        action: 'read',
      })

      expect(result).toBeNull()
    })
  })

  // ===========================================
  // getPermissionById
  // ===========================================
  describe('getPermissionById', () => {
    it('returns permission when found', async () => {
      mockedExecuteQueryOne.mockResolvedValueOnce(mockPermission as any)

      const result = await getPermissionById(1)

      expect(result).toEqual(mockPermission)
      expect(mockedExecuteQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?'),
        [1]
      )
    })

    it('returns null when not found', async () => {
      mockedExecuteQueryOne.mockResolvedValueOnce(undefined)

      const result = await getPermissionById(999)

      expect(result).toBeNull()
    })
  })

  // ===========================================
  // createRole
  // ===========================================
  describe('createRole', () => {
    it('returns role with id on success', async () => {
      mockedExecuteRun.mockResolvedValueOnce({ changes: 1, lastInsertRowid: 1 })
      mockedExecuteQueryOne.mockResolvedValueOnce(mockRole as any)

      const result = await createRole({
        name: 'agent',
        display_name: 'Agente',
        description: 'Atendimento',
        is_system: false,
        is_active: true,
      })

      expect(result).toEqual(mockRole)
      expect(mockedExecuteRun).toHaveBeenCalledOnce()
    })
  })

  // ===========================================
  // deleteRole
  // ===========================================
  describe('deleteRole', () => {
    it('prevents deleting system roles', async () => {
      // getRoleById is called internally, which uses executeQueryOne
      mockedExecuteQueryOne.mockResolvedValueOnce(systemRole as any)

      const result = await deleteRole(2)

      expect(result).toBe(false)
      // executeRun should NOT be called for delete since it's a system role
      expect(mockedExecuteRun).not.toHaveBeenCalled()
    })

    it('deletes non-system roles', async () => {
      mockedExecuteQueryOne.mockResolvedValueOnce(mockRole as any)
      mockedExecuteRun.mockResolvedValueOnce({ changes: 1 })

      const result = await deleteRole(1)

      expect(result).toBe(true)
      expect(mockedExecuteRun).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM roles WHERE id = ?'),
        [1]
      )
    })
  })

  // ===========================================
  // assignPermissionToRole
  // ===========================================
  describe('assignPermissionToRole', () => {
    it('assigns permission to role and returns true', async () => {
      mockedExecuteRun.mockResolvedValueOnce({ changes: 1 })

      const result = await assignPermissionToRole(1, 2, 3)

      expect(result).toBe(true)
      expect(mockedExecuteRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO role_permissions'),
        [1, 2, 3]
      )
    })
  })

  // ===========================================
  // hasPermission
  // ===========================================
  describe('hasPermission', () => {
    it('returns true when user has exact permission', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { id: 1, name: 'tickets:read', resource: 'tickets', action: 'read', conditions: null },
      ] as any)

      const result = await hasPermission(1, 'tickets', 'read')

      expect(result).toBe(true)
    })

    it('returns true when user has manage action for the resource', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { id: 2, name: 'tickets:manage', resource: 'tickets', action: 'manage', conditions: null },
      ] as any)

      const result = await hasPermission(1, 'tickets', 'read')

      expect(result).toBe(true)
    })

    it('returns true when user has admin:manage', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { id: 3, name: 'admin:manage', resource: 'admin', action: 'manage', conditions: null },
      ] as any)

      const result = await hasPermission(1, 'tickets', 'delete')

      expect(result).toBe(true)
    })

    it('returns false when user has no matching permission', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { id: 1, name: 'users:read', resource: 'users', action: 'read', conditions: null },
      ] as any)

      const result = await hasPermission(1, 'tickets', 'delete')

      expect(result).toBe(false)
    })

    it('evaluates owner_only condition - passes when user is owner', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          id: 1,
          name: 'tickets:update',
          resource: 'tickets',
          action: 'update',
          conditions: JSON.stringify({ owner_only: true }),
        },
      ] as any)

      const result = await hasPermission(1, 'tickets', 'update', {
        userId: 10,
        ownerId: 10,
      })

      expect(result).toBe(true)
    })

    it('evaluates owner_only condition - fails when user is not owner', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          id: 1,
          name: 'tickets:update',
          resource: 'tickets',
          action: 'update',
          conditions: JSON.stringify({ owner_only: true }),
        },
      ] as any)

      const result = await hasPermission(1, 'tickets', 'update', {
        userId: 10,
        ownerId: 20,
      })

      expect(result).toBe(false)
    })

    it('evaluates department_only condition - passes when same department', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          id: 1,
          name: 'tickets:read',
          resource: 'tickets',
          action: 'read',
          conditions: JSON.stringify({ department_only: true }),
        },
      ] as any)

      const result = await hasPermission(1, 'tickets', 'read', {
        userDepartment: 'IT',
        resourceDepartment: 'IT',
      })

      expect(result).toBe(true)
    })

    it('evaluates department_only condition - fails when different department', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          id: 1,
          name: 'tickets:read',
          resource: 'tickets',
          action: 'read',
          conditions: JSON.stringify({ department_only: true }),
        },
      ] as any)

      const result = await hasPermission(1, 'tickets', 'read', {
        userDepartment: 'IT',
        resourceDepartment: 'HR',
      })

      expect(result).toBe(false)
    })
  })

  // ===========================================
  // hasRole
  // ===========================================
  describe('hasRole', () => {
    it('returns true when user has the role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const result = await hasRole(1, 'agent')

      expect(result).toBe(true)
    })

    it('returns false when user does not have the role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const result = await hasRole(1, 'admin')

      expect(result).toBe(false)
    })
  })

  // ===========================================
  // hasAnyRole
  // ===========================================
  describe('hasAnyRole', () => {
    it('returns true when user has at least one of the roles', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const result = await hasAnyRole(1, ['admin', 'agent'])

      expect(result).toBe(true)
    })

    it('returns false when user has none of the roles', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const result = await hasAnyRole(1, ['admin', 'manager'])

      expect(result).toBe(false)
    })
  })

  // ===========================================
  // hasAllRoles
  // ===========================================
  describe('hasAllRoles', () => {
    it('returns true only when user has all roles', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        mockRole,
        { ...mockRole, id: 3, name: 'manager' },
      ] as any)

      const result = await hasAllRoles(1, ['agent', 'manager'])

      expect(result).toBe(true)
    })

    it('returns false when user is missing a role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const result = await hasAllRoles(1, ['agent', 'admin'])

      expect(result).toBe(false)
    })
  })

  // ===========================================
  // requirePermission middleware
  // ===========================================
  describe('requirePermission', () => {
    it('returns 401 without user', async () => {
      const middleware = requirePermission('tickets', 'read')
      const req = makeMockReq()
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 403 without permission', async () => {
      // getUserPermissions returns empty array (no permissions)
      mockedExecuteQuery.mockResolvedValueOnce([])

      const middleware = requirePermission('tickets', 'delete')
      const req = makeMockReq({ id: 1 })
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Insufficient permissions' })
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next() when user has permission', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { id: 1, name: 'tickets:read', resource: 'tickets', action: 'read', conditions: null },
      ] as any)

      const middleware = requirePermission('tickets', 'read')
      const req = makeMockReq({ id: 1 })
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(res.status).not.toHaveBeenCalled()
    })
  })

  // ===========================================
  // requireRole middleware
  // ===========================================
  describe('requireRole', () => {
    it('returns 401 without user', async () => {
      const middleware = requireRole('admin')
      const req = makeMockReq()
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' })
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next() when user has the role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const middleware = requireRole('agent')
      const req = makeMockReq({ id: 1 })
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('returns 403 when user does not have the role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const middleware = requireRole('admin')
      const req = makeMockReq({ id: 1 })
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Insufficient role' })
      )
      expect(next).not.toHaveBeenCalled()
    })
  })

  // ===========================================
  // requireAnyRole middleware
  // ===========================================
  describe('requireAnyRole', () => {
    it('returns 401 without user', async () => {
      const middleware = requireAnyRole(['admin', 'agent'])
      const req = makeMockReq()
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next() when user has at least one role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const middleware = requireAnyRole(['admin', 'agent'])
      const req = makeMockReq({ id: 1 })
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(next).toHaveBeenCalledOnce()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('returns 403 when user has none of the roles', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([mockRole] as any)

      const middleware = requireAnyRole(['admin', 'manager'])
      const req = makeMockReq({ id: 1 })
      const res = makeMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Insufficient roles' })
      )
      expect(next).not.toHaveBeenCalled()
    })
  })
})
