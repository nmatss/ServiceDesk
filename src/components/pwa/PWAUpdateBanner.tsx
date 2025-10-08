'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/monitoring/logger';
import {
  ArrowPathIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { usePWAContext } from './PWAProvider';

interface UpdateInfo {
  version?: string;
  size?: number;
  description?: string;
  isForced?: boolean;
  changelog?: string[];
}

export default function PWAUpdateBanner() {
  const { updateAvailable, updateApp, updateManager } = usePWAContext();
  const [showBanner, setShowBanner] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [dismissTimer, setDismissTimer] = useState<number | null>(null);

  useEffect(() => {
    if (updateAvailable) {
      setShowBanner(true);

      // Get update information if available
      if (updateManager) {
        const info = updateManager.getUpdateInfo();
        setUpdateInfo(info);

        // Auto-dismiss after 30 seconds for non-forced updates
        if (!info?.isForced) {
          const timer = setTimeout(() => {
            setShowBanner(false);
          }, 30000);
          setDismissTimer(timer);
        }
      }
    }

    return () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
      }
    };
  }, [updateAvailable, updateManager, dismissTimer]);

  const handleUpdate = useCallback(async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const success = await updateApp();
      if (!success) {
        // Show error state briefly
        setTimeout(() => setIsUpdating(false), 2000);
      }
    } catch (error) {
      logger.error('Update failed', error);
      setIsUpdating(false);
    }
  }, [updateApp, isUpdating]);

  const handleDismiss = useCallback(() => {
    if (updateInfo?.isForced) {
      return; // Cannot dismiss forced updates
    }

    setShowBanner(false);
    if (dismissTimer) {
      clearTimeout(dismissTimer);
    }

    // Track dismissal
    localStorage.setItem('pwa-update-dismissed', Date.now().toString());
  }, [updateInfo?.isForced, dismissTimer]);

  const handleToggleChangelog = useCallback(() => {
    setShowChangelog(!showChangelog);
  }, [showChangelog]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!showBanner || !updateAvailable) {
    return null;
  }

  const isForced = updateInfo?.isForced;
  const bannerColor = isForced ? 'from-orange-600 to-red-600' : 'from-green-600 to-green-700';

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 bg-gradient-to-r ${bannerColor} text-white shadow-2xl animate-slide-down`}>
      {/* Main Banner */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 relative">
                {isForced ? (
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-300" />
                ) : (
                  <ArrowPathIcon className={`h-6 w-6 ${isUpdating ? 'animate-spin' : ''}`} />
                )}
                {!isUpdating && (
                  <CheckCircleIcon className="h-3 w-3 absolute -top-1 -right-1 text-green-300 animate-pulse" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold">
                    {isForced ? 'Atualização Obrigatória' : 'Nova versão disponível'}
                  </h3>
                  {updateInfo?.version && (
                    <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                      v{updateInfo.version}
                    </span>
                  )}
                  {updateInfo?.size && (
                    <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">
                      {formatFileSize(updateInfo.size)}
                    </span>
                  )}
                </div>
                <p className={`text-sm ${isForced ? 'text-orange-100' : 'text-green-100'}`}>
                  {isForced
                    ? 'Esta atualização é necessária para continuar usando o ServiceDesk'
                    : updateInfo?.description || 'Uma nova versão do ServiceDesk está disponível com melhorias e correções'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {updateInfo?.changelog && (
                <button
                  onClick={handleToggleChangelog}
                  className={`px-3 py-2 text-sm ${isForced ? 'text-orange-200 hover:text-white hover:bg-orange-800' : 'text-green-200 hover:text-white hover:bg-green-800'} rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 ${isForced ? 'focus:ring-offset-orange-600' : 'focus:ring-offset-green-600'}`}
                >
                  {showChangelog ? 'Ocultar' : 'Ver'} Mudanças
                </button>
              )}

              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className={`px-4 py-2 bg-white ${isForced ? 'text-orange-600' : 'text-green-600'} rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 ${isForced ? 'focus:ring-offset-orange-600' : 'focus:ring-offset-green-600'} ${!isUpdating ? 'hover:scale-105' : ''}`}
              >
                {isUpdating ? (
                  <div className="flex items-center space-x-2">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    <span>Atualizando...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    {isForced && <ClockIcon className="h-4 w-4" />}
                    <span>{isForced ? 'Atualizar Agora' : 'Atualizar'}</span>
                  </div>
                )}
              </button>

              {!isUpdating && !isForced && (
                <button
                  onClick={handleDismiss}
                  className="p-2 text-green-200 hover:text-white hover:bg-green-800 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-600"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Update benefits */}
          <div className={`mt-3 pt-3 border-t ${isForced ? 'border-orange-500' : 'border-green-500'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className={`flex items-center space-x-2 ${isForced ? 'text-orange-100' : 'text-green-100'}`}>
                <CheckCircleIcon className="h-4 w-4 text-green-300" />
                <span>Novas funcionalidades</span>
              </div>
              <div className={`flex items-center space-x-2 ${isForced ? 'text-orange-100' : 'text-green-100'}`}>
                <CheckCircleIcon className="h-4 w-4 text-green-300" />
                <span>Correções de bugs</span>
              </div>
              <div className={`flex items-center space-x-2 ${isForced ? 'text-orange-100' : 'text-green-100'}`}>
                <CheckCircleIcon className="h-4 w-4 text-green-300" />
                <span>Melhorias de performance</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Changelog */}
      {showChangelog && updateInfo?.changelog && (
        <div className={`border-t ${isForced ? 'border-orange-500 bg-orange-800' : 'border-green-500 bg-green-800'} bg-opacity-50 p-4 animate-fade-in`}>
          <div className="max-w-4xl mx-auto">
            <h4 className="font-semibold text-sm mb-3 flex items-center">
              <InformationCircleIcon className="h-4 w-4 mr-2" />
              O que há de novo
            </h4>
            <ul className={`space-y-2 text-sm ${isForced ? 'text-orange-100' : 'text-green-100'}`}>
              {updateInfo.changelog.map((change, index) => (
                <li key={index} className="flex items-start">
                  <span className={`inline-block w-1.5 h-1.5 ${isForced ? 'bg-orange-300' : 'bg-green-300'} rounded-full mr-3 mt-2 flex-shrink-0`}></span>
                  {change}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Forced update warning */}
      {isForced && (
        <div className="border-t border-red-500 bg-red-900 bg-opacity-50 p-3">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-2 text-sm text-red-100">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-300" />
              <span>
                Esta atualização contém correções críticas de segurança e é obrigatória.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}