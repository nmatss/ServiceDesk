import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import db from '../db/connection';
import { User } from '../types/database';
import { createUser, getUserByEmail } from './sqlite-auth';
import { logger } from '../monitoring/logger';

export interface SSOProvider {
  id: number;
  name: string;
  display_name: string;
  type: 'saml2' | 'oauth2' | 'oidc' | 'ldap';
  is_active: boolean;
  configuration: SSOConfiguration;
  metadata?: any;
}

export interface SSOConfiguration {
  // SAML 2.0
  entityId?: string;
  ssoUrl?: string;
  sloUrl?: string;
  x509cert?: string;
  privateKey?: string;

  // OAuth 2.0 / OIDC
  clientId?: string;
  clientSecret?: string;
  authorizeUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUrl?: string;
  scope?: string[];

  // LDAP
  server?: string;
  port?: number;
  bindDn?: string;
  bindPassword?: string;
  searchBase?: string;
  searchFilter?: string;

  // Common
  attributeMapping?: {
    email: string;
    name: string;
    role?: string;
    groups?: string;
  };
  autoCreateUsers?: boolean;
  defaultRole?: 'admin' | 'agent' | 'user';
}

export interface SSOUser {
  email: string;
  name: string;
  role?: string;
  groups?: string[];
  externalId: string;
  provider: string;
  attributes?: Record<string, any>;
}

class SSOManager {
  /**
   * Get active SSO providers
   */
  getActiveProviders(): SSOProvider[] {
    try {
      const providers = db.prepare(`
        SELECT * FROM sso_providers
        WHERE is_active = 1
        ORDER BY name
      `).all() as any[];

      return providers.map(p => ({
        ...p,
        configuration: JSON.parse(p.configuration),
        metadata: p.metadata ? JSON.parse(p.metadata) : null
      }));
    } catch (error) {
      logger.error('Error getting SSO providers', error);
      return [];
    }
  }

  /**
   * Get SSO provider by name
   */
  getProvider(name: string): SSOProvider | null {
    try {
      const provider = db.prepare(`
        SELECT * FROM sso_providers
        WHERE name = ? AND is_active = 1
      `).get(name) as any;

      if (!provider) return null;

      return {
        ...provider,
        configuration: JSON.parse(provider.configuration),
        metadata: provider.metadata ? JSON.parse(provider.metadata) : null
      };
    } catch (error) {
      logger.error('Error getting SSO provider', error);
      return null;
    }
  }

  /**
   * Create or update SSO provider
   */
  saveProvider(provider: Omit<SSOProvider, 'id'> & { id?: number }): boolean {
    try {
      const configJson = JSON.stringify(provider.configuration);
      const metadataJson = provider.metadata ? JSON.stringify(provider.metadata) : null;

      if (provider.id) {
        // Update
        const stmt = db.prepare(`
          UPDATE sso_providers
          SET display_name = ?, type = ?, is_active = ?, configuration = ?,
              metadata = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        const result = stmt.run(
          provider.display_name, provider.type, provider.is_active ? 1 : 0,
          configJson, metadataJson, provider.id
        );
        return result.changes > 0;
      } else {
        // Insert
        const stmt = db.prepare(`
          INSERT INTO sso_providers (name, display_name, type, is_active, configuration, metadata)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          provider.name, provider.display_name, provider.type,
          provider.is_active ? 1 : 0, configJson, metadataJson
        );
        return result.changes > 0;
      }
    } catch (error) {
      logger.error('Error saving SSO provider', error);
      return false;
    }
  }

  /**
   * Generate SAML 2.0 authentication request
   */
  generateSamlAuthRequest(providerName: string, relayState?: string): string | null {
    try {
      const provider = this.getProvider(providerName);
      if (!provider || provider.type !== 'saml2') return null;

      const config = provider.configuration;
      const requestId = '_' + randomBytes(16).toString('hex');
      const issueInstant = new Date().toISOString();

      const authRequest = {
        'samlp:AuthnRequest': {
          '@_xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
          '@_xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
          '@_ID': requestId,
          '@_Version': '2.0',
          '@_IssueInstant': issueInstant,
          '@_Destination': config.ssoUrl,
          '@_AssertionConsumerServiceURL': `${process.env.NEXTAUTH_URL}/api/auth/sso/saml/callback/${providerName}`,
          '@_ProtocolBinding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          'saml:Issuer': config.entityId,
          'samlp:NameIDPolicy': {
            '@_Format': 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
            '@_AllowCreate': 'true'
          }
        }
      };

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        format: true
      });

      const xmlRequest = builder.build(authRequest);
      const encodedRequest = Buffer.from(xmlRequest).toString('base64');

      // Create redirect URL
      const params = new URLSearchParams({
        SAMLRequest: encodedRequest
      });

      if (relayState) {
        params.set('RelayState', relayState);
      }

      return `${config.ssoUrl}?${params.toString()}`;
    } catch (error) {
      logger.error('Error generating SAML auth request', error);
      return null;
    }
  }

  /**
   * Process SAML 2.0 response
   */
  async processSamlResponse(providerName: string, samlResponse: string): Promise<SSOUser | null> {
    try {
      const provider = this.getProvider(providerName);
      if (!provider || provider.type !== 'saml2') return null;

      const config = provider.configuration;
      const xmlResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');

      const parser = new XMLParser({
        ignoreAttributes: false,
        parseAttributeValue: true
      });

      const parsed = parser.parse(xmlResponse);
      const response = parsed['saml2p:Response'] || parsed['samlp:Response'];

      if (!response) {
        throw new Error('Invalid SAML response format');
      }

      // Extract assertion
      const assertion = response['saml2:Assertion'] || response['saml:Assertion'];
      if (!assertion) {
        throw new Error('No assertion found in SAML response');
      }

      // Extract attributes
      const attributeStatement = assertion['saml2:AttributeStatement'] || assertion['saml:AttributeStatement'];
      const attributes: Record<string, any> = {};

      if (attributeStatement && attributeStatement['saml2:Attribute'] || attributeStatement['saml:Attribute']) {
        const attrs = attributeStatement['saml2:Attribute'] || attributeStatement['saml:Attribute'];
        const attrArray = Array.isArray(attrs) ? attrs : [attrs];

        attrArray.forEach((attr: any) => {
          const name = attr['@_Name'] || attr['@_FriendlyName'];
          const value = attr['saml2:AttributeValue'] || attr['saml:AttributeValue'];
          if (name && value) {
            attributes[name] = Array.isArray(value) ? value : [value];
          }
        });
      }

      // Map attributes to user data
      const mapping = config.attributeMapping!;
      const email = this.extractAttribute(attributes, mapping.email);
      const name = this.extractAttribute(attributes, mapping.name);
      const role = mapping.role ? this.extractAttribute(attributes, mapping.role) : null;
      const groups = mapping.groups ? this.extractAttribute(attributes, mapping.groups) : null;

      if (!email || !name) {
        throw new Error('Required user attributes not found in SAML response');
      }

      // Extract NameID as external ID
      const nameId = assertion['saml2:Subject']['saml2:NameID'] ||
                    assertion['saml:Subject']['saml:NameID'];
      const externalId = nameId?.['#text'] || nameId || email;

      return {
        email,
        name,
        role,
        groups: Array.isArray(groups) ? groups : groups ? [groups] : [],
        externalId,
        provider: providerName,
        attributes
      };
    } catch (error) {
      logger.error('Error processing SAML response', error);
      return null;
    }
  }

  /**
   * Generate OAuth 2.0 authorization URL
   */
  generateOAuthAuthUrl(providerName: string, state?: string): string | null {
    try {
      const provider = this.getProvider(providerName);
      if (!provider || !['oauth2', 'oidc'].includes(provider.type)) return null;

      const config = provider.configuration;
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/sso/oauth/callback/${providerName}`,
        scope: (config.scope || ['openid', 'profile', 'email']).join(' ')
      });

      if (state) {
        params.set('state', state);
      }

      if (provider.type === 'oidc') {
        params.set('nonce', randomBytes(16).toString('hex'));
      }

      return `${config.authorizeUrl}?${params.toString()}`;
    } catch (error) {
      logger.error('Error generating OAuth auth URL', error);
      return null;
    }
  }

  /**
   * Exchange OAuth code for user info
   */
  async processOAuthCallback(providerName: string, code: string, state?: string): Promise<SSOUser | null> {
    try {
      const provider = this.getProvider(providerName);
      if (!provider || !['oauth2', 'oidc'].includes(provider.type)) return null;

      const config = provider.configuration;

      // Exchange code for token
      const tokenResponse = await fetch(config.tokenUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.clientId!,
          client_secret: config.clientSecret!,
          code,
          redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/sso/oauth/callback/${providerName}`
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        throw new Error('No access token received');
      }

      // Get user info
      const userResponse = await fetch(config.userInfoUrl!, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!userResponse.ok) {
        throw new Error(`User info request failed: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();

      // Map user data
      const mapping = config.attributeMapping!;
      const email = this.extractNestedProperty(userData, mapping.email);
      const name = this.extractNestedProperty(userData, mapping.name);
      const role = mapping.role ? this.extractNestedProperty(userData, mapping.role) : null;
      const groups = mapping.groups ? this.extractNestedProperty(userData, mapping.groups) : null;

      if (!email || !name) {
        throw new Error('Required user attributes not found in OAuth response');
      }

      return {
        email,
        name,
        role,
        groups: Array.isArray(groups) ? groups : groups ? [groups] : [],
        externalId: userData.sub || userData.id || email,
        provider: providerName,
        attributes: userData
      };
    } catch (error) {
      logger.error('Error processing OAuth callback', error);
      return null;
    }
  }

  /**
   * Authenticate user with SSO data
   */
  async authenticateSSOUser(ssoUser: SSOUser): Promise<User | null> {
    try {
      // Check if user exists
      let user = getUserByEmail(ssoUser.email);
      const provider = this.getProvider(ssoUser.provider);

      if (!user && provider?.configuration.autoCreateUsers) {
        // Create new user
        const role = ssoUser.role || provider.configuration.defaultRole || 'user';
        const userData = {
          name: ssoUser.name,
          email: ssoUser.email,
          password: randomBytes(32).toString('hex'), // Random password for SSO users
          role: role as 'admin' | 'agent' | 'user'
        };

        user = await createUser(userData);
        if (!user) {
          throw new Error('Failed to create SSO user');
        }

        // Update SSO fields
        db.prepare(`
          UPDATE users
          SET sso_provider = ?, sso_user_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(ssoUser.provider, ssoUser.externalId, user.id);
      } else if (user) {
        // Update existing user's SSO info if not set
        if (!user.sso_provider) {
          db.prepare(`
            UPDATE users
            SET sso_provider = ?, sso_user_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(ssoUser.provider, ssoUser.externalId, user.id);
        }
      }

      if (!user) {
        throw new Error('User not found and auto-creation disabled');
      }

      // Log successful SSO authentication
      db.prepare(`
        INSERT INTO login_attempts (user_id, email, ip_address, success, two_factor_required)
        VALUES (?, ?, ?, 1, 0)
      `).run(user.id, user.email, '127.0.0.1'); // IP will be set by middleware

      return user;
    } catch (error) {
      logger.error('Error authenticating SSO user', error);
      return null;
    }
  }

  /**
   * Get user's linked SSO providers
   */
  getUserSSOProviders(userId: number): string[] {
    try {
      const user = db.prepare('SELECT sso_provider FROM users WHERE id = ?').get(userId) as any;
      return user?.sso_provider ? [user.sso_provider] : [];
    } catch (error) {
      logger.error('Error getting user SSO providers', error);
      return [];
    }
  }

  /**
   * Link user to SSO provider
   */
  linkUserToSSO(userId: number, provider: string, externalId: string): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE users
        SET sso_provider = ?, sso_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(provider, externalId, userId);
      return result.changes > 0;
    } catch (error) {
      logger.error('Error linking user to SSO', error);
      return false;
    }
  }

  /**
   * Unlink user from SSO provider
   */
  unlinkUserFromSSO(userId: number): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE users
        SET sso_provider = NULL, sso_user_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(userId);
      return result.changes > 0;
    } catch (error) {
      logger.error('Error unlinking user from SSO', error);
      return false;
    }
  }

  /**
   * Extract attribute value from SAML attributes
   */
  private extractAttribute(attributes: Record<string, any>, path: string): string | null {
    const value = attributes[path];
    if (Array.isArray(value)) {
      return value[0]?.['#text'] || value[0];
    }
    return value?.['#text'] || value || null;
  }

  /**
   * Extract nested property from object (for OAuth)
   */
  private extractNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

export const ssoManager = new SSOManager();
export default ssoManager;