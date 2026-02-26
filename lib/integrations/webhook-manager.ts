import { executeQuery, executeRun } from '../db/adapter';
import { sqlNow } from '../db/adapter';
import crypto from 'crypto';
import logger from '../monitoring/structured-logger';

export class WebhookManager {
  /**
   * Verifies incoming webhook signature
   * Uses timing-safe comparison to prevent timing attacks
   */
  static verifyIncomingSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // Handle null/undefined inputs
      if (!payload || !signature || !secret) {
        return false;
      }

      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Ensure both signatures have the same length before comparison
      // This prevents timing attack and RangeError
      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Error verifying webhook signature', { error: String(error) });
      return false;
    }
  }

  /**
   * Dispara webhook para eventos
   */
  async trigger(
    eventType: string,
    payload: any,
    organizationId: number
  ): Promise<void> {
    // Buscar webhooks ativos para este evento
    const webhooks = await executeQuery<any>(
      `SELECT * FROM webhooks
       WHERE is_active = 1
         AND (
           integration_id IS NULL
           OR integration_id IN (
             SELECT id FROM integrations
             WHERE organization_id = ? AND is_active = 1
           )
         )
         AND event_types LIKE ?`,
      [organizationId, `%${eventType}%`]
    );

    for (const webhook of webhooks) {
      await this.deliver(webhook, eventType, payload);
    }
  }

  /**
   * Envia webhook
   */
  private async deliver(
    webhook: any,
    eventType: string,
    payload: any
  ): Promise<void> {
    const deliveryId = await this.createDelivery(webhook.id, eventType, payload);
    const startTime = Date.now();

    try {
      const headers = JSON.parse(webhook.headers || '{}');

      // Adicionar signature se tiver secret
      if (webhook.secret_token) {
        const signature = this.generateSignature(payload, webhook.secret_token);
        headers['X-Webhook-Signature'] = signature;
      }

      headers['Content-Type'] = 'application/json';
      headers['X-Event-Type'] = eventType;

      const response = await fetch(webhook.url, {
        method: webhook.method || 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(webhook.timeout_seconds * 1000 || 30000)
      });

      const responseBody = await response.text();
      const deliveryTime = Date.now() - startTime;

      await this.updateDelivery(deliveryId, {
        success: response.ok,
        response_status: response.status,
        response_body: responseBody.substring(0, 1000),
        delivery_time_ms: deliveryTime
      });

      // Atualizar contadores
      await this.updateWebhookStats(webhook.id, response.ok);

    } catch (error: any) {
      const deliveryTime = Date.now() - startTime;

      await this.updateDelivery(deliveryId, {
        success: false,
        error_message: error.message,
        delivery_time_ms: deliveryTime
      });

      await this.updateWebhookStats(webhook.id, false);

      // Retry se configurado
      if (webhook.retry_count > 0) {
        await this.scheduleRetry(deliveryId, webhook);
      }
    }
  }

  /**
   * Gera signature HMAC
   */
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Cria registro de entrega
   */
  private async createDelivery(webhookId: number, eventType: string, payload: any): Promise<number> {
    const result = await executeRun(
      `INSERT INTO webhook_deliveries (
        webhook_id, event_type, payload
      ) VALUES (?, ?, ?)`,
      [webhookId, eventType, JSON.stringify(payload)]
    );

    return result.lastInsertRowid!;
  }

  /**
   * Atualiza registro de entrega
   */
  private async updateDelivery(id: number, data: any): Promise<void> {
    await executeRun(
      `UPDATE webhook_deliveries
       SET success = ?,
           response_status = ?,
           response_body = ?,
           delivery_time_ms = ?,
           error_message = ?
       WHERE id = ?`,
      [
        data.success ? 1 : 0,
        data.response_status || null,
        data.response_body || null,
        data.delivery_time_ms || null,
        data.error_message || null,
        id
      ]
    );
  }

  /**
   * Atualiza estatísticas do webhook
   */
  private async updateWebhookStats(webhookId: number, success: boolean): Promise<void> {
    if (success) {
      await executeRun(
        `UPDATE webhooks
         SET success_count = success_count + 1,
             last_triggered_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [webhookId]
      );
    } else {
      await executeRun(
        `UPDATE webhooks
         SET failure_count = failure_count + 1
         WHERE id = ?`,
        [webhookId]
      );
    }
  }

  /**
   * Agenda retry
   */
  private async scheduleRetry(deliveryId: number, _webhook: any): Promise<void> {
    // Incrementar retry counter
    await executeRun(
      `UPDATE webhook_deliveries
       SET retry_count = retry_count + 1,
           next_retry_at = ${sqlNow()}
       WHERE id = ?`,
      [deliveryId]
    );

    // TODO: Implementar queue system para retries
  }
}

export const webhookManager = new WebhookManager();
