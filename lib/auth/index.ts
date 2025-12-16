/**
 * Authentication Module
 * Authentication utilities and exports
 */

/**
 * Re-export auth utilities
 */
export * from './sqlite-auth';
export * from './rbac-engine';

/**
 * Enterprise Auth Modules
 */
export { ssoManager } from './sso-manager';
export { mfaManager } from './mfa-manager';
export { rbac } from './rbac-engine';

// Export types
export type { SSOProvider, SSOConfiguration, SSOUser } from './sso-manager';
export type { MFASetup, MFAVerification, MFADevice } from './mfa-manager';
export type { PermissionCheck, ResourcePermission, RowLevelPolicy, AuditEntry } from './rbac-engine';
