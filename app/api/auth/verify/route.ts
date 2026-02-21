import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';
import { createRateLimitMiddleware } from '@/lib/rate-limit';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { verifyAccessToken } from '@/lib/auth/token-manager';
import { executeQueryOne } from '@/lib/db/adapter';

const verifyRateLimit = createRateLimitMiddleware('api');

async function verifyTokenString(token?: string | null) {
  if (!token) {
    return null;
  }

  return verifyAccessToken(token);
}

function tokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(';')) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith('auth_token=')) {
      return decodeURIComponent(trimmed.slice('auth_token='.length));
    }
  }
  return null;
}

async function isActiveUser(userId: number, tenantId: number): Promise<boolean> {
  try {
    const user = await executeQueryOne<{ id: number }>(
      `SELECT id FROM users WHERE id = ? AND organization_id = ? AND is_active = 1`,
      [userId, tenantId]
    );
    if (user) return true;
  } catch {
    // Fallback for legacy schemas using tenant_id.
  }

  const user = await executeQueryOne<{ id: number }>(
    `SELECT id FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1`,
    [userId, tenantId]
  );

  return !!user;
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const rateLimitResult = await verifyRateLimit(request, '/api/auth/verify');
  if (rateLimitResult instanceof Response) {
    return rateLimitResult;
  }

  try {
    const authHeader = request.headers.get('authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token =
      tokenFromHeader ||
      request.cookies?.get?.('auth_token')?.value ||
      tokenFromCookieHeader(request.headers.get('cookie'));

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Token não fornecido',
          code: 'NO_TOKEN',
        },
        { status: 401 }
      );
    }

    const user = await verifyTokenString(token);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Token inválido ou expirado',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    const activeUser = await isActiveUser(user.user_id, user.tenant_id);
    if (!activeUser) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Token inválido ou expirado',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    logger.info('Token verified for user', user.email);

    return NextResponse.json({
      success: true,
      valid: true,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
      },
    });
  } catch (error) {
    logger.error('Error verifying token', error);

    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  const rateLimitResult = await verifyRateLimit(request, '/api/auth/verify');
  if (rateLimitResult instanceof Response) {
    return rateLimitResult;
  }

  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Token não fornecido',
          code: 'NO_TOKEN',
        },
        { status: 400 }
      );
    }

    const user = await verifyTokenString(token);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Token inválido ou expirado',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    const activeUser = await isActiveUser(user.user_id, user.tenant_id);
    if (!activeUser) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'Token inválido ou expirado',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      valid: true,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
      },
    });
  } catch (error) {
    logger.error('Error verifying token', error);

    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
