/**
 * WhatsApp Message Handler
 * Handles incoming WhatsApp messages and creates/updates tickets
 *
 * Features:
 * - Parse incoming messages (text, media, location)
 * - Create tickets from WhatsApp messages
 * - Update existing tickets with new messages
 * - Handle file attachments
 * - Conversation threading
 * - Auto-assign tickets to agents
 */

import {
  createWhatsAppContact,
  getWhatsAppContact,
  updateWhatsAppContact,
  createWhatsAppMessage,
  getActiveSessionByPhone,
  createWhatsAppSession,
  updateWhatsAppSession,
  getUserByPhone,
} from './storage';
import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { WhatsAppBusinessAPI } from './business-api';
import logger from '@/lib/monitoring/structured-logger';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * WhatsApp Webhook Message Types
 */
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
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: Array<{
    name: {
      formatted_name: string;
      first_name?: string;
      last_name?: string;
    };
    phones?: Array<{
      phone: string;
      type?: string;
    }>;
  }>;
  context?: {
    message_id: string;
  };
}

interface MessageHandlerResult {
  success: boolean;
  ticketId?: number;
  commentId?: number;
  error?: string;
  action: 'created' | 'updated' | 'ignored';
}

interface MediaDownloadResult {
  success: boolean;
  filePath?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  error?: string;
}

interface WhatsAppContactData {
  id: number;
  display_name?: string;
  phone_number: string;
  user_id?: number;
}

interface SessionData {
  ticketId?: number;
  [key: string]: unknown;
}

interface MediaAttachment {
  url?: string;
  filePath?: string;
  filename: string;
  mimeType: string;
  size?: number;
}

/**
 * Main message handler class
 */
export class WhatsAppMessageHandler {
  private api: WhatsAppBusinessAPI;
  private uploadDir: string;

  constructor(api: WhatsAppBusinessAPI) {
    this.api = api;
    this.uploadDir = process.env.UPLOAD_DIR || './uploads/whatsapp';
  }

  /**
   * Process incoming WhatsApp message
   */
  async processIncomingMessage(
    message: WebhookMessage,
    profileName?: string,
    organizationId: number = 1
  ): Promise<MessageHandlerResult> {
    try {
      const phoneNumber = message.from;
      logger.info('Processing WhatsApp message', {
        from: phoneNumber,
        type: message.type,
        messageId: message.id,
      });

      // Get or create contact
      let contact = await getWhatsAppContact(phoneNumber);
      if (!contact) {
        contact = await createWhatsAppContact({
          phone_number: phoneNumber,
          display_name: profileName || phoneNumber,
          is_business: false,
          is_verified: false,
        });
      }

      // Try to find associated user
      const user = await getUserByPhone(phoneNumber);
      if (user && !contact.user_id) {
        contact.user_id = user.id;
        await updateWhatsAppContact(contact);
      }

      // Extract message content and media
      const { content, mediaAttachments } = await this.extractMessageContent(message);

      // Check for active session
      const session = await getActiveSessionByPhone(phoneNumber);
      const sessionData: SessionData = session?.session_data ? JSON.parse(session.session_data) : {};
      const ticketId = sessionData.ticketId;

      // Save incoming message to database
      await createWhatsAppMessage({
        contact_id: contact.id,
        ticket_id: ticketId || undefined,
        message_id: message.id,
        direction: 'inbound',
        message_type: message.type,
        content,
        media_url: mediaAttachments[0]?.url,
        media_mime_type: mediaAttachments[0]?.mimeType,
        media_caption: message.image?.caption || message.document?.caption,
        status: 'received',
        timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      });

      // Check if this is a command
      if (message.type === 'text' && content.startsWith('/')) {
        return await this.handleCommand(message, contact, content);
      }

      // Check if this is a reply to existing ticket
      if (ticketId) {
        return await this.addCommentToTicket(
          ticketId,
          contact,
          content,
          mediaAttachments,
          message.id,
          organizationId
        );
      }

      // Create new ticket
      return await this.createTicketFromMessage(
        contact,
        user,
        content,
        mediaAttachments,
        message,
        organizationId
      );
    } catch (error) {
      logger.error('Error processing WhatsApp message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: message.id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'ignored',
      };
    }
  }

  /**
   * Extract content and media from message
   */
  private async extractMessageContent(message: WebhookMessage): Promise<{
    content: string;
    mediaAttachments: MediaAttachment[];
  }> {
    let content = '';
    const mediaAttachments: MediaAttachment[] = [];

    switch (message.type) {
      case 'text':
        content = message.text?.body || '';
        break;

      case 'image':
        if (message.image) {
          content = message.image.caption || '[Imagem enviada]';
          const imageResult = await this.downloadMedia(message.image.id, 'image', message.image.mime_type);
          if (imageResult.success && imageResult.filePath) {
            mediaAttachments.push({
              filePath: imageResult.filePath,
              filename: imageResult.filename!,
              mimeType: imageResult.mimeType!,
              size: imageResult.size,
            });
          }
        }
        break;

      case 'document':
        if (message.document) {
          content = message.document.caption || `[Documento: ${message.document.filename}]`;
          const docResult = await this.downloadMedia(
            message.document.id,
            'document',
            message.document.mime_type,
            message.document.filename
          );
          if (docResult.success && docResult.filePath) {
            mediaAttachments.push({
              filePath: docResult.filePath,
              filename: docResult.filename!,
              mimeType: docResult.mimeType!,
              size: docResult.size,
            });
          }
        }
        break;

      case 'audio':
        if (message.audio) {
          content = '[Áudio enviado]';
          const audioResult = await this.downloadMedia(message.audio.id, 'audio', message.audio.mime_type);
          if (audioResult.success && audioResult.filePath) {
            mediaAttachments.push({
              filePath: audioResult.filePath,
              filename: audioResult.filename!,
              mimeType: audioResult.mimeType!,
              size: audioResult.size,
            });
          }
        }
        break;

      case 'video':
        if (message.video) {
          content = message.video.caption || '[Vídeo enviado]';
          const videoResult = await this.downloadMedia(message.video.id, 'video', message.video.mime_type);
          if (videoResult.success && videoResult.filePath) {
            mediaAttachments.push({
              filePath: videoResult.filePath,
              filename: videoResult.filename!,
              mimeType: videoResult.mimeType!,
              size: videoResult.size,
            });
          }
        }
        break;

      case 'location':
        if (message.location) {
          const loc = message.location;
          content = `📍 Localização compartilhada:\nLatitude: ${loc.latitude}\nLongitude: ${loc.longitude}`;
          if (loc.name) content += `\nNome: ${loc.name}`;
          if (loc.address) content += `\nEndereço: ${loc.address}`;
        }
        break;

      case 'contacts':
        if (message.contacts && message.contacts.length > 0) {
          content = '👤 Contatos compartilhados:\n';
          message.contacts.forEach((contact, index) => {
            content += `\n${index + 1}. ${contact.name?.formatted_name || 'Sem nome'}`;
            if (contact.phones && contact.phones.length > 0 && contact.phones[0]) {
              content += ` - ${contact.phones[0].phone}`;
            }
          });
        }
        break;

      default:
        content = `[Mensagem do tipo ${message.type} recebida]`;
    }

    return { content, mediaAttachments };
  }

  /**
   * Download media from WhatsApp and save locally
   */
  private async downloadMedia(
    mediaId: string,
    type: string,
    mimeType: string,
    originalFilename?: string
  ): Promise<MediaDownloadResult> {
    try {
      // Download media from WhatsApp
      const result = await this.api.downloadMedia(mediaId);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to download media',
        };
      }

      // Generate unique filename
      const ext = this.getExtensionFromMimeType(mimeType) || this.getExtensionFromFilename(originalFilename);
      const filename = originalFilename || `${type}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
      const safeFilename = this.sanitizeFilename(filename);

      // Ensure upload directory exists
      const uploadPath = path.join(this.uploadDir, type);
      await fs.mkdir(uploadPath, { recursive: true });

      // Save file
      const filePath = path.join(uploadPath, safeFilename);
      await fs.writeFile(filePath, result.data);

      // Get file size
      const stats = await fs.stat(filePath);

      return {
        success: true,
        filePath,
        filename: safeFilename,
        mimeType: result.mimeType || mimeType,
        size: stats.size,
      };
    } catch (error) {
      logger.error('Error downloading WhatsApp media', {
        mediaId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create ticket from WhatsApp message
   */
  private async createTicketFromMessage(
    contact: WhatsAppContactData,
    user: { id: number } | null,
    content: string,
    mediaAttachments: MediaAttachment[],
    message: WebhookMessage,
    organizationId: number
  ): Promise<MessageHandlerResult> {
    try {
      // Get default category and priority
      const defaultCategory = await executeQueryOne<{ id: number }>(
        'SELECT id FROM categories WHERE organization_id = ? ORDER BY id LIMIT 1',
        [organizationId]
      );

      const defaultPriority = await executeQueryOne<{ id: number }>(
        'SELECT id FROM priorities WHERE level = 2 LIMIT 1',
        []
      );

      const openStatus = await executeQueryOne<{ id: number }>(
        'SELECT id FROM statuses WHERE name = ? OR is_final = 0 ORDER BY id LIMIT 1',
        ['Aberto']
      );

      // Create ticket
      const ticketResult = await executeRun(
        `INSERT INTO tickets (
          title, description, requester_id, category_id, priority_id, status_id,
          channel, organization_id, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          `WhatsApp: ${contact.display_name || contact.phone_number}`,
          content,
          user?.id || contact.user_id || 1,
          defaultCategory?.id || 1,
          defaultPriority?.id || 2,
          openStatus?.id || 1,
          'whatsapp',
          organizationId,
          JSON.stringify({
            source: 'whatsapp',
            phoneNumber: contact.phone_number,
            contactId: contact.id,
            messageId: message.id,
          })
        ]
      );

      const ticketId = ticketResult.lastInsertRowid as number;

      // Save attachments
      for (const attachment of mediaAttachments) {
        if (attachment.filePath) {
          await executeRun(
            `INSERT INTO attachments (
              ticket_id, filename, original_name, mime_type, size,
              uploaded_by, storage_path, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              ticketId,
              attachment.filename,
              attachment.filename,
              attachment.mimeType,
              attachment.size || 0,
              user?.id || 1,
              attachment.filePath
            ]
          );
        }
      }

      // Update WhatsApp session
      const existingSession = await getActiveSessionByPhone(contact.phone_number);
      if (existingSession) {
        existingSession.session_data = JSON.stringify({ ticketId });
        existingSession.last_activity = new Date().toISOString();
        await updateWhatsAppSession(existingSession);
      } else {
        await createWhatsAppSession({
          phone_number: contact.phone_number,
          session_data: JSON.stringify({ ticketId }),
          last_activity: new Date().toISOString(),
          is_active: true,
        });
      }

      // Send confirmation message
      await this.api.sendTextMessage(
        contact.phone_number,
        `✅ Chamado #${ticketId} criado com sucesso!\n\n` +
          `Recebemos sua solicitação e nossa equipe responderá em breve.\n\n` +
          `Para acompanhar o status, acesse nosso portal ou continue a conversa aqui.`
      );

      logger.info('Ticket created from WhatsApp', {
        ticketId,
        contactId: contact.id,
        phoneNumber: contact.phone_number,
      });

      return {
        success: true,
        ticketId,
        action: 'created',
      };
    } catch (error) {
      logger.error('Error creating ticket from WhatsApp', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'ignored',
      };
    }
  }

  /**
   * Add comment to existing ticket
   */
  private async addCommentToTicket(
    ticketId: number,
    contact: WhatsAppContactData,
    content: string,
    mediaAttachments: MediaAttachment[],
    messageId: string,
    organizationId: number
  ): Promise<MessageHandlerResult> {
    try {
      // Verify ticket exists and belongs to organization
      const ticket = await executeQueryOne<{ id: number; requester_id: number }>(
        'SELECT id, requester_id FROM tickets WHERE id = ? AND organization_id = ?',
        [ticketId, organizationId]
      );

      if (!ticket) {
        return {
          success: false,
          error: 'Ticket not found',
          action: 'ignored',
        };
      }

      // Add comment
      const commentResult = await executeRun(
        `INSERT INTO comments (
          ticket_id, user_id, content, is_internal,
          metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          ticketId,
          contact.user_id || 1,
          content,
          0,
          JSON.stringify({
            source: 'whatsapp',
            phoneNumber: contact.phone_number,
            messageId,
          })
        ]
      );

      const commentId = commentResult.lastInsertRowid as number;

      // Save attachments
      for (const attachment of mediaAttachments) {
        if (attachment.filePath) {
          await executeRun(
            `INSERT INTO attachments (
              ticket_id, comment_id, filename, original_name, mime_type, size,
              uploaded_by, storage_path, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              ticketId,
              commentId,
              attachment.filename,
              attachment.filename,
              attachment.mimeType,
              attachment.size || 0,
              contact.user_id || 1,
              attachment.filePath
            ]
          );
        }
      }

      // Update session activity
      const session = await getActiveSessionByPhone(contact.phone_number);
      if (session) {
        session.last_activity = new Date().toISOString();
        await updateWhatsAppSession(session);
      }

      logger.info('Comment added to ticket from WhatsApp', {
        ticketId,
        commentId,
        contactId: contact.id,
      });

      return {
        success: true,
        ticketId,
        commentId,
        action: 'updated',
      };
    } catch (error) {
      logger.error('Error adding comment to ticket', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticketId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'ignored',
      };
    }
  }

  /**
   * Handle command messages
   */
  private async handleCommand(
    _message: WebhookMessage,
    contact: WhatsAppContactData,
    command: string
  ): Promise<MessageHandlerResult> {
    const cmd = command.toLowerCase().trim();
    let responseText = '';

    switch (cmd) {
      case '/ajuda':
      case '/help':
        responseText =
          `📱 *Comandos disponíveis:*\n\n` +
          `/ajuda - Mostra esta mensagem\n` +
          `/status - Consulta status dos seus chamados\n` +
          `/novo - Abre um novo chamado\n` +
          `/cancelar - Cancela a conversa atual\n\n` +
          `Ou simplesmente envie sua mensagem e criaremos um chamado automaticamente!`;
        break;

      case '/status':
        responseText = await this.getTicketsStatus(contact);
        break;

      case '/novo':
        // Clear session to force new ticket creation
        const session = await getActiveSessionByPhone(contact.phone_number);
        if (session) {
          session.is_active = false;
          await updateWhatsAppSession(session);
        }
        responseText = `📝 Pronto! Envie sua mensagem para abrir um novo chamado.`;
        break;

      case '/cancelar':
        const activeSession = await getActiveSessionByPhone(contact.phone_number);
        if (activeSession) {
          activeSession.is_active = false;
          await updateWhatsAppSession(activeSession);
          responseText = `✅ Conversa cancelada. Até logo!`;
        } else {
          responseText = `Não há nenhuma conversa ativa para cancelar.`;
        }
        break;

      default:
        responseText = `❓ Comando não reconhecido: ${cmd}\n\nDigite /ajuda para ver os comandos disponíveis.`;
    }

    await this.api.sendTextMessage(contact.phone_number, responseText);

    return {
      success: true,
      action: 'ignored',
    };
  }

  /**
   * Get user's tickets status
   */
  private async getTicketsStatus(contact: WhatsAppContactData): Promise<string> {
    try {
      interface TicketStatus {
        id: number;
        title: string;
        created_at: string;
        status_name: string;
      }

      const tickets = await executeQuery<TicketStatus>(
        `SELECT t.id, t.title, t.created_at, s.name as status_name
         FROM tickets t
         JOIN statuses s ON t.status_id = s.id
         WHERE t.requester_id = ? OR JSON_EXTRACT(t.metadata, '$.phoneNumber') = ?
         ORDER BY t.created_at DESC
         LIMIT 5`,
        [contact.user_id || 0, contact.phone_number]
      );

      if (!tickets || tickets.length === 0) {
        return `Você não possui chamados abertos no momento.`;
      }

      let statusText = `📋 *Seus últimos chamados:*\n\n`;
      tickets.forEach((ticket: TicketStatus) => {
        const date = new Date(ticket.created_at).toLocaleDateString('pt-BR');
        statusText += `#${ticket.id} - ${ticket.status_name}\n`;
        statusText += `📅 ${date}\n\n`;
      });

      return statusText;
    } catch (error) {
      logger.error('Error getting tickets status', { error });
      return `Não foi possível consultar seus chamados no momento.`;
    }
  }

  /**
   * Utility: Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
    };

    return mimeMap[mimeType] || '';
  }

  /**
   * Utility: Get extension from filename
   */
  private getExtensionFromFilename(filename?: string): string {
    if (!filename) return '';
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0] : '';
  }

  /**
   * Utility: Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }
}

export default WhatsAppMessageHandler;
