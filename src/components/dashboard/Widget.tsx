'use client';

import React, { ReactNode } from 'react';

export interface WidgetProps {
  id: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
}

export function Widget({
  className = '',
  children,
  onClick,
  isSelected = false
}: WidgetProps) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800
        rounded-lg shadow-sm
        border-2 transition-all duration-200
        ${isSelected
          ? 'border-blue-500 dark:border-blue-400 shadow-lg'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
