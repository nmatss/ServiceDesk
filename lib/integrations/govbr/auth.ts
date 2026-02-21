/**
 * Gov.br Authentication Integration
 * Sistema de autenticação com login único gov.br
 */

import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { executeQueryOne } from '@/lib/db/adapter';

async function getSystemSetting(key: string): Promise<string | null> {
  const row = await executeQueryOne<{ value: string }>(
    'SELECT value FROM system_settings WHERE key = ? AND organization_id IS NULL LIMIT 1',
    [key]
  );
  return row?.value ?? null;
}
import logger from '@/lib/monitoring/structured-logger';

interface GovBrConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  environment: 'sandbox' | 'production';
}

interface GovBrTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface GovBrUserInfo {
  sub: string; // CPF
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  email_verified: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  picture?: string;
  cpf: string;
  cnpj?: string;
  niveis_confiabilidade: string[];
  amr?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface GovBrAuthState {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  scope: string;
}

export class GovBrAuthClient {
  private config: GovBrConfig;
  private api: AxiosInstance;
  private baseUrls = {
    sandbox: {
      auth: 'https://sso.staging.acesso.gov.br',
      api: 'https://api.staging.acesso.gov.br'
    },
    production: {
      auth: 'https://sso.acesso.gov.br',
      api: 'https://api.acesso.gov.br'
    }
  };

  constructor(config: GovBrConfig) {
    this.config = config;
    const urls = this.baseUrls[config.environment];

    this.api = axios.create({
      baseURL: urls.api,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ServiceDesk/1.0'
      }
    });
  }

  /**
   * Gera URL de autorização OAuth2 com PKCE
   */
  generateAuthorizationUrl(state?: string): {
    url: string;
    state: string;
    codeVerifier: string;
  } {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const stateParam = state || this.generateState();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state: stateParam,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      nonce: crypto.randomBytes(16).toString('hex')
    });

    const authUrl = this.baseUrls[this.config.environment].auth;
    const url = `${authUrl}/authorize?${params.toString()}`;

    return {
      url,
      state: stateParam,
      codeVerifier
    };
  }

  /**
   * Troca código de autorização por tokens
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    _state: string
  ): Promise<GovBrTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code,
      code_verifier: codeVerifier
    });

    const response = await this.api.post('/token', params);
    return response.data;
  }

  /**
   * Renova token de acesso usando refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GovBrTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken
    });

    const response = await this.api.post('/token', params);
    return response.data;
  }

  /**
   * Obtém informações do usuário
   */
  async getUserInfo(accessToken: string): Promise<GovBrUserInfo> {
    const response = await this.api.get('/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  /**
   * Valida CPF/CNPJ com APIs governamentais
   */
  async validateDocument(
    document: string,
    accessToken: string,
    type: 'cpf' | 'cnpj' = 'cpf'
  ): Promise<{
    valid: boolean;
    data?: any;
    status: string;
  }> {
    try {
      // Para CPF, usa API da Receita Federal
      if (type === 'cpf') {
        return await this.validateCPF(document, accessToken);
      }

      // Para CNPJ, usa API da Receita Federal
      if (type === 'cnpj') {
        return await this.validateCNPJ(document, accessToken);
      }

      return { valid: false, status: 'invalid_type' };
    } catch (error) {
      logger.error('Error validating document', error);
      return { valid: false, status: 'validation_error' };
    }
  }

  /**
   * Valida CPF na Receita Federal
   */
  private async validateCPF(cpf: string, _accessToken: string): Promise<{
    valid: boolean;
    data?: any;
    status: string;
  }> {
    // Remove formatação do CPF
    const cleanCpf = cpf.replace(/\D/g, '');

    if (cleanCpf.length !== 11) {
      return { valid: false, status: 'invalid_format' };
    }

    // Validação algorítmica do CPF
    if (!this.isValidCPF(cleanCpf)) {
      return { valid: false, status: 'invalid_algorithm' };
    }

    try {
      // Em produção, integraria com APIs da Receita Federal
      // Por enquanto, retorna válido se passou na validação algorítmica
      return {
        valid: true,
        status: 'valid',
        data: {
          cpf: cleanCpf,
          formatted: this.formatCPF(cleanCpf)
        }
      };
    } catch (error) {
      return { valid: false, status: 'api_error' };
    }
  }

  /**
   * Valida CNPJ na Receita Federal
   */
  private async validateCNPJ(cnpj: string, _accessToken: string): Promise<{
    valid: boolean;
    data?: any;
    status: string;
  }> {
    // Remove formatação do CNPJ
    const cleanCnpj = cnpj.replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      return { valid: false, status: 'invalid_format' };
    }

    // Validação algorítmica do CNPJ
    if (!this.isValidCNPJ(cleanCnpj)) {
      return { valid: false, status: 'invalid_algorithm' };
    }

    try {
      // Em produção, integraria com APIs da Receita Federal
      // API da Receita: https://www.receitaws.com.br/v1/cnpj/{cnpj}
      const response = await axios.get(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
        timeout: 10000
      });

      if (response.data.status === 'OK') {
        return {
          valid: true,
          status: 'valid',
          data: {
            cnpj: cleanCnpj,
            formatted: this.formatCNPJ(cleanCnpj),
            companyName: response.data.nome,
            fantasyName: response.data.fantasia,
            situation: response.data.situacao,
            openingDate: response.data.abertura,
            address: {
              street: response.data.logradouro,
              number: response.data.numero,
              complement: response.data.complemento,
              district: response.data.bairro,
              city: response.data.municipio,
              state: response.data.uf,
              zipCode: response.data.cep
            },
            phone: response.data.telefone,
            email: response.data.email,
            activities: response.data.atividade_principal
          }
        };
      }

      return { valid: false, status: 'not_found' };
    } catch (error) {
      logger.error('Error validating CNPJ', error);
      return { valid: false, status: 'api_error' };
    }
  }

  /**
   * Revoga token de acesso
   */
  async revokeToken(token: string): Promise<void> {
    const params = new URLSearchParams({
      token,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    await this.api.post('/revoke', params);
  }

  /**
   * Gera code verifier para PKCE
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Gera code challenge para PKCE
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  /**
   * Gera state aleatório
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Valida CPF algoritmicamente
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

  /**
   * Valida CNPJ algoritmicamente
   */
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
   * Formata CPF
   */
  private formatCPF(cpf: string): string {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Formata CNPJ
   */
  private formatCNPJ(cnpj: string): string {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  /**
   * Factory method para criar cliente a partir das configurações do sistema
   */
  static async createFromSystemSettings(): Promise<GovBrAuthClient> {
    const [
      clientId,
      clientSecret,
      redirectUri,
      scope,
      environment
    ] = await Promise.all([
      getSystemSetting('govbr_client_id'),
      getSystemSetting('govbr_client_secret'),
      getSystemSetting('govbr_redirect_uri'),
      getSystemSetting('govbr_scope'),
      getSystemSetting('govbr_environment')
    ]);

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Gov.br configuration incomplete. Please check system settings.');
    }

    return new GovBrAuthClient({
      clientId,
      clientSecret,
      redirectUri,
      scope: scope || 'openid profile email phone cpf',
      environment: (environment || 'sandbox') as 'sandbox' | 'production'
    });
  }
}

export default GovBrAuthClient;