/**
 * User Storage Quota Management
 *
 * Implements per-user file storage limits:
 * - Configurable quota per user/tenant
 * - Real-time usage tracking
 * - Automatic cleanup of old files
 * - Storage analytics
 */

import db from '@/lib/db/connection';
import logger from '@/lib/monitoring/structured-logger';
import fs from 'fs/promises';
import path from 'path';

/**
 * Default quota configurations (in bytes)
 */
export const DEFAULT_QUOTAS = {
  USER: 1 * 1024 * 1024 * 1024, // 1GB per user
  TENANT: 50 * 1024 * 1024 * 1024, // 50GB per tenant
  SUPER_ADMIN: 10 * 1024 * 1024 * 1024, // 10GB for admins
};

/**
 * Storage quota record
 */
export interface StorageQuota {
  id: number;
  user_id: number;
  tenant_id: number;
  quota_bytes: number;
  used_bytes: number;
  file_count: number;
  last_cleanup_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Storage usage breakdown
 */
export interface StorageUsage {
  total_used: number;
  quota: number;
  remaining: number;
  percentage: number;
  file_count: number;
  by_type: Record<string, { size: number; count: number }>;
  largest_files: Array<{ filename: string; size: number; created_at: string }>;
}

/**
 * Initialize storage quota tables
 */
export function initializeStorageQuotaTables(): void {
  try {
    // Create storage_quotas table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS storage_quotas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tenant_id INTEGER NOT NULL,
        quota_bytes INTEGER NOT NULL DEFAULT ${DEFAULT_QUOTAS.USER},
        used_bytes INTEGER NOT NULL DEFAULT 0,
        file_count INTEGER NOT NULL DEFAULT 0,
        last_cleanup_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE(user_id, tenant_id)
      )
    `).run();

    // Create indexes
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_storage_quotas_user
      ON storage_quotas(user_id, tenant_id)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_storage_quotas_tenant
      ON storage_quotas(tenant_id)
    `).run();

    // Create trigger to update timestamp
    db.prepare(`
      CREATE TRIGGER IF NOT EXISTS update_storage_quotas_timestamp
      AFTER UPDATE ON storage_quotas
      BEGIN
        UPDATE storage_quotas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `).run();

    logger.info('Storage quota tables initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize storage quota tables', error);
    throw error;
  }
}

/**
 * Get or create user storage quota
 */
export function getUserQuota(userId: number, tenantId: number): StorageQuota {
  try {
    // Try to get existing quota
    let quota = db.prepare(`
      SELECT * FROM storage_quotas
      WHERE user_id = ? AND tenant_id = ?
    `).get(userId, tenantId) as StorageQuota | undefined;

    // Create if doesn't exist
    if (!quota) {
      // Get user role to determine quota
      const user = db.prepare(`
        SELECT role FROM users WHERE id = ? AND tenant_id = ?
      `).get(userId, tenantId) as { role: string } | undefined;

      const quotaBytes = user?.role === 'super_admin' || user?.role === 'tenant_admin'
        ? DEFAULT_QUOTAS.SUPER_ADMIN
        : DEFAULT_QUOTAS.USER;

      db.prepare(`
        INSERT INTO storage_quotas (user_id, tenant_id, quota_bytes)
        VALUES (?, ?, ?)
      `).run(userId, tenantId, quotaBytes);

      quota = db.prepare(`
        SELECT * FROM storage_quotas
        WHERE user_id = ? AND tenant_id = ?
      `).get(userId, tenantId) as StorageQuota;
    }

    return quota;
  } catch (error) {
    logger.error('Failed to get user quota', { userId, tenantId, error });
    throw error;
  }
}

/**
 * Check if user can upload file
 */
export function canUploadFile(
  userId: number,
  tenantId: number,
  fileSize: number
): { allowed: boolean; reason?: string; quota?: StorageQuota } {
  try {
    const quota = getUserQuota(userId, tenantId);

    const newUsage = quota.used_bytes + fileSize;

    if (newUsage > quota.quota_bytes) {
      return {
        allowed: false,
        reason: `Quota excedida. Você está usando ${formatBytes(quota.used_bytes)} de ${formatBytes(quota.quota_bytes)}. Este arquivo requer ${formatBytes(fileSize)} adicionais.`,
        quota,
      };
    }

    return {
      allowed: true,
      quota,
    };
  } catch (error) {
    logger.error('Failed to check upload permission', { userId, tenantId, fileSize, error });
    return {
      allowed: false,
      reason: 'Erro ao verificar quota de armazenamento',
    };
  }
}

/**
 * Record file upload and update quota
 */
export function recordFileUpload(
  userId: number,
  tenantId: number,
  fileSize: number
): void {
  try {
    db.prepare(`
      UPDATE storage_quotas
      SET used_bytes = used_bytes + ?,
          file_count = file_count + 1
      WHERE user_id = ? AND tenant_id = ?
    `).run(fileSize, userId, tenantId);

    logger.info('File upload recorded', { userId, tenantId, fileSize });
  } catch (error) {
    logger.error('Failed to record file upload', { userId, tenantId, fileSize, error });
    throw error;
  }
}

/**
 * Record file deletion and update quota
 */
export function recordFileDeletion(
  userId: number,
  tenantId: number,
  fileSize: number
): void {
  try {
    db.prepare(`
      UPDATE storage_quotas
      SET used_bytes = MAX(0, used_bytes - ?),
          file_count = MAX(0, file_count - 1)
      WHERE user_id = ? AND tenant_id = ?
    `).run(fileSize, userId, tenantId);

    logger.info('File deletion recorded', { userId, tenantId, fileSize });
  } catch (error) {
    logger.error('Failed to record file deletion', { userId, tenantId, fileSize, error });
  }
}

/**
 * Get detailed storage usage for user
 */
export function getStorageUsage(userId: number, tenantId: number): StorageUsage {
  try {
    const quota = getUserQuota(userId, tenantId);

    // Get file breakdown by type
    const filesByType = db.prepare(`
      SELECT
        mime_type,
        SUM(file_size) as total_size,
        COUNT(*) as file_count
      FROM attachments
      WHERE uploaded_by = ? AND tenant_id = ?
      GROUP BY mime_type
      ORDER BY total_size DESC
    `).all(userId, tenantId) as Array<{ mime_type: string; total_size: number; file_count: number }>;

    const byType: Record<string, { size: number; count: number }> = {};
    for (const row of filesByType) {
      byType[row.mime_type] = {
        size: row.total_size,
        count: row.file_count,
      };
    }

    // Get largest files
    const largestFiles = db.prepare(`
      SELECT filename, file_size as size, created_at
      FROM attachments
      WHERE uploaded_by = ? AND tenant_id = ?
      ORDER BY file_size DESC
      LIMIT 10
    `).all(userId, tenantId) as Array<{ filename: string; size: number; created_at: string }>;

    const remaining = Math.max(0, quota.quota_bytes - quota.used_bytes);
    const percentage = quota.quota_bytes > 0
      ? Math.round((quota.used_bytes / quota.quota_bytes) * 100)
      : 0;

    return {
      total_used: quota.used_bytes,
      quota: quota.quota_bytes,
      remaining,
      percentage,
      file_count: quota.file_count,
      by_type: byType,
      largest_files: largestFiles,
    };
  } catch (error) {
    logger.error('Failed to get storage usage', { userId, tenantId, error });
    throw error;
  }
}

/**
 * Recalculate storage usage (in case of discrepancies)
 */
export function recalculateStorageUsage(userId: number, tenantId: number): void {
  try {
    const result = db.prepare(`
      SELECT
        COALESCE(SUM(file_size), 0) as total_size,
        COUNT(*) as file_count
      FROM attachments
      WHERE uploaded_by = ? AND tenant_id = ?
    `).get(userId, tenantId) as { total_size: number; file_count: number };

    db.prepare(`
      UPDATE storage_quotas
      SET used_bytes = ?,
          file_count = ?
      WHERE user_id = ? AND tenant_id = ?
    `).run(result.total_size, result.file_count, userId, tenantId);

    logger.info('Storage usage recalculated', { userId, tenantId, ...result });
  } catch (error) {
    logger.error('Failed to recalculate storage usage', { userId, tenantId, error });
  }
}

/**
 * Clean up old attachments (orphaned or expired)
 */
export async function cleanupOldAttachments(
  tenantId: number,
  daysOld: number = 90
): Promise<{ deletedCount: number; freedBytes: number }> {
  try {
    // Find attachments to delete
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const attachmentsToDelete = db.prepare(`
      SELECT a.id, a.file_path, a.file_size, a.uploaded_by, a.tenant_id
      FROM attachments a
      LEFT JOIN tickets t ON a.ticket_id = t.id
      WHERE a.tenant_id = ?
        AND a.created_at < ?
        AND (t.id IS NULL OR t.status_id IN (
          SELECT id FROM statuses WHERE is_final = 1
        ))
    `).all(tenantId, cutoffDate.toISOString()) as Array<{
      id: number;
      file_path: string;
      file_size: number;
      uploaded_by: number;
      tenant_id: number;
    }>;

    let deletedCount = 0;
    let freedBytes = 0;

    for (const attachment of attachmentsToDelete) {
      try {
        // Delete physical file
        await fs.unlink(attachment.file_path);

        // Delete database record
        db.prepare(`DELETE FROM attachments WHERE id = ?`).run(attachment.id);

        // Update quota
        recordFileDeletion(attachment.uploaded_by, attachment.tenant_id, attachment.file_size);

        deletedCount++;
        freedBytes += attachment.file_size;
      } catch (error) {
        logger.warn('Failed to delete attachment', { attachmentId: attachment.id, error });
      }
    }

    // Update cleanup timestamp
    db.prepare(`
      UPDATE storage_quotas
      SET last_cleanup_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ?
    `).run(tenantId);

    logger.info('Old attachments cleaned up', { tenantId, deletedCount, freedBytes });

    return { deletedCount, freedBytes };
  } catch (error) {
    logger.error('Failed to cleanup old attachments', { tenantId, error });
    throw error;
  }
}

/**
 * Get tenant-wide storage statistics
 */
export function getTenantStorageStats(tenantId: number): {
  total_quota: number;
  total_used: number;
  total_files: number;
  user_count: number;
  top_users: Array<{ user_id: number; name: string; used_bytes: number; file_count: number }>;
} {
  try {
    const stats = db.prepare(`
      SELECT
        SUM(quota_bytes) as total_quota,
        SUM(used_bytes) as total_used,
        SUM(file_count) as total_files,
        COUNT(*) as user_count
      FROM storage_quotas
      WHERE tenant_id = ?
    `).get(tenantId) as {
      total_quota: number;
      total_used: number;
      total_files: number;
      user_count: number;
    };

    const topUsers = db.prepare(`
      SELECT
        sq.user_id,
        u.name,
        sq.used_bytes,
        sq.file_count
      FROM storage_quotas sq
      JOIN users u ON sq.user_id = u.id
      WHERE sq.tenant_id = ?
      ORDER BY sq.used_bytes DESC
      LIMIT 10
    `).all(tenantId) as Array<{
      user_id: number;
      name: string;
      used_bytes: number;
      file_count: number;
    }>;

    return {
      ...stats,
      top_users: topUsers,
    };
  } catch (error) {
    logger.error('Failed to get tenant storage stats', { tenantId, error });
    throw error;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Update user quota (admin function)
 */
export function updateUserQuota(
  userId: number,
  tenantId: number,
  newQuotaBytes: number
): void {
  try {
    db.prepare(`
      UPDATE storage_quotas
      SET quota_bytes = ?
      WHERE user_id = ? AND tenant_id = ?
    `).run(newQuotaBytes, userId, tenantId);

    logger.info('User quota updated', { userId, tenantId, newQuotaBytes });
  } catch (error) {
    logger.error('Failed to update user quota', { userId, tenantId, newQuotaBytes, error });
    throw error;
  }
}
