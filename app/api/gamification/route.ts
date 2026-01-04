import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import {
  AchievementEngine,
} from '@/lib/gamification/achievements';
import {
  PointsEngine,
  LeaderboardManager,
  LeaderboardEntry,
  DEFAULT_POINTS_CONFIG
} from '@/lib/gamification/points-system';
import {
  ChallengeManager,
  MonthlyChallengeScheduler,
  Challenge,
  CHALLENGE_TEMPLATES
} from '@/lib/gamification/challenges';

/**
 * GET /api/gamification
 * Query parameters:
 * - action: 'achievements' | 'leaderboard' | 'challenges' | 'points' | 'stats'
 * - userId?: string (for specific user queries)
 * - period?: 'day' | 'week' | 'month' | 'all-time' (for leaderboard)
 * - teamId?: string (for team filtering)
 * - challengeId?: string (for specific challenge)
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = String(searchParams.get('userId') || authResult.user!.id);
    const period = searchParams.get('period') as 'day' | 'week' | 'month' | 'all-time' || 'month';
    const teamId = searchParams.get('teamId');
    const challengeId = searchParams.get('challengeId');

    switch (action) {
      case 'achievements':
        return await getAchievements(userId);

      case 'leaderboard':
        return await getLeaderboard(period, teamId);

      case 'challenges':
        return await getChallenges(userId);

      case 'challenge-detail':
        if (!challengeId) {
          return NextResponse.json({ error: 'Challenge ID required' }, { status: 400 });
        }
        return await getChallengeDetail(challengeId, userId);

      case 'points':
        return await getPointsHistory(userId);

      case 'stats':
        return await getUserStats(userId);

      case 'recognition':
        return await getRecognitionFeed();

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Gamification API error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gamification
 * Actions:
 * - award-points: Award points to user
 * - unlock-achievement: Unlock achievement for user
 * - join-challenge: Join a challenge
 * - leave-challenge: Leave a challenge
 * - opt-in: Opt in to leaderboard
 * - opt-out: Opt out from leaderboard
 * - send-kudos: Send kudos to another user
 * - react: React to recognition
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const currentUserId = String(authResult.user!.id);

    switch (action) {
      case 'award-points':
        return await awardPoints(currentUserId, body);

      case 'unlock-achievement':
        return await unlockAchievement(currentUserId, body);

      case 'join-challenge':
        return await joinChallenge(currentUserId, body.challengeId);

      case 'leave-challenge':
        return await leaveChallenge(currentUserId, body.challengeId);

      case 'opt-in':
        return await updateLeaderboardOptIn(currentUserId, true);

      case 'opt-out':
        return await updateLeaderboardOptIn(currentUserId, false);

      case 'send-kudos':
        return await sendKudos(currentUserId, body);

      case 'react':
        return await addReaction(currentUserId, body);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Gamification POST error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get user achievements
 */
async function getAchievements(userId: string) {
  // Mock data - replace with actual database queries
  const userStats = {
    ticketsResolved: 45,
    fastResolutions: 12,
    streakDays: 5,
    perfectCsatCount: 8,
    fcrRate: 0.92,
    fcrTicketCount: 40,
    slaStreak: 25,
    qualityScore: 88,
    qualityDays: 15,
    ticketsAssisted: 6,
    kudosReceived: 12,
    menteesCount: 1,
    kbArticles: 3,
    kbViews: 150,
    trainingCompleted: 5,
    expertCategories: 1,
    firstTicketDays: 8,
    afterHoursTickets: 15,
    weekendTickets: 7,
    criticalDayMax: 3,
    monthlyAwards: 0,
    innovations: 0,
  };

  const calculatedStats = AchievementEngine.calculateUserStats(userStats);
  const unlockedBadgeIds = ['first-ticket', 'speed-demon'];

  const newlyUnlocked = await AchievementEngine.scanAndUnlock(
    userId,
    calculatedStats,
    unlockedBadgeIds
  );

  const achievements = await AchievementEngine.getUserAchievements(
    userId,
    calculatedStats,
    [...unlockedBadgeIds, ...newlyUnlocked.map((b) => b.id)]
  );

  return NextResponse.json({
    achievements,
    newlyUnlocked,
    stats: calculatedStats,
  });
}

/**
 * Get leaderboard
 */
async function getLeaderboard(
  period: 'day' | 'week' | 'month' | 'all-time',
  teamId?: string | null
) {
  // Mock leaderboard data - replace with actual database queries
  const mockLeaderboard: LeaderboardEntry[] = [
    {
      userId: '1',
      username: 'Sarah Johnson',
      email: 'sarah@example.com',
      teamId: 'team-1',
      teamName: 'Support Team A',
      points: 2450,
      rank: 1,
      ticketsResolved: 98,
      avgCsat: 96,
      fcrRate: 94,
      currentStreak: 12,
      badges: 8,
      optedIn: true,
    },
    {
      userId: '2',
      username: 'Mike Chen',
      email: 'mike@example.com',
      teamId: 'team-1',
      teamName: 'Support Team A',
      points: 2180,
      rank: 2,
      ticketsResolved: 87,
      avgCsat: 94,
      fcrRate: 92,
      currentStreak: 8,
      badges: 6,
      optedIn: true,
    },
    {
      userId: '3',
      username: 'Emily Davis',
      email: 'emily@example.com',
      teamId: 'team-2',
      teamName: 'Support Team B',
      points: 1950,
      rank: 3,
      ticketsResolved: 75,
      avgCsat: 98,
      fcrRate: 96,
      currentStreak: 15,
      badges: 7,
      optedIn: true,
    },
  ];

  let filteredLeaderboard = mockLeaderboard;

  if (teamId && teamId !== 'all') {
    filteredLeaderboard = LeaderboardManager.filterByTeam(mockLeaderboard, teamId);
  }

  const topPerformers = LeaderboardManager.getTopPerformers(filteredLeaderboard, 10);

  return NextResponse.json({
    leaderboard: filteredLeaderboard,
    topPerformers,
    period,
    teamId,
  });
}

/**
 * Get challenges
 */
async function getChallenges(userId: string) {
  // Generate current month's challenges
  const allChallenges = MonthlyChallengeScheduler.getCurrentMonthChallenges();

  const activeChallenges = ChallengeManager.getActiveChallenges(allChallenges);
  const upcomingChallenges = ChallengeManager.getUpcomingChallenges(allChallenges);
  const userChallenges = ChallengeManager.getUserChallenges(allChallenges, userId);

  return NextResponse.json({
    active: activeChallenges,
    upcoming: upcomingChallenges,
    enrolled: userChallenges,
    templates: CHALLENGE_TEMPLATES,
  });
}

/**
 * Get challenge detail with progress
 */
async function getChallengeDetail(challengeId: string, userId: string) {
  // Mock challenge data - replace with actual database queries
  const challenge: Challenge = {
    id: challengeId,
    title: 'Speed Racer',
    description: 'Resolve the most tickets in under 10 minutes',
    type: 'individual',
    category: 'productivity',
    startDate: new Date('2025-10-01'),
    endDate: new Date('2025-10-07'),
    status: 'active',
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
    participants: ['1', '2', '3', userId],
    icon: '🏎️',
    difficulty: 'medium',
  };

  // Mock progress data
  const progresses = [
    ChallengeManager.calculateProgress(challenge, '1', 'Sarah Johnson', 42),
    ChallengeManager.calculateProgress(challenge, '2', 'Mike Chen', 38),
    ChallengeManager.calculateProgress(challenge, '3', 'Emily Davis', 35),
    ChallengeManager.calculateProgress(challenge, userId, 'You', 28),
  ];

  const rankedProgresses = ChallengeManager.rankParticipants(progresses);

  return NextResponse.json({
    challenge,
    progress: rankedProgresses,
    userProgress: rankedProgresses.find((p) => p.participantId === userId),
  });
}

/**
 * Get points history
 */
async function getPointsHistory(userId: string) {
  // Mock points transactions - replace with actual database queries
  const transactions = [
    {
      id: '1',
      userId,
      points: 25,
      action: 'Ticket resolved with excellent CSAT',
      metadata: { ticketId: 'T123', csat: 100 },
      multipliers: { csat: 2.0, sla: 1.3 },
      createdAt: new Date('2025-10-05T10:30:00'),
    },
    {
      id: '2',
      userId,
      points: 10,
      action: 'Kudos received from Mike Chen',
      metadata: { fromUserId: '2' },
      multipliers: {},
      createdAt: new Date('2025-10-05T09:15:00'),
    },
  ];

  const totalPoints = transactions.reduce((sum, t) => sum + t.points, 0);

  return NextResponse.json({
    transactions,
    totalPoints,
    redemptionValues: DEFAULT_POINTS_CONFIG.redemptionValues,
  });
}

/**
 * Get user stats
 */
async function getUserStats(userId: string) {
  // Mock user stats - replace with actual database queries
  return NextResponse.json({
    userId,
    totalPoints: 845,
    rank: 12,
    percentile: 88,
    currentStreak: 5,
    longestStreak: 12,
    badges: {
      total: 5,
      common: 2,
      rare: 2,
      epic: 1,
      legendary: 0,
    },
    thisMonth: {
      ticketsResolved: 45,
      avgCsat: 92,
      fcrRate: 89,
      kudosReceived: 8,
    },
  });
}

/**
 * Get recognition feed
 */
async function getRecognitionFeed() {
  // Mock recognition data - replace with actual database queries
  const recognitions = [
    {
      id: '1',
      type: 'kudos' as const,
      fromUserId: '2',
      fromUsername: 'Mike Chen',
      toUserId: '1',
      toUsername: 'Sarah Johnson',
      message: 'Thanks for helping me with that complex billing issue! Your expertise saved the day!',
      points: 10,
      createdAt: new Date('2025-10-05T10:00:00'),
      reactions: [
        { userId: '3', emoji: '👍' },
        { userId: '4', emoji: '❤️' },
      ],
    },
    {
      id: '2',
      type: 'milestone' as const,
      fromUserId: '1',
      fromUsername: 'Sarah Johnson',
      toUserId: '1',
      toUsername: 'Sarah Johnson',
      message: 'Just hit 100 tickets resolved this month! 🎯',
      points: 100,
      createdAt: new Date('2025-10-04T15:30:00'),
      reactions: [
        { userId: '2', emoji: '🎉' },
        { userId: '3', emoji: '🔥' },
        { userId: '5', emoji: '💯' },
      ],
    },
  ];

  return NextResponse.json({ recognitions });
}

/**
 * Award points to user
 */
async function awardPoints(userId: string, data: any) {
  const pointsEngine = new PointsEngine();

  const calculation = pointsEngine.calculateTicketPoints({
    csat: data.csat,
    fcr: data.fcr,
    slaPercentage: data.slaPercentage,
    resolutionTimeMinutes: data.resolutionTimeMinutes,
    currentStreak: data.currentStreak || 0,
    teamMetGoal: data.teamMetGoal || false,
  });

  // Save to database (mock)
  const transaction = {
    id: `txn_${Date.now()}`,
    userId,
    points: calculation.totalPoints,
    action: data.action || 'Ticket resolved',
    metadata: data.metadata || {},
    multipliers: calculation.breakdown,
    createdAt: new Date(),
  };

  return NextResponse.json({
    success: true,
    transaction,
    calculation,
  });
}

/**
 * Unlock achievement
 */
async function unlockAchievement(userId: string, data: { badgeId: string }) {
  const badge = AchievementEngine.getBadge(data.badgeId);

  if (!badge) {
    return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
  }

  // Save to database (mock)
  const achievement = {
    userId,
    badgeId: badge.id,
    unlockedAt: new Date(),
    progress: 100,
    notified: false,
  };

  const notification = AchievementEngine.createUnlockNotification(badge);

  return NextResponse.json({
    success: true,
    achievement,
    notification,
  });
}

/**
 * Join challenge
 */
async function joinChallenge(userId: string, challengeId: string) {
  // Mock challenge join - replace with actual database operation
  return NextResponse.json({
    success: true,
    challengeId,
    userId,
    joinedAt: new Date(),
  });
}

/**
 * Leave challenge
 */
async function leaveChallenge(userId: string, challengeId: string) {
  // Mock challenge leave - replace with actual database operation
  return NextResponse.json({
    success: true,
    challengeId,
    userId,
    leftAt: new Date(),
  });
}

/**
 * Update leaderboard opt-in preference
 */
async function updateLeaderboardOptIn(userId: string, optedIn: boolean) {
  // Save to database (mock)
  return NextResponse.json({
    success: true,
    userId,
    optedIn,
    updatedAt: new Date(),
  });
}

/**
 * Send kudos
 */
async function sendKudos(
  fromUserId: string,
  data: { toUserId: string; message: string }
) {
  const pointsEngine = new PointsEngine();

  // Award points to sender
  const senderPoints = pointsEngine.calculateActionPoints('kudosGiven');

  // Award points to receiver
  const receiverPoints = pointsEngine.calculateActionPoints('kudosReceived');

  // Create recognition entry (mock)
  const recognition = {
    id: `kudos_${Date.now()}`,
    type: 'kudos' as const,
    fromUserId,
    fromUsername: 'Current User', // Replace with actual username
    toUserId: data.toUserId,
    toUsername: 'Recipient', // Replace with actual username
    message: data.message,
    points: receiverPoints,
    createdAt: new Date(),
    reactions: [],
  };

  return NextResponse.json({
    success: true,
    recognition,
    senderPoints,
    receiverPoints,
  });
}

/**
 * Add reaction to recognition
 */
async function addReaction(
  userId: string,
  data: { recognitionId: string; emoji: string }
) {
  // Save reaction to database (mock)
  const reaction = {
    recognitionId: data.recognitionId,
    userId,
    emoji: data.emoji,
    createdAt: new Date(),
  };

  return NextResponse.json({
    success: true,
    reaction,
  });
}
