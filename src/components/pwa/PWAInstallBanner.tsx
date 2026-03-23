'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/monitoring/logger';
import {
  XMarkIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  SparklesIcon,
  BoltIcon,
  ShieldCheckIcon,
  WifiIcon
} from '@heroicons/react/24/outline';
import { usePWAContext } from './PWAProvider';

interface InstallStats {
  visitCount: number;
  dismissCount: number;
  userEngagement: {
    sessions: number;
    totalTime: number;
  };
}

export default function PWAInstallBanner() {
  const { isInstallable, isInstalled, installApp, installPrompt } = usePWAContext();
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');
  const [installStats, setInstallStats] = useState<InstallStats | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showAdvancedInfo, setShowAdvancedInfo] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isInstalled || isDismissed) {
      setShowBanner(false);
      return;
    }

    // Get install stats if available
    if (installPrompt) {
      const stats = installPrompt.getInstallStats();
      setInstallStats(stats);
    }

    // Check if user has previously dismissed the banner
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysPassed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

      // Show again after 7 days, or sooner for engaged users
      const threshold = (installStats?.userEngagement.sessions ?? 0) > 5 ? 3 : 7;
      if (daysPassed < threshold) {
        setIsDismissed(true);
        return;
      }
    }

    // Detect device type and OS
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    setDeviceType(isMobile ? 'mobile' : 'desktop');

    // Show banner if installable and conditions are met
    if (isInstallable && installPrompt) {
      const shouldShow = installPrompt.canInstall();
      if (shouldShow) {
        // Smart timing based on user engagement
        const delay = (installStats?.userEngagement.sessions ?? 0) > 3 ? 10000 : 30000;
        const timer = setTimeout(() => {
          setShowBanner(true);
        }, delay);

        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [isInstallable, isInstalled, isDismissed, installPrompt, installStats]);

  const handleInstall = useCallback(async () => {
    if (isInstalling) return;

    setIsInstalling(true);
    try {
      const success = await installApp();
      if (success) {
        setShowBanner(false);
        // Track successful installation
        localStorage.setItem('pwa-install-success', Date.now().toString());
      } else {
        // Show error state briefly
        setTimeout(() => setIsInstalling(false), 2000);
      }
    } catch (error) {
      logger.error('Installation failed', error);
      setIsInstalling(false);
    }
  }, [installApp, isInstalling]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());

    // Track dismissal for analytics
    if (installPrompt) {
      // This would be handled by the install prompt internally
    }
  }, [installPrompt]);

  const handleShowMore = useCallback(() => {
    setShowAdvancedInfo(!showAdvancedInfo);
  }, [showAdvancedInfo]);

  const getInstallInstructions = () => {
    const userAgent = navigator.userAgent;

    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      return {
        browser: 'Safari',
        steps: [
          'Toque no ícone de compartilhamento',
          'Selecione "Adicionar à Tela Inicial"',
          'Confirme a instalação'
        ]
      };
    } else if (/Android/i.test(userAgent)) {
      return {
        browser: 'Chrome',
        steps: [
          'Toque no menu (três pontos)',
          'Selecione "Instalar app"',
          'Confirme a instalação'
        ]
      };
    } else {
      return {
        browser: 'Chrome/Edge',
        steps: [
          'Clique no ícone de instalação na barra de endereços',
          'Ou use o menu > Instalar Insighta',
          'Confirme a instalação'
        ]
      };
    }
  };

  if (!showBanner || !isInstallable) {
    return null;
  }

  const instructions = getInstallInstructions();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-brand-600 via-brand-700 to-purple-700 text-white shadow-2xl animate-slide-up">
      {/* Main Banner */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 relative">
                {deviceType === 'mobile' ? (
                  <DevicePhoneMobileIcon className="h-8 w-8" />
                ) : (
                  <ComputerDesktopIcon className="h-8 w-8" />
                )}
                <SparklesIcon className="h-4 w-4 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold">
                    Instalar Insighta
                  </h3>
                  {installStats && installStats.visitCount > 1 && (
                    <span className="text-xs bg-brand-500 bg-opacity-50 px-2 py-1 rounded-full">
                      Visitante frequente
                    </span>
                  )}
                </div>
                <p className="text-brand-100 text-sm">
                  {deviceType === 'mobile'
                    ? 'Adicione à tela inicial para acesso rápido e recursos offline'
                    : 'Instale como aplicativo para melhor experiência e notificações'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className={`px-4 py-2 bg-white text-brand-600 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-600 ${
                  isInstalling
                    ? 'opacity-75 cursor-not-allowed'
                    : 'hover:bg-brand-50 hover:scale-105'
                }`}
              >
                {isInstalling ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Instalando...</span>
                  </div>
                ) : (
                  'Instalar'
                )}
              </button>

              <button
                onClick={handleShowMore}
                className="px-3 py-2 text-brand-200 hover:text-white hover:bg-brand-800 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-600 text-sm"
              >
                {showAdvancedInfo ? 'Menos' : 'Mais'}
              </button>

              <button
                onClick={handleDismiss}
                className="p-2 text-brand-200 hover:text-white hover:bg-brand-800 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Installation benefits */}
          <div className="mt-3 pt-3 border-t border-brand-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <WifiIcon className="h-4 w-4 text-brand-300" />
                <span>Funciona offline</span>
              </div>
              <div className="flex items-center space-x-2">
                <BoltIcon className="h-4 w-4 text-yellow-300" />
                <span>Carregamento rápido</span>
              </div>
              <div className="flex items-center space-x-2">
                <ShieldCheckIcon className="h-4 w-4 text-green-300" />
                <span>Seguro e confiável</span>
              </div>
              <div className="flex items-center space-x-2">
                <SparklesIcon className="h-4 w-4 text-purple-300" />
                <span>Interface nativa</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Information */}
      {showAdvancedInfo && (
        <div className="border-t border-brand-500 bg-brand-800 bg-opacity-50 p-4 animate-fade-in">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Manual Installation Instructions */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center">
                  <ComputerDesktopIcon className="h-4 w-4 mr-2" />
                  Instalação Manual ({instructions.browser})
                </h4>
                <ol className="text-sm text-brand-100 space-y-1">
                  {instructions.steps.map((step, index) => (
                    <li key={index} className="flex items-start">
                      <span className="inline-block w-5 h-5 bg-brand-600 text-white text-xs rounded-full text-center leading-5 mr-2 flex-shrink-0">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Features & Benefits */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center">
                  <SparklesIcon className="h-4 w-4 mr-2" />
                  Recursos Exclusivos do App
                </h4>
                <ul className="text-sm text-brand-100 space-y-1">
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span>
                    Notificações push em tempo real
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span>
                    Sincronização em segundo plano
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span>
                    Cache inteligente para performance
                  </li>
                  <li className="flex items-center">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span>
                    Atalhos na tela inicial
                  </li>
                </ul>
              </div>
            </div>

            {/* User Stats */}
            {installStats && (
              <div className="mt-4 pt-4 border-t border-brand-600">
                <div className="flex items-center justify-between text-xs text-brand-200">
                  <span>Visitas: {installStats.visitCount}</span>
                  <span>Sessões: {installStats.userEngagement.sessions}</span>
                  <span>Você é um usuário ativo! 🎉</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}