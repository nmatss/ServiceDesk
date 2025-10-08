/**
 * Challenges & Competitions System
 * Monthly challenges, team competitions, and reward distribution
 */

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'individual' | 'team' | 'department';
  category: 'productivity' | 'quality' | 'collaboration' | 'learning';
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  target: {
    metric: string;
    goal: number;
    unit: string;
  };
  rewards: {
    first: number;
    second: number;
    third: number;
    participation: number;
  };
  participants: string[]; // user IDs or team IDs
  icon: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
}

export interface ChallengeProgress {
  challengeId: string;
  participantId: string;
  participantName: string;
  currentValue: number;
  targetValue: number;
  percentage: number;
  rank?: number;
  completed: boolean;
  lastUpdated: Date;
}

export interface ChallengeResult {
  challengeId: string;
  challengeTitle: string;
  rankings: Array<{
    rank: number;
    participantId: string;
    participantName: string;
    score: number;
    reward: number;
    badgeAwarded?: string;
  }>;
  completedAt: Date;
}

/**
 * Predefined Challenge Templates
 */
export const CHALLENGE_TEMPLATES: Omit<Challenge, 'id' | 'startDate' | 'endDate' | 'status' | 'participants'>[] = [
  // Productivity Challenges
  {
    title: 'Speed Racer',
    description: 'Resolve the most tickets in under 10 minutes',
    type: 'individual',
    category: 'productivity',
    target: {
      metric: 'fast_resolutions',
      goal: 50,
      unit: 'tickets',
    },
    rewards: {
      first: 500,
      second: 300,
      third: 150,
      participation: 25,
    },
    icon: '🏎️',
    difficulty: 'medium',
  },
  {
    title: 'Century Club',
    description: 'Be the first to resolve 100 tickets this month',
    type: 'individual',
    category: 'productivity',
    target: {
      metric: 'tickets_resolved',
      goal: 100,
      unit: 'tickets',
    },
    rewards: {
      first: 1000,
      second: 600,
      third: 300,
      participation: 50,
    },
    icon: '💯',
    difficulty: 'hard',
  },
  {
    title: 'Team Sprint',
    description: 'First team to collectively resolve 500 tickets',
    type: 'team',
    category: 'productivity',
    target: {
      metric: 'team_tickets',
      goal: 500,
      unit: 'tickets',
    },
    rewards: {
      first: 2000,
      second: 1200,
      third: 600,
      participation: 100,
    },
    icon: '🏃‍♂️',
    difficulty: 'hard',
  },

  // Quality Challenges
  {
    title: 'Perfect Score',
    description: 'Achieve 100% CSAT on 25 tickets',
    type: 'individual',
    category: 'quality',
    target: {
      metric: 'perfect_csat_tickets',
      goal: 25,
      unit: 'tickets',
    },
    rewards: {
      first: 750,
      second: 450,
      third: 225,
      participation: 50,
    },
    icon: '⭐',
    difficulty: 'hard',
  },
  {
    title: 'First Contact Master',
    description: 'Maintain 95%+ FCR rate with 40+ tickets',
    type: 'individual',
    category: 'quality',
    target: {
      metric: 'fcr_excellence',
      goal: 40,
      unit: 'tickets',
    },
    rewards: {
      first: 600,
      second: 350,
      third: 175,
      participation: 40,
    },
    icon: '🎯',
    difficulty: 'medium',
  },
  {
    title: 'SLA Warriors',
    description: 'Team with the highest SLA compliance rate',
    type: 'team',
    category: 'quality',
    target: {
      metric: 'sla_compliance_rate',
      goal: 98,
      unit: '%',
    },
    rewards: {
      first: 1500,
      second: 900,
      third: 450,
      participation: 75,
    },
    icon: '⚡',
    difficulty: 'hard',
  },

  // Collaboration Challenges
  {
    title: 'Knowledge Champion',
    description: 'Create the most helpful KB articles',
    type: 'individual',
    category: 'collaboration',
    target: {
      metric: 'kb_articles_created',
      goal: 10,
      unit: 'articles',
    },
    rewards: {
      first: 500,
      second: 300,
      third: 150,
      participation: 30,
    },
    icon: '📚',
    difficulty: 'medium',
  },
  {
    title: 'Kudos King/Queen',
    description: 'Receive the most @kudos from teammates',
    type: 'individual',
    category: 'collaboration',
    target: {
      metric: 'kudos_received',
      goal: 30,
      unit: 'kudos',
    },
    rewards: {
      first: 400,
      second: 250,
      third: 125,
      participation: 25,
    },
    icon: '👑',
    difficulty: 'easy',
  },
  {
    title: 'Team Collaboration Cup',
    description: 'Most cross-team ticket assists',
    type: 'team',
    category: 'collaboration',
    target: {
      metric: 'team_assists',
      goal: 100,
      unit: 'assists',
    },
    rewards: {
      first: 1000,
      second: 600,
      third: 300,
      participation: 50,
    },
    icon: '🤝',
    difficulty: 'medium',
  },

  // Learning Challenges
  {
    title: 'Skill Builder',
    description: 'Complete the most training modules',
    type: 'individual',
    category: 'learning',
    target: {
      metric: 'training_completed',
      goal: 15,
      unit: 'modules',
    },
    rewards: {
      first: 450,
      second: 275,
      third: 140,
      participation: 30,
    },
    icon: '🎓',
    difficulty: 'easy',
  },
  {
    title: 'Subject Matter Expert',
    description: 'Become certified in 3 product categories',
    type: 'individual',
    category: 'learning',
    target: {
      metric: 'certifications_earned',
      goal: 3,
      unit: 'certifications',
    },
    rewards: {
      first: 800,
      second: 500,
      third: 250,
      participation: 50,
    },
    icon: '🧠',
    difficulty: 'hard',
  },

  // Special Challenges
  {
    title: 'Weekend Warrior',
    description: 'Resolve the most weekend tickets',
    type: 'individual',
    category: 'productivity',
    target: {
      metric: 'weekend_tickets',
      goal: 20,
      unit: 'tickets',
    },
    rewards: {
      first: 600,
      second: 350,
      third: 175,
      participation: 40,
    },
    icon: '⚔️',
    difficulty: 'medium',
  },
  {
    title: 'Innovation Challenge',
    description: 'Submit process improvement ideas',
    type: 'department',
    category: 'collaboration',
    target: {
      metric: 'ideas_submitted',
      goal: 5,
      unit: 'ideas',
    },
    rewards: {
      first: 1200,
      second: 750,
      third: 400,
      participation: 100,
    },
    icon: '💡',
    difficulty: 'easy',
  },
];

/**
 * Challenge Manager
 */
export class ChallengeManager {
  /**
   * Create a new challenge from template
   */
  static createChallenge(
    templateIndex: number,
    startDate: Date,
    durationDays = 30
  ): Challenge {
    const template = CHALLENGE_TEMPLATES[templateIndex];
    if (!template) {
      throw new Error('Invalid template index');
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    return {
      ...template,
      id: this.generateChallengeId(),
      startDate,
      endDate,
      status: this.determineStatus(startDate, endDate),
      participants: [],
    };
  }

  /**
   * Generate unique challenge ID
   */
  static generateChallengeId(): string {
    return `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine challenge status based on dates
   */
  static determineStatus(
    startDate: Date,
    endDate: Date
  ): Challenge['status'] {
    const now = new Date();
    if (now < startDate) return 'upcoming';
    if (now > endDate) return 'completed';
    return 'active';
  }

  /**
   * Update challenge status
   */
  static updateStatus(challenge: Challenge): Challenge {
    return {
      ...challenge,
      status: this.determineStatus(challenge.startDate, challenge.endDate),
    };
  }

  /**
   * Calculate progress for participant
   */
  static calculateProgress(
    challenge: Challenge,
    participantId: string,
    participantName: string,
    currentValue: number
  ): ChallengeProgress {
    const percentage = Math.min(
      100,
      (currentValue / challenge.target.goal) * 100
    );
    const completed = currentValue >= challenge.target.goal;

    return {
      challengeId: challenge.id,
      participantId,
      participantName,
      currentValue,
      targetValue: challenge.target.goal,
      percentage,
      completed,
      lastUpdated: new Date(),
    };
  }

  /**
   * Rank participants in a challenge
   */
  static rankParticipants(
    progresses: ChallengeProgress[]
  ): ChallengeProgress[] {
    return progresses
      .sort((a, b) => b.currentValue - a.currentValue)
      .map((progress, index) => ({
        ...progress,
        rank: index + 1,
      }));
  }

  /**
   * Determine reward for participant
   */
  static determineReward(
    challenge: Challenge,
    rank: number,
    completed: boolean
  ): number {
    if (!completed) {
      return challenge.rewards.participation;
    }

    if (rank === 1) return challenge.rewards.first;
    if (rank === 2) return challenge.rewards.second;
    if (rank === 3) return challenge.rewards.third;
    return challenge.rewards.participation;
  }

  /**
   * Complete challenge and calculate results
   */
  static completeChallenge(
    challenge: Challenge,
    progresses: ChallengeProgress[]
  ): ChallengeResult {
    const rankedProgresses = this.rankParticipants(progresses);

    const rankings = rankedProgresses.map((progress) => ({
      rank: progress.rank!,
      participantId: progress.participantId,
      participantName: progress.participantName,
      score: progress.currentValue,
      reward: this.determineReward(
        challenge,
        progress.rank!,
        progress.completed
      ),
      badgeAwarded: this.awardSpecialBadge(challenge, progress.rank!),
    }));

    return {
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      rankings,
      completedAt: new Date(),
    };
  }

  /**
   * Award special badges for challenge winners
   */
  static awardSpecialBadge(
    challenge: Challenge,
    rank: number
  ): string | undefined {
    if (rank === 1 && challenge.difficulty === 'legendary') {
      return 'challenge-legend';
    }
    if (rank === 1 && challenge.difficulty === 'hard') {
      return 'challenge-champion';
    }
    if (rank <= 3 && challenge.type === 'team') {
      return 'team-victor';
    }
    return undefined;
  }

  /**
   * Get active challenges
   */
  static getActiveChallenges(challenges: Challenge[]): Challenge[] {
    return challenges
      .map((c) => this.updateStatus(c))
      .filter((c) => c.status === 'active');
  }

  /**
   * Get upcoming challenges
   */
  static getUpcomingChallenges(challenges: Challenge[]): Challenge[] {
    return challenges
      .map((c) => this.updateStatus(c))
      .filter((c) => c.status === 'upcoming')
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  /**
   * Get completed challenges
   */
  static getCompletedChallenges(challenges: Challenge[]): Challenge[] {
    return challenges
      .map((c) => this.updateStatus(c))
      .filter((c) => c.status === 'completed')
      .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  }

  /**
   * Filter challenges by type
   */
  static filterByType(
    challenges: Challenge[],
    type: Challenge['type']
  ): Challenge[] {
    return challenges.filter((c) => c.type === type);
  }

  /**
   * Filter challenges by category
   */
  static filterByCategory(
    challenges: Challenge[],
    category: Challenge['category']
  ): Challenge[] {
    return challenges.filter((c) => c.category === category);
  }

  /**
   * Check if user can join challenge
   */
  static canJoinChallenge(
    challenge: Challenge,
    userId: string
  ): { canJoin: boolean; reason?: string } {
    if (challenge.status !== 'upcoming' && challenge.status !== 'active') {
      return { canJoin: false, reason: 'Challenge is not open for registration' };
    }

    if (challenge.participants.includes(userId)) {
      return { canJoin: false, reason: 'Already enrolled in this challenge' };
    }

    if (challenge.type === 'team') {
      // Additional team validation could go here
      return { canJoin: true };
    }

    return { canJoin: true };
  }

  /**
   * Join challenge
   */
  static joinChallenge(challenge: Challenge, participantId: string): Challenge {
    const { canJoin, reason } = this.canJoinChallenge(challenge, participantId);
    if (!canJoin) {
      throw new Error(reason || 'Cannot join challenge');
    }

    return {
      ...challenge,
      participants: [...challenge.participants, participantId],
    };
  }

  /**
   * Leave challenge
   */
  static leaveChallenge(
    challenge: Challenge,
    participantId: string
  ): Challenge {
    if (challenge.status === 'active') {
      throw new Error('Cannot leave an active challenge');
    }

    return {
      ...challenge,
      participants: challenge.participants.filter((id) => id !== participantId),
    };
  }

  /**
   * Get user's challenges
   */
  static getUserChallenges(
    challenges: Challenge[],
    userId: string
  ): Challenge[] {
    return challenges.filter((c) => c.participants.includes(userId));
  }
}

/**
 * Monthly Challenge Scheduler
 */
export class MonthlyChallengeScheduler {
  /**
   * Generate monthly challenge schedule
   */
  static generateMonthlySchedule(year: number, month: number): Challenge[] {
    const challenges: Challenge[] = [];
    const firstDay = new Date(year, month - 1, 1);

    // Week 1: Productivity challenge
    challenges.push(
      ChallengeManager.createChallenge(0, new Date(firstDay), 7)
    );

    // Week 2: Quality challenge
    const week2 = new Date(firstDay);
    week2.setDate(week2.getDate() + 7);
    challenges.push(ChallengeManager.createChallenge(3, week2, 7));

    // Week 3: Collaboration challenge
    const week3 = new Date(firstDay);
    week3.setDate(week3.getDate() + 14);
    challenges.push(ChallengeManager.createChallenge(6, week3, 7));

    // Month-long team competition
    challenges.push(
      ChallengeManager.createChallenge(2, firstDay, 30)
    );

    return challenges;
  }

  /**
   * Get current month's challenges
   */
  static getCurrentMonthChallenges(): Challenge[] {
    const now = new Date();
    return this.generateMonthlySchedule(now.getFullYear(), now.getMonth() + 1);
  }

  /**
   * Schedule next month's challenges
   */
  static scheduleNextMonth(): Challenge[] {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return this.generateMonthlySchedule(
      nextMonth.getFullYear(),
      nextMonth.getMonth() + 1
    );
  }
}

/**
 * Export utility functions
 */
export function getDifficultyColor(difficulty: Challenge['difficulty']): string {
  const colors = {
    easy: 'text-green-600',
    medium: 'text-yellow-600',
    hard: 'text-red-600',
    legendary: 'text-purple-600',
  };
  return colors[difficulty];
}

export function getDifficultyBadge(difficulty: Challenge['difficulty']): string {
  const badges = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800',
    legendary: 'bg-purple-100 text-purple-800',
  };
  return badges[difficulty];
}

export function getCategoryIcon(category: Challenge['category']): string {
  const icons = {
    productivity: '⚡',
    quality: '⭐',
    collaboration: '🤝',
    learning: '📚',
  };
  return icons[category];
}

export function formatTimeRemaining(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}
