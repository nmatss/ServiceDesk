import { NextRequest, NextResponse } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { WhatsAppBusinessClient } from '@/lib/integrations/whatsapp/client';
import { createWhatsAppMessage } from '@/lib/integrations/whatsapp/storage';
import { createAuditLog } from '@/lib/audit/logger';
import { z } from 'zod';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
const sendMessageSchema = z.object({
  to: z.string().min(10, 'Phone number must be at least 10 digits'),
  type: z.enum(['text', 'image', 'document', 'template']),
  content: z.object({
    text: z.string().optional(),
    imageUrl: z.string().url().optional(),
    documentUrl: z.string().url().optional(),
    filename: z.string().optional(),
    caption: z.string().optional(),
    templateName: z.string().optional(),
    languageCode: z.string().optional(),
    components: z.array(z.any()).optional()
  }),
  ticketId: z.number().optional()
});

/**
 * POST - Enviar mensagem WhatsApp
 * Endpoint para enviar mensagens via WhatsApp Business API
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.WHATSAPP_SEND);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Verifica autenticação
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { userId } = guard.auth!;

    const body = await request.json();
    const validatedData = sendMessageSchema.parse(body);

    // Cria cliente WhatsApp
    const client = await WhatsAppBusinessClient.createFromSystemSettings();

    let response;
    const { to, type, content, ticketId } = validatedData;

    // Envia mensagem baseado no tipo
    switch (type) {
      case 'text':
        if (!content.text) {
          return NextResponse.json(
            { error: 'Text content is required for text messages' },
            { status: 400 }
          );
        }
        response = await client.sendTextMessage(to, content.text);
        break;

      case 'image':
        if (!content.imageUrl) {
          return NextResponse.json(
            { error: 'Image URL is required for image messages' },
            { status: 400 }
          );
        }
        response = await client.sendImageMessage(to, content.imageUrl, content.caption);
        break;

      case 'document':
        if (!content.documentUrl || !content.filename) {
          return NextResponse.json(
            { error: 'Document URL and filename are required for document messages' },
            { status: 400 }
          );
        }
        response = await client.sendDocumentMessage(
          to,
          content.documentUrl,
          content.filename,
          content.caption
        );
        break;

      case 'template':
        if (!content.templateName || !content.languageCode) {
          return NextResponse.json(
            { error: 'Template name and language code are required for template messages' },
            { status: 400 }
          );
        }
        response = await client.sendTemplateMessage(
          to,
          content.templateName,
          content.languageCode,
          content.components
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid message type' },
          { status: 400 }
        );
    }

    // Busca contato pelo telefone
    const { getWhatsAppContact } = await import('@/lib/integrations/whatsapp/storage');
    let contact = await getWhatsAppContact(to);

    if (!contact) {
      // Cria contato se não existir
      const { createWhatsAppContact } = await import('@/lib/integrations/whatsapp/storage');
      contact = await createWhatsAppContact({
        phone_number: to,
        display_name: to,
        is_business: false,
        is_verified: false
      });
    }

    // Salva mensagem enviada no banco
    if (response.messages && response.messages.length > 0) {
      const messageId = response.messages[0]?.id || '';

      await createWhatsAppMessage({
        contact_id: contact.id,
        ticket_id: ticketId,
        message_id: messageId,
        direction: 'outbound',
        message_type: type,
        content: content.text || content.caption || `[${type.toUpperCase()}]`,
        media_url: content.imageUrl || content.documentUrl,
        media_mime_type: type === 'image' ? 'image/*' : type === 'document' ? 'application/*' : undefined,
        media_caption: content.caption,
        status: 'sent',
        timestamp: new Date().toISOString()
      });
    }

    // Log da ação
    await createAuditLog({
      user_id: userId,
      action: 'whatsapp_message_sent',
      resource_type: 'whatsapp_message',
      new_values: JSON.stringify({
        to,
        type,
        ticketId,
        messageId: response.messages?.[0]?.id
      }),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      success: true,
      messageId: response.messages?.[0]?.id,
      response
    });
  } catch (error) {
    logger.error('Error sending WhatsApp message', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}