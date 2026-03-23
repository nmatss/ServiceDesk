/**
 * WhatsApp Business Webhook Handler
 * Gerencia webhook para mensagens recebidas do WhatsApp
 */

import { WhatsAppBusinessClient } from './client';
import { WhatsAppMessage, WhatsAppContact, WhatsAppSession } from '@/lib/types/database';
import { createAuditLog } from '@/lib/audit/logger';
import { getWhatsAppContact, createWhatsAppContact, getActiveSessionByPhone, createWhatsAppSession, updateWhatsAppSession } from './storage';
import logger from '@/lib/monitoring/structured-logger';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { sqlNow } from '@/lib/db/adapter';

interface WebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        text?: {
          body: string;
        };
        image?: {
          mime_type: string;
          sha256: string;
          id: string;
          caption?: string;
        };
        document?: {
          mime_type: string;
          sha256: string;
          id: string;
          filename: string;
          caption?: string;
        };
        audio?: {
          mime_type: string;
          sha256: string;
          id: string;
        };
        video?: {
          mime_type: string;
          sha256: string;
          id: string;
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
        type: string;
        context?: {
          from: string;
          id: string;
        };
      }>;
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
        conversation?: {
          id: string;
          origin: {
            type: string;
          };
        };
        pricing?: {
          billable: boolean;
          pricing_model: string;
          category: string;
        };
        errors?: Array<{
          code: number;
          title: string;
          message: string;
          error_data?: {
            details: string;
          };
        }>;
      }>;
    };
    field: string;
  }>;
}

interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export class WhatsAppWebhookHandler {
  private client: WhatsAppBusinessClient;
  private sessionTimeout = 24 * 60 * 60 * 1000; // 24 horas

  constructor(client: WhatsAppBusinessClient) {
    this.client = client;
  }

  /**
   * Processa webhook do WhatsApp
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    if (payload.object !== 'whatsapp_business_account') {
      throw new Error('Invalid webhook object type');
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          await this.processMessages(change.value);
        }
      }
    }
  }

  /**
   * Processa mensagens recebidas
   */
  private async processMessages(value: WebhookEntry['changes'][0]['value']): Promise<void> {
    const { messages, contacts, statuses } = value;

    // Processa contatos primeiro
    if (contacts) {
      for (const contact of contacts) {
        await this.processContact(contact);
      }
    }

    // Processa mensagens
    if (messages) {
      for (const message of messages) {
        await this.processMessage(message);
      }
    }

    // Processa status de entrega
    if (statuses) {
      for (const status of statuses) {
        await this.processMessageStatus(status);
      }
    }
  }

  /**
   * Processa contato
   */
  private async processContact(contact: {
    wa_id: string
    profile?: { name: string }
  }): Promise<WhatsAppContact> {
    const phoneNumber = contact.wa_id;
    const displayName = contact.profile?.name;

    let whatsappContact = await getWhatsAppContact(phoneNumber);

    if (!whatsappContact) {
      // Busca usuário existente pelo telefone
      const existingUser = await executeQueryOne<{ id: number }>(`
        SELECT id FROM users WHERE phone = ?
      `, [phoneNumber]);

      whatsappContact = await createWhatsAppContact({
        user_id: existingUser?.id,
        phone_number: phoneNumber,
        display_name: displayName,
        is_business: false,
        is_verified: false
      });

      await createAuditLog({
        action: 'whatsapp_contact_created',
        resource_type: 'whatsapp_contact',
        resource_id: whatsappContact.id,
        new_values: JSON.stringify(whatsappContact)
      });
    } else if (displayName && whatsappContact.display_name !== displayName) {
      // Atualiza nome se mudou
      whatsappContact.display_name = displayName;
      whatsappContact.updated_at = new Date().toISOString();
      await this.updateWhatsAppContact(whatsappContact);
    }

    return whatsappContact;
  }

  /**
   * Processa mensagem recebida
   */
  private async processMessage(msg: NonNullable<WebhookEntry['changes'][0]['value']['messages']>[0]): Promise<void> {
    const message = msg;
    const phoneNumber = message.from;
    const messageId = message.id;
    const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
    const messageType = message.type;

    // Evita processar a mesma mensagem duas vezes
    const existingMessage = await this.getWhatsAppMessageById(messageId);
    if (existingMessage) {
      return;
    }

    // Busca ou cria contato
    let contact = await getWhatsAppContact(phoneNumber);
    if (!contact) {
      contact = await createWhatsAppContact({
        phone_number: phoneNumber,
        display_name: phoneNumber,
        is_business: false,
        is_verified: false
      });
    }

    // Busca ou cria sessão ativa
    let session = await getActiveSessionByPhone(phoneNumber);
    if (!session || this.isSessionExpired(session)) {
      session = await createWhatsAppSession({
        phone_number: phoneNumber,
        session_data: JSON.stringify({ startedAt: Date.now() }),
        last_activity: timestamp,
        is_active: true
      });
    } else {
      // Atualiza última atividade
      await updateWhatsAppSession({
        ...session,
        last_activity: timestamp
      });
    }

    // Extrai conteúdo da mensagem
    const content = this.extractMessageContent(message);

    // Salva mensagem no banco
    const whatsappMessage = await this.saveWhatsAppMessage({
      contact_id: contact.id,
      message_id: messageId,
      direction: 'inbound',
      message_type: messageType,
      content: content.text,
      media_url: content.mediaUrl,
      media_mime_type: content.mimeType,
      media_caption: content.caption,
      status: 'received',
      timestamp
    });

    // Marca como lida
    try {
      await this.client.markAsRead(messageId);
    } catch (error) {
      logger.error('Error marking message as read', error);
    }

    // Processa para criação/atualização de ticket
    await this.processForTicketing(contact, whatsappMessage, session, content);
  }

  /**
   * Extrai conteúdo da mensagem baseado no tipo
   */
  private extractMessageContent(msg: NonNullable<WebhookEntry['changes'][0]['value']['messages']>[0]): {
    text?: string;
    mediaUrl?: string;
    mimeType?: string;
    caption?: string;
  } {
    const message = msg;
    const { type } = message;

    switch (type) {
      case 'text':
        return { text: message.text?.body };

      case 'image':
        return {
          text: message.image?.caption,
          mediaUrl: message.image?.id,
          mimeType: message.image?.mime_type,
          caption: message.image?.caption
        };

      case 'document':
        return {
          text: message.document?.caption || message.document?.filename,
          mediaUrl: message.document?.id,
          mimeType: message.document?.mime_type,
          caption: message.document?.caption
        };

      case 'audio':
        return {
          text: '[Áudio]',
          mediaUrl: message.audio?.id,
          mimeType: message.audio?.mime_type
        };

      case 'video':
        return {
          text: message.video?.caption || '[Vídeo]',
          mediaUrl: message.video?.id,
          mimeType: message.video?.mime_type,
          caption: message.video?.caption
        };

      case 'location':
        const loc = message.location;
        if (loc) {
          return {
            text: `📍 Localização: ${loc.name || 'Local'}\n${loc.address || ''}\nCoordenadas: ${loc.latitude}, ${loc.longitude}`
          };
        }
        return { text: '[Localização]' };

      case 'contacts':
        const contacts = message.contacts || [];
        const contactText = contacts.map((c: { name: { formatted_name: string }; phones?: Array<{ phone: string }> }) =>
          `👤 ${c.name.formatted_name}\n${c.phones?.map((p: { phone: string }) => p.phone).join(', ') || ''}`
        ).join('\n\n');
        return { text: contactText };

      default:
        return { text: `[${type.toUpperCase()}] Tipo de mensagem não suportado` };
    }
  }

  /**
   * Processa mensagem para sistema de tickets
   */
  private async processForTicketing(
    contact: WhatsAppContact,
    message: WhatsAppMessage,
    session: WhatsAppSession,
    content: {
      text?: string
      mediaUrl?: string
      mimeType?: string
      caption?: string
    }
  ): Promise<void> {
    const sessionData = JSON.parse(session.session_data || '{}');

    // Verifica se já existe ticket ativo para esta sessão
    if (sessionData.activeTicketId) {
      await this.addCommentToExistingTicket(sessionData.activeTicketId, contact, message, content);
    } else {
      // Verifica se deve criar novo ticket baseado em regras
      const shouldCreateTicket = await this.shouldCreateTicket(content.text);

      if (shouldCreateTicket) {
        const ticketId = await this.createTicketFromWhatsApp(contact, message, content);

        // Atualiza sessão com ID do ticket
        sessionData.activeTicketId = ticketId;
        await updateWhatsAppSession({
          ...session,
          session_data: JSON.stringify(sessionData)
        });
      } else {
        // Resposta automática ou encaminhamento
        await this.handleNonTicketMessage(contact, content);
      }
    }
  }

  /**
   * Determina se deve criar ticket baseado em regras
   */
  private async shouldCreateTicket(messageText?: string): Promise<boolean> {
    if (!messageText) return false;

    const text = messageText.toLowerCase();

    // Palavras-chave que indicam solicitação de suporte
    const supportKeywords = [
      'ajuda', 'problema', 'erro', 'bug', 'suporte', 'dúvida',
      'não consigo', 'não funciona', 'dificuldade', 'reclamação',
      'solicitação', 'pedido', 'urgente', 'crítico'
    ];

    // Palavras-chave que NÃO devem criar ticket
    const nonSupportKeywords = [
      'oi', 'olá', 'bom dia', 'boa tarde', 'boa noite',
      'obrigado', 'valeu', 'beleza', 'ok', 'tudo bem'
    ];

    // Se contém apenas saudações, não cria ticket
    if (nonSupportKeywords.some(keyword => text === keyword.trim())) {
      return false;
    }

    // Se contém palavras de suporte, cria ticket
    if (supportKeywords.some(keyword => text.includes(keyword))) {
      return true;
    }

    // Se mensagem é longa (mais de 50 caracteres), provavelmente é solicitação
    return messageText.length > 50;
  }

  /**
   * Cria ticket a partir de mensagem WhatsApp
   */
  private async createTicketFromWhatsApp(
    contact: WhatsAppContact,
    message: WhatsAppMessage,
    content: {
      text?: string
      mediaUrl?: string
      mimeType?: string
      caption?: string
    }
  ): Promise<number> {
    const title = this.generateTicketTitle(content.text);
    const description = this.generateTicketDescription(contact, message, content);

    // Determina categoria e prioridade baseado no conteúdo
    const { categoryId, priorityId } = await this.determineTicketClassification(content.text);

    // Create ticket using adapter
    const result = await executeRun(`
      INSERT INTO tickets (title, description, user_id, category_id, priority_id, status_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ${sqlNow()}, ${sqlNow()})
    `, [
      title,
      description,
      contact.user_id || 1,
      categoryId,
      priorityId,
      1
    ]);

    const ticketId = result.lastInsertRowid as number;

    // Atualiza mensagem com ID do ticket
    await this.updateWhatsAppMessage({
      ...message,
      ticket_id: ticketId
    });

    await createAuditLog({
      action: 'ticket_created_from_whatsapp',
      resource_type: 'ticket',
      resource_id: ticketId,
      new_values: JSON.stringify({
        ticketId,
        whatsappMessageId: message.id,
        contactPhone: contact.phone_number
      })
    });

    // Envia confirmação
    await this.sendTicketCreatedConfirmation(contact.phone_number, ticketId);

    return ticketId;
  }

  /**
   * Adiciona comentário a ticket existente
   */
  private async addCommentToExistingTicket(
    ticketId: number,
    contact: WhatsAppContact,
    message: WhatsAppMessage,
    content: {
      text?: string
      mediaUrl?: string
      mimeType?: string
      caption?: string
    }
  ): Promise<void> {
    const commentContent = this.formatCommentFromWhatsApp(message, content);

    // Create comment using adapter
    await executeRun(`
      INSERT INTO comments (ticket_id, author_id, content, is_internal, created_at)
      VALUES (?, ?, ?, ?, ${sqlNow()})
    `, [ticketId, contact.user_id || 1, commentContent, 0]);

    // Atualiza mensagem com ID do ticket
    await this.updateWhatsAppMessage({
      ...message,
      ticket_id: ticketId
    });

    // Atualiza timestamp do ticket
    await executeRun(`
      UPDATE tickets SET updated_at = ${sqlNow()} WHERE id = ?
    `, [ticketId]);
  }

  /**
   * Processa status de entrega de mensagem
   */
  private async processMessageStatus(stat: NonNullable<WebhookEntry['changes'][0]['value']['statuses']>[0]): Promise<void> {
    const status = stat;
    const messageId = status.id;
    const statusType = status.status;

    const message = await this.getWhatsAppMessageById(messageId);
    if (message) {
      await this.updateWhatsAppMessage({
        ...message,
        status: statusType
      });
    }
  }

  /**
   * Gera título do ticket baseado no conteúdo
   */
  private generateTicketTitle(text?: string): string {
    if (!text) return 'Solicitação via WhatsApp';

    // Pega primeiras 50 caracteres como título
    const title = text.substring(0, 50).trim();
    return title.length < text.length ? `${title}...` : title;
  }

  /**
   * Gera descrição do ticket
   */
  private generateTicketDescription(
    contact: WhatsAppContact,
    message: WhatsAppMessage,
    content: {
      text?: string
      mediaUrl?: string
      mimeType?: string
      caption?: string
    }
  ): string {
    let description = `Solicitação recebida via WhatsApp\n\n`;
    description += `📱 Contato: ${contact.display_name || contact.phone_number}\n`;
    description += `📞 Telefone: ${contact.phone_number}\n`;
    description += `🕐 Data/Hora: ${new Date(message.timestamp).toLocaleString('pt-BR')}\n\n`;
    description += `💬 Mensagem:\n${content.text || '[Mídia anexada]'}`;

    if (content.mediaUrl) {
      description += `\n\n📎 Mídia: ${content.mimeType}`;
      if (content.caption) {
        description += `\nLegenda: ${content.caption}`;
      }
    }

    return description;
  }

  /**
   * Determina classificação do ticket baseado no conteúdo
   */
  private async determineTicketClassification(text?: string): Promise<{
    categoryId: number;
    priorityId: number;
  }> {
    // Implementação básica - pode ser melhorada com IA
    const urgentKeywords = ['urgente', 'crítico', 'parado', 'emergência'];
    const isUrgent = text && urgentKeywords.some(keyword =>
      text.toLowerCase().includes(keyword)
    );

    return {
      categoryId: 1, // Categoria padrão
      priorityId: isUrgent ? 4 : 2 // Crítica se urgente, senão média
    };
  }

  /**
   * Formata comentário a partir de mensagem WhatsApp
   */
  private formatCommentFromWhatsApp(message: WhatsAppMessage, content: {
    text?: string
    mediaUrl?: string
    mimeType?: string
    caption?: string
  }): string {
    let comment = `💬 WhatsApp (${new Date(message.timestamp).toLocaleString('pt-BR')}):\n`;
    comment += content.text || '[Mídia anexada]';

    if (content.mediaUrl) {
      comment += `\n📎 ${content.mimeType}`;
      if (content.caption) {
        comment += ` - ${content.caption}`;
      }
    }

    return comment;
  }

  /**
   * Envia confirmação de criação de ticket
   */
  private async sendTicketCreatedConfirmation(phoneNumber: string, ticketId: number): Promise<void> {
    const message = `✅ Seu chamado foi registrado!\n\n🎫 Número: #${ticketId}\n\nEm breve um de nossos atendentes entrará em contato. Você pode acompanhar o status pelo nosso sistema.`;

    try {
      await this.client.sendTextMessage(phoneNumber, message);
    } catch (error) {
      logger.error('Error sending confirmation message', error);
    }
  }

  /**
   * Trata mensagens que não geram tickets
   */
  private async handleNonTicketMessage(contact: WhatsAppContact, content: {
    text?: string
    mediaUrl?: string
    mimeType?: string
    caption?: string
  }): Promise<void> {
    const text = content.text?.toLowerCase();

    if (!text) return;

    // Respostas automáticas para saudações
    if (['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite'].includes(text.trim())) {
      const response = `Olá! 👋\n\nEu sou o assistente virtual do Insighta.\n\nComo posso ajudar você hoje?\n\n💡 Dica: Descreva seu problema ou dúvida que criarei um chamado automaticamente.`;

      try {
        await this.client.sendTextMessage(contact.phone_number, response);
      } catch (error) {
        logger.error('Error sending auto-response', error);
      }
    }
  }

  /**
   * Verifica se sessão expirou
   */
  private isSessionExpired(session: WhatsAppSession): boolean {
    const lastActivity = new Date(session.last_activity).getTime();
    const now = Date.now();
    return (now - lastActivity) > this.sessionTimeout;
  }

  // Métodos de placeholder para interação com banco de dados
  // Estes devem ser implementados conforme a estrutura do seu banco

  private async getWhatsAppMessageById(_messageId: string): Promise<WhatsAppMessage | null> {
    // TODO: Implementar query no banco de dados
    return null;
  }

  private async saveWhatsAppMessage(data: Partial<WhatsAppMessage>): Promise<WhatsAppMessage> {
    // TODO: Implementar inserção no banco de dados
    return data as WhatsAppMessage;
  }

  private async updateWhatsAppMessage(_message: WhatsAppMessage): Promise<void> {
    // TODO: Implementar atualização no banco de dados
  }

  private async updateWhatsAppContact(_contact: WhatsAppContact): Promise<void> {
    // TODO: Implementar atualização no banco de dados
  }
}

export default WhatsAppWebhookHandler;
