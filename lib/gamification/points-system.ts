/**
 * Points & Leaderboard System
 * Quality-based point calculation with CSAT, FCR, speed multipliers
 */

export interface PointsConfig {
  basePoints: {
    ticketResolved: number;
    commentAdded: number;
    kbArticleCreated: number;
    kbArticleViewed: number;
    kudosGiven: number;
    kudosReceived: number;
  };
  qualityMultipliers: {
    csat: {
      excellent: number; // 90-100%
      good: number; // 70-89%
      average: number; // 50-69%
      poor: number; // <50%
    };
    fcr: {
      firstContact: number; // Resolved on first contact
      followUp: number; // Required follow-up
    };
    sla: {
      metEarly: number; // <50% of SLA time
      met: number; // Within SLA
      nearMiss: number; // Slightly over SLA
      missed: number; // Significantly over SLA
    };
  };
  speedBonuses: {
    veryFast: { threshold: number; bonus: number }; // <5 min
    fast: { threshold: number; bonus: number }; // 5-15 min
    normal: { threshold: number; bonus: number }; // 15-60 min
  };
  streakMultipliers: {
    7: number;
    14: number;
    30: number;
    60: number;
    90: number;
  };
  teamMultiplier: number; // Bonus when team hits goals
  redemptionValues: {
    giftCard: number;
    extraPto: number;
    parkingSpot: number;
    trainingCredit: number;
  };
}

export const DEFAULT_POINTS_CONFIG: PointsConfig = {
  basePoints: {
    ticketResolved: 10,
    commentAdded: 2,
    kbArticleCreated: 50,
    kbArticleViewed: 1,
    kudosGiven: 5,
    kudosReceived: 10,
  },
  qualityMultipliers: {
    csat: {
      excellent: 2.0, // 2x points
      good: 1.5, // 1.5x points
      average: 1.0, // Normal points
      poor: 0.5, // Half points
    },
    fcr: {
      firstContact: 1.5,
      followUp: 1.0,
    },
    sla: {
      metEarly: 1.3,
      met: 1.0,
      nearMiss: 0.8,
      missed: 0.5,
    },
  },
  speedBonuses: {
    veryFast: { threshold: 5, bonus: 10 },
    fast: { threshold: 15, bonus: 5 },
    normal: { threshold: 60, bonus: 2 },
  },
  streakMultipliers: {
    7: 1.1, // +10%
    14: 1.2, // +20%
    30: 1.5, // +50%
    60: 1.75, // +75%
    90: 2.0, // +100%
  },
  teamMultiplier: 1.25,
  redemptionValues: {
    giftCard: 1000, // $50 gift card
    extraPto: 5000, // 1 day PTO
    parkingSpot: 2000, // Reserved parking for a month
    trainingCredit: 3000, // Training course credit
  },
};

export interface LeaderboardEntry {
  userId: string;
  username: string;
  email: string;
  avatarUrl?: string;
  teamId?: string;
  teamName?: string;
  points: number;
  rank: number;
  ticketsResolved: number;
  avgCsat: number;
  fcrRate: number;
  currentStreak: number;
  badges: number;
  optedIn: boolean;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  points: number;
  action: string;
  metadata: Record<string, any>;
  multipliers: {
    csat?: number;
    fcr?: number;
    sla?: number;
    speed?: number;
    streak?: number;
    team?: number;
  };
  createdAt: Date;
}

export interface UserStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
}

/**
 * Points Calculation Engine
 */
export class PointsEngine {
  private config: PointsConfig;

  constructor(config: PointsConfig = DEFAULT_POINTS_CONFIG) {
    this.config = config;
  }

  /**
   * Calculate points for ticket resolution with quality multipliers
   */
  calculateTicketPoints(data: {
    basePoints?: number;
    csat?: number; // 0-100
    fcr: boolean;
    slaPercentage: number; // 0-100 (percentage of SLA time used)
    resolutionTimeMinutes: number;
    currentStreak: number;
    teamMetGoal?: boolean;
  }): {
    totalPoints: number;
    breakdown: {
      base: number;
      csatMultiplier: number;
      fcrMultiplier: number;
      slaMultiplier: number;
      speedBonus: number;
      streakMultiplier: number;
      teamMultiplier: number;
    };
  } {
    const basePoints = data.basePoints || this.config.basePoints.ticketResolved;

    // Calculate CSAT multiplier
    let csatMultiplier = 1.0;
    if (data.csat !== undefined) {
      if (data.csat >= 90) csatMultiplier = this.config.qualityMultipliers.csat.excellent;
      else if (data.csat >= 70) csatMultiplier = this.config.qualityMultipliers.csat.good;
      else if (data.csat >= 50) csatMultiplier = this.config.qualityMultipliers.csat.average;
      else csatMultiplier = this.config.qualityMultipliers.csat.poor;
    }

    // Calculate FCR multiplier
    const fcrMultiplier = data.fcr
      ? this.config.qualityMultipliers.fcr.firstContact
      : this.config.qualityMultipliers.fcr.followUp;

    // Calculate SLA multiplier
    let slaMultiplier = 1.0;
    if (data.slaPercentage < 50) slaMultiplier = this.config.qualityMultipliers.sla.metEarly;
    else if (data.slaPercentage <= 100) slaMultiplier = this.config.qualityMultipliers.sla.met;
    else if (data.slaPercentage <= 120) slaMultiplier = this.config.qualityMultipliers.sla.nearMiss;
    else slaMultiplier = this.config.qualityMultipliers.sla.missed;

    // Calculate speed bonus
    let speedBonus = 0;
    if (data.resolutionTimeMinutes < this.config.speedBonuses.veryFast.threshold) {
      speedBonus = this.config.speedBonuses.veryFast.bonus;
    } else if (data.resolutionTimeMinutes < this.config.speedBonuses.fast.threshold) {
      speedBonus = this.config.speedBonuses.fast.bonus;
    } else if (data.resolutionTimeMinutes < this.config.speedBonuses.normal.threshold) {
      speedBonus = this.config.speedBonuses.normal.bonus;
    }

    // Calculate streak multiplier
    let streakMultiplier = 1.0;
    const streakKeys = Object.keys(this.config.streakMultipliers)
      .map(Number)
      .sort((a, b) => b - a);
    for (const streak of streakKeys) {
      if (data.currentStreak >= streak) {
        streakMultiplier = this.config.streakMultipliers[streak as keyof typeof this.config.streakMultipliers];
        break;
      }
    }

    // Calculate team multiplier
    const teamMultiplier = data.teamMetGoal ? this.config.teamMultiplier : 1.0;

    // Total calculation
    const qualityPoints = basePoints * csatMultiplier * fcrMultiplier * slaMultiplier;
    const streakPoints = qualityPoints * streakMultiplier;
    const teamPoints = streakPoints * teamMultiplier;
    const totalPoints = Math.round(teamPoints + speedBonus);

    return {
      totalPoints,
      breakdown: {
        base: basePoints,
        csatMultiplier,
        fcrMultiplier,
        slaMultiplier,
        speedBonus,
        streakMultiplier,
        teamMultiplier,
      },
    };
  }

  /**
   * Calculate points for other actions
   */
  calculateActionPoints(
    action: keyof PointsConfig['basePoints'],
    quantity = 1
  ): number {
    return this.config.basePoints[action] * quantity;
  }

  /**
   * Update user streak
   */
  updateStreak(streak: UserStreak, activityDate: Date): UserStreak {
    const lastDate = new Date(streak.lastActivityDate);
    const currentDate = new Date(activityDate);

    // Reset time to midnight for comparison
    lastDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      // Consecutive day - increment streak
      return {
        ...streak,
        currentStreak: streak.currentStreak + 1,
        longestStreak: Math.max(streak.longestStreak, streak.currentStreak + 1),
        lastActivityDate: activityDate,
      };
    } else if (daysDiff === 0) {
      // Same day - no change
      return {
        ...streak,
        lastActivityDate: activityDate,
      };
    } else {
      // Streak broken - reset to 1
      return {
        ...streak,
        currentStreak: 1,
        lastActivityDate: activityDate,
      };
    }
  }

  /**
   * Check if points can be redeemed
   */
  canRedeem(
    userPoints: number,
    reward: keyof PointsConfig['redemptionValues']
  ): boolean {
    return userPoints >= this.config.redemptionValues[reward];
  }

  /**
   * Get redemption cost
   */
  getRedemptionCost(reward: keyof PointsConfig['redemptionValues']): number {
    return this.config.redemptionValues[reward];
  }
}

/**
 * Leaderboard Manager
 */
export class LeaderboardManager {
  /**
   * Build leaderboard from user data
   */
  static buildLeaderboard(
    users: Array<{
      userId: string;
      username: string;
      email: string;
      avatarUrl?: string;
      teamId?: string;
      teamName?: string;
      points: number;
      ticketsResolved: number;
      avgCsat: number;
      fcrRate: number;
      currentStreak: number;
      badges: number;
      optedIn: boolean;
    }>
  ): LeaderboardEntry[] {
    // Filter opted-in users and sort by points
    const rankedUsers = users
      .filter((u) => u.optedIn)
      .sort((a, b) => b.points - a.points)
      .map((user, index) => ({
        ...user,
        rank: index + 1,
      }));

    return rankedUsers;
  }

  /**
   * Filter leaderboard by team
   */
  static filterByTeam(
    leaderboard: LeaderboardEntry[],
    teamId: string
  ): LeaderboardEntry[] {
    return leaderboard
      .filter((entry) => entry.teamId === teamId)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }

  /**
   * Filter leaderboard by period
   */
  static filterByPeriod(
    transactions: PointsTransaction[],
    period: 'day' | 'week' | 'month' | 'all-time'
  ): PointsTransaction[] {
    const now = new Date();
    let cutoffDate: Date;

    switch (period) {
      case 'day':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all-time':
        return transactions;
    }

    return transactions.filter((t) => new Date(t.createdAt) >= cutoffDate);
  }

  /**
   * Get top performers
   */
  static getTopPerformers(
    leaderboard: LeaderboardEntry[],
    limit = 10
  ): LeaderboardEntry[] {
    return leaderboard.slice(0, limit);
  }

  /**
   * Get user rank
   */
  static getUserRank(
    leaderboard: LeaderboardEntry[],
    userId: string
  ): LeaderboardEntry | null {
    return leaderboard.find((entry) => entry.userId === userId) || null;
  }

  /**
   * Calculate percentile rank
   */
  static getPercentile(
    leaderboard: LeaderboardEntry[],
    userId: string
  ): number {
    const userEntry = this.getUserRank(leaderboard, userId);
    if (!userEntry) return 0;

    const totalUsers = leaderboard.length;
    const percentile = ((totalUsers - userEntry.rank + 1) / totalUsers) * 100;
    return Math.round(percentile);
  }

  /**
   * Get neighboring users on leaderboard (context)
   */
  static getNeighbors(
    leaderboard: LeaderboardEntry[],
    userId: string,
    range = 2
  ): {
    above: LeaderboardEntry[];
    current: LeaderboardEntry | null;
    below: LeaderboardEntry[];
  } {
    const userIndex = leaderboard.findIndex((entry) => entry.userId === userId);
    if (userIndex === -1) {
      return { above: [], current: null, below: [] };
    }

    const above = leaderboard.slice(Math.max(0, userIndex - range), userIndex);
    const current = leaderboard[userIndex];
    const below = leaderboard.slice(userIndex + 1, userIndex + 1 + range);

    return { above, current, below };
  }
}

/**
 * Team Competition Manager
 */
export class TeamCompetitionManager {
  /**
   * Calculate team aggregate points
   */
  static calculateTeamPoints(
    teamMembers: LeaderboardEntry[]
  ): {
    teamId: string;
    teamName: string;
    totalPoints: number;
    avgPoints: number;
    memberCount: number;
    topPerformer: LeaderboardEntry;
  } | null {
    if (teamMembers.length === 0) return null;

    const totalPoints = teamMembers.reduce((sum, m) => sum + m.points, 0);
    const avgPoints = Math.round(totalPoints / teamMembers.length);
    const topPerformer = teamMembers.reduce((top, current) =>
      current.points > top.points ? current : top
    );

    return {
      teamId: teamMembers[0].teamId!,
      teamName: teamMembers[0].teamName!,
      totalPoints,
      avgPoints,
      memberCount: teamMembers.length,
      topPerformer,
    };
  }

  /**
   * Build team leaderboard
   */
  static buildTeamLeaderboard(
    leaderboard: LeaderboardEntry[]
  ): Array<{
    rank: number;
    teamId: string;
    teamName: string;
    totalPoints: number;
    avgPoints: number;
    memberCount: number;
  }> {
    // Group by team
    const teamMap = new Map<string, LeaderboardEntry[]>();
    leaderboard.forEach((entry) => {
      if (entry.teamId) {
        const members = teamMap.get(entry.teamId) || [];
        members.push(entry);
        teamMap.set(entry.teamId, members);
      }
    });

    // Calculate team stats
    const teamStats = Array.from(teamMap.entries()).map(([teamId, members]) => {
      const stats = this.calculateTeamPoints(members);
      return stats!;
    });

    // Sort by total points and rank
    return teamStats
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((team, index) => ({
        rank: index + 1,
        teamId: team.teamId,
        teamName: team.teamName,
        totalPoints: team.totalPoints,
        avgPoints: team.avgPoints,
        memberCount: team.memberCount,
      }));
  }
}

/**
 * Export utility functions
 */
export function formatPoints(points: number): string {
  if (points >= 1000000) {
    return `${(points / 1000000).toFixed(1)}M`;
  } else if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}K`;
  }
  return points.toString();
}

export function getStreakEmoji(streak: number): string {
  if (streak >= 90) return '🔥🔥🔥';
  if (streak >= 30) return '🔥🔥';
  if (streak >= 7) return '🔥';
  return '';
}

export function getRankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}
