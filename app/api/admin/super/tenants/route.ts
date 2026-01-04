import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db/connection';
import { verifyAuth } from '@/lib/auth/sqlite-auth';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * GET /api/admin/super/tenants
 *
 * SECURITY: Super-admin only endpoint
 * Lists all organizations in the system
 *
 * AUTHENTICATION REQUIRED:
 * - Valid JWT token
 * - User role must be 'admin'
 * - Additional super-admin permission check
 */
export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
  if (rateLimitResponse) return rateLimitResponse;

    try {
        // Verify authentication
        const authResult = await verifyAuth(request);

        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json(
                { error: 'Unauthorized - Authentication required' },
                { status: 401 }
            );
        }

        // Check if user is admin
        if (authResult.user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            );
        }

        // Additional super-admin check - verify user has super-admin permissions
        // Super-admins are typically from organization_id = 1 (system organization)
        const isSuperAdmin = authResult.user.organization_id === 1 && authResult.user.role === 'admin';

        if (!isSuperAdmin) {
            return NextResponse.json(
                { error: 'Forbidden - Super-admin access required' },
                { status: 403 }
            );
        }

        // Log the access for audit purposes
        db.prepare(`
            INSERT INTO audit_logs (
                user_id,
                organization_id,
                entity_type,
                entity_id,
                action,
                ip_address,
                user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            authResult.user.id,
            authResult.user.organization_id,
            'organization',
            0,
            'list_all_tenants',
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            request.headers.get('user-agent') || 'unknown'
        );

        // Fetch all organizations
        const tenants = db.prepare(`
            SELECT
                id,
                name,
                slug,
                subscription_plan,
                subscription_status,
                max_users,
                max_tickets_per_month,
                is_active,
                created_at,
                updated_at,
                (SELECT COUNT(*) FROM users WHERE users.organization_id = organizations.id) as user_count,
                (SELECT COUNT(*) FROM tickets WHERE tickets.organization_id = organizations.id) as ticket_count
            FROM organizations
            ORDER BY created_at DESC
        `).all();

        return NextResponse.json({
            success: true,
            data: tenants,
            total: tenants.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Tenants API error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
