/**
 * Audit Logger Module
 * Re-exports audit functions for compatibility
 */

import { logAuditAction, logCreate, logUpdate, logDelete, logView, logLogin, logLogout } from './index';
import { CreateAuditLog } from '../types/database';

/**
 * Alias for logAuditAction for compatibility with imports
 */
export const createAuditLog = logAuditAction;

/**
 * Re-export all audit functions
 */
export {
  logAuditAction,
  logCreate,
  logUpdate,
  logDelete,
  logView,
  logLogin,
  logLogout
};

export type { CreateAuditLog };
