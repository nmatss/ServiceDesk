/**
 * WhatsApp Business API Client
 * Cliente oficial para integração com WhatsApp Business API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { getSystemSetting } from '@/lib/db/queries';

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  apiVersion: string;
  baseUrl: string;
}

interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'template';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  image?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  document?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

interface MediaUploadResponse {
  id: string;
}

interface ContactProfile {
  profile: {
    name: string;
  };
}

export class WhatsAppBusinessClient {
  private api: AxiosInstance;
  private config: WhatsAppConfig;
  private rateLimitInfo: {
    remaining: number;
    resetTime: number;
    windowStart: number;
  } = {
    remaining: 1000,
    resetTime: Date.now() + 3600000,
    windowStart: Date.now()
  };

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: `${config.baseUrl}/${config.apiVersion}`,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor para rate limiting
    this.api.interceptors.request.use(async (config) => {
      await this.checkRateLimit();
      return config;
    });

    // Response interceptor para atualizar rate limit
    this.api.interceptors.response.use(
      (response) => {
        this.updateRateLimitFromResponse(response);
        return response;
      },
      (error) => {
        if (error.response) {
          this.updateRateLimitFromResponse(error.response);

          // Handle specific WhatsApp API errors
          if (error.response.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
          } else if (error.response.status === 401) {
            throw new Error('Invalid access token');
          } else if (error.response.status === 403) {
            throw new Error('Insufficient permissions');
          }
        }
        throw error;
      }
    );
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset rate limit window if needed
    if (now >= this.rateLimitInfo.resetTime) {
      this.rateLimitInfo.remaining = 1000;
      this.rateLimitInfo.resetTime = now + 3600000; // 1 hour
      this.rateLimitInfo.windowStart = now;
    }

    if (this.rateLimitInfo.remaining <= 0) {
      const waitTime = this.rateLimitInfo.resetTime - now;
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
  }

  private updateRateLimitFromResponse(response: AxiosResponse) {
    const remaining = response.headers['x-app-usage-call-count'];
    const resetTime = response.headers['x-business-use-case-usage'];

    if (remaining) {
      this.rateLimitInfo.remaining = parseInt(remaining, 10);
    }

    if (resetTime) {
      this.rateLimitInfo.resetTime = parseInt(resetTime, 10) * 1000;
    }
  }

  /**
   * Envia mensagem de texto
   */
  async sendTextMessage(to: string, message: string, previewUrl = false): Promise<WhatsAppResponse> {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: this.formatPhoneNumber(to),
      type: 'text',
      text: {
        body: message,
        preview_url: previewUrl
      }
    };

    const response = await this.api.post(`/${this.config.phoneNumberId}/messages`, payload);
    return response.data;
  }

  /**
   * Envia mensagem com imagem
   */
  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<WhatsAppResponse> {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: this.formatPhoneNumber(to),
      type: 'image',
      image: {
        link: imageUrl,
        caption
      }
    };

    const response = await this.api.post(`/${this.config.phoneNumberId}/messages`, payload);
    return response.data;
  }

  /**
   * Envia documento
   */
  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string
  ): Promise<WhatsAppResponse> {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: this.formatPhoneNumber(to),
      type: 'document',
      document: {
        link: documentUrl,
        filename,
        caption
      }
    };

    const response = await this.api.post(`/${this.config.phoneNumberId}/messages`, payload);
    return response.data;
  }

  /**
   * Envia template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: any[]
  ): Promise<WhatsAppResponse> {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: this.formatPhoneNumber(to),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components
      }
    };

    const response = await this.api.post(`/${this.config.phoneNumberId}/messages`, payload);
    return response.data;
  }

  /**
   * Upload de mídia
   */
  async uploadMedia(file: Buffer, type: string, filename?: string): Promise<MediaUploadResponse> {
    const formData = new FormData();
    const fileBlob = new Blob([Buffer.from(file)], { type });
    formData.append('file', fileBlob, filename || 'file');
    formData.append('type', type);
    formData.append('messaging_product', 'whatsapp');

    const response = await this.api.post(`/${this.config.phoneNumberId}/media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  }

  /**
   * Download de mídia
   */
  async downloadMedia(mediaId: string): Promise<Buffer> {
    // First get media URL
    const mediaInfo = await this.api.get(`/${mediaId}`);
    const mediaUrl = mediaInfo.data.url;

    // Download the actual media
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`
      }
    });

    return Buffer.from(response.data);
  }

  /**
   * Obtém perfil do contato
   */
  async getContactProfile(phoneNumber: string): Promise<ContactProfile> {
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    const response = await this.api.get(`/${formattedNumber}/profile`, {
      params: {
        fields: 'name'
      }
    });

    return response.data;
  }

  /**
   * Marca mensagem como lida
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.api.post(`/${this.config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    });
  }

  /**
   * Valida webhook signature
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Formata número de telefone para padrão WhatsApp
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove todos os caracteres não numéricos
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Se número brasileiro, adiciona código do país se não tiver
    if (cleaned.length === 11 && cleaned.startsWith('11')) {
      cleaned = '55' + cleaned;
    } else if (cleaned.length === 10 && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  }

  /**
   * Obtém informações de rate limit
   */
  getRateLimitInfo() {
    return {
      ...this.rateLimitInfo,
      timeUntilReset: Math.max(0, this.rateLimitInfo.resetTime - Date.now())
    };
  }

  /**
   * Factory method para criar cliente a partir das configurações do sistema
   */
  static async createFromSystemSettings(): Promise<WhatsAppBusinessClient> {
    const [
      accessToken,
      phoneNumberId,
      businessAccountId,
      webhookVerifyToken,
      apiVersion,
      baseUrl
    ] = await Promise.all([
      getSystemSetting('whatsapp_access_token'),
      getSystemSetting('whatsapp_phone_number_id'),
      getSystemSetting('whatsapp_business_account_id'),
      getSystemSetting('whatsapp_webhook_verify_token'),
      getSystemSetting('whatsapp_api_version'),
      getSystemSetting('whatsapp_base_url')
    ]);

    if (!accessToken || !phoneNumberId || !businessAccountId || !webhookVerifyToken) {
      throw new Error('WhatsApp configuration incomplete. Please check system settings.');
    }

    return new WhatsAppBusinessClient({
      accessToken,
      phoneNumberId,
      businessAccountId,
      webhookVerifyToken: webhookVerifyToken || '',
      apiVersion: apiVersion || 'v18.0',
      baseUrl: baseUrl || 'https://graph.facebook.com'
    });
  }
}

export default WhatsAppBusinessClient;