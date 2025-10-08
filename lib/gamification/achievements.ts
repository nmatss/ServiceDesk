/**
 * Achievement & Badge System
 * Tracks user achievements, unlocks badges, and manages progress
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: 'productivity' | 'quality' | 'collaboration' | 'knowledge' | 'special';
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  criteria: {
    metric: string;
    threshold: number;
    period?: 'day' | 'week' | 'month' | 'all-time';
  };
  points: number;
}

export interface UserAchievement {
  userId: string;
  badgeId: string;
  unlockedAt: Date;
  progress: number;
  notified: boolean;
}

export interface AchievementProgress {
  badgeId: string;
  currentValue: number;
  targetValue: number;
  percentage: number;
}

/**
 * Complete Badge Catalog (20+ badges)
 */
export const BADGES: Badge[] = [
  // Productivity Badges
  {
    id: 'first-ticket',
    name: 'First Steps',
    description: 'Resolved your first ticket',
    category: 'productivity',
    icon: '🎯',
    rarity: 'common',
    criteria: { metric: 'tickets_resolved', threshold: 1 },
    points: 10,
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Resolved 10 tickets in under 5 minutes each',
    category: 'productivity',
    icon: '⚡',
    rarity: 'rare',
    criteria: { metric: 'fast_resolutions', threshold: 10 },
    points: 50,
  },
  {
    id: 'ticket-master',
    name: 'Ticket Master',
    description: 'Resolved 100 tickets',
    category: 'productivity',
    icon: '🏆',
    rarity: 'epic',
    criteria: { metric: 'tickets_resolved', threshold: 100 },
    points: 100,
  },
  {
    id: 'ticket-legend',
    name: 'Ticket Legend',
    description: 'Resolved 1000 tickets',
    category: 'productivity',
    icon: '👑',
    rarity: 'legendary',
    criteria: { metric: 'tickets_resolved', threshold: 1000 },
    points: 500,
  },
  {
    id: 'streak-7',
    name: 'Week Warrior',
    description: '7-day resolution streak',
    category: 'productivity',
    icon: '🔥',
    rarity: 'rare',
    criteria: { metric: 'streak_days', threshold: 7 },
    points: 75,
  },
  {
    id: 'streak-30',
    name: 'Month Marathon',
    description: '30-day resolution streak',
    category: 'productivity',
    icon: '🌟',
    rarity: 'legendary',
    criteria: { metric: 'streak_days', threshold: 30 },
    points: 300,
  },

  // Quality Badges
  {
    id: 'perfect-csat',
    name: 'Customer Delight',
    description: 'Achieved 100% CSAT on 20+ tickets',
    category: 'quality',
    icon: '😊',
    rarity: 'epic',
    criteria: { metric: 'perfect_csat_count', threshold: 20 },
    points: 150,
  },
  {
    id: 'first-contact-hero',
    name: 'First Contact Hero',
    description: '95%+ FCR rate with 50+ tickets',
    category: 'quality',
    icon: '🎖️',
    rarity: 'rare',
    criteria: { metric: 'fcr_excellence', threshold: 50 },
    points: 100,
  },
  {
    id: 'sla-champion',
    name: 'SLA Champion',
    description: 'Met SLA on 100 consecutive tickets',
    category: 'quality',
    icon: '⏱️',
    rarity: 'epic',
    criteria: { metric: 'sla_streak', threshold: 100 },
    points: 200,
  },
  {
    id: 'quality-assurance',
    name: 'Quality Assurance',
    description: 'Maintained 90%+ quality score for 30 days',
    category: 'quality',
    icon: '💎',
    rarity: 'legendary',
    criteria: { metric: 'quality_consistency', threshold: 30 },
    points: 400,
  },

  // Collaboration Badges
  {
    id: 'team-player',
    name: 'Team Player',
    description: 'Helped 10 colleagues with tickets',
    category: 'collaboration',
    icon: '🤝',
    rarity: 'common',
    criteria: { metric: 'tickets_assisted', threshold: 10 },
    points: 50,
  },
  {
    id: 'kudos-king',
    name: 'Kudos King',
    description: 'Received 50 @kudos from peers',
    category: 'collaboration',
    icon: '🌟',
    rarity: 'rare',
    criteria: { metric: 'kudos_received', threshold: 50 },
    points: 100,
  },
  {
    id: 'mentor',
    name: 'Mentor',
    description: 'Onboarded 5 new team members',
    category: 'collaboration',
    icon: '👨‍🏫',
    rarity: 'epic',
    criteria: { metric: 'mentees_trained', threshold: 5 },
    points: 150,
  },
  {
    id: 'knowledge-sharer',
    name: 'Knowledge Sharer',
    description: 'Created 20 knowledge base articles',
    category: 'collaboration',
    icon: '📚',
    rarity: 'rare',
    criteria: { metric: 'kb_articles_created', threshold: 20 },
    points: 100,
  },

  // Knowledge Badges
  {
    id: 'quick-learner',
    name: 'Quick Learner',
    description: 'Completed 10 training modules',
    category: 'knowledge',
    icon: '🎓',
    rarity: 'common',
    criteria: { metric: 'training_completed', threshold: 10 },
    points: 50,
  },
  {
    id: 'subject-expert',
    name: 'Subject Expert',
    description: 'Became expert in 3 categories',
    category: 'knowledge',
    icon: '🧠',
    rarity: 'epic',
    criteria: { metric: 'expert_categories', threshold: 3 },
    points: 200,
  },
  {
    id: 'kb-master',
    name: 'KB Master',
    description: 'Your KB articles viewed 1000+ times',
    category: 'knowledge',
    icon: '📖',
    rarity: 'legendary',
    criteria: { metric: 'kb_views', threshold: 1000 },
    points: 300,
  },

  // Special Badges
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Resolved first ticket of the day 30 times',
    category: 'special',
    icon: '🌅',
    rarity: 'rare',
    criteria: { metric: 'first_ticket_days', threshold: 30 },
    points: 75,
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Resolved 50 tickets after hours',
    category: 'special',
    icon: '🦉',
    rarity: 'rare',
    criteria: { metric: 'after_hours_tickets', threshold: 50 },
    points: 75,
  },
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Resolved 25 tickets on weekends',
    category: 'special',
    icon: '⚔️',
    rarity: 'epic',
    criteria: { metric: 'weekend_tickets', threshold: 25 },
    points: 100,
  },
  {
    id: 'crisis-manager',
    name: 'Crisis Manager',
    description: 'Resolved 10 critical tickets in 1 day',
    category: 'special',
    icon: '🚨',
    rarity: 'legendary',
    criteria: { metric: 'critical_day_count', threshold: 10 },
    points: 250,
  },
  {
    id: 'helper-of-month',
    name: 'Helper of the Month',
    description: 'Awarded by team vote',
    category: 'special',
    icon: '🏅',
    rarity: 'legendary',
    criteria: { metric: 'monthly_award', threshold: 1 },
    points: 500,
  },
  {
    id: 'innovation-award',
    name: 'Innovation Award',
    description: 'Implemented process improvement',
    category: 'special',
    icon: '💡',
    rarity: 'legendary',
    criteria: { metric: 'innovation_count', threshold: 1 },
    points: 500,
  },
];

/**
 * Achievement Engine - Tracks and unlocks achievements
 */
export class AchievementEngine {
  /**
   * Check if user has unlocked a badge
   */
  static async checkAchievement(
    userId: string,
    badgeId: string,
    userStats: Record<string, number>
  ): Promise<boolean> {
    const badge = BADGES.find((b) => b.id === badgeId);
    if (!badge) return false;

    const currentValue = userStats[badge.criteria.metric] || 0;
    return currentValue >= badge.criteria.threshold;
  }

  /**
   * Get achievement progress for a user
   */
  static async getProgress(
    userId: string,
    badgeId: string,
    userStats: Record<string, number>
  ): Promise<AchievementProgress | null> {
    const badge = BADGES.find((b) => b.id === badgeId);
    if (!badge) return null;

    const currentValue = userStats[badge.criteria.metric] || 0;
    const targetValue = badge.criteria.threshold;
    const percentage = Math.min(100, (currentValue / targetValue) * 100);

    return {
      badgeId,
      currentValue,
      targetValue,
      percentage,
    };
  }

  /**
   * Scan all badges and unlock eligible ones
   */
  static async scanAndUnlock(
    userId: string,
    userStats: Record<string, number>,
    existingBadges: string[]
  ): Promise<Badge[]> {
    const newlyUnlocked: Badge[] = [];

    for (const badge of BADGES) {
      // Skip if already unlocked
      if (existingBadges.includes(badge.id)) continue;

      // Check if criteria met
      const unlocked = await this.checkAchievement(userId, badge.id, userStats);
      if (unlocked) {
        newlyUnlocked.push(badge);
      }
    }

    return newlyUnlocked;
  }

  /**
   * Get all user achievements with progress
   */
  static async getUserAchievements(
    userId: string,
    userStats: Record<string, number>,
    unlockedBadges: string[]
  ): Promise<{
    unlocked: Badge[];
    inProgress: Array<Badge & { progress: AchievementProgress }>;
    locked: Badge[];
  }> {
    const unlocked: Badge[] = [];
    const inProgress: Array<Badge & { progress: AchievementProgress }> = [];
    const locked: Badge[] = [];

    for (const badge of BADGES) {
      if (unlockedBadges.includes(badge.id)) {
        unlocked.push(badge);
      } else {
        const progress = await this.getProgress(userId, badge.id, userStats);
        if (progress && progress.percentage > 0 && progress.percentage < 100) {
          inProgress.push({ ...badge, progress });
        } else if (progress && progress.percentage === 0) {
          locked.push(badge);
        }
      }
    }

    return { unlocked, inProgress, locked };
  }

  /**
   * Calculate user stats from database
   */
  static calculateUserStats(userData: {
    ticketsResolved: number;
    fastResolutions: number;
    streakDays: number;
    perfectCsatCount: number;
    fcrRate: number;
    fcrTicketCount: number;
    slaStreak: number;
    qualityScore: number;
    qualityDays: number;
    ticketsAssisted: number;
    kudosReceived: number;
    menteesCount: number;
    kbArticles: number;
    kbViews: number;
    trainingCompleted: number;
    expertCategories: number;
    firstTicketDays: number;
    afterHoursTickets: number;
    weekendTickets: number;
    criticalDayMax: number;
    monthlyAwards: number;
    innovations: number;
  }): Record<string, number> {
    return {
      tickets_resolved: userData.ticketsResolved,
      fast_resolutions: userData.fastResolutions,
      streak_days: userData.streakDays,
      perfect_csat_count: userData.perfectCsatCount,
      fcr_excellence:
        userData.fcrRate >= 0.95 ? userData.fcrTicketCount : 0,
      sla_streak: userData.slaStreak,
      quality_consistency:
        userData.qualityScore >= 90 ? userData.qualityDays : 0,
      tickets_assisted: userData.ticketsAssisted,
      kudos_received: userData.kudosReceived,
      mentees_trained: userData.menteesCount,
      kb_articles_created: userData.kbArticles,
      kb_views: userData.kbViews,
      training_completed: userData.trainingCompleted,
      expert_categories: userData.expertCategories,
      first_ticket_days: userData.firstTicketDays,
      after_hours_tickets: userData.afterHoursTickets,
      weekend_tickets: userData.weekendTickets,
      critical_day_count: userData.criticalDayMax,
      monthly_award: userData.monthlyAwards,
      innovation_count: userData.innovations,
    };
  }

  /**
   * Get badge by ID
   */
  static getBadge(badgeId: string): Badge | undefined {
    return BADGES.find((b) => b.id === badgeId);
  }

  /**
   * Get badges by category
   */
  static getBadgesByCategory(
    category: Badge['category']
  ): Badge[] {
    return BADGES.filter((b) => b.category === category);
  }

  /**
   * Get badges by rarity
   */
  static getBadgesByRarity(rarity: Badge['rarity']): Badge[] {
    return BADGES.filter((b) => b.rarity === rarity);
  }

  /**
   * Create notification for unlocked badge
   */
  static createUnlockNotification(badge: Badge): {
    title: string;
    message: string;
    type: 'achievement';
    data: Badge;
  } {
    return {
      title: `🎉 Achievement Unlocked: ${badge.name}!`,
      message: `${badge.description} (+${badge.points} points)`,
      type: 'achievement',
      data: badge,
    };
  }
}

/**
 * Export utility functions
 */
export function getRarityColor(rarity: Badge['rarity']): string {
  const colors = {
    common: 'text-gray-600',
    rare: 'text-blue-600',
    epic: 'text-purple-600',
    legendary: 'text-yellow-600',
  };
  return colors[rarity];
}

export function getRarityBackground(rarity: Badge['rarity']): string {
  const colors = {
    common: 'bg-gray-100',
    rare: 'bg-blue-100',
    epic: 'bg-purple-100',
    legendary: 'bg-yellow-100',
  };
  return colors[rarity];
}

export function getCategoryIcon(category: Badge['category']): string {
  const icons = {
    productivity: '⚡',
    quality: '💎',
    collaboration: '🤝',
    knowledge: '📚',
    special: '🌟',
  };
  return icons[category];
}
