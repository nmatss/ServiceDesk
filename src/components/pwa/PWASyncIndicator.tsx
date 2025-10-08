'use client';

import React from 'react';
import { ArrowPathIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { usePWAContext } from './PWAProvider';

export default function PWASyncIndicator() {
  const { isSyncing, pendingActions, isOnline } = usePWAContext();

  // Don't show if online and nothing is syncing/pending
  if (isOnline && !isSyncing && pendingActions === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Sync status indicator */}
      {(isSyncing || pendingActions > 0) && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 mb-2 max-w-xs">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {isSyncing ? (
                <ArrowPathIcon className="h-5 w-5 text-blue-600 animate-spin" />
              ) : (
                <ClockIcon className="h-5 w-5 text-amber-600" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {isSyncing ? 'Sincronizando...' : 'Aguardando sincronização'}
              </p>
              {pendingActions > 0 && (
                <p className="text-xs text-gray-600">
                  {pendingActions} {pendingActions === 1 ? 'ação pendente' : 'ações pendentes'}
                </p>
              )}
            </div>
          </div>

          {/* Progress indicator */}
          {isSyncing && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          )}

          {/* Pending actions breakdown */}
          {pendingActions > 0 && !isSyncing && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex flex-wrap gap-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                  Tickets
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  Comentários
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success indicator (shows briefly after sync) */}
      {isOnline && !isSyncing && pendingActions === 0 && (
        <div className="bg-green-600 text-white rounded-lg shadow-lg p-3 animate-fade-in-out">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="h-5 w-5" />
            <span className="text-sm font-medium">Sincronizado</span>
          </div>
        </div>
      )}
    </div>
  );
}