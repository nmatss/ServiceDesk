/**
 * Gov.br Token Refresh Route
 * POST /api/auth/govbr/refresh
 *
 * Refreshes Gov.br access token using refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshGovBrTokens } from '@/lib/integrations/govbr/verification';
import { logger } from '@/lib/monitoring/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User ID is required',
        },
        { status: 400 }
      );
    }

    const result = await refreshGovBrTokens(userId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Token refresh failed',
        },
        { status: 401 }
      );
    }

    logger.info('Gov.br tokens refreshed successfully', { userId });

    return NextResponse.json({
      success: true,
      message: 'Tokens refreshed successfully',
      tokens: result.tokens,
    });
  } catch (error) {
    logger.error('Error in Gov.br token refresh', { error });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
