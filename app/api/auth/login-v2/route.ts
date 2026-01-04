/**
 * POST /api/auth/login-v2
 *
 * Refactored login endpoint using service layer architecture.
 * Demonstrates clean authentication: Controller -> Service -> Repository
 *
 * IMPROVEMENTS:
 * - Business logic in UserService
 * - Clean separation of concerns
 * - Testable without HTTP stack
 * - Consistent error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserService } from '@/lib/di/container';
import { getTenantContextFromRequest } from '@/lib/tenant/context';
import { validateJWTSecret } from '@/lib/config/env';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import db from '@/lib/db/connection';
import * as jose from 'jose';
import { z } from 'zod';

const JWT_SECRET = new TextEncoder().encode(validateJWTSecret());

/**
 * Login request schema
 */
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  tenant_slug: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting crítico para login
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = loginSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { email, password, tenant_slug } = validationResult.data;

    // 3. Resolve tenant context
    let tenantContext = getTenantContextFromRequest(request);

    if (!tenantContext && tenant_slug) {
      const org = db
        .prepare(
          `
        SELECT id, name, slug FROM organizations
        WHERE slug = ? AND is_active = 1
      `
        )
        .get(tenant_slug) as { id: number; name: string; slug: string } | undefined;

      if (org) {
        tenantContext = {
          id: org.id,
          slug: org.slug,
          name: org.name,
        };
      }
    }

    // Development fallback
    if (!tenantContext && process.env.NODE_ENV !== 'production') {
      const defaultOrg = db
        .prepare(
          `
        SELECT id, name, slug FROM organizations
        WHERE is_active = 1 ORDER BY id LIMIT 1
      `
        )
        .get() as { id: number; name: string; slug: string } | undefined;

      if (defaultOrg) {
        tenantContext = {
          id: defaultOrg.id,
          slug: defaultOrg.slug,
          name: defaultOrg.name,
        };
      }
    }

    if (!tenantContext) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tenant not found',
        },
        { status: 400 }
      );
    }

    // 4. Get service from DI container
    const userService = getUserService();

    try {
      // 5. Authenticate through service layer
      // All security checks, password verification, and account locking
      // are handled in the UserService.login() method
      const user = await userService.login({
        email,
        password,
      });

      // 6. Verify user belongs to tenant
      if (user.organization_id !== tenantContext.id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid credentials',
          },
          { status: 401 }
        );
      }

      // 7. Generate JWT token
      const token = await new jose.SignJWT({
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .setIssuedAt()
        .sign(JWT_SECRET);

      // 8. Log successful login
      const ipAddress =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      db.prepare(
        `
        INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, organization_id)
        VALUES (?, ?, ?, ?, 1, ?)
      `
      ).run(user.id, email, ipAddress, userAgent, tenantContext.id);

      // 9. Return success response
      return NextResponse.json(
        {
          success: true,
          data: {
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              organization_id: user.organization_id,
            },
            token,
            tenant: tenantContext,
          },
          message: 'Login successful',
        },
        { status: 200 }
      );
    } catch (error: any) {
      // Service layer throws specific errors for business rule violations
      // (invalid credentials, account locked, etc.)

      // Log failed attempt
      const ipAddress =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      db.prepare(
        `
        INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason, organization_id)
        VALUES (?, ?, ?, 0, ?, ?)
      `
      ).run(email, ipAddress, userAgent, error.message, tenantContext.id);

      // Determine status code based on error
      let status = 401;
      if (error.message.includes('locked')) {
        status = 423; // Locked
      }

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status }
      );
    }
  } catch (error: any) {
    console.error('Login error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * COMPARISON: Before vs After Architecture
 *
 * BEFORE (Old login route):
 * ✗ ~200 lines with mixed concerns
 * ✗ Direct database queries in route
 * ✗ Password verification logic in route
 * ✗ Account locking logic scattered
 * ✗ Hard to test authentication logic
 * ✗ Duplicated security checks
 *
 * AFTER (This file):
 * ✓ ~150 lines (controller only)
 * ✓ No password verification in route
 * ✓ All auth logic in UserService
 * ✓ Testable service methods
 * ✓ Centralized security rules
 * ✓ Clean separation of concerns
 *
 * SECURITY BENEFITS:
 * 1. Centralized password verification
 * 2. Consistent account locking logic
 * 3. Easier to audit security rules
 * 4. Unit testable security features
 * 5. Reusable across different auth methods
 */
