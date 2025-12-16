'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  WifiIcon,
  CloudIcon,
  SignalSlashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { usePWAContext } from './PWAProvider';

interface ConnectionInfo {
  type: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
}

export default function PWAOfflineIndicator() {
  const { isOnline, offlineSync } = usePWAContext();
  const [showIndicator, setShowIndicator] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isOnline && !wasOffline) {
      // Just went offline
      setShowIndicator(true);
      setWasOffline(true);
    } else if (isOnline && wasOffline) {
      // Just came back online
      setShowIndicator(true);
      setWasOffline(false);

      // Hide the "back online" indicator after 3 seconds
      const timer = setTimeout(() => {
        setShowIndicator(false);
      }, 3000);

      return () => clearTimeout(timer);
    } else if (!isOnline) {
      // Still offline
      setShowIndicator(true);
    } else {
      // Online and wasn't offline before
      setShowIndicator(false);
    }
    return undefined;

    // Update queue status
    if (offlineSync) {
      const status = offlineSync.getQueueStatus();
      setQueueStatus(status);
    }

    // Get connection information if available
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        setConnectionInfo({
          type: conn.type || 'unknown',
          effectiveType: conn.effectiveType || 'unknown',
          downlink: conn.downlink || 0,
          rtt: conn.rtt || 0
        });
      }
    }
  }, [isOnline, wasOffline, offlineSync]);

  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const getConnectionQuality = () => {
    if (!connectionInfo) return 'unknown';

    const { effectiveType, downlink } = connectionInfo;

    if (effectiveType === '4g' && downlink > 10) return 'excellent';
    if (effectiveType === '4g' || downlink > 5) return 'good';
    if (effectiveType === '3g' || downlink > 1) return 'fair';
    return 'poor';
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-green-300';
      case 'fair': return 'text-yellow-300';
      case 'poor': return 'text-red-300';
      default: return 'text-gray-400';
    }
  };

  if (!showIndicator) {
    return null;
  }

  const quality = getConnectionQuality();
  const qualityColor = getQualityColor(quality);

  return (
    <div
      className={`fixed top-4 right-4 z-40 rounded-lg shadow-2xl transition-all duration-300 backdrop-blur-sm border ${
        isOnline
          ? 'bg-green-600/90 text-white animate-bounce border-green-400'
          : 'bg-orange-600/90 text-white border-orange-400'
      } ${isExpanded ? 'p-4 w-80' : 'p-3'}`}
    >
      {/* Main indicator */}
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0 relative">
          {isOnline ? (
            <WifiIcon className="h-5 w-5" />
          ) : (
            <SignalSlashIcon className="h-5 w-5" />
          )}

          {/* Connection quality indicator */}
          {isOnline && connectionInfo && (
            <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${qualityColor.replace('text-', 'bg-')}`}></div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">
              {isOnline ? 'Conexão restaurada!' : 'Modo offline'}
            </p>
            {queueStatus && queueStatus.total > 0 && (
              <span className="inline-flex items-center px-2 py-1 text-xs bg-white bg-opacity-20 rounded-full">
                {queueStatus.total}
              </span>
            )}
          </div>

          <p className="text-xs opacity-90">
            {isOnline
              ? connectionInfo
                ? `${connectionInfo.effectiveType?.toUpperCase()} • ${connectionInfo.downlink}Mbps`
                : 'Sincronizando dados...'
              : queueStatus
                ? `${queueStatus.total} ações na fila`
                : 'Você pode continuar trabalhando'
            }
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {queueStatus?.syncInProgress && (
            <ArrowPathIcon className="h-4 w-4 animate-spin opacity-75" />
          )}

          <button
            onClick={handleToggleExpanded}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
          >
            {isExpanded ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-white border-opacity-20 animate-fade-in">
          {isOnline ? (
            <div className="space-y-3">
              {/* Connection details */}
              {connectionInfo && (
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center">
                    <WifiIcon className="h-3 w-3 mr-1" />
                    Qualidade da Conexão
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="opacity-75">Tipo:</span>
                      <span className="font-medium">{connectionInfo.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-75">Velocidade:</span>
                      <span className={`font-medium ${qualityColor}`}>
                        {connectionInfo.downlink} Mbps
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-75">Latência:</span>
                      <span className="font-medium">{connectionInfo.rtt}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-75">Qualidade:</span>
                      <span className={`font-medium ${qualityColor}`}>
                        {quality}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sync status */}
              {queueStatus && (
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center">
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                    Status de Sincronização
                  </h4>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-3 w-3 text-green-300" />
                      <span>Todas as ações foram sincronizadas</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Offline capabilities */}
              <div>
                <h4 className="text-xs font-semibold mb-2 flex items-center">
                  <CloudIcon className="h-3 w-3 mr-1" />
                  Recursos Offline Ativos
                </h4>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    <span>Cache de páginas</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    <span>Dados locais</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                    <span>Sincronização pendente</span>
                  </div>
                </div>
              </div>

              {/* Queue status */}
              {queueStatus && queueStatus.total > 0 && (
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center">
                    <ClockIcon className="h-3 w-3 mr-1" />
                    Fila de Sincronização
                  </h4>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="opacity-75">Total de ações:</span>
                      <span className="font-medium">{queueStatus.total}</span>
                    </div>
                    {queueStatus.byPriority && (
                      <div className="grid grid-cols-2 gap-1">
                        {Object.entries(queueStatus.byPriority).map(([priority, count]) => (
                          <div key={priority} className="flex justify-between">
                            <span className="opacity-75 capitalize">{priority}:</span>
                            <span className="font-medium">{count as number}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Offline tips */}
              <div className="bg-white bg-opacity-10 rounded p-2">
                <div className="flex items-start space-x-2">
                  <ExclamationTriangleIcon className="h-3 w-3 mt-0.5 text-yellow-300" />
                  <div className="text-xs">
                    <span className="font-medium">Dica:</span> Suas ações serão sincronizadas automaticamente quando a conexão for restaurada.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}