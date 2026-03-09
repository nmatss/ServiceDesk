'use client';

import React, { ReactNode } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export interface WidgetBodyProps {
  children: ReactNode;
  isLoading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  scrollable?: boolean;
  maxHeight?: string;
}

export function WidgetBody({
  children,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'Nenhum dado disponível',
  className = '',
  padding = 'md',
  scrollable = false,
  maxHeight
}: WidgetBodyProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6'
  };

  const bodyContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 dark:text-red-400 mb-3" />
          <p className="text-sm font-medium text-neutral-900 dark:text-white mb-1">
            Erro ao Carregar Dados
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
            {error}
          </p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
          <ArrowPathIcon className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Carregando...
          </p>
        </div>
      );
    }

    if (isEmpty) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
          <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center mb-3">
            <svg className="w-8 h-8 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {emptyMessage}
          </p>
        </div>
      );
    }

    return children;
  };

  return (
    <div
      className={`
        ${paddingClasses[padding]}
        ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'}
        ${className}
      `}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {bodyContent()}
    </div>
  );
}
