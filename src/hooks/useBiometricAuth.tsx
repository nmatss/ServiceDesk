'use client'

import { useState, useCallback, useEffect } from 'react'
import { logger } from '@/lib/monitoring/logger';

export interface BiometricCredential {
  id: string
  publicKey: ArrayBuffer
  userHandle: string
  type: 'public-key'
}

export interface BiometricAuthOptions {
  userDisplayName: string
  userName: string
  userId: string
  rpName?: string
  rpId?: string
  timeout?: number
  userVerification?: 'required' | 'preferred' | 'discouraged'
}

export interface BiometricAuthResult {
  success: boolean
  credentialId?: string
  error?: string
  authenticatorData?: ArrayBuffer
  clientDataJSON?: ArrayBuffer
  signature?: ArrayBuffer
}

export const useBiometricAuth = () => {
  const [isSupported, setIsSupported] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [availableCredentials, setAvailableCredentials] = useState<string[]>([])

  useEffect(() => {
    // Check WebAuthn support
    const checkSupport = () => {
      const supported =
        'credentials' in navigator &&
        'create' in navigator.credentials &&
        'get' in navigator.credentials &&
        typeof PublicKeyCredential !== 'undefined'

      setIsSupported(supported)

      // Check for platform authenticator (biometric) support
      if (supported && 'isUserVerifyingPlatformAuthenticatorAvailable' in PublicKeyCredential) {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          .then(available => {
            if (!available) {
              logger.warn('Platform authenticator not available')
            }
          })
          .catch(err => logger.error('Error checking platform authenticator availability', err))
      }
    }

    checkSupport()

    // Load stored credentials
    const stored = localStorage.getItem('biometric_credentials')
    if (stored) {
      try {
        setAvailableCredentials(JSON.parse(stored))
      } catch (error) {
        logger.error('Failed to parse stored credentials', error)
        localStorage.removeItem('biometric_credentials')
      }
    }
  }, [])

  const generateChallenge = useCallback((): Uint8Array => {
    return crypto.getRandomValues(new Uint8Array(32))
  }, [])

  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0)
    }
    return btoa(binary)
  }, [])

  const base64ToArrayBuffer = useCallback((base64: string): ArrayBuffer => {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }, [])

  const enrollBiometric = useCallback(async (options: BiometricAuthOptions): Promise<BiometricAuthResult> => {
    if (!isSupported) {
      return { success: false, error: 'WebAuthn não é suportado neste dispositivo' }
    }

    setIsEnrolling(true)

    try {
      const challenge = generateChallenge()

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: options.rpName || 'ServiceDesk Pro',
          id: options.rpId || window.location.hostname
        },
        user: {
          id: new TextEncoder().encode(options.userId),
          name: options.userName,
          displayName: options.userDisplayName
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: options.userVerification || 'preferred',
          requireResidentKey: true
        },
        timeout: options.timeout || 60000,
        attestation: 'direct'
      }

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential

      if (!credential) {
        return { success: false, error: 'Falha ao criar credencial biométrica' }
      }

      const response = credential.response as AuthenticatorAttestationResponse
      const credentialId = arrayBufferToBase64(credential.rawId)

      // Store credential ID locally using functional setState to avoid stale closure
      setAvailableCredentials(prev => {
        const updatedCredentials = [...prev, credentialId]
        localStorage.setItem('biometric_credentials', JSON.stringify(updatedCredentials))
        return updatedCredentials
      })

      // Store credential data securely (in a real app, send to server)
      const credentialData = {
        id: credentialId,
        publicKey: arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0)),
        userHandle: options.userId,
        type: 'public-key'
      }

      const storedCredentials = JSON.parse(localStorage.getItem('biometric_credential_data') || '{}')
      storedCredentials[credentialId] = credentialData
      localStorage.setItem('biometric_credential_data', JSON.stringify(storedCredentials))

      return {
        success: true,
        credentialId
      }
    } catch (error: any) {
      logger.error('Biometric enrollment failed', error)

      let errorMessage = 'Falha ao configurar autenticação biométrica'

      if (error.name === 'NotSupportedError') {
        errorMessage = 'Autenticação biométrica não é suportada'
      } else if (error.name === 'NotAllowedError') {
        errorMessage = 'Permissão negada para autenticação biométrica'
      } else if (error.name === 'InvalidStateError') {
        errorMessage = 'Credencial já existe para este usuário'
      } else if (error.name === 'ConstraintError') {
        errorMessage = 'Configuração de autenticação não suportada'
      } else if (error.name === 'AbortError') {
        errorMessage = 'Operação cancelada pelo usuário'
      }

      return { success: false, error: errorMessage }
    } finally {
      setIsEnrolling(false)
    }
  }, [isSupported, generateChallenge, arrayBufferToBase64])

  const authenticateWithBiometric = useCallback(async (
    _userName?: string,
    credentialIds?: string[]
  ): Promise<BiometricAuthResult> => {
    if (!isSupported) {
      return { success: false, error: 'WebAuthn não é suportado neste dispositivo' }
    }

    // Get current credentials to avoid stale closure
    const currentCredentials = credentialIds || availableCredentials

    if (currentCredentials.length === 0) {
      return { success: false, error: 'Nenhuma credencial biométrica configurada' }
    }

    setIsAuthenticating(true)

    try {
      const challenge = generateChallenge()
      const allowCredentials = currentCredentials.map(id => ({
        id: base64ToArrayBuffer(id) as ArrayBuffer,
        type: 'public-key' as const
      }))

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials,
        timeout: 60000,
        userVerification: 'preferred',
        rpId: window.location.hostname
      }

      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      }) as PublicKeyCredential

      if (!credential) {
        return { success: false, error: 'Falha na autenticação biométrica' }
      }

      const response = credential.response as AuthenticatorAssertionResponse
      const credentialId = arrayBufferToBase64(credential.rawId)

      // In a real app, you would send these to the server for verification
      return {
        success: true,
        credentialId,
        authenticatorData: response.authenticatorData,
        clientDataJSON: response.clientDataJSON,
        signature: response.signature
      }
    } catch (error: any) {
      logger.error('Biometric authentication failed', error)

      let errorMessage = 'Falha na autenticação biométrica'

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Autenticação biométrica foi cancelada ou falhou'
      } else if (error.name === 'AbortError') {
        errorMessage = 'Operação cancelada pelo usuário'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Autenticação biométrica não é suportada'
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Erro de segurança na autenticação'
      }

      return { success: false, error: errorMessage }
    } finally {
      setIsAuthenticating(false)
    }
  }, [isSupported, availableCredentials, generateChallenge, base64ToArrayBuffer, arrayBufferToBase64])

  const removeBiometricCredential = useCallback((credentialId: string) => {
    // Use functional setState to avoid stale closure
    setAvailableCredentials(prev => {
      const updatedCredentials = prev.filter(id => id !== credentialId)
      localStorage.setItem('biometric_credentials', JSON.stringify(updatedCredentials))
      return updatedCredentials
    })

    // Remove credential data
    const storedCredentials = JSON.parse(localStorage.getItem('biometric_credential_data') || '{}')
    delete storedCredentials[credentialId]
    localStorage.setItem('biometric_credential_data', JSON.stringify(storedCredentials))
  }, [])

  const clearAllBiometricCredentials = useCallback(() => {
    setAvailableCredentials([])
    localStorage.removeItem('biometric_credentials')
    localStorage.removeItem('biometric_credential_data')
  }, [])

  const checkBiometricAvailability = useCallback(async (): Promise<{
    available: boolean
    platformAuthenticator: boolean
    conditionalMediation: boolean
  }> => {
    if (!isSupported) {
      return {
        available: false,
        platformAuthenticator: false,
        conditionalMediation: false
      }
    }

    try {
      const platformAuthenticator = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()

      let conditionalMediation = false
      if ('isConditionalMediationAvailable' in PublicKeyCredential) {
        conditionalMediation = await (PublicKeyCredential as any).isConditionalMediationAvailable()
      }

      return {
        available: true,
        platformAuthenticator,
        conditionalMediation
      }
    } catch (error) {
      logger.error('Failed to check biometric availability', error)
      return {
        available: false,
        platformAuthenticator: false,
        conditionalMediation: false
      }
    }
  }, [isSupported])

  return {
    isSupported,
    isEnrolling,
    isAuthenticating,
    availableCredentials,
    enrollBiometric,
    authenticateWithBiometric,
    removeBiometricCredential,
    clearAllBiometricCredentials,
    checkBiometricAvailability
  }
}

// Component for biometric authentication button
export interface BiometricAuthButtonProps {
  onSuccess: (result: BiometricAuthResult) => void
  onError?: (error: string) => void
  userName?: string
  mode: 'enroll' | 'authenticate'
  enrollOptions?: BiometricAuthOptions
  className?: string
  children?: React.ReactNode
}

export const BiometricAuthButton: React.FC<BiometricAuthButtonProps> = ({
  onSuccess,
  onError,
  userName,
  mode,
  enrollOptions,
  className = '',
  children
}) => {
  const {
    isSupported,
    isEnrolling,
    isAuthenticating,
    enrollBiometric,
    authenticateWithBiometric
  } = useBiometricAuth()

  const handleClick = useCallback(async () => {
    if (mode === 'enroll' && enrollOptions) {
      const result = await enrollBiometric(enrollOptions)
      if (result.success) {
        onSuccess(result)
      } else {
        onError?.(result.error || 'Falha na configuração biométrica')
      }
    } else if (mode === 'authenticate') {
      const result = await authenticateWithBiometric(userName)
      if (result.success) {
        onSuccess(result)
      } else {
        onError?.(result.error || 'Falha na autenticação biométrica')
      }
    }
  }, [mode, enrollOptions, enrollBiometric, authenticateWithBiometric, userName, onSuccess, onError])

  if (!isSupported) {
    return null
  }

  const isLoading = mode === 'enroll' ? isEnrolling : isAuthenticating

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`btn btn-primary flex items-center space-x-2 ${className}`}
    >
      {isLoading && <div className="w-4 h-4 loading-spinner" />}
      <span>
        {children || (mode === 'enroll' ? 'Configurar Biometria' : 'Autenticar com Biometria')}
      </span>
    </button>
  )
}