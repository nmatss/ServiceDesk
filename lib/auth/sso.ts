import * as crypto from 'crypto';
import db from '../db/connection';
import logger from '../monitoring/structured-logger';
import {
  SSOProvider,
  CreateSSOProvider,
  User
} from '../types/database';
import { logAuthEvent, getUserByEmail, registerUser } from './enterprise-auth';

// ========================================
// SSO (Single Sign-On) Infrastructure
// ========================================

/**
 * Sistema de SSO para integração com provedores externos:
 * - SAML 2.0 (Active Directory, outros IdPs corporativos)
 * - OAuth 2.0 / OpenID Connect (Google, Microsoft, etc.)
 * - LDAP (Active Directory, OpenLDAP)
 * - gov.br (integração com conta única do governo brasileiro)
 */

// ========================================
// INTERFACES E TIPOS
// ========================================

export interface SSOConfiguration {
  // SAML 2.0 Configuration
  saml?: {
    entryPoint: string;
    issuer: string;
    cert: string;
    privateCert?: string;
    signatureAlgorithm?: string;
    digestAlgorithm?: string;
    attributeMapping?: {
      email: string;
      name: string;
      role?: string;
      department?: string;
    };
  };

  // OAuth 2.0 / OIDC Configuration
  oauth?: {
    authorizationURL: string;
    tokenURL: string;
    userInfoURL: string;
    clientId: string;
    clientSecret: string;
    scope: string[];
    responseType: string;
    grantType: string;
    attributeMapping?: {
      email: string;
      name: string;
      role?: string;
      department?: string;
    };
  };

  // LDAP Configuration
  ldap?: {
    server: string;
    port: number;
    bindDN: string;
    bindPassword: string;
    searchBase: string;
    searchFilter: string;
    tlsEnabled: boolean;
    attributeMapping: {
      email: string;
      name: string;
      role?: string;
      department?: string;
    };
  };

  // gov.br Configuration
  govbr?: {
    clientId: string;
    clientSecret: string;
    environment: 'homologacao' | 'producao';
    scope: string[];
    redirectUri: string;
  };
}

export interface SSOAuthRequest {
  providerId: number;
  returnUrl?: string;
  state?: string;
}

export interface SSOAuthResponse {
  success: boolean;
  user?: User;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
  error?: string;
  redirectUrl?: string;
}

export interface SSOUserProfile {
  email: string;
  name: string;
  role?: string;
  department?: string;
  avatarUrl?: string;
  metadata?: any;
}

// ========================================
// FUNÇÕES DE GERENCIAMENTO DE PROVEDORES SSO
// ========================================

export function createSSOProvider(providerData: CreateSSOProvider): SSOProvider | null {
  try {
    // Criptografar configurações sensíveis
    const encryptedConfig = encryptSSOConfiguration(providerData.configuration);

    const stmt = db.prepare(`
      INSERT INTO sso_providers (name, display_name, type, is_active, configuration, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      providerData.name,
      providerData.display_name,
      providerData.type,
      providerData.is_active ? 1 : 0,
      encryptedConfig,
      providerData.metadata
    );

    return getSSOProviderById(result.lastInsertRowid as number);
  } catch (error) {
    logger.error('Error creating SSO provider', error);
    return null;
  }
}

export function getSSOProviderById(id: number): SSOProvider | null {
  try {
    const provider = db.prepare('SELECT * FROM sso_providers WHERE id = ?').get(id) as SSOProvider;
    if (!provider) return null;

    // Descriptografar configuração
    provider.configuration = decryptSSOConfiguration(provider.configuration);
    return provider;
  } catch (error) {
    logger.error('Error getting SSO provider by ID', error);
    return null;
  }
}

export function getSSOProviderByName(name: string): SSOProvider | null {
  try {
    const provider = db.prepare('SELECT * FROM sso_providers WHERE name = ? AND is_active = 1').get(name) as SSOProvider;
    if (!provider) return null;

    provider.configuration = decryptSSOConfiguration(provider.configuration);
    return provider;
  } catch (error) {
    logger.error('Error getting SSO provider by name', error);
    return null;
  }
}

export function getAllSSOProviders(): SSOProvider[] {
  try {
    const providers = db.prepare('SELECT * FROM sso_providers ORDER BY display_name').all() as SSOProvider[];
    return providers.map(provider => ({
      ...provider,
      configuration: decryptSSOConfiguration(provider.configuration)
    }));
  } catch (error) {
    logger.error('Error getting all SSO providers', error);
    return [];
  }
}

export function getActiveSSOProviders(): SSOProvider[] {
  try {
    const providers = db.prepare('SELECT * FROM sso_providers WHERE is_active = 1 ORDER BY display_name').all() as SSOProvider[];
    return providers.map(provider => ({
      ...provider,
      configuration: decryptSSOConfiguration(provider.configuration)
    }));
  } catch (error) {
    logger.error('Error getting active SSO providers', error);
    return [];
  }
}

export function updateSSOProvider(id: number, updates: Partial<Omit<SSOProvider, 'id' | 'created_at'>>): boolean {
  try {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        if (key === 'configuration') {
          fields.push(`${key} = ?`);
          values.push(encryptSSOConfiguration(value as string));
        } else {
          fields.push(`${key} = ?`);
          values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
        }
      }
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE sso_providers SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error updating SSO provider', error);
    return false;
  }
}

export function deleteSSOProvider(id: number): boolean {
  try {
    const result = db.prepare('DELETE FROM sso_providers WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error deleting SSO provider', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE CRIPTOGRAFIA
// ========================================

function getSSO_ENCRYPTION_KEY(): string {
  const key = process.env.SSO_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      '🔴 FATAL: SSO_ENCRYPTION_KEY environment variable is required when SSO is enabled!\n' +
      'Generate a secure key with:\n' +
      '  openssl rand -hex 32\n' +
      'Then set it in your .env file:\n' +
      '  SSO_ENCRYPTION_KEY=<generated-key>\n' +
      'Or disable SSO if not needed: ENABLE_SSO=false'
    );
  }

  if (key.length < 32) {
    throw new Error(
      `🔴 FATAL: SSO_ENCRYPTION_KEY must be at least 32 characters!\n` +
      `Current length: ${key.length}\n` +
      'Generate: openssl rand -hex 32'
    );
  }

  // Check for weak patterns
  const weakPatterns = ['default', 'dev', 'test', 'change-me', 'secret'];
  const lowerKey = key.toLowerCase();
  for (const pattern of weakPatterns) {
    if (lowerKey.includes(pattern)) {
      throw new Error(
        `🔴 FATAL: SSO_ENCRYPTION_KEY contains weak pattern "${pattern}"!\n` +
        'Generate a strong random key with: openssl rand -hex 32'
      );
    }
  }

  return key;
}

const ALGORITHM = 'aes-256-gcm';

function encryptSSOConfiguration(config: string): string {
  try {
    const ENCRYPTION_KEY = getSSO_ENCRYPTION_KEY();
    const iv = crypto.randomBytes(16);
    // Derive a proper 32-byte key for AES-256
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'sso-salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(config, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Error encrypting SSO configuration', error);
    return config; // Fallback to unencrypted in case of error
  }
}

function decryptSSOConfiguration(encryptedConfig: string): string {
  try {
    if (!encryptedConfig.includes(':')) {
      return encryptedConfig; // Not encrypted or old format
    }

    const parts = encryptedConfig.split(':');
    if (parts.length !== 3) {
      return encryptedConfig; // Invalid format
    }

    const [ivHex, tagHex, encrypted] = parts;
    if (!ivHex || !tagHex || !encrypted) {
      return encryptedConfig; // Missing parts
    }

    const ENCRYPTION_KEY = getSSO_ENCRYPTION_KEY();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    // Derive the same 32-byte key for AES-256
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'sso-salt', 32);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Error decrypting SSO configuration', error);
    return encryptedConfig; // Fallback to encrypted string
  }
}

// ========================================
// SAML 2.0 IMPLEMENTATION
// ========================================

export async function initiateSAMLAuth(request: SSOAuthRequest): Promise<SSOAuthResponse> {
  try {
    const provider = getSSOProviderById(request.providerId);
    if (!provider || provider.type !== 'saml2') {
      return { success: false, error: 'Invalid SAML provider' };
    }

    const config = JSON.parse(provider.configuration) as SSOConfiguration;
    if (!config.saml) {
      return { success: false, error: 'Invalid SAML configuration' };
    }

    // Gerar SAML AuthnRequest
    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const redirectUrl = buildSAMLRedirectUrl(config.saml, requestId, timestamp, request.returnUrl);

    return {
      success: true,
      redirectUrl
    };
  } catch (error) {
    logger.error('Error initiating SAML auth', error);
    return { success: false, error: 'SAML authentication failed' };
  }
}

export async function handleSAMLResponse(
  samlResponse: string,
  providerId: number,
  clientIp?: string,
  userAgent?: string
): Promise<SSOAuthResponse> {
  try {
    const provider = getSSOProviderById(providerId);
    if (!provider || provider.type !== 'saml2') {
      return { success: false, error: 'Invalid SAML provider' };
    }

    const config = JSON.parse(provider.configuration) as SSOConfiguration;
    if (!config.saml) {
      return { success: false, error: 'Invalid SAML configuration' };
    }

    // Validar e decodificar resposta SAML
    const userProfile = await validateSAMLResponse(samlResponse, config.saml);
    if (!userProfile) {
      return { success: false, error: 'Invalid SAML response' };
    }

    // Processar usuário
    const authResult = await processExternalUser(userProfile, provider, clientIp, userAgent);
    return authResult;

  } catch (error) {
    logger.error('Error handling SAML response', error);
    return { success: false, error: 'SAML response processing failed' };
  }
}

function buildSAMLRedirectUrl(
  samlConfig: NonNullable<SSOConfiguration['saml']>,
  requestId: string,
  timestamp: string,
  returnUrl?: string
): string {
  const samlRequest = `
    <samlp:AuthnRequest
      ID="${requestId}"
      Version="2.0"
      IssueInstant="${timestamp}"
      Destination="${samlConfig.entryPoint}"
      AssertionConsumerServiceURL="${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/acs"
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
      <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${samlConfig.issuer}</saml:Issuer>
    </samlp:AuthnRequest>
  `;

  const encodedRequest = Buffer.from(samlRequest).toString('base64');
  const params = new URLSearchParams({
    SAMLRequest: encodedRequest,
    RelayState: returnUrl || '/'
  });

  return `${samlConfig.entryPoint}?${params.toString()}`;
}

async function validateSAMLResponse(samlResponse: string, _samlConfig: NonNullable<SSOConfiguration['saml']>): Promise<SSOUserProfile | null> {
  try {
    // Decodificar resposta SAML (validation implementation needed)
    Buffer.from(samlResponse, 'base64').toString('utf8');

    // Aqui você implementaria a validação completa do SAML:
    // - Verificar assinatura digital
    // - Validar timestamps
    // - Extrair atributos do usuário

    // Por simplicidade, vamos simular a extração de atributos
    // Em produção, use uma biblioteca como node-saml ou passport-saml

    const mockProfile: SSOUserProfile = {
      email: 'user@company.com', // Extrair do SAML
      name: 'User Name', // Extrair do SAML
      role: 'agent', // Mapear do SAML
      department: 'IT' // Extrair do SAML
    };

    return mockProfile;
  } catch (error) {
    logger.error('Error validating SAML response', error);
    return null;
  }
}

// ========================================
// OAUTH 2.0 / OPENID CONNECT IMPLEMENTATION
// ========================================

export async function initiateOAuth2Auth(request: SSOAuthRequest): Promise<SSOAuthResponse> {
  try {
    const provider = getSSOProviderById(request.providerId);
    if (!provider || provider.type !== 'oauth2') {
      return { success: false, error: 'Invalid OAuth2 provider' };
    }

    const config = JSON.parse(provider.configuration) as SSOConfiguration;
    if (!config.oauth) {
      return { success: false, error: 'Invalid OAuth2 configuration' };
    }

    // Gerar state para CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Construir URL de autorização
    const authParams = new URLSearchParams({
      response_type: config.oauth.responseType,
      client_id: config.oauth.clientId,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/callback`,
      scope: config.oauth.scope.join(' '),
      state: state
    });

    const redirectUrl = `${config.oauth.authorizationURL}?${authParams.toString()}`;

    return {
      success: true,
      redirectUrl
    };
  } catch (error) {
    logger.error('Error initiating OAuth2 auth', error);
    return { success: false, error: 'OAuth2 authentication failed' };
  }
}

export async function handleOAuth2Callback(
  code: string,
  _state: string,
  providerId: number,
  clientIp?: string,
  userAgent?: string
): Promise<SSOAuthResponse> {
  try {
    const provider = getSSOProviderById(providerId);
    if (!provider || provider.type !== 'oauth2') {
      return { success: false, error: 'Invalid OAuth2 provider' };
    }

    const config = JSON.parse(provider.configuration) as SSOConfiguration;
    if (!config.oauth) {
      return { success: false, error: 'Invalid OAuth2 configuration' };
    }

    // Trocar code por access token
    const tokenResponse = await exchangeCodeForToken(code, config.oauth);
    if (!tokenResponse) {
      return { success: false, error: 'Failed to exchange authorization code' };
    }

    // Buscar perfil do usuário
    const userProfile = await fetchOAuth2UserProfile(tokenResponse.access_token, config.oauth);
    if (!userProfile) {
      return { success: false, error: 'Failed to fetch user profile' };
    }

    // Processar usuário
    const authResult = await processExternalUser(userProfile, provider, clientIp, userAgent);
    return authResult;

  } catch (error) {
    logger.error('Error handling OAuth2 callback', error);
    return { success: false, error: 'OAuth2 callback processing failed' };
  }
}

async function exchangeCodeForToken(code: string, oauthConfig: NonNullable<SSOConfiguration['oauth']>): Promise<{ access_token: string; [key: string]: any } | null> {
  try {
    const tokenParams = new URLSearchParams({
      grant_type: oauthConfig.grantType,
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      code: code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/oauth/callback`
    });

    const response = await fetch(oauthConfig.tokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error exchanging code for token', error);
    return null;
  }
}

async function fetchOAuth2UserProfile(accessToken: string, oauthConfig: NonNullable<SSOConfiguration['oauth']>): Promise<SSOUserProfile | null> {
  try {
    const response = await fetch(oauthConfig.userInfoURL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`User info fetch failed: ${response.status}`);
    }

    const userData = await response.json() as Record<string, any>;

    // Mapear atributos usando a configuração
    const mapping = oauthConfig.attributeMapping || { email: 'email', name: 'name' };

    return {
      email: userData[mapping.email || 'email'] as string,
      name: userData[mapping.name || 'name'] as string,
      role: (mapping.role && userData[mapping.role] as string | undefined) || 'user',
      department: (mapping.department && userData[mapping.department]) as string | undefined,
      avatarUrl: (userData.picture || userData.avatar_url) as string | undefined,
      metadata: userData
    };
  } catch (error) {
    logger.error('Error fetching OAuth2 user profile', error);
    return null;
  }
}

// ========================================
// GOV.BR INTEGRATION
// ========================================

export async function initiateGovBrAuth(request: SSOAuthRequest): Promise<SSOAuthResponse> {
  try {
    const provider = getSSOProviderById(request.providerId);
    if (!provider || provider.type !== 'oidc' || provider.name !== 'govbr') {
      return { success: false, error: 'Invalid gov.br provider' };
    }

    const config = JSON.parse(provider.configuration) as SSOConfiguration;
    if (!config.govbr) {
      return { success: false, error: 'Invalid gov.br configuration' };
    }

    const baseUrl = config.govbr.environment === 'producao'
      ? 'https://sso.acesso.gov.br'
      : 'https://sso.staging.acesso.gov.br';

    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');

    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: config.govbr.clientId,
      scope: config.govbr.scope.join(' '),
      redirect_uri: config.govbr.redirectUri,
      state: state,
      nonce: nonce
    });

    const redirectUrl = `${baseUrl}/authorize?${authParams.toString()}`;

    return {
      success: true,
      redirectUrl
    };
  } catch (error) {
    logger.error('Error initiating gov.br auth', error);
    return { success: false, error: 'gov.br authentication failed' };
  }
}

export async function handleGovBrCallback(
  code: string,
  _state: string,
  providerId: number,
  clientIp?: string,
  userAgent?: string
): Promise<SSOAuthResponse> {
  try {
    const provider = getSSOProviderById(providerId);
    if (!provider || provider.name !== 'govbr') {
      return { success: false, error: 'Invalid gov.br provider' };
    }

    const config = JSON.parse(provider.configuration) as SSOConfiguration;
    if (!config.govbr) {
      return { success: false, error: 'Invalid gov.br configuration' };
    }

    const baseUrl = config.govbr.environment === 'producao'
      ? 'https://sso.acesso.gov.br'
      : 'https://sso.staging.acesso.gov.br';

    // Trocar code por tokens
    const tokenResponse = await exchangeGovBrCodeForTokens(code, config.govbr, baseUrl);
    if (!tokenResponse) {
      return { success: false, error: 'Failed to exchange gov.br authorization code' };
    }

    // Buscar perfil do usuário
    const userProfile = await fetchGovBrUserProfile(tokenResponse.access_token, baseUrl);
    if (!userProfile) {
      return { success: false, error: 'Failed to fetch gov.br user profile' };
    }

    // Processar usuário
    const authResult = await processExternalUser(userProfile, provider, clientIp, userAgent);
    return authResult;

  } catch (error) {
    logger.error('Error handling gov.br callback', error);
    return { success: false, error: 'gov.br callback processing failed' };
  }
}

async function exchangeGovBrCodeForTokens(code: string, govbrConfig: NonNullable<SSOConfiguration['govbr']>, baseUrl: string): Promise<{ access_token: string; [key: string]: any } | null> {
  try {
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: govbrConfig.clientId,
      client_secret: govbrConfig.clientSecret,
      code: code,
      redirect_uri: govbrConfig.redirectUri
    });

    const response = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    if (!response.ok) {
      throw new Error(`gov.br token exchange failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error exchanging gov.br code for tokens', error);
    return null;
  }
}

async function fetchGovBrUserProfile(accessToken: string, baseUrl: string): Promise<SSOUserProfile | null> {
  try {
    const response = await fetch(`${baseUrl}/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`gov.br userinfo fetch failed: ${response.status}`);
    }

    const userData = await response.json();

    return {
      email: userData.email,
      name: userData.name || userData.given_name,
      role: 'user', // gov.br não fornece role, usar padrão
      metadata: {
        cpf: userData.sub, // CPF vem no campo 'sub'
        govbr_data: userData
      }
    };
  } catch (error) {
    logger.error('Error fetching gov.br user profile', error);
    return null;
  }
}

// ========================================
// PROCESSAMENTO COMUM DE USUÁRIOS EXTERNOS
// ========================================

async function processExternalUser(
  profile: SSOUserProfile,
  provider: SSOProvider,
  clientIp?: string,
  userAgent?: string
): Promise<SSOAuthResponse> {
  try {
    // Buscar usuário existente por email
    let user = getUserByEmail(profile.email);

    if (!user) {
      // Criar novo usuário
      const userData = {
        name: profile.name,
        email: profile.email,
        password: crypto.randomBytes(32).toString('hex'), // Senha aleatória para usuários SSO
        role: (profile.role || 'user') as 'admin' | 'agent' | 'user' | 'manager' | 'read_only' | 'api_client',
        sso_provider: provider.name,
        sso_user_id: profile.metadata?.sub || profile.email,
        avatar_url: profile.avatarUrl,
        is_email_verified: true, // SSO emails são considerados verificados
        metadata: JSON.stringify({
          sso_provider: provider.name,
          external_profile: profile.metadata
        })
      };

      const authResult = await registerUser(userData);
      if (!authResult.success || !authResult.user) {
        return { success: false, error: 'Failed to create user from SSO profile' };
      }

      user = authResult.user as User;
    } else {
      // Atualizar dados do usuário existente se necessário
      if (user.sso_provider !== provider.name) {
        db.prepare(`
          UPDATE users
          SET sso_provider = ?, sso_user_id = ?, last_login_at = datetime('now')
          WHERE id = ?
        `).run(provider.name, profile.metadata?.sub || profile.email, user.id);
      }
    }

    if (!user) {
      return { success: false, error: 'Failed to create or find user' };
    }

    // Log de auditoria para login SSO
    await logAuthEvent(user.id, 'sso_login', {
      ip_address: clientIp || 'unknown',
      user_agent: userAgent,
      details: JSON.stringify({
        provider: provider.name,
        provider_type: provider.type
      })
    });

    // Gerar tokens
    const { generateAccessToken, generateRefreshToken } = await import('./enterprise-auth');
    const userWithRoles = await import('./enterprise-auth').then(m => m.getUserWithRoles(user.id));

    if (!userWithRoles) {
      return { success: false, error: 'Failed to load user roles' };
    }

    const accessToken = await generateAccessToken(userWithRoles);
    const { token: refreshToken, expiresAt } = await generateRefreshToken(user.id, {
      ip: clientIp || 'unknown',
      userAgent: userAgent || 'unknown',
      platform: 'sso',
      browser: 'sso'
    });

    return {
      success: true,
      user,
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: expiresAt.toISOString()
      }
    };

  } catch (error) {
    logger.error('Error processing external user', error);
    return { success: false, error: 'Failed to process external user' };
  }
}

// ========================================
// FUNÇÕES DE INICIALIZAÇÃO
// ========================================

export function initializeDefaultSSOProviders(): boolean {
  try {
    const defaultProviders: CreateSSOProvider[] = [
      {
        name: 'google',
        display_name: 'Google',
        type: 'oauth2',
        is_active: false,
        configuration: JSON.stringify({
          oauth: {
            authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenURL: 'https://oauth2.googleapis.com/token',
            userInfoURL: 'https://www.googleapis.com/oauth2/v2/userinfo',
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
            scope: ['openid', 'email', 'profile'],
            responseType: 'code',
            grantType: 'authorization_code',
            attributeMapping: {
              email: 'email',
              name: 'name',
              role: 'role'
            }
          }
        }),
        metadata: JSON.stringify({
          description: 'Google OAuth 2.0 integration',
          icon: 'google'
        })
      },
      {
        name: 'microsoft',
        display_name: 'Microsoft',
        type: 'oauth2',
        is_active: false,
        configuration: JSON.stringify({
          oauth: {
            authorizationURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
            tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            userInfoURL: 'https://graph.microsoft.com/v1.0/me',
            clientId: process.env.MICROSOFT_CLIENT_ID || '',
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
            scope: ['openid', 'email', 'profile'],
            responseType: 'code',
            grantType: 'authorization_code',
            attributeMapping: {
              email: 'mail',
              name: 'displayName',
              role: 'jobTitle'
            }
          }
        }),
        metadata: JSON.stringify({
          description: 'Microsoft Azure AD integration',
          icon: 'microsoft'
        })
      },
      {
        name: 'govbr',
        display_name: 'gov.br',
        type: 'oidc',
        is_active: false,
        configuration: JSON.stringify({
          govbr: {
            clientId: process.env.GOVBR_CLIENT_ID || '',
            clientSecret: process.env.GOVBR_CLIENT_SECRET || '',
            environment: 'homologacao',
            scope: ['openid', 'email', 'profile', 'govbr_empresa'],
            redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/govbr/callback`
          }
        }),
        metadata: JSON.stringify({
          description: 'Integração com conta única do governo brasileiro',
          icon: 'govbr',
          country: 'BR'
        })
      }
    ];

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO sso_providers (name, display_name, type, is_active, configuration, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const provider of defaultProviders) {
      insertStmt.run(
        provider.name,
        provider.display_name,
        provider.type,
        provider.is_active ? 1 : 0,
        encryptSSOConfiguration(provider.configuration),
        provider.metadata
      );
    }

    return true;
  } catch (error) {
    logger.error('Error initializing default SSO providers', error);
    return false;
  }
}

// ========================================
// EXPORTS
// ========================================
// All functions are already exported inline above