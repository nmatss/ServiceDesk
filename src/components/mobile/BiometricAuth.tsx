'use client';

/**
 * BiometricAuth Component
 * UI component for biometric authentication (WebAuthn)
 * - Fingerprint / Face ID support
 * - Fallback to PIN
 * - Registration and authentication flows
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getBiometricAuthManager } from '@/lib/pwa/biometric-auth';

interface BiometricAuthProps {
  username?: string;
  displayName?: string;
  onAuthSuccess?: (credentialId: string) => void;
  onAuthFailure?: (error: Error) => void;
  onRegistrationSuccess?: (credentialId: string) => void;
  onRegistrationFailure?: (error: Error) => void;
  mode?: 'login' | 'register';
  showPinFallback?: boolean;
  className?: string;
}

export default function BiometricAuth({
  username = '',
  displayName = '',
  onAuthSuccess,
  onAuthFailure,
  onRegistrationSuccess,
  onRegistrationFailure,
  mode = 'login',
  showPinFallback = true,
  className = '',
}: BiometricAuthProps) {
  const [biometricManager] = useState(() => getBiometricAuthManager());
  const [isSupported, setIsSupported] = useState(false);
  const [isPlatformAuthenticator, setIsPlatformAuthenticator] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [biometricInfo, setBiometricInfo] = useState({
    isSupported: false,
    isPlatformAuthenticator: false,
    supportedMethods: [] as string[],
    hasStoredCredentials: false,
  });

  // Check biometric support on mount
  useEffect(() => {
    async function checkSupport() {
      const info = await biometricManager.getBiometricInfo();
      setBiometricInfo(info);
      setIsSupported(info.isSupported);
      setIsPlatformAuthenticator(info.isPlatformAuthenticator);
    }

    checkSupport();
  }, [biometricManager]);

  // Handle biometric authentication
  const handleBiometricAuth = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await biometricManager.authenticateBiometric({
        userVerification: 'required',
        timeout: 60000,
      });

      if (result) {
        biometricManager.recordBiometricUsage();
        onAuthSuccess?.(result.credentialId);
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      onAuthFailure?.(err instanceof Error ? err : new Error(errorMessage));

      // Show PIN fallback if enabled
      if (showPinFallback) {
        setShowPinInput(true);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [biometricManager, onAuthSuccess, onAuthFailure, showPinFallback]);

  // Handle biometric registration
  const handleBiometricRegister = useCallback(async () => {
    if (!username || !displayName) {
      setError('Username and display name are required');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const credentialId = await biometricManager.registerBiometric({
        username,
        displayName,
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      });

      if (credentialId) {
        biometricManager.setBiometricEnabled(true);
        onRegistrationSuccess?.(credentialId);
      } else {
        throw new Error('Registration failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      onRegistrationFailure?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsProcessing(false);
    }
  }, [biometricManager, username, displayName, onRegistrationSuccess, onRegistrationFailure]);

  // Handle PIN authentication (fallback)
  const handlePinAuth = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (pin.length < 4) {
        setError('PIN must be at least 4 digits');
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        // Verify PIN with server
        const response = await fetch('/api/auth/pin-verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, pin }),
        });

        if (!response.ok) {
          throw new Error('Invalid PIN');
        }

        const data = await response.json();
        onAuthSuccess?.(data.userId || username);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'PIN verification failed';
        setError(errorMessage);
        onAuthFailure?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setIsProcessing(false);
        setPin('');
      }
    },
    [pin, username, onAuthSuccess, onAuthFailure]
  );

  // Get biometric icon based on platform
  const getBiometricIcon = () => {
    if (isPlatformAuthenticator) {
      // Try to detect platform
      const userAgent = navigator.userAgent.toLowerCase();

      if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        return (
          <svg className="w-16 h-16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          </svg>
        );
      } else if (userAgent.includes('android')) {
        return (
          <svg className="w-16 h-16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1C8.14 1 5 4.14 5 8c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-3.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5zm-2 14v2h4v-2h-4z" />
          </svg>
        );
      }
    }

    return (
      <svg className="w-16 h-16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1C8.14 1 5 4.14 5 8c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-3.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5z" />
      </svg>
    );
  };

  // If biometric is not supported, show fallback
  if (!isSupported) {
    return (
      <div className={`biometric-auth-container ${className}`}>
        <div className="text-center p-6">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Autenticação Biométrica Não Disponível
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Seu dispositivo não suporta autenticação biométrica
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`biometric-auth-container ${className}`}>
      {!showPinInput ? (
        <div className="text-center p-6">
          {/* Biometric Icon */}
          <div className="mb-6 text-blue-600 dark:text-blue-400 flex justify-center">
            {getBiometricIcon()}
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            {mode === 'register' ? 'Configurar Biometria' : 'Autenticação Biométrica'}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {mode === 'register'
              ? 'Configure sua biometria para acesso rápido e seguro'
              : 'Use sua impressão digital ou Face ID para entrar'}
          </p>

          {/* Action Button */}
          <button
            onClick={mode === 'register' ? handleBiometricRegister : handleBiometricAuth}
            disabled={isProcessing}
            className={`
              w-full px-6 py-3 rounded-lg font-semibold text-white
              transition-all duration-200 transform
              ${
                isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              }
            `}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processando...
              </span>
            ) : mode === 'register' ? (
              'Configurar Biometria'
            ) : (
              'Autenticar'
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* PIN Fallback Button */}
          {mode === 'login' && showPinFallback && !isProcessing && (
            <button
              onClick={() => setShowPinInput(true)}
              className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Usar PIN em vez disso
            </button>
          )}

          {/* Info */}
          <div className="mt-6 text-xs text-gray-500 dark:text-gray-500">
            {isPlatformAuthenticator ? (
              <p>Autenticação segura usando biometria do dispositivo</p>
            ) : (
              <p>Autenticação usando chave de segurança externa</p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center p-6">
          {/* PIN Icon */}
          <div className="mb-6 text-gray-600 dark:text-gray-400 flex justify-center">
            <svg className="w-16 h-16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Digite seu PIN
          </h3>

          {/* PIN Form */}
          <form onSubmit={handlePinAuth} className="mt-6">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Digite seu PIN"
              maxLength={6}
              className="w-full px-4 py-3 text-center text-2xl tracking-widest border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:bg-gray-800 dark:text-white"
              autoFocus
              disabled={isProcessing}
            />

            <button
              type="submit"
              disabled={isProcessing || pin.length < 4}
              className={`
                w-full mt-4 px-6 py-3 rounded-lg font-semibold text-white
                transition-all duration-200 transform
                ${
                  isProcessing || pin.length < 4
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }
              `}
            >
              {isProcessing ? 'Verificando...' : 'Confirmar'}
            </button>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Back to Biometric */}
            <button
              type="button"
              onClick={() => {
                setShowPinInput(false);
                setPin('');
                setError(null);
              }}
              className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Voltar para biometria
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Biometric Status Badge Component
export function BiometricStatusBadge() {
  const [biometricManager] = useState(() => getBiometricAuthManager());
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    setIsEnabled(biometricManager.isBiometricEnabled());
  }, [biometricManager]);

  if (!isEnabled) return null;

  return (
    <div className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/20">
      <svg className="w-4 h-4 text-green-600 dark:text-green-400 mr-1" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1C8.14 1 5 4.14 5 8c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-3.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5z" />
      </svg>
      <span className="text-xs font-medium text-green-600 dark:text-green-400">Biometria Ativa</span>
    </div>
  );
}

// Biometric Settings Component
export function BiometricSettings() {
  const [biometricManager] = useState(() => getBiometricAuthManager());
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricInfo, setBiometricInfo] = useState({
    isSupported: false,
    isPlatformAuthenticator: false,
    supportedMethods: [] as string[],
    hasStoredCredentials: false,
  });

  useEffect(() => {
    async function loadInfo() {
      const info = await biometricManager.getBiometricInfo();
      setBiometricInfo(info);
      setIsEnabled(biometricManager.isBiometricEnabled());
    }

    loadInfo();
  }, [biometricManager]);

  const handleToggleBiometric = async () => {
    if (isEnabled) {
      await biometricManager.removeBiometricCredentials();
      biometricManager.setBiometricEnabled(false);
      setIsEnabled(false);
    } else {
      // Show registration flow
      setIsEnabled(true);
    }
  };

  if (!biometricInfo.isSupported) {
    return null;
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
        Autenticação Biométrica
      </h3>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {isEnabled ? 'Ativada' : 'Desativada'}
        </span>
        <button
          onClick={handleToggleBiometric}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${isEnabled ? 'bg-blue-600' : 'bg-gray-300'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {biometricInfo.hasStoredCredentials && (
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Credenciais biométricas configuradas
        </p>
      )}
    </div>
  );
}
