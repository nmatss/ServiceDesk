import { logger } from '@/lib/monitoring/logger';
import { NextResponse } from 'next/server';
import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import { hashPassword } from '@/lib/auth/auth-service';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    // SECURITY: Rate limiting for public onboarding endpoint
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_REGISTER);
    if (rateLimitResponse) return rateLimitResponse;

    try {
        const body = await request.json();
        const { companyName, slug, adminName, adminEmail, adminPassword, primaryColor } = body;

        // 1. Validate input
        if (!companyName || !slug || !adminName || !adminEmail || !adminPassword) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 2. Check if slug exists
        const existingOrg = await executeQueryOne('SELECT id FROM organizations WHERE slug = ?', [slug]);
        if (existingOrg) {
            return NextResponse.json({ error: 'Organization slug already taken' }, { status: 409 });
        }

        // 3. Check if email exists
        const existingUser = await executeQueryOne('SELECT id FROM users WHERE email = ?', [adminEmail]);
        if (existingUser) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }

        // 4. Create Organization
        

        const settings = JSON.stringify({
            branding: {
                primaryColor: primaryColor || '#3b82f6'
            }
        });

        const orgResult = await executeRun(`
      INSERT INTO organizations (name, slug, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active, settings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyName,
            slug,
            'trial', // Default plan
            'active',
            5, // Default max users for trial
            100, // Default max tickets
            1, // Active
            settings]);

        const orgId = orgResult.lastInsertRowid as number;

        // 5. Create Admin User
        const hashedPassword = await hashPassword(adminPassword);

        

        const userResult = await executeRun(`
      INSERT INTO users (name, email, password_hash, role, organization_id, is_active, is_email_verified, failed_login_attempts, two_factor_enabled, timezone, language, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'UTC', 'en', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [adminName,
            adminEmail,
            hashedPassword,
            'admin',
            orgId,
            1, // Active
            0 // Not verified yet
        ]);

        return NextResponse.json({
            success: true,
            organizationId: orgId,
            userId: userResult.lastInsertRowid,
            message: 'Tenant created successfully'
        });

    } catch (error) {
        logger.error('Onboarding error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
