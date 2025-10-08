import db from '../db/connection';
import crypto from 'crypto';

export class WebhookManager {
  /**
   * Dispara webhook para eventos
   */
  async trigger(
    eventType: string,
    payload: any,
    organizationId: number
  ): Promise<void> {
    // Buscar webhooks ativos para este evento
    const webhooks = db.prepare(`
      SELECT * FROM webhooks
      WHERE is_active = 1
        AND (
          integration_id IS NULL
          OR integration_id IN (
            SELECT id FROM integrations
            WHERE organization_id = ? AND is_active = 1
          )
        )
        AND event_types LIKE ?
    `).all(organizationId, `%${eventType}%`) as any[];

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
    const deliveryId = this.createDelivery(webhook.id, eventType, payload);
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

      this.updateDelivery(deliveryId, {
        success: response.ok,
        response_status: response.status,
        response_body: responseBody.substring(0, 1000),
        delivery_time_ms: deliveryTime
      });

      // Atualizar contadores
      this.updateWebhookStats(webhook.id, response.ok);

    } catch (error: any) {
      const deliveryTime = Date.now() - startTime;

      this.updateDelivery(deliveryId, {
        success: false,
        error_message: error.message,
        delivery_time_ms: deliveryTime
      });

      this.updateWebhookStats(webhook.id, false);

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
  private createDelivery(webhookId: number, eventType: string, payload: any): number {
    const result = db.prepare(`
      INSERT INTO webhook_deliveries (
        webhook_id, event_type, payload
      ) VALUES (?, ?, ?)
    `).run(webhookId, eventType, JSON.stringify(payload));

    return result.lastInsertRowid as number;
  }

  /**
   * Atualiza registro de entrega
   */
  private updateDelivery(id: number, data: any): void {
    db.prepare(`
      UPDATE webhook_deliveries
      SET success = ?,
          response_status = ?,
          response_body = ?,
          delivery_time_ms = ?,
          error_message = ?
      WHERE id = ?
    `).run(
      data.success ? 1 : 0,
      data.response_status || null,
      data.response_body || null,
      data.delivery_time_ms || null,
      data.error_message || null,
      id
    );
  }

  /**
   * Atualiza estatísticas do webhook
   */
  private updateWebhookStats(webhookId: number, success: boolean): void {
    if (success) {
      db.prepare(`
        UPDATE webhooks
        SET success_count = success_count + 1,
            last_triggered_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(webhookId);
    } else {
      db.prepare(`
        UPDATE webhooks
        SET failure_count = failure_count + 1
        WHERE id = ?
      `).run(webhookId);
    }
  }

  /**
   * Agenda retry
   */
  private async scheduleRetry(deliveryId: number, webhook: any): Promise<void> {
    // Incrementar retry counter
    db.prepare(`
      UPDATE webhook_deliveries
      SET retry_count = retry_count + 1,
          next_retry_at = datetime('now', '+5 minutes')
      WHERE id = ?
    `).run(deliveryId);

    // TODO: Implementar queue system para retries
  }
}

export const webhookManager = new WebhookManager();
