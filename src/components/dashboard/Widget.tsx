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
        bg-white dark:bg-neutral-800
        rounded-lg shadow-sm
        border-2 transition-all duration-200
        ${isSelected
          ? 'border-brand-500 dark:border-brand-400 shadow-lg'
          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
        }
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
