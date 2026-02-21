import { logger } from '@/lib/monitoring/logger';
import { NextResponse } from 'next/server';
import { executeQueryOne } from '@/lib/db/adapter';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET() {
    try {
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

        return NextResponse.json(stats);
    } catch (error) {
        logger.error('Stats API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
