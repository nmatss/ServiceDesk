'use client';

import React from 'react';
import {
  FaceSmileIcon,
  FaceFrownIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';
export type SentimentTrend = 'improving' | 'stable' | 'declining';

export interface SentimentData {
  label: SentimentLabel;
  score: number;
  trend: SentimentTrend;
}

interface SentimentIndicatorProps {
  sentiment: SentimentData;
  className?: string;
}

const CONFIG: Record<
  SentimentLabel,
  { bg: string; text: string; icon: React.ElementType; labelPt: string }
> = {
  positive: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: FaceSmileIcon,
    labelPt: 'Positivo',
  },
  neutral: {
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
    icon: MinusIcon,
    labelPt: 'Neutro',
  },
  negative: {
    bg: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-700 dark:text-red-300',
    icon: FaceFrownIcon,
    labelPt: 'Negativo',
  },
};

const TREND_CONFIG: Record<
  SentimentTrend,
  { icon: React.ElementType; labelPt: string; color: string }
> = {
  improving: {
    icon: ArrowTrendingUpIcon,
    labelPt: 'Melhorando',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  stable: {
    icon: MinusIcon,
    labelPt: 'Estável',
    color: 'text-neutral-500 dark:text-neutral-400',
  },
  declining: {
    icon: ArrowTrendingDownIcon,
    labelPt: 'Piorando',
    color: 'text-red-600 dark:text-red-400',
  },
};

export function SentimentIndicator({ sentiment, className = '' }: SentimentIndicatorProps) {
  const cfg = CONFIG[sentiment.label];
  const trendCfg = TREND_CONFIG[sentiment.trend];
  const Icon = cfg.icon;
  const TrendIcon = trendCfg.icon;

  const scorePct = Math.round(Math.abs(sentiment.score) * 100);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${cfg.bg} ${className}`}
    >
      <Icon className={`h-4 w-4 ${cfg.text}`} />
      <span className={`text-sm font-medium ${cfg.text}`}>{cfg.labelPt}</span>
      <span className={`text-xs ${cfg.text} opacity-70`}>{scorePct}%</span>

      <span className="mx-1 h-3 w-px bg-neutral-300 dark:bg-neutral-600" />

      <TrendIcon className={`h-3.5 w-3.5 ${trendCfg.color}`} />
      <span className={`text-xs ${trendCfg.color}`}>{trendCfg.labelPt}</span>
    </div>
  );
}
