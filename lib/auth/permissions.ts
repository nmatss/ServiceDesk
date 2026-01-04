/**
 * Authentication and Authorization Helpers
 *
 * Provides utility functions for role-based access control and ownership verification.
 * Used to secure API routes against IDOR vulnerabilities.
 *
 * @module lib/auth/permissions
 */

import type { AuthUser } from './sqlite-auth';

/**
 * Admin roles that have elevated privileges across the system
 */
const ADMIN_ROLES = ['super_admin', 'tenant_admin', 'admin', 'manager'] as const;

/**
 * Checks if a role has administrative privileges
 *
 * @param role - The user role to check
 * @returns True if the role is an admin role
 *
 * @example
 * if (isAdminRole(user.role)) {
 *   // Allow access to admin resources
 * }
 */
export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number]);
}

/**
 * Checks if a user can access a specific resource based on ownership and role
 *
 * @param userRole - The role of the user attempting access
 * @param userId - The ID of the user attempting access
 * @param resourceOwnerId - The ID of the user who owns the resource
 * @returns True if access should be granted
 *
 * @example
 * if (!canAccessResource(user.role, user.id, ticket.user_id)) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 * }
 */
export function canAccessResource(
  userRole: string,
  userId: number,
  resourceOwnerId: number
): boolean {
  // Super admin and tenant admin can access everything
  if (userRole === 'super_admin' || userRole === 'tenant_admin') {
    return true;
  }

  // Owner can access their own resources
  if (userId === resourceOwnerId) {
    return true;
  }

  // Admin and Manager roles can access resources from non-admin users
  if (isAdminRole(userRole)) {
    return true;
  }

  return false;
}

/**
 * Verifies if a user has ownership of a resource or admin privileges
 *
 * @param user - The authenticated user
 * @param resourceOwnerId - The ID of the resource owner
 * @returns True if user is owner or admin
 *
 * @example
 * if (!hasOwnershipOrAdmin(userContext, ticket.user_id)) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 * }
 */
export function hasOwnershipOrAdmin(
  user: AuthUser | { id: number; role: string },
  resourceOwnerId: number
): boolean {
  return user.id === resourceOwnerId || isAdminRole(user.role);
}

/**
 * Checks if user can modify a resource (stricter than read access)
 *
 * @param userRole - The role of the user
 * @param userId - The ID of the user
 * @param resourceOwnerId - The ID of the resource owner
 * @returns True if modification is allowed
 */
export function canModifyResource(
  userRole: string,
  userId: number,
  resourceOwnerId: number
): boolean {
  // Only owners or admins can modify
  return userId === resourceOwnerId || isAdminRole(userRole);
}

/**
 * Checks if user can delete a resource (most restrictive)
 *
 * @param userRole - The role of the user
 * @param userId - The ID of the user
 * @param resourceOwnerId - The ID of the resource owner
 * @returns True if deletion is allowed
 */
export function canDeleteResource(
  userRole: string,
  userId: number,
  resourceOwnerId: number
): boolean {
  // Only resource owner or tenant admins can delete
  if (userId === resourceOwnerId) {
    return true;
  }

  // Only high-level admins can delete others' resources
  return userRole === 'super_admin' || userRole === 'tenant_admin';
}

/**
 * Validates tenant isolation - ensures user can only access resources in their organization
 *
 * @param userOrgId - The organization ID of the user
 * @param resourceOrgId - The organization ID of the resource
 * @returns True if organizations match
 */
export function validateTenantIsolation(
  userOrgId: number,
  resourceOrgId: number
): boolean {
  return userOrgId === resourceOrgId;
}

/**
 * Role hierarchy levels for comparison
 */
const ROLE_HIERARCHY: Record<string, number> = {
  'super_admin': 100,
  'tenant_admin': 90,
  'admin': 80,
  'manager': 70,
  'team_manager': 60,
  'agent': 50,
  'user': 30,
  'read_only': 20,
  'api_client': 10,
};

/**
 * Checks if userRole has higher or equal privilege level than requiredRole
 *
 * @param userRole - The user's role
 * @param requiredRole - The minimum required role
 * @returns True if user has sufficient privileges
 */
export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Get user context from authenticated user
 * Helper to extract common auth properties
 */
export interface UserContext {
  user_id: number;
  id: number; // alias for user_id
  role: string;
  organization_id: number;
  tenant_slug?: string;
  email?: string;
}

/**
 * Extracts and validates user context from AuthUser
 *
 * @param user - The authenticated user object
 * @returns Normalized user context
 */
export function getUserContext(user: AuthUser): UserContext {
  return {
    user_id: user.id,
    id: user.id,
    role: user.role,
    organization_id: user.organization_id,
    tenant_slug: user.tenant_slug,
    email: user.email,
  };
}
