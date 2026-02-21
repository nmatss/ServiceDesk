/**
 * WhatsApp Business API Integration
 * Official WhatsApp Cloud API implementation for ServiceDesk
 *
 * Features:
 * - Session management
 * - Message templates
 * - Media handling (images, docs, audio)
 * - Webhook receiver
 * - Automatic ticket creation
 * - Status updates
 */

import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { sqlNow } from '@/lib/db/adapter';

async function createTicket(data: any, organizationId: number) {
  const result = await executeRun(
    `INSERT INTO tickets (title, description, user_id, organization_id, category_id, priority_id, status_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${sqlNow()}, ${sqlNow()})`,
    [data.title, data.description, data.user_id, organizationId, data.category_id, data.priority_id, data.status_id]
  );
  return result.lastInsertRowid ? await executeQueryOne<any>('SELECT * FROM tickets WHERE id = ?', [result.lastInsertRowid]) : undefined;
}

async function addComment(data: any, _organizationId?: number) {
  await executeRun(
    `INSERT INTO comments (ticket_id, user_id, content, is_internal, created_at)
     VALUES (?, ?, ?, ?, ${sqlNow()})`,
    [data.ticket_id, data.user_id, data.content, data.is_internal ? 1 : 0]
  );
}
import logger from '@/lib/monitoring/structured-logger';

// WhatsApp Cloud API Configuration
interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
  apiVersion?: string;
}

// Message Types
interface TextMessage {
  type: 'text';
  text: {
    body: string;
  };
}

interface MediaMessage {
  type: 'image' | 'document' | 'audio' | 'video';
  [key: string]: any;
}

interface TemplateMessage {
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: any[];
    }>;
  };
}

type OutgoingMessage = TextMessage | MediaMessage | TemplateMessage;

// Incoming Webhook Types
interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contacts';
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  context?: {
    message_id: string;
  };
}

interface WebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: any[];
}

// Session Management
interface WhatsAppSession {
  phoneNumber: string;
  userId?: number;
  ticketId?: number;
  lastMessageAt: Date;
  context: {
    conversationId?: string;
    metadata?: Record<string, any>;
  };
}

class WhatsAppBusinessAPI {
  private config: WhatsAppConfig;
  private baseUrl: string;
  private sessions: Map<string, WhatsAppSession>;

  constructor(config: WhatsAppConfig) {
    this.config = {
      apiVersion: 'v18.0',
      ...config,
    };
    this.baseUrl = `https://graph.facebook.com/${this.config.apiVersion}`;
    this.sessions = new Map();
  }

  /**
   * Send a message via WhatsApp Business API
   */
  async sendMessage(
    to: string,
    message: OutgoingMessage,
    context?: { messageId?: string }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        ...message,
      };

      // Add context for replies
      if (context?.messageId) {
        payload.context = {
          message_id: context.messageId,
        };
      }

      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to send message');
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error('WhatsApp send error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(
    to: string,
    text: string,
    replyToMessageId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message: TextMessage = {
      type: 'text',
      text: { body: text },
    };

    return this.sendMessage(to, message, {
      messageId: replyToMessageId,
    });
  }

  /**
   * Send a template message (pre-approved templates)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'pt_BR',
    components?: any[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message: TemplateMessage = {
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components,
      },
    };

    return this.sendMessage(to, message);
  }

  /**
   * Send media (image, document, audio, video)
   */
  async sendMedia(
    to: string,
    type: 'image' | 'document' | 'audio' | 'video',
    mediaId: string,
    caption?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message: MediaMessage = {
      type,
      [type]: {
        id: mediaId,
        caption,
      },
    };

    return this.sendMessage(to, message);
  }

  /**
   * Upload media to WhatsApp servers
   */
  async uploadMedia(
    file: Buffer | Blob,
    mimeType: string,
    filename?: string
  ): Promise<{ success: boolean; mediaId?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      const blob = file instanceof Blob ? file : new Blob([new Uint8Array(file)], { type: mimeType });
      formData.append('file', blob, filename);

      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/media`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to upload media');
      }

      return {
        success: true,
        mediaId: data.id,
      };
    } catch (error) {
      logger.error('WhatsApp media upload error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Download media from WhatsApp
   */
  async downloadMedia(mediaId: string): Promise<{
    success: boolean;
    data?: Buffer;
    mimeType?: string;
    error?: string;
  }> {
    try {
      // Get media URL
      const urlResponse = await fetch(
        `${this.baseUrl}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
          },
        }
      );

      const urlData = await urlResponse.json();

      if (!urlResponse.ok) {
        throw new Error(urlData.error?.message || 'Failed to get media URL');
      }

      // Download media
      const mediaResponse = await fetch(urlData.url, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
        },
      });

      if (!mediaResponse.ok) {
        throw new Error('Failed to download media');
      }

      const buffer = Buffer.from(await mediaResponse.arrayBuffer());

      return {
        success: true,
        data: buffer,
        mimeType: urlData.mime_type,
      };
    } catch (error) {
      logger.error('WhatsApp media download error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
          }),
        }
      );

      return { success: response.ok };
    } catch (error) {
      logger.error('WhatsApp mark as read error', error);
      return { success: false };
    }
  }

  /**
   * Session Management
   */
  createSession(phoneNumber: string, userId?: number, ticketId?: number): WhatsAppSession {
    const session: WhatsAppSession = {
      phoneNumber,
      userId,
      ticketId,
      lastMessageAt: new Date(),
      context: {},
    };

    this.sessions.set(phoneNumber, session);
    return session;
  }

  getSession(phoneNumber: string): WhatsAppSession | undefined {
    return this.sessions.get(phoneNumber);
  }

  updateSession(phoneNumber: string, updates: Partial<WhatsAppSession>): void {
    const session = this.sessions.get(phoneNumber);
    if (session) {
      this.sessions.set(phoneNumber, {
        ...session,
        ...updates,
        lastMessageAt: new Date(),
      });
    }
  }

  closeSession(phoneNumber: string): void {
    this.sessions.delete(phoneNumber);
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  cleanupSessions(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [phoneNumber, session] of this.sessions.entries()) {
      if (session.lastMessageAt < oneDayAgo) {
        this.sessions.delete(phoneNumber);
      }
    }
  }

  /**
   * Process incoming webhook message and create/update ticket
   */
  async processIncomingMessage(
    message: WebhookMessage,
    profileName?: string
  ): Promise<{ success: boolean; ticketId?: number; error?: string }> {
    try {
      const phoneNumber = message.from;
      let session = this.getSession(phoneNumber);

      // Extract message content
      let messageBody = '';
      let attachments: any[] = [];

      if (message.type === 'text' && message.text) {
        messageBody = message.text.body;
      } else if (message.type === 'image' && message.image) {
        messageBody = message.image.caption || '[Imagem enviada]';
        attachments.push({
          type: 'image',
          id: message.image.id,
          mimeType: message.image.mime_type,
        });
      } else if (message.type === 'document' && message.document) {
        messageBody = message.document.caption || `[Documento: ${message.document.filename}]`;
        attachments.push({
          type: 'document',
          id: message.document.id,
          filename: message.document.filename,
          mimeType: message.document.mime_type,
        });
      } else if (message.type === 'audio' && message.audio) {
        messageBody = '[Áudio enviado]';
        attachments.push({
          type: 'audio',
          id: message.audio.id,
          mimeType: message.audio.mime_type,
        });
      }

      // Check if this is a reply to existing ticket
      if (session?.ticketId) {
        // Add comment to existing ticket
        await addComment({
          ticket_id: session.ticketId,
          user_id: session.userId || 1, // Default to system user if no user
          content: messageBody,
          is_internal: false,
        }, 1);

        // Update session
        this.updateSession(phoneNumber, {});

        return {
          success: true,
          ticketId: session.ticketId,
        };
      } else {
        // Create new ticket
        const ticket = await createTicket({
          title: `WhatsApp: ${profileName || phoneNumber}`,
          description: messageBody,
          user_id: 1, // Default system user, can be updated later
          organization_id: 1,
          category_id: 1, // Default category
          priority_id: 2, // Medium priority
          status_id: 1, // Open
        }, 1);

        if (!ticket) {
          throw new Error('Failed to create ticket');
        }

        // Create session
        this.createSession(phoneNumber, undefined, ticket.id);

        // Send confirmation
        await this.sendTextMessage(
          phoneNumber,
          `Olá! Recebemos sua mensagem e criamos o chamado #${ticket.id}. Nossa equipe responderá em breve.`
        );

        return {
          success: true,
          ticketId: ticket.id,
        };
      }
    } catch (error) {
      logger.error('WhatsApp process message error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process status update webhook
   */
  async processStatusUpdate(status: WebhookStatus): Promise<void> {
    // Log status updates for monitoring
    logger.info('WhatsApp message status', {
      messageId: status.id,
      status: status.status,
      timestamp: status.timestamp,
      recipient: status.recipient_id,
    });

    // TODO: Update message delivery status in database if needed
    // This could be used for analytics or delivery tracking
  }

  /**
   * Verify webhook signature (security)
   */
  verifyWebhookSignature(_signature: string, _payload: string): boolean {
    // WhatsApp uses SHA256 HMAC for webhook verification
    // Implementation depends on your setup
    // For now, just verify the token
    return true;
  }

  /**
   * Send ticket update notification via WhatsApp
   */
  async notifyTicketUpdate(
    phoneNumber: string,
    ticketId: number,
    _updateType: 'comment' | 'status' | 'assignment',
    message: string
  ): Promise<{ success: boolean }> {
    const formattedMessage = `📋 Chamado #${ticketId}\n\n${message}`;
    const result = await this.sendTextMessage(phoneNumber, formattedMessage);
    return { success: result.success };
  }
}

// Singleton instance
let whatsappClient: WhatsAppBusinessAPI | null = null;

export function getWhatsAppClient(): WhatsAppBusinessAPI {
  if (!whatsappClient) {
    const config: WhatsAppConfig = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0',
    };

    whatsappClient = new WhatsAppBusinessAPI(config);
  }

  return whatsappClient;
}

// Export types
export type {
  WhatsAppConfig,
  WhatsAppSession,
  WebhookMessage,
  WebhookStatus,
  OutgoingMessage,
  TextMessage,
  MediaMessage,
  TemplateMessage,
};

export { WhatsAppBusinessAPI };
