/**
 * Change Advisory Board (CAB) Queries
 * ITIL 4 Compliant - Adapter Pattern
 *
 * Manages CAB configurations, members, meetings, and voting processes
 */

import { executeQuery, executeQueryOne, executeRun, executeTransaction } from '../adapter';
import type {
  CABConfiguration,
  CABMember,
  CABMemberWithDetails,
  CABMeeting,
  CABMeetingWithDetails,
  ChangeRequest,
  ChangeRequestApproval,
  ChangeRequestApprovalWithDetails,
  CreateCABConfiguration,
  CreateCABMember,
  CreateCABMeeting,
  User,
} from '../../types/database';

// ============================================
// CAB CONFIGURATION QUERIES
// ============================================

/**
 * Create a new CAB configuration
 */
export async function createCABConfiguration(
  organizationId: number,
  input: CreateCABConfiguration
): Promise<CABConfiguration> {
  const result = await executeRun(
    `INSERT INTO cab_configurations (
      name, description, organization_id,
      meeting_day, meeting_time, meeting_duration,
      meeting_location, meeting_url,
      chair_user_id, secretary_user_id,
      minimum_members, quorum_percentage,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.description || null,
      organizationId,
      input.meeting_day || null,
      input.meeting_time || null,
      input.meeting_duration || 60,
      input.meeting_location || null,
      input.meeting_url || null,
      input.chair_user_id || null,
      input.secretary_user_id || null,
      input.minimum_members || 3,
      input.quorum_percentage || 50,
      input.is_active !== false ? 1 : 0,
    ]
  );

  const cab = await getCABConfigurationById(organizationId, result.lastInsertRowid!);
  return cab!;
}

/**
 * Get CAB configuration by ID with members
 */
export async function getCABConfigurationById(
  organizationId: number,
  id: number
): Promise<CABConfiguration | null> {
  const cab = await executeQueryOne<CABConfiguration>(
    `SELECT * FROM cab_configurations WHERE id = ? AND organization_id = ?`,
    [id, organizationId]
  );

  if (!cab) return null;

  return cab;
}

/**
 * List all CAB configurations for an organization
 */
export async function listCABConfigurations(
  organizationId: number
): Promise<CABConfiguration[]> {
  return await executeQuery<CABConfiguration>(
    `SELECT * FROM cab_configurations
     WHERE organization_id = ?
     ORDER BY is_active DESC, name ASC`,
    [organizationId]
  );
}

/**
 * Update CAB configuration
 */
export async function updateCABConfiguration(
  organizationId: number,
  id: number,
  input: Partial<CreateCABConfiguration>
): Promise<CABConfiguration | null> {
  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.meeting_day !== undefined) {
    updates.push('meeting_day = ?');
    values.push(input.meeting_day);
  }
  if (input.meeting_time !== undefined) {
    updates.push('meeting_time = ?');
    values.push(input.meeting_time);
  }
  if (input.meeting_duration !== undefined) {
    updates.push('meeting_duration = ?');
    values.push(input.meeting_duration);
  }
  if (input.meeting_location !== undefined) {
    updates.push('meeting_location = ?');
    values.push(input.meeting_location);
  }
  if (input.meeting_url !== undefined) {
    updates.push('meeting_url = ?');
    values.push(input.meeting_url);
  }
  if (input.chair_user_id !== undefined) {
    updates.push('chair_user_id = ?');
    values.push(input.chair_user_id);
  }
  if (input.secretary_user_id !== undefined) {
    updates.push('secretary_user_id = ?');
    values.push(input.secretary_user_id);
  }
  if (input.minimum_members !== undefined) {
    updates.push('minimum_members = ?');
    values.push(input.minimum_members);
  }
  if (input.quorum_percentage !== undefined) {
    updates.push('quorum_percentage = ?');
    values.push(input.quorum_percentage);
  }
  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(input.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return getCABConfigurationById(organizationId, id);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id, organizationId);

  await executeRun(
    `UPDATE cab_configurations SET ${updates.join(', ')}
     WHERE id = ? AND organization_id = ?`,
    values
  );

  return getCABConfigurationById(organizationId, id);
}

// ============================================
// CAB MEMBER QUERIES
// ============================================

/**
 * Add a member to a CAB
 */
export async function addCABMember(
  cabId: number,
  input: CreateCABMember
): Promise<CABMember> {
  // Check if member already exists
  const existing = await executeQueryOne<CABMember>(
    `SELECT * FROM cab_members WHERE cab_id = ? AND user_id = ?`,
    [cabId, input.user_id]
  );

  if (existing) {
    // Reactivate if inactive
    if (!existing.is_active) {
      await executeRun(
        `UPDATE cab_members
         SET is_active = 1, role = ?, is_voting_member = ?, expertise_areas = ?
         WHERE id = ?`,
        [
          input.role || 'member',
          input.is_voting_member !== false ? 1 : 0,
          input.expertise_areas ? JSON.stringify(input.expertise_areas) : null,
          existing.id,
        ]
      );
    }
    return (await executeQueryOne<CABMember>(
      `SELECT * FROM cab_members WHERE id = ?`,
      [existing.id]
    ))!;
  }

  const result = await executeRun(
    `INSERT INTO cab_members (
      cab_id, user_id, role, is_voting_member, expertise_areas, is_active
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      cabId,
      input.user_id,
      input.role || 'member',
      input.is_voting_member !== false ? 1 : 0,
      input.expertise_areas ? JSON.stringify(input.expertise_areas) : null,
      input.is_active !== false ? 1 : 0,
    ]
  );

  return (await executeQueryOne<CABMember>(
    `SELECT * FROM cab_members WHERE id = ?`,
    [result.lastInsertRowid!]
  ))!;
}

/**
 * Remove a member from CAB (soft delete)
 */
export async function removeCABMember(
  cabId: number,
  userId: number
): Promise<boolean> {
  const result = await executeRun(
    `UPDATE cab_members SET is_active = 0 WHERE cab_id = ? AND user_id = ?`,
    [cabId, userId]
  );

  return result.changes > 0;
}

/**
 * List CAB members with user details (single JOIN query)
 */
export async function listCABMembers(
  cabId: number
): Promise<CABMemberWithDetails[]> {
  const rows = await executeQuery<any>(
    `SELECT cm.*,
       u.id as user__id, u.name as user__name, u.email as user__email,
       u.avatar_url as user__avatar_url, u.role as user__role
     FROM cab_members cm
     LEFT JOIN users u ON cm.user_id = u.id
     WHERE cm.cab_id = ?
     ORDER BY cm.role ASC, cm.joined_at ASC`,
    [cabId]
  );

  return rows.map((row: any) => {
    const { user__id, user__name, user__email, user__avatar_url, user__role, ...memberFields } = row;
    return {
      ...memberFields,
      user: user__id ? { id: user__id, name: user__name, email: user__email, avatar_url: user__avatar_url, role: user__role } : undefined,
    } as CABMemberWithDetails;
  });
}

// ============================================
// CAB MEETING QUERIES
// ============================================

/**
 * Create a new CAB meeting
 */
export async function createCABMeeting(
  organizationId: number,
  cabId: number,
  userId: number,
  input: CreateCABMeeting
): Promise<CABMeeting> {
  const result = await executeRun(
    `INSERT INTO cab_meetings (
      cab_id, title, scheduled_date, meeting_date, meeting_type, status,
      attendees, agenda, minutes, decisions, action_items,
      organization_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cabId,
      input.title,
      input.scheduled_date,
      input.meeting_date,
      input.meeting_type || 'regular',
      input.status || 'scheduled',
      input.attendees ? JSON.stringify(input.attendees) : null,
      input.agenda || null,
      input.minutes || null,
      input.decisions ? JSON.stringify(input.decisions) : null,
      input.action_items ? JSON.stringify(input.action_items) : null,
      organizationId,
      userId,
    ]
  );

  return (await getCABMeetingById(organizationId, result.lastInsertRowid!))!;
}

/**
 * Get CAB meeting by ID with related data
 */
export async function getCABMeetingById(
  organizationId: number,
  meetingId: number
): Promise<CABMeetingWithDetails | null> {
  const meeting = await executeQueryOne<CABMeeting>(
    `SELECT * FROM cab_meetings WHERE id = ? AND organization_id = ?`,
    [meetingId, organizationId]
  );

  if (!meeting) return null;

  // Fetch CAB configuration
  const cabConfig = await executeQueryOne<CABConfiguration>(
    `SELECT * FROM cab_configurations WHERE id = ?`,
    [meeting.cab_id]
  );

  // Fetch change requests associated with this meeting
  const changeRequests = await executeQuery<ChangeRequest>(
    `SELECT * FROM change_requests WHERE cab_meeting_id = ?`,
    [meetingId]
  );

  // Parse attendees and fetch user details
  let attendeeDetails: User[] = [];
  if (meeting.attendees) {
    try {
      const attendeeIds = JSON.parse(meeting.attendees);
      if (Array.isArray(attendeeIds) && attendeeIds.length > 0) {
        const placeholders = attendeeIds.map(() => '?').join(',');
        attendeeDetails = await executeQuery<User>(
          `SELECT id, name, email, avatar_url, role
           FROM users WHERE id IN (${placeholders})`,
          attendeeIds
        );
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  }

  return {
    ...meeting,
    cab_configuration: cabConfig || undefined,
    change_requests: changeRequests,
    attendee_details: attendeeDetails,
  };
}

/**
 * List CAB meetings with filters
 */
export async function listCABMeetings(
  organizationId: number,
  filters?: {
    status?: string;
    cabId?: number;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<CABMeeting[]> {
  const conditions: string[] = ['cm.id IS NOT NULL'];
  const values: any[] = [];

  if (filters?.status) {
    conditions.push('cm.status = ?');
    values.push(filters.status);
  }

  if (filters?.cabId) {
    conditions.push('cm.cab_id = ?');
    values.push(filters.cabId);
  }

  if (filters?.dateFrom) {
    conditions.push('cm.meeting_date >= ?');
    values.push(filters.dateFrom);
  }

  if (filters?.dateTo) {
    conditions.push('cm.meeting_date <= ?');
    values.push(filters.dateTo);
  }

  // Join with cab_configurations to filter by organization
  conditions.push('cc.organization_id = ?');
  values.push(organizationId);

  return await executeQuery<CABMeeting>(
    `SELECT cm.* FROM cab_meetings cm
     INNER JOIN cab_configurations cc ON cm.cab_id = cc.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cm.meeting_date DESC`,
    values
  );
}

/**
 * Update CAB meeting
 */
export async function updateCABMeeting(
  organizationId: number,
  meetingId: number,
  input: Partial<{
    status: string;
    meeting_date: string;
    meeting_type: string;
    attendees: any[];
    actual_start: string;
    actual_end: string;
    agenda: string;
    minutes: string;
    decisions: any[];
    action_items: any[];
  }>
): Promise<CABMeeting | null> {
  const updates: string[] = [];
  const values: any[] = [];

  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }
  if (input.meeting_date !== undefined) {
    updates.push('meeting_date = ?');
    values.push(input.meeting_date);
  }
  if (input.meeting_type !== undefined) {
    updates.push('meeting_type = ?');
    values.push(input.meeting_type);
  }
  if (input.attendees !== undefined) {
    updates.push('attendees = ?');
    values.push(JSON.stringify(input.attendees));
  }
  if (input.actual_start !== undefined) {
    updates.push('actual_start = ?');
    values.push(input.actual_start);
  }
  if (input.actual_end !== undefined) {
    updates.push('actual_end = ?');
    values.push(input.actual_end);
  }
  if (input.agenda !== undefined) {
    updates.push('agenda = ?');
    values.push(input.agenda);
  }
  if (input.minutes !== undefined) {
    updates.push('minutes = ?');
    values.push(input.minutes);
  }
  if (input.decisions !== undefined) {
    updates.push('decisions = ?');
    values.push(JSON.stringify(input.decisions));
  }
  if (input.action_items !== undefined) {
    updates.push('action_items = ?');
    values.push(JSON.stringify(input.action_items));
  }

  if (updates.length === 0) {
    return getCABMeetingById(organizationId, meetingId);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(meetingId, organizationId);

  await executeRun(
    `UPDATE cab_meetings SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
    values
  );

  return getCABMeetingById(organizationId, meetingId);
}

/**
 * Start a CAB meeting
 */
export async function startCABMeeting(
  organizationId: number,
  meetingId: number
): Promise<CABMeeting | null> {
  await executeRun(
    `UPDATE cab_meetings
     SET status = 'in_progress',
         actual_start = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [meetingId, organizationId]
  );

  return getCABMeetingById(organizationId, meetingId);
}

/**
 * End a CAB meeting
 */
export async function endCABMeeting(
  organizationId: number,
  meetingId: number,
  minutes?: string,
  decisions?: any[],
  actionItems?: any[]
): Promise<CABMeeting | null> {
  const updates: string[] = [
    'status = ?',
    'actual_end = CURRENT_TIMESTAMP',
    'updated_at = CURRENT_TIMESTAMP',
  ];
  const values: any[] = ['completed'];

  if (minutes !== undefined) {
    updates.push('minutes = ?');
    values.push(minutes);
  }
  if (decisions !== undefined) {
    updates.push('decisions = ?');
    values.push(JSON.stringify(decisions));
  }
  if (actionItems !== undefined) {
    updates.push('action_items = ?');
    values.push(JSON.stringify(actionItems));
  }

  values.push(meetingId, organizationId);

  await executeRun(
    `UPDATE cab_meetings SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
    values
  );

  return getCABMeetingById(organizationId, meetingId);
}

/**
 * Cancel a CAB meeting
 */
export async function cancelCABMeeting(
  organizationId: number,
  meetingId: number
): Promise<CABMeeting | null> {
  await executeRun(
    `UPDATE cab_meetings
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [meetingId, organizationId]
  );

  return getCABMeetingById(organizationId, meetingId);
}

// ============================================
// CHANGE REQUEST - MEETING LINKAGE
// ============================================

/**
 * Add a change request to a meeting
 */
export async function addChangeToMeeting(
  meetingId: number,
  changeRequestId: number
): Promise<boolean> {
  const result = await executeRun(
    `UPDATE change_requests
     SET cab_meeting_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [meetingId, changeRequestId]
  );

  return result.changes > 0;
}

/**
 * Remove a change request from a meeting
 */
export async function removeChangeFromMeeting(
  meetingId: number,
  changeRequestId: number
): Promise<boolean> {
  const result = await executeRun(
    `UPDATE change_requests
     SET cab_meeting_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND cab_meeting_id = ?`,
    [changeRequestId, meetingId]
  );

  return result.changes > 0;
}

/**
 * List change requests linked to a meeting
 */
export async function listMeetingChangeRequests(
  meetingId: number
): Promise<ChangeRequest[]> {
  return await executeQuery<ChangeRequest>(
    `SELECT * FROM change_requests
     WHERE cab_meeting_id = ?
     ORDER BY priority DESC, created_at ASC`,
    [meetingId]
  );
}

// ============================================
// VOTING QUERIES
// ============================================

/**
 * Cast or update a vote on a change request
 */
export async function castVote(
  organizationId: number,
  changeRequestId: number,
  cabMemberId: number,
  vote: 'approve' | 'reject' | 'defer' | 'abstain',
  comments?: string,
  conditions?: string
): Promise<ChangeRequestApproval> {
  // Verify the change request belongs to the organization
  const cr = await executeQueryOne<{ id: number }>(
    `SELECT id FROM change_requests WHERE id = ? AND organization_id = ?`,
    [changeRequestId, organizationId]
  );
  if (!cr) {
    throw new Error('Change request not found or access denied');
  }

  // Check if vote already exists
  const existing = await executeQueryOne<ChangeRequestApproval>(
    `SELECT * FROM change_request_approvals
     WHERE change_request_id = ? AND cab_member_id = ?`,
    [changeRequestId, cabMemberId]
  );

  if (existing) {
    // Update existing vote
    await executeRun(
      `UPDATE change_request_approvals
       SET vote = ?, voted_at = CURRENT_TIMESTAMP, comments = ?, conditions = ?
       WHERE id = ?`,
      [vote, comments || null, conditions || null, existing.id]
    );

    return (await executeQueryOne<ChangeRequestApproval>(
      `SELECT * FROM change_request_approvals WHERE id = ?`,
      [existing.id]
    ))!;
  }

  // Insert new vote
  const result = await executeRun(
    `INSERT INTO change_request_approvals (
      change_request_id, cab_member_id, vote, voted_at, comments, conditions
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
    [changeRequestId, cabMemberId, vote, comments || null, conditions || null]
  );

  return (await executeQueryOne<ChangeRequestApproval>(
    `SELECT * FROM change_request_approvals WHERE id = ?`,
    [result.lastInsertRowid!]
  ))!;
}

/**
 * Get voting results for a change request
 */
export async function getVotingResults(
  organizationId: number,
  changeRequestId: number
): Promise<{
  approvals: ChangeRequestApprovalWithDetails[];
  summary: {
    total_votes: number;
    approve: number;
    reject: number;
    defer: number;
    abstain: number;
    approval_percentage: number;
    has_quorum: boolean;
  };
}> {
  // Fetch all votes with member and user details in a single JOIN query
  const rows = await executeQuery<any>(
    `SELECT cra.*,
       cm.id as cm__id, cm.cab_id as cm__cab_id, cm.user_id as cm__user_id,
       cm.role as cm__role, cm.is_voting_member as cm__is_voting_member,
       cm.expertise_areas as cm__expertise_areas, cm.is_active as cm__is_active,
       cm.joined_at as cm__joined_at,
       u.id as u__id, u.name as u__name, u.email as u__email,
       u.avatar_url as u__avatar_url, u.role as u__role
     FROM change_request_approvals cra
     JOIN change_requests cr ON cra.change_request_id = cr.id
     LEFT JOIN cab_members cm ON cra.cab_member_id = cm.id
     LEFT JOIN users u ON cm.user_id = u.id
     WHERE cra.change_request_id = ? AND cr.organization_id = ?
     ORDER BY cra.created_at DESC`,
    [changeRequestId, organizationId]
  );

  const approvalsWithDetails = rows.map((row: any) => {
    const {
      cm__id, cm__cab_id, cm__user_id, cm__role, cm__is_voting_member,
      cm__expertise_areas, cm__is_active, cm__joined_at,
      u__id, u__name, u__email, u__avatar_url, u__role,
      ...approvalFields
    } = row;

    let memberWithDetails: CABMemberWithDetails | undefined;
    if (cm__id) {
      memberWithDetails = {
        id: cm__id,
        cab_id: cm__cab_id,
        user_id: cm__user_id,
        role: cm__role,
        is_voting_member: cm__is_voting_member,
        expertise_areas: cm__expertise_areas,
        is_active: cm__is_active,
        joined_at: cm__joined_at,
        user: u__id ? {
          id: u__id, name: u__name, email: u__email,
          avatar_url: u__avatar_url, role: u__role,
        } : undefined,
      } as CABMemberWithDetails;
    }

    return {
      ...approvalFields,
      cab_member: memberWithDetails,
    };
  });

  // Calculate summary
  const votingMembers = approvalsWithDetails.filter(
    (a) => a.cab_member?.is_voting_member
  );

  const summary = {
    total_votes: votingMembers.length,
    approve: votingMembers.filter((a) => a.vote === 'approve').length,
    reject: votingMembers.filter((a) => a.vote === 'reject').length,
    defer: votingMembers.filter((a) => a.vote === 'defer').length,
    abstain: votingMembers.filter((a) => a.vote === 'abstain').length,
    approval_percentage:
      votingMembers.length > 0
        ? Math.round(
            (votingMembers.filter((a) => a.vote === 'approve').length /
              votingMembers.length) *
              100
          )
        : 0,
    has_quorum: false, // Will be calculated separately
  };

  return {
    approvals: approvalsWithDetails,
    summary,
  };
}

/**
 * Check if a meeting has quorum
 */
export async function checkQuorum(
  organizationId: number,
  meetingId: number
): Promise<{
  has_quorum: boolean;
  required_members: number;
  present_members: number;
  quorum_percentage: number;
}> {
  // Get meeting and CAB configuration, scoped to organization
  const meeting = await executeQueryOne<CABMeeting>(
    `SELECT * FROM cab_meetings WHERE id = ? AND organization_id = ?`,
    [meetingId, organizationId]
  );

  if (!meeting) {
    return {
      has_quorum: false,
      required_members: 0,
      present_members: 0,
      quorum_percentage: 0,
    };
  }

  const cabConfig = await executeQueryOne<CABConfiguration>(
    `SELECT * FROM cab_configurations WHERE id = ?`,
    [meeting.cab_id]
  );

  if (!cabConfig) {
    return {
      has_quorum: false,
      required_members: 0,
      present_members: 0,
      quorum_percentage: 0,
    };
  }

  // Count active voting members
  const totalVotingMembers = await executeQueryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM cab_members
     WHERE cab_id = ? AND is_active = 1 AND is_voting_member = 1`,
    [meeting.cab_id]
  );

  const total = totalVotingMembers?.count || 0;

  // Count present members (from attendees)
  let present = 0;
  if (meeting.attendees) {
    try {
      const attendeeIds = JSON.parse(meeting.attendees);
      if (Array.isArray(attendeeIds) && attendeeIds.length > 0) {
        const presentVoting = await executeQueryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM cab_members
           WHERE cab_id = ? AND user_id IN (${attendeeIds.map(() => '?').join(',')})
           AND is_active = 1 AND is_voting_member = 1`,
          [meeting.cab_id, ...attendeeIds]
        );
        present = presentVoting?.count || 0;
      }
    } catch (e) {
      // Invalid JSON, assume no attendees
    }
  }

  // Calculate quorum
  const requiredMembers = Math.max(
    cabConfig.minimum_members,
    Math.ceil((total * cabConfig.quorum_percentage) / 100)
  );

  const hasQuorum = present >= requiredMembers;

  return {
    has_quorum: hasQuorum,
    required_members: requiredMembers,
    present_members: present,
    quorum_percentage: cabConfig.quorum_percentage,
  };
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get CAB statistics for an organization
 */
export async function getCABStatistics(
  organizationId: number
): Promise<{
  total_meetings: number;
  meetings_by_status: Record<string, number>;
  avg_votes_per_change: number;
  approval_rate: number;
  total_changes_reviewed: number;
  total_active_members: number;
}> {
  // Total meetings
  const totalMeetings = await executeQueryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM cab_meetings cm
     INNER JOIN cab_configurations cc ON cm.cab_id = cc.id
     WHERE cc.organization_id = ?`,
    [organizationId]
  );

  // Meetings by status
  const statusCounts = await executeQuery<{ status: string; count: number }>(
    `SELECT cm.status, COUNT(*) as count
     FROM cab_meetings cm
     INNER JOIN cab_configurations cc ON cm.cab_id = cc.id
     WHERE cc.organization_id = ?
     GROUP BY cm.status`,
    [organizationId]
  );

  const meetingsByStatus: Record<string, number> = {};
  statusCounts.forEach((row) => {
    meetingsByStatus[row.status] = row.count;
  });

  // Changes reviewed
  const changesReviewed = await executeQueryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT cr.id) as count
     FROM change_requests cr
     INNER JOIN cab_meetings cm ON cr.cab_meeting_id = cm.id
     INNER JOIN cab_configurations cc ON cm.cab_id = cc.id
     WHERE cc.organization_id = ?`,
    [organizationId]
  );

  // Total votes
  const totalVotes = await executeQueryOne<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM change_request_approvals cra
     INNER JOIN change_requests cr ON cra.change_request_id = cr.id
     WHERE cr.organization_id = ?`,
    [organizationId]
  );

  // Approved changes
  const approvedChanges = await executeQueryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT cr.id) as count
     FROM change_requests cr
     INNER JOIN change_request_approvals cra ON cr.id = cra.change_request_id
     WHERE cr.organization_id = ? AND cra.vote = 'approve'`,
    [organizationId]
  );

  // Active members
  const activeMembers = await executeQueryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT cm.id) as count
     FROM cab_members cm
     INNER JOIN cab_configurations cc ON cm.cab_id = cc.id
     WHERE cc.organization_id = ? AND cm.is_active = 1`,
    [organizationId]
  );

  const totalChanges = changesReviewed?.count || 0;
  const totalVotesCount = totalVotes?.count || 0;
  const approvedCount = approvedChanges?.count || 0;

  return {
    total_meetings: totalMeetings?.count || 0,
    meetings_by_status: meetingsByStatus,
    avg_votes_per_change:
      totalChanges > 0 ? Math.round((totalVotesCount / totalChanges) * 10) / 10 : 0,
    approval_rate:
      totalChanges > 0 ? Math.round((approvedCount / totalChanges) * 100) : 0,
    total_changes_reviewed: totalChanges,
    total_active_members: activeMembers?.count || 0,
  };
}
