import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { apiSuccess, apiError } from '@/lib/api/api-helpers';
import { executeQuery, executeQueryOne, executeRun, type SqlParam } from '@/lib/db/adapter';
import { sqlNow } from '@/lib/db/adapter';

/**
 * GET /api/gamification
 * Query parameters:
 * - action: 'achievements' | 'leaderboard' | 'challenges' | 'points' | 'stats' | 'recognition' | 'challenge-detail'
 * - userId?: string (for specific user queries)
 * - period?: 'day' | 'week' | 'month' | 'all-time' (for leaderboard)
 * - challengeId?: string (for specific challenge)
 * - status?: string (for challenges filter)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;
    const { userId: currentUserId, organizationId } = guard.auth!;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId') || String(currentUserId);
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'all-time') || 'month';
    const challengeId = searchParams.get('challengeId');
    const status = searchParams.get('status');

    switch (action) {
      case 'achievements':
        return await getAchievements(userId, organizationId);

      case 'leaderboard':
        return await getLeaderboard(organizationId, period);

      case 'challenges':
        return await getChallenges(organizationId, status);

      case 'challenge-detail':
        if (!challengeId) {
          return apiError('Challenge ID required', 400);
        }
        return await getChallengeDetail(challengeId, organizationId);

      case 'points':
        return await getPointsHistory(userId, organizationId);

      case 'stats':
        return await getUserStats(userId, organizationId);

      case 'recognition':
        return await getRecognitionFeed(organizationId);

      default:
        return apiError('Invalid action', 400);
    }
  } catch (error) {
    logger.error('Gamification API error', error);
    return apiError('Internal server error', 500);
  }
}

/**
 * POST /api/gamification
 * Actions:
 * - award-points: Award points to user
 * - unlock-achievement: Unlock achievement for user
 * - join-challenge: Join a challenge
 * - leave-challenge: Leave a challenge
 * - send-kudos: Send kudos to another user
 * - react: React to kudos
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const guard = requireTenantUserContext(request);
    if (guard.response) return guard.response;

    const currentUserId = String(guard.auth!.userId);
    const organizationId = guard.auth!.organizationId;

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'award-points':
        return await awardPoints(currentUserId, organizationId, body);

      case 'unlock-achievement':
        return await unlockAchievement(currentUserId, organizationId, body);

      case 'join-challenge':
        return await joinChallenge(currentUserId, organizationId, body.challengeId);

      case 'leave-challenge':
        return await leaveChallenge(currentUserId, organizationId, body.challengeId);

      case 'send-kudos':
        return await sendKudos(currentUserId, organizationId, body);

      case 'react':
        return await addReaction(body);

      default:
        return apiError('Invalid action', 400);
    }
  } catch (error) {
    logger.error('Gamification POST error', error);
    return apiError('Internal server error', 500);
  }
}

// ========================================
// GET handlers
// ========================================

interface AchievementRow {
  id: number;
  user_id: number;
  achievement_id: string;
  achievement_name: string;
  achievement_description: string | null;
  badge_icon: string | null;
  unlocked_at: string;
  username: string;
  email: string;
}

async function getAchievements(userId: string, organizationId: number) {
  const achievements = await executeQuery<AchievementRow>(
    `SELECT ga.id, ga.user_id, ga.achievement_id, ga.achievement_name,
            ga.achievement_description, ga.badge_icon, ga.unlocked_at,
            u.name AS username, u.email
     FROM gamification_achievements ga
     JOIN users u ON u.id = ga.user_id
     WHERE ga.user_id = ? AND ga.organization_id = ?
     ORDER BY ga.unlocked_at DESC`,
    [userId, organizationId] as SqlParam[]
  );

  return apiSuccess({ achievements });
}

interface LeaderboardRow {
  user_id: number;
  username: string;
  email: string;
  total_points: number;
  transactions_count: number;
}

async function getLeaderboard(organizationId: number, period: string) {
  let dateFilter = '';
  const params: SqlParam[] = [organizationId];

  if (period === 'day') {
    dateFilter = `AND gp.created_at >= ${sqlNow()} - INTERVAL '1 day'`;
  } else if (period === 'week') {
    dateFilter = `AND gp.created_at >= ${sqlNow()} - INTERVAL '7 days'`;
  } else if (period === 'month') {
    dateFilter = `AND gp.created_at >= ${sqlNow()} - INTERVAL '30 days'`;
  }
  // 'all-time' => no date filter

  const leaderboard = await executeQuery<LeaderboardRow>(
    `SELECT gp.user_id, u.name AS username, u.email,
            SUM(gp.points) AS total_points,
            COUNT(gp.id) AS transactions_count
     FROM gamification_points gp
     JOIN users u ON u.id = gp.user_id
     WHERE gp.organization_id = ? ${dateFilter}
     GROUP BY gp.user_id, u.name, u.email
     ORDER BY total_points DESC
     LIMIT 20`,
    params
  );

  // Add rank
  const ranked = leaderboard.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));

  return apiSuccess({ leaderboard: ranked, period });
}

interface ChallengeRow {
  id: number;
  challenge_id: string;
  title: string;
  description: string | null;
  type: string;
  goal_type: string;
  goal_target: number;
  points_reward: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  participant_count: number;
}

async function getChallenges(organizationId: number, status: string | null) {
  const params: SqlParam[] = [organizationId];
  let statusFilter = '';

  if (status) {
    statusFilter = 'AND gc.status = ?';
    params.push(status);
  }

  const challenges = await executeQuery<ChallengeRow>(
    `SELECT gc.id, gc.challenge_id, gc.title, gc.description, gc.type,
            gc.goal_type, gc.goal_target, gc.points_reward,
            gc.start_date, gc.end_date, gc.status, gc.created_at,
            COUNT(gcp.id) AS participant_count
     FROM gamification_challenges gc
     LEFT JOIN gamification_challenge_participants gcp ON gcp.challenge_id = gc.id
     WHERE gc.organization_id = ? ${statusFilter}
     GROUP BY gc.id, gc.challenge_id, gc.title, gc.description, gc.type,
              gc.goal_type, gc.goal_target, gc.points_reward,
              gc.start_date, gc.end_date, gc.status, gc.created_at
     ORDER BY gc.start_date DESC`,
    params
  );

  return apiSuccess({ challenges });
}

interface ParticipantRow {
  id: number;
  user_id: number;
  username: string;
  email: string;
  progress: number;
  completed: number | boolean;
  joined_at: string;
}

async function getChallengeDetail(challengeId: string, organizationId: number) {
  const challenge = await executeQueryOne<ChallengeRow>(
    `SELECT gc.id, gc.challenge_id, gc.title, gc.description, gc.type,
            gc.goal_type, gc.goal_target, gc.points_reward,
            gc.start_date, gc.end_date, gc.status, gc.created_at,
            COUNT(gcp.id) AS participant_count
     FROM gamification_challenges gc
     LEFT JOIN gamification_challenge_participants gcp ON gcp.challenge_id = gc.id
     WHERE gc.id = ? AND gc.organization_id = ?
     GROUP BY gc.id, gc.challenge_id, gc.title, gc.description, gc.type,
              gc.goal_type, gc.goal_target, gc.points_reward,
              gc.start_date, gc.end_date, gc.status, gc.created_at`,
    [challengeId, organizationId] as SqlParam[]
  );

  if (!challenge) {
    return apiError('Desafio não encontrado', 404);
  }

  const participants = await executeQuery<ParticipantRow>(
    `SELECT gcp.id, gcp.user_id, u.name AS username, u.email,
            gcp.progress, gcp.completed, gcp.joined_at
     FROM gamification_challenge_participants gcp
     JOIN users u ON u.id = gcp.user_id
     WHERE gcp.challenge_id = ? AND gcp.organization_id = ?
     ORDER BY gcp.progress DESC`,
    [challengeId, organizationId] as SqlParam[]
  );

  return apiSuccess({ challenge, participants });
}

interface PointRow {
  id: number;
  user_id: number;
  points: number;
  action: string;
  description: string | null;
  ticket_id: number | null;
  created_at: string;
}

async function getPointsHistory(userId: string, organizationId: number) {
  const transactions = await executeQuery<PointRow>(
    `SELECT id, user_id, points, action, description, ticket_id, created_at
     FROM gamification_points
     WHERE user_id = ? AND organization_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId, organizationId] as SqlParam[]
  );

  const totalRow = await executeQueryOne<{ total: number }>(
    `SELECT COALESCE(SUM(points), 0) AS total
     FROM gamification_points
     WHERE user_id = ? AND organization_id = ?`,
    [userId, organizationId] as SqlParam[]
  );

  return apiSuccess({
    transactions,
    totalPoints: totalRow?.total ?? 0,
  });
}

interface RankRow {
  user_rank: number;
}

async function getUserStats(userId: string, organizationId: number) {
  // Total points
  const pointsRow = await executeQueryOne<{ total: number }>(
    `SELECT COALESCE(SUM(points), 0) AS total
     FROM gamification_points
     WHERE user_id = ? AND organization_id = ?`,
    [userId, organizationId] as SqlParam[]
  );

  // Achievements count
  const achievementsRow = await executeQueryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM gamification_achievements
     WHERE user_id = ? AND organization_id = ?`,
    [userId, organizationId] as SqlParam[]
  );

  // Challenges completed
  const challengesRow = await executeQueryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM gamification_challenge_participants
     WHERE user_id = ? AND organization_id = ? AND completed = 1`,
    [userId, organizationId] as SqlParam[]
  );

  // Kudos received
  const kudosRow = await executeQueryOne<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM gamification_kudos
     WHERE to_user_id = ? AND organization_id = ?`,
    [userId, organizationId] as SqlParam[]
  );

  // Rank (based on total points among all users in org)
  const rankRow = await executeQueryOne<RankRow>(
    `SELECT COUNT(*) + 1 AS user_rank
     FROM (
       SELECT user_id, SUM(points) AS tp
       FROM gamification_points
       WHERE organization_id = ?
       GROUP BY user_id
     ) ranked
     WHERE ranked.tp > COALESCE((
       SELECT SUM(points)
       FROM gamification_points
       WHERE user_id = ? AND organization_id = ?
     ), 0)`,
    [organizationId, userId, organizationId] as SqlParam[]
  );

  return apiSuccess({
    userId,
    totalPoints: pointsRow?.total ?? 0,
    rank: rankRow?.user_rank ?? 1,
    achievementsCount: achievementsRow?.total ?? 0,
    challengesCompleted: challengesRow?.total ?? 0,
    kudosReceived: kudosRow?.total ?? 0,
  });
}

interface KudosRow {
  id: number;
  from_user_id: number;
  from_username: string;
  to_user_id: number;
  to_username: string;
  message: string;
  reaction: string | null;
  created_at: string;
}

async function getRecognitionFeed(organizationId: number) {
  const recognitions = await executeQuery<KudosRow>(
    `SELECT gk.id, gk.from_user_id, uf.name AS from_username,
            gk.to_user_id, ut.name AS to_username,
            gk.message, gk.reaction, gk.created_at
     FROM gamification_kudos gk
     JOIN users uf ON uf.id = gk.from_user_id
     JOIN users ut ON ut.id = gk.to_user_id
     WHERE gk.organization_id = ?
     ORDER BY gk.created_at DESC
     LIMIT 30`,
    [organizationId] as SqlParam[]
  );

  return apiSuccess({ recognitions });
}

// ========================================
// POST handlers
// ========================================

async function awardPoints(
  userId: string,
  organizationId: number,
  data: { points?: number; pointsAction?: string; description?: string; ticketId?: number }
) {
  const points = data.points || 0;
  const action = data.pointsAction || 'manual';
  const description = data.description || null;
  const ticketId = data.ticketId || null;

  if (points <= 0) {
    return apiError('Pontos devem ser maiores que zero', 400);
  }

  const result = await executeRun(
    `INSERT INTO gamification_points (user_id, organization_id, points, action, description, ticket_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, organizationId, points, action, description, ticketId] as SqlParam[]
  );

  return apiSuccess({
    success: true,
    id: result.lastInsertRowid,
    points,
    action,
  });
}

async function unlockAchievement(
  userId: string,
  organizationId: number,
  data: { achievementId: string; achievementName: string; achievementDescription?: string; badgeIcon?: string }
) {
  if (!data.achievementId || !data.achievementName) {
    return apiError('Achievement ID e nome são obrigatórios', 400);
  }

  // Check if already unlocked
  const existing = await executeQueryOne<{ id: number }>(
    `SELECT id FROM gamification_achievements
     WHERE user_id = ? AND organization_id = ? AND achievement_id = ?`,
    [userId, organizationId, data.achievementId] as SqlParam[]
  );

  if (existing) {
    return apiError('Conquista já desbloqueada', 409);
  }

  const result = await executeRun(
    `INSERT INTO gamification_achievements (user_id, organization_id, achievement_id, achievement_name, achievement_description, badge_icon)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      organizationId,
      data.achievementId,
      data.achievementName,
      data.achievementDescription || null,
      data.badgeIcon || null,
    ] as SqlParam[]
  );

  return apiSuccess({
    success: true,
    id: result.lastInsertRowid,
    achievementId: data.achievementId,
    achievementName: data.achievementName,
  });
}

async function joinChallenge(userId: string, organizationId: number, challengeId: string) {
  if (!challengeId) {
    return apiError('Challenge ID é obrigatório', 400);
  }

  // Verify challenge exists and is active
  const challenge = await executeQueryOne<{ id: number; status: string }>(
    `SELECT id, status FROM gamification_challenges
     WHERE id = ? AND organization_id = ?`,
    [challengeId, organizationId] as SqlParam[]
  );

  if (!challenge) {
    return apiError('Desafio não encontrado', 404);
  }

  if (challenge.status !== 'active') {
    return apiError('Desafio não está ativo', 400);
  }

  // Check if already joined
  const existing = await executeQueryOne<{ id: number }>(
    `SELECT id FROM gamification_challenge_participants
     WHERE challenge_id = ? AND user_id = ?`,
    [challengeId, userId] as SqlParam[]
  );

  if (existing) {
    return apiError('Já inscrito neste desafio', 409);
  }

  const result = await executeRun(
    `INSERT INTO gamification_challenge_participants (challenge_id, user_id, organization_id)
     VALUES (?, ?, ?)`,
    [challengeId, userId, organizationId] as SqlParam[]
  );

  return apiSuccess({
    success: true,
    id: result.lastInsertRowid,
    challengeId,
    userId,
  });
}

async function leaveChallenge(userId: string, organizationId: number, challengeId: string) {
  if (!challengeId) {
    return apiError('Challenge ID é obrigatório', 400);
  }

  const result = await executeRun(
    `DELETE FROM gamification_challenge_participants
     WHERE challenge_id = ? AND user_id = ? AND organization_id = ?`,
    [challengeId, userId, organizationId] as SqlParam[]
  );

  if (result.changes === 0) {
    return apiError('Inscrição não encontrada', 404);
  }

  return apiSuccess({
    success: true,
    challengeId,
    userId,
  });
}

async function sendKudos(
  fromUserId: string,
  organizationId: number,
  data: { toUserId: string; message: string }
) {
  if (!data.toUserId || !data.message) {
    return apiError('Destinatário e mensagem são obrigatórios', 400);
  }

  if (String(fromUserId) === String(data.toUserId)) {
    return apiError('Não é possível enviar kudos para si mesmo', 400);
  }

  // Insert kudos
  const result = await executeRun(
    `INSERT INTO gamification_kudos (from_user_id, to_user_id, organization_id, message)
     VALUES (?, ?, ?, ?)`,
    [fromUserId, data.toUserId, organizationId, data.message] as SqlParam[]
  );

  // Award points to recipient (10 points for receiving kudos)
  await executeRun(
    `INSERT INTO gamification_points (user_id, organization_id, points, action, description)
     VALUES (?, ?, ?, ?, ?)`,
    [data.toUserId, organizationId, 10, 'kudos_received', `Kudos recebido do usuário ${fromUserId}`] as SqlParam[]
  );

  // Award points to sender (5 points for sending kudos)
  await executeRun(
    `INSERT INTO gamification_points (user_id, organization_id, points, action, description)
     VALUES (?, ?, ?, ?, ?)`,
    [fromUserId, organizationId, 5, 'kudos_sent', `Kudos enviado para usuário ${data.toUserId}`] as SqlParam[]
  );

  return apiSuccess({
    success: true,
    id: result.lastInsertRowid,
    senderPoints: 5,
    receiverPoints: 10,
  });
}

async function addReaction(data: { kudosId: string; emoji: string }) {
  if (!data.kudosId || !data.emoji) {
    return apiError('Kudos ID e emoji são obrigatórios', 400);
  }

  const result = await executeRun(
    `UPDATE gamification_kudos SET reaction = ? WHERE id = ?`,
    [data.emoji, data.kudosId] as SqlParam[]
  );

  if (result.changes === 0) {
    return apiError('Kudos não encontrado', 404);
  }

  return apiSuccess({
    success: true,
    kudosId: data.kudosId,
    emoji: data.emoji,
  });
}
