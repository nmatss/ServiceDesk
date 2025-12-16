/**
 * Webhook Security - Exemplos de Uso
 * Demonstra como implementar validação de assinatura HMAC em webhooks
 */

import crypto from 'crypto';
import { WebhookManager } from '@/lib/integrations/webhook-manager';

// ============================================
// Exemplo 1: Validação Básica de Webhook
// ============================================

/**
 * Valida uma requisição webhook recebida
 */
export async function validateIncomingWebhook(
  request: Request
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Extrair assinatura do header
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      return { valid: false, error: 'Missing signature header' };
    }

    // Obter o secret do ambiente
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!secret) {
      return { valid: false, error: 'Webhook secret not configured' };
    }

    // Ler o body da requisição
    const rawBody = await request.text();

    // Validar assinatura
    const isValid = WebhookManager.verifyIncomingSignature(
      rawBody,
      signature,
      secret
    );

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Exemplo 2: Geração de Assinatura (para Testes)
// ============================================

/**
 * Gera uma assinatura HMAC-SHA256 para um payload
 * Útil para testes e simulações
 */
export function generateWebhookSignature(
  payload: string | object,
  secret: string
): string {
  const payloadString = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload);

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  return `sha256=${hmac}`;
}

// ============================================
// Exemplo 3: Teste de Webhook Simulado
// ============================================

/**
 * Simula uma requisição webhook do WhatsApp
 */
export async function simulateWhatsAppWebhook(
  url: string,
  payload: object,
  secret: string
): Promise<Response> {
  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, secret);

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
    },
    body: payloadString,
  });
}

// ============================================
// Exemplo 4: Validação com Logging
// ============================================

/**
 * Valida webhook com logging detalhado
 */
export async function validateWebhookWithLogging(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  console.log('[Webhook] Validating signature...');
  console.log('[Webhook] Payload length:', rawBody.length);
  console.log('[Webhook] Signature:', signature);

  const isValid = WebhookManager.verifyIncomingSignature(
    rawBody,
    signature,
    secret
  );

  if (isValid) {
    console.log('[Webhook] ✓ Signature valid');
  } else {
    console.log('[Webhook] ✗ Invalid signature - rejecting request');
  }

  return isValid;
}

// ============================================
// Exemplo 5: Middleware de Validação
// ============================================

/**
 * Middleware para validar webhooks em rotas Next.js
 */
export function createWebhookValidationMiddleware(secretKey: string) {
  return async function validateWebhook(
    request: Request,
    handler: (body: any) => Promise<Response>
  ): Promise<Response> {
    try {
      // Verificar assinatura
      const signature = request.headers.get('x-hub-signature-256');
      if (!signature) {
        return new Response(
          JSON.stringify({ error: 'Missing signature' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const rawBody = await request.text();
      const isValid = WebhookManager.verifyIncomingSignature(
        rawBody,
        signature,
        secretKey
      );

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Processar webhook
      const body = JSON.parse(rawBody);
      return handler(body);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

// ============================================
// Exemplo 6: Payload de Webhook do WhatsApp
// ============================================

/**
 * Exemplo de payload de mensagem do WhatsApp
 */
export const whatsappMessagePayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '5511999999999',
              phone_number_id: '123456789',
            },
            contacts: [
              {
                profile: {
                  name: 'João Silva',
                },
                wa_id: '5511888888888',
              },
            ],
            messages: [
              {
                from: '5511888888888',
                id: 'wamid.ABC123',
                timestamp: '1234567890',
                type: 'text',
                text: {
                  body: 'Olá, preciso de ajuda!',
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

/**
 * Exemplo de payload de status do WhatsApp
 */
export const whatsappStatusPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '5511999999999',
              phone_number_id: '123456789',
            },
            statuses: [
              {
                id: 'wamid.ABC123',
                status: 'delivered',
                timestamp: '1234567890',
                recipient_id: '5511888888888',
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

// ============================================
// Exemplo 7: Teste de Integração Completo
// ============================================

/**
 * Testa o fluxo completo de webhook
 */
export async function testWebhookFlow() {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET || 'test_secret';
  const webhookUrl = 'http://localhost:3000/api/integrations/whatsapp/webhook';

  console.log('🔐 Testando fluxo de webhook seguro...\n');

  // Teste 1: Mensagem válida
  console.log('📝 Teste 1: Enviando mensagem válida');
  try {
    const response = await simulateWhatsAppWebhook(
      webhookUrl,
      whatsappMessagePayload,
      secret
    );
    console.log(`   Status: ${response.status}`);
    console.log(`   Resultado: ${response.ok ? '✓ Sucesso' : '✗ Falhou'}\n`);
  } catch (error) {
    console.log(`   Erro: ${error}\n`);
  }

  // Teste 2: Assinatura inválida
  console.log('🔒 Teste 2: Testando assinatura inválida');
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=invalid_signature',
      },
      body: JSON.stringify(whatsappMessagePayload),
    });
    console.log(`   Status: ${response.status}`);
    console.log(`   Resultado: ${response.status === 401 ? '✓ Rejeitado corretamente' : '✗ Não rejeitou'}\n`);
  } catch (error) {
    console.log(`   Erro: ${error}\n`);
  }

  // Teste 3: Sem assinatura
  console.log('⚠️  Teste 3: Testando requisição sem assinatura');
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whatsappMessagePayload),
    });
    console.log(`   Status: ${response.status}`);
    console.log(`   Resultado: ${response.status >= 400 ? '✓ Rejeitado' : '⚠️ Aceito com aviso'}\n`);
  } catch (error) {
    console.log(`   Erro: ${error}\n`);
  }

  console.log('✅ Testes concluídos!');
}

// ============================================
// Exemplo 8: Verificação de Configuração
// ============================================

/**
 * Verifica se a configuração de webhook está correta
 */
export function checkWebhookConfiguration(): {
  configured: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Verificar secret do WhatsApp
  if (!process.env.WHATSAPP_WEBHOOK_SECRET) {
    issues.push('WHATSAPP_WEBHOOK_SECRET não configurado');
  } else if (process.env.WHATSAPP_WEBHOOK_SECRET.length < 32) {
    issues.push('WHATSAPP_WEBHOOK_SECRET muito curto (mínimo 32 caracteres)');
  }

  // Verificar verify token
  if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    issues.push('WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado');
  }

  // Verificar outras configurações do WhatsApp
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
    issues.push('WHATSAPP_PHONE_NUMBER_ID não configurado');
  }

  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    issues.push('WHATSAPP_ACCESS_TOKEN não configurado');
  }

  return {
    configured: issues.length === 0,
    issues,
  };
}

// ============================================
// Exemplo 9: Rotação de Secret
// ============================================

/**
 * Auxilia na rotação do webhook secret
 */
export function rotateWebhookSecret(): {
  newSecret: string;
  instructions: string[];
} {
  // Gerar novo secret
  const newSecret = crypto.randomBytes(32).toString('hex');

  const instructions = [
    '1. Copie o novo secret abaixo:',
    `   WHATSAPP_WEBHOOK_SECRET=${newSecret}`,
    '',
    '2. Atualize o .env no servidor:',
    '   - Em produção, use o painel de configuração',
    '   - Em desenvolvimento, edite o arquivo .env.local',
    '',
    '3. Atualize a configuração no Meta for Developers:',
    '   - Acesse https://developers.facebook.com/apps',
    '   - Vá em WhatsApp > Configuration',
    '   - Atualize o App Secret',
    '',
    '4. Reinicie a aplicação',
    '',
    '5. Teste o webhook com o novo secret',
    '',
    '⚠️  IMPORTANTE: Mantenha o secret antigo até confirmar que o novo está funcionando!',
  ];

  return { newSecret, instructions };
}

// ============================================
// Exemplo 10: Monitoramento de Segurança
// ============================================

/**
 * Monitora tentativas de webhook inválidas
 */
export class WebhookSecurityMonitor {
  private invalidAttempts: Map<string, number> = new Map();
  private readonly maxAttempts = 5;
  private readonly timeWindow = 60000; // 1 minuto

  /**
   * Registra tentativa de webhook
   */
  recordAttempt(ip: string, valid: boolean): {
    blocked: boolean;
    reason?: string;
  } {
    if (valid) {
      // Limpar contador em caso de sucesso
      this.invalidAttempts.delete(ip);
      return { blocked: false };
    }

    // Incrementar contador de tentativas inválidas
    const attempts = (this.invalidAttempts.get(ip) || 0) + 1;
    this.invalidAttempts.set(ip, attempts);

    // Verificar se deve bloquear
    if (attempts >= this.maxAttempts) {
      return {
        blocked: true,
        reason: `Too many invalid attempts from ${ip}`,
      };
    }

    // Limpar após o período de tempo
    setTimeout(() => {
      this.invalidAttempts.delete(ip);
    }, this.timeWindow);

    return { blocked: false };
  }

  /**
   * Obtém estatísticas de segurança
   */
  getStats(): {
    activeIPs: number;
    totalAttempts: number;
    suspiciousIPs: string[];
  } {
    const suspiciousIPs = Array.from(this.invalidAttempts.entries())
      .filter(([_, attempts]) => attempts >= 3)
      .map(([ip]) => ip);

    return {
      activeIPs: this.invalidAttempts.size,
      totalAttempts: Array.from(this.invalidAttempts.values()).reduce(
        (a, b) => a + b,
        0
      ),
      suspiciousIPs,
    };
  }
}

// ============================================
// Uso dos Exemplos
// ============================================

/**
 * Como executar os exemplos:
 *
 * 1. Validação básica:
 *    const result = await validateIncomingWebhook(request);
 *
 * 2. Gerar assinatura:
 *    const sig = generateWebhookSignature(payload, secret);
 *
 * 3. Simular webhook:
 *    await simulateWhatsAppWebhook(url, payload, secret);
 *
 * 4. Validar com logging:
 *    const valid = await validateWebhookWithLogging(body, sig, secret);
 *
 * 5. Usar middleware:
 *    const middleware = createWebhookValidationMiddleware(secret);
 *    return middleware(request, async (body) => {
 *      // processar webhook
 *      return new Response('OK');
 *    });
 *
 * 6. Testar fluxo completo:
 *    await testWebhookFlow();
 *
 * 7. Verificar configuração:
 *    const { configured, issues } = checkWebhookConfiguration();
 *
 * 8. Rotacionar secret:
 *    const { newSecret, instructions } = rotateWebhookSecret();
 *
 * 9. Monitorar segurança:
 *    const monitor = new WebhookSecurityMonitor();
 *    const result = monitor.recordAttempt(ip, isValid);
 */
