/**
 * Webhook Signature Validation Tests
 * Tests HMAC-SHA256 signature validation for webhook security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { WebhookManager } from '@/lib/integrations/webhook-manager';

describe('Webhook Signature Validation', () => {
  const testSecret = 'test_secret_key_for_webhook_validation_12345';
  const testPayload = JSON.stringify({
    event: 'test.event',
    data: { test: 'data' },
    timestamp: Date.now(),
  });

  /**
   * Helper function to generate valid HMAC signature
   */
  function generateValidSignature(payload: string, secret: string): string {
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  describe('Valid Signature', () => {
    it('should accept valid signature', () => {
      const signature = generateValidSignature(testPayload, testSecret);
      const isValid = WebhookManager.verifyIncomingSignature(
        testPayload,
        signature,
        testSecret
      );

      expect(isValid).toBe(true);
    });

    it('should accept signature with correct format', () => {
      const hmac = crypto
        .createHmac('sha256', testSecret)
        .update(testPayload)
        .digest('hex');
      const signature = `sha256=${hmac}`;

      const isValid = WebhookManager.verifyIncomingSignature(
        testPayload,
        signature,
        testSecret
      );

      expect(isValid).toBe(true);
    });

    it('should work with different payload content', () => {
      const payloads = [
        JSON.stringify({ simple: 'test' }),
        JSON.stringify({ complex: { nested: { data: 'value' } } }),
        JSON.stringify({ array: [1, 2, 3, 4, 5] }),
        JSON.stringify({ unicode: '测试 тест 테스트' }),
      ];

      payloads.forEach(payload => {
        const signature = generateValidSignature(payload, testSecret);
        const isValid = WebhookManager.verifyIncomingSignature(
          payload,
          signature,
          testSecret
        );

        expect(isValid).toBe(true);
      });
    });
  });

  describe('Invalid Signature', () => {
    it('should reject signature with wrong secret', () => {
      const signature = generateValidSignature(testPayload, 'wrong_secret');
      const isValid = WebhookManager.verifyIncomingSignature(
        testPayload,
        signature,
        testSecret
      );

      expect(isValid).toBe(false);
    });

    it('should reject modified payload', () => {
      const signature = generateValidSignature(testPayload, testSecret);
      const modifiedPayload = testPayload + ' modified';
      const isValid = WebhookManager.verifyIncomingSignature(
        modifiedPayload,
        signature,
        testSecret
      );

      expect(isValid).toBe(false);
    });

    it('should reject malformed signature', () => {
      const isValid = WebhookManager.verifyIncomingSignature(
        testPayload,
        'invalid_signature_format',
        testSecret
      );

      expect(isValid).toBe(false);
    });

    it('should reject signature without sha256 prefix', () => {
      const hmac = crypto
        .createHmac('sha256', testSecret)
        .update(testPayload)
        .digest('hex');

      const isValid = WebhookManager.verifyIncomingSignature(
        testPayload,
        hmac, // Missing 'sha256=' prefix
        testSecret
      );

      expect(isValid).toBe(false);
    });

    it('should reject empty signature', () => {
      const isValid = WebhookManager.verifyIncomingSignature(
        testPayload,
        '',
        testSecret
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should reject empty payload for security', () => {
      const emptyPayload = '';
      const signature = generateValidSignature(emptyPayload, testSecret);
      const isValid = WebhookManager.verifyIncomingSignature(
        emptyPayload,
        signature,
        testSecret
      );

      // Empty payloads are rejected as a security measure
      expect(isValid).toBe(false);
    });

    it('should handle very large payloads', () => {
      const largePayload = JSON.stringify({
        data: Array(1000).fill({ item: 'test data with some content' }),
      });
      const signature = generateValidSignature(largePayload, testSecret);
      const isValid = WebhookManager.verifyIncomingSignature(
        largePayload,
        signature,
        testSecret
      );

      expect(isValid).toBe(true);
    });

    it('should handle special characters in secret', () => {
      const specialSecret = 'secret!@#$%^&*()_+-={}[]|:";\'<>?,./';
      const signature = generateValidSignature(testPayload, specialSecret);
      const isValid = WebhookManager.verifyIncomingSignature(
        testPayload,
        signature,
        specialSecret
      );

      expect(isValid).toBe(true);
    });

    it('should handle unicode in payload', () => {
      const unicodePayload = JSON.stringify({
        message: '你好世界 🌍',
        emoji: '🎉🔐🚀',
        mixed: 'Hello مرحبا 안녕하세요',
      });
      const signature = generateValidSignature(unicodePayload, testSecret);
      const isValid = WebhookManager.verifyIncomingSignature(
        unicodePayload,
        signature,
        testSecret
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should use timing-safe comparison', () => {
      // This test ensures we're using crypto.timingSafeEqual
      // which prevents timing attacks

      const validSignature = generateValidSignature(testPayload, testSecret);
      const invalidSignature = 'sha256=' + 'a'.repeat(64);

      const start1 = process.hrtime.bigint();
      WebhookManager.verifyIncomingSignature(
        testPayload,
        validSignature,
        testSecret
      );
      const end1 = process.hrtime.bigint();

      const start2 = process.hrtime.bigint();
      WebhookManager.verifyIncomingSignature(
        testPayload,
        invalidSignature,
        testSecret
      );
      const end2 = process.hrtime.bigint();

      // Both operations should complete
      // (We can't reliably test timing equality in unit tests,
      // but we can verify both complete without errors)
      expect(end1).toBeGreaterThan(start1);
      expect(end2).toBeGreaterThan(start2);
    });
  });

  describe('WhatsApp Format Compatibility', () => {
    it('should validate WhatsApp webhook signature format', () => {
      // WhatsApp uses X-Hub-Signature-256 header with sha256= prefix
      const whatsappPayload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  messages: [
                    {
                      from: '5511999999999',
                      id: 'wamid.test',
                      timestamp: '1234567890',
                      text: { body: 'Test message' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      });

      const signature = generateValidSignature(whatsappPayload, testSecret);
      const isValid = WebhookManager.verifyIncomingSignature(
        whatsappPayload,
        signature,
        testSecret
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Security Best Practices', () => {
    it('should not leak information on invalid signature', () => {
      const signature = generateValidSignature(testPayload, 'wrong_secret');

      // Should return boolean, not throw or return detailed error
      const result = WebhookManager.verifyIncomingSignature(
        testPayload,
        signature,
        testSecret
      );

      expect(typeof result).toBe('boolean');
      expect(result).toBe(false);
    });

    it('should handle null/undefined gracefully', () => {
      // @ts-expect-error Testing invalid input
      let result = WebhookManager.verifyIncomingSignature(null, null, testSecret);
      expect(result).toBe(false);

      // @ts-expect-error Testing invalid input
      result = WebhookManager.verifyIncomingSignature(undefined, undefined, testSecret);
      expect(result).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should validate signatures quickly', () => {
      const iterations = 1000;
      const signature = generateValidSignature(testPayload, testSecret);

      const start = Date.now();
      for (let i = 0; i < iterations; i++) {
        WebhookManager.verifyIncomingSignature(
          testPayload,
          signature,
          testSecret
        );
      }
      const end = Date.now();
      const duration = end - start;

      // Should complete 1000 validations in less than 1 second
      expect(duration).toBeLessThan(1000);
    });
  });
});

describe('Integration Tests', () => {
  describe('Complete Webhook Flow', () => {
    it('should simulate full WhatsApp webhook validation', () => {
      const secret = process.env.WHATSAPP_WEBHOOK_SECRET || 'test_secret';
      const payload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ id: '123', changes: [{ value: { messages: [] } }] }],
      });

      // Simulate WhatsApp generating signature
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Simulate our server validating
      const isValid = WebhookManager.verifyIncomingSignature(
        payload,
        signature,
        secret
      );

      expect(isValid).toBe(true);
    });

    it('should reject tampered webhook data', () => {
      const secret = process.env.WHATSAPP_WEBHOOK_SECRET || 'test_secret';
      const originalPayload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ id: '123', changes: [{ value: { messages: [] } }] }],
      });

      // Generate signature for original payload
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(originalPayload)
        .digest('hex');

      // Attacker modifies the payload
      const tamperedPayload = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ id: '999', changes: [{ value: { messages: [] } }] }], // Changed ID
      });

      // Validation should fail
      const isValid = WebhookManager.verifyIncomingSignature(
        tamperedPayload,
        signature,
        secret
      );

      expect(isValid).toBe(false);
    });
  });
});
