import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { executeQueryOne } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';

export async function GET(request: NextRequest) {
    // SECURITY: Rate limiting
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ADMIN_MUTATION);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        // SECURITY: Require authentication and super-admin access
        const guard = requireTenantUserContext(request, { requireRoles: ['admin', 'super_admin'] });
        if (guard.response) return guard.response;

        // Additional super-admin check - only org 1 can see system-wide stats
        if (guard.auth!.organizationId !== 1) {
            return NextResponse.json(
                { success: false, error: 'Forbidden - Super-admin access required' },
                { status: 403 }
            );
        }

        // Mock data for now as we don't have real billing/MRR
        // In a real scenario, we would calculate MRR based on active subscriptions
        const tenantCount = await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM organizations') || { count: 0 };
        const userCount = await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE is_active = 1') || { count: 0 };

        const stats = {
            totalTenants: tenantCount.count,
            activeUsers: userCount.count,
            mrr: 15420, // Mock
            systemHealth: 98 // Mock
        };

        return NextResponse.json({ success: true, data: stats });
    } catch (error) {
        logger.error('Stats API error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
