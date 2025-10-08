/**
 * WhatsApp Business API Webhook Handler
 * Receives and processes incoming WhatsApp messages and status updates
 *
 * Features:
 * - Webhook verification (GET)
 * - Message processing (POST)
 * - Status update handling
 * - Automatic ticket creation
 * - Reply handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppClient } from '@/lib/integrations/whatsapp/business-api';
import type { WebhookMessage, WebhookStatus } from '@/lib/integrations/whatsapp/business-api';
import { logger } from '@/lib/monitoring/logger';

/**
 * GET handler - Webhook verification
 * WhatsApp sends a verification request when you configure the webhook
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // WhatsApp sends these parameters for verification
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  // Verify the token
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified successfully');
    // Respond with the challenge to complete verification
    return new NextResponse(challenge, { status: 200 });
  }

  logger.error('WhatsApp webhook verification failed');
  return NextResponse.json(
    { error: 'Verification failed' },
    { status: 403 }
  );
}

/**
 * POST handler - Process incoming messages and status updates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate webhook structure
    if (!body.object || body.object !== 'whatsapp_business_account') {
      return NextResponse.json(
        { error: 'Invalid webhook object' },
        { status: 400 }
      );
    }

    const whatsappClient = getWhatsAppClient();

    // Process each entry in the webhook
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Handle incoming messages
        if (value.messages && value.messages.length > 0) {
          for (const message of value.messages) {
            await handleIncomingMessage(
              whatsappClient,
              message,
              value.contacts?.[0]?.profile?.name
            );
          }
        }

        // Handle message status updates
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            await handleStatusUpdate(whatsappClient, status);
          }
        }
      }
    }

    // WhatsApp expects a 200 OK response
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error('WhatsApp webhook error', error);

    // Always return 200 to WhatsApp to avoid retries
    // Log the error for debugging
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 200 }
    );
  }
}

/**
 * Handle incoming WhatsApp message
 */
async function handleIncomingMessage(
  client: any,
  message: WebhookMessage,
  profileName?: string
): Promise<void> {
  try {
    logger.info('Processing WhatsApp message', {
      from: message.from,
      type: message.type,
      id: message.id,
    });

    // Mark message as read
    await client.markAsRead(message.id);

    // Process message based on type
    switch (message.type) {
      case 'text':
        await handleTextMessage(client, message, profileName);
        break;

      case 'image':
      case 'document':
      case 'audio':
      case 'video':
        await handleMediaMessage(client, message, profileName);
        break;

      case 'location':
        await handleLocationMessage(client, message, profileName);
        break;

      case 'contacts':
        await handleContactsMessage(client, message, profileName);
        break;

      default:
        logger.warn('Unsupported message type', message.type);
        await client.sendTextMessage(
          message.from,
          'Desculpe, este tipo de mensagem não é suportado no momento.'
        );
    }
  } catch (error) {
    logger.error('Error handling incoming message', error);

    // Send error message to user
    try {
      await client.sendTextMessage(
        message.from,
        'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.'
      );
    } catch (sendError) {
      logger.error('Error sending error message', sendError);
    }
  }
}

/**
 * Handle text message
 */
async function handleTextMessage(
  client: any,
  message: WebhookMessage,
  profileName?: string
): Promise<void> {
  const text = message.text?.body || '';

  // Check for commands
  if (text.toLowerCase().startsWith('/')) {
    await handleCommand(client, message, text, profileName);
    return;
  }

  // Process as regular message - create/update ticket
  const result = await client.processIncomingMessage(message, profileName);

  if (!result.success) {
    logger.error('Failed to process message', result.error);
  }
}

/**
 * Handle media message (image, document, audio, video)
 */
async function handleMediaMessage(
  client: any,
  message: WebhookMessage,
  profileName?: string
): Promise<void> {
  // Process message and create/update ticket with media
  const result = await client.processIncomingMessage(message, profileName);

  if (!result.success) {
    logger.error('Failed to process media message', result.error);
    await client.sendTextMessage(
      message.from,
      'Desculpe, não foi possível processar sua mídia. Por favor, tente novamente.'
    );
  }
}

/**
 * Handle location message
 */
async function handleLocationMessage(
  client: any,
  message: WebhookMessage,
  profileName?: string
): Promise<void> {
  // For now, just acknowledge location messages
  await client.sendTextMessage(
    message.from,
    'Localização recebida. Nossa equipe entrará em contato em breve.'
  );
}

/**
 * Handle contacts message
 */
async function handleContactsMessage(
  client: any,
  message: WebhookMessage,
  profileName?: string
): Promise<void> {
  // For now, just acknowledge contact messages
  await client.sendTextMessage(
    message.from,
    'Contato recebido. Nossa equipe entrará em contato em breve.'
  );
}

/**
 * Handle command messages
 */
async function handleCommand(
  client: any,
  message: WebhookMessage,
  command: string,
  profileName?: string
): Promise<void> {
  const cmd = command.toLowerCase().trim();

  switch (cmd) {
    case '/ajuda':
    case '/help':
      await client.sendTextMessage(
        message.from,
        `📱 *Comandos disponíveis:*\n\n` +
        `/ajuda - Mostra esta mensagem\n` +
        `/status - Consulta status dos seus chamados\n` +
        `/novo - Abre um novo chamado\n\n` +
        `Ou simplesmente envie sua mensagem e criaremos um chamado automaticamente!`
      );
      break;

    case '/status':
      await client.sendTextMessage(
        message.from,
        `🔍 Para consultar seus chamados, acesse nosso portal ou aguarde que nossa equipe responderá em breve.`
      );
      break;

    case '/novo':
      await client.sendTextMessage(
        message.from,
        `📝 Para abrir um novo chamado, basta enviar uma mensagem descrevendo seu problema ou solicitação.`
      );
      break;

    default:
      await client.sendTextMessage(
        message.from,
        `❓ Comando não reconhecido. Digite /ajuda para ver os comandos disponíveis.`
      );
  }
}

/**
 * Handle message status update
 */
async function handleStatusUpdate(
  client: any,
  status: WebhookStatus
): Promise<void> {
  try {
    logger.info('Processing WhatsApp status update', {
      messageId: status.id,
      status: status.status,
      timestamp: status.timestamp,
    });

    // Process status update
    await client.processStatusUpdate(status);

    // Handle failed messages
    if (status.status === 'failed' && status.errors) {
      logger.error('WhatsApp message failed', {
        messageId: status.id,
        errors: status.errors,
      });

      // TODO: Implement retry logic or notification to admin
    }
  } catch (error) {
    logger.error('Error handling status update', error);
  }
}

/**
 * Utility function to send WhatsApp message from other parts of the application
 * This can be called from other API routes or services
 */
export async function sendWhatsAppNotification(
  phoneNumber: string,
  message: string,
  ticketId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getWhatsAppClient();

    const formattedMessage = ticketId
      ? `📋 Chamado #${ticketId}\n\n${message}`
      : message;

    const result = await client.sendTextMessage(phoneNumber, formattedMessage);

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    logger.error('Error sending WhatsApp notification', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}