/**
 * Gov.br OAuth 2.0 Integration
 * Official integration with Brazil's unified government authentication system
 *
 * Features:
 * - OAuth 2.0 authorization flow
 * - CPF/CNPJ validation and verification
 * - Trust levels (bronze, silver, gold)
 * - Token refresh automation
 * - Profile synchronization
 * - Brazilian document validation
 */

import * as crypto from 'crypto';
import logger from '@/lib/monitoring/structured-logger';

// Gov.br Configuration
interface GovBrConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'production' | 'staging';
}

// Gov.br User Profile
interface GovBrUserProfile {
  sub: string; // CPF in the format XXX.XXX.XXX-XX
  name: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  phone_number_verified?: boolean;
  picture?: string;

  // Brazilian-specific fields
  cpf?: string; // CPF without formatting
  cnpj?: string; // For legal entities

  // Trust level (selo de confiabilidade)
  amr?: string[]; // Authentication methods

  // Additional Gov.br data
  social_name?: string; // Nome social
  birth_date?: string; // Data de nascimento
  given_name?: string; // Primeiro nome
  family_name?: string; // Sobrenome
}

// Trust Levels (Selos de Confiabilidade)
type TrustLevel = 'bronze' | 'silver' | 'gold';

interface TrustLevelInfo {
  level: TrustLevel;
  description: string;
  requirements: string[];
}

// OAuth Tokens
interface GovBrTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

// OAuth Error Response
interface GovBrError {
  error: string;
  error_description?: string;
}

class GovBrOAuthClient {
  private config: GovBrConfig;
  private baseUrl: string;

  constructor(config: GovBrConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://sso.acesso.gov.br'
      : 'https://sso.staging.acesso.gov.br';
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  generateAuthorizationUrl(
    state?: string,
    scopes: string[] = ['openid', 'email', 'phone', 'profile']
  ): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state: state || this.generateState(),
      nonce: this.generateNonce(),
    });

    return `${this.baseUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    success: boolean;
    tokens?: GovBrTokens;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as GovBrError;
        throw new Error(error.error_description || error.error);
      }

      return {
        success: true,
        tokens: data as GovBrTokens,
      };
    } catch (error) {
      logger.error('Gov.br token exchange error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean;
    tokens?: GovBrTokens;
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as GovBrError;
        throw new Error(error.error_description || error.error);
      }

      return {
        success: true,
        tokens: data as GovBrTokens,
      };
    } catch (error) {
      logger.error('Gov.br token refresh error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(accessToken: string): Promise<{
    success: boolean;
    profile?: GovBrUserProfile;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const error = data as GovBrError;
        throw new Error(error.error_description || error.error);
      }

      const profile = data as GovBrUserProfile;

      // Extract CPF from sub if not present
      if (!profile.cpf && profile.sub) {
        profile.cpf = this.extractCPFFromSub(profile.sub);
      }

      return {
        success: true,
        profile,
      };
    } catch (error) {
      logger.error('Gov.br user profile error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Revoke access token (logout)
   */
  async revokeToken(token: string): Promise<{ success: boolean }> {
    try {
      const params = new URLSearchParams({
        token,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await fetch(`${this.baseUrl}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      return { success: response.ok };
    } catch (error) {
      logger.error('Gov.br token revocation error', error);
      return { success: false };
    }
  }

  /**
   * Determine trust level based on authentication methods
   */
  getTrustLevel(amr?: string[]): TrustLevelInfo {
    if (!amr || amr.length === 0) {
      return {
        level: 'bronze',
        description: 'Selo Bronze - Cadastro validado',
        requirements: ['Email validado', 'Dados básicos confirmados'],
      };
    }

    // Gold: Certificate-based authentication or biometrics
    if (amr.includes('x509') || amr.includes('cert') || amr.includes('bio')) {
      return {
        level: 'gold',
        description: 'Selo Ouro - Identidade validada por certificado digital ou biometria',
        requirements: [
          'Certificado digital ICP-Brasil',
          'ou Biometria facial validada',
          'ou Validação presencial em banco',
        ],
      };
    }

    // Silver: Enhanced authentication with validated documents
    if (amr.includes('validated') || amr.includes('internet_banking')) {
      return {
        level: 'silver',
        description: 'Selo Prata - Documentos validados',
        requirements: [
          'Validação por internet banking',
          'ou Dados validados em bases governamentais',
        ],
      };
    }

    // Default to Bronze
    return {
      level: 'bronze',
      description: 'Selo Bronze - Cadastro validado',
      requirements: ['Email validado', 'Dados básicos confirmados'],
    };
  }

  /**
   * Validate CPF format and check digit
   */
  validateCPF(cpf: string): boolean {
    // Remove formatting
    const cleanCPF = cpf.replace(/[^\d]/g, '');

    // Check length
    if (cleanCPF.length !== 11) {
      return false;
    }

    // Check for known invalid CPFs (all same digit)
    if (/^(\d)\1{10}$/.test(cleanCPF)) {
      return false;
    }

    // Validate check digits
    let sum = 0;
    let remainder;

    // First check digit
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
      return false;
    }

    // Second check digit
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
      return false;
    }

    return true;
  }

  /**
   * Validate CNPJ format and check digit
   */
  validateCNPJ(cnpj: string): boolean {
    // Remove formatting
    const cleanCNPJ = cnpj.replace(/[^\d]/g, '');

    // Check length
    if (cleanCNPJ.length !== 14) {
      return false;
    }

    // Check for known invalid CNPJs (all same digit)
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
      return false;
    }

    // Validate check digits
    let length = cleanCNPJ.length - 2;
    let numbers = cleanCNPJ.substring(0, length);
    const digits = cleanCNPJ.substring(length);
    let sum = 0;
    let pos = length - 7;

    // First check digit
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) {
      return false;
    }

    // Second check digit
    length = length + 1;
    numbers = cleanCNPJ.substring(0, length);
    sum = 0;
    pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) {
      return false;
    }

    return true;
  }

  /**
   * Format CPF for display (XXX.XXX.XXX-XX)
   */
  formatCPF(cpf: string): string {
    const clean = cpf.replace(/[^\d]/g, '');
    if (clean.length !== 11) return cpf;
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Format CNPJ for display (XX.XXX.XXX/XXXX-XX)
   */
  formatCNPJ(cnpj: string): string {
    const clean = cnpj.replace(/[^\d]/g, '');
    if (clean.length !== 14) return cnpj;
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  /**
   * Extract CPF from Gov.br sub field
   */
  private extractCPFFromSub(sub: string): string {
    // Sub can be in format "XXX.XXX.XXX-XX" or just numbers
    return sub.replace(/[^\d]/g, '');
  }

  /**
   * Generate state parameter for OAuth (CSRF protection)
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate nonce parameter for OAuth (replay protection)
   */
  private generateNonce(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify state parameter (CSRF protection)
   */
  verifyState(state: string, expectedState: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(state),
      Buffer.from(expectedState)
    );
  }

  /**
   * Get logout URL
   */
  getLogoutUrl(postLogoutRedirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
    });

    if (postLogoutRedirectUri) {
      params.append('post_logout_redirect_uri', postLogoutRedirectUri);
    }

    return `${this.baseUrl}/logout?${params.toString()}`;
  }
}

// Singleton instance
let govbrClient: GovBrOAuthClient | null = null;

export function getGovBrClient(): GovBrOAuthClient {
  if (!govbrClient) {
    const config: GovBrConfig = {
      clientId: process.env.GOVBR_CLIENT_ID || '',
      clientSecret: process.env.GOVBR_CLIENT_SECRET || '',
      redirectUri: process.env.GOVBR_REDIRECT_URI || '',
      environment: (process.env.GOVBR_ENVIRONMENT as 'production' | 'staging') || 'staging',
    };

    govbrClient = new GovBrOAuthClient(config);
  }

  return govbrClient;
}

// Helper function to sync Gov.br profile with local user
export async function syncGovBrProfile(
  profile: GovBrUserProfile,
  _tokens: GovBrTokens
): Promise<{
  success: boolean;
  userId?: number;
  error?: string;
}> {
  try {
    // This would integrate with your user management system
    // For now, return a placeholder

    const client = getGovBrClient();
    const trustLevel = client.getTrustLevel(profile.amr);

    logger.info('Syncing Gov.br profile', {
      cpf: profile.cpf ? client.formatCPF(profile.cpf) : undefined,
      name: profile.name,
      email: profile.email,
      trustLevel: trustLevel.level,
    });

    // TODO: Implement actual user creation/update logic
    // - Check if user exists by CPF
    // - Create or update user record
    // - Store Gov.br tokens for refresh
    // - Set trust level
    // - Return user ID

    return {
      success: true,
      userId: 1, // Placeholder
    };
  } catch (error) {
    logger.error('Error syncing Gov.br profile', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export types and constants
export type {
  GovBrConfig,
  GovBrUserProfile,
  GovBrTokens,
  GovBrError,
  TrustLevel,
  TrustLevelInfo,
};

export { GovBrOAuthClient };
