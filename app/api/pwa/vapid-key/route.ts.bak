/**
 * VAPID Public Key API Route
 * Returns the public VAPID key for push notification subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublicVapidKey } from '@/lib/pwa/vapid-manager';
import logger from '@/lib/monitoring/structured-logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const publicKey = getPublicVapidKey();

    logger.info('VAPID public key requested', {
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json(
      {
        publicKey,
        algorithm: 'ES256',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        },
      }
    );
  } catch (error) {
    logger.error('Failed to retrieve VAPID public key', error);

    return NextResponse.json(
      {
        error: 'Failed to retrieve VAPID key',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
