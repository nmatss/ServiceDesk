import { logger } from '../monitoring/logger';

/**
 * Biometric Authentication Manager
 * WebAuthn implementation for fingerprint, face ID, and other biometric methods
 */

interface BiometricCredential {
  id: string;
  type: 'public-key';
  rawId: ArrayBuffer;
  response: AuthenticatorAssertionResponse;
}

interface BiometricRegistrationOptions {
  username: string;
  displayName: string;
  userHandle?: string;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification?: 'required' | 'preferred' | 'discouraged';
    residentKey?: 'required' | 'preferred' | 'discouraged';
  };
  timeout?: number;
}

interface BiometricAuthOptions {
  allowCredentials?: PublicKeyCredentialDescriptor[];
  userVerification?: 'required' | 'preferred' | 'discouraged';
  timeout?: number;
}

class BiometricAuthManager {
  private isSupported = false;
  private isPlatformAuthenticatorAvailable = false;

  constructor() {
    this.checkSupport();
  }

  // Check if biometric authentication is supported
  private async checkSupport(): Promise<void> {
    this.isSupported = !!(
      window.PublicKeyCredential &&
      navigator.credentials &&
      navigator.credentials.create &&
      navigator.credentials.get
    );

    if (this.isSupported) {
      try {
        this.isPlatformAuthenticatorAvailable =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch (error) {
        logger.warn('Error checking platform authenticator availability', error);
      }
    }
  }

  // Public methods to check support
  public isBiometricSupported(): boolean {
    return this.isSupported;
  }

  public isPlatformAuthenticatorSupported(): boolean {
    return this.isPlatformAuthenticatorAvailable;
  }

  // Register new biometric credential
  public async registerBiometric(options: BiometricRegistrationOptions): Promise<string | null> {
    if (!this.isSupported) {
      throw new Error('Biometric authentication not supported');
    }

    try {
      // Generate challenge
      const challenge = this.generateChallenge();
      const userHandle = options.userHandle || this.stringToArrayBuffer(options.username);

      const credentialCreationOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'ServiceDesk Pro',
            id: window.location.hostname
          },
          user: {
            id: userHandle,
            name: options.username,
            displayName: options.displayName
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
            ...options.authenticatorSelection
          },
          timeout: options.timeout || 60000,
          attestation: 'direct'
        }
      };

      const credential = await navigator.credentials.create(credentialCreationOptions) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Send credential to server for storage
      const credentialData = this.formatCredentialForServer(credential);
      const credentialId = await this.sendCredentialToServer(credentialData);

      // Store credential reference locally
      this.storeCredentialReference(credentialId, options.username);

      logger.info('Biometric registration successful');
      return credentialId;

    } catch (error) {
      logger.error('Biometric registration failed', error);

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Biometric registration was cancelled or not allowed');
        } else if (error.name === 'NotSupportedError') {
          throw new Error('This device does not support the requested biometric method');
        } else if (error.name === 'SecurityError') {
          throw new Error('Security error during biometric registration');
        }
      }

      throw error;
    }
  }

  // Authenticate using biometric
  public async authenticateBiometric(options?: BiometricAuthOptions): Promise<{
    credentialId: string;
    signature: string;
    userHandle?: string;
  } | null> {
    if (!this.isSupported) {
      throw new Error('Biometric authentication not supported');
    }

    try {
      // Generate challenge
      const challenge = this.generateChallenge();

      // Get stored credentials or use provided ones
      const allowCredentials = options?.allowCredentials || this.getStoredCredentials();

      const credentialRequestOptions: CredentialRequestOptions = {
        publicKey: {
          challenge,
          allowCredentials,
          userVerification: options?.userVerification || 'required',
          timeout: options?.timeout || 60000
        }
      };

      const credential = await navigator.credentials.get(credentialRequestOptions) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Authentication failed');
      }

      // Process authentication response
      const authData = this.processAuthenticationResponse(credential);

      // Verify with server
      const isValid = await this.verifyWithServer(authData);

      if (isValid) {
        logger.info('Biometric authentication successful');
        return authData;
      } else {
        throw new Error('Server verification failed');
      }

    } catch (error) {
      logger.error('Biometric authentication failed', error);

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Biometric authentication was cancelled or not allowed');
        } else if (error.name === 'SecurityError') {
          throw new Error('Security error during biometric authentication');
        }
      }

      return null;
    }
  }

  // Check if user has registered biometric credentials
  public hasStoredCredentials(): boolean {
    const credentials = localStorage.getItem('biometric-credentials');
    return !!(credentials && JSON.parse(credentials).length > 0);
  }

  // Remove stored biometric credentials
  public async removeBiometricCredentials(): Promise<void> {
    const credentials = this.getStoredCredentials();

    // Notify server to remove credentials
    for (const credential of credentials) {
      try {
        await this.removeCredentialFromServer(credential.id);
      } catch (error) {
        logger.error('Failed to remove credential from server', error);
      }
    }

    // Remove local storage
    localStorage.removeItem('biometric-credentials');
    localStorage.removeItem('biometric-settings');

    logger.info('Biometric credentials removed');
  }

  // Get biometric capability info
  public async getBiometricInfo(): Promise<{
    isSupported: boolean;
    isPlatformAuthenticator: boolean;
    supportedMethods: string[];
    hasStoredCredentials: boolean;
  }> {
    const supportedMethods: string[] = [];

    if (this.isSupported) {
      // Check for platform authenticator (Touch ID, Face ID, Windows Hello)
      if (this.isPlatformAuthenticatorAvailable) {
        supportedMethods.push('platform');
      }

      // Check for cross-platform authenticators (USB keys, etc.)
      supportedMethods.push('cross-platform');
    }

    return {
      isSupported: this.isSupported,
      isPlatformAuthenticator: this.isPlatformAuthenticatorAvailable,
      supportedMethods,
      hasStoredCredentials: this.hasStoredCredentials()
    };
  }

  // Enable/disable biometric authentication
  public setBiometricEnabled(enabled: boolean): void {
    const settings = {
      enabled,
      enabledAt: enabled ? Date.now() : null,
      disabledAt: enabled ? null : Date.now()
    };

    localStorage.setItem('biometric-settings', JSON.stringify(settings));
  }

  public isBiometricEnabled(): boolean {
    const settings = localStorage.getItem('biometric-settings');
    if (!settings) return false;

    try {
      const { enabled } = JSON.parse(settings);
      return enabled && this.hasStoredCredentials();
    } catch {
      return false;
    }
  }

  // Biometric settings management
  public setBiometricTimeout(timeout: number): void {
    const settings = this.getBiometricSettings();
    settings.timeout = timeout;
    localStorage.setItem('biometric-settings', JSON.stringify(settings));
  }

  public setBiometricFallback(enableFallback: boolean): void {
    const settings = this.getBiometricSettings();
    settings.enableFallback = enableFallback;
    localStorage.setItem('biometric-settings', JSON.stringify(settings));
  }

  private getBiometricSettings(): any {
    const settings = localStorage.getItem('biometric-settings');
    return settings ? JSON.parse(settings) : {
      enabled: false,
      timeout: 60000,
      enableFallback: true
    };
  }

  // Conditional UI methods
  public async shouldShowBiometricPrompt(): Promise<boolean> {
    if (!this.isBiometricEnabled()) {
      return false;
    }

    // Check if biometric was used recently (within last hour)
    const lastUsed = localStorage.getItem('biometric-last-used');
    if (lastUsed) {
      const lastUsedTime = parseInt(lastUsed);
      const oneHour = 60 * 60 * 1000;

      if (Date.now() - lastUsedTime < oneHour) {
        return false; // Don't prompt too frequently
      }
    }

    return true;
  }

  public recordBiometricUsage(): void {
    localStorage.setItem('biometric-last-used', Date.now().toString());
  }

  // Private helper methods
  private generateChallenge(): ArrayBuffer {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    return challenge.buffer;
  }

  private stringToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private formatCredentialForServer(credential: PublicKeyCredential): any {
    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      id: credential.id,
      rawId: this.arrayBufferToBase64(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.arrayBufferToBase64(response.clientDataJSON),
        attestationObject: this.arrayBufferToBase64(response.attestationObject)
      }
    };
  }

  private processAuthenticationResponse(credential: PublicKeyCredential): {
    credentialId: string;
    signature: string;
    userHandle?: string;
  } {
    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      credentialId: credential.id,
      signature: this.arrayBufferToBase64(response.signature),
      userHandle: response.userHandle ? this.arrayBufferToBase64(response.userHandle) : undefined
    };
  }

  private async sendCredentialToServer(credentialData: any): Promise<string> {
    try {
      const response = await fetch('/api/auth/biometric/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentialData)
      });

      if (!response.ok) {
        throw new Error('Failed to register credential on server');
      }

      const data = await response.json();
      return data.credentialId;

    } catch (error) {
      logger.error('Failed to send credential to server', error);
      throw error;
    }
  }

  private async verifyWithServer(authData: any): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/biometric/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(authData)
      });

      return response.ok;

    } catch (error) {
      logger.error('Failed to verify with server', error);
      return false;
    }
  }

  private async removeCredentialFromServer(credentialId: string): Promise<void> {
    await fetch('/api/auth/biometric/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ credentialId })
    });
  }

  private storeCredentialReference(credentialId: string, username: string): void {
    const credentials = this.getStoredCredentials();

    credentials.push({
      id: this.base64ToArrayBuffer(credentialId),
      type: 'public-key' as const,
      transports: ['internal'] as AuthenticatorTransport[]
    });

    localStorage.setItem('biometric-credentials', JSON.stringify(credentials));
    localStorage.setItem('biometric-username', username);
  }

  private getStoredCredentials(): PublicKeyCredentialDescriptor[] {
    const credentials = localStorage.getItem('biometric-credentials');

    if (!credentials) {
      return [];
    }

    try {
      return JSON.parse(credentials);
    } catch {
      return [];
    }
  }
}

// Singleton instance
let biometricAuthManagerInstance: BiometricAuthManager | null = null;

export function getBiometricAuthManager(): BiometricAuthManager {
  if (!biometricAuthManagerInstance) {
    biometricAuthManagerInstance = new BiometricAuthManager();
  }
  return biometricAuthManagerInstance;
}

export default BiometricAuthManager;