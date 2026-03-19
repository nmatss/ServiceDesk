/**
 * Comprehensive Unit Tests for Roles
 * Tests ROLES constants, role arrays, and role-checking helper functions
 */

import { describe, it, expect } from 'vitest'
import {
  ROLES,
  ADMIN_ROLES,
  TICKET_MANAGEMENT_ROLES,
  isAdmin,
  isAgent,
  isPrivileged,
  canManageTickets,
} from '../roles'
import type { Role } from '../roles'

// All valid role values for iteration
const ALL_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.TENANT_ADMIN,
  ROLES.TEAM_MANAGER,
  ROLES.AGENT,
  ROLES.USER,
]

describe('ROLES constants', () => {
  it('should define exactly 6 roles', () => {
    expect(Object.keys(ROLES)).toHaveLength(6)
  })

  it('should have correct string values', () => {
    expect(ROLES.SUPER_ADMIN).toBe('super_admin')
    expect(ROLES.ADMIN).toBe('admin')
    expect(ROLES.TENANT_ADMIN).toBe('tenant_admin')
    expect(ROLES.TEAM_MANAGER).toBe('team_manager')
    expect(ROLES.AGENT).toBe('agent')
    expect(ROLES.USER).toBe('user')
  })

  it('should have unique values', () => {
    const values = Object.values(ROLES)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

describe('ADMIN_ROLES', () => {
  it('should include super_admin, admin, tenant_admin, and team_manager', () => {
    expect(ADMIN_ROLES).toContain(ROLES.SUPER_ADMIN)
    expect(ADMIN_ROLES).toContain(ROLES.ADMIN)
    expect(ADMIN_ROLES).toContain(ROLES.TENANT_ADMIN)
    expect(ADMIN_ROLES).toContain(ROLES.TEAM_MANAGER)
  })

  it('should NOT include agent or user', () => {
    expect(ADMIN_ROLES).not.toContain(ROLES.AGENT)
    expect(ADMIN_ROLES).not.toContain(ROLES.USER)
  })

  it('should have exactly 4 entries', () => {
    expect(ADMIN_ROLES).toHaveLength(4)
  })
})

describe('TICKET_MANAGEMENT_ROLES', () => {
  it('should include all admin roles plus agent', () => {
    expect(TICKET_MANAGEMENT_ROLES).toContain(ROLES.SUPER_ADMIN)
    expect(TICKET_MANAGEMENT_ROLES).toContain(ROLES.ADMIN)
    expect(TICKET_MANAGEMENT_ROLES).toContain(ROLES.TENANT_ADMIN)
    expect(TICKET_MANAGEMENT_ROLES).toContain(ROLES.TEAM_MANAGER)
    expect(TICKET_MANAGEMENT_ROLES).toContain(ROLES.AGENT)
  })

  it('should NOT include user', () => {
    expect(TICKET_MANAGEMENT_ROLES).not.toContain(ROLES.USER)
  })

  it('should have exactly 5 entries', () => {
    expect(TICKET_MANAGEMENT_ROLES).toHaveLength(5)
  })

  it('should be a superset of ADMIN_ROLES', () => {
    for (const role of ADMIN_ROLES) {
      expect(TICKET_MANAGEMENT_ROLES).toContain(role)
    }
  })
})

describe('isAdmin', () => {
  it('should return true for super_admin', () => {
    expect(isAdmin(ROLES.SUPER_ADMIN)).toBe(true)
  })

  it('should return true for admin', () => {
    expect(isAdmin(ROLES.ADMIN)).toBe(true)
  })

  it('should return true for tenant_admin', () => {
    expect(isAdmin(ROLES.TENANT_ADMIN)).toBe(true)
  })

  it('should return true for team_manager', () => {
    expect(isAdmin(ROLES.TEAM_MANAGER)).toBe(true)
  })

  it('should return false for agent', () => {
    expect(isAdmin(ROLES.AGENT)).toBe(false)
  })

  it('should return false for user', () => {
    expect(isAdmin(ROLES.USER)).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isAdmin('')).toBe(false)
  })

  it('should return false for unknown role strings', () => {
    expect(isAdmin('moderator')).toBe(false)
    expect(isAdmin('root')).toBe(false)
    expect(isAdmin('superadmin')).toBe(false)
  })

  it('should be case-sensitive', () => {
    expect(isAdmin('ADMIN')).toBe(false)
    expect(isAdmin('Admin')).toBe(false)
    expect(isAdmin('SUPER_ADMIN')).toBe(false)
  })
})

describe('isAgent', () => {
  it('should return true only for agent role', () => {
    expect(isAgent(ROLES.AGENT)).toBe(true)
  })

  it('should return false for all non-agent roles', () => {
    expect(isAgent(ROLES.SUPER_ADMIN)).toBe(false)
    expect(isAgent(ROLES.ADMIN)).toBe(false)
    expect(isAgent(ROLES.TENANT_ADMIN)).toBe(false)
    expect(isAgent(ROLES.TEAM_MANAGER)).toBe(false)
    expect(isAgent(ROLES.USER)).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isAgent('')).toBe(false)
  })

  it('should return false for unknown role strings', () => {
    expect(isAgent('Agent')).toBe(false)
    expect(isAgent('AGENT')).toBe(false)
    expect(isAgent('agents')).toBe(false)
  })
})

describe('isPrivileged', () => {
  it('should return true for all admin roles', () => {
    expect(isPrivileged(ROLES.SUPER_ADMIN)).toBe(true)
    expect(isPrivileged(ROLES.ADMIN)).toBe(true)
    expect(isPrivileged(ROLES.TENANT_ADMIN)).toBe(true)
    expect(isPrivileged(ROLES.TEAM_MANAGER)).toBe(true)
  })

  it('should return true for agent', () => {
    expect(isPrivileged(ROLES.AGENT)).toBe(true)
  })

  it('should return false for user', () => {
    expect(isPrivileged(ROLES.USER)).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isPrivileged('')).toBe(false)
  })

  it('should return false for unknown role strings', () => {
    expect(isPrivileged('manager')).toBe(false)
    expect(isPrivileged('supervisor')).toBe(false)
  })

  it('should match TICKET_MANAGEMENT_ROLES membership', () => {
    for (const role of ALL_ROLES) {
      expect(isPrivileged(role)).toBe(TICKET_MANAGEMENT_ROLES.includes(role))
    }
  })
})

describe('canManageTickets', () => {
  it('should return true for all admin roles', () => {
    expect(canManageTickets(ROLES.SUPER_ADMIN)).toBe(true)
    expect(canManageTickets(ROLES.ADMIN)).toBe(true)
    expect(canManageTickets(ROLES.TENANT_ADMIN)).toBe(true)
    expect(canManageTickets(ROLES.TEAM_MANAGER)).toBe(true)
  })

  it('should return true for agent', () => {
    expect(canManageTickets(ROLES.AGENT)).toBe(true)
  })

  it('should return false for user', () => {
    expect(canManageTickets(ROLES.USER)).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(canManageTickets('')).toBe(false)
  })

  it('should return false for unknown role strings', () => {
    expect(canManageTickets('support')).toBe(false)
    expect(canManageTickets('operator')).toBe(false)
  })

  it('should produce identical results to isPrivileged for all roles', () => {
    for (const role of ALL_ROLES) {
      expect(canManageTickets(role)).toBe(isPrivileged(role))
    }
  })
})

describe('cross-function consistency', () => {
  it('all admin roles should also be privileged', () => {
    for (const role of ALL_ROLES) {
      if (isAdmin(role)) {
        expect(isPrivileged(role)).toBe(true)
      }
    }
  })

  it('agent should be privileged but not admin', () => {
    expect(isAgent(ROLES.AGENT)).toBe(true)
    expect(isPrivileged(ROLES.AGENT)).toBe(true)
    expect(isAdmin(ROLES.AGENT)).toBe(false)
  })

  it('user should not be admin, agent, or privileged', () => {
    expect(isAdmin(ROLES.USER)).toBe(false)
    expect(isAgent(ROLES.USER)).toBe(false)
    expect(isPrivileged(ROLES.USER)).toBe(false)
    expect(canManageTickets(ROLES.USER)).toBe(false)
  })

  it('no role should be both admin and agent', () => {
    for (const role of ALL_ROLES) {
      if (isAdmin(role)) {
        expect(isAgent(role)).toBe(false)
      }
    }
  })

  it('every defined role should be either privileged or user', () => {
    for (const role of ALL_ROLES) {
      const privilegedOrUser = isPrivileged(role) || role === ROLES.USER
      expect(privilegedOrUser).toBe(true)
    }
  })
})
