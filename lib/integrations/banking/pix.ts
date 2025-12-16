/**
 * PIX Integration
 * Sistema de integração com PIX (Pagamento Instantâneo Brasileiro)
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { getSystemSetting } from '@/lib/db/queries';
import logger from '@/lib/monitoring/structured-logger';

interface PixConfig {
  bankCode: string;
  clientId: string;
  clientSecret: string;
  certificatePath?: string;
  privateKeyPath?: string;
  environment: 'sandbox' | 'production';
  apiVersion: string;
}

interface PixCharge {
  calendario: {
    criacao: string;
    expiracao: number;
  };
  devedor?: {
    cpf?: string;
    cnpj?: string;
    nome: string;
  };
  valor: {
    original: string;
  };
  chave: string;
  solicitacaoPagador?: string;
  infoAdicionais?: Array<{
    nome: string;
    valor: string;
  }>;
}

interface PixChargeResponse {
  calendario: {
    criacao: string;
    expiracao: number;
  };
  txid: string;
  revisao: number;
  location: string;
  status: 'ATIVA' | 'CONCLUIDA' | 'REMOVIDA_PELO_USUARIO_RECEBEDOR' | 'REMOVIDA_PELO_PSP';
  devedor?: {
    cpf?: string;
    cnpj?: string;
    nome: string;
  };
  valor: {
    original: string;
  };
  chave: string;
  solicitacaoPagador?: string;
  infoAdicionais?: Array<{
    nome: string;
    valor: string;
  }>;
  pixCopiaECola?: string;
}

interface PixPayment {
  endToEndId: string;
  txid: string;
  valor: string;
  chave: string;
  horario: string;
  infoPagador?: string;
  devolucoes?: Array<{
    id: string;
    rtrId: string;
    valor: string;
    horario: {
      solicitacao: string;
      liquidacao?: string;
    };
    status: 'EM_PROCESSAMENTO' | 'DEVOLVIDO' | 'NAO_REALIZADO';
  }>;
}

interface PixRefund {
  id: string;
  rtrId: string;
  valor: string;
  horario: {
    solicitacao: string;
    liquidacao?: string;
  };
  status: 'EM_PROCESSAMENTO' | 'DEVOLVIDO' | 'NAO_REALIZADO';
}

interface PixQRCodeStatic {
  qrcode: string;
  imagemQrcode: string;
  linkVisualizacao: string;
}

interface PixQRCodeDynamic {
  qrcode: string;
  imagemQrcode: string;
  linkVisualizacao: string;
  txid: string;
  location: string;
}

export class PixClient {
  private api: AxiosInstance;
  private config: PixConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  // URLs dos principais bancos brasileiros
  private bankEndpoints: Record<string, { sandbox: string; production: string }> = {
    '033': { // Santander
      sandbox: 'https://api-sandbox.santander.com.br/pix/v2',
      production: 'https://api.santander.com.br/pix/v2'
    },
    '237': { // Bradesco
      sandbox: 'https://api-sandbox.bradesco.com.br/pix/v2',
      production: 'https://api.bradesco.com.br/pix/v2'
    },
    '001': { // Banco do Brasil
      sandbox: 'https://api-sandbox.bb.com.br/pix/v2',
      production: 'https://api.bb.com.br/pix/v2'
    },
    '104': { // Caixa
      sandbox: 'https://api-sandbox.caixa.gov.br/pix/v2',
      production: 'https://api.caixa.gov.br/pix/v2'
    },
    '341': { // Itaú
      sandbox: 'https://api-sandbox.itau.com.br/pix/v2',
      production: 'https://api.itau.com.br/pix/v2'
    },
    '260': { // Nu Pagamentos (Nubank)
      sandbox: 'https://api-sandbox.nubank.com.br/pix/v2',
      production: 'https://api.nubank.com.br/pix/v2'
    }
  };

  constructor(config: PixConfig) {
    this.config = config;

    const endpoint = this.bankEndpoints[config.bankCode];
    if (!endpoint) {
      throw new Error(`Bank code ${config.bankCode} not supported`);
    }

    const baseURL = endpoint[config.environment];

    this.api = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ServiceDesk/1.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor para adicionar token de acesso
    this.api.interceptors.request.use(async (config) => {
      await this.ensureValidToken();

      if (this.accessToken) {
        config.headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      return config;
    });

    // Response interceptor para tratar erros
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expirado, tenta renovar
          this.accessToken = undefined;
          this.tokenExpiresAt = undefined;

          // Retry a requisição
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            await this.ensureValidToken();

            if (this.accessToken) {
              originalRequest.headers['Authorization'] = `Bearer ${this.accessToken}`;
              return this.api(originalRequest);
            }
          }
        }

        throw error;
      }
    );
  }

  /**
   * Garante que o token de acesso é válido
   */
  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return;
    }

    await this.authenticate();
  }

  /**
   * Autentica com o banco e obtém token de acesso
   */
  private async authenticate(): Promise<void> {
    try {
      const authData = {
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'pix.read pix.write'
      };

      const response = await axios.post(
        `${this.api.defaults.baseURL}/oauth/token`,
        new URLSearchParams(authData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 60) * 1000); // 60s buffer
    } catch (error) {
      logger.error('PIX authentication failed', error);
      throw new Error('Failed to authenticate with PIX API');
    }
  }

  /**
   * Cria cobrança PIX
   */
  async createCharge(
    txid: string,
    charge: PixCharge
  ): Promise<PixChargeResponse> {
    try {
      // Valida txid (deve ter 25-35 caracteres alfanuméricos)
      if (!/^[a-zA-Z0-9]{25,35}$/.test(txid)) {
        throw new Error('Invalid txid format');
      }

      const response = await this.api.put(`/cob/${txid}`, charge);
      return response.data;
    } catch (error) {
      logger.error('Error creating PIX charge', error);
      throw error;
    }
  }

  /**
   * Consulta cobrança PIX
   */
  async getCharge(txid: string): Promise<PixChargeResponse> {
    try {
      const response = await this.api.get(`/cob/${txid}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching PIX charge', error);
      throw error;
    }
  }

  /**
   * Lista cobranças PIX
   */
  async listCharges(params: {
    inicio: string; // RFC3339
    fim: string; // RFC3339
    cpf?: string;
    cnpj?: string;
    status?: 'ATIVA' | 'CONCLUIDA' | 'REMOVIDA_PELO_USUARIO_RECEBEDOR' | 'REMOVIDA_PELO_PSP';
    paginacao?: {
      paginaAtual?: number;
      itensPorPagina?: number;
    };
  }): Promise<{
    parametros: any;
    cobs: PixChargeResponse[];
  }> {
    try {
      const queryParams = new URLSearchParams({
        inicio: params.inicio,
        fim: params.fim
      });

      if (params.cpf) queryParams.append('cpf', params.cpf);
      if (params.cnpj) queryParams.append('cnpj', params.cnpj);
      if (params.status) queryParams.append('status', params.status);

      if (params.paginacao) {
        if (params.paginacao.paginaAtual) {
          queryParams.append('paginacao.paginaAtual', params.paginacao.paginaAtual.toString());
        }
        if (params.paginacao.itensPorPagina) {
          queryParams.append('paginacao.itensPorPagina', params.paginacao.itensPorPagina.toString());
        }
      }

      const response = await this.api.get(`/cob?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error listing PIX charges', error);
      throw error;
    }
  }

  /**
   * Atualiza cobrança PIX
   */
  async updateCharge(
    txid: string,
    updates: Partial<PixCharge>
  ): Promise<PixChargeResponse> {
    try {
      const response = await this.api.patch(`/cob/${txid}`, updates);
      return response.data;
    } catch (error) {
      logger.error('Error updating PIX charge', error);
      throw error;
    }
  }

  /**
   * Remove cobrança PIX
   */
  async removeCharge(txid: string): Promise<PixChargeResponse> {
    try {
      const response = await this.api.delete(`/cob/${txid}`);
      return response.data;
    } catch (error) {
      logger.error('Error removing PIX charge', error);
      throw error;
    }
  }

  /**
   * Consulta pagamento PIX
   */
  async getPayment(e2eid: string): Promise<PixPayment> {
    try {
      const response = await this.api.get(`/pix/${e2eid}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching PIX payment', error);
      throw error;
    }
  }

  /**
   * Lista pagamentos PIX
   */
  async listPayments(params: {
    inicio: string; // RFC3339
    fim: string; // RFC3339
    txid?: string;
    txIdPresente?: boolean;
    devolucaoPresente?: boolean;
    cpf?: string;
    cnpj?: string;
    paginacao?: {
      paginaAtual?: number;
      itensPorPagina?: number;
    };
  }): Promise<{
    parametros: any;
    pix: PixPayment[];
  }> {
    try {
      const queryParams = new URLSearchParams({
        inicio: params.inicio,
        fim: params.fim
      });

      if (params.txid) queryParams.append('txid', params.txid);
      if (params.txIdPresente !== undefined) {
        queryParams.append('txIdPresente', params.txIdPresente.toString());
      }
      if (params.devolucaoPresente !== undefined) {
        queryParams.append('devolucaoPresente', params.devolucaoPresente.toString());
      }
      if (params.cpf) queryParams.append('cpf', params.cpf);
      if (params.cnpj) queryParams.append('cnpj', params.cnpj);

      if (params.paginacao) {
        if (params.paginacao.paginaAtual) {
          queryParams.append('paginacao.paginaAtual', params.paginacao.paginaAtual.toString());
        }
        if (params.paginacao.itensPorPagina) {
          queryParams.append('paginacao.itensPorPagina', params.paginacao.itensPorPagina.toString());
        }
      }

      const response = await this.api.get(`/pix?${queryParams.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Error listing PIX payments', error);
      throw error;
    }
  }

  /**
   * Solicita devolução PIX
   */
  async requestRefund(
    e2eid: string,
    id: string,
    valor: string,
    natureza: 'ORIGINAL' | 'RETIRADA' = 'ORIGINAL',
    descricao?: string
  ): Promise<PixRefund> {
    try {
      const refundData = {
        valor,
        natureza,
        descricao
      };

      const response = await this.api.put(`/pix/${e2eid}/devolucao/${id}`, refundData);
      return response.data;
    } catch (error) {
      logger.error('Error requesting PIX refund', error);
      throw error;
    }
  }

  /**
   * Consulta devolução PIX
   */
  async getRefund(e2eid: string, id: string): Promise<PixRefund> {
    try {
      const response = await this.api.get(`/pix/${e2eid}/devolucao/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching PIX refund', error);
      throw error;
    }
  }

  /**
   * Gera QR Code estático PIX
   */
  async generateStaticQRCode(
    key: string,
    amount?: string,
    description?: string,
    merchantName?: string,
    merchantCity?: string
  ): Promise<PixQRCodeStatic> {
    try {
      const qrData = {
        chave: key,
        valor: amount,
        solicitacaoPagador: description,
        nomeRecebedor: merchantName,
        cidadeRecebedor: merchantCity
      };

      const response = await this.api.post('/qrcode/estatico', qrData);
      return response.data;
    } catch (error) {
      logger.error('Error generating static QR code', error);
      throw error;
    }
  }

  /**
   * Gera QR Code dinâmico PIX
   */
  async generateDynamicQRCode(txid: string): Promise<PixQRCodeDynamic> {
    try {
      const response = await this.api.get(`/qrcode/${txid}`);
      return response.data;
    } catch (error) {
      logger.error('Error generating dynamic QR code', error);
      throw error;
    }
  }

  /**
   * Valida chave PIX
   */
  validatePixKey(key: string): {
    valid: boolean;
    type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    formatted?: string;
  } {
    // Remove espaços e caracteres especiais para validação
    const cleanKey = key.replace(/\s/g, '');

    // CPF (11 dígitos)
    if (/^\d{11}$/.test(cleanKey)) {
      if (this.isValidCPF(cleanKey)) {
        return {
          valid: true,
          type: 'cpf',
          formatted: this.formatCPF(cleanKey)
        };
      }
      return { valid: false };
    }

    // CNPJ (14 dígitos)
    if (/^\d{14}$/.test(cleanKey)) {
      if (this.isValidCNPJ(cleanKey)) {
        return {
          valid: true,
          type: 'cnpj',
          formatted: this.formatCNPJ(cleanKey)
        };
      }
      return { valid: false };
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(cleanKey)) {
      return {
        valid: true,
        type: 'email',
        formatted: cleanKey.toLowerCase()
      };
    }

    // Telefone (10 ou 11 dígitos)
    const phoneRegex = /^\+?55\d{10,11}$|^\d{10,11}$/;
    if (phoneRegex.test(cleanKey.replace(/\D/g, ''))) {
      const digits = cleanKey.replace(/\D/g, '');
      if (digits.length === 10 || digits.length === 11) {
        return {
          valid: true,
          type: 'phone',
          formatted: this.formatPhone(digits)
        };
      }
    }

    // Chave aleatória (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(cleanKey)) {
      return {
        valid: true,
        type: 'random',
        formatted: cleanKey.toLowerCase()
      };
    }

    return { valid: false };
  }

  /**
   * Gera txid aleatório válido
   */
  generateTxid(): string {
    return crypto.randomBytes(16).toString('hex').toLowerCase().substring(0, 32);
  }

  /**
   * Gera ID de devolução aleatório
   */
  generateRefundId(): string {
    return crypto.randomBytes(16).toString('hex').toLowerCase().substring(0, 32);
  }

  /**
   * Validações auxiliares
   */
  private isValidCPF(cpf: string): boolean {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }

    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    return remainder === parseInt(cpf.charAt(10));
  }

  private isValidCNPJ(cnpj: string): boolean {
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
      return false;
    }

    let length = cnpj.length - 2;
    let numbers = cnpj.substring(0, length);
    const digits = cnpj.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length = length + 1;
    numbers = cnpj.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === parseInt(digits.charAt(1));
  }

  /**
   * Formatação auxiliar
   */
  private formatCPF(cpf: string): string {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  private formatCNPJ(cnpj: string): string {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  private formatPhone(phone: string): string {
    if (phone.length === 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  }

  /**
   * Factory method para criar cliente a partir das configurações do sistema
   */
  static async createFromSystemSettings(): Promise<PixClient> {
    const [
      bankCode,
      clientId,
      clientSecret,
      environment = 'sandbox',
      apiVersion = 'v2'
    ] = await Promise.all([
      getSystemSetting('pix_bank_code'),
      getSystemSetting('pix_client_id'),
      getSystemSetting('pix_client_secret'),
      getSystemSetting('pix_environment'),
      getSystemSetting('pix_api_version')
    ]);

    if (!bankCode || !clientId || !clientSecret) {
      throw new Error('PIX configuration incomplete. Please check system settings.');
    }

    return new PixClient({
      bankCode,
      clientId,
      clientSecret,
      environment: environment as 'sandbox' | 'production',
      apiVersion: apiVersion || 'v2'
    });
  }
}

export default PixClient;