/**
 * Monitor Bridge — Self-Healing Module
 *
 * Receives alerts from monitoring tools (Sentry, Datadog, Prometheus, Grafana, custom),
 * normalizes them into a unified format, and deduplicates within a 15-minute window.
 */

import { logger, EventType, LogLevel } from '@/lib/monitoring/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertSource = 'sentry' | 'datadog' | 'prometheus' | 'grafana' | 'custom';
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface MonitoringAlert {
  source: AlertSource;
  severity: AlertSeverity;
  title: string;
  description: string;
  service?: string;
  metric_name?: string;
  threshold?: number;
  current_value?: number;
  tags?: Record<string, string>;
  raw_payload?: unknown;
}

export interface NormalizedAlert {
  id: string;
  source: AlertSource;
  severity: AlertSeverity;
  title: string;
  description: string;
  service: string;
  metric_name: string | null;
  threshold: number | null;
  current_value: number | null;
  tags: Record<string, string>;
  timestamp: string;
  fingerprint: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface BridgeResult {
  success: boolean;
  deduplicated: boolean;
  alert: NormalizedAlert | null;
  message: string;
}

// ─── Dedup Entry ─────────────────────────────────────────────────────────────

interface DedupEntry {
  fingerprint: string;
  timestamp: number;
  count: number;
}

// ─── Severity → Priority mapping ─────────────────────────────────────────────

const SEVERITY_PRIORITY_MAP: Record<AlertSeverity, NormalizedAlert['priority']> = {
  info: 'low',
  warning: 'medium',
  error: 'high',
  critical: 'critical',
};

// ─── MonitorBridge ───────────────────────────────────────────────────────────

const DEDUP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEDUP_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // cleanup every 5 min

export class MonitorBridge {
  private dedupMap = new Map<string, DedupEntry>();
  private lastCleanup = Date.now();

  /**
   * Process an incoming monitoring alert.
   * Normalizes format and deduplicates within a 15-minute window.
   */
  async processAlert(orgId: number, alert: MonitoringAlert): Promise<BridgeResult> {
    try {
      // 1. Normalize
      const normalized = this.normalize(orgId, alert);

      // 2. Cleanup stale dedup entries periodically
      this.cleanupDedupMap();

      // 3. Check dedup
      const existing = this.dedupMap.get(normalized.fingerprint);
      if (existing && Date.now() - existing.timestamp < DEDUP_WINDOW_MS) {
        existing.count += 1;
        logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Alert deduplicated (count: ${existing.count}): ${normalized.title}`, { orgId, fingerprint: normalized.fingerprint, count: existing.count });
        return {
          success: true,
          deduplicated: true,
          alert: null,
          message: `Alerta duplicado ignorado (${existing.count} ocorrências em 15min)`,
        };
      }

      // 4. Store for dedup
      this.dedupMap.set(normalized.fingerprint, {
        fingerprint: normalized.fingerprint,
        timestamp: Date.now(),
        count: 1,
      });

      logger.log(LogLevel.INFO, EventType.SYSTEM, `[Self-Healing] Alert processed: ${normalized.title}`, { orgId, source: normalized.source, severity: normalized.severity, service: normalized.service });

      return {
        success: true,
        deduplicated: false,
        alert: normalized,
        message: 'Alerta processado com sucesso',
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.log(LogLevel.ERROR, EventType.ERROR, `[Self-Healing] Error processing alert: ${errMsg}`, { orgId, alert });
      return {
        success: false,
        deduplicated: false,
        alert: null,
        message: `Erro ao processar alerta: ${errMsg}`,
      };
    }
  }

  /**
   * Normalize an alert from any supported source into a unified format.
   */
  private normalize(orgId: number, alert: MonitoringAlert): NormalizedAlert {
    const now = new Date().toISOString();
    const service = alert.service || this.extractServiceFromAlert(alert);
    const fingerprint = this.generateFingerprint(orgId, alert, service);

    return {
      id: `alert-${orgId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: alert.source,
      severity: alert.severity,
      title: alert.title.trim(),
      description: alert.description.trim(),
      service,
      metric_name: alert.metric_name || null,
      threshold: alert.threshold ?? null,
      current_value: alert.current_value ?? null,
      tags: alert.tags || {},
      timestamp: now,
      fingerprint,
      priority: SEVERITY_PRIORITY_MAP[alert.severity],
    };
  }

  /**
   * Extract service name from alert metadata/tags if not explicitly provided.
   */
  private extractServiceFromAlert(alert: MonitoringAlert): string {
    if (alert.tags?.service) return alert.tags.service;
    if (alert.tags?.host) return alert.tags.host;
    if (alert.tags?.app) return alert.tags.app;

    // Try extracting from raw payload for known sources
    if (alert.source === 'sentry' && alert.raw_payload) {
      const payload = alert.raw_payload as Record<string, unknown>;
      if (typeof payload.project === 'string') return payload.project;
    }

    if (alert.source === 'datadog' && alert.raw_payload) {
      const payload = alert.raw_payload as Record<string, unknown>;
      if (typeof payload.hostname === 'string') return payload.hostname;
    }

    return 'unknown';
  }

  /**
   * Generate a dedup fingerprint based on org, source, service, and title.
   */
  private generateFingerprint(orgId: number, alert: MonitoringAlert, service: string): string {
    const parts = [
      orgId.toString(),
      alert.source,
      service,
      alert.severity,
      alert.title.toLowerCase().replace(/\s+/g, '_'),
      alert.metric_name || '',
    ];
    return parts.join(':');
  }

  /**
   * Cleanup expired dedup entries.
   */
  private cleanupDedupMap(): void {
    const now = Date.now();
    if (now - this.lastCleanup < DEDUP_CLEANUP_INTERVAL_MS) return;

    this.lastCleanup = now;
    for (const [key, entry] of this.dedupMap) {
      if (now - entry.timestamp > DEDUP_WINDOW_MS) {
        this.dedupMap.delete(key);
      }
    }
  }

  /**
   * Parse a Sentry webhook payload into a MonitoringAlert.
   */
  static parseSentryPayload(payload: Record<string, unknown>): MonitoringAlert {
    const data = (payload.data || payload) as Record<string, unknown>;
    const event = (data.event || data) as Record<string, unknown>;
    const level = (event.level as string) || 'error';

    const severityMap: Record<string, AlertSeverity> = {
      fatal: 'critical',
      error: 'error',
      warning: 'warning',
      info: 'info',
    };

    return {
      source: 'sentry',
      severity: severityMap[level] || 'error',
      title: (event.title as string) || (event.message as string) || 'Sentry Alert',
      description: (event.culprit as string) || (event.message as string) || '',
      service: (event.project as string) || undefined,
      tags: (event.tags as Record<string, string>) || {},
      raw_payload: payload,
    };
  }

  /**
   * Parse a Datadog webhook payload into a MonitoringAlert.
   */
  static parseDatadogPayload(payload: Record<string, unknown>): MonitoringAlert {
    const alertType = (payload.alert_type as string) || 'error';

    const severityMap: Record<string, AlertSeverity> = {
      error: 'critical',
      warning: 'warning',
      info: 'info',
      success: 'info',
    };

    return {
      source: 'datadog',
      severity: severityMap[alertType] || 'error',
      title: (payload.title as string) || 'Datadog Alert',
      description: (payload.body as string) || (payload.text as string) || '',
      service: (payload.hostname as string) || undefined,
      metric_name: (payload.metric as string) || undefined,
      threshold: typeof payload.threshold === 'number' ? payload.threshold : undefined,
      current_value: typeof payload.value === 'number' ? payload.value : undefined,
      tags: this.parseDatadogTags(payload.tags),
      raw_payload: payload,
    };
  }

  /**
   * Parse a Prometheus/Alertmanager payload into a MonitoringAlert.
   */
  static parsePrometheusPayload(payload: Record<string, unknown>): MonitoringAlert {
    const alerts = (payload.alerts as Array<Record<string, unknown>>) || [];
    const firstAlert = alerts[0] || payload;

    const labels = (firstAlert.labels || {}) as Record<string, string>;
    const annotations = (firstAlert.annotations || {}) as Record<string, string>;
    const status = (firstAlert.status as string) || 'firing';

    const severityMap: Record<string, AlertSeverity> = {
      critical: 'critical',
      error: 'error',
      warning: 'warning',
      info: 'info',
    };

    return {
      source: 'prometheus',
      severity: severityMap[labels.severity || ''] || (status === 'firing' ? 'error' : 'info'),
      title: labels.alertname || annotations.summary || 'Prometheus Alert',
      description: annotations.description || annotations.summary || '',
      service: labels.instance || labels.job || labels.service || undefined,
      metric_name: labels.alertname || undefined,
      tags: labels,
      raw_payload: payload,
    };
  }

  /**
   * Parse Datadog tags from string array format "key:value".
   */
  private static parseDatadogTags(tags: unknown): Record<string, string> {
    if (!Array.isArray(tags)) return {};
    const result: Record<string, string> = {};
    for (const tag of tags) {
      if (typeof tag === 'string') {
        const [key, ...rest] = tag.split(':');
        if (key) result[key] = rest.join(':') || 'true';
      }
    }
    return result;
  }
}
