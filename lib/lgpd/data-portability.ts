/**
 * LGPD Data Portability Implementation
 * Implements Art. 18º - Right to data portability
 * Exports user data in JSON and CSV formats
 */

import db from '../db/connection';
import { logger } from '../monitoring/observability';
import * as fs from 'fs';
import * as path from 'path';

export interface UserDataExport {
  exportId: string;
  userId: number;
  exportDate: Date;
  format: 'json' | 'csv';
  user: any;
  tickets: any[];
  comments: any[];
  attachments: any[];
  consents: any[];
  auditLogs: any[];
  preferences: any;
  metadata: {
    totalRecords: number;
    dataCategories: string[];
    legalBasis: string;
    retentionPeriod: string;
  };
}

export class DataPortabilityService {
  /**
   * Export all user data in JSON format - LGPD Art. 18º
   */
  async exportUserData(userId: number, organizationId: number = 1): Promise<UserDataExport> {
    try {
      const exportId = this.generateExportId(userId);

      logger.info('Starting data export', { userId, organizationId, exportId });

      // 1. User Profile Data
      const user = db.prepare(`
        SELECT
          id, name, email, role, timezone, language,
          created_at, updated_at, last_login_at
        FROM users
        WHERE id = ? AND organization_id = ?
      `).get(userId, organizationId);

      if (!user) {
        throw new Error('User not found');
      }

      // 2. Tickets Data
      const tickets = db.prepare(`
        SELECT
          t.id, t.title, t.description, t.created_at, t.updated_at, t.resolved_at,
          c.name as category, p.name as priority, s.name as status,
          u.name as assigned_to_name
        FROM tickets t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN priorities p ON t.priority_id = p.id
        LEFT JOIN statuses s ON t.status_id = s.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.user_id = ? AND t.organization_id = ?
        ORDER BY t.created_at DESC
      `).all(userId, organizationId);

      // 3. Comments Data
      const comments = db.prepare(`
        SELECT
          c.id, c.content, c.is_internal, c.created_at,
          t.title as ticket_title, t.id as ticket_id
        FROM comments c
        INNER JOIN tickets t ON c.ticket_id = t.id
        WHERE c.user_id = ? AND t.organization_id = ?
        ORDER BY c.created_at DESC
      `).all(userId, organizationId);

      // 4. Attachments Metadata
      const attachments = db.prepare(`
        SELECT
          a.id, a.filename, a.original_name, a.mime_type, a.size, a.created_at,
          t.title as ticket_title, t.id as ticket_id
        FROM attachments a
        INNER JOIN tickets t ON a.ticket_id = t.id
        WHERE a.uploaded_by = ? AND t.organization_id = ?
        ORDER BY a.created_at DESC
      `).all(userId, organizationId);

      // 5. Consent Records
      const consents = db.prepare(`
        SELECT
          id, consent_type, purpose, legal_basis, is_given,
          consent_method, ip_address, created_at,
          expires_at, withdrawn_at, withdrawal_reason
        FROM lgpd_consents
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId);

      // 6. Audit Logs (last 1000 entries)
      const auditLogs = db.prepare(`
        SELECT
          id, entity_type, entity_id, action, created_at,
          old_values, new_values, ip_address
        FROM audit_advanced
        WHERE user_id = ? AND organization_id = ?
        ORDER BY created_at DESC
        LIMIT 1000
      `).all(userId, organizationId);

      // 7. User Preferences
      const preferences = {
        timezone: user.timezone,
        language: user.language,
        notifications: this.getUserNotificationPreferences(userId)
      };

      // Calculate metadata
      const totalRecords =
        1 + // user
        tickets.length +
        comments.length +
        attachments.length +
        consents.length +
        auditLogs.length;

      const dataCategories = [
        'personal_data',
        'support_tickets',
        'comments',
        'file_attachments',
        'consent_records',
        'audit_trail',
        'preferences'
      ];

      const exportData: UserDataExport = {
        exportId,
        userId,
        exportDate: new Date(),
        format: 'json',
        user,
        tickets,
        comments,
        attachments,
        consents,
        auditLogs,
        preferences,
        metadata: {
          totalRecords,
          dataCategories,
          legalBasis: 'LGPD Art. 18º - Right to data portability',
          retentionPeriod: 'As per LGPD data retention policies'
        }
      };

      // Log export for compliance
      this.logDataExport(userId, 'json', totalRecords);

      logger.info('Data export completed', {
        userId,
        exportId,
        totalRecords,
        categories: dataCategories.length
      });

      return exportData;
    } catch (error) {
      logger.error('Failed to export user data', { error, userId });
      throw new Error(`Failed to export user data: ${error}`);
    }
  }

  /**
   * Export user data in CSV format
   */
  async exportUserDataCSV(userId: number, organizationId: number = 1): Promise<{
    files: Record<string, string>;
    exportId: string;
  }> {
    try {
      const exportId = this.generateExportId(userId);
      const jsonExport = await this.exportUserData(userId, organizationId);

      const csvFiles: Record<string, string> = {};

      // Convert each data category to CSV
      csvFiles.user = this.convertToCSV([jsonExport.user]);
      csvFiles.tickets = this.convertToCSV(jsonExport.tickets);
      csvFiles.comments = this.convertToCSV(jsonExport.comments);
      csvFiles.attachments = this.convertToCSV(jsonExport.attachments);
      csvFiles.consents = this.convertToCSV(jsonExport.consents);
      csvFiles.auditLogs = this.convertToCSV(jsonExport.auditLogs);

      // Log export
      this.logDataExport(userId, 'csv', jsonExport.metadata.totalRecords);

      logger.info('CSV export completed', { userId, exportId, fileCount: Object.keys(csvFiles).length });

      return { files: csvFiles, exportId };
    } catch (error) {
      logger.error('Failed to export CSV data', { error, userId });
      throw new Error(`Failed to export CSV data: ${error}`);
    }
  }

  /**
   * Save export to file system (for download)
   */
  async saveExportToFile(
    exportData: UserDataExport | { files: Record<string, string>; exportId: string },
    format: 'json' | 'csv'
  ): Promise<string> {
    try {
      const exportDir = path.join(process.cwd(), 'exports', 'lgpd');

      // Create directory if it doesn't exist
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      if (format === 'json') {
        const data = exportData as UserDataExport;
        const filename = `user_${data.userId}_${data.exportId}.json`;
        const filepath = path.join(exportDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

        logger.info('JSON export saved', { filepath, userId: data.userId });
        return filepath;
      } else {
        // CSV format - save as ZIP or multiple files
        const data = exportData as { files: Record<string, string>; exportId: string };
        const baseFilename = `user_export_${data.exportId}`;
        const filepaths: string[] = [];

        for (const [category, csvContent] of Object.entries(data.files)) {
          const filename = `${baseFilename}_${category}.csv`;
          const filepath = path.join(exportDir, filename);
          fs.writeFileSync(filepath, csvContent);
          filepaths.push(filepath);
        }

        logger.info('CSV exports saved', { filepaths, count: filepaths.length });
        return exportDir; // Return directory path
      }
    } catch (error) {
      logger.error('Failed to save export to file', { error });
      throw new Error(`Failed to save export: ${error}`);
    }
  }

  /**
   * Schedule export deletion (LGPD data minimization)
   */
  async scheduleExportDeletion(exportId: string, daysUntilDeletion: number = 30): Promise<void> {
    try {
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + daysUntilDeletion);

      // Store in database for automated cleanup
      db.prepare(`
        INSERT INTO audit_advanced (
          entity_type, entity_id, action, new_values, organization_id
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        'data_export',
        0,
        'scheduled_deletion',
        JSON.stringify({
          exportId,
          deletionDate: deletionDate.toISOString(),
          reason: 'LGPD data minimization - Art. 16º'
        }),
        1
      );

      logger.info('Export deletion scheduled', { exportId, deletionDate });
    } catch (error) {
      logger.error('Failed to schedule export deletion', { error, exportId });
    }
  }

  /**
   * Get data export statistics (for compliance reporting)
   */
  async getExportStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalExports: number;
    jsonExports: number;
    csvExports: number;
    byUser: Record<number, number>;
    averageRecords: number;
  }> {
    try {
      const dateFilter = startDate && endDate
        ? `AND created_at BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'`
        : '';

      const stats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN new_values LIKE '%"format":"json"%' THEN 1 ELSE 0 END) as json_count,
          SUM(CASE WHEN new_values LIKE '%"format":"csv"%' THEN 1 ELSE 0 END) as csv_count
        FROM audit_advanced
        WHERE entity_type = 'data_export' AND action = 'export_completed'
        ${dateFilter}
      `).get() as any;

      return {
        totalExports: stats.total || 0,
        jsonExports: stats.json_count || 0,
        csvExports: stats.csv_count || 0,
        byUser: {},
        averageRecords: 0
      };
    } catch (error) {
      logger.error('Failed to get export statistics', { error });
      throw new Error(`Failed to get export statistics: ${error}`);
    }
  }

  /**
   * Private: Convert data to CSV format
   */
  private convertToCSV(data: any[]): string {
    if (!data || data.length === 0) {
      return 'No data available\n';
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Escape values with commas or quotes
        if (value === null || value === undefined) return '';
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Private: Generate unique export ID
   */
  private generateExportId(userId: number): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `EXPORT_${userId}_${timestamp}_${random}`;
  }

  /**
   * Private: Get user notification preferences
   */
  private getUserNotificationPreferences(userId: number): any {
    try {
      // This would retrieve notification preferences from settings
      // For now, return a placeholder
      return {
        email: true,
        browser: true,
        sla_warnings: true
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Private: Log data export for compliance audit
   */
  private logDataExport(userId: number, format: string, recordCount: number): void {
    try {
      db.prepare(`
        INSERT INTO audit_advanced (
          entity_type, entity_id, action, new_values, user_id, organization_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'data_export',
        userId,
        'export_completed',
        JSON.stringify({
          format,
          recordCount,
          exportDate: new Date().toISOString(),
          legalBasis: 'LGPD Art. 18º'
        }),
        userId,
        1
      );
    } catch (error) {
      logger.error('Failed to log data export', { error, userId });
    }
  }
}

export const dataPortabilityService = new DataPortabilityService();
