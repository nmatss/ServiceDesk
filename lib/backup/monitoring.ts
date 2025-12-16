/**
 * Backup Monitoring & Alerting System
 *
 * Tracks backup job status, detects anomalies, and sends alerts
 */

import { z } from 'zod';

// Backup job status types
export enum BackupStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  APP_STATE = 'app_state',
}

// Schemas
const BackupJobSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(BackupType),
  status: z.nativeEnum(BackupStatus),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  sizeBytes: z.number().optional(),
  duration: z.number().optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type BackupJob = z.infer<typeof BackupJobSchema>;

const BackupMetricsSchema = z.object({
  totalBackups: z.number(),
  successfulBackups: z.number(),
  failedBackups: z.number(),
  averageSize: z.number(),
  averageDuration: z.number(),
  lastBackupAt: z.date(),
  successRate: z.number(),
});

export type BackupMetrics = z.infer<typeof BackupMetricsSchema>;

/**
 * Backup Monitoring Service
 */
export class BackupMonitor {
  private jobs: Map<string, BackupJob> = new Map();
  private alertThresholds = {
    maxFailureRate: 0.1, // 10% failure rate threshold
    maxBackupAge: 24 * 60 * 60 * 1000, // 24 hours
    minBackupSize: 1024 * 100, // 100KB minimum
    maxBackupSize: 1024 * 1024 * 1024 * 50, // 50GB maximum
    maxDuration: 60 * 60 * 1000, // 1 hour
  };

  constructor(private notificationWebhook?: string) {}

  /**
   * Register a new backup job
   */
  async registerJob(type: BackupType, metadata?: Record<string, any>): Promise<string> {
    const jobId = `backup_${type}_${Date.now()}`;
    const job: BackupJob = {
      id: jobId,
      type,
      status: BackupStatus.PENDING,
      startedAt: new Date(),
      metadata,
    };

    this.jobs.set(jobId, job);
    console.log(`[BackupMonitor] Registered job: ${jobId}`);

    return jobId;
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: BackupStatus,
    data?: {
      sizeBytes?: number;
      error?: string;
    }
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = status;

    if (status === BackupStatus.COMPLETED || status === BackupStatus.FAILED) {
      job.completedAt = new Date();
      job.duration = job.completedAt.getTime() - job.startedAt.getTime();
    }

    if (data?.sizeBytes) {
      job.sizeBytes = data.sizeBytes;
    }

    if (data?.error) {
      job.error = data.error;
    }

    this.jobs.set(jobId, job);

    // Check for anomalies
    await this.checkAnomalies(job);

    console.log(`[BackupMonitor] Updated job ${jobId}: ${status}`);
  }

  /**
   * Check for backup anomalies
   */
  private async checkAnomalies(job: BackupJob): Promise<void> {
    const alerts: string[] = [];

    // Check backup size
    if (job.sizeBytes) {
      if (job.sizeBytes < this.alertThresholds.minBackupSize) {
        alerts.push(`Backup size too small: ${this.formatBytes(job.sizeBytes)}`);
      }
      if (job.sizeBytes > this.alertThresholds.maxBackupSize) {
        alerts.push(`Backup size unusually large: ${this.formatBytes(job.sizeBytes)}`);
      }
    }

    // Check backup duration
    if (job.duration && job.duration > this.alertThresholds.maxDuration) {
      alerts.push(`Backup took too long: ${this.formatDuration(job.duration)}`);
    }

    // Check failure status
    if (job.status === BackupStatus.FAILED) {
      alerts.push(`Backup failed: ${job.error || 'Unknown error'}`);
    }

    // Send alerts if any
    if (alerts.length > 0) {
      await this.sendAlert('warning', job.id, alerts);
    }
  }

  /**
   * Get backup metrics
   */
  async getMetrics(timeRange?: { start: Date; end: Date }): Promise<BackupMetrics> {
    let jobs = Array.from(this.jobs.values());

    // Filter by time range if provided
    if (timeRange) {
      jobs = jobs.filter(
        (job) =>
          job.startedAt >= timeRange.start &&
          job.startedAt <= timeRange.end
      );
    }

    const totalBackups = jobs.length;
    const successfulBackups = jobs.filter(
      (job) => job.status === BackupStatus.COMPLETED
    ).length;
    const failedBackups = jobs.filter(
      (job) => job.status === BackupStatus.FAILED
    ).length;

    const completedJobs = jobs.filter((job) => job.status === BackupStatus.COMPLETED);
    const averageSize =
      completedJobs.reduce((sum, job) => sum + (job.sizeBytes || 0), 0) /
      (completedJobs.length || 1);

    const averageDuration =
      completedJobs.reduce((sum, job) => sum + (job.duration || 0), 0) /
      (completedJobs.length || 1);

    const lastBackup = jobs.reduce((latest, job) =>
      job.startedAt > latest.startedAt ? job : latest
    );

    const successRate = totalBackups > 0 ? successfulBackups / totalBackups : 0;

    return {
      totalBackups,
      successfulBackups,
      failedBackups,
      averageSize,
      averageDuration,
      lastBackupAt: lastBackup.startedAt,
      successRate,
    };
  }

  /**
   * Check backup health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: BackupMetrics;
  }> {
    const metrics = await this.getMetrics();
    const issues: string[] = [];

    // Check if backups are running
    const lastBackupAge = Date.now() - metrics.lastBackupAt.getTime();
    if (lastBackupAge > this.alertThresholds.maxBackupAge) {
      issues.push(
        `No backup in last ${this.formatDuration(this.alertThresholds.maxBackupAge)}`
      );
    }

    // Check failure rate
    if (metrics.successRate < 1 - this.alertThresholds.maxFailureRate) {
      issues.push(
        `High failure rate: ${((1 - metrics.successRate) * 100).toFixed(1)}%`
      );
    }

    // Check recent failures
    const recentJobs = Array.from(this.jobs.values())
      .filter((job) => Date.now() - job.startedAt.getTime() < 24 * 60 * 60 * 1000)
      .filter((job) => job.status === BackupStatus.FAILED);

    if (recentJobs.length > 3) {
      issues.push(`Multiple recent failures: ${recentJobs.length} in last 24h`);
    }

    const healthy = issues.length === 0;

    if (!healthy) {
      await this.sendAlert('critical', 'health-check', issues);
    }

    return {
      healthy,
      issues,
      metrics,
    };
  }

  /**
   * Send alert notification
   */
  private async sendAlert(
    severity: 'info' | 'warning' | 'critical',
    context: string,
    messages: string[]
  ): Promise<void> {
    const alert = {
      severity,
      context,
      messages,
      timestamp: new Date().toISOString(),
    };

    console.log(`[BackupMonitor] ALERT [${severity.toUpperCase()}]:`, alert);

    if (this.notificationWebhook) {
      try {
        await fetch(this.notificationWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      } catch (error) {
        console.error('[BackupMonitor] Failed to send alert:', error);
      }
    }
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Format duration to human readable
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get backup inventory
   */
  async getInventory(): Promise<BackupJob[]> {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
    );
  }

  /**
   * Cleanup old job records
   */
  async cleanup(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = Date.now() - maxAge;
    let deleted = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.startedAt.getTime() < cutoffDate) {
        this.jobs.delete(jobId);
        deleted++;
      }
    }

    console.log(`[BackupMonitor] Cleaned up ${deleted} old job records`);
    return deleted;
  }
}

/**
 * S3 Lifecycle Policy Manager
 */
export class S3LifecycleManager {
  /**
   * Generate S3 lifecycle policy for backups
   */
  static generateLifecyclePolicy() {
    return {
      Rules: [
        {
          Id: 'backup-retention-policy',
          Status: 'Enabled',
          Prefix: 'backups/',
          Transitions: [
            {
              Days: 30,
              StorageClass: 'STANDARD_IA',
            },
            {
              Days: 90,
              StorageClass: 'GLACIER',
            },
            {
              Days: 365,
              StorageClass: 'DEEP_ARCHIVE',
            },
          ],
          Expiration: {
            Days: 730, // 2 years
          },
        },
        {
          Id: 'incremental-backup-cleanup',
          Status: 'Enabled',
          Prefix: 'backups/database/incremental/',
          Expiration: {
            Days: 7,
          },
        },
        {
          Id: 'monthly-backup-retention',
          Status: 'Enabled',
          Prefix: 'backups/database/monthly/',
          Transitions: [
            {
              Days: 0,
              StorageClass: 'GLACIER',
            },
          ],
          Expiration: {
            Days: 2555, // 7 years for compliance
          },
        },
      ],
    };
  }

  /**
   * Apply lifecycle policy to S3 bucket
   */
  static async applyLifecyclePolicy(bucketName: string): Promise<void> {
    const policy = this.generateLifecyclePolicy();

    // This would use AWS SDK to apply the policy
    console.log('S3 Lifecycle Policy:', JSON.stringify(policy, null, 2));
    console.log(`Apply to bucket: ${bucketName}`);

    // Example implementation:
    // const s3 = new AWS.S3();
    // await s3.putBucketLifecycleConfiguration({
    //   Bucket: bucketName,
    //   LifecycleConfiguration: policy,
    // }).promise();
  }
}

// Singleton instance
export const backupMonitor = new BackupMonitor(
  process.env.BACKUP_NOTIFICATION_WEBHOOK
);
