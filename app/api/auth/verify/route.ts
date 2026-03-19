import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
import { verifyAccessToken } from '@/lib/auth/token-manager';
import { executeQueryOne, sqlTrue } from '@/lib/db/adapter';
import { apiError } from '@/lib/api/api-helpers';

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
  const user = await executeQueryOne<{ id: number }>(
    `SELECT id FROM users WHERE id = ? AND is_active = ${sqlTrue()} AND (organization_id = ? OR tenant_id = ?)`,
    [userId, tenantId, tenantId]
  );
  return !!user;
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const authHeader = request.headers.get('authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token =
      tokenFromHeader ||
      request.cookies?.get?.('auth_token')?.value ||
      tokenFromCookieHeader(request.headers.get('cookie'));

    if (!token) {
      return apiError('Token não fornecido', 401, 'NO_TOKEN');
    }

    const user = await verifyTokenString(token);
    if (!user) {
      return apiError('Token inválido ou expirado', 401, 'INVALID_TOKEN');
    }

    const activeUser = await isActiveUser(user.user_id, user.tenant_id);
    if (!activeUser) {
      return apiError('Token inválido ou expirado', 401, 'INVALID_TOKEN');
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

    return apiError('Erro interno do servidor', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.DEFAULT);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { token } = await request.json();

    if (!token) {
      return apiError('Token não fornecido', 400, 'NO_TOKEN');
    }

    const user = await verifyTokenString(token);
    if (!user) {
      return apiError('Token inválido ou expirado', 401, 'INVALID_TOKEN');
    }

    const activeUser = await isActiveUser(user.user_id, user.tenant_id);
    if (!activeUser) {
      return apiError('Token inválido ou expirado', 401, 'INVALID_TOKEN');
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

    return apiError('Erro interno do servidor', 500, 'INTERNAL_ERROR');
  }
}
