'use client';

import { Badge, getRarityColor, getRarityBackground } from '@/lib/gamification/achievements';
import { useState, useEffect } from 'react';

interface AchievementBadgeProps {
  badge: Badge;
  unlocked: boolean;
  progress?: {
    currentValue: number;
    targetValue: number;
    percentage: number;
  };
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showProgress?: boolean;
  onClick?: () => void;
}

export default function AchievementBadge({
  badge,
  unlocked,
  progress,
  size = 'md',
  animated = false,
  showProgress = true,
  onClick,
}: AchievementBadgeProps) {
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    if (animated && unlocked) {
      setIsUnlocking(true);
      const timeout = setTimeout(() => setIsUnlocking(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [animated, unlocked]);

  const sizeClasses = {
    sm: {
      container: 'w-20 h-20',
      icon: 'text-3xl',
      badge: 'text-xs',
      title: 'text-xs',
      description: 'text-xs',
    },
    md: {
      container: 'w-28 h-28',
      icon: 'text-5xl',
      badge: 'text-xs',
      title: 'text-sm',
      description: 'text-xs',
    },
    lg: {
      container: 'w-36 h-36',
      icon: 'text-6xl',
      badge: 'text-sm',
      title: 'text-base',
      description: 'text-sm',
    },
  };

  const rarityColor = getRarityColor(badge.rarity);
  const rarityBackground = getRarityBackground(badge.rarity);

  return (
    <div
      className={`relative group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Badge Container */}
      <div
        className={`
          ${sizeClasses[size].container}
          rounded-lg
          border-2
          ${unlocked ? `${rarityBackground} border-current ${rarityColor}` : 'bg-gray-100 border-gray-300'}
          flex flex-col items-center justify-center
          transition-all duration-300
          ${unlocked ? 'hover:scale-105 hover:shadow-lg' : 'opacity-50'}
          ${isUnlocking ? 'animate-bounce' : ''}
        `}
      >
        {/* Icon */}
        <div className={`${sizeClasses[size].icon} ${unlocked ? '' : 'grayscale'}`}>
          {badge.icon}
        </div>

        {/* Rarity Badge */}
        <div
          className={`
            absolute top-1 right-1
            ${sizeClasses[size].badge}
            px-2 py-0.5 rounded-full
            ${unlocked ? rarityBackground : 'bg-gray-200'}
            ${unlocked ? rarityColor : 'text-gray-500'}
            font-semibold uppercase
          `}
        >
          {badge.rarity}
        </div>

        {/* Lock Icon for Locked Badges */}
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        )}

        {/* Unlock Animation */}
        {isUnlocking && (
          <>
            <div className="absolute inset-0 rounded-lg bg-yellow-400 opacity-50 animate-ping" />
            <div className="absolute -inset-4 rounded-lg border-4 border-yellow-400 animate-pulse" />
          </>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && !unlocked && progress && progress.percentage > 0 && (
        <div className="absolute -bottom-2 left-0 right-0 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      )}

      {/* Tooltip on Hover */}
      <div
        className={`
          absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          pointer-events-none
          z-10
        `}
      >
        <div className="bg-gray-900 text-white rounded-lg p-3 shadow-xl min-w-[200px] max-w-[300px]">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className={`${sizeClasses[size].title} font-bold flex-1`}>
              {badge.name}
            </h4>
            <span className="text-yellow-400 font-semibold">+{badge.points}</span>
          </div>
          <p className={`${sizeClasses[size].description} text-gray-300 mb-2`}>
            {badge.description}
          </p>
          {!unlocked && progress && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{progress.percentage.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {progress.currentValue} / {progress.targetValue} {badge.criteria.metric}
              </div>
            </div>
          )}
          {unlocked && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="flex items-center gap-1 text-xs text-green-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Unlocked</span>
              </div>
            </div>
          )}
        </div>
        {/* Tooltip Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
          <div className="border-8 border-transparent border-t-gray-900" />
        </div>
      </div>
    </div>
  );
}

/**
 * Achievement Collection Grid Component
 */
interface AchievementCollectionProps {
  badges: Array<{
    badge: Badge;
    unlocked: boolean;
    progress?: {
      currentValue: number;
      targetValue: number;
      percentage: number;
    };
  }>;
  size?: 'sm' | 'md' | 'lg';
  onBadgeClick?: (badge: Badge) => void;
}

export function AchievementCollection({
  badges,
  size = 'md',
  onBadgeClick,
}: AchievementCollectionProps) {
  const [filter, setFilter] = useState<'all' | Badge['category'] | Badge['rarity']>('all');
  const [sortBy, setSortBy] = useState<'name' | 'rarity' | 'progress'>('name');

  const filteredBadges = badges.filter((item) => {
    if (filter === 'all') return true;
    return item.badge.category === filter || item.badge.rarity === filter;
  });

  const sortedBadges = [...filteredBadges].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.badge.name.localeCompare(b.badge.name);
      case 'rarity':
        const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
        return rarityOrder[b.badge.rarity] - rarityOrder[a.badge.rarity];
      case 'progress':
        const aProgress = a.progress?.percentage || (a.unlocked ? 100 : 0);
        const bProgress = b.progress?.percentage || (b.unlocked ? 100 : 0);
        return bProgress - aProgress;
      default:
        return 0;
    }
  });

  const stats = {
    total: badges.length,
    unlocked: badges.filter((b) => b.unlocked).length,
    inProgress: badges.filter((b) => !b.unlocked && (b.progress?.percentage || 0) > 0).length,
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Achievement Collection</h3>
            <p className="text-sm opacity-90">
              {stats.unlocked} / {stats.total} unlocked ({stats.inProgress} in progress)
            </p>
          </div>
          <div className="text-3xl font-bold">
            {Math.round((stats.unlocked / stats.total) * 100)}%
          </div>
        </div>
        <div className="mt-2 h-2 bg-white bg-opacity-30 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-500"
            style={{ width: `${(stats.unlocked / stats.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          {(['productivity', 'quality', 'collaboration', 'knowledge', 'special'] as const).map(
            (category) => (
              <button
                key={category}
                onClick={() => setFilter(category)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${
                  filter === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category}
              </button>
            )
          )}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Sort by Name</option>
          <option value="rarity">Sort by Rarity</option>
          <option value="progress">Sort by Progress</option>
        </select>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {sortedBadges.map((item, index) => (
          <AchievementBadge
            key={`${item.badge.id}-${index}`}
            badge={item.badge}
            unlocked={item.unlocked}
            progress={item.progress}
            size={size}
            onClick={() => onBadgeClick?.(item.badge)}
          />
        ))}
      </div>

      {sortedBadges.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No badges found for this filter</p>
        </div>
      )}
    </div>
  );
}

/**
 * Achievement Unlock Toast Notification
 */
interface AchievementUnlockToastProps {
  badge: Badge;
  onClose: () => void;
}

export function AchievementUnlockToast({ badge, onClose }: AchievementUnlockToastProps) {
  const rarityColor = getRarityColor(badge.rarity);
  const rarityBackground = getRarityBackground(badge.rarity);

  useEffect(() => {
    const timeout = setTimeout(onClose, 5000);
    return () => clearTimeout(timeout);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className={`${rarityBackground} rounded-lg shadow-2xl p-4 max-w-sm border-2 border-current ${rarityColor}`}>
        <div className="flex items-start gap-3">
          <div className="text-4xl animate-bounce">{badge.icon}</div>
          <div className="flex-1">
            <h4 className="font-bold text-lg mb-1">Achievement Unlocked!</h4>
            <p className="font-semibold mb-1">{badge.name}</p>
            <p className="text-sm opacity-80">{badge.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-yellow-600 font-bold">+{badge.points} points</span>
              <span className={`text-xs uppercase font-semibold ${rarityColor}`}>
                {badge.rarity}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
