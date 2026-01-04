import { NextResponse } from 'next/server';
import db from '@/lib/db/connection';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
export async function GET() {
    try {
        // Mock data for now as we don't have real billing/MRR
        // In a real scenario, we would calculate MRR based on active subscriptions
        const tenantCount = db.prepare('SELECT COUNT(*) as count FROM organizations').get() as { count: number };
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get() as { count: number };

        const stats = {
            totalTenants: tenantCount.count,
            activeUsers: userCount.count,
            mrr: 15420, // Mock
            systemHealth: 98 // Mock
        };

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Stats API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
