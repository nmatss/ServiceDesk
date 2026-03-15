'use client';

import React from 'react';

interface CompanyLogoWidgetProps {
  id: string;
  title: string;
  config: {
    logoUrl?: string;
    companyName?: string;
    showName: boolean;
    size: 'small' | 'medium' | 'large';
  };
  onUpdate: (updates: any) => void;
}

export function CompanyLogoWidget({
  config
}: CompanyLogoWidgetProps) {
  const sizeClasses = {
    small: 'h-12 w-12',
    medium: 'h-16 w-16',
    large: 'h-24 w-24'
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-6 flex items-center justify-center">
      <div className="text-center">
        {config.logoUrl ? (
          <img
            src={config.logoUrl}
            alt={config.companyName || 'Company Logo'}
            className={`mx-auto ${sizeClasses[config.size]} object-contain`}
          />
        ) : (
          <div className={`mx-auto ${sizeClasses[config.size]} bg-brand-100 dark:bg-brand-900/20 rounded-lg flex items-center justify-center`}>
            <span className="text-brand-600 dark:text-brand-400 font-bold text-lg">
              {(config.companyName || 'Company').charAt(0)}
            </span>
          </div>
        )}
        {config.showName && (
          <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
            {config.companyName || 'Company Name'}
          </p>
        )}
      </div>
    </div>
  );
}