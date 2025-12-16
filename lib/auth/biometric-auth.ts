import { randomBytes, createHash } from 'crypto';
import db from '../db/connection';
import logger from '../monitoring/structured-logger';

export interface WebAuthnCredential {
  id: string;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name?: string;
  device_type: 'security_key' | 'platform' | 'cross_platform';
  aaguid?: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

export interface RegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification?: 'required' | 'preferred' | 'discouraged';
    residentKey?: 'required' | 'preferred' | 'discouraged';
  };
  attestation?: 'none' | 'indirect' | 'direct';
  timeout?: number;
  excludeCredentials?: Array<{
    type: 'public-key';
    id: string;
  }>;
}

export interface AuthenticationOptions {
  challenge: string;
  rpId: string;
  allowCredentials?: Array<{
    type: 'public-key';
    id: string;
    transports?: string[];
  }>;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  timeout?: number;
}

export interface RegistrationResponse {
  id: string;
  rawId: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
  };
  type: 'public-key';
}

export interface AuthenticationResponse {
  id: string;
  rawId: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
  type: 'public-key';
}

export interface BiometricDevice {
  id: string;
  name: string;
  type: 'fingerprint' | 'face_id' | 'security_key' | 'platform_authenticator';
  last_used: string;
  created_at: string;
  is_active: boolean;
}

class BiometricAuthManager {
  private readonly RP_NAME = 'ServiceDesk';
  private readonly RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
  private readonly CHALLENGE_LENGTH = 32;
  private readonly TIMEOUT = 60000; // 60 seconds

  /**
   * Generate registration options for WebAuthn
   */
  async generateRegistrationOptions(userId: number, _deviceName?: string): Promise<RegistrationOptions | null> {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) return null;

      // Generate challenge
      const challenge = randomBytes(this.CHALLENGE_LENGTH).toString('base64url');

      // Store challenge temporarily (expires in 5 minutes)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      db.prepare(`
        INSERT INTO verification_codes (user_id, code, code_hash, type, expires_at)
        VALUES (?, ?, ?, 'webauthn_challenge', ?)
      `).run(userId, challenge, this.hashChallenge(challenge), expiresAt.toISOString());

      // Get existing credentials to exclude
      const existingCredentials = this.getUserCredentials(userId);
      const excludeCredentials = existingCredentials.map(cred => ({
        type: 'public-key' as const,
        id: cred.credential_id
      }));

      const options: RegistrationOptions = {
        challenge,
        rp: {
          name: this.RP_NAME,
          id: this.RP_ID
        },
        user: {
          id: Buffer.from(userId.toString()).toString('base64url'),
          name: user.email,
          displayName: user.name
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },  // ES256
          { type: 'public-key', alg: -257 }, // RS256
          { type: 'public-key', alg: -8 },   // EdDSA
        ],
        authenticatorSelection: {
          userVerification: 'preferred',
          residentKey: 'preferred'
        },
        attestation: 'none',
        timeout: this.TIMEOUT,
        excludeCredentials: excludeCredentials.length > 0 ? excludeCredentials : undefined
      };

      return options;
    } catch (error) {
      logger.error('Error generating registration options', error);
      return null;
    }
  }

  /**
   * Verify registration response and store credential
   */
  async verifyRegistrationResponse(
    userId: number,
    registrationResponse: RegistrationResponse,
    deviceName?: string,
    deviceType: 'security_key' | 'platform' | 'cross_platform' = 'platform'
  ): Promise<boolean> {
    try {
      // Parse client data
      const clientDataJSON = JSON.parse(
        Buffer.from(registrationResponse.response.clientDataJSON, 'base64url').toString()
      );

      // Verify challenge
      const isValidChallenge = await this.verifyChallenge(userId, clientDataJSON.challenge);
      if (!isValidChallenge) {
        throw new Error('Invalid challenge');
      }

      // Verify origin
      const expectedOrigin = `https://${this.RP_ID}`;
      if (clientDataJSON.origin !== expectedOrigin && this.RP_ID !== 'localhost') {
        throw new Error('Invalid origin');
      }

      // Parse attestation object (simplified - in production use a proper WebAuthn library)
      const attestationObject = this.parseAttestationObject(
        registrationResponse.response.attestationObject
      );

      if (!attestationObject) {
        throw new Error('Invalid attestation object');
      }

      // Store credential
      const credentialId = registrationResponse.id;
      const publicKey = attestationObject.publicKey;

      const stmt = db.prepare(`
        INSERT INTO webauthn_credentials
        (user_id, credential_id, public_key, counter, device_name, device_type, aaguid)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        userId,
        credentialId,
        publicKey,
        attestationObject.counter || 0,
        deviceName || 'Biometric Device',
        deviceType,
        attestationObject.aaguid || null
      );

      if (result.changes > 0) {
        this.logBiometricEvent(userId, 'credential_registered', deviceType);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error verifying registration response', error);
      return false;
    }
  }

  /**
   * Generate authentication options for WebAuthn
   */
  async generateAuthenticationOptions(userId?: number): Promise<AuthenticationOptions | null> {
    try {
      // Generate challenge
      const challenge = randomBytes(this.CHALLENGE_LENGTH).toString('base64url');

      // Store challenge temporarily
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      if (userId) {
        db.prepare(`
          INSERT INTO verification_codes (user_id, code, code_hash, type, expires_at)
          VALUES (?, ?, ?, 'webauthn_auth_challenge', ?)
        `).run(userId, challenge, this.hashChallenge(challenge), expiresAt.toISOString());
      } else {
        // Store global challenge for usernameless authentication
        db.prepare(`
          INSERT INTO verification_codes (code, code_hash, type, expires_at)
          VALUES (?, ?, 'webauthn_auth_challenge_global', ?)
        `).run(challenge, this.hashChallenge(challenge), expiresAt.toISOString());
      }

      let allowCredentials;
      if (userId) {
        // Get user's credentials
        const credentials = this.getUserCredentials(userId);
        allowCredentials = credentials.map(cred => ({
          type: 'public-key' as const,
          id: cred.credential_id,
          transports: ['usb', 'nfc', 'ble', 'internal'] as string[]
        }));
      }

      const options: AuthenticationOptions = {
        challenge,
        rpId: this.RP_ID,
        allowCredentials,
        userVerification: 'preferred',
        timeout: this.TIMEOUT
      };

      return options;
    } catch (error) {
      logger.error('Error generating authentication options', error);
      return null;
    }
  }

  /**
   * Verify authentication response
   */
  async verifyAuthenticationResponse(
    authenticationResponse: AuthenticationResponse,
    userId?: number
  ): Promise<{ success: boolean; userId?: number; credentialId?: string }> {
    try {
      // Parse client data
      const clientDataJSON = JSON.parse(
        Buffer.from(authenticationResponse.response.clientDataJSON, 'base64url').toString()
      );

      // Find credential
      const credential = this.getCredentialById(authenticationResponse.id);
      if (!credential || !credential.is_active) {
        throw new Error('Credential not found or inactive');
      }

      // If userId provided, verify it matches the credential
      if (userId && credential.user_id !== userId) {
        throw new Error('Credential does not belong to user');
      }

      // Verify challenge
      const challengeUserId = userId || credential.user_id;
      const isValidChallenge = await this.verifyChallengeAuth(challengeUserId, clientDataJSON.challenge);
      if (!isValidChallenge) {
        throw new Error('Invalid challenge');
      }

      // Verify origin
      const expectedOrigin = `https://${this.RP_ID}`;
      if (clientDataJSON.origin !== expectedOrigin && this.RP_ID !== 'localhost') {
        throw new Error('Invalid origin');
      }

      // Parse authenticator data (simplified)
      const authenticatorData = this.parseAuthenticatorData(
        authenticationResponse.response.authenticatorData
      );

      if (!authenticatorData) {
        throw new Error('Invalid authenticator data');
      }

      // Verify signature (simplified - use proper crypto verification in production)
      const isValidSignature = this.verifySignature(
        credential.public_key,
        authenticationResponse.response.signature,
        authenticationResponse.response.authenticatorData,
        authenticationResponse.response.clientDataJSON
      );

      if (!isValidSignature) {
        throw new Error('Invalid signature');
      }

      // Update credential counter and last used
      if (authenticatorData.counter > credential.counter) {
        db.prepare(`
          UPDATE webauthn_credentials
          SET counter = ?, last_used_at = CURRENT_TIMESTAMP
          WHERE credential_id = ?
        `).run(authenticatorData.counter, credential.credential_id);
      }

      this.logBiometricEvent(credential.user_id, 'authentication_success', credential.device_type);

      return {
        success: true,
        userId: credential.user_id,
        credentialId: credential.credential_id
      };
    } catch (error) {
      logger.error('Error verifying authentication response', error);
      return { success: false };
    }
  }

  /**
   * Get user's biometric credentials
   */
  getUserCredentials(userId: number): WebAuthnCredential[] {
    try {
      return db.prepare(`
        SELECT * FROM webauthn_credentials
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `).all(userId) as WebAuthnCredential[];
    } catch (error) {
      logger.error('Error getting user credentials', error);
      return [];
    }
  }

  /**
   * Get credential by ID
   */
  getCredentialById(credentialId: string): WebAuthnCredential | null {
    try {
      return db.prepare(`
        SELECT * FROM webauthn_credentials
        WHERE credential_id = ?
      `).get(credentialId) as WebAuthnCredential || null;
    } catch (error) {
      logger.error('Error getting credential by ID', error);
      return null;
    }
  }

  /**
   * Remove credential
   */
  removeCredential(userId: number, credentialId: string): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE webauthn_credentials
        SET is_active = 0
        WHERE user_id = ? AND credential_id = ?
      `);

      const result = stmt.run(userId, credentialId);

      if (result.changes > 0) {
        this.logBiometricEvent(userId, 'credential_removed');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error removing credential', error);
      return false;
    }
  }

  /**
   * Update credential name
   */
  updateCredentialName(userId: number, credentialId: string, deviceName: string): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE webauthn_credentials
        SET device_name = ?
        WHERE user_id = ? AND credential_id = ? AND is_active = 1
      `);

      const result = stmt.run(deviceName, userId, credentialId);
      return result.changes > 0;
    } catch (error) {
      logger.error('Error updating credential name', error);
      return false;
    }
  }

  /**
   * Check if user has biometric authentication enabled
   */
  hasBiometricAuth(userId: number): boolean {
    try {
      const count = db.prepare(`
        SELECT COUNT(*) as count FROM webauthn_credentials
        WHERE user_id = ? AND is_active = 1
      `).get(userId) as any;

      return count.count > 0;
    } catch (error) {
      logger.error('Error checking biometric auth', error);
      return false;
    }
  }

  /**
   * Get user's biometric devices summary
   */
  getBiometricDevices(userId: number): BiometricDevice[] {
    try {
      const devices = db.prepare(`
        SELECT
          credential_id as id,
          device_name as name,
          device_type as type,
          last_used_at as last_used,
          created_at,
          is_active
        FROM webauthn_credentials
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId) as any[];

      return devices.map(device => ({
        ...device,
        type: this.mapDeviceType(device.type),
        last_used: device.last_used || device.created_at
      }));
    } catch (error) {
      logger.error('Error getting biometric devices', error);
      return [];
    }
  }

  /**
   * Verify challenge for registration
   */
  private async verifyChallenge(userId: number, challenge: string): Promise<boolean> {
    try {
      const challengeHash = this.hashChallenge(challenge);
      const record = db.prepare(`
        SELECT * FROM verification_codes
        WHERE user_id = ? AND type = 'webauthn_challenge'
          AND code_hash = ? AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC LIMIT 1
      `).get(userId, challengeHash) as any;

      if (record) {
        // Mark challenge as used
        db.prepare(`
          UPDATE verification_codes
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(record.id);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error verifying challenge', error);
      return false;
    }
  }

  /**
   * Verify challenge for authentication
   */
  private async verifyChallengeAuth(userId: number, challenge: string): Promise<boolean> {
    try {
      const challengeHash = this.hashChallenge(challenge);

      // Try user-specific challenge first
      let record = db.prepare(`
        SELECT * FROM verification_codes
        WHERE user_id = ? AND type = 'webauthn_auth_challenge'
          AND code_hash = ? AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC LIMIT 1
      `).get(userId, challengeHash) as any;

      // If not found, try global challenge
      if (!record) {
        record = db.prepare(`
          SELECT * FROM verification_codes
          WHERE type = 'webauthn_auth_challenge_global'
            AND code_hash = ? AND used_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP
          ORDER BY created_at DESC LIMIT 1
        `).get(challengeHash) as any;
      }

      if (record) {
        // Mark challenge as used
        db.prepare(`
          UPDATE verification_codes
          SET used_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(record.id);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error verifying auth challenge', error);
      return false;
    }
  }

  /**
   * Hash challenge for storage
   */
  private hashChallenge(challenge: string): string {
    return createHash('sha256').update(challenge).digest('hex');
  }

  /**
   * Parse attestation object (simplified)
   */
  private parseAttestationObject(attestationObject: string): {
    publicKey: string;
    counter: number;
    aaguid?: string;
  } | null {
    try {
      // This is a simplified implementation
      // In production, use a proper CBOR decoder and WebAuthn library
      const buffer = Buffer.from(attestationObject, 'base64url');

      // For demo purposes, return a mock structure
      return {
        publicKey: buffer.toString('base64'),
        counter: 0,
        aaguid: undefined
      };
    } catch (error) {
      logger.error('Error parsing attestation object', error);
      return null;
    }
  }

  /**
   * Parse authenticator data (simplified)
   */
  private parseAuthenticatorData(authenticatorData: string): {
    counter: number;
    flags: number;
  } | null {
    try {
      // This is a simplified implementation
      const buffer = Buffer.from(authenticatorData, 'base64url');

      // Extract counter (bytes 33-36, big-endian)
      const counter = buffer.length >= 37 ? buffer.readUInt32BE(33) : 0;
      const flags = buffer.length >= 33 ? buffer.readUInt8(32) : 0;

      return { counter, flags };
    } catch (error) {
      logger.error('Error parsing authenticator data', error);
      return null;
    }
  }

  /**
   * Verify signature (simplified)
   */
  private verifySignature(
    _publicKey: string,
    _signature: string,
    _authenticatorData: string,
    _clientDataJSON: string
  ): boolean {
    try {
      // This is a simplified implementation
      // In production, use proper cryptographic verification
      return true; // For demo purposes
    } catch (error) {
      logger.error('Error verifying signature', error);
      return false;
    }
  }

  /**
   * Map device type for display
   */
  private mapDeviceType(deviceType: string): 'fingerprint' | 'face_id' | 'security_key' | 'platform_authenticator' {
    switch (deviceType) {
      case 'platform':
        return 'platform_authenticator';
      case 'cross_platform':
        return 'security_key';
      case 'security_key':
        return 'security_key';
      default:
        return 'platform_authenticator';
    }
  }

  /**
   * Log biometric event for audit
   */
  private logBiometricEvent(userId: number, eventType: string, deviceType?: string): void {
    try {
      db.prepare(`
        INSERT INTO auth_audit_logs (user_id, event_type, details)
        VALUES (?, ?, ?)
      `).run(userId, `biometric_${eventType}`, JSON.stringify({ deviceType }));
    } catch (error) {
      logger.error('Error logging biometric event', error);
    }
  }
}

export const biometricAuth = new BiometricAuthManager();
export default biometricAuth;