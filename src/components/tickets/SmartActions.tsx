'use client';

import React from 'react';
import {
  ArrowUpCircleIcon,
  ArrowsPointingInIcon,
  ExclamationTriangleIcon,
  TagIcon,
} from '@heroicons/react/24/outline';

export interface SmartActionData {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  reason?: string;
}

interface SmartActionsProps {
  actions: SmartActionData[];
  onEscalate: () => void;
  onMerge: () => void;
  onMarkKnownError: () => void;
  onReclassify: () => void;
  className?: string;
}

const ACTION_CONFIG: Record<
  string,
  { icon: React.ElementType; bgEnabled: string; bgDisabled: string }
> = {
  escalate: {
    icon: ArrowUpCircleIcon,
    bgEnabled:
      'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:hover:bg-orange-900/60',
    bgDisabled: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600',
  },
  merge: {
    icon: ArrowsPointingInIcon,
    bgEnabled:
      'bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300 dark:hover:bg-brand-900/60',
    bgDisabled: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600',
  },
  known_error: {
    icon: ExclamationTriangleIcon,
    bgEnabled:
      'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60',
    bgDisabled: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600',
  },
  reclassify: {
    icon: TagIcon,
    bgEnabled:
      'bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/40 dark:text-brand-300 dark:hover:bg-brand-900/60',
    bgDisabled: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600',
  },
};

const ACTION_HANDLERS: Record<string, keyof Pick<SmartActionsProps, 'onEscalate' | 'onMerge' | 'onMarkKnownError' | 'onReclassify'>> = {
  escalate: 'onEscalate',
  merge: 'onMerge',
  known_error: 'onMarkKnownError',
  reclassify: 'onReclassify',
};

export function SmartActions({
  actions,
  onEscalate,
  onMerge,
  onMarkKnownError,
  onReclassify,
  className = '',
}: SmartActionsProps) {
  const handlers: Record<string, () => void> = {
    escalate: onEscalate,
    merge: onMerge,
    known_error: onMarkKnownError,
    reclassify: onReclassify,
  };

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white/80 p-4 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/80 ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          Acoes Inteligentes
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const cfg = ACTION_CONFIG[action.key] || ACTION_CONFIG.reclassify;
          const Icon = cfg.icon;
          const colorClass = action.enabled ? cfg.bgEnabled : cfg.bgDisabled;
          const handler = handlers[action.key];

          return (
            <button
              key={action.key}
              type="button"
              disabled={!action.enabled}
              onClick={handler}
              title={action.enabled ? action.description : action.reason || 'Indisponivel'}
              className={`flex flex-col items-center gap-1.5 rounded-lg p-3 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 dark:focus:ring-offset-neutral-900 ${colorClass} ${
                !action.enabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium leading-tight">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
