import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from '@/lib/auth/auth-service';
import { logger } from '@/lib/monitoring/logger';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit/redis-limiter';
/**
 * Test authentication endpoint
 * Used to verify authentication is working correctly
 */
export async function POST(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { email } = await request.json();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    logger.info(`Auth test request from IP: ${ip}`, { email });

    return NextResponse.json({
      success: true,
      message: "Auth test endpoint is working",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Auth test error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.AUTH_LOGIN);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Check if user is authenticated
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        authenticated: false,
        message: "No token provided"
      });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (user) {
      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        }
      });
    } else {
      return NextResponse.json({
        authenticated: false,
        message: "Invalid token"
      });
    }
  } catch (error) {
    logger.error("Auth test GET error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
