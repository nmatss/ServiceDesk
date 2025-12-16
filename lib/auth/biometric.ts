/**
 * Biometric Authentication using WebAuthn
 * Supports fingerprint, Face ID, and other platform authenticators
 */

import logger from '../monitoring/structured-logger';

export interface BiometricCredential {
  id: string
  publicKey: string
  counter: number
  userId: string
  createdAt: string
}

export interface BiometricRegistrationOptions {
  userId: string
  userName: string
  userDisplayName: string
  requireResidentKey?: boolean
  authenticatorAttachment?: 'platform' | 'cross-platform'
}

export interface BiometricAuthenticationResult {
  success: boolean
  credentialId?: string
  error?: string
}

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isBiometricSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    typeof navigator.credentials?.create === 'function' &&
    typeof navigator.credentials?.get === 'function'
  )
}

/**
 * Check if platform authenticator (fingerprint/Face ID) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) {
    return false
  }

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    return available
  } catch (error) {
    logger.error('Error checking platform authenticator', error)
    return false
  }
}

/**
 * Generate a random challenge for WebAuthn
 */
function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  return challenge
}

/**
 * Convert Uint8Array to base64url string
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Convert base64url string to Uint8Array
 */
function base64urlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Register a new biometric credential
 */
export async function registerBiometric(
  options: BiometricRegistrationOptions
): Promise<BiometricAuthenticationResult> {
  if (!isBiometricSupported()) {
    return {
      success: false,
      error: 'Biometric authentication is not supported in this browser'
    }
  }

  try {
    const challenge = generateChallenge()

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: challenge as BufferSource,
      rp: {
        name: 'ServiceDesk',
        id: window.location.hostname
      },
      user: {
        id: new TextEncoder().encode(options.userId) as BufferSource,
        name: options.userName,
        displayName: options.userDisplayName
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: options.authenticatorAttachment || 'platform',
        requireResidentKey: options.requireResidentKey || false,
        userVerification: 'required'
      },
      timeout: 60000,
      attestation: 'none'
    }

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    }) as PublicKeyCredential

    if (!credential) {
      return {
        success: false,
        error: 'Failed to create credential'
      }
    }

    const response = credential.response as AuthenticatorAttestationResponse

    // Convert credential data to base64url for storage
    const _credentialData = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: bufferToBase64url(response.attestationObject),
        clientDataJSON: bufferToBase64url(response.clientDataJSON)
      }
    }

    return {
      success: true,
      credentialId: credential.id
    }
  } catch (error) {
    logger.error('Biometric registration error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Authenticate using biometric credential
 */
export async function authenticateBiometric(
  credentialIds?: string[]
): Promise<BiometricAuthenticationResult> {
  if (!isBiometricSupported()) {
    return {
      success: false,
      error: 'Biometric authentication is not supported in this browser'
    }
  }

  try {
    const challenge = generateChallenge()

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challenge as BufferSource,
      timeout: 60000,
      userVerification: 'required',
      rpId: window.location.hostname
    }

    // If specific credential IDs are provided, only allow those
    if (credentialIds && credentialIds.length > 0) {
      publicKeyCredentialRequestOptions.allowCredentials = credentialIds.map(id => ({
        id: base64urlToBuffer(id) as BufferSource,
        type: 'public-key' as const,
        transports: ['internal'] as AuthenticatorTransport[]
      }))
    }

    const credential = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    }) as PublicKeyCredential

    if (!credential) {
      return {
        success: false,
        error: 'Authentication failed'
      }
    }

    const response = credential.response as AuthenticatorAssertionResponse

    // Convert authentication data to base64url for verification
    const _authenticationData = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        authenticatorData: bufferToBase64url(response.authenticatorData),
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        signature: bufferToBase64url(response.signature),
        userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : undefined
      }
    }

    return {
      success: true,
      credentialId: credential.id
    }
  } catch (error) {
    // SECURITY FIX: Use structured logging instead of console.error
    logger.error('Biometric authentication error', error)

    // User cancelled or error occurred
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'Authentication was cancelled'
        }
      }
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: 'Unknown error occurred'
    }
  }
}

/**
 * Get conditional UI for passkeys (autofill)
 */
export async function getConditionalUI(): Promise<BiometricAuthenticationResult> {
  if (!isBiometricSupported()) {
    return {
      success: false,
      error: 'Biometric authentication is not supported'
    }
  }

  try {
    // Check if conditional UI is supported
    if (!PublicKeyCredential.isConditionalMediationAvailable) {
      return {
        success: false,
        error: 'Conditional UI not supported'
      }
    }

    const available = await PublicKeyCredential.isConditionalMediationAvailable()
    if (!available) {
      return {
        success: false,
        error: 'Conditional UI not available'
      }
    }

    const challenge = generateChallenge()

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: challenge as BufferSource,
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname
      },
      mediation: 'conditional'
    }) as PublicKeyCredential

    if (!credential) {
      return {
        success: false,
        error: 'No credential selected'
      }
    }

    return {
      success: true,
      credentialId: credential.id
    }
  } catch (error) {
    logger.error('Conditional UI error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Store biometric credential in database
 */
export async function storeBiometricCredential(
  userId: string,
  credentialId: string,
  publicKey: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/biometric/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        credentialId,
        publicKey,
        createdAt: new Date().toISOString()
      })
    })

    return response.ok
  } catch (error) {
    logger.error('Error storing biometric credential', error)
    return false
  }
}

/**
 * Verify biometric authentication
 */
export async function verifyBiometricAuthentication(
  credentialId: string,
  authenticationData: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/biometric/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        credentialId,
        authenticationData
      })
    })

    return response.ok
  } catch (error) {
    logger.error('Error verifying biometric authentication', error)
    return false
  }
}
