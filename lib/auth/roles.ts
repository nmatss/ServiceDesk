/**
 * Centralized role definitions and helpers.
 *
 * All role strings used across the application should reference these
 * constants rather than hard-coding string literals.
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TENANT_ADMIN: 'tenant_admin',
  TEAM_MANAGER: 'team_manager',
  AGENT: 'agent',
  USER: 'user',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles considered to have full administrative access */
export const ADMIN_ROLES: readonly string[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.TENANT_ADMIN,
  ROLES.TEAM_MANAGER,
];

/** Roles allowed to manage tickets (admin + agent) */
export const TICKET_MANAGEMENT_ROLES: readonly string[] = [
  ...ADMIN_ROLES,
  ROLES.AGENT,
];

/** Check if the role has admin-level access */
export function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Check if the role is an agent */
export function isAgent(role: string): boolean {
  return role === ROLES.AGENT;
}

/** Check if the role is admin or agent (privileged) */
export function isPrivileged(role: string): boolean {
  return TICKET_MANAGEMENT_ROLES.includes(role);
}

/** Check if the role can manage tickets (create, assign, resolve) */
export function canManageTickets(role: string): boolean {
  return TICKET_MANAGEMENT_ROLES.includes(role);
}
