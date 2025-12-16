import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from '@/lib/auth/sqlite-auth';
import { logger } from '@/lib/monitoring/logger';

/**
 * Test authentication endpoint
 * Used to verify authentication is working correctly
 */
export async function POST(request: NextRequest) {
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
